import {
  getPlayerDisplayName,
  type AnalysisParticipant,
  type AnalysisPeriod,
  type AnalysisWorkspace,
  type RosterPlayer,
} from '../domain/analysis'
import type { TeamSummary } from '../domain/matches'
import { supabase } from '../lib/supabase'

type RawTeam = {
  id: string
  name: string
  short_name: string | null
  logo_path: string | null
}

type RawMatch = {
  id: string
  scheduled_at: string | null
  home_team: RawTeam | null
  away_team: RawTeam | null
}

type RawAnalysis = {
  id: string
  title: string | null
  mode: AnalysisWorkspace['mode']
  status: AnalysisWorkspace['status']
  match_id: string
  match: RawMatch | null
}

type RawPeriod = {
  id: string
  number: number
  name: string | null
  expected_duration_seconds: number
  home_attacks_towards: AnalysisPeriod['homeAttacksTowards']
}

type RawParticipant = {
  id: string
  team_id: string
  player_id: string | null
  display_name_snapshot: string
  number: number | null
  starter: boolean | null
  initial_goalkeeper: boolean | null
  position: string | null
}

type RawRosterPlayer = {
  team_id: string
  default_number: number | null
  player: {
    id: string
    first_name: string
    last_name: string | null
    primary_position: string | null
  } | null
}

function mapTeam(team: RawTeam): TeamSummary {
  return {
    id: team.id,
    name: team.name,
    shortName: team.short_name,
    logoPath: team.logo_path,
  }
}

function mapPeriod(period: RawPeriod): AnalysisPeriod {
  return {
    id: period.id,
    number: period.number,
    name: period.name,
    expectedDurationSeconds: period.expected_duration_seconds,
    homeAttacksTowards: period.home_attacks_towards,
  }
}

function mapParticipant(participant: RawParticipant): AnalysisParticipant {
  return {
    id: participant.id,
    teamId: participant.team_id,
    playerId: participant.player_id,
    displayName: participant.display_name_snapshot,
    number: participant.number,
    starter: participant.starter,
    initialGoalkeeper: participant.initial_goalkeeper,
    position: participant.position,
  }
}

function mapRosterPlayer(membership: RawRosterPlayer): RosterPlayer | null {
  if (!membership.player) {
    return null
  }

  return {
    playerId: membership.player.id,
    teamId: membership.team_id,
    firstName: membership.player.first_name,
    lastName: membership.player.last_name,
    defaultNumber: membership.default_number,
    primaryPosition: membership.player.primary_position,
  }
}

export async function getAnalysisWorkspace(
  analysisId: string,
  signal?: AbortSignal,
): Promise<AnalysisWorkspace> {
  let analysisQuery = supabase
    .from('analyses')
    .select(`
      id,
      title,
      mode,
      status,
      match_id,
      match:matches!analyses_match_id_fkey (
        id,
        scheduled_at,
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
        )
      )
    `)
    .eq('id', analysisId)
    .maybeSingle()

  if (signal) {
    analysisQuery = analysisQuery.abortSignal(signal)
  }

  const { data: analysisData, error: analysisError } = await analysisQuery

  if (analysisError) {
    throw new Error(`Could not load analysis: ${analysisError.message}`)
  }

  const analysis = analysisData as unknown as RawAnalysis | null

  if (!analysis?.match?.home_team || !analysis.match.away_team) {
    throw new Error('Analysis not found or its match is not accessible.')
  }

  let periodsQuery = supabase
    .from('analysis_periods')
    .select(
      'id, number, name, expected_duration_seconds, home_attacks_towards',
    )
    .eq('analysis_id', analysisId)
    .order('sort_order', { ascending: true })

  let participantsQuery = supabase
    .from('analysis_participants')
    .select(
      'id, team_id, player_id, display_name_snapshot, number, starter, initial_goalkeeper, position',
    )
    .eq('analysis_id', analysisId)
    .order('number', { ascending: true, nullsFirst: false })

  let rosterQuery = supabase
    .from('team_players')
    .select(`
      team_id,
      default_number,
      player:players!team_players_player_id_fkey (
        id,
        first_name,
        last_name,
        primary_position
      )
    `)
    .in('team_id', [analysis.match.home_team.id, analysis.match.away_team.id])
    .eq('active', true)

  if (signal) {
    periodsQuery = periodsQuery.abortSignal(signal)
    participantsQuery = participantsQuery.abortSignal(signal)
    rosterQuery = rosterQuery.abortSignal(signal)
  }

  const [periodsResult, participantsResult, rosterResult] = await Promise.all([
    periodsQuery,
    participantsQuery,
    rosterQuery,
  ])

  if (periodsResult.error) {
    throw new Error(`Could not load periods: ${periodsResult.error.message}`)
  }

  if (participantsResult.error) {
    throw new Error(
      `Could not load participants: ${participantsResult.error.message}`,
    )
  }

  if (rosterResult.error) {
    throw new Error(`Could not load roster: ${rosterResult.error.message}`)
  }

  return {
    id: analysis.id,
    title: analysis.title,
    mode: analysis.mode,
    status: analysis.status,
    matchId: analysis.match_id,
    scheduledAt: analysis.match.scheduled_at,
    homeTeam: mapTeam(analysis.match.home_team),
    awayTeam: mapTeam(analysis.match.away_team),
    periods: (periodsResult.data as unknown as RawPeriod[]).map(mapPeriod),
    participants: (
      participantsResult.data as unknown as RawParticipant[]
    ).map(mapParticipant),
    rosterPlayers: (rosterResult.data as unknown as RawRosterPlayer[])
      .map(mapRosterPlayer)
      .filter((player): player is RosterPlayer => player !== null),
  }
}

function participantMutationError(message: string, code?: string) {
  if (code === '23505') {
    return new Error('Ese xogador xa está na convocatoria deste análise.')
  }

  return new Error(message)
}

export async function addRosterParticipant(
  analysisId: string,
  player: RosterPlayer,
): Promise<void> {
  const { error } = await supabase.from('analysis_participants').insert({
    analysis_id: analysisId,
    team_id: player.teamId,
    player_id: player.playerId,
    display_name_snapshot: getPlayerDisplayName(player),
    number: player.defaultNumber,
    position: player.primaryPosition,
  })

  if (error) {
    throw participantMutationError(
      `Could not add player: ${error.message}`,
      error.code,
    )
  }
}

export async function addTemporaryParticipant(input: {
  analysisId: string
  teamId: string
  displayName: string
  number: number | null
}): Promise<void> {
  const { error } = await supabase.from('analysis_participants').insert({
    analysis_id: input.analysisId,
    team_id: input.teamId,
    player_id: null,
    display_name_snapshot: input.displayName.trim(),
    number: input.number,
  })

  if (error) {
    throw participantMutationError(
      `Could not add temporary player: ${error.message}`,
      error.code,
    )
  }
}

export async function removeAnalysisParticipant(
  participantId: string,
): Promise<void> {
  const { error } = await supabase
    .from('analysis_participants')
    .delete()
    .eq('id', participantId)

  if (error) {
    throw new Error(`Could not remove participant: ${error.message}`)
  }
}
