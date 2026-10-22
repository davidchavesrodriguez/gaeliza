import { Link } from 'react-router-dom'
import { ThemeToggle } from '../components/ThemeToggle'
export function LandingPage() {
  return <div className="landing-page">
    <header className="landing-header"><Link className="brand" to="/"><span className="brand-mark" aria-hidden="true">G</span>Gaeliza</Link>
      <div className="landing-header-actions"><ThemeToggle /><Link className="button button-secondary" to="/app">Abrir aplicación</Link></div></header>
    <main>
      <section className="landing-intro"><div>
        <p className="sport-label">Análise de fútbol gaélico</p>
        <h1>O partido, xogada a xogada.</h1>
        <p>Un espazo de traballo para corpos técnicos e analistas: prepara a convocatoria, sincroniza o vídeo e rexistra os feitos do partido.</p>
        <Link className="button button-primary" to="/app">Comezar un análise</Link>
        <p className="hero-note">Podes probar como invitado. Para continuar, volve desde o mesmo navegador.</p>
      </div><div className="landing-method" aria-label="Fluxo de análise"><h2>Da convocatoria á revisión</h2>
        <ol><li><strong>Prepara o partido</strong><p>Escolle o encontro e os xogadores que participan.</p></li>
          <li><strong>Relaciona vídeo e reloxo</strong><p>Indica onde comeza cada período na gravación.</p></li>
          <li><strong>Rexistra e revisa</strong><p>Tiros, pases, saques e cambios nunha timeline vinculada á xogada.</p></li></ol>
      </div></section>
      <section className="landing-context"><h2>No campo ou despois do encontro</h2>
        <p>Captura accións en directo ou traballa coa gravación. Volve aos eventos para corrixir datos e pecha o análise cando remates. O traballo queda dispoñible en Inicio.</p>
        <Link className="text-link" to="/app">Abrir os teus análises →</Link></section>
    </main>
    <footer className="landing-footer">Gaeliza · Fútbol gaélico</footer>
  </div>
}
