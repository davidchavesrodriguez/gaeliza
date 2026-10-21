const steps = [
  {
    number: '01',
    title: 'Partido',
    text: 'Escolle un encontro oficial ou crea un partido persoal.',
  },
  {
    number: '02',
    title: 'Convocatoria',
    text: 'Prepara xogadores persistentes e rivais temporais.',
  },
  {
    number: '03',
    title: 'Modo',
    text: 'Vídeo post-partido ou captura rápida en directo.',
  },
]

export function CreateAnalysisPage() {
  return (
    <div className="page-stack">
      <section className="page-heading page-heading-narrow">
        <div>
          <span className="eyebrow">Novo análise</span>
          <h1>Prepara o partido antes de empezar a etiquetar.</h1>
          <p>
            Esta base xa separa a preparación do tagging: primeiro definimos que
            partido e que xogadores estamos analizando; despois entramos no fluxo
            de vídeo ou directo.
          </p>
        </div>
      </section>

      <ol className="flow-steps">
        {steps.map((step, index) => (
          <li className={index === 0 ? 'flow-step flow-step-active' : 'flow-step'} key={step.number}>
            <span className="flow-step-number">{step.number}</span>
            <div>
              <strong>{step.title}</strong>
              <p>{step.text}</p>
            </div>
          </li>
        ))}
      </ol>

      <section className="state-card setup-card">
        <span className="eyebrow">Paso 1 · Partido</span>
        <h2>Calendario conectado no seguinte slice</h2>
        <p>
          A infraestrutura de sesión e routing xa está activa. A seguinte
          implementación cargará partidos oficiais e persoais desde Supabase e
          chamará a <code>create_analysis()</code> cando confirmes o encontro.
        </p>
      </section>
    </div>
  )
}
