import type { AnalysisMode } from './matches'
export type TeamGender = 'male' | 'female' | 'mixed'
export type TeamOption = {
  id: string; name: string; shortName: string | null
  scope: 'official' | 'personal'; ownerUserId: string | null
}
export type PersonalTeamInput = { name: string; shortName: string; gender: TeamGender }
export type TeamPlayerInput = {
  teamId: string; firstName: string; lastName: string; defaultNumber: number | null; primaryPosition: string
}
export type PersonalMatchInput = {
  homeTeamId: string; awayTeamId: string; scheduledAt: string; roundLabel: string; mode: AnalysisMode
}
export function localDateTime(iso: string): string {
  const d = new Date(iso)
  if (!Number.isFinite(d.getTime())) throw new Error('Data non válida.')
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
export function localDateTimeToInstant(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) throw new Error('Indica a data e hora do partido.')
  const d = new Date(value)
  // Reject impossible dates and local times skipped by a DST transition.
  if (!Number.isFinite(d.getTime()) || localDateTime(d.toISOString()) !== value) throw new Error('Esa data ou hora non existe na túa zona horaria.')
  return d.toISOString()
}
export function validatePersonalMatch(input: PersonalMatchInput) {
  if (!input.homeTeamId || !input.awayTeamId) throw new Error('Escolle os dous equipos.')
  if (input.homeTeamId === input.awayTeamId) throw new Error('O equipo local e o visitante deben ser distintos.')
  if (!Number.isFinite(new Date(input.scheduledAt).getTime())) throw new Error('Data non válida.')
}
