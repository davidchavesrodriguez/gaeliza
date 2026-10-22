import assert from 'node:assert/strict'
import test from 'node:test'
import { detectVideoProvider, buildVideoSeekTarget, validVideoSecond } from '../src/v2/domain/video-navigation.ts'
const id = 'dQw4w9WgXcQ'
for (const source of [`https://youtube.com/watch?v=${id}`, `https://youtu.be/${id}`, `https://www.youtube.com/embed/${id}`]) {
  test(`YouTube seeks safely: ${source}`, () => {
    const target = buildVideoSeekTarget(source, 12.8)
    assert.equal(target.kind, 'youtube')
    const url = new URL(target.url)
    assert.equal(url.searchParams.get('v'), id); assert.equal(url.searchParams.get('t'), '12')
  })
}
test('YouTube preserves existing query parameters and replaces conflicting timestamps', () => {
  const url = new URL(buildVideoSeekTarget(`https://youtu.be/${id}?list=playlist&t=99&start=100#t=200`, 0).url)
  assert.equal(url.searchParams.get('list'), 'playlist'); assert.equal(url.searchParams.get('t'), '0')
  assert.equal(url.searchParams.has('start'), false); assert.equal(url.hash, '')
})
test('generic URLs preserve original parameters and do not invent seek', () => {
  const source = 'https://example.test/watch?token=abc#chapter'
  assert.deepEqual(buildVideoSeekTarget(source, 12), { kind: 'external', url: source, second: 12 })
  assert.equal(detectVideoProvider(`https://youtube.com.evil.test/watch?v=${id}`), 'external')
  assert.equal(detectVideoProvider('https://youtube.com/watch?v=invalid'), 'external')
})
test('only http(s) without embedded credentials can navigate', () => {
  for (const source of ['javascript:alert(1)', 'data:video/mp4,a', 'file:///a.mp4', '/a.mp4', 'https://user:secret@example.test/a.mp4', 'bad-url']) {
    assert.equal(detectVideoProvider(source), null); assert.equal(buildVideoSeekTarget(source, 2), null)
  }
})
test('direct MP4, WebM and Ogg URLs keep signed query parameters', () => {
  for (const ext of ['mp4', 'WEBM', 'ogg']) {
    const source = `https://cdn.test/video.${ext}?signature=abc`
    assert.equal(detectVideoProvider(source), 'direct'); assert.equal(buildVideoSeekTarget(source, 0).url, source)
  }
  assert.equal(detectVideoProvider('https://cdn.test/page?file=video.mp4'), 'external')
})
test('invalid and out-of-duration seeks have no action; zero and final second remain valid', () => {
  for (const second of [-1, NaN, Infinity, 101]) assert.equal(buildVideoSeekTarget('https://cdn.test/a.mp4', second, 100), null)
  assert.equal(validVideoSecond(0, 0), true); assert.equal(validVideoSecond(100, 100), true)
  assert.equal(validVideoSecond(100, null), true); assert.equal(validVideoSecond(0, NaN), false)
})
