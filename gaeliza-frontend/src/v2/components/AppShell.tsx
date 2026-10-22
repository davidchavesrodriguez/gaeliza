import { NavLink, Outlet } from 'react-router-dom'
import { ThemeToggle } from './ThemeToggle'
import { useAuth } from '../auth/auth-context'

export function AppShell() {
  const { session, isAnonymous } = useAuth()

  return (
    <div className="app-frame">
      <a className="skip-link" href="#main-content">Saltar ao contido</a>
      <header className="app-header">
        <NavLink className="brand" to="/app" end>
          <span className="brand-mark" aria-hidden="true">
            G
          </span>
          <span>Gaeliza</span>
        </NavLink>

        <nav className="app-nav" aria-label="Navegación principal">
          <NavLink
            to="/app"
            end
            className={({ isActive }) => (isActive ? 'active' : undefined)}
          >
            Inicio
          </NavLink>
          <NavLink
            to="/app/new"
            className={({ isActive }) => (isActive ? 'active' : undefined)}
          >
            Nova análise
          </NavLink>
        </nav>

        <div className="app-header-tools"><ThemeToggle />
        <div className="session-chip" title={session?.user.id}>
          <span className="session-dot" aria-hidden="true" />
          {isAnonymous ? 'Modo invitado' : 'Conta gardada'}
        </div></div>
      </header>

      <main id="main-content" className="app-content">
        <Outlet />
      </main>
    </div>
  )
}
