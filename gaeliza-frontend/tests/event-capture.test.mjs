import assert from 'node:assert/strict'
import test from 'node:test'
import { buildCaptureInput, changeCapture, defaultCapture, pruneRoles, participantRoles, withDestination } from '../src/v2/domain/event-capture.ts'
import { getEventResultLabel } from '../src/v2/domain/tagging.ts'

const player = (id, teamId, number) => ({ id, teamId, number, playerId: null, displayName: id, starter: null, initialGoalkeeper: false, position: null })
const workspace = {
  id: 'analysis', status: 'draft', homeTeam: { id: 'home' }, awayTeam: { id: 'away' },
  periods: [{ id: 'period', expectedDurationSeconds: 1800 }],
  participants: [player('h1', 'home', 8), player('h2', 'home', 12), player('a1', 'away', 1)],
}
const form = (type, detail = {}, roles = {}) => {
  const capture = defaultCapture(type)
  return { teamId: 'home', periodId: 'period', clock: '0:00', x: null, y: null,
    capture: { ...capture, detail: { ...capture.detail, ...detail } }, roles }
}
for (const type of ['shot', 'recovery', 'turnover', 'foul', 'card', 'kickout', 'block', 'pass', 'duel', 'dribble', 'restart', 'substitution', 'goalkeeper_change']) {
  test(`team-only ${type} produces one canonical input`, () => {
    const input = buildCaptureInput(form(type), workspace)
    assert.equal(input.eventType, type); assert.deepEqual(input.participants, [])
    assert.equal(input.secondInPeriod, 0)
    assert.equal(input.analysisId, workspace.id)
    if (['pass', 'duel', 'dribble', 'restart'].includes(type)) assert.ok(Object.values(input.detail).every((value) => value === null))
  })
}
for (const [result, roles] of [
  ['completed', { passer: 'h1', receiver: 'h2' }],
  ['incomplete', { passer: 'h1', intended_receiver: 'h2' }],
  ['intercepted', { passer: 'h1', intended_receiver: 'h2', interceptor: 'a1' }],
]) {
  test(`pass ${result} records only its own detail and compatible roles`, () => {
    const input = buildCaptureInput(form('pass', { result, technique: 'foot' }, roles), workspace)
    assert.equal(input.eventType, 'pass'); assert.equal(input.detail.result, result)
    assert.deepEqual(input.participants.map((p) => p.role), Object.keys(roles))
    assert.equal('recovery' in input.detail, false); assert.equal('turnover' in input.detail, false)
  })
}
test('pass result changes prune incompatible receiver/interceptor but retain compatible roles', () => {
  const intercepted = form('pass', { result: 'intercepted' }, { passer: 'h1', intended_receiver: 'h2', interceptor: 'a1' })
  const incomplete = changeCapture(intercepted, { ...intercepted.capture, detail: { ...intercepted.capture.detail, result: 'incomplete' } }, workspace.participants)
  assert.deepEqual(incomplete.roles, { passer: 'h1', intended_receiver: 'h2' })
  const completed = changeCapture(intercepted, { ...intercepted.capture, detail: { ...intercepted.capture.detail, result: 'completed' } }, workspace.participants)
  assert.deepEqual(completed.roles, { passer: 'h1' })
  const next = changeCapture({ ...completed, roles: { passer: 'h1', receiver: 'h2' } }, intercepted.capture, workspace.participants)
  assert.deepEqual(next.roles, { passer: 'h1' })
})
test('team change drops incompatible roles; event type change discards old details, roles and coordinates', () => {
  const state = form('pass', { result: 'intercepted', end_x: 0, end_y: 0 }, { passer: 'h1', interceptor: 'a1' })
  assert.deepEqual(pruneRoles(state.capture, state.roles, 'away', workspace.participants), {})
  const next = changeCapture({ ...state, x: 0, y: 0 }, defaultCapture('duel'), workspace.participants)
  assert.deepEqual(next.roles, {}); assert.deepEqual(next.capture.detail, { duel_type: null })
  assert.equal(next.x, null); assert.equal(next.y, null)
})
test('shot result change preserves protection of secondary roles', () => {
  for (const [result, role, id] of [['point', 'assister', 'h2'], ['saved', 'goalkeeper', 'a1'], ['blocked', 'blocker', 'a1']]) {
    const state = form('shot', { result }, { shooter: 'h1', [role]: id })
    const next = changeCapture(state, { ...state.capture, detail: { ...state.capture.detail, result: 'wide' } }, workspace.participants)
    assert.deepEqual(next.roles, { shooter: 'h1' })
  }
})
for (const [type, detail, roles] of [
  ['duel', { duel_type: 'aerial' }, { duel_winner: 'h1', duel_loser: 'a1' }],
  ['dribble', { result: 'successful' }, { dribbler: 'h1', defender: 'a1' }],
  ['dribble', { result: 'failed' }, { dribbler: 'h1', defender: 'a1' }],
  ['restart', { restart_type: 'sideline' }, { restart_taker: 'h1' }],
  ['substitution', {}, { player_out: 'h1', player_in: 'h2' }],
  ['goalkeeper_change', {}, { goalkeeper_out: 'h1', goalkeeper_in: 'h2' }],
]) {
  test(`${type} accepts existing DB detail and role teams`, () => {
    const snapshot = JSON.stringify(workspace.participants)
    const input = buildCaptureInput(form(type, detail, roles), workspace)
    assert.deepEqual(input.participants.map((p) => p.participantId), Object.values(roles))
    assert.equal(JSON.stringify(workspace.participants), snapshot)
  })
}
for (const [type, detail, roles] of [
  ['pass', { result: 'intercepted' }, { interceptor: 'h1' }],
  ['duel', {}, { duel_winner: 'a1' }], ['duel', {}, { duel_loser: 'h1' }],
  ['dribble', {}, { defender: 'h1' }], ['dribble', {}, { dribbler: 'a1' }],
  ['substitution', {}, { player_in: 'a1' }], ['goalkeeper_change', {}, { goalkeeper_out: 'a1' }],
]) {
  test(`${type} rejects participant from wrong team: ${Object.keys(roles)[0]}`, () => assert.throws(() => buildCaptureInput(form(type, detail, roles), workspace), /participante/))
}
test('a participant removed between render and submit cannot be sent', () => {
  const state = form('pass', { result: 'completed' }, { receiver: 'h2' })
  assert.throws(() => buildCaptureInput(state, { ...workspace, participants: [workspace.participants[0]] }), /dispoñible/)
})
test('replacement participants must differ; either participant alone is allowed', () => {
  for (const [type, out, into] of [['substitution', 'player_out', 'player_in'], ['goalkeeper_change', 'goalkeeper_out', 'goalkeeper_in']]) {
    assert.throws(() => buildCaptureInput(form(type, {}, { [out]: 'h1', [into]: 'h1' }), workspace), /distintos/)
    assert.equal(buildCaptureInput(form(type, {}, { [out]: 'h1' }), workspace).participants.length, 1)
    assert.equal(buildCaptureInput(form(type, {}, { [into]: 'h2' }), workspace).participants.length, 1)
  }
})
for (const type of ['pass']) {
  test(`${type} origin and destination (0,0) remain raw; half pairs are rejected`, () => {
    const state = form(type)
    state.x = state.y = 0; state.capture = withDestination(state.capture, 0, 0)
    const input = buildCaptureInput(state, workspace)
    assert.equal(input.x, 0); assert.equal(input.y, 0)
    assert.equal(input.detail.end_x, 0); assert.equal(input.detail.end_y, 0)
    assert.throws(() => buildCaptureInput({ ...state, x: null }, workspace), /posición/)
    assert.throws(() => buildCaptureInput({ ...state, capture: withDestination(state.capture, 0, null) }, workspace), /destino/)
  })
}
test('completed analyses reject every canonical type; integer DB bounds remain enforced', () => {
  for (const type of ['pass', 'duel', 'dribble', 'restart', 'substitution', 'goalkeeper_change']) {
    assert.throws(() => buildCaptureInput(form(type), { ...workspace, status: 'completed' }), /Reabre/)
  }
  assert.throws(() => buildCaptureInput({ ...form('pass'), clock: '2147483648' }, workspace), /tempo/)
})
test('timeline summaries include typed details and known historical replacements only', () => {
  assert.equal(getEventResultLabel({ eventType: 'pass', passResult: 'completed', passTechnique: 'foot' }), 'Completado · Pé')
  assert.equal(getEventResultLabel({ eventType: 'duel', duelType: 'aerial' }), 'Aéreo')
  assert.equal(getEventResultLabel({ eventType: 'dribble', dribbleResult: 'successful' }), 'Completado')
  assert.equal(getEventResultLabel({ eventType: 'restart', restartType: 'sideline' }), 'Banda')
  assert.equal(getEventResultLabel({ eventType: 'substitution', participants: [{ role: 'player_out', number: 8 }, { role: 'player_in', number: 12 }] }), '#8 → #12')
  assert.equal(getEventResultLabel({ eventType: 'goalkeeper_change', participants: [{ role: 'goalkeeper_out', number: 1 }] }), '#1 → Sen identificar')
})
test('role definitions stay distinct for blocked shot versus standalone block', () => {
  assert.equal(participantRoles({ ...defaultCapture('shot'), detail: { result: 'blocked' } }).find((r) => r.role === 'blocker').team, 'opponent')
  assert.equal(participantRoles(defaultCapture('block')).find((r) => r.role === 'blocker').team, 'same')
})

test('kickout creation and editing ignore origin and keeps destination zero, without changing stored enum values', () => {
  const state = { ...form('kickout'), x: 99, y: null }
  state.capture = withDestination(state.capture, 0, 0)
  const input = buildCaptureInput(state, workspace)
  assert.equal(input.x, null); assert.equal(input.y, null)
  assert.deepEqual(input.detail, { length: 'short', result: null, end_x: 0, end_y: 0 })
  const previouslyStored={...state,x:25,y:50}
  assert.equal(buildCaptureInput(previouslyStored,workspace).x,null)
  assert.equal(buildCaptureInput(previouslyStored,workspace).y,null)
  assert.throws(()=>buildCaptureInput({...state,capture:withDestination(state.capture,0,null)},workspace),/destino/)
})
