import { formatAnalysisClock, type AnalysisWorkspace } from '../../domain/analysis'
import { getEventResultLabel, eventTypeLabel, type AnalysisEventSummary } from '../../domain/tagging'
import type { VideoNavigationInput } from '../../domain/video-navigation'
import { VideoEventLinks } from './VideoEventLinks'

const primaryRoles: Record<string, string> = {
  shot: 'shooter', pass: 'passer', recovery: 'recoverer', turnover: 'turnover_player',
  foul: 'offender', card: 'card_recipient', kickout: 'kicker', block: 'blocker',
  duel: 'duel_winner', dribble: 'dribbler', restart: 'restart_taker',
  substitution: 'player_out', goalkeeper_change: 'goalkeeper_out',
}
type Props = {
  workspace: AnalysisWorkspace; event: AnalysisEventSummary; disabled: boolean
  active?: boolean; relatedFoul?: AnalysisEventSummary
  onDelete: (id: string) => Promise<void>; onEdit: (id: string) => void
  onSeek: (request: VideoNavigationInput) => void
}
export function TimelineEventRow({ workspace, event, disabled, active, relatedFoul, onDelete, onEdit, onSeek }: Props) {
  const team = event.teamId === workspace.homeTeam.id ? workspace.homeTeam : workspace.awayTeam
  const result = getEventResultLabel(event)
  const resultAddsInformation = result.toLocaleLowerCase() !== eventTypeLabel(event.eventType).toLocaleLowerCase()
  const protagonist = event.participants.find((p) => p.role === primaryRoles[event.eventType])
  return <article className={`timeline-event${active ? ' timeline-event-active' : ''}`} aria-current={active ? 'true' : undefined}>
    <div className="timeline-event-time"><strong>{formatAnalysisClock(event.secondInPeriod)}</strong><small>Parte {event.periodNumber}</small></div>
    <div className="timeline-event-main">
      <div className="timeline-event-summary"><strong>{eventTypeLabel(event.eventType)}</strong>
        <span>{team.shortName ?? team.name}</span>
        {protagonist ? <span className="timeline-protagonist">{protagonist.number !== null ? `#${protagonist.number} ` : ''}{protagonist.displayName}</span> : event.eventType === 'card' ? <span>Sancionado sen identificar</span> : null}
        {resultAddsInformation ? <span className="timeline-result">{result}</span> : null}
        {active ? <span className="timeline-editing-label">En edición</span> : null}
      </div>
      {relatedFoul ? <p className="timeline-relation">Vinculada á falta de {formatAnalysisClock(relatedFoul.secondInPeriod)} · Parte {relatedFoul.periodNumber}</p> : null}
      <VideoEventLinks workspace={workspace} event={event} onSeek={onSeek} />
    </div>
    <div className="timeline-event-actions">
      <button className="participant-remove" type="button" disabled={disabled} onClick={() => onEdit(event.id)}>Editar</button>
      <button className="participant-remove" type="button" disabled={disabled} onClick={() => { void onDelete(event.id) }}>Quitar</button>
    </div>
  </article>
}
