import { Link } from 'react-router-dom'

const capabilities = [
  {
    title: 'Rexistra o que pasa',
    text: 'Tiros, pases, perdas, recuperacións, faltas, saques e posesións nun modelo pensado para fútbol gaélico.',
  },
  {
    title: 'Volta ao vídeo',
    text: 'Sincroniza períodos e vídeo para revisar cada acción no seu contexto, non como unha estatística illada.',
  },
  {
    title: 'Atopa patróns',
    text: 'Compara partidos, xogadores e rivais con métricas trazables e conclusións deterministas.',
  },
]

export function LandingPage() {
  return (
    <div className="landing-page">
      <header className="landing-header">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            G
          </span>
          <span>Gaeliza</span>
        </div>
        <Link className="button button-secondary" to="/app">
          Abrir aplicación
        </Link>
      </header>

      <main>
        <section className="hero">
          <div className="hero-copy">
            <span className="eyebrow">Análise de fútbol gaélico</span>
            <h1>Do vídeo ás decisións que cambian o seguinte partido.</h1>
            <p>
              Gaeliza converte o partido en datos útiles sen obrigarte a rexistrar
              todo en directo. Analiza despois do encontro, captura rápido cando
              toque e volve sempre á xogada orixinal.
            </p>
            <div className="hero-actions">
              <Link className="button button-primary" to="/app">
                Probar sen rexistro
              </Link>
              <a className="text-link" href="#como-funciona">
                Como funciona
              </a>
            </div>
            <p className="hero-note">
              Podes empezar como invitado. A conta só fai falta cando queiras
              conservar o traballo entre dispositivos.
            </p>
          </div>

          <div className="hero-panel" aria-label="Resumo do fluxo de análise">
            <div className="metric-card metric-card-main">
              <span>Conversión de tiro</span>
              <strong>46%</strong>
              <small>11 / 24 tiros</small>
            </div>
            <div className="metric-grid">
              <div className="metric-card">
                <span>Posesións</span>
                <strong>31</strong>
              </div>
              <div className="metric-card">
                <span>Puntos / posesión</span>
                <strong>0,81</strong>
              </div>
              <div className="metric-card">
                <span>Perdas</span>
                <strong>12</strong>
              </div>
              <div className="metric-card">
                <span>Saques retidos</span>
                <strong>72%</strong>
              </div>
            </div>
            <div className="insight-card">
              <span className="insight-dot" aria-hidden="true" />
              <div>
                <strong>Patrón detectado</strong>
                <p>A eficiencia baixa nas posesións iniciadas por saque longo.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="capabilities" id="como-funciona">
          {capabilities.map((capability, index) => (
            <article className="capability-card" key={capability.title}>
              <span className="capability-index">0{index + 1}</span>
              <h2>{capability.title}</h2>
              <p>{capability.text}</p>
            </article>
          ))}
        </section>
      </main>
    </div>
  )
}
