import { useEffect, useState } from 'react'
import { Outlet } from 'react-router-dom'
import { useAuth } from './AuthProvider'

export function RequireSession() {
  const { session, status, error, ensureGuestSession } = useAuth()
  const [attempted, setAttempted] = useState(false)

  useEffect(() => {
    if (status !== 'ready' || session || attempted) {
      return
    }

    setAttempted(true)
    void ensureGuestSession().catch(() => {
      // The provider exposes the error to the UI below.
    })
  }, [attempted, ensureGuestSession, session, status])

  if (status === 'loading' || (!session && !error)) {
    return (
      <main className="centered-state" aria-live="polite">
        <div className="spinner" aria-hidden="true" />
        <p>Preparando a túa sesión…</p>
      </main>
    )
  }

  if (!session) {
    return (
      <main className="centered-state">
        <div className="state-card">
          <span className="eyebrow">Non puidemos iniciar a sesión</span>
          <h1>Gaeliza non pode crear a sesión de invitado.</h1>
          <p>{error ?? 'Erro descoñecido.'}</p>
          <button
            className="button button-primary"
            type="button"
            onClick={() => {
              setAttempted(false)
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
