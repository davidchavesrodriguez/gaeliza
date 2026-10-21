-- Gaeliza v2 - participant roles must belong to the semantically correct team.

create or replace function private.validate_event_participant_team()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_event_team_id uuid;
    v_event_type text;
    v_participant_team_id uuid;
    v_expectation text;
begin
    select e.team_id, e.event_type
      into v_event_team_id, v_event_type
      from public.events e
     where e.id = new.event_id
       and e.analysis_id = new.analysis_id;

    if not found then
        raise exception 'event % does not exist in analysis %', new.event_id, new.analysis_id
            using errcode = '23503';
    end if;

    select ap.team_id
      into v_participant_team_id
      from public.analysis_participants ap
     where ap.id = new.analysis_participant_id
       and ap.analysis_id = new.analysis_id;

    if not found then
        raise exception 'participant % does not exist in analysis %', new.analysis_participant_id, new.analysis_id
            using errcode = '23503';
    end if;

    v_expectation := case
        when new.role = 'blocker' and v_event_type = 'shot' then 'opponent'
        when new.role = 'blocker' and v_event_type = 'block' then 'same'
        when new.role in (
            'shooter', 'assister',
            'passer', 'receiver', 'intended_receiver',
            'recoverer', 'turnover_player',
            'duel_winner', 'dribbler',
            'offender', 'card_recipient',
            'kicker', 'target', 'kickout_receiver',
            'restart_taker',
            'player_out', 'player_in',
            'goalkeeper_out', 'goalkeeper_in'
        ) then 'same'
        when new.role in (
            'goalkeeper', 'interceptor', 'opponent',
            'duel_loser', 'defender', 'fouled', 'blocked_player'
        ) then 'opponent'
        else null
    end;

    if v_expectation is null then
        raise exception 'role % has no participant-team semantic configured for event type %', new.role, v_event_type
            using errcode = '23514';
    end if;

    if v_expectation = 'same' and v_participant_team_id <> v_event_team_id then
        raise exception 'role % must belong to the event team', new.role
            using errcode = '23514';
    end if;

    if v_expectation = 'opponent' and v_participant_team_id = v_event_team_id then
        raise exception 'role % must belong to the opposing team', new.role
            using errcode = '23514';
    end if;

    return new;
end;
$$;

revoke all on function private.validate_event_participant_team() from public, anon, authenticated;

create trigger event_participants_validate_team_semantics
before insert or update of event_id, analysis_id, analysis_participant_id, role
on public.event_participants
for each row execute function private.validate_event_participant_team();

-- Existing participant roles must remain valid when their parent changes too.
-- Team reassignment is explicit: first remove the affected role rows.
create or replace function private.protect_tagging_participant_semantics()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    if tg_table_name in ('shot_events', 'pass_events') then
        if tg_op = 'DELETE' then
            -- A parent event deletion cascades through details and roles together.
            if exists (select 1 from public.events e where e.id = old.event_id) and exists (
                select 1 from public.event_participants ep where ep.event_id = old.event_id
                  and ep.role in ('blocker', 'assister', 'interceptor')
            ) then
                raise exception 'remove result-dependent roles before deleting event detail' using errcode = '23514';
            end if;
            return old;
        end if;
        if new.event_id is distinct from old.event_id then
            raise exception 'event detail cannot be moved to another event' using errcode = '23514';
        end if;
    end if;
    if tg_table_name = 'events' then
        perform 1 from public.analyses a where a.id = new.analysis_id for update;
        if new.team_id is distinct from old.team_id and exists (
            select 1 from public.event_participants ep where ep.event_id = old.id
        ) then
            raise exception 'remove participant roles before changing event team' using errcode = '23514';
        end if;
    elsif tg_table_name = 'analysis_participants' then
        perform 1 from public.analyses a where a.id = new.analysis_id for update;
        if (new.team_id, new.analysis_id) is distinct from (old.team_id, old.analysis_id) and exists (
            select 1 from public.event_participants ep where ep.analysis_participant_id = old.id
        ) then
            raise exception 'referenced participant team and analysis cannot change' using errcode = '23514';
        end if;
    elsif tg_table_name = 'shot_events' then
        if exists (
            select 1 from public.event_participants ep
             where ep.event_id = new.event_id and (
                (ep.role = 'blocker' and new.result is distinct from 'blocked') or
                (ep.role = 'assister' and (new.result is null or new.result not in ('goal', 'point')))
             )
        ) then
            raise exception 'shot result is incompatible with existing participant roles' using errcode = '23514';
        end if;
    elsif tg_table_name = 'pass_events' then
        if new.result is distinct from 'intercepted' and exists (
            select 1 from public.event_participants ep
             where ep.event_id = new.event_id and ep.role = 'interceptor'
        ) then
            raise exception 'interceptor role requires pass result intercepted' using errcode = '23514';
        end if;
    end if;
    return new;
end;
$$;
revoke all on function private.protect_tagging_participant_semantics() from public, anon, authenticated;
create trigger events_protect_participant_semantics
before update of team_id on public.events
for each row execute function private.protect_tagging_participant_semantics();
create trigger analysis_participants_protect_event_semantics
before update of team_id, analysis_id on public.analysis_participants
for each row execute function private.protect_tagging_participant_semantics();
create trigger shot_events_protect_participant_semantics
before update or delete on public.shot_events
for each row execute function private.protect_tagging_participant_semantics();
create trigger pass_events_protect_participant_semantics
before update or delete on public.pass_events
for each row execute function private.protect_tagging_participant_semantics();
