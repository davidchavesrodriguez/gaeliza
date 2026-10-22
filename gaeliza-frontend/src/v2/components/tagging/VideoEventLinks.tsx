import { formatAnalysisClock, type AnalysisWorkspace } from '../../domain/analysis'
import { mapPeriodSecondToVideoSecond, type AnalysisEventSummary } from '../../domain/tagging'
import { buildVideoSeekTarget } from '../../domain/video-navigation'
import type { DirectVideoRequest } from './DirectVideoPlayer'

type Props = { workspace: AnalysisWorkspace; event: AnalysisEventSummary; onSeek: (request: Omit<DirectVideoRequest, 'requestId'>) => void }
export function VideoEventLinks({ workspace, event, onSeek }: Props) {
  return <div className="timeline-video-times">
    {workspace.videos.map((video) => {
      const second = mapPeriodSecondToVideoSecond(workspace.syncPoints, video.id, event.periodId, event.secondInPeriod)
      if (second === null) return null
      const target = buildVideoSeekTarget(video.url, second, video.durationSeconds)
      const label = `${video.title || 'Vídeo'} · ${formatAnalysisClock(second)}`
      if (!target) return <span key={video.id}>{label} · URL ou instante non dispoñible</span>
      if (target.kind === 'direct') return <button key={video.id} className="button button-secondary" type="button"
        onClick={() => onSeek({ videoId: video.id, title: video.title || 'Vídeo', url: target.url, second })}>Ir ao vídeo: {label}</button>
      return <a key={video.id} href={target.url} target="_blank" rel="noreferrer">
        {target.kind === 'youtube' ? `Ir ao vídeo: ${label}` : `Abrir orixinal: ${label} (salto exacto non dispoñible)`}
      </a>
    })}
  </div>
}
