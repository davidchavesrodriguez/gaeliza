import type { VideoSyncPoint } from './analysis'

export type QuickEventType =
  | 'shot'
  | 'recovery'
  | 'turnover'
  | 'foul'
  | 'card'
  | 'kickout'
  | 'block'
  | 'pass'
  | 'duel'
  | 'dribble'
  | 'restart'
  | 'substitution'
  | 'goalkeeper_change'

export type EventParticipantInput = {
  participantId: string
  role: string
}

export type AnalysisEventSummary = {
  id: string
  eventType: string
  teamId: string
  periodId: string
  periodNumber: number
  secondInPeriod: number
  rawX: number | null
  rawY: number | null
  scoreValue: number
  shotResult: string | null
  recoveryMethod: string | null
  turnoverCause: string | null
  foulOutcome: string | null
  cardType: string | null
  kickoutLength: string | null
  kickoutResult: string | null
  passResult: string | null
  passTechnique: string | null
  duelType: string | null
  dribbleResult: string | null
  restartType: string | null
  participants: { participantId: string; role: string; displayName: string; number: number | null }[]
}

export type LogQuickEventInput = {
  analysisId: string
  periodId: string
  teamId: string
  eventType: QuickEventType
  secondInPeriod: number
  x: number | null
  y: number | null
  detail: Record<string, string | number | null>
  participants: EventParticipantInput[]
}

export const quickEventLabels: Record<QuickEventType, string> = {
  shot: 'Tiro',
  recovery: 'Recuperación',
  turnover: 'Perda',
  foul: 'Falta',
  card: 'Tarxeta',
  kickout: 'Saque de porta',
  block: 'Bloqueo',
  pass: 'Pase',
  duel: 'Duelo',
  dribble: 'Regate',
  restart: 'Reinicio',
  substitution: 'Substitución',
  goalkeeper_change: 'Cambio de porteiro',
}

export function getEventResultLabel(event: AnalysisEventSummary) {
  switch (event.eventType) {
    case 'pass':
      return [event.passResult, event.passTechnique].filter(Boolean).join(' · ') || 'pase'
    case 'duel': return event.duelType ?? 'duelo'
    case 'dribble': return event.dribbleResult ?? 'regate'
    case 'restart': return event.restartType ?? 'reinicio'
    case 'substitution': return replacementLabel(event, 'player_out', 'player_in')
    case 'goalkeeper_change': return replacementLabel(event, 'goalkeeper_out', 'goalkeeper_in')
    case 'shot':
      return event.shotResult ?? 'tiro'
    case 'recovery':
      return event.recoveryMethod ?? 'recuperación'
    case 'turnover':
      return event.turnoverCause ?? 'perda'
    case 'foul':
      return event.foulOutcome ?? 'falta'
    case 'card':
      return event.cardType ?? 'tarxeta'
    case 'kickout':
      return [event.kickoutLength, event.kickoutResult].filter(Boolean).join(' · ')
    default:
      return event.eventType
  }
}

function replacementLabel(event: AnalysisEventSummary, outRole: string, inRole: string) {
  const label = (role: string) => {
    const participant = event.participants.find((p) => p.role === role)
    if (!participant) return 'Sen identificar'
    return participant.number !== null ? `#${participant.number}` : participant.displayName
  }
  return `${label(outRole)} → ${label(inRole)}`
}

export function eventTypeLabel(eventType: string) {
  const entry = Object.entries(quickEventLabels).find(([type]) => type === eventType)
  return entry?.[1] ?? eventType
}

export function mapPeriodSecondToVideoSecond(
  syncPoints: VideoSyncPoint[],
  videoId: string,
  periodId: string,
  secondInPeriod: number,
): number | null {
  if (!Number.isFinite(secondInPeriod) || secondInPeriod < 0) return null

  const points = syncPoints
    .filter(
      (point) => point.videoId === videoId && point.periodId === periodId,
    )
    .sort((a, b) => a.secondInPeriod - b.secondInPeriod)

  // Reject ambiguous or invalid anchors rather than manufacture a video time.
  if (points.some((point, index) =>
    !Number.isFinite(point.videoSecond) || point.videoSecond < 0 ||
    !Number.isFinite(point.secondInPeriod) || point.secondInPeriod < 0 ||
    (index > 0 && (point.secondInPeriod <= points[index - 1].secondInPeriod ||
      point.videoSecond <= points[index - 1].videoSecond)),
  )) return null

  if (points.length === 0) {
    return null
  }

  const exact = points.find(
    (point) => point.secondInPeriod === secondInPeriod,
  )

  if (exact) {
    return exact.videoSecond
  }

  let lower: VideoSyncPoint | null = null
  let upper: VideoSyncPoint | null = null

  for (const point of points) {
    if (point.secondInPeriod < secondInPeriod) {
      lower = point
      continue
    }

    if (point.secondInPeriod > secondInPeriod) {
      upper = point
      break
    }
  }

  if (lower && upper) {
    const periodSpan = upper.secondInPeriod - lower.secondInPeriod
    const videoSpan = upper.videoSecond - lower.videoSecond
    const progress = (secondInPeriod - lower.secondInPeriod) / periodSpan

    return lower.videoSecond + videoSpan * progress
  }

  if (lower) {
    return lower.videoSecond + (secondInPeriod - lower.secondInPeriod)
  }

  if (upper) {
    const mapped = upper.videoSecond - (upper.secondInPeriod - secondInPeriod)
    return mapped >= 0 ? mapped : null
  }

  return null
}
