import { formatProductDate } from './presentation.ts'
export type TeamSummary = {
  id: string
  name: string
  shortName: string | null
  logoPath: string | null
}

export type CompetitionSummary = {
  id: string
  name: string
  shortName: string | null
}

export type MatchOption = {
  id: string
  scheduledAt: string | null
  status: 'scheduled' | 'played' | 'postponed' | 'cancelled'
  scope: 'official' | 'personal'
  roundNumber: number | null
  roundLabel: string | null
  homeTeam: TeamSummary
  awayTeam: TeamSummary
  competition: CompetitionSummary | null
}

export type AnalysisMode = 'post_match' | 'live'

export function formatMatchDate(scheduledAt: string | null) {
  return formatProductDate(scheduledAt)
}

export function formatRound(match: MatchOption) {
  if (match.roundLabel) {
    return match.roundLabel
  }

  if (match.roundNumber) {
    return `Xornada ${match.roundNumber}`
  }

  return null
}
