import { useEffect, useRef } from 'react'
import type { AnalysisVideo } from '../../domain/analysis'
import { buildYouTubeEmbedUrl, type VideoNavigationRequest } from '../../domain/video-navigation'
import { DirectVideoPlayer } from './DirectVideoPlayer'

type Props = { videos: AnalysisVideo[]; request: VideoNavigationRequest | null; onSelect: (videoId: string) => void; focusOnRequest: boolean }
export function TaggingVideoPanel({ videos, request, onSelect, focusOnRequest }: Props) {
  const panel = useRef<HTMLElement>(null)
  useEffect(() => {
    if (!focusOnRequest) return
    panel.current?.scrollIntoView({ block: 'nearest' })
    panel.current?.focus({ preventScroll: true })
  }, [request?.requestId, focusOnRequest])
  const embed = request?.kind === 'youtube' ? buildYouTubeEmbedUrl(request.url, request.second) : null
  return <aside ref={panel} tabIndex={-1} className="tagging-video-panel" id="tagging-video-panel" aria-label="Vídeo durante o tagging">
    <h2>Vídeo do partido</h2>
    {videos.length === 0 ? <p>Engade unha fonte en «Vídeo e sincronización».</p> : <label className="video-source-select"><span>Fonte de vídeo</span>
      <select value={request?.videoId ?? ''} onChange={(event) => onSelect(event.target.value)}>
        {!request ? <option value="">Escolle un vídeo</option> : null}
        {videos.map((video, index) => <option key={video.id} value={video.id}>{video.title || `Vídeo ${index + 1}`}</option>)}
      </select></label>}
    {request?.kind === 'direct' ? <DirectVideoPlayer key={`${request.videoId}:${request.url}`} request={request} /> : null}
    {embed && request ? <iframe className="youtube-player" key={`${request.videoId}:${request.requestId}`} src={embed}
      title={`Vídeo: ${request.title}`} allow="fullscreen; picture-in-picture; encrypted-media" allowFullScreen
      referrerPolicy="strict-origin-when-cross-origin" /> : null}
    {request?.kind === 'external' ? <p>Esta fonte ábrese no provedor. O salto ao instante exacto non está dispoñible.</p> : null}
    {request ? <a className="text-link" href={request.url} target="_blank" rel="noreferrer">Abrir no provedor</a> : null}
    {request?.kind !== 'external' ? <p className="form-hint">Os instantes da timeline levan á xogada segundo os puntos de sincronización.</p> : null}
  </aside>
}
