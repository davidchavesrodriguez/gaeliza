import { Link } from 'react-router-dom'

export function NotFoundPage() {
  return (
    <main className="centered-state">
      <div className="state-card">
        <span className="eyebrow">404</span>
        <h1>Esta páxina non existe.</h1>
        <p>Volvemos ao punto de partida e seguimos desde aí.</p>
        <Link className="button button-primary" to="/">
          Ir a Gaeliza
        </Link>
      </div>
    </main>
  )
}
