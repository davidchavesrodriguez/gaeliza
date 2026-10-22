-- Workspace activity is a database invariant, not a dashboard approximation.
-- Reuse the monotonic event clock for both aggregates, including same-transaction
-- writes. Explicit timestamp touches are signals; client timestamps are never trusted.
alter function private.set_event_updated_at() rename to set_aggregate_updated_at;
create or replace function private.set_aggregate_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
    if new is not distinct from old then return new; end if;
    new.updated_at := case when pg_catalog.isfinite(old.updated_at)
        then greatest(pg_catalog.clock_timestamp(), old.updated_at + interval '1 microsecond')
        else pg_catalog.clock_timestamp() end;
    return new;
end;
$$;
revoke all on function private.set_aggregate_updated_at() from public, anon, authenticated;

drop trigger analyses_set_updated_at on public.analyses;
create trigger analyses_set_updated_at before update on public.analyses
for each row execute function private.set_aggregate_updated_at();
-- events_set_updated_at retains its binding to the renamed function.

-- Distinguish a real detail/role change from a direct no-op event UPDATE. The
-- existing child triggers still touch the event exactly once per distinct parent.
create or replace function private.version_event_after_child_change()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
    if tg_op = 'UPDATE' and new is not distinct from old then return null; end if;
    update public.events e
       set updated_at = case when pg_catalog.isfinite(e.updated_at)
           then greatest(pg_catalog.clock_timestamp(), e.updated_at + interval '1 microsecond')
           else pg_catalog.clock_timestamp() end
     where e.id in (
         case when tg_op <> 'INSERT' then old.event_id end,
         case when tg_op <> 'DELETE' then new.event_id end
     );
    return null;
end;
$$;

create function private.propagate_analysis_activity()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
    v_analysis_id uuid;
begin
    if tg_op = 'UPDATE' then
        if new is not distinct from old then return null; end if;
        -- Workspace row timestamp triggers use now(), even for a no-op. Ignore
        -- that bookkeeping. Event version changes, however, include child edits.
        if tg_table_name <> 'events' and
           (to_jsonb(new) - 'updated_at') is not distinct from (to_jsonb(old) - 'updated_at')
        then return null; end if;
    end if;

    -- RLS applies to both the lookup and UPDATE. Lock both sides of a permitted
    -- reassignment in stable order. On analysis DELETE CASCADE the parent is
    -- already absent, so there is no row to lock or update (including completed).
    for v_analysis_id in
        select a.id from public.analyses a
         where a.id in (
             case when tg_op <> 'INSERT' then old.analysis_id end,
             case when tg_op <> 'DELETE' then new.analysis_id end
         ) order by a.id for update
    loop
        update public.analyses a
           set updated_at = case when pg_catalog.isfinite(a.updated_at)
                   then greatest(pg_catalog.clock_timestamp(), a.updated_at + interval '1 microsecond')
                   else pg_catalog.clock_timestamp() end,
               status = case when tg_table_name = 'events' and tg_op = 'INSERT' and a.status = 'draft'
                   then 'in_progress' else a.status end
         where a.id = v_analysis_id;
    end loop;
    -- The parent only changes metadata; it never writes back to its children.
    return null;
end;
$$;
revoke all on function private.propagate_analysis_activity() from public, anon, authenticated;

-- Fold the existing draft -> in_progress transition into the same parent write;
-- there is no additional event-insert touch and no definer privilege is needed.
drop trigger events_mark_analysis_in_progress on public.events;
drop function private.mark_analysis_in_progress_after_event();

do $$
declare v_table text;
begin
    foreach v_table in array array[
        'analysis_participants', 'analysis_videos', 'video_sync_points', 'analysis_periods', 'events'
    ] loop
        execute format('create trigger workspace_propagate_activity
            after insert or update or delete on public.%I
            for each row execute function private.propagate_analysis_activity()', v_table);
    end loop;
end;
$$;

comment on column public.analyses.updated_at is
'Monotonic workspace activity timestamp: analysis metadata, roster, periods, videos, sync and events (including event detail/role versions). Rolled-back writes do not persist activity.';
