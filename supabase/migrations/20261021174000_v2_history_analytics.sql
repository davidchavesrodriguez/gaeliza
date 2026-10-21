-- Gaeliza v2 - historical analytics across completed primary analyses.
--
-- A user may create multiple analyses for the same match. Exactly zero or one
-- analysis per owner/match may be marked as the historical reference. New
-- analyses default to primary only when no reference exists yet.

-- ---------------------------------------------------------------------------
-- Historical reference analysis
-- ---------------------------------------------------------------------------

alter table public.analyses
    add column is_primary_for_history boolean not null default false;

with ranked as (
    select
        a.id,
        row_number() over (
            partition by a.owner_user_id, a.match_id
            order by
                case a.status
                    when 'completed' then 0
                    when 'in_progress' then 1
                    else 2
                end,
                a.completed_at desc nulls last,
                a.updated_at desc,
                a.created_at desc,
                a.id desc
        ) as rn
    from public.analyses a
)
update public.analyses a
set is_primary_for_history = (r.rn = 1)
from ranked r
where r.id = a.id;

create unique index analyses_one_primary_history_per_owner_match_uidx
    on public.analyses (owner_user_id, match_id)
    where is_primary_for_history is true;

comment on column public.analyses.is_primary_for_history is
'When true, this analysis is the owner''s reference analysis for historical/season aggregation of the match. At most one per owner and match.';

create or replace function public.create_analysis(
    p_match_id uuid,
    p_title text default null,
    p_mode text default 'post_match'
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
    v_analysis_id uuid;
    v_user_id uuid := (select auth.uid());
    v_make_primary boolean;
begin
    if v_user_id is null then
        raise exception 'authentication required' using errcode = '42501';
    end if;

    -- Serialize creation for one owner/match so concurrent requests cannot both
    -- decide that they are the first historical reference.
    perform pg_advisory_xact_lock(
        hashtextextended(v_user_id::text || ':' || p_match_id::text, 0)
    );

    select not exists (
        select 1
        from public.analyses a
        where a.owner_user_id = v_user_id
          and a.match_id = p_match_id
          and a.is_primary_for_history is true
    )
    into v_make_primary;

    insert into public.analyses (
        match_id,
        owner_user_id,
        title,
        mode,
        status,
        visibility,
        is_primary_for_history
    )
    values (
        p_match_id,
        v_user_id,
        p_title,
        p_mode,
        'draft',
        'private',
        v_make_primary
    )
    returning id into v_analysis_id;

    insert into public.analysis_periods (
        analysis_id,
        number,
        expected_duration_seconds,
        sort_order
    )
    values
        (v_analysis_id, 1, 1800, 0),
        (v_analysis_id, 2, 1800, 1);

    return v_analysis_id;
end;
$$;

revoke all on function public.create_analysis(uuid, text, text) from public, anon;
grant execute on function public.create_analysis(uuid, text, text) to authenticated;

create or replace function public.set_primary_analysis(
    p_analysis_id uuid
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
    v_user_id uuid := (select auth.uid());
    v_match_id uuid;
begin
    if v_user_id is null then
        raise exception 'authentication required' using errcode = '42501';
    end if;

    select a.match_id
      into v_match_id
      from public.analyses a
     where a.id = p_analysis_id
       and a.owner_user_id = v_user_id;

    if not found then
        raise exception 'analysis % is not owned by current user', p_analysis_id
            using errcode = '42501';
    end if;

    perform pg_advisory_xact_lock(
        hashtextextended(v_user_id::text || ':' || v_match_id::text, 0)
    );

    update public.analyses
       set is_primary_for_history = false
     where owner_user_id = v_user_id
       and match_id = v_match_id
       and id <> p_analysis_id
       and is_primary_for_history is true;

    update public.analyses
       set is_primary_for_history = true
     where id = p_analysis_id
       and owner_user_id = v_user_id;

    return p_analysis_id;
end;
$$;

revoke all on function public.set_primary_analysis(uuid) from public, anon;
grant execute on function public.set_primary_analysis(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Per-match historical read models
--
-- These views intentionally expose only the current authenticated user's own
-- completed primary analyses. Public analyses owned by other users are not
-- mixed into personal season statistics or scouting.
-- ---------------------------------------------------------------------------

create view public.my_team_match_history
with (security_invoker = true)
as
select
    ts.analysis_id,
    a.match_id,
    a.owner_user_id,
    m.scheduled_at,
    m.status as match_status,
    ts.team_id,
    ts.team_side,
    case
        when ts.team_id = m.home_team_id then m.away_team_id
        else m.home_team_id
    end as opponent_team_id,
    m.competition_edition_id,
    ce.competition_id,
    ce.season_id,
    ts.goals,
    ts.points,
    ts.total_score,
    ots.total_score as opponent_total_score,
    ts.total_score - ots.total_score as score_margin,
    case
        when ts.total_score > ots.total_score then 'win'
        when ts.total_score < ots.total_score then 'loss'
        else 'draw'
    end as result,
    ts.shots,
    ts.scoring_shots,
    ts.shot_conversion_pct,
    ts.wides,
    ts.saved_shots,
    ts.blocked_shots,
    ts.post_shots,
    ts.passes,
    ts.completed_passes,
    ts.intercepted_passes_lost,
    ts.pass_completion_pct,
    ts.interceptions_won,
    ts.explicit_recoveries,
    ts.explicit_turnovers,
    ts.fouls_committed,
    ts.yellow_cards,
    ts.black_cards,
    ts.red_cards,
    ts.kickouts,
    ts.kickouts_retained,
    ts.kickouts_contested_won,
    ts.kickouts_contested_lost,
    ts.kickouts_directly_lost,
    ts.possessions,
    ts.scoring_possessions,
    ts.scoring_possession_pct,
    ts.score_value_per_possession,
    ts.avg_possession_seconds,
    ts.official_goals,
    ts.official_points,
    ts.official_total_score,
    ts.score_matches_official
from public.analysis_team_stats ts
join public.analyses a on a.id = ts.analysis_id
join public.matches m on m.id = a.match_id
left join public.competition_editions ce on ce.id = m.competition_edition_id
join public.analysis_team_stats ots
  on ots.analysis_id = ts.analysis_id
 and ots.team_id <> ts.team_id
where a.owner_user_id = (select auth.uid())
  and a.is_primary_for_history is true
  and a.status = 'completed';

create view public.my_player_match_history
with (security_invoker = true)
as
select
    ps.analysis_id,
    a.match_id,
    a.owner_user_id,
    m.scheduled_at,
    m.status as match_status,
    ps.analysis_participant_id,
    ps.player_id,
    ps.team_id,
    case
        when ps.team_id = m.home_team_id then m.away_team_id
        else m.home_team_id
    end as opponent_team_id,
    m.competition_edition_id,
    ce.competition_id,
    ce.season_id,
    ps.display_name_snapshot,
    ps.number,
    ps.position,
    ps.starter,
    ps.initial_goalkeeper,
    ps.shots,
    ps.goals,
    ps.points,
    ps.total_score,
    ps.assists,
    ps.passes,
    ps.completed_passes,
    ps.pass_completion_pct,
    ps.receptions,
    ps.interceptions,
    ps.explicit_recoveries,
    ps.explicit_turnovers,
    ps.fouls_committed,
    ps.fouls_won,
    ps.yellow_cards,
    ps.black_cards,
    ps.red_cards,
    ps.kickouts,
    ps.kickouts_retained
from public.analysis_player_stats ps
join public.analyses a on a.id = ps.analysis_id
join public.matches m on m.id = a.match_id
left join public.competition_editions ce on ce.id = m.competition_edition_id
where a.owner_user_id = (select auth.uid())
  and a.is_primary_for_history is true
  and a.status = 'completed'
  and ps.player_id is not null;

-- ---------------------------------------------------------------------------
-- Filterable historical summary RPCs
-- ---------------------------------------------------------------------------

create or replace function public.get_team_history_summary(
    p_team_id uuid,
    p_season_id uuid default null,
    p_competition_id uuid default null,
    p_opponent_team_id uuid default null,
    p_date_from date default null,
    p_date_to date default null
)
returns table (
    matches bigint,
    wins bigint,
    draws bigint,
    losses bigint,
    first_match_at timestamptz,
    last_match_at timestamptz,
    total_score bigint,
    total_score_against bigint,
    average_score numeric,
    average_score_against numeric,
    average_margin numeric,
    shots bigint,
    scoring_shots bigint,
    shot_conversion_pct numeric,
    passes bigint,
    completed_passes bigint,
    pass_completion_pct numeric,
    interceptions_won bigint,
    explicit_recoveries bigint,
    explicit_turnovers bigint,
    fouls_committed bigint,
    yellow_cards bigint,
    black_cards bigint,
    red_cards bigint,
    kickouts bigint,
    kickouts_retained_or_won bigint,
    kickout_retention_pct numeric,
    possessions bigint,
    scoring_possessions bigint,
    scoring_possession_pct numeric,
    score_value_per_possession numeric,
    avg_possession_seconds numeric
)
language sql
stable
security invoker
set search_path = ''
as $$
    select
        count(*)::bigint as matches,
        count(*) filter (where h.result = 'win')::bigint as wins,
        count(*) filter (where h.result = 'draw')::bigint as draws,
        count(*) filter (where h.result = 'loss')::bigint as losses,
        min(h.scheduled_at) as first_match_at,
        max(h.scheduled_at) as last_match_at,
        coalesce(sum(h.total_score), 0)::bigint as total_score,
        coalesce(sum(h.opponent_total_score), 0)::bigint as total_score_against,
        round(avg(h.total_score)::numeric, 2) as average_score,
        round(avg(h.opponent_total_score)::numeric, 2) as average_score_against,
        round(avg(h.score_margin)::numeric, 2) as average_margin,
        coalesce(sum(h.shots), 0)::bigint as shots,
        coalesce(sum(h.scoring_shots), 0)::bigint as scoring_shots,
        case when coalesce(sum(h.shots), 0) > 0
            then round(100.0 * sum(h.scoring_shots) / sum(h.shots), 2)
            else null
        end as shot_conversion_pct,
        coalesce(sum(h.passes), 0)::bigint as passes,
        coalesce(sum(h.completed_passes), 0)::bigint as completed_passes,
        case when coalesce(sum(h.passes), 0) > 0
            then round(100.0 * sum(h.completed_passes) / sum(h.passes), 2)
            else null
        end as pass_completion_pct,
        coalesce(sum(h.interceptions_won), 0)::bigint as interceptions_won,
        coalesce(sum(h.explicit_recoveries), 0)::bigint as explicit_recoveries,
        coalesce(sum(h.explicit_turnovers), 0)::bigint as explicit_turnovers,
        coalesce(sum(h.fouls_committed), 0)::bigint as fouls_committed,
        coalesce(sum(h.yellow_cards), 0)::bigint as yellow_cards,
        coalesce(sum(h.black_cards), 0)::bigint as black_cards,
        coalesce(sum(h.red_cards), 0)::bigint as red_cards,
        coalesce(sum(h.kickouts), 0)::bigint as kickouts,
        coalesce(sum(h.kickouts_retained + h.kickouts_contested_won), 0)::bigint as kickouts_retained_or_won,
        case when coalesce(sum(h.kickouts), 0) > 0
            then round(100.0 * sum(h.kickouts_retained + h.kickouts_contested_won) / sum(h.kickouts), 2)
            else null
        end as kickout_retention_pct,
        coalesce(sum(h.possessions), 0)::bigint as possessions,
        coalesce(sum(h.scoring_possessions), 0)::bigint as scoring_possessions,
        case when coalesce(sum(h.possessions), 0) > 0
            then round(100.0 * sum(h.scoring_possessions) / sum(h.possessions), 2)
            else null
        end as scoring_possession_pct,
        case when coalesce(sum(h.possessions), 0) > 0
            then round(sum(h.total_score)::numeric / sum(h.possessions), 3)
            else null
        end as score_value_per_possession,
        case when coalesce(sum(h.possessions), 0) > 0
            then round(
                sum(coalesce(h.avg_possession_seconds, 0) * h.possessions)::numeric
                / sum(h.possessions),
                2
            )
            else null
        end as avg_possession_seconds
    from public.my_team_match_history h
    where h.team_id = p_team_id
      and (p_season_id is null or h.season_id = p_season_id)
      and (p_competition_id is null or h.competition_id = p_competition_id)
      and (p_opponent_team_id is null or h.opponent_team_id = p_opponent_team_id)
      and (p_date_from is null or h.scheduled_at::date >= p_date_from)
      and (p_date_to is null or h.scheduled_at::date <= p_date_to);
$$;

create or replace function public.get_player_history_summary(
    p_player_id uuid,
    p_team_id uuid default null,
    p_season_id uuid default null,
    p_competition_id uuid default null,
    p_opponent_team_id uuid default null,
    p_date_from date default null,
    p_date_to date default null
)
returns table (
    matches bigint,
    starts bigint,
    first_match_at timestamptz,
    last_match_at timestamptz,
    shots bigint,
    goals bigint,
    points bigint,
    total_score bigint,
    shot_conversion_pct numeric,
    assists bigint,
    passes bigint,
    completed_passes bigint,
    pass_completion_pct numeric,
    receptions bigint,
    interceptions bigint,
    explicit_recoveries bigint,
    explicit_turnovers bigint,
    fouls_committed bigint,
    fouls_won bigint,
    yellow_cards bigint,
    black_cards bigint,
    red_cards bigint,
    kickouts bigint,
    kickouts_retained bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
    select
        count(*)::bigint as matches,
        count(*) filter (where h.starter is true)::bigint as starts,
        min(h.scheduled_at) as first_match_at,
        max(h.scheduled_at) as last_match_at,
        coalesce(sum(h.shots), 0)::bigint as shots,
        coalesce(sum(h.goals), 0)::bigint as goals,
        coalesce(sum(h.points), 0)::bigint as points,
        coalesce(sum(h.total_score), 0)::bigint as total_score,
        case when coalesce(sum(h.shots), 0) > 0
            then round(100.0 * sum(h.goals + h.points) / sum(h.shots), 2)
            else null
        end as shot_conversion_pct,
        coalesce(sum(h.assists), 0)::bigint as assists,
        coalesce(sum(h.passes), 0)::bigint as passes,
        coalesce(sum(h.completed_passes), 0)::bigint as completed_passes,
        case when coalesce(sum(h.passes), 0) > 0
            then round(100.0 * sum(h.completed_passes) / sum(h.passes), 2)
            else null
        end as pass_completion_pct,
        coalesce(sum(h.receptions), 0)::bigint as receptions,
        coalesce(sum(h.interceptions), 0)::bigint as interceptions,
        coalesce(sum(h.explicit_recoveries), 0)::bigint as explicit_recoveries,
        coalesce(sum(h.explicit_turnovers), 0)::bigint as explicit_turnovers,
        coalesce(sum(h.fouls_committed), 0)::bigint as fouls_committed,
        coalesce(sum(h.fouls_won), 0)::bigint as fouls_won,
        coalesce(sum(h.yellow_cards), 0)::bigint as yellow_cards,
        coalesce(sum(h.black_cards), 0)::bigint as black_cards,
        coalesce(sum(h.red_cards), 0)::bigint as red_cards,
        coalesce(sum(h.kickouts), 0)::bigint as kickouts,
        coalesce(sum(h.kickouts_retained), 0)::bigint as kickouts_retained
    from public.my_player_match_history h
    where h.player_id = p_player_id
      and (p_team_id is null or h.team_id = p_team_id)
      and (p_season_id is null or h.season_id = p_season_id)
      and (p_competition_id is null or h.competition_id = p_competition_id)
      and (p_opponent_team_id is null or h.opponent_team_id = p_opponent_team_id)
      and (p_date_from is null or h.scheduled_at::date >= p_date_from)
      and (p_date_to is null or h.scheduled_at::date <= p_date_to);
$$;

-- ---------------------------------------------------------------------------
-- Explicit Data API privileges
-- ---------------------------------------------------------------------------

revoke all on table
    public.my_team_match_history,
    public.my_player_match_history
from public, anon, authenticated;

grant select on table
    public.my_team_match_history,
    public.my_player_match_history
to authenticated;

revoke all on function public.get_team_history_summary(uuid, uuid, uuid, uuid, date, date)
from public, anon;
grant execute on function public.get_team_history_summary(uuid, uuid, uuid, uuid, date, date)
to authenticated;

revoke all on function public.get_player_history_summary(uuid, uuid, uuid, uuid, uuid, date, date)
from public, anon;
grant execute on function public.get_player_history_summary(uuid, uuid, uuid, uuid, uuid, date, date)
to authenticated;

comment on view public.my_team_match_history is
'Current user historical team rows from completed primary analyses only; suitable for evolution charts and opponent scouting without double-counting duplicate analyses.';

comment on view public.my_player_match_history is
'Current user historical persistent-player rows from completed primary analyses only. Temporary analysis-only participants are intentionally excluded from cross-match identity aggregation.';
