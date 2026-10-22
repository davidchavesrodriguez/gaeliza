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


export function TaggingScoreboard({ workspace, events, loading = false, unavailable = false }: {
  workspace: AnalysisWorkspace; events: AnalysisEventSummary[]; loading?: boolean; unavailable?: boolean
}) {
  const homeScore = scoreForTeam(events, workspace.homeTeam.id)
  const awayScore = scoreForTeam(events, workspace.awayTeam.id)
  const ready = !loading && !unavailable
  return <section className="tagging-scoreboard" aria-label="Contexto do partido">
    <h1 className="tagging-match-title">
      <span className="tagging-match-home">{workspace.homeTeam.shortName ?? workspace.homeTeam.name}</span>
      <span className="tagging-match-score" aria-label="Marcador analítico">
        <span><strong>{ready ? `${homeScore.goals}-${String(homeScore.points).padStart(2, '0')}` : '—'}</strong>
          <small>{ready ? `${homeScore.total} pts` : '—'}</small></span>
        <span className="tagging-score-separator" aria-hidden="true">—</span>
        <span><strong>{ready ? `${awayScore.goals}-${String(awayScore.points).padStart(2, '0')}` : '—'}</strong>
          <small>{ready ? `${awayScore.total} pts` : '—'}</small></span>
      </span>
      <span className="tagging-match-away">{workspace.awayTeam.shortName ?? workspace.awayTeam.name}</span>
    </h1>
    <p className="tagging-score-caption">Marcador analítico · {loading ? 'Cargando eventos…' : unavailable ? 'Eventos non dispoñibles' : `${events.length} ${events.length === 1 ? 'evento' : 'eventos'}`}</p>
  </section>
}
