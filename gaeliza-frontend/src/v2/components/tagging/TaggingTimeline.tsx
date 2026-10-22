import { useState } from 'react'
import type { AnalysisWorkspace } from '../../domain/analysis'
import type { AnalysisEventSummary } from '../../domain/tagging'
import { DirectVideoPlayer, type DirectVideoRequest } from './DirectVideoPlayer'
import { TimelineEventRow } from './TimelineEventRow'
import { PossessionControls } from './PossessionControls'

type Props = {
  workspace: AnalysisWorkspace
  events: AnalysisEventSummary[]
  loadingEvents: boolean
  disabled: boolean
  onDelete: (id: string) => Promise<void>
  onEdit: (id: string) => void
  onRebuild: () => Promise<void>
}
export function TaggingTimeline({ workspace, events, loadingEvents, disabled, onDelete, onEdit, onRebuild }: Props) {
  const [video, setVideo] = useState<DirectVideoRequest | null>(null)
  return <aside className="state-card tagging-timeline-card">
    <div className="section-heading-inline"><div><span className="eyebrow">Timeline</span><h2>Eventos rexistrados</h2></div><span className="badge">{events.length}</span></div>
    {video ? <DirectVideoPlayer key={`${video.videoId}:${video.url}`} request={video} /> : null}
    {loadingEvents ? <div className="timeline-loading"><div className="spinner" aria-hidden="true" /><span>Cargando eventos…</span></div> : null}
    {!loadingEvents && events.length === 0 ? <div className="empty-state compact-empty-state"><strong>Aínda non hai eventos.</strong><p>O primeiro evento moverá o análise de borrador a en progreso.</p></div> : null}
    {!loadingEvents && events.length > 0 ? <div className="tagging-timeline-list">
      {events.map((event) => <TimelineEventRow key={event.id} workspace={workspace} event={event} disabled={disabled}
        onDelete={onDelete} onEdit={onEdit} onSeek={(request) => setVideo((current) => ({ ...request, requestId: (current?.requestId ?? 0) + 1 }))} />)}
    </div> : null}
    <PossessionControls disabled={disabled || events.length === 0} onRebuild={onRebuild} />
  </aside>
}
