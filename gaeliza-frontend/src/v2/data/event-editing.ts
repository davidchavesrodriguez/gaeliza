import { decodeEventForEditing, readRecord, readString, type EventForEditing } from '../domain/event-editing'
import type { LogQuickEventInput } from '../domain/tagging'
import { supabase } from '../lib/supabase'

export async function getEventForEditing(analysisId: string, eventId: string, signal: AbortSignal): Promise<EventForEditing> {
  const fact = await supabase.from('analysis_event_facts').select('*')
    .eq('analysis_id', analysisId).eq('event_id', eventId).abortSignal(signal).single()
  if (fact.error) throw new Error(`Non puidemos cargar o evento: ${fact.error.message}`)
  const roles = await supabase.from('event_participants').select('analysis_participant_id, role')
    .eq('analysis_id', analysisId).eq('event_id', eventId).order('role').order('analysis_participant_id').abortSignal(signal)
  if (roles.error) throw new Error(`Non puidemos cargar os participantes: ${roles.error.message}`)
  // Separate HTTP reads can straddle a committed edit. Read in order and verify
  // the version after roles, so an inconsistent snapshot is never editable.
  const version = await supabase.from('events').select('updated_at')
    .eq('analysis_id', analysisId).eq('id', eventId).abortSignal(signal).single()
  if (version.error) throw new Error(`Non puidemos comprobar a versión: ${version.error.message}`)
  const fullFact = readRecord(fact.data)
  if (readRecord(version.data).updated_at !== fullFact.updated_at) throw new Error('O evento cambiou durante a carga. Cancela e volve abrir o editor.')
  if (!Array.isArray(roles.data)) throw new Error('Resposta de participantes non válida.')
  return decodeEventForEditing(fullFact, roles.data.map((value: unknown) => {
    const row = readRecord(value)
    return { participantId: readString(row.analysis_participant_id), role: readString(row.role) }
  }))
}

export async function updateAnalysisEvent(event: EventForEditing, input: LogQuickEventInput): Promise<string> {
  if (input.eventType !== event.form.capture.eventType) throw new Error('O tipo de evento non se pode cambiar.')
  const { data, error } = await supabase.rpc('update_event', {
    p_analysis_id: input.analysisId, p_event_id: event.id,
    p_team_id: input.teamId, p_period_id: input.periodId, p_second_in_period: input.secondInPeriod,
    p_expected_updated_at: event.updatedAt, p_x: input.x, p_y: input.y,
    p_detail: input.detail,
    p_participants: input.participants.map((p) => ({ participant_id: p.participantId, role: p.role })),
  })
  if (error?.code === '55000') throw new Error('O evento está ligado a unha posesión manual. Revisa esa asociación explicitamente antes de editalo.')
  if (error?.code === '40001') throw new Error('O evento cambiou desde que o abrises. Cancela e volve abrir o editor para cargar a versión actual.')
  if (error) throw new Error(`Non puidemos gardar os cambios: ${error.message}`)
  if (data !== event.id) throw new Error('O RPC non devolveu o evento esperado.')
  return data
}
