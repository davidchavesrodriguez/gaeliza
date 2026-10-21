import { supabase } from '../lib/supabase'
import type {
  CompetitionSummary,
  MatchOption,
  TeamSummary,
} from '../domain/matches'

type RawTeam = {
  id: string
  name: string
  short_name: string | null
  logo_path: string | null
}

type RawCompetition = {
  id: string
  name: string
  short_name: string | null
}

type RawCompetitionEdition = {
  competition: RawCompetition | null
}

type RawMatch = {
  id: string
  scheduled_at: string | null
  status: MatchOption['status']
  scope: MatchOption['scope']
  round_number: number | null
  round_label: string | null
  home_team: RawTeam | null
  away_team: RawTeam | null
  competition_edition: RawCompetitionEdition | null
}

function mapTeam(team: RawTeam): TeamSummary {
  return {
    id: team.id,
    name: team.name,
    shortName: team.short_name,
    logoPath: team.logo_path,
  }
}

function mapCompetition(
  competition: RawCompetition | null,
): CompetitionSummary | null {
  if (!competition) {
    return null
  }

  return {
    id: competition.id,
    name: competition.name,
    shortName: competition.short_name,
  }
}

function mapMatch(match: RawMatch): MatchOption | null {
  if (!match.home_team || !match.away_team) {
    return null
  }

  return {
    id: match.id,
    scheduledAt: match.scheduled_at,
    status: match.status,
    scope: match.scope,
    roundNumber: match.round_number,
    roundLabel: match.round_label,
    homeTeam: mapTeam(match.home_team),
    awayTeam: mapTeam(match.away_team),
    competition: mapCompetition(match.competition_edition?.competition ?? null),
  }
}

export async function listAnalyzableMatches(
  signal?: AbortSignal,
): Promise<MatchOption[]> {
  let query = supabase
    .from('matches')
    .select(`
      id,
      scheduled_at,
      status,
      scope,
      round_number,
      round_label,
      home_team:teams!matches_home_team_id_fkey (
        id,
        name,
        short_name,
        logo_path
      ),
      away_team:teams!matches_away_team_id_fkey (
        id,
        name,
        short_name,
        logo_path
      ),
      competition_edition:competition_editions!matches_competition_edition_id_fkey (
        competition:competitions!competition_editions_competition_id_fkey (
          id,
          name,
          short_name
        )
      )
    `)
    .neq('status', 'cancelled')
    .order('scheduled_at', { ascending: false, nullsFirst: false })
    .limit(50)

  if (signal) {
    query = query.abortSignal(signal)
  }

  const { data, error } = await query

  if (error) {
    throw new Error(`Could not load matches: ${error.message}`)
  }

  return (data as unknown as RawMatch[])
    .map(mapMatch)
    .filter((match): match is MatchOption => match !== null)
}
