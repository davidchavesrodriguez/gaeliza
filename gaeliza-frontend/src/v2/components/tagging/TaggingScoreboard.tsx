import type { AnalysisWorkspace } from '../../domain/analysis'
import type { AnalysisEventSummary } from '../../domain/tagging'

function scoreForTeam(events: AnalysisEventSummary[], teamId: string) {
  let goals = 0
  let points = 0

  for (const event of events) {
    if (event.teamId !== teamId || event.eventType !== 'shot') {
      continue
    }

    if (event.shotResult === 'goal') {
      goals += 1
    } else if (event.shotResult === 'point') {
      points += 1
    }
  }

  return { goals, points, total: goals * 3 + points }
}


export function TaggingScoreboard({ workspace, events }: { workspace: AnalysisWorkspace; events: AnalysisEventSummary[] }) {
  const homeScore = scoreForTeam(events, workspace.homeTeam.id)
  const awayScore = scoreForTeam(events, workspace.awayTeam.id)
  return (
      <section className="tagging-scoreboard">
        <div className="tagging-score-team">
          <span>{workspace.homeTeam.shortName ?? workspace.homeTeam.name}</span>
          <strong>
            {homeScore.goals}-{String(homeScore.points).padStart(2, '0')}
          </strong>
          <small>{homeScore.total} pts</small>
        </div>
        <div className="tagging-score-center">
          <span className="eyebrow">Marcador analítico</span>
          <strong>{events.length} eventos</strong>
        </div>
        <div className="tagging-score-team tagging-score-away">
          <span>{workspace.awayTeam.shortName ?? workspace.awayTeam.name}</span>
          <strong>
            {awayScore.goals}-{String(awayScore.points).padStart(2, '0')}
          </strong>
          <small>{awayScore.total} pts</small>
        </div>
      </section>

  )
}
