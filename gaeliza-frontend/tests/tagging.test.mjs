import assert from 'node:assert/strict'
import test from 'node:test'
import { formatAnalysisClock, parseAnalysisClock } from '../src/v2/domain/analysis.ts'
import { mapPeriodSecondToVideoSecond } from '../src/v2/domain/tagging.ts'

for (const [clock, seconds] of [
  ['0', 0], ['0:00', 0], ['12:34', 754], ['72:30', 4350],
  ['1:02:03.125', 3723.125], [' 2:05.250 ', 125.25], ['0:00.001', 0.001],
]) {
  test(`parse clock ${clock}`, () => assert.equal(parseAnalysisClock(clock), seconds))
}
for (const clock of ['', ':', '1:', '1::3', '1:2:3:4', '-1', '+2', 'Infinity',
  'NaN', '0x10', '1e3', '1: 2', '1.5:20', '1:60', '1:60:00', '0:0:60',
  '1:02.3.4', '1e309', '999999999999999999999']) {
  test(`reject invalid clock ${clock}`, () => assert.equal(parseAnalysisClock(clock), null))
}
test('integer event times reject fractions but accept zero', () => {
  assert.equal(parseAnalysisClock('0:00', { integer: true }), 0)
  assert.equal(parseAnalysisClock('1:02.5', { integer: true }), null)
})
for (const [seconds, clock] of [
  [0, '0:00'], [0.5, '0:00.5'], [5.125, '0:05.125'], [65.25, '1:05.25'],
  [3599.9996, '1:00:00'], [3723.125, '1:02:03.125'], [Number.MAX_VALUE, '—'], [NaN, '—'], [-1, '—'], [Infinity, '—'],
]) {
  test(`format clock ${seconds}`, () => assert.equal(formatAnalysisClock(seconds), clock))
}
test('millisecond clock round trips including fractional seconds below ten', () => {
  for (const seconds of [0, 0.001, 1.005, 59.999, 60, 3600, 3723.125]) {
    assert.equal(parseAnalysisClock(formatAnalysisClock(seconds)), seconds)
  }
})
const anchor = (secondInPeriod, videoSecond, overrides = {}) => ({
  id: `${secondInPeriod}`, videoId: 'video', periodId: 'period',
  secondInPeriod, videoSecond, ...overrides,
})
const map = (points, second) => mapPeriodSecondToVideoSecond(points, 'video', 'period', second)
test('no sync and anchors for a different video/period return null', () => {
  assert.equal(map([], 0), null)
  assert.equal(map([anchor(0, 0, { videoId: 'other' })], 0), null)
  assert.equal(map([anchor(0, 0, { periodId: 'other' })], 0), null)
})
test('exact synchronization includes zero in both clocks', () => {
  assert.equal(map([anchor(0, 0)], 0), 0)
  assert.equal(map([anchor(0, 12.25)], 0), 12.25)
})
test('interpolates sorted anchors without mutating their input', () => {
  const points = [anchor(100, 160), anchor(0, 10)]
  assert.equal(map(points, 50), 85)
  assert.equal(points[0].secondInPeriod, 100)
})
test('outside known anchors uses nearest offset at normal speed', () => {
  assert.equal(map([anchor(10, 20)], 5), 15)
  assert.equal(map([anchor(10, 20)], 15), 25)
  assert.equal(map([anchor(10, 2)], 0), null) // never clamp an impossible time to zero
})
test('invalid, ambiguous or reversed anchors never produce a timestamp', () => {
  for (const points of [
    [anchor(0, 0), anchor(0, 5)], [anchor(0, 10), anchor(10, 5)],
    [anchor(0, 10), anchor(10, 10)], [anchor(0, NaN)], [anchor(-1, 0)],
  ]) assert.equal(map(points, 5), null)
  assert.equal(map([anchor(0, 0)], NaN), null)
  assert.equal(map([anchor(0, 0)], -1), null)
})
