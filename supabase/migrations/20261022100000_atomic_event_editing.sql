-- Atomic editing under caller RLS. No event_type argument: identity is immutable.
-- Conservative possession policy: reject linked manual events; detach inferred
-- associations, never delete/rebuild possessions or touch other event links.
create function public.update_event(
    p_analysis_id uuid,
    p_event_id uuid,
    p_team_id uuid,
    p_period_id uuid,
    p_second_in_period integer,
    p_expected_updated_at timestamptz,
    p_x numeric default null,
    p_y numeric default null,
    p_detail jsonb default '{}'::jsonb,
    p_participants jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
    v_event public.events%rowtype;
    v_status text;
    v_owner uuid;
    v_possession_source text;
    v_participant jsonb;
begin
    if (select auth.uid()) is null then
        raise exception 'authentication required' using errcode = '42501';
    end if;
    -- Lock the analysis before the event, matching the completed boundary and
    -- serializing this operation against other edits/explicit reconstruction.
    select a.status, a.owner_user_id into v_status, v_owner
      from public.analyses a where a.id = p_analysis_id for update;
    if not found or v_owner <> (select auth.uid()) then
        raise exception 'analysis is not owned by the current user' using errcode = '42501';
    end if;
    if v_status = 'completed' then
        raise exception 'completed analyses must be reopened before editing events' using errcode = '23514';
    end if;
    select e.* into v_event from public.events e
     where e.id = p_event_id and e.analysis_id = p_analysis_id for update;
    if not found then
        raise exception 'event not found in this analysis' using errcode = '42501';
    end if;
    if p_expected_updated_at is null then
        raise exception 'expected updated_at is required' using errcode = '22023';
    end if;
    if v_event.updated_at <> p_expected_updated_at then
        raise exception 'event changed since it was loaded; reload before editing' using errcode = '40001';
    end if;
    if jsonb_typeof(coalesce(p_detail, '{}'::jsonb)) <> 'object'
       or jsonb_typeof(coalesce(p_participants, '[]'::jsonb)) <> 'array' then
        raise exception 'detail must be an object and participants an array' using errcode = '22023';
    end if;
    if v_event.possession_id is not null then
        select p.source into v_possession_source from public.possessions p
         where p.id = v_event.possession_id and p.analysis_id = p_analysis_id for update;
        if v_possession_source = 'manual' then
            raise exception 'event belongs to a manual possession; review its association explicitly before editing' using errcode = '55000';
        end if;
    end if;

    delete from public.event_participants where event_id = p_event_id and analysis_id = p_analysis_id;
    update public.events
       set team_id = p_team_id, period_id = p_period_id, second_in_period = p_second_in_period,
           x = p_x, y = p_y, possession_id = null
     where id = p_event_id and analysis_id = p_analysis_id;
    -- notes, sort_order, created_by and created_at are not editor-owned.
    case v_event.event_type
        when 'shot' then
            insert into public.shot_events (event_id, result, technique, situation)
            values (
                p_event_id,
                nullif(p_detail ->> 'result', ''),
                nullif(p_detail ->> 'technique', ''),
                nullif(p_detail ->> 'situation', '')
            )
            on conflict (event_id) do update set result = excluded.result, technique = excluded.technique, situation = excluded.situation;

        when 'pass' then
            insert into public.pass_events (event_id, result, technique, end_x, end_y)
            values (
                p_event_id,
                nullif(p_detail ->> 'result', ''),
                nullif(p_detail ->> 'technique', ''),
                nullif(p_detail ->> 'end_x', '')::numeric,
                nullif(p_detail ->> 'end_y', '')::numeric
            )
            on conflict (event_id) do update set result = excluded.result, technique = excluded.technique, end_x = excluded.end_x, end_y = excluded.end_y;

        when 'recovery' then
            insert into public.recovery_events (event_id, method)
            values (p_event_id, nullif(p_detail ->> 'method', ''))
            on conflict (event_id) do update set method = excluded.method;

        when 'turnover' then
            insert into public.turnover_events (event_id, cause)
            values (p_event_id, nullif(p_detail ->> 'cause', ''))
            on conflict (event_id) do update set cause = excluded.cause;

        when 'duel' then
            insert into public.duel_events (event_id, duel_type)
            values (p_event_id, nullif(p_detail ->> 'duel_type', ''))
            on conflict (event_id) do update set duel_type = excluded.duel_type;

        when 'dribble' then
            insert into public.dribble_events (event_id, result)
            values (p_event_id, nullif(p_detail ->> 'result', ''))
            on conflict (event_id) do update set result = excluded.result;

        when 'foul' then
            insert into public.foul_events (event_id, cause, outcome)
            values (
                p_event_id,
                nullif(p_detail ->> 'cause', ''),
                nullif(p_detail ->> 'outcome', '')
            )
            on conflict (event_id) do update set cause = excluded.cause, outcome = excluded.outcome;

        when 'card' then
            insert into public.card_events (event_id, card_type)
            values (
                p_event_id,
                nullif(p_detail ->> 'card_type', '')
            )
            on conflict (event_id) do update set card_type = excluded.card_type;

        when 'kickout' then
            insert into public.kickout_events (event_id, length, result, end_x, end_y)
            values (
                p_event_id,
                nullif(p_detail ->> 'length', ''),
                nullif(p_detail ->> 'result', ''),
                nullif(p_detail ->> 'end_x', '')::numeric,
                nullif(p_detail ->> 'end_y', '')::numeric
            )
            on conflict (event_id) do update set length = excluded.length, result = excluded.result, end_x = excluded.end_x, end_y = excluded.end_y;

        when 'restart' then
            insert into public.restart_events (event_id, restart_type)
            values (p_event_id, nullif(p_detail ->> 'restart_type', ''))
            on conflict (event_id) do update set restart_type = excluded.restart_type;

        when 'block', 'substitution', 'goalkeeper_change' then
            null;

        else
            raise exception 'unsupported event type %', v_event.event_type
                using errcode = '22023';
    end case;

    for v_participant in select value from jsonb_array_elements(coalesce(p_participants, '[]'::jsonb))
    loop
        if jsonb_typeof(v_participant) <> 'object' then
            raise exception 'each participant must be an object' using errcode = '22023';
        end if;
        insert into public.event_participants (event_id, analysis_id, analysis_participant_id, role)
        values (p_event_id, p_analysis_id, (v_participant ->> 'participant_id')::uuid, v_participant ->> 'role');
    end loop;
    return p_event_id;
end;
$$;
revoke all on function public.update_event(uuid, uuid, uuid, uuid, integer, timestamptz, numeric, numeric, jsonb, jsonb) from public, anon;
grant execute on function public.update_event(uuid, uuid, uuid, uuid, integer, timestamptz, numeric, numeric, jsonb, jsonb) to authenticated;
comment on function public.update_event(uuid, uuid, uuid, uuid, integer, timestamptz, numeric, numeric, jsonb, jsonb) is
'Atomically replaces editable event fields, typed details and roles under caller RLS with optimistic concurrency. Manual-linked events require explicit association review; inferred links detach without rebuilding.';
