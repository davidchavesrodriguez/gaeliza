import { useEffect, useRef, useState } from 'react'
import { validVideoSecond } from '../../domain/video-navigation'

export type DirectVideoRequest = { videoId: string; title: string; url: string; second: number; requestId: number }

// The parent keys by video ID and URL: callbacks from an old resource cannot
// seek a newly selected video. Repeated requests keep the newest pending time.
export function DirectVideoPlayer({ request }: { request: DirectVideoRequest }) {
  const element = useRef<HTMLVideoElement>(null)
  const latest = useRef(request.second)
  const [error, setError] = useState<string | null>(null)
  function seek(video: HTMLVideoElement, second: number) {
    if (!validVideoSecond(second, Number.isFinite(video.duration) ? video.duration : null)) {
      setError('O instante queda fóra da duración do vídeo.')
      return
    }
    try { video.currentTime = second; setError(null) }
    catch { setError('Non foi posible navegar a ese instante.') }
  }
  useEffect(() => {
    latest.current = request.second
    const video = element.current
    if (video && video.readyState >= 1) seek(video, request.second)
  }, [request.second, request.requestId])
  return <section className="state-card" aria-label="Reprodutor de vídeo">
    <strong>{request.title}</strong>
    <video ref={element} src={request.url} controls preload="metadata" style={{ width: '100%' }}
      onLoadedMetadata={(event) => seek(event.currentTarget, latest.current)}
      onError={() => setError('Non foi posible cargar o vídeo. Comproba a URL e os permisos do provedor.')} />
    {error ? <p role="alert">{error}</p> : null}
  </section>
}
