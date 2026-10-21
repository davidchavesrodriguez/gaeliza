import {
  getPlayerDisplayName,
  type AnalysisParticipant,
  type AnalysisPeriod,
  type AnalysisVideo,
  type AnalysisWorkspace,
  type AttackingDirection,
  type RosterPlayer,
  type VideoSyncPoint,
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

type RawVideo = {
  id: string
  url: string
  provider: string | null
  title: string | null
  duration_seconds: number | string | null
  sort_order: number
}

type RawSyncPoint = {
  id: string
  analysis_video_id: string
  analysis_period_id: string
  video_second: number | string
  second_in_period: number
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

function mapVideo(video: RawVideo): AnalysisVideo {
  return {
    id: video.id,
    url: video.url,
    provider: video.provider,
    title: video.title,
    durationSeconds:
      video.duration_seconds === null ? null : Number(video.duration_seconds),
    sortOrder: video.sort_order,
  }
}

function mapSyncPoint(syncPoint: RawSyncPoint): VideoSyncPoint {
  return {
    id: syncPoint.id,
    videoId: syncPoint.analysis_video_id,
    periodId: syncPoint.analysis_period_id,
    videoSecond: Number(syncPoint.video_second),
    secondInPeriod: syncPoint.second_in_period,
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

  if (signal) {
    analysisQuery = analysisQuery.abortSignal(signal)
  }

  const { data: analysisData, error: analysisError } =
    await analysisQuery.maybeSingle()

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

  let videosQuery = supabase
    .from('analysis_videos')
    .select('id, url, provider, title, duration_seconds, sort_order')
    .eq('analysis_id', analysisId)
    .order('sort_order', { ascending: true })

  let syncPointsQuery = supabase
    .from('video_sync_points')
    .select(
      'id, analysis_video_id, analysis_period_id, video_second, second_in_period',
    )
    .eq('analysis_id', analysisId)
    .order('video_second', { ascending: true })

  if (signal) {
    periodsQuery = periodsQuery.abortSignal(signal)
    participantsQuery = participantsQuery.abortSignal(signal)
    rosterQuery = rosterQuery.abortSignal(signal)
    videosQuery = videosQuery.abortSignal(signal)
    syncPointsQuery = syncPointsQuery.abortSignal(signal)
  }

  const [
    periodsResult,
    participantsResult,
    rosterResult,
    videosResult,
    syncPointsResult,
  ] = await Promise.all([
    periodsQuery,
    participantsQuery,
    rosterQuery,
    videosQuery,
    syncPointsQuery,
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

  if (videosResult.error) {
    throw new Error(`Could not load videos: ${videosResult.error.message}`)
  }

  if (syncPointsResult.error) {
    throw new Error(
      `Could not load video synchronization: ${syncPointsResult.error.message}`,
    )
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
    videos: (videosResult.data as unknown as RawVideo[]).map(mapVideo),
    syncPoints: (syncPointsResult.data as unknown as RawSyncPoint[]).map(
      mapSyncPoint,
    ),
  }
}

function participantMutationError(message: string, code?: string) {
  if (code === '23505') {
    return new Error('Ese xogador xa está na convocatoria deste análise.')
  }

  if (code === '23503') {
    return new Error(
      'Non podes quitar este participante porque xa está referenciado por eventos do análise.',
    )
  }

  return new Error(message)
}

function videoMutationError(message: string, code?: string) {
  if (code === '23505') {
    return new Error('Xa existe un punto de sincronización nese instante do vídeo.')
  }

  if (code === '23514') {
    return new Error(
      'Os datos do vídeo ou da sincronización están fóra dos límites permitidos.',
    )
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
    throw participantMutationError(
      `Could not remove participant: ${error.message}`,
      error.code,
    )
  }
}

export async function addAnalysisVideo(input: {
  analysisId: string
  url: string
  title: string | null
  durationSeconds: number | null
  sortOrder: number
}): Promise<void> {
  const { error } = await supabase.from('analysis_videos').insert({
    analysis_id: input.analysisId,
    url: input.url.trim(),
    title: input.title?.trim() || null,
    duration_seconds: input.durationSeconds,
    sort_order: input.sortOrder,
  })

  if (error) {
    throw videoMutationError(`Could not add video: ${error.message}`, error.code)
  }
}

export async function removeAnalysisVideo(videoId: string): Promise<void> {
  const { error } = await supabase
    .from('analysis_videos')
    .delete()
    .eq('id', videoId)

  if (error) {
    throw videoMutationError(
      `Could not remove video: ${error.message}`,
      error.code,
    )
  }
}

export async function setPeriodAttackingDirection(
  periodId: string,
  direction: AttackingDirection,
): Promise<void> {
  const { error } = await supabase
    .from('analysis_periods')
    .update({ home_attacks_towards: direction })
    .eq('id', periodId)

  if (error) {
    throw videoMutationError(
      `Could not update attacking direction: ${error.message}`,
      error.code,
    )
  }
}

export async function addVideoSyncPoint(input: {
  analysisId: string
  videoId: string
  periodId: string
  videoSecond: number
  secondInPeriod: number
}): Promise<void> {
  const { error } = await supabase.from('video_sync_points').insert({
    analysis_id: input.analysisId,
    analysis_video_id: input.videoId,
    analysis_period_id: input.periodId,
    video_second: input.videoSecond,
    second_in_period: input.secondInPeriod,
  })

  if (error) {
    throw videoMutationError(
      `Could not add synchronization point: ${error.message}`,
      error.code,
    )
  }
}

export async function removeVideoSyncPoint(syncPointId: string): Promise<void> {
  const { error } = await supabase
    .from('video_sync_points')
    .delete()
    .eq('id', syncPointId)

  if (error) {
    throw videoMutationError(
      `Could not remove synchronization point: ${error.message}`,
      error.code,
    )
  }
}
