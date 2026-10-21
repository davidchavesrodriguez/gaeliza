import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'

export function DashboardPage() {
  const { isAnonymous } = useAuth()

  return (
    <div className="page-stack">
      <section className="page-heading">
        <div>
          <span className="eyebrow">O teu espazo de análise</span>
          <h1>Que queres revisar hoxe?</h1>
          <p>
            Crea un novo análise ou continúa un partido xa preparado. O histórico
            aparecerá aquí a medida que completes análises.
          </p>
        </div>
        <Link className="button button-primary" to="/app/new">
          Novo análise
        </Link>
      </section>

      {isAnonymous ? (
        <aside className="guest-banner">
          <div>
            <strong>Estás traballando como invitado.</strong>
            <p>
              Podes probar o fluxo completo neste navegador. Máis adiante poderás
              ligar esta mesma sesión a unha conta sen mover os teus datos.
            </p>
          </div>
          <span className="badge">Sesión temporal</span>
        </aside>
      ) : null}

      <section className="dashboard-grid">
        <article className="dashboard-card dashboard-card-primary">
          <span className="eyebrow">Comezar</span>
          <h2>Analiza un partido</h2>
          <p>
            Escolle o encontro, prepara a convocatoria e decide se vas traballar
            desde vídeo ou en modo directo.
          </p>
          <Link className="text-link" to="/app/new">
            Preparar análise →
          </Link>
        </article>

        <article className="dashboard-card">
          <span className="eyebrow">Histórico</span>
          <h2>Aínda sen análises completados</h2>
          <p>
            Os resumos de equipo, evolución e scouting usarán un único análise
            principal por partido para evitar duplicados.
          </p>
        </article>

        <article className="dashboard-card">
          <span className="eyebrow">Próximo</span>
          <h2>O fluxo xa está preparado</h2>
          <p>
            Partido → convocatoria → vídeo → tagging → posesións → conclusións.
            A seguinte pantalla conecta este shell co calendario real.
          </p>
        </article>
      </section>
    </div>
  )
}
