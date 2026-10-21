-- Gaeliza v2 - harden canonical event model and add atomic event capture RPC

-- ---------------------------------------------------------------------------
-- Stable analysis/template semantics
-- ---------------------------------------------------------------------------

create or replace function private.validate_analysis_template()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
    v_config jsonb;
begin
    if new.template_id is null then
        if tg_op = 'INSERT' or new.template_id is distinct from old.template_id then
            new.template_config_snapshot = coalesce(new.template_config_snapshot, '{}'::jsonb);
        end if;
        return new;
    end if;

    select t.config
      into v_config
      from public.analysis_templates t
     where t.id = new.template_id;

    if not found then
        raise exception 'analysis template % is not accessible', new.template_id
            using errcode = '23503';
    end if;

    if tg_op = 'INSERT' or new.template_id is distinct from old.template_id then
        new.template_config_snapshot = v_config;
    end if;

    return new;
end;
$$;

revoke all on function private.validate_analysis_template() from public, anon, authenticated;

create trigger analyses_validate_template
before insert or update of template_id on public.analyses
for each row execute function private.validate_analysis_template();

-- ---------------------------------------------------------------------------
-- Immutable event identity
-- ---------------------------------------------------------------------------

create or replace function private.prevent_event_identity_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
    if new.analysis_id is distinct from old.analysis_id then
        raise exception 'event analysis_id is immutable'
            using errcode = '23514';
    end if;

    if new.event_type is distinct from old.event_type then
        raise exception 'event_type is immutable; replace the event instead'
            using errcode = '23514';
    end if;

    if new.created_by is distinct from old.created_by then
        raise exception 'event created_by is immutable'
            using errcode = '23514';
    end if;

    return new;
end;
$$;

revoke all on function private.prevent_event_identity_change() from public, anon, authenticated;

create trigger events_prevent_identity_change
before update on public.events
for each row execute function private.prevent_event_identity_change();

create or replace function private.prevent_possession_analysis_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
    if new.analysis_id is distinct from old.analysis_id then
        raise exception 'possession analysis_id is immutable'
            using errcode = '23514';
    end if;

    return new;
end;
$$;

revoke all on function private.prevent_possession_analysis_change() from public, anon, authenticated;

create trigger possessions_prevent_analysis_change
before update on public.possessions
for each row execute function private.prevent_possession_analysis_change();

-- ---------------------------------------------------------------------------
-- Atomic event creation
--
-- JSONB is only an RPC transport format here. Core analytical values are stored
-- in typed detail tables and participant rows.
-- ---------------------------------------------------------------------------

create or replace function public.log_event(
    p_analysis_id uuid,
    p_period_id uuid,
    p_team_id uuid,
    p_event_type text,
    p_second_in_period integer,
    p_possession_id uuid default null,
    p_x numeric default null,
    p_y numeric default null,
    p_notes text default null,
    p_detail jsonb default '{}'::jsonb,
    p_participants jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
    v_event_id uuid;
    v_participant jsonb;
begin
    if (select auth.uid()) is null then
        raise exception 'authentication required'
            using errcode = '42501';
    end if;

    if jsonb_typeof(coalesce(p_detail, '{}'::jsonb)) <> 'object' then
        raise exception 'p_detail must be a JSON object'
            using errcode = '22023';
    end if;

    if jsonb_typeof(coalesce(p_participants, '[]'::jsonb)) <> 'array' then
        raise exception 'p_participants must be a JSON array'
            using errcode = '22023';
    end if;

    insert into public.events (
        analysis_id,
        possession_id,
        team_id,
        period_id,
        event_type,
        second_in_period,
        x,
        y,
        notes,
        created_by
    )
    values (
        p_analysis_id,
        p_possession_id,
        p_team_id,
        p_period_id,
        p_event_type,
        p_second_in_period,
        p_x,
        p_y,
        p_notes,
        (select auth.uid())
    )
    returning id into v_event_id;

    case p_event_type
        when 'shot' then
            insert into public.shot_events (event_id, result, technique, situation)
            values (
                v_event_id,
                nullif(p_detail ->> 'result', ''),
                nullif(p_detail ->> 'technique', ''),
                nullif(p_detail ->> 'situation', '')
            );

        when 'pass' then
            insert into public.pass_events (event_id, result, technique, end_x, end_y)
            values (
                v_event_id,
                nullif(p_detail ->> 'result', ''),
                nullif(p_detail ->> 'technique', ''),
                nullif(p_detail ->> 'end_x', '')::numeric,
                nullif(p_detail ->> 'end_y', '')::numeric
            );

        when 'recovery' then
            insert into public.recovery_events (event_id, method)
            values (v_event_id, nullif(p_detail ->> 'method', ''));

        when 'turnover' then
            insert into public.turnover_events (event_id, cause)
            values (v_event_id, nullif(p_detail ->> 'cause', ''));

        when 'duel' then
            insert into public.duel_events (event_id, duel_type)
            values (v_event_id, nullif(p_detail ->> 'duel_type', ''));

        when 'dribble' then
            insert into public.dribble_events (event_id, result)
            values (v_event_id, nullif(p_detail ->> 'result', ''));

        when 'foul' then
            insert into public.foul_events (event_id, cause, outcome)
            values (
                v_event_id,
                nullif(p_detail ->> 'cause', ''),
                nullif(p_detail ->> 'outcome', '')
            );

        when 'card' then
            insert into public.card_events (event_id, card_type, related_foul_event_id)
            values (
                v_event_id,
                nullif(p_detail ->> 'card_type', ''),
                nullif(p_detail ->> 'related_foul_event_id', '')::uuid
            );

        when 'kickout' then
            insert into public.kickout_events (event_id, length, result, end_x, end_y)
            values (
                v_event_id,
                nullif(p_detail ->> 'length', ''),
                nullif(p_detail ->> 'result', ''),
                nullif(p_detail ->> 'end_x', '')::numeric,
                nullif(p_detail ->> 'end_y', '')::numeric
            );

        when 'restart' then
            insert into public.restart_events (event_id, restart_type)
            values (v_event_id, nullif(p_detail ->> 'restart_type', ''));

        when 'block', 'substitution', 'goalkeeper_change' then
            null;

        else
            raise exception 'unsupported event type %', p_event_type
                using errcode = '22023';
    end case;

    for v_participant in
        select value
        from jsonb_array_elements(coalesce(p_participants, '[]'::jsonb))
    loop
        if jsonb_typeof(v_participant) <> 'object' then
            raise exception 'each participant must be a JSON object'
                using errcode = '22023';
        end if;

        insert into public.event_participants (
            event_id,
            analysis_id,
            analysis_participant_id,
            role
        )
        values (
            v_event_id,
            p_analysis_id,
            (v_participant ->> 'participant_id')::uuid,
            v_participant ->> 'role'
        );
    end loop;

    return v_event_id;
end;
$$;

revoke all on function public.log_event(
    uuid, uuid, uuid, text, integer, uuid, numeric, numeric, text, jsonb, jsonb
) from public, anon;

grant execute on function public.log_event(
    uuid, uuid, uuid, text, integer, uuid, numeric, numeric, text, jsonb, jsonb
) to authenticated;

comment on function public.log_event(
    uuid, uuid, uuid, text, integer, uuid, numeric, numeric, text, jsonb, jsonb
) is 'Atomically creates a canonical event, its typed detail row and participant-role rows under caller RLS.';
