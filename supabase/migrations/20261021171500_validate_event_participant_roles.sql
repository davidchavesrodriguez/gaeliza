-- Gaeliza v2 - keep participant roles semantically compatible with event type.

create or replace function private.validate_event_participant_role()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_event_type text;
    v_pass_result text;
    v_shot_result text;
    v_allowed boolean := false;
begin
    select e.event_type
      into v_event_type
      from public.events e
     where e.id = new.event_id
       and e.analysis_id = new.analysis_id;

    if not found then
        raise exception 'event % does not exist in analysis %', new.event_id, new.analysis_id
            using errcode = '23503';
    end if;

    v_allowed := case v_event_type
        when 'shot' then new.role in ('shooter', 'assister', 'goalkeeper', 'blocker')
        when 'pass' then new.role in ('passer', 'receiver', 'intended_receiver', 'interceptor')
        when 'recovery' then new.role in ('recoverer', 'opponent')
        when 'turnover' then new.role in ('turnover_player', 'opponent')
        when 'duel' then new.role in ('duel_winner', 'duel_loser')
        when 'dribble' then new.role in ('dribbler', 'defender')
        when 'foul' then new.role in ('offender', 'fouled')
        when 'card' then new.role = 'card_recipient'
        when 'kickout' then new.role in ('kicker', 'target', 'kickout_receiver', 'opponent')
        when 'restart' then new.role in ('restart_taker', 'receiver', 'target', 'opponent')
        when 'block' then new.role in ('blocker', 'blocked_player')
        when 'substitution' then new.role in ('player_out', 'player_in')
        when 'goalkeeper_change' then new.role in ('goalkeeper_out', 'goalkeeper_in')
        else false
    end;

    if not v_allowed then
        raise exception 'role % is not valid for event type %', new.role, v_event_type
            using errcode = '23514';
    end if;

    if v_event_type = 'pass' and new.role = 'interceptor' then
        select pe.result
          into v_pass_result
          from public.pass_events pe
         where pe.event_id = new.event_id;

        if v_pass_result is distinct from 'intercepted' then
            raise exception 'interceptor role requires pass result intercepted'
                using errcode = '23514';
        end if;
    end if;

    if v_event_type = 'shot' and new.role = 'blocker' then
        select se.result
          into v_shot_result
          from public.shot_events se
         where se.event_id = new.event_id;

        if v_shot_result is distinct from 'blocked' then
            raise exception 'blocker role on a shot requires shot result blocked'
                using errcode = '23514';
        end if;
    end if;

    if v_event_type = 'shot' and new.role = 'assister' then
        select se.result
          into v_shot_result
          from public.shot_events se
         where se.event_id = new.event_id;

        if v_shot_result not in ('goal', 'point') then
            raise exception 'assister role requires a scoring shot'
                using errcode = '23514';
        end if;
    end if;

    return new;
end;
$$;

revoke all on function private.validate_event_participant_role() from public, anon, authenticated;

create trigger event_participants_validate_role
before insert or update of event_id, analysis_id, role
on public.event_participants
for each row execute function private.validate_event_participant_role();
