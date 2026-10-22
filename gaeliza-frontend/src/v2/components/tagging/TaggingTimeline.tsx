import type { AnalysisWorkspace } from '../../domain/analysis'
import type { AnalysisEventSummary } from '../../domain/tagging'
import type { VideoNavigationInput } from '../../domain/video-navigation'
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
  onSeek: (request: VideoNavigationInput) => void
}
export function TaggingTimeline({ workspace, events, loadingEvents, disabled, onDelete, onEdit, onRebuild, onSeek }: Props) {
  return <aside className="state-card tagging-timeline-card">
    <div className="section-heading-inline"><div><h2>Eventos rexistrados</h2></div><span className="badge">{events.length}</span></div>
    {loadingEvents ? <div className="timeline-loading"><div className="spinner" aria-hidden="true" /><span>Cargando eventos…</span></div> : null}
    {!loadingEvents && events.length === 0 ? <div className="empty-state compact-empty-state"><strong>Aínda non hai eventos.</strong><p>Co primeiro evento, a análise pasará de borrador a en curso.</p></div> : null}
    {!loadingEvents && events.length > 0 ? <div className="tagging-timeline-list">
      {events.map((event) => <TimelineEventRow key={event.id} workspace={workspace} event={event} disabled={disabled}
        onDelete={onDelete} onEdit={onEdit} onSeek={onSeek} />)}
    </div> : null}
    <PossessionControls disabled={disabled || events.length === 0} onRebuild={onRebuild} />
  </aside>
}
