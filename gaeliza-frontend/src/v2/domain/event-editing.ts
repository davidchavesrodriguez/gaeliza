import { domainLabel } from './presentation.ts'
import { formatAnalysisClock } from './analysis.ts'
import {
  shotResults, techniques, shotSituations, recoveryMethods, turnoverCauses, foulCauses,
  foulOutcomes, cardTypes, kickoutLengths, kickoutResults, passResults, duelTypes,
  dribbleResults, restartTypes, participantRoles,
  type CaptureDraft, type CaptureFormState, type ParticipantRole, type RoleSpec,
} from './event-capture.ts'
import { quickEventLabels, type QuickEventType, type EventParticipantInput } from './tagging.ts'

export type EventForEditing = {
  id: string
  updatedAt: string
  form: CaptureFormState
  additionalParticipants: EventParticipantInput[]
  relatedFoulEventId: string | null
}

export function readRecord(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('Resposta de evento non válida.')
  // The transport is untyped; individual fields are decoded below.
  return value as Record<string, unknown>
}

function choice<T extends string>(value: unknown, options: readonly T[]): T | null {
  if (value === null || value === undefined) return null
  const found = options.find((item) => item === value)
  if (found === undefined) throw new Error('O evento contén un valor de detalle non recoñecido.')
  return found
}
export function readNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null
  if (typeof value !== 'number' && typeof value !== 'string') throw new Error('Número de evento non válido.')
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) throw new Error('Número de evento non válido.')
  return parsed
}
export function readString(value: unknown): string {
  if (typeof value !== 'string' || !value) throw new Error('Faltan datos do evento.')
  return value
}
export function readEventType(value: unknown): QuickEventType {
  const type = eventTypes.find((item) => item === value)
  if (!type) throw new Error('Tipo de evento non recoñecido.')
  return type
}
const eventTypes = ['shot', 'recovery', 'turnover', 'foul', 'card', 'kickout', 'block', 'pass', 'duel', 'dribble', 'restart', 'substitution', 'goalkeeper_change'] as const

// Decode the complete facts row without filling missing historical details with
// creation defaults. Unknown stays null, including older shots/cards/kickouts.
export function captureFromFact(fact: Record<string, unknown>): CaptureDraft {
  const eventType = readEventType(fact.event_type)
  switch (eventType) {
    case 'shot': return { eventType, detail: { result: choice(fact.shot_result, shotResults), technique: choice(fact.shot_technique, techniques), situation: choice(fact.shot_situation, shotSituations) } }
    case 'pass': return { eventType, detail: { result: choice(fact.pass_result, passResults), technique: choice(fact.pass_technique, techniques), end_x: readNumber(fact.pass_raw_end_x), end_y: readNumber(fact.pass_raw_end_y) } }
    case 'recovery': return { eventType, detail: { method: choice(fact.recovery_method, recoveryMethods) } }
    case 'turnover': return { eventType, detail: { cause: choice(fact.turnover_cause, turnoverCauses) } }
    case 'duel': return { eventType, detail: { duel_type: choice(fact.duel_type, duelTypes) } }
    case 'dribble': return { eventType, detail: { result: choice(fact.dribble_result, dribbleResults) } }
    case 'foul': return { eventType, detail: { cause: choice(fact.foul_cause, foulCauses), outcome: choice(fact.foul_outcome, foulOutcomes) } }
    case 'card': return { eventType, detail: { card_type: choice(fact.card_type, cardTypes) } }
    case 'kickout': return { eventType, detail: { length: choice(fact.kickout_length, kickoutLengths), result: choice(fact.kickout_result, kickoutResults), end_x: readNumber(fact.kickout_raw_end_x), end_y: readNumber(fact.kickout_raw_end_y) } }
    case 'restart': return { eventType, detail: { restart_type: choice(fact.restart_type, restartTypes) } }
    case 'block': case 'substitution': case 'goalkeeper_change': return { eventType, detail: {} }
  }
}

// Extra DB-supported roles remain visible/editable without overwriting duplicate
// roles or information that quick capture did not expose.
export function additionalRoleSpecs(capture: CaptureDraft): RoleSpec[] {
  const same = (role: ParticipantRole): RoleSpec => ({ role, label: domainLabel(role), team: 'same' })
  const opponent = (role: ParticipantRole): RoleSpec => ({ role, label: domainLabel(role), team: 'opponent' })
  switch (capture.eventType) {
    case 'shot': return participantRoles(capture).some((spec) => spec.role === 'goalkeeper') ? [] : [opponent('goalkeeper')]
    case 'recovery': case 'turnover': return [opponent('opponent')]
    case 'kickout': return [same('target'), same('kickout_receiver'), opponent('opponent')]
    case 'restart': return [same('receiver'), same('target'), opponent('opponent')]
    default: return []
  }
}
export function editingRoleSpecs(capture: CaptureDraft): RoleSpec[] {
  return [...participantRoles(capture), ...additionalRoleSpecs(capture)]
}
export function decodeEventForEditing(fact: Record<string, unknown>, participants: EventParticipantInput[]): EventForEditing {
  const capture = captureFromFact(fact)
  const roles: CaptureFormState['roles'] = {}
  const additionalParticipants: EventParticipantInput[] = []
  for (const participant of participants) {
    const spec = participantRoles(capture).find((item) => item.role === participant.role)
    if (spec && !roles[spec.role]) roles[spec.role] = participant.participantId
    else additionalParticipants.push(participant)
  }
  return {
    id: readString(fact.event_id), updatedAt: readString(fact.updated_at), additionalParticipants,
    relatedFoulEventId: typeof fact.related_foul_event_id === 'string' ? fact.related_foul_event_id : null,
    form: { teamId: readString(fact.team_id), periodId: readString(fact.period_id),
      clock: formatAnalysisClock(readNumber(fact.second_in_period) ?? 0),
      x: readNumber(fact.raw_x), y: readNumber(fact.raw_y), capture, roles },
  }
}
export function editingTitle(event: EventForEditing) { return `Editar ${quickEventLabels[event.form.capture.eventType].toLowerCase()}` }

export function compatibleAdditionalParticipants(items: EventParticipantInput[], form: CaptureFormState, roster: { id: string; teamId: string }[]) {
  const specs = editingRoleSpecs(form.capture)
  return items.filter((item) => {
    const spec = specs.find((candidate) => candidate.role === item.role)
    const person = roster.find((candidate) => candidate.id === item.participantId)
    if (!spec || !person) return false
    return spec.team === 'same' ? person.teamId === form.teamId : person.teamId !== form.teamId
  })
}
export function mergeEditingParticipants(main: EventParticipantInput[], additional: EventParticipantInput[], form: CaptureFormState, roster: { id: string; teamId: string }[]) {
  if (compatibleAdditionalParticipants(additional, form, roster).length !== additional.length) {
    throw new Error('Un rol adicional xa non é compatible ou o participante non está dispoñible.')
  }
  const combined = [...main, ...additional]
  const keys = combined.map((p) => `${p.role}:${p.participantId}`)
  if (new Set(keys).size !== keys.length) throw new Error('Hai roles duplicados para o mesmo participante.')
  return combined
}
