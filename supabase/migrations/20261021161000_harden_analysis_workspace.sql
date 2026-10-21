-- Gaeliza v2 - harden analysis workspace invariants before event modeling

-- The UNIQUE constraints on (analysis_id, sort_order) already provide covering
-- indexes, so the explicit duplicates from the initial workspace migration are
-- unnecessary.
drop index if exists public.analysis_periods_analysis_sort_idx;
drop index if exists public.analysis_videos_analysis_sort_idx;

-- Sync points are editable calibration data, so keep updated_at consistently.
alter table public.video_sync_points
    add column updated_at timestamptz not null default now();

create trigger video_sync_points_set_updated_at
before update on public.video_sync_points
for each row execute function private.set_updated_at();

-- completed_at is DB-managed. Clients cannot backdate/clear it while an analysis
-- remains completed; reopening clears it, and completing again records a new time.
create or replace function private.set_analysis_completed_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
    if tg_op = 'INSERT' then
        if new.status = 'completed' then
            new.completed_at = now();
        else
            new.completed_at = null;
        end if;
    elsif new.status = 'completed' and old.status is distinct from 'completed' then
        new.completed_at = now();
    elsif new.status <> 'completed' then
        new.completed_at = null;
    else
        new.completed_at = old.completed_at;
    end if;

    return new;
end;
$$;

revoke all on function private.set_analysis_completed_at() from public, anon, authenticated;

drop trigger if exists analyses_set_completed_at on public.analyses;

create trigger analyses_set_completed_at
before insert or update of status, completed_at on public.analyses
for each row execute function private.set_analysis_completed_at();

-- An analysis is permanently tied to the match and owner it was created for.
-- Changing either after periods/participants exist would invalidate historical
-- and authorization assumptions throughout the analysis domain.
create or replace function private.prevent_analysis_identity_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
    if new.match_id is distinct from old.match_id then
        raise exception 'analysis match_id is immutable'
            using errcode = '23514';
    end if;

    if new.owner_user_id is distinct from old.owner_user_id then
        raise exception 'analysis owner_user_id is immutable'
            using errcode = '23514';
    end if;

    return new;
end;
$$;

revoke all on function private.prevent_analysis_identity_change() from public, anon, authenticated;

create trigger analyses_prevent_identity_change
before update of match_id, owner_user_id on public.analyses
for each row execute function private.prevent_analysis_identity_change();
