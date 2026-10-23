import { useState } from 'react'
import { timelineGroups } from '../../domain/timeline'
import type { AnalysisWorkspace } from '../../domain/analysis'
import type { AnalysisEventSummary } from '../../domain/tagging'
import type { VideoNavigationInput } from '../../domain/video-navigation'
import { TimelineEventRow } from './TimelineEventRow'
import { PossessionControls } from './PossessionControls'

type Props = {
  unavailable?: boolean
  activeEventId?: string | null
  workspace: AnalysisWorkspace
  events: AnalysisEventSummary[]
  loadingEvents: boolean
  disabled: boolean
  onDelete: (id: string) => Promise<void>
  onEdit: (id: string) => void
  onRebuild: () => Promise<void>
  onSeek: (request: VideoNavigationInput) => void
}
export function TaggingTimeline({ workspace, events, loadingEvents, disabled, onDelete, onEdit, onRebuild, onSeek, activeEventId, unavailable = false }: Props) {
  const [expanded, setExpanded] = useState(false)
  const { groups, hidden } = timelineGroups(events, expanded || workspace.status === 'completed')
  const row = (event: AnalysisEventSummary, relatedFoul?: AnalysisEventSummary) => <TimelineEventRow key={event.id} workspace={workspace} event={event} disabled={disabled} active={event.id === activeEventId} relatedFoul={relatedFoul}
    onDelete={onDelete} onEdit={onEdit} onSeek={onSeek} />
  return <aside className="state-card tagging-timeline-card" aria-label="Eventos rexistrados">
    <div className="section-heading-inline"><div><h2>Eventos rexistrados</h2></div><span className="timeline-count">{unavailable ? 'Pendente de recarga' : `${events.length} ${events.length === 1 ? 'evento' : 'eventos'}`}</span></div>
    {loadingEvents ? <div className="timeline-loading"><div className="spinner" aria-hidden="true" /><span>Cargando eventos…</span></div> : null}
    {!loadingEvents && !unavailable && events.length === 0 ? <p className="timeline-empty"><strong>Aínda non hai eventos.</strong> Rexistra o primeiro cos controis de captura.</p> : null}
    {unavailable ? <p className="timeline-empty">Os eventos non están dispoñibles. Recarga os datos para continuar.</p> : null}
    {hidden > 0 ? <button className="button button-secondary" type="button" onClick={() => setExpanded(true)}>Mostrar {hidden} anteriores</button> : null}
    {expanded && workspace.status !== 'completed' && events.length > 8 ? <button className="button button-secondary" type="button" onClick={() => setExpanded(false)}>Mostrar só os recentes</button> : null}
    {!loadingEvents && events.length > 0 ? <div className="tagging-timeline-list">
      {groups.map(({ event, cards }, index) => <div key={event.id} className="timeline-event-group">
        {index === 0 || groups[index - 1].event.periodId !== event.periodId ? <h3 className="timeline-period">{workspace.periods.find((p) => p.id === event.periodId)?.name ?? `Parte ${event.periodNumber}`}</h3> : null}
        {row(event)}
        {cards.length ? <div className="timeline-linked-cards" aria-label="Tarxetas asociadas á falta">{cards.map((card) => row(card, event))}</div> : null}
      </div>)}
    </div> : null}
    <PossessionControls disabled={disabled || events.length === 0} onRebuild={onRebuild} />
  </aside>
}
