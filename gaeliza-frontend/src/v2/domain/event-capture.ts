import { parseAnalysisClock, type AnalysisParticipant, type AnalysisWorkspace } from './analysis.ts'
import type { EventParticipantInput, LogQuickEventInput, QuickEventType } from './tagging'

// Values mirror the typed detail CHECKs in 20261021163000_v2_event_model.sql.
export const shotResults = ['goal', 'point', 'wide', 'saved', 'blocked', 'post'] as const
export const techniques = ['hand', 'foot'] as const
export const shotSituations = ['open_play', 'free', 'forty_five', 'penalty'] as const
export const recoveryMethods = ['interception', 'tackle', 'loose_ball', 'rebound', 'kickout', 'other'] as const
export const turnoverCauses = ['bad_pass', 'bad_control', 'steps', 'out_of_play', 'offensive_foul', 'dispossessed', 'other'] as const
export const foulCauses = ['holding', 'striking', 'obstruction', 'pickup', 'steps', 'push', 'trip', 'other'] as const
export const foulOutcomes = ['free', 'forty_five', 'penalty', 'advantage', 'none'] as const
export const cardTypes = ['yellow', 'black', 'red'] as const
export const kickoutLengths = ['short', 'long'] as const
export const kickoutResults = ['retained', 'contested_won', 'contested_lost', 'directly_lost'] as const
export const passResults = ['completed', 'incomplete', 'intercepted'] as const
export const duelTypes = ['aerial', 'ground', 'other'] as const
export const dribbleResults = ['successful', 'failed'] as const
export const restartTypes = ['free', 'sideline', 'throw_in', 'forty_five', 'penalty', 'other'] as const

type Item<T extends readonly string[]> = T[number]
type Destination = { end_x: number | null; end_y: number | null }
type Details = {
  shot: { result: Item<typeof shotResults>; technique: Item<typeof techniques> | null; situation: Item<typeof shotSituations> | null }
  recovery: { method: Item<typeof recoveryMethods> | null }
  turnover: { cause: Item<typeof turnoverCauses> | null }
  foul: { cause: Item<typeof foulCauses> | null; outcome: Item<typeof foulOutcomes> | null }
  card: { card_type: Item<typeof cardTypes> }
  kickout: Destination & { length: Item<typeof kickoutLengths>; result: Item<typeof kickoutResults> | null }
  block: Record<string, never>
  pass: Destination & { result: Item<typeof passResults> | null; technique: Item<typeof techniques> | null }
  duel: { duel_type: Item<typeof duelTypes> | null }
  dribble: { result: Item<typeof dribbleResults> | null }
  restart: { restart_type: Item<typeof restartTypes> | null }
  substitution: Record<string, never>
  goalkeeper_change: Record<string, never>
}
export type CaptureDraft = { [K in QuickEventType]: { eventType: K; detail: Details[K] } }[QuickEventType]
export type DraftOf<K extends QuickEventType> = Extract<CaptureDraft, { eventType: K }>
export type ParticipantRole =
  | 'shooter' | 'assister' | 'goalkeeper' | 'blocker' | 'blocked_player'
  | 'recoverer' | 'turnover_player' | 'offender' | 'fouled' | 'card_recipient' | 'kicker'
  | 'passer' | 'receiver' | 'intended_receiver' | 'interceptor'
  | 'duel_winner' | 'duel_loser' | 'dribbler' | 'defender' | 'restart_taker'
  | 'player_out' | 'player_in' | 'goalkeeper_out' | 'goalkeeper_in'
export type RoleSpec = { role: ParticipantRole; label: string; team: 'same' | 'opponent' }
export type SelectedRoles = Partial<Record<ParticipantRole, string>>
export type CaptureFormState = {
  teamId: string; periodId: string; clock: string
  x: number | null; y: number | null
  capture: CaptureDraft
  roles: SelectedRoles
}

export function defaultCapture(eventType: QuickEventType): CaptureDraft {
  switch (eventType) {
    case 'shot': return { eventType, detail: { result: 'point', technique: null, situation: null } }
    case 'recovery': return { eventType, detail: { method: null } }
    case 'turnover': return { eventType, detail: { cause: null } }
    case 'foul': return { eventType, detail: { cause: null, outcome: null } }
    case 'card': return { eventType, detail: { card_type: 'yellow' } }
    case 'kickout': return { eventType, detail: { length: 'short', result: null, end_x: null, end_y: null } }
    case 'pass': return { eventType, detail: { result: null, technique: null, end_x: null, end_y: null } }
    case 'duel': return { eventType, detail: { duel_type: null } }
    case 'dribble': return { eventType, detail: { result: null } }
    case 'restart': return { eventType, detail: { restart_type: null } }
    case 'block': case 'substitution': case 'goalkeeper_change': return { eventType, detail: {} }
  }
}

export function participantRoles(capture: CaptureDraft): RoleSpec[] {
  const same = (role: ParticipantRole, label: string): RoleSpec => ({ role, label, team: 'same' })
  const opponent = (role: ParticipantRole, label: string): RoleSpec => ({ role, label, team: 'opponent' })
  switch (capture.eventType) {
    case 'shot': {
      const primary = same('shooter', 'Tirador')
      switch (capture.detail.result) {
        case 'goal': case 'point': return [primary, same('assister', 'Asistencia')]
        case 'saved': return [primary, opponent('goalkeeper', 'Porteiro rival')]
        case 'blocked': return [primary, opponent('blocker', 'Bloqueador rival')]
        default: return [primary]
      }
    }
    case 'pass': {
      const passer = same('passer', 'Pasador')
      switch (capture.detail.result) {
        case 'completed': return [passer, same('receiver', 'Receptor')]
        case 'incomplete': return [passer, same('intended_receiver', 'Receptor previsto')]
        case 'intercepted': return [passer, same('intended_receiver', 'Receptor previsto'), opponent('interceptor', 'Interceptor rival')]
        default: return [passer]
      }
    }
    case 'recovery': return [same('recoverer', 'Recuperador')]
    case 'turnover': return [same('turnover_player', 'Xogador da perda')]
    case 'foul': return [same('offender', 'Infractor'), opponent('fouled', 'Xogador que recibe a falta')]
    case 'card': return [same('card_recipient', 'Sancionado')]
    case 'kickout': return [same('kicker', 'Lanzador')]
    case 'block': return [same('blocker', 'Bloqueador'), opponent('blocked_player', 'Xogador bloqueado')]
    case 'duel': return [same('duel_winner', 'Gañador do duelo'), opponent('duel_loser', 'Perdedor rival')]
    case 'dribble': return [same('dribbler', 'Regateador'), opponent('defender', 'Defensor rival')]
    case 'restart': return [same('restart_taker', 'Executor do reinicio')]
    case 'substitution': return [same('player_out', 'Xogador que sae'), same('player_in', 'Xogador que entra')]
    case 'goalkeeper_change': return [same('goalkeeper_out', 'Porteiro que sae'), same('goalkeeper_in', 'Porteiro que entra')]
  }
}

export function eligibleParticipants(spec: RoleSpec, teamId: string, participants: AnalysisParticipant[]) {
  return participants.filter((participant) => spec.team === 'same'
    ? participant.teamId === teamId : participant.teamId !== teamId)
}

export function pruneRoles(capture: CaptureDraft, roles: SelectedRoles, teamId: string, roster: AnalysisParticipant[]): SelectedRoles {
  const result: SelectedRoles = {}
  for (const spec of participantRoles(capture)) {
    const selected = roles[spec.role]
    if (spec.role === 'assister' && selected === roles.shooter) continue
    if (selected && eligibleParticipants(spec, teamId, roster).some((p) => p.id === selected)) result[spec.role] = selected
  }
  return result
}

export function changeCapture(form: CaptureFormState, next: CaptureDraft, roster: AnalysisParticipant[]): CaptureFormState {
  if (next.eventType !== form.capture.eventType) return { ...form, capture: next, roles: {}, x: null, y: null }
  return { ...form, capture: next, roles: pruneRoles(next, form.roles, form.teamId, roster) }
}

export function isCoordinatePair(x: number | null, y: number | null) {
  return (x === null && y === null) || (x !== null && y !== null &&
    [x, y].every((value) => Number.isFinite(value) && value >= 0 && value <= 100))
}

export function buildCaptureInput(form: CaptureFormState, workspace: AnalysisWorkspace): LogQuickEventInput {
  if (workspace.status === 'completed') throw new Error('Reabre o análise antes de engadir ou editar eventos.')
  if (![workspace.homeTeam.id, workspace.awayTeam.id].includes(form.teamId)) throw new Error('Escolle un equipo válido.')
  if (!workspace.periods.some((period) => period.id === form.periodId)) throw new Error('Escolle un período válido.')
  const secondInPeriod = parseAnalysisClock(form.clock, { integer: true })
  if (secondInPeriod === null || secondInPeriod > 2147483647) throw new Error('Introduce un tempo válido do período, por exemplo 12:34.')
  if (!isCoordinatePair(form.x, form.y)) throw new Error('A posición debe ter X e Y entre 0 e 100, ou quedar baleira.')
  const { capture } = form
  if ((capture.eventType === 'pass' || capture.eventType === 'kickout') &&
      !isCoordinatePair(capture.detail.end_x, capture.detail.end_y)) throw new Error('O destino debe ter X e Y entre 0 e 100, ou quedar baleiro.')
  const validRoles = pruneRoles(capture, form.roles, form.teamId, workspace.participants)
  const participants: EventParticipantInput[] = []
  for (const spec of participantRoles(capture)) {
    const id = form.roles[spec.role]
    if (id && validRoles[spec.role] !== id) throw new Error('Un participante xa non está dispoñible para este rol. Revisa a selección.')
    if (id) participants.push({ participantId: id, role: spec.role })
  }
  if (capture.eventType === 'substitution' || capture.eventType === 'goalkeeper_change') {
    if (participants.length === 2 && participants[0].participantId === participants[1].participantId) {
      throw new Error('Quen sae e quen entra deben ser participantes distintos.')
    }
  }
  return { analysisId: workspace.id, periodId: form.periodId, teamId: form.teamId,
    eventType: capture.eventType, secondInPeriod, x: form.x, y: form.y,
    detail: capture.detail, participants }
}

export function withDestination(capture: CaptureDraft, end_x: number | null, end_y: number | null): CaptureDraft {
  switch (capture.eventType) {
    case 'pass': return { ...capture, detail: { ...capture.detail, end_x, end_y } }
    case 'kickout': return { ...capture, detail: { ...capture.detail, end_x, end_y } }
    default: return capture
  }
}
