-- Gaeliza v2 - timeline invariants needed by synchronized tagging.

create unique index video_sync_points_period_second_uidx
    on public.video_sync_points (
        analysis_video_id,
        analysis_period_id,
        second_in_period
    );

create or replace function private.validate_video_sync_monotonicity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    if exists (
        select 1
        from public.video_sync_points sp
        where sp.analysis_video_id = new.analysis_video_id
          and sp.analysis_period_id = new.analysis_period_id
          and sp.id <> new.id
          and (
              (sp.second_in_period < new.second_in_period and sp.video_second >= new.video_second)
              or
              (sp.second_in_period > new.second_in_period and sp.video_second <= new.video_second)
          )
    ) then
        raise exception 'synchronization points must increase monotonically within the same video and period'
            using errcode = '23514';
    end if;

    return new;
end;
$$;

revoke all on function private.validate_video_sync_monotonicity() from public, anon, authenticated;

create trigger video_sync_points_validate_monotonicity
before insert or update of analysis_video_id, analysis_period_id, video_second, second_in_period
on public.video_sync_points
for each row execute function private.validate_video_sync_monotonicity();

create or replace function private.ensure_event_analysis_editable()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_analysis_id uuid;
    v_status text;
begin
    v_analysis_id := case when tg_op = 'DELETE' then old.analysis_id else new.analysis_id end;

    select a.status
      into v_status
      from public.analyses a
     where a.id = v_analysis_id;

    if not found then
        raise exception 'analysis % does not exist', v_analysis_id
            using errcode = '23503';
    end if;

    if v_status = 'completed' then
        raise exception 'completed analyses must be reopened before editing events'
            using errcode = '23514';
    end if;

    if tg_op = 'DELETE' then
        return old;
    end if;

    return new;
end;
$$;

revoke all on function private.ensure_event_analysis_editable() from public, anon, authenticated;

create trigger events_require_editable_analysis
before insert or update or delete on public.events
for each row execute function private.ensure_event_analysis_editable();

create or replace function private.mark_analysis_in_progress_after_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    update public.analyses
       set status = 'in_progress'
     where id = new.analysis_id
       and status = 'draft';

    return new;
end;
$$;

revoke all on function private.mark_analysis_in_progress_after_event() from public, anon, authenticated;

create trigger events_mark_analysis_in_progress
after insert on public.events
for each row execute function private.mark_analysis_in_progress_after_event();

comment on index public.video_sync_points_period_second_uidx is
'Prevents ambiguous mappings: one video may map a given period second only once.';
