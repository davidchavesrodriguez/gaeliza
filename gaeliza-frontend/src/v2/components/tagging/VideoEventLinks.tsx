import { formatAnalysisClock, type AnalysisWorkspace } from '../../domain/analysis'
import { mapPeriodSecondToVideoSecond, type AnalysisEventSummary } from '../../domain/tagging'
import { buildVideoSeekTarget, type VideoNavigationInput } from '../../domain/video-navigation'

type Props = { workspace: AnalysisWorkspace; event: AnalysisEventSummary; onSeek: (request: VideoNavigationInput) => void }
export function VideoEventLinks({ workspace, event, onSeek }: Props) {
  return <div className="timeline-video-times">
    {workspace.videos.map((video) => {
      const second = mapPeriodSecondToVideoSecond(workspace.syncPoints, video.id, event.periodId, event.secondInPeriod)
      if (second === null) return null
      const target = buildVideoSeekTarget(video.url, second, video.durationSeconds)
      const label = `${video.title || 'Vídeo'} · ${formatAnalysisClock(second)}`
      if (!target) return <span key={video.id}>{label} · URL ou instante non dispoñible</span>
      if (target.kind === 'direct' || target.kind === 'youtube') return <button key={video.id} className="button button-secondary" type="button"
        onClick={() => onSeek({ ...target, videoId: video.id, title: video.title || 'Vídeo' })}>Ir ao vídeo: {label}</button>
      return <a key={video.id} href={target.url} target="_blank" rel="noreferrer">
        {`Abrir orixinal: ${label} (salto exacto non dispoñible)`}
      </a>
    })}
  </div>
}
