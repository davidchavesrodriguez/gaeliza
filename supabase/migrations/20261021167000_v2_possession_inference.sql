-- Gaeliza v2 - deterministic possession inference from canonical events.
--
-- Manual corrections are never overwritten. If an analysis contains any manual
-- possession, automatic rebuild refuses to run and the user must resolve/revert
-- those corrections explicitly first.

create or replace function public.rebuild_inferred_possessions(p_analysis_id uuid)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
    v_home_team_id uuid;
    v_away_team_id uuid;
    v_period record;
    v_event record;
    v_current_id uuid;
    v_current_team_id uuid;
    v_current_start integer;
    v_event_possession_id uuid;
    v_opponent_team_id uuid;
    v_start_reason text;
    v_last_second integer;
    v_created integer := 0;
begin
    if (select auth.uid()) is null then
        raise exception 'authentication required'
            using errcode = '42501';
    end if;

    select m.home_team_id, m.away_team_id
      into v_home_team_id, v_away_team_id
      from public.analyses a
      join public.matches m on m.id = a.match_id
     where a.id = p_analysis_id
       and a.owner_user_id = (select auth.uid());

    if not found then
        raise exception 'analysis % is not owned by the current user', p_analysis_id
            using errcode = '42501';
    end if;

    if exists (
        select 1
        from public.possessions p
        where p.analysis_id = p_analysis_id
          and p.source = 'manual'
    ) then
        raise exception 'manual possessions exist; automatic rebuild would overwrite user corrections'
            using errcode = '23514';
    end if;

    -- FK ON DELETE SET NULL safely detaches existing event links first. We also
    -- clear them explicitly so this function remains obvious and idempotent.
    update public.events
       set possession_id = null
     where analysis_id = p_analysis_id
       and possession_id is not null;

    delete from public.possessions
     where analysis_id = p_analysis_id
       and source = 'inferred';

    for v_period in
        select ap.id, ap.expected_duration_seconds, ap.sort_order
        from public.analysis_periods ap
        where ap.analysis_id = p_analysis_id
        order by ap.sort_order, ap.number, ap.id
    loop
        v_current_id := null;
        v_current_team_id := null;
        v_current_start := null;
        v_last_second := 0;

        for v_event in
            select
                e.id,
                e.team_id,
                e.event_type,
                e.second_in_period,
                e.sort_order,
                pe.result as pass_result,
                se.result as shot_result,
                re.method as recovery_method,
                ke.result as kickout_result,
                fe.outcome as foul_outcome,
                rse.restart_type,
                de.result as dribble_result
            from public.events e
            left join public.pass_events pe on pe.event_id = e.id
            left join public.shot_events se on se.event_id = e.id
            left join public.recovery_events re on re.event_id = e.id
            left join public.kickout_events ke on ke.event_id = e.id
            left join public.foul_events fe on fe.event_id = e.id
            left join public.restart_events rse on rse.event_id = e.id
            left join public.dribble_events de on de.event_id = e.id
            where e.analysis_id = p_analysis_id
              and e.period_id = v_period.id
            order by e.second_in_period, e.sort_order, e.created_at, e.id
        loop
            v_last_second := greatest(v_last_second, v_event.second_in_period);
            v_event_possession_id := null;
            v_opponent_team_id := case
                when v_event.team_id = v_home_team_id then v_away_team_id
                else v_home_team_id
            end;

            -- PASS -----------------------------------------------------------
            if v_event.event_type = 'pass' then
                if v_current_id is null then
                    insert into public.possessions (
                        analysis_id, team_id, period_id, start_second, source
                    ) values (
                        p_analysis_id, v_event.team_id, v_period.id,
                        v_event.second_in_period, 'inferred'
                    ) returning id into v_current_id;
                    v_current_team_id := v_event.team_id;
                    v_current_start := v_event.second_in_period;
                    v_created := v_created + 1;
                elsif v_current_team_id <> v_event.team_id then
                    update public.possessions
                       set end_second = greatest(v_current_start, v_event.second_in_period),
                           end_reason = 'turnover'
                     where id = v_current_id;

                    insert into public.possessions (
                        analysis_id, team_id, period_id, start_second, start_reason, source
                    ) values (
                        p_analysis_id, v_event.team_id, v_period.id,
                        v_event.second_in_period, 'other', 'inferred'
                    ) returning id into v_current_id;
                    v_current_team_id := v_event.team_id;
                    v_current_start := v_event.second_in_period;
                    v_created := v_created + 1;
                end if;

                v_event_possession_id := v_current_id;

                if v_event.pass_result = 'intercepted' then
                    update public.possessions
                       set end_second = greatest(v_current_start, v_event.second_in_period),
                           end_reason = 'turnover'
                     where id = v_current_id;

                    insert into public.possessions (
                        analysis_id, team_id, period_id, start_second, start_reason, source
                    ) values (
                        p_analysis_id, v_opponent_team_id, v_period.id,
                        v_event.second_in_period, 'interception', 'inferred'
                    ) returning id into v_current_id;
                    v_current_team_id := v_opponent_team_id;
                    v_current_start := v_event.second_in_period;
                    v_created := v_created + 1;
                end if;

            -- SHOT -----------------------------------------------------------
            elsif v_event.event_type = 'shot' then
                if v_current_id is null then
                    insert into public.possessions (
                        analysis_id, team_id, period_id, start_second, source
                    ) values (
                        p_analysis_id, v_event.team_id, v_period.id,
                        v_event.second_in_period, 'inferred'
                    ) returning id into v_current_id;
                    v_current_team_id := v_event.team_id;
                    v_current_start := v_event.second_in_period;
                    v_created := v_created + 1;
                elsif v_current_team_id <> v_event.team_id then
                    update public.possessions
                       set end_second = greatest(v_current_start, v_event.second_in_period),
                           end_reason = 'turnover'
                     where id = v_current_id;

                    insert into public.possessions (
                        analysis_id, team_id, period_id, start_second, start_reason, source
                    ) values (
                        p_analysis_id, v_event.team_id, v_period.id,
                        v_event.second_in_period, 'recovery', 'inferred'
                    ) returning id into v_current_id;
                    v_current_team_id := v_event.team_id;
                    v_current_start := v_event.second_in_period;
                    v_created := v_created + 1;
                end if;

                v_event_possession_id := v_current_id;

                if v_event.shot_result in ('goal', 'point', 'wide') then
                    update public.possessions
                       set end_second = greatest(v_current_start, v_event.second_in_period),
                           end_reason = case
                               when v_event.shot_result = 'goal' then 'goal'
                               when v_event.shot_result = 'point' then 'point'
                               else 'miss'
                           end
                     where id = v_current_id;
                    v_current_id := null;
                    v_current_team_id := null;
                    v_current_start := null;
                end if;

            -- RECOVERY -------------------------------------------------------
            elsif v_event.event_type = 'recovery' then
                v_start_reason := case
                    when v_event.recovery_method = 'interception' then 'interception'
                    else 'recovery'
                end;

                if v_current_id is null then
                    insert into public.possessions (
                        analysis_id, team_id, period_id, start_second, start_reason, source
                    ) values (
                        p_analysis_id, v_event.team_id, v_period.id,
                        v_event.second_in_period, v_start_reason, 'inferred'
                    ) returning id into v_current_id;
                    v_current_team_id := v_event.team_id;
                    v_current_start := v_event.second_in_period;
                    v_created := v_created + 1;
                elsif v_current_team_id <> v_event.team_id then
                    update public.possessions
                       set end_second = greatest(v_current_start, v_event.second_in_period),
                           end_reason = 'turnover'
                     where id = v_current_id;

                    insert into public.possessions (
                        analysis_id, team_id, period_id, start_second, start_reason, source
                    ) values (
                        p_analysis_id, v_event.team_id, v_period.id,
                        v_event.second_in_period, v_start_reason, 'inferred'
                    ) returning id into v_current_id;
                    v_current_team_id := v_event.team_id;
                    v_current_start := v_event.second_in_period;
                    v_created := v_created + 1;
                end if;

                v_event_possession_id := v_current_id;

            -- TURNOVER -------------------------------------------------------
            elsif v_event.event_type = 'turnover' then
                if v_current_id is not null and v_current_team_id = v_event.team_id then
                    v_event_possession_id := v_current_id;
                    update public.possessions
                       set end_second = greatest(v_current_start, v_event.second_in_period),
                           end_reason = 'turnover'
                     where id = v_current_id;
                    v_current_id := null;
                    v_current_team_id := null;
                    v_current_start := null;
                end if;

                if v_current_id is null then
                    insert into public.possessions (
                        analysis_id, team_id, period_id, start_second, start_reason, source
                    ) values (
                        p_analysis_id, v_opponent_team_id, v_period.id,
                        v_event.second_in_period, 'turnover', 'inferred'
                    ) returning id into v_current_id;
                    v_current_team_id := v_opponent_team_id;
                    v_current_start := v_event.second_in_period;
                    v_created := v_created + 1;
                end if;

            -- KICKOUT --------------------------------------------------------
            elsif v_event.event_type = 'kickout' then
                if v_current_id is not null then
                    update public.possessions
                       set end_second = greatest(v_current_start, v_event.second_in_period),
                           end_reason = 'other'
                     where id = v_current_id;
                end if;

                insert into public.possessions (
                    analysis_id, team_id, period_id, start_second, start_reason, source
                ) values (
                    p_analysis_id, v_event.team_id, v_period.id,
                    v_event.second_in_period, 'kickout', 'inferred'
                ) returning id into v_current_id;
                v_current_team_id := v_event.team_id;
                v_current_start := v_event.second_in_period;
                v_created := v_created + 1;
                v_event_possession_id := v_current_id;

                if v_event.kickout_result in ('contested_lost', 'directly_lost') then
                    update public.possessions
                       set end_second = v_event.second_in_period,
                           end_reason = 'turnover'
                     where id = v_current_id;

                    insert into public.possessions (
                        analysis_id, team_id, period_id, start_second, start_reason, source
                    ) values (
                        p_analysis_id, v_opponent_team_id, v_period.id,
                        v_event.second_in_period, 'turnover', 'inferred'
                    ) returning id into v_current_id;
                    v_current_team_id := v_opponent_team_id;
                    v_current_start := v_event.second_in_period;
                    v_created := v_created + 1;
                end if;

            -- FOUL -----------------------------------------------------------
            elsif v_event.event_type = 'foul' then
                if v_current_id is not null then
                    v_event_possession_id := v_current_id;
                end if;

                if v_event.foul_outcome in ('free', 'forty_five', 'penalty') then
                    if v_current_id is not null then
                        update public.possessions
                           set end_second = greatest(v_current_start, v_event.second_in_period),
                               end_reason = 'foul'
                         where id = v_current_id;
                    end if;

                    insert into public.possessions (
                        analysis_id, team_id, period_id, start_second, start_reason, source
                    ) values (
                        p_analysis_id, v_opponent_team_id, v_period.id,
                        v_event.second_in_period, 'free', 'inferred'
                    ) returning id into v_current_id;
                    v_current_team_id := v_opponent_team_id;
                    v_current_start := v_event.second_in_period;
                    v_created := v_created + 1;
                end if;

            -- RESTART --------------------------------------------------------
            elsif v_event.event_type = 'restart' then
                v_start_reason := case v_event.restart_type
                    when 'free' then 'free'
                    when 'sideline' then 'sideline'
                    when 'throw_in' then 'throw_in'
                    else 'restart'
                end;

                if v_current_id is null then
                    insert into public.possessions (
                        analysis_id, team_id, period_id, start_second, start_reason, source
                    ) values (
                        p_analysis_id, v_event.team_id, v_period.id,
                        v_event.second_in_period, v_start_reason, 'inferred'
                    ) returning id into v_current_id;
                    v_current_team_id := v_event.team_id;
                    v_current_start := v_event.second_in_period;
                    v_created := v_created + 1;
                elsif v_current_team_id <> v_event.team_id then
                    update public.possessions
                       set end_second = greatest(v_current_start, v_event.second_in_period),
                           end_reason = 'other'
                     where id = v_current_id;

                    insert into public.possessions (
                        analysis_id, team_id, period_id, start_second, start_reason, source
                    ) values (
                        p_analysis_id, v_event.team_id, v_period.id,
                        v_event.second_in_period, v_start_reason, 'inferred'
                    ) returning id into v_current_id;
                    v_current_team_id := v_event.team_id;
                    v_current_start := v_event.second_in_period;
                    v_created := v_created + 1;
                end if;

                v_event_possession_id := v_current_id;

            -- DUEL / DRIBBLE -------------------------------------------------
            elsif v_event.event_type in ('duel', 'dribble') then
                if v_current_id is null then
                    insert into public.possessions (
                        analysis_id, team_id, period_id, start_second, start_reason, source
                    ) values (
                        p_analysis_id, v_event.team_id, v_period.id,
                        v_event.second_in_period, 'recovery', 'inferred'
                    ) returning id into v_current_id;
                    v_current_team_id := v_event.team_id;
                    v_current_start := v_event.second_in_period;
                    v_created := v_created + 1;
                elsif v_current_team_id <> v_event.team_id then
                    update public.possessions
                       set end_second = greatest(v_current_start, v_event.second_in_period),
                           end_reason = 'turnover'
                     where id = v_current_id;

                    insert into public.possessions (
                        analysis_id, team_id, period_id, start_second, start_reason, source
                    ) values (
                        p_analysis_id, v_event.team_id, v_period.id,
                        v_event.second_in_period, 'recovery', 'inferred'
                    ) returning id into v_current_id;
                    v_current_team_id := v_event.team_id;
                    v_current_start := v_event.second_in_period;
                    v_created := v_created + 1;
                end if;

                v_event_possession_id := v_current_id;

            -- BLOCK / CARD / CHANGES ----------------------------------------
            else
                v_event_possession_id := v_current_id;
            end if;

            if v_event_possession_id is not null then
                update public.events
                   set possession_id = v_event_possession_id
                 where id = v_event.id;
            end if;
        end loop;

        if v_current_id is not null then
            update public.possessions
               set end_second = greatest(
                       v_current_start,
                       v_last_second,
                       v_period.expected_duration_seconds
                   ),
                   end_reason = 'period_end'
             where id = v_current_id;
        end if;
    end loop;

    return v_created;
end;
$$;

revoke all on function public.rebuild_inferred_possessions(uuid) from public, anon;
grant execute on function public.rebuild_inferred_possessions(uuid) to authenticated;

comment on function public.rebuild_inferred_possessions(uuid) is
'Rebuilds inferred possessions from canonical events. Refuses to run if any manual possession exists, so user corrections are never overwritten.';
