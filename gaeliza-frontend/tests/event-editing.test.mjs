import assert from 'node:assert/strict'
import test from 'node:test'
import { decodeEventForEditing, compatibleAdditionalParticipants, mergeEditingParticipants, captureFromFact } from '../src/v2/domain/event-editing.ts'
import { changeCapture, buildCaptureInput } from '../src/v2/domain/event-capture.ts'
const fact = { event_id:'event', updated_at:'2026-10-22T00:00:00.123456+00:00', event_type:'pass', team_id:'home', period_id:'period', second_in_period:61, raw_x:0, raw_y:0, pass_result:'completed', pass_technique:'foot', pass_raw_end_x:0, pass_raw_end_y:0 }
const roster = [{id:'h1', teamId:'home'}, {id:'h2', teamId:'home'}, {id:'a1', teamId:'away'}]
const workspace = { id:'analysis', homeTeam:{id:'home'}, awayTeam:{id:'away'}, periods:[{id:'period'}], participants:roster, status:'in_progress' }
test('decode complete pass and build unchanged input preserves zero origin/destination and precise version', () => {
  const event = decodeEventForEditing(fact, [{participantId:'h1',role:'passer'}, {participantId:'h2',role:'receiver'}])
  assert.equal(event.updatedAt, fact.updated_at); assert.equal(event.form.clock, '1:01')
  const input = buildCaptureInput(event.form,workspace)
  assert.equal(input.x,0); assert.equal(input.y,0)
  assert.deepEqual(input.detail,{result:'completed',technique:'foot',end_x:0,end_y:0})
})
test('editing result and team changes prune incompatible roles', () => {
  const {form} = decodeEventForEditing(fact,[{participantId:'h1',role:'passer'},{participantId:'h2',role:'receiver'}])
  const next = changeCapture(form,{eventType:'pass',detail:{...form.capture.detail,result:'intercepted'}},roster)
  assert.equal(next.roles.receiver,undefined); assert.equal(next.roles.passer,'h1')
  const other = changeCapture({...next,teamId:'away'},next.capture,roster)
  assert.deepEqual(other.roles,{})
})
test('all thirteen types decode unknown historical details without creation defaults', () => {
  for (const event_type of ['shot','pass','recovery','turnover','duel','dribble','foul','card','kickout','restart','block','substitution','goalkeeper_change']) {
    const capture = captureFromFact({event_type})
    assert.equal(capture.eventType,event_type)
    assert.ok(Object.values(capture.detail).every((value)=>value===null))
  }
  assert.deepEqual(captureFromFact({event_type:'shot',shot_result:'goal',shot_technique:'foot',shot_situation:'penalty'}).detail,{result:'goal',technique:'foot',situation:'penalty'})
  assert.deepEqual(captureFromFact({event_type:'foul',foul_cause:'trip',foul_outcome:'free'}).detail,{cause:'trip',outcome:'free'})
  assert.throws(()=>captureFromFact({event_type:'shot',shot_result:'future'}),/non recoñecido/)
})
test('hidden roles, duplicate role identities and card relation are retained', () => {
  const rows=[{participantId:'h1',role:'receiver'},{participantId:'h2',role:'receiver'}]
  const event=decodeEventForEditing({...fact,related_foul_event_id:'foul'},rows)
  assert.equal(event.form.roles.receiver,'h1'); assert.deepEqual(event.additionalParticipants,[rows[1]])
  assert.equal(event.relatedFoulEventId,'foul')
  assert.deepEqual(mergeEditingParticipants([rows[0]],event.additionalParticipants,event.form,roster),rows)
  assert.deepEqual(decodeEventForEditing({...fact,event_type:'recovery'},[{participantId:'a1',role:'opponent'}]).additionalParticipants,[{participantId:'a1',role:'opponent'}])
})
test('stale additional identities fail validation and incompatible extra roles prune on explicit draft change', () => {
  const {form}=decodeEventForEditing(fact,[])
  assert.throws(()=>mergeEditingParticipants([],[{participantId:'gone',role:'receiver'}],form,roster),/non é compatible/)
  assert.deepEqual(compatibleAdditionalParticipants([{participantId:'h2',role:'receiver'}],{...form,teamId:'away'},roster),[])
  assert.throws(()=>mergeEditingParticipants([{participantId:'h2',role:'receiver'}],[{participantId:'h2',role:'receiver'}],form,roster),/duplicados/)
  assert.throws(()=>buildCaptureInput({...form,roles:{receiver:'gone'}},workspace),/non está dispoñible/)
  assert.throws(()=>buildCaptureInput(form,{...workspace,status:'completed'}),/Reabre/)
})
