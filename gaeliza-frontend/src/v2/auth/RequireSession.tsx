import { useEffect, useState } from 'react'
import { Outlet } from 'react-router-dom'
import { useAuth } from './auth-context'

export function RequireSession() {
  const { session, status, error, ensureGuestSession, retrySession } = useAuth()
  const [attempted, setAttempted] = useState(false)

  useEffect(() => {
    if (status !== 'ready' || session || attempted || error) {
      return
    }

    setAttempted(true)
    void ensureGuestSession().catch(() => {
      // The provider exposes the error to the UI below.
    })
  }, [attempted, ensureGuestSession, session, status, error])

  if (status === 'loading' || (status === 'ready' && !session && !error)) {
    return (
      <main className="centered-state" aria-live="polite">
        <div className="spinner" aria-hidden="true" />
        <p>Preparando a túa sesión…</p>
      </main>
    )
  }

  if (status === 'error' || !session) {
    return (
      <main className="centered-state">
        <div className="state-card" role="alert">
          <h1>{status === 'error' ? 'Non foi posible recuperar a sesión.' : 'Non foi posible iniciar a sesión de invitado.'}</h1>
          <p>{error ?? 'Erro descoñecido.'}</p>
          <button
            className="button button-primary"
            type="button"
            onClick={() => {
              setAttempted(false)
              retrySession()
            }}
          >
            Tentar de novo
          </button>
        </div>
      </main>
    )
  }

  return <Outlet />
}
