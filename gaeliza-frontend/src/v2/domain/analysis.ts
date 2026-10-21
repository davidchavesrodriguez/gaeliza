import type { AnalysisMode, TeamSummary } from './matches'

export type AnalysisStatus = 'draft' | 'in_progress' | 'completed'

export type AnalysisPeriod = {
  id: string
  number: number
  name: string | null
  expectedDurationSeconds: number
  homeAttacksTowards: 'left' | 'right' | null
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
}

export function getPlayerDisplayName(player: RosterPlayer) {
  return [player.firstName, player.lastName].filter(Boolean).join(' ')
}
