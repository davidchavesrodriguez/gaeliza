import type { VideoSyncPoint } from './analysis'

export type QuickEventType =
  | 'shot'
  | 'recovery'
  | 'turnover'
  | 'foul'
  | 'card'
  | 'kickout'
  | 'block'

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
}

export function getEventResultLabel(event: AnalysisEventSummary) {
  switch (event.eventType) {
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

export function mapPeriodSecondToVideoSecond(
  syncPoints: VideoSyncPoint[],
  videoId: string,
  periodId: string,
  secondInPeriod: number,
): number | null {
  const points = syncPoints
    .filter(
      (point) => point.videoId === videoId && point.periodId === periodId,
    )
    .sort((a, b) => a.secondInPeriod - b.secondInPeriod)

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
    return Math.max(
      0,
      upper.videoSecond - (upper.secondInPeriod - secondInPeriod),
    )
  }

  return null
}
