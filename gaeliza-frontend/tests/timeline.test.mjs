import test from 'node:test'
import assert from 'node:assert/strict'
import { timelineGroups } from '../src/v2/domain/timeline.ts'
const event = (id, eventType = 'shot', relatedFoulEventId = null) => ({ id, eventType, relatedFoulEventId })
test('recent facts preserve chronological order and expand without truncating data', () => {
 const events = Array.from({ length: 80 }, (_, i) => event(String(i)))
 const result = timelineGroups(events, false)
 assert.equal(result.hidden, 72)
 assert.deepEqual(result.groups.map(g => g.event.id), events.slice(-8).map(e => e.id))
 assert.equal(timelineGroups(events, true).groups.length, 80)
})
test('linked cards stay with their foul at recent boundary; independent cards stay rows', () => {
 const events = [event('f', 'foul'), event('c', 'card', 'f'), event('s', 'card'), ...Array.from({length:6}, (_,i)=>event(String(i)))]
 const result = timelineGroups(events, false)
 assert.equal(result.hidden, 0)
 assert.deepEqual(result.groups[0].cards.map(e=>e.id), ['c'])
 assert.equal(result.groups[1].event.id, 's')
 assert.equal(result.groups.reduce((n,g)=>n+1+g.cards.length,0), events.length)
})
test('removed relation or absent foul returns card to independent row', () => {
 assert.equal(timelineGroups([event('c','card',null)], true).groups[0].event.id, 'c')
 assert.equal(timelineGroups([event('c','card','missing')], true).groups[0].event.id, 'c')
})
