export type VideoSeekTarget = {
  kind: 'youtube' | 'direct' | 'external'
  url: string
  second: number
}

function safeUrl(value: string): URL | null {
  try {
    const url = new URL(value)
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return null
    return url
  } catch { return null }
}

function youtubeId(url: URL): string | null {
  let id: string | null = null
  if (['youtube.com', 'www.youtube.com', 'm.youtube.com'].includes(url.hostname)) {
    if (url.pathname === '/watch') id = url.searchParams.get('v')
    else if (url.pathname.startsWith('/embed/')) id = url.pathname.split('/')[2]
  } else if (url.hostname === 'youtu.be') id = url.pathname.slice(1)
  return id && /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null
}

export function detectVideoProvider(value: string): VideoSeekTarget['kind'] | null {
  const url = safeUrl(value)
  if (!url) return null
  if (youtubeId(url)) return 'youtube'
  return /\.(mp4|webm|ogg)$/i.test(url.pathname) ? 'direct' : 'external'
}

export function validVideoSecond(second: number, duration: number | null = null): boolean {
  return Number.isFinite(second) && second >= 0 &&
    (duration === null || (Number.isFinite(duration) && duration >= 0 && second <= duration))
}

export function buildVideoSeekTarget(value: string, second: number, duration: number | null = null): VideoSeekTarget | null {
  const source = safeUrl(value)
  const kind = detectVideoProvider(value)
  if (!source || !kind || !validVideoSecond(second, duration)) return null
  if (kind !== 'youtube') return { kind, url: source.href, second }
  const id = youtubeId(source)
  if (!id) return null
  const target = new URL('https://www.youtube.com/watch')
  target.search = source.search
  target.searchParams.set('v', id)
  target.searchParams.delete('start')
  target.searchParams.set('t', String(Math.floor(second)))
  return { kind, url: target.href, second }
}
