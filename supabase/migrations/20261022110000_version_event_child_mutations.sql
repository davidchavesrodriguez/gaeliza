-- The event version covers its entire editable aggregate, including direct
-- Data API writes to details/roles. Do not alter timestamp semantics elsewhere.
create function private.set_event_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
    -- now() is transaction-stable. Use wall time and a strict lower bound so
    -- successive edits in one transaction (or a clock adjustment) cannot reuse
    -- a previously loaded token. Ignore any client-supplied updated_at.
    if pg_catalog.isfinite(old.updated_at) then
        new.updated_at := greatest(pg_catalog.clock_timestamp(), old.updated_at + interval '1 microsecond');
    else
        new.updated_at := pg_catalog.clock_timestamp();
    end if;
    return new;
end;
$$;
revoke all on function private.set_event_updated_at() from public, anon, authenticated;

drop trigger events_set_updated_at on public.events;
create trigger events_set_updated_at
before update on public.events
for each row execute function private.set_event_updated_at();

create function private.version_event_after_child_change()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
    v_old_event_id uuid;
    v_new_event_id uuid;
begin
    if tg_op = 'UPDATE' and new is not distinct from old then
        return null; -- Do not write the parent for a no-op child update.
    end if;
    if tg_op <> 'INSERT' then v_old_event_id := old.event_id; end if;
    if tg_op <> 'DELETE' then v_new_event_id := new.event_id; end if;

    -- The child's BEFORE guard already locks the analysis(es) and checks
    -- completed. Touch each distinct parent once, including both sides of any
    -- permitted reassignment. RLS still applies to this UPDATE.
    -- During ON DELETE CASCADE the parent is absent: this affects zero rows.
    update public.events e set updated_at = e.updated_at
     where e.id in (v_old_event_id, v_new_event_id);
    -- The parent timestamp trigger versions the row; no parent trigger writes children.
    return null;
end;
$$;
revoke all on function private.version_event_after_child_change() from public, anon, authenticated;

do $$
declare v_table text;
begin
    foreach v_table in array array[
        'shot_events', 'pass_events', 'recovery_events', 'turnover_events',
        'duel_events', 'dribble_events', 'foul_events', 'card_events',
        'kickout_events', 'restart_events', 'event_participants'
    ] loop
        execute format('create trigger event_child_version_parent
            after insert or update or delete on public.%I
            for each row execute function private.version_event_after_child_change()', v_table);
    end loop;
end;
$$;

comment on function private.version_event_after_child_change() is
'Versions the owning event after actual detail/role mutations under caller RLS; absent cascade parents and no-op updates cause no parent write.';
