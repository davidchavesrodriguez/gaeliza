-- Gaeliza v2 - deterministic, traceable analysis insights.
--
-- Insights expose codes + metrics. Human-readable localized copy belongs in the
-- application layer. Rules use conservative minimum sample sizes.

create view public.analysis_insights
with (security_invoker = true)
as
-- Analytical vs official score disagreement is always worth surfacing when an
-- official result exists.
select
    s.analysis_id,
    s.team_id,
    'score_mismatch'::text as code,
    'warning'::text as level,
    'total_score'::text as metric,
    s.total_score::numeric as metric_value,
    s.official_total_score::numeric as reference_value,
    1::integer as sample_size,
    jsonb_build_object(
        'analytical_goals', s.goals,
        'analytical_points', s.points,
        'official_goals', s.official_goals,
        'official_points', s.official_points
    ) as context
from public.analysis_team_stats s
where s.score_matches_official is false

union all

select
    s.analysis_id,
    s.team_id,
    'shot_conversion_low',
    'warning',
    'shot_conversion_pct',
    s.shot_conversion_pct,
    35::numeric,
    s.shots,
    jsonb_build_object('shots', s.shots, 'scoring_shots', s.scoring_shots)
from public.analysis_team_stats s
where s.shots >= 5
  and s.shot_conversion_pct < 35

union all

select
    s.analysis_id,
    s.team_id,
    'shot_conversion_high',
    'positive',
    'shot_conversion_pct',
    s.shot_conversion_pct,
    60::numeric,
    s.shots,
    jsonb_build_object('shots', s.shots, 'scoring_shots', s.scoring_shots)
from public.analysis_team_stats s
where s.shots >= 5
  and s.shot_conversion_pct >= 60

union all

select
    s.analysis_id,
    s.team_id,
    'pass_completion_low',
    'warning',
    'pass_completion_pct',
    s.pass_completion_pct,
    70::numeric,
    s.passes,
    jsonb_build_object(
        'passes', s.passes,
        'completed_passes', s.completed_passes,
        'intercepted_passes_lost', s.intercepted_passes_lost
    )
from public.analysis_team_stats s
where s.passes >= 10
  and s.pass_completion_pct < 70

union all

select
    s.analysis_id,
    s.team_id,
    'intercepted_pass_rate_high',
    'warning',
    'intercepted_pass_rate_pct',
    round(100.0 * s.intercepted_passes_lost / nullif(s.passes, 0), 2),
    20::numeric,
    s.passes,
    jsonb_build_object(
        'passes', s.passes,
        'intercepted_passes_lost', s.intercepted_passes_lost
    )
from public.analysis_team_stats s
where s.passes >= 10
  and 100.0 * s.intercepted_passes_lost / nullif(s.passes, 0) >= 20

union all

select
    s.analysis_id,
    s.team_id,
    'possession_efficiency_low',
    'warning',
    'score_value_per_possession',
    s.score_value_per_possession,
    0.300::numeric,
    s.possessions,
    jsonb_build_object(
        'possessions', s.possessions,
        'scoring_possessions', s.scoring_possessions
    )
from public.analysis_team_stats s
where s.possessions >= 5
  and s.score_value_per_possession < 0.300

union all

select
    s.analysis_id,
    s.team_id,
    'kickout_retention_low',
    'warning',
    'kickout_retention_pct',
    round(
        100.0 * (s.kickouts_retained + s.kickouts_contested_won)
        / nullif(s.kickouts, 0),
        2
    ),
    50::numeric,
    s.kickouts,
    jsonb_build_object(
        'kickouts', s.kickouts,
        'retained', s.kickouts_retained,
        'contested_won', s.kickouts_contested_won,
        'contested_lost', s.kickouts_contested_lost,
        'directly_lost', s.kickouts_directly_lost
    )
from public.analysis_team_stats s
where s.kickouts >= 5
  and 100.0 * (s.kickouts_retained + s.kickouts_contested_won)
      / nullif(s.kickouts, 0) < 50

union all

select
    s.analysis_id,
    s.team_id,
    'red_card',
    'critical',
    'red_cards',
    s.red_cards::numeric,
    0::numeric,
    s.red_cards,
    jsonb_build_object('red_cards', s.red_cards)
from public.analysis_team_stats s
where s.red_cards > 0;

comment on view public.analysis_insights is
'Deterministic insight facts with conservative sample-size guards. Codes are localized/rendered by the application; context keeps every conclusion traceable.';

revoke all on public.analysis_insights from public, anon, authenticated;
grant select on public.analysis_insights to anon, authenticated;
