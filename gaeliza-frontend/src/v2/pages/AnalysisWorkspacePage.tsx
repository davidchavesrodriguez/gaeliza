import { useParams } from 'react-router-dom'

export function AnalysisWorkspacePage() {
  const { analysisId } = useParams<{ analysisId: string }>()

  return (
    <div className="page-stack">
      <section className="page-heading page-heading-narrow">
        <div>
          <span className="eyebrow">Espazo de análise</span>
          <h1>Partido listo para traballar.</h1>
          <p>
            Este route será o contedor estable para vídeo, timeline, campo,
            eventos, posesións e resumo. O identificador nunca se deriva do
            xogador ou do partido: todo pivota sobre o análise.
          </p>
        </div>
      </section>

      <section className="state-card">
        <span className="eyebrow">Analysis ID</span>
        <code className="code-block">{analysisId ?? '—'}</code>
      </section>
    </div>
  )
}
