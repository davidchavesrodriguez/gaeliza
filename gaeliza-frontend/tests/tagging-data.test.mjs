import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import ts from 'typescript'

// Load the real data layer with only its Supabase transport substituted.
// TypeScript is already a project dependency; no extra test runner is needed.
let respond
const calls = []
function query(operation) {
  const call = { operation, steps: [] }
  calls.push(call)
  const builder = new Proxy({}, { get(_, method) {
    if (method === 'then') return (resolve, reject) => Promise.resolve().then(() => respond(call)).then(resolve, reject)
    return (...args) => { call.steps.push([method, ...args]); return builder }
  } })
  return builder
}
globalThis[Symbol.for('gaeliza.test.supabase')] = {
  from: (table) => query(table),
  rpc: (name, args) => { const call = { operation: name, args }; calls.push(call); return respond(call) },
}
const source = await readFile(new URL('../src/v2/data/tagging.ts', import.meta.url), 'utf8')
const javascript = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText
  .replace(/import \{ supabase \} from ['"]\.\.\/lib\/supabase['"];?/, "const supabase = globalThis[Symbol.for('gaeliza.test.supabase')]")
const { listAnalysisEvents, logQuickEvent, removeAnalysisEvent, reopenAnalysis } = await import(`data:text/javascript;base64,${Buffer.from(javascript).toString('base64')}`)
delete globalThis[Symbol.for('gaeliza.test.supabase')]
const fact = (index) => ({
  event_id: `event-${index}`, event_type: 'shot', team_id: 'team', period_id: 'period', period_number: 1,
  second_in_period: index, raw_x: '0', raw_y: '0', score_value: 1, shot_result: 'point',
  recovery_method: null, turnover_cause: null, foul_outcome: null, card_type: null, kickout_length: null, kickout_result: null,
})

test('timeline pagination retains all rows, zero coordinates, stable ordering and AbortSignal', async () => {
  calls.length = 0
  const signal = new AbortController().signal
  respond = (call) => {
    const [, offset, end] = call.steps.find(([method]) => method === 'range')
    assert.equal(end - offset + 1, 500)
    assert.equal(call.steps.find(([method]) => method === 'abortSignal')[1], signal)
    const size = offset === 0 ? 500 : 1
    return { data: Array.from({ length: size }, (_, index) => fact(index + offset)), error: null }
  }
  const events = await listAnalysisEvents('analysis', signal)
  assert.equal(events.length, 501)
  assert.equal(events[0].rawX, 0); assert.equal(events[0].rawY, 0)
  assert.equal(events.at(-1).id, 'event-500')
  assert.equal(calls.length, 2)
  assert.deepEqual(calls[0].steps.filter(([method]) => method === 'order').map(([, column]) => column),
    ['period_sort_order', 'second_in_period', 'sort_order', 'created_at', 'event_id'])
})
test('aborted paginated reads never return partial success', async () => {
  const controller = new AbortController()
  respond = (call) => {
    const signal = call.steps.find(([method]) => method === 'abortSignal')[1]
    if (signal.aborted) return { data: null, error: { message: 'Aborted' } }
    controller.abort()
    return { data: Array.from({ length: 500 }, (_, index) => fact(index)), error: null }
  }
  await assert.rejects(listAnalysisEvents('analysis', controller.signal), /Aborted/)
})
test('logQuickEvent sends a single atomic RPC with analysis participant IDs and raw zero', async () => {
  calls.length = 0
  respond = () => ({ data: 'new-event', error: null })
  assert.equal(await logQuickEvent({ analysisId: 'analysis', periodId: 'period', teamId: 'team', eventType: 'shot',
    secondInPeriod: 0, x: 0, y: 0, detail: { result: 'blocked' }, participants: [{ participantId: 'temporary', role: 'blocker' }],
  }), 'new-event')
  assert.equal(calls.length, 1)
  assert.equal(calls[0].operation, 'log_event')
  assert.deepEqual(calls[0].args.p_participants, [{ participant_id: 'temporary', role: 'blocker' }])
  assert.equal(calls[0].args.p_x, 0); assert.equal(calls[0].args.p_y, 0)
  assert.equal(calls[0].args.p_possession_id, null)
  assert.equal('p_video_second' in calls[0].args, false)
})
test('RLS-hidden delete/reopen do not report false success', async () => {
  respond = () => ({ data: null, error: { code: 'PGRST116', message: 'No row returned' } })
  await assert.rejects(removeAnalysisEvent('missing'), /No row returned/)
  await assert.rejects(reopenAnalysis('missing'), /No row returned/)
})

test('extended facts map their actual typed details without losing pass result', async () => {
  respond = () => ({ data: [{ ...fact(0), pass_result: 'intercepted', pass_technique: 'hand', duel_type: 'aerial', dribble_result: 'failed', restart_type: 'sideline' }], error: null })
  const [event] = await listAnalysisEvents('analysis')
  assert.equal(event.passResult, 'intercepted'); assert.equal(event.passTechnique, 'hand')
  assert.equal(event.duelType, 'aerial'); assert.equal(event.dribbleResult, 'failed'); assert.equal(event.restartType, 'sideline')
})
test('replacement role lookups are scoped, batched, abortable and use historical analysis snapshots', async () => {
  calls.length = 0
  const signal = new AbortController().signal
  respond = (call) => {
    assert.equal(call.steps.find(([method]) => method === 'abortSignal')[1], signal)
    if (call.operation === 'analysis_event_facts') {
      const [, offset] = call.steps.find(([method]) => method === 'range')
      return { data: offset === 0 ? Array.from({ length: 500 }, (_, index) => ({ ...fact(index), event_type: 'substitution' })) : [], error: null }
    }
    assert.equal(call.operation, 'event_participants')
    assert.deepEqual(call.steps.find(([method]) => method === 'eq'), ['eq', 'analysis_id', 'analysis'])
    const ids = call.steps.find(([method]) => method === 'in')[2]
    assert.ok(ids.length <= 100)
    return { data: ids.flatMap((event_id) => [
      { event_id, role: 'player_out', participant: { id: 'temporary-out', number: 8, display_name_snapshot: 'Temporary #8' } },
      { event_id, role: 'player_in', participant: { id: 'temporary-in', number: 12, display_name_snapshot: 'Temporary #12' } },
    ]), error: null }
  }
  const events = await listAnalysisEvents('analysis', signal)
  assert.equal(events.length, 500)
  assert.equal(calls.filter((call) => call.operation === 'event_participants').length, 5)
  assert.deepEqual(events[0].participants.map((p) => p.number), [8, 12])
})
test('a failed role lookup does not publish a partially populated timeline', async () => {
  respond = (call) => call.operation === 'analysis_event_facts'
    ? { data: [{ ...fact(0), event_type: 'goalkeeper_change' }], error: null }
    : { data: null, error: { message: 'role read failed' } }
  await assert.rejects(listAnalysisEvents('analysis'), /role read failed/)
})
