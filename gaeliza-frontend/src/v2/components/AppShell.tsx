import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'

export function AppShell() {
  const { session, isAnonymous } = useAuth()

  return (
    <div className="app-frame">
      <header className="app-header">
        <NavLink className="brand" to="/app" end>
          <span className="brand-mark" aria-hidden="true">
            G
          </span>
          <span>Gaeliza</span>
        </NavLink>

        <nav className="app-nav" aria-label="Navegación principal">
          <NavLink to="/app" end>
            Inicio
          </NavLink>
          <NavLink to="/app/new">Novo análise</NavLink>
        </nav>

        <div className="session-chip" title={session?.user.id}>
          <span className="session-dot" aria-hidden="true" />
          {isAnonymous ? 'Modo invitado' : 'Conta gardada'}
        </div>
      </header>

      <main className="app-content">
        <Outlet />
      </main>
    </div>
  )
}
