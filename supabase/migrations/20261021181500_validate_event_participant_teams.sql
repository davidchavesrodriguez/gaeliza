-- Gaeliza v2 - participant roles must belong to the semantically correct team.

create or replace function private.validate_event_participant_team()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_event_team_id uuid;
    v_participant_team_id uuid;
    v_expectation text;
begin
    select e.team_id
      into v_event_team_id
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
        when new.role in (
            'shooter', 'assister',
            'passer', 'receiver', 'intended_receiver',
            'recoverer', 'turnover_player',
            'duel_winner', 'dribbler',
            'offender', 'card_recipient',
            'kicker', 'target', 'kickout_receiver',
            'restart_taker', 'blocker',
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
        raise exception 'role % has no participant-team semantic configured', new.role
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
