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
  if (!Number.isSafeInteger(roundedMilliseconds)) {
    return '—'
  }
  const hours = Math.floor(roundedMilliseconds / 3_600_000)
  const minutes = Math.floor((roundedMilliseconds % 3_600_000) / 60_000)
  const seconds = (roundedMilliseconds % 60_000) / 1000
  const [wholeSeconds, fractionalSeconds] = seconds.toFixed(3).split('.')
  const trimmedFraction = fractionalSeconds.replace(/0+$/, '')
  const secondsText = `${wholeSeconds.padStart(2, '0')}${
    trimmedFraction ? `.${trimmedFraction}` : ''
  }`

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

  // Only seconds may contain a decimal fraction. Reject JS number syntax
  // (hex, exponents, signs) and whitespace inside a clock.
  if (!/^\d+(?::\d+){0,2}(?:\.\d+)?$/.test(trimmed)) {
    return null
  }

  const parsed = parts.map(Number)

  if (parsed.some((part) => !Number.isFinite(part) || part < 0)) {
    return null
  }

  if (
    parts.length > 1 &&
    parsed.slice(0, -1).some((part) => !Number.isInteger(part))
  ) {
    return null
  }

  if (parts.length > 1 && parsed[parsed.length - 1] >= 60) {
    return null
  }

  if (parts.length === 3 && parsed[1] >= 60) {
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

  if (
    !Number.isFinite(totalSeconds) ||
    totalSeconds > Number.MAX_SAFE_INTEGER ||
    (options.integer && !Number.isSafeInteger(totalSeconds))
  ) {
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
