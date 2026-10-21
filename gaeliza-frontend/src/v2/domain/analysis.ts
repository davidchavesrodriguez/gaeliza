import type { AnalysisMode, TeamSummary } from './matches'

export type AnalysisStatus = 'draft' | 'in_progress' | 'completed'
export type AttackingDirection = 'left' | 'right' | null

export type AnalysisPeriod = {
  id: string
  number: number
  name: string | null
  expectedDurationSeconds: number
  homeAttacksTowards: AttackingDirection
}

export type AnalysisParticipant = {
  id: string
  teamId: string
  playerId: string | null
  displayName: string
  number: number | null
  starter: boolean | null
  initialGoalkeeper: boolean | null
  position: string | null
}

export type RosterPlayer = {
  playerId: string
  teamId: string
  firstName: string
  lastName: string | null
  defaultNumber: number | null
  primaryPosition: string | null
}

export type AnalysisVideo = {
  id: string
  url: string
  provider: string | null
  title: string | null
  durationSeconds: number | null
  sortOrder: number
}

export type VideoSyncPoint = {
  id: string
  videoId: string
  periodId: string
  videoSecond: number
  secondInPeriod: number
}

export type AnalysisWorkspace = {
  id: string
  title: string | null
  mode: AnalysisMode
  status: AnalysisStatus
  matchId: string
  scheduledAt: string | null
  homeTeam: TeamSummary
  awayTeam: TeamSummary
  periods: AnalysisPeriod[]
  participants: AnalysisParticipant[]
  rosterPlayers: RosterPlayer[]
  videos: AnalysisVideo[]
  syncPoints: VideoSyncPoint[]
}

export function getPlayerDisplayName(player: RosterPlayer) {
  return [player.firstName, player.lastName].filter(Boolean).join(' ')
}

export function formatAnalysisClock(totalSeconds: number) {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) {
    return '—'
  }

  const roundedMilliseconds = Math.round(totalSeconds * 1000)
  const hours = Math.floor(roundedMilliseconds / 3_600_000)
  const minutes = Math.floor((roundedMilliseconds % 3_600_000) / 60_000)
  const seconds = (roundedMilliseconds % 60_000) / 1000
  const secondsText = Number.isInteger(seconds)
    ? String(seconds).padStart(2, '0')
    : seconds.toFixed(3).replace(/0+$/, '').padStart(2, '0')

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${secondsText}`
  }

  return `${minutes}:${secondsText}`
}

export function parseAnalysisClock(
  value: string,
  options: { integer?: boolean } = {},
): number | null {
  const trimmed = value.trim()

  if (!trimmed) {
    return null
  }

  const parts = trimmed.split(':')

  if (parts.length > 3 || parts.some((part) => part.trim() === '')) {
    return null
  }

  const parsed = parts.map(Number)

  if (parsed.some((part) => !Number.isFinite(part) || part < 0)) {
    return null
  }

  if (parts.length > 1 && parsed.slice(1).some((part) => part >= 60)) {
    return null
  }

  let totalSeconds: number

  if (parts.length === 3) {
    totalSeconds = parsed[0] * 3600 + parsed[1] * 60 + parsed[2]
  } else if (parts.length === 2) {
    totalSeconds = parsed[0] * 60 + parsed[1]
  } else {
    totalSeconds = parsed[0]
  }

  if (options.integer && !Number.isInteger(totalSeconds)) {
    return null
  }

  return totalSeconds
}

export function isSafeHttpUrl(value: string) {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}
