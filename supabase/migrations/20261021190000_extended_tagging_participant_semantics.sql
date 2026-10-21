-- Protect facts consumed by existing receptions/interceptions analytics and
-- impossible in/out transitions. RLS policies and RPC grants are unchanged.
create or replace function private.validate_extended_event_participant()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_type text;
    v_pass_result text;
    v_other_role text;
    v_old_event uuid;
    v_old_participant uuid;
    v_old_role text;
begin
    -- The existing event_child_require_editable_analysis trigger locks the
    -- analysis row first, serializing checks against sibling role/detail writes.
    select e.event_type, pe.result into v_type, v_pass_result
      from public.events e left join public.pass_events pe on pe.event_id = e.id
     where e.id = new.event_id and e.analysis_id = new.analysis_id;

    if v_type = 'pass' then
        if new.role = 'receiver' and v_pass_result is distinct from 'completed' then
            raise exception 'receiver requires pass result completed' using errcode = '23514';
        end if;
        if new.role = 'intended_receiver' and
           (v_pass_result is null or v_pass_result not in ('incomplete', 'intercepted')) then
            raise exception 'intended_receiver requires pass result incomplete or intercepted' using errcode = '23514';
        end if;
    end if;

    v_other_role := case
        when v_type = 'substitution' and new.role = 'player_out' then 'player_in'
        when v_type = 'substitution' and new.role = 'player_in' then 'player_out'
        when v_type = 'goalkeeper_change' and new.role = 'goalkeeper_out' then 'goalkeeper_in'
        when v_type = 'goalkeeper_change' and new.role = 'goalkeeper_in' then 'goalkeeper_out'
    end;
    if tg_op = 'UPDATE' then
        v_old_event := old.event_id;
        v_old_participant := old.analysis_participant_id;
        v_old_role := old.role;
    end if;
    if v_other_role is not null and exists (
        select 1 from public.event_participants ep
         where ep.event_id = new.event_id
           and ep.analysis_participant_id = new.analysis_participant_id
           and ep.role = v_other_role
           and (ep.event_id, ep.analysis_participant_id, ep.role)
               is distinct from (v_old_event, v_old_participant, v_old_role)
    ) then
        raise exception 'outgoing and incoming participants must be distinct' using errcode = '23514';
    end if;
    return new;
end;
$$;
revoke all on function private.validate_extended_event_participant() from public, anon, authenticated;
create trigger event_participants_validate_extended_semantics
before insert or update of event_id, analysis_id, analysis_participant_id, role
on public.event_participants
for each row execute function private.validate_extended_event_participant();

-- Editing/removing the detail must not invalidate already recorded roles either.
create or replace function private.protect_pass_receiver_semantics()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    if tg_op = 'DELETE' then
        if exists (select 1 from public.events e where e.id = old.event_id) and exists (
            select 1 from public.event_participants ep where ep.event_id = old.event_id
              and ep.role in ('receiver', 'intended_receiver')
        ) then
            raise exception 'remove receiver roles before deleting pass detail' using errcode = '23514';
        end if;
        return old;
    end if;
    if exists (
        select 1 from public.event_participants ep
         where ep.event_id = new.event_id and (
             (ep.role = 'receiver' and new.result is distinct from 'completed') or
             (ep.role = 'intended_receiver' and (new.result is null or new.result not in ('incomplete', 'intercepted')))
         )
    ) then
        raise exception 'pass result is incompatible with receiver roles' using errcode = '23514';
    end if;
    return new;
end;
$$;
revoke all on function private.protect_pass_receiver_semantics() from public, anon, authenticated;
create trigger pass_events_protect_receiver_semantics
before update or delete on public.pass_events
for each row execute function private.protect_pass_receiver_semantics();
