import type {
  AnalysisEventSummary,
  LogQuickEventInput,
} from '../domain/tagging'
import { supabase } from '../lib/supabase'

type RawEventFact = {
  event_id: string
  event_type: string
  team_id: string
  period_id: string
  period_number: number
  second_in_period: number
  raw_x: number | string | null
  raw_y: number | string | null
  score_value: number | null
  shot_result: string | null
  recovery_method: string | null
  turnover_cause: string | null
  foul_outcome: string | null
  card_type: string | null
  kickout_length: string | null
  kickout_result: string | null
}

function mapNullableNumber(value: number | string | null) {
  return value === null ? null : Number(value)
}

function mapEvent(event: RawEventFact): AnalysisEventSummary {
  return {
    id: event.event_id,
    eventType: event.event_type,
    teamId: event.team_id,
    periodId: event.period_id,
    periodNumber: event.period_number,
    secondInPeriod: event.second_in_period,
    rawX: mapNullableNumber(event.raw_x),
    rawY: mapNullableNumber(event.raw_y),
    scoreValue: event.score_value ?? 0,
    shotResult: event.shot_result,
    recoveryMethod: event.recovery_method,
    turnoverCause: event.turnover_cause,
    foulOutcome: event.foul_outcome,
    cardType: event.card_type,
    kickoutLength: event.kickout_length,
    kickoutResult: event.kickout_result,
  }
}

function taggingError(message: string, code?: string) {
  if (code === '23514') {
    return new Error(
      'O evento non é coherente co estado do análise, o equipo, o tempo ou os roles seleccionados.',
    )
  }

  if (code === '23505') {
    return new Error('Ese dato xa está rexistrado no análise.')
  }

  return new Error(message)
}

export async function listAnalysisEvents(
  analysisId: string,
  signal?: AbortSignal,
): Promise<AnalysisEventSummary[]> {
  const events: AnalysisEventSummary[] = []
  const pageSize = 500
  for (let offset = 0; ; offset += pageSize) {
    let query = supabase
      .from('analysis_event_facts')
      .select(
        'event_id, event_type, team_id, period_id, period_number, second_in_period, raw_x, raw_y, score_value, shot_result, recovery_method, turnover_cause, foul_outcome, card_type, kickout_length, kickout_result',
      )
      .eq('analysis_id', analysisId)
      .order('period_sort_order', { ascending: true })
      .order('second_in_period', { ascending: true })
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true })
      .order('event_id', { ascending: true })
      .range(offset, offset + pageSize - 1)

    if (signal) query = query.abortSignal(signal)
    const { data, error } = await query
    if (error) throw new Error(`Could not load analysis events: ${error.message}`)

    const page = data as unknown as RawEventFact[]
    events.push(...page.map(mapEvent))
    if (page.length < pageSize) return events
  }
}

export async function logQuickEvent(input: LogQuickEventInput): Promise<string> {
  const { data, error } = await supabase.rpc('log_event', {
    p_analysis_id: input.analysisId,
    p_period_id: input.periodId,
    p_team_id: input.teamId,
    p_event_type: input.eventType,
    p_second_in_period: input.secondInPeriod,
    p_possession_id: null,
    p_x: input.x,
    p_y: input.y,
    p_notes: null,
    p_detail: input.detail,
    p_participants: input.participants.map((participant) => ({
      participant_id: participant.participantId,
      role: participant.role,
    })),
  })

  if (error) {
    throw taggingError(`Could not log event: ${error.message}`, error.code)
  }

  if (typeof data !== 'string') {
    throw new Error('The event RPC did not return an event identifier.')
  }

  return data
}

export async function removeAnalysisEvent(eventId: string): Promise<void> {
  const { error } = await supabase.from('events').delete().eq('id', eventId).select('id').single()

  if (error) {
    throw taggingError(`Could not remove event: ${error.message}`, error.code)
  }
}

export async function rebuildInferredPossessions(
  analysisId: string,
): Promise<number> {
  const { data, error } = await supabase.rpc('rebuild_inferred_possessions', {
    p_analysis_id: analysisId,
  })

  if (error) {
    throw taggingError(
      `Could not rebuild possessions: ${error.message}`,
      error.code,
    )
  }

  return typeof data === 'number' ? data : Number(data ?? 0)
}

export async function reopenAnalysis(analysisId: string): Promise<void> {
  const { error } = await supabase
    .from('analyses')
    .update({ status: 'in_progress' })
    .eq('id', analysisId)
    .select('id')
    .single()

  if (error) {
    throw taggingError(
      `Could not reopen analysis: ${error.message}`,
      error.code,
    )
  }
}
