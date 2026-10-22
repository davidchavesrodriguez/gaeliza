import { formatAnalysisClock, type AnalysisWorkspace } from '../../domain/analysis'
import { getEventResultLabel, eventTypeLabel, type AnalysisEventSummary } from '../../domain/tagging'
import type { VideoNavigationInput } from '../../domain/video-navigation'
import { VideoEventLinks } from './VideoEventLinks'

type Props = {
  workspace: AnalysisWorkspace; event: AnalysisEventSummary; disabled: boolean
  onDelete: (id: string) => Promise<void>; onEdit: (id: string) => void
  onSeek: (request: VideoNavigationInput) => void
}
export function TimelineEventRow({ workspace, event, disabled, onDelete, onEdit, onSeek }: Props) {
  const team = event.teamId === workspace.homeTeam.id ? workspace.homeTeam : workspace.awayTeam
  return <article className="timeline-event">
    <div className="timeline-event-time"><strong>{formatAnalysisClock(event.secondInPeriod)}</strong><small>Parte {event.periodNumber}</small></div>
    <div className="timeline-event-main">
      <div><strong>{eventTypeLabel(event.eventType)}</strong><span>{team.shortName ?? team.name} · {getEventResultLabel(event)}</span></div>
      {event.eventType === 'card' ? <span className="timeline-recipient">{event.participants.find((p) => p.role === 'card_recipient')?.displayName ?? 'Sancionado sen identificar'}</span> : null}
      <VideoEventLinks workspace={workspace} event={event} onSeek={onSeek} />
    </div>
    <div className="timeline-event-actions">
      <button className="participant-remove" type="button" disabled={disabled} onClick={() => onEdit(event.id)}>Editar</button>
      <button className="participant-remove" type="button" disabled={disabled} onClick={() => { void onDelete(event.id) }}>Quitar</button>
    </div>
  </article>
}
