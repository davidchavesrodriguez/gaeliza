-- Gaeliza v2 - analytics read model and spatial normalization.
--
-- Derived statistics remain views over canonical events/possessions. The raw
-- event coordinates are never rewritten. Normalized coordinates rotate the
-- pitch so that the event team always attacks towards the right.

-- ---------------------------------------------------------------------------
-- Period attacking direction
-- ---------------------------------------------------------------------------

alter table public.analysis_periods
    add column home_attacks_towards text
        check (home_attacks_towards is null or home_attacks_towards in ('left', 'right'));

comment on column public.analysis_periods.home_attacks_towards is
'Raw pitch direction for the match home team in this period. Away direction is derived as the opposite. Null means unknown and normalized coordinates remain null.';

-- ---------------------------------------------------------------------------
-- Event facts
-- ---------------------------------------------------------------------------

create view public.analysis_event_facts
with (security_invoker = true)
as
with base as (
    select
        e.id as event_id,
        e.analysis_id,
        a.match_id,
        e.period_id,
        ap.number as period_number,
        ap.sort_order as period_sort_order,
        e.second_in_period,
        e.sort_order,
        e.team_id,
        case
            when e.team_id = m.home_team_id then 'home'
            when e.team_id = m.away_team_id then 'away'
            else null
        end as team_side,
        case
            when e.team_id = m.home_team_id then ap.home_attacks_towards
            when e.team_id = m.away_team_id and ap.home_attacks_towards = 'left' then 'right'
            when e.team_id = m.away_team_id and ap.home_attacks_towards = 'right' then 'left'
            else null
        end as attacking_direction,
        e.event_type,
        e.possession_id,
        e.x as raw_x,
        e.y as raw_y,
        e.notes,
        e.created_by,
        e.created_at,
        e.updated_at,
        se.result as shot_result,
        se.technique as shot_technique,
        se.situation as shot_situation,
        pe.result as pass_result,
        pe.technique as pass_technique,
        pe.end_x as pass_raw_end_x,
        pe.end_y as pass_raw_end_y,
        re.method as recovery_method,
        te.cause as turnover_cause,
        de.duel_type,
        dre.result as dribble_result,
        fe.cause as foul_cause,
        fe.outcome as foul_outcome,
        ce.card_type,
        ce.related_foul_event_id,
        ke.length as kickout_length,
        ke.result as kickout_result,
        ke.end_x as kickout_raw_end_x,
        ke.end_y as kickout_raw_end_y,
        rse.restart_type
    from public.events e
    join public.analyses a on a.id = e.analysis_id
    join public.matches m on m.id = a.match_id
    join public.analysis_periods ap on ap.id = e.period_id
    left join public.shot_events se on se.event_id = e.id
    left join public.pass_events pe on pe.event_id = e.id
    left join public.recovery_events re on re.event_id = e.id
    left join public.turnover_events te on te.event_id = e.id
    left join public.duel_events de on de.event_id = e.id
    left join public.dribble_events dre on dre.event_id = e.id
    left join public.foul_events fe on fe.event_id = e.id
    left join public.card_events ce on ce.event_id = e.id
    left join public.kickout_events ke on ke.event_id = e.id
    left join public.restart_events rse on rse.event_id = e.id
)
select
    base.*,
    case
        when attacking_direction = 'right' then raw_x
        when attacking_direction = 'left' and raw_x is not null then 100 - raw_x
        else null
    end as normalized_x,
    case
        when attacking_direction = 'right' then raw_y
        when attacking_direction = 'left' and raw_y is not null then 100 - raw_y
        else null
    end as normalized_y,
    case
        when attacking_direction = 'right' then pass_raw_end_x
        when attacking_direction = 'left' and pass_raw_end_x is not null then 100 - pass_raw_end_x
        else null
    end as pass_normalized_end_x,
    case
        when attacking_direction = 'right' then pass_raw_end_y
        when attacking_direction = 'left' and pass_raw_end_y is not null then 100 - pass_raw_end_y
        else null
    end as pass_normalized_end_y,
    case
        when attacking_direction = 'right' then kickout_raw_end_x
        when attacking_direction = 'left' and kickout_raw_end_x is not null then 100 - kickout_raw_end_x
        else null
    end as kickout_normalized_end_x,
    case
        when attacking_direction = 'right' then kickout_raw_end_y
        when attacking_direction = 'left' and kickout_raw_end_y is not null then 100 - kickout_raw_end_y
        else null
    end as kickout_normalized_end_y,
    case shot_result
        when 'goal' then 3
        when 'point' then 1
        else 0
    end as score_value
from base;

comment on view public.analysis_event_facts is
'RLS-aware canonical event read model. Coordinates normalized to a rightward attack are derived only when period direction is known.';

-- ---------------------------------------------------------------------------
-- Possession facts
-- ---------------------------------------------------------------------------

create view public.analysis_possession_facts
with (security_invoker = true)
as
select
    p.id as possession_id,
    p.analysis_id,
    a.match_id,
    p.team_id,
    p.period_id,
    ap.number as period_number,
    p.start_second,
    p.end_second,
    case
        when p.end_second is null then null
        else p.end_second - p.start_second
    end as duration_seconds,
    p.start_reason,
    p.end_reason,
    p.source,
    coalesce(ev.event_count, 0) as event_count,
    coalesce(ev.shots, 0) as shots,
    coalesce(ev.goals, 0) as goals,
    coalesce(ev.points, 0) as points,
    coalesce(ev.score_value, 0) as score_value,
    coalesce(ev.passes, 0) as passes,
    coalesce(ev.turnover_events, 0) as explicit_turnover_events,
    p.created_at,
    p.updated_at
from public.possessions p
join public.analyses a on a.id = p.analysis_id
join public.analysis_periods ap on ap.id = p.period_id
left join lateral (
    select
        count(*)::integer as event_count,
        count(*) filter (where e.event_type = 'shot')::integer as shots,
        count(*) filter (where se.result = 'goal')::integer as goals,
        count(*) filter (where se.result = 'point')::integer as points,
        coalesce(sum(case se.result when 'goal' then 3 when 'point' then 1 else 0 end), 0)::integer as score_value,
        count(*) filter (where e.event_type = 'pass')::integer as passes,
        count(*) filter (where e.event_type = 'turnover')::integer as turnover_events
    from public.events e
    left join public.shot_events se on se.event_id = e.id
    where e.possession_id = p.id
) ev on true;

comment on view public.analysis_possession_facts is
'RLS-aware possession read model with deterministic duration and outcome aggregates.';

-- ---------------------------------------------------------------------------
-- Team summary
-- ---------------------------------------------------------------------------

create view public.analysis_team_stats
with (security_invoker = true)
as
with analysis_teams as (
    select
        a.id as analysis_id,
        a.match_id,
        m.home_team_id as team_id,
        'home'::text as team_side,
        m.official_home_goals as official_goals,
        m.official_home_points as official_points
    from public.analyses a
    join public.matches m on m.id = a.match_id

    union all

    select
        a.id,
        a.match_id,
        m.away_team_id,
        'away'::text,
        m.official_away_goals,
        m.official_away_points
    from public.analyses a
    join public.matches m on m.id = a.match_id
),
event_stats as (
    select
        e.analysis_id,
        e.team_id,
        count(*) filter (where e.event_type = 'shot')::integer as shots,
        count(*) filter (where se.result = 'goal')::integer as goals,
        count(*) filter (where se.result = 'point')::integer as points,
        count(*) filter (where se.result in ('goal', 'point'))::integer as scoring_shots,
        count(*) filter (where se.result = 'wide')::integer as wides,
        count(*) filter (where se.result = 'saved')::integer as saved_shots,
        count(*) filter (where se.result = 'blocked')::integer as blocked_shots,
        count(*) filter (where se.result = 'post')::integer as post_shots,
        count(*) filter (where e.event_type = 'pass')::integer as passes,
        count(*) filter (where pe.result = 'completed')::integer as completed_passes,
        count(*) filter (where pe.result = 'incomplete')::integer as incomplete_passes,
        count(*) filter (where pe.result = 'intercepted')::integer as intercepted_passes_lost,
        count(*) filter (where e.event_type = 'recovery')::integer as explicit_recoveries,
        count(*) filter (where e.event_type = 'turnover')::integer as explicit_turnovers,
        count(*) filter (where e.event_type = 'foul')::integer as fouls_committed,
        count(*) filter (where ce.card_type = 'yellow')::integer as yellow_cards,
        count(*) filter (where ce.card_type = 'black')::integer as black_cards,
        count(*) filter (where ce.card_type = 'red')::integer as red_cards,
        count(*) filter (where e.event_type = 'kickout')::integer as kickouts,
        count(*) filter (where ke.result = 'retained')::integer as kickouts_retained,
        count(*) filter (where ke.result = 'contested_won')::integer as kickouts_contested_won,
        count(*) filter (where ke.result = 'contested_lost')::integer as kickouts_contested_lost,
        count(*) filter (where ke.result = 'directly_lost')::integer as kickouts_directly_lost
    from public.events e
    left join public.shot_events se on se.event_id = e.id
    left join public.pass_events pe on pe.event_id = e.id
    left join public.card_events ce on ce.event_id = e.id
    left join public.kickout_events ke on ke.event_id = e.id
    group by e.analysis_id, e.team_id
),
interception_stats as (
    select
        ep.analysis_id,
        ap.team_id,
        count(*)::integer as interceptions_won
    from public.event_participants ep
    join public.events e on e.id = ep.event_id
    join public.analysis_participants ap on ap.id = ep.analysis_participant_id
    where ep.role = 'interceptor'
      and e.event_type = 'pass'
    group by ep.analysis_id, ap.team_id
),
possession_stats as (
    select
        pf.analysis_id,
        pf.team_id,
        count(*)::integer as possessions,
        count(*) filter (where pf.score_value > 0)::integer as scoring_possessions,
        coalesce(sum(pf.score_value), 0)::integer as possession_score_value,
        avg(pf.duration_seconds) filter (where pf.duration_seconds is not null) as avg_possession_seconds
    from public.analysis_possession_facts pf
    group by pf.analysis_id, pf.team_id
)
select
    at.analysis_id,
    at.match_id,
    at.team_id,
    at.team_side,
    coalesce(es.goals, 0) as goals,
    coalesce(es.points, 0) as points,
    coalesce(es.goals, 0) * 3 + coalesce(es.points, 0) as total_score,
    at.official_goals,
    at.official_points,
    case
        when at.official_goals is null or at.official_points is null then null
        else at.official_goals * 3 + at.official_points
    end as official_total_score,
    case
        when at.official_goals is null or at.official_points is null then null
        else coalesce(es.goals, 0) = at.official_goals
         and coalesce(es.points, 0) = at.official_points
    end as score_matches_official,
    coalesce(es.shots, 0) as shots,
    coalesce(es.scoring_shots, 0) as scoring_shots,
    coalesce(es.wides, 0) as wides,
    coalesce(es.saved_shots, 0) as saved_shots,
    coalesce(es.blocked_shots, 0) as blocked_shots,
    coalesce(es.post_shots, 0) as post_shots,
    case
        when coalesce(es.shots, 0) = 0 then null
        else round(100.0 * es.scoring_shots / es.shots, 2)
    end as shot_conversion_pct,
    coalesce(es.passes, 0) as passes,
    coalesce(es.completed_passes, 0) as completed_passes,
    coalesce(es.incomplete_passes, 0) as incomplete_passes,
    coalesce(es.intercepted_passes_lost, 0) as intercepted_passes_lost,
    case
        when coalesce(es.passes, 0) = 0 then null
        else round(100.0 * es.completed_passes / es.passes, 2)
    end as pass_completion_pct,
    coalesce(isx.interceptions_won, 0) as interceptions_won,
    coalesce(es.explicit_recoveries, 0) as explicit_recoveries,
    coalesce(es.explicit_turnovers, 0) as explicit_turnovers,
    coalesce(es.fouls_committed, 0) as fouls_committed,
    coalesce(es.yellow_cards, 0) as yellow_cards,
    coalesce(es.black_cards, 0) as black_cards,
    coalesce(es.red_cards, 0) as red_cards,
    coalesce(es.kickouts, 0) as kickouts,
    coalesce(es.kickouts_retained, 0) as kickouts_retained,
    coalesce(es.kickouts_contested_won, 0) as kickouts_contested_won,
    coalesce(es.kickouts_contested_lost, 0) as kickouts_contested_lost,
    coalesce(es.kickouts_directly_lost, 0) as kickouts_directly_lost,
    coalesce(ps.possessions, 0) as possessions,
    coalesce(ps.scoring_possessions, 0) as scoring_possessions,
    case
        when coalesce(ps.possessions, 0) = 0 then null
        else round(100.0 * ps.scoring_possessions / ps.possessions, 2)
    end as scoring_possession_pct,
    case
        when coalesce(ps.possessions, 0) = 0 then null
        else round(ps.possession_score_value::numeric / ps.possessions, 3)
    end as score_value_per_possession,
    round(ps.avg_possession_seconds::numeric, 2) as avg_possession_seconds
from analysis_teams at
left join event_stats es
    on es.analysis_id = at.analysis_id
   and es.team_id = at.team_id
left join interception_stats isx
    on isx.analysis_id = at.analysis_id
   and isx.team_id = at.team_id
left join possession_stats ps
    on ps.analysis_id = at.analysis_id
   and ps.team_id = at.team_id;

comment on view public.analysis_team_stats is
'RLS-aware per-team analysis summary. Explicit and derived metrics remain distinguishable to avoid canonical-event double counting.';

-- ---------------------------------------------------------------------------
-- Player / analysis-participant summary
-- ---------------------------------------------------------------------------

create view public.analysis_player_stats
with (security_invoker = true)
as
with role_stats as (
    select
        ep.analysis_id,
        ep.analysis_participant_id,
        count(*) filter (where ep.role = 'shooter')::integer as shots,
        count(*) filter (where ep.role = 'shooter' and se.result = 'goal')::integer as goals,
        count(*) filter (where ep.role = 'shooter' and se.result = 'point')::integer as points,
        count(*) filter (where ep.role = 'assister')::integer as assists,
        count(*) filter (where ep.role = 'passer')::integer as passes,
        count(*) filter (where ep.role = 'passer' and pe.result = 'completed')::integer as completed_passes,
        count(*) filter (where ep.role = 'receiver')::integer as receptions,
        count(*) filter (where ep.role = 'interceptor')::integer as interceptions,
        count(*) filter (where ep.role = 'recoverer')::integer as explicit_recoveries,
        count(*) filter (where ep.role = 'turnover_player')::integer as explicit_turnovers,
        count(*) filter (where ep.role = 'offender')::integer as fouls_committed,
        count(*) filter (where ep.role = 'fouled')::integer as fouls_won,
        count(*) filter (where ep.role = 'card_recipient' and ce.card_type = 'yellow')::integer as yellow_cards,
        count(*) filter (where ep.role = 'card_recipient' and ce.card_type = 'black')::integer as black_cards,
        count(*) filter (where ep.role = 'card_recipient' and ce.card_type = 'red')::integer as red_cards,
        count(*) filter (where ep.role = 'kicker' and e.event_type = 'kickout')::integer as kickouts,
        count(*) filter (where ep.role = 'kicker' and ke.result = 'retained')::integer as kickouts_retained
    from public.event_participants ep
    join public.events e on e.id = ep.event_id
    left join public.shot_events se on se.event_id = e.id
    left join public.pass_events pe on pe.event_id = e.id
    left join public.card_events ce on ce.event_id = e.id
    left join public.kickout_events ke on ke.event_id = e.id
    group by ep.analysis_id, ep.analysis_participant_id
)
select
    ap.analysis_id,
    a.match_id,
    ap.id as analysis_participant_id,
    ap.player_id,
    ap.team_id,
    ap.display_name_snapshot,
    ap.number,
    ap.starter,
    ap.initial_goalkeeper,
    ap.position,
    coalesce(rs.shots, 0) as shots,
    coalesce(rs.goals, 0) as goals,
    coalesce(rs.points, 0) as points,
    coalesce(rs.goals, 0) * 3 + coalesce(rs.points, 0) as total_score,
    coalesce(rs.assists, 0) as assists,
    coalesce(rs.passes, 0) as passes,
    coalesce(rs.completed_passes, 0) as completed_passes,
    case
        when coalesce(rs.passes, 0) = 0 then null
        else round(100.0 * rs.completed_passes / rs.passes, 2)
    end as pass_completion_pct,
    coalesce(rs.receptions, 0) as receptions,
    coalesce(rs.interceptions, 0) as interceptions,
    coalesce(rs.explicit_recoveries, 0) as explicit_recoveries,
    coalesce(rs.explicit_turnovers, 0) as explicit_turnovers,
    coalesce(rs.fouls_committed, 0) as fouls_committed,
    coalesce(rs.fouls_won, 0) as fouls_won,
    coalesce(rs.yellow_cards, 0) as yellow_cards,
    coalesce(rs.black_cards, 0) as black_cards,
    coalesce(rs.red_cards, 0) as red_cards,
    coalesce(rs.kickouts, 0) as kickouts,
    coalesce(rs.kickouts_retained, 0) as kickouts_retained
from public.analysis_participants ap
join public.analyses a on a.id = ap.analysis_id
left join role_stats rs
    on rs.analysis_id = ap.analysis_id
   and rs.analysis_participant_id = ap.id;

comment on view public.analysis_player_stats is
'RLS-aware participant summary using historical analysis snapshots. Persistent player identity remains optional.';

-- Explicit grants for Data API exposure. Views remain protected by the RLS
-- policies of their underlying tables because they are security_invoker views.
revoke all on public.analysis_event_facts from public, anon, authenticated;
revoke all on public.analysis_possession_facts from public, anon, authenticated;
revoke all on public.analysis_team_stats from public, anon, authenticated;
revoke all on public.analysis_player_stats from public, anon, authenticated;

grant select on public.analysis_event_facts to anon, authenticated;
grant select on public.analysis_possession_facts to anon, authenticated;
grant select on public.analysis_team_stats to anon, authenticated;
grant select on public.analysis_player_stats to anon, authenticated;
