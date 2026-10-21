import { formatAnalysisClock, type AnalysisWorkspace } from '../../domain/analysis'
import { getEventResultLabel, mapPeriodSecondToVideoSecond, quickEventLabels, type AnalysisEventSummary, type QuickEventType } from '../../domain/tagging'
import { PossessionControls } from './PossessionControls'

function eventTypeLabel(event: AnalysisEventSummary) {
  if (event.eventType in quickEventLabels) {
    return quickEventLabels[event.eventType as QuickEventType]
  }

  return event.eventType
}

function buildVideoLabel(video: AnalysisWorkspace['videos'][number]) {
  if (video.title) {
    return video.title
  }

  try {
    return new URL(video.url).hostname
  } catch {
    return 'Vídeo'
  }
}

type Props = {
  workspace: AnalysisWorkspace
  events: AnalysisEventSummary[]
  loadingEvents: boolean
  disabled: boolean
  onDelete: (id: string) => Promise<void>
  onRebuild: () => Promise<void>
}
export function TaggingTimeline({ workspace, events, loadingEvents, disabled, onDelete, onRebuild }: Props) {
  return (
        <aside className="state-card tagging-timeline-card">
          <div className="section-heading-inline">
            <div>
              <span className="eyebrow">Timeline</span>
              <h2>Eventos rexistrados</h2>
            </div>
            <span className="badge">{events.length}</span>
          </div>

          {loadingEvents ? (
            <div className="timeline-loading">
              <div className="spinner" aria-hidden="true" />
              <span>Cargando eventos…</span>
            </div>
          ) : events.length === 0 ? (
            <div className="empty-state compact-empty-state">
              <strong>Aínda non hai eventos.</strong>
              <p>O primeiro evento moverá o análise de borrador a en progreso.</p>
            </div>
          ) : (
            <div className="tagging-timeline-list">
              {events.map((timelineEvent) => {
                const team =
                  timelineEvent.teamId === workspace.homeTeam.id
                    ? workspace.homeTeam
                    : workspace.awayTeam
                const videoTimes = workspace.videos
                  .map((video) => ({
                    video,
                    second: mapPeriodSecondToVideoSecond(
                      workspace.syncPoints,
                      video.id,
                      timelineEvent.periodId,
                      timelineEvent.secondInPeriod,
                    ),
                  }))
                  .filter(
                    (value): value is { video: (typeof workspace.videos)[number]; second: number } =>
                      value.second !== null,
                  )

                return (
                  <article className="timeline-event" key={timelineEvent.id}>
                    <div className="timeline-event-time">
                      <strong>{formatAnalysisClock(timelineEvent.secondInPeriod)}</strong>
                      <small>Parte {timelineEvent.periodNumber}</small>
                    </div>
                    <div className="timeline-event-main">
                      <div>
                        <strong>{eventTypeLabel(timelineEvent)}</strong>
                        <span>
                          {team.shortName ?? team.name} · {getEventResultLabel(timelineEvent)}
                        </span>
                      </div>
                      {videoTimes.length > 0 ? (
                        <div className="timeline-video-times">
                          {videoTimes.slice(0, 2).map(({ video, second }) => (
                            <span key={video.id}>
                              {buildVideoLabel(video)} · {formatAnalysisClock(second)}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </div>
                    <button
                      className="participant-remove"
                      type="button"
                      disabled={disabled}
                      onClick={() => {
                        void onDelete(timelineEvent.id)
                      }}
                    >
                      Quitar
                    </button>
                  </article>
                )
              })}
            </div>
          )}

          <PossessionControls disabled={disabled || events.length === 0} onRebuild={onRebuild} />
        </aside>
  )
}
