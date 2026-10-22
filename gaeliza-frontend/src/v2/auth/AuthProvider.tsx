import { useCallback, useEffect, useMemo, useRef, useState, type PropsWithChildren } from 'react'
import { supabase } from '../lib/supabase'
import { AuthContext, type AuthContextValue } from './auth-context'
import { createAuthBootstrap, createGuestSession, type SessionState } from './session-bootstrap'

const bootstrap = createAuthBootstrap(supabase.auth)
const getOrCreateGuestSession = createGuestSession(supabase.auth)
const initialState: SessionState = { session: null, status: 'loading', error: null }

export function AuthProvider({ children }: PropsWithChildren) {
  const [state, setState] = useState(initialState)
  const [attempt, setAttempt] = useState(0)
  const generation = useRef(0)
  const stopBootstrap = useRef<(() => void) | null>(null)

  useEffect(() => {
    generation.current += 1
    const stop = bootstrap(setState)
    stopBootstrap.current = stop
    return () => { generation.current += 1; stop(); stopBootstrap.current = null }
  }, [attempt])

  const retrySession = useCallback(() => {
    // Invalidate immediately, before React's passive effect cleanup runs.
    generation.current += 1
    stopBootstrap.current?.()
    setState(initialState)
    setAttempt((current) => current + 1)
  }, [])

  const ensureGuestSession = useCallback(async () => {
    const current = generation.current
    setState((value) => ({ ...value, error: null }))
    try {
      const session = await getOrCreateGuestSession()
      if (current === generation.current) setState({ session, status: 'ready', error: null })
      return session
    } catch (caught) {
      if (current === generation.current) setState((value) => ({ ...value,
        error: caught instanceof Error ? caught.message : 'Non puidemos iniciar a sesión de invitado.',
      }))
      throw caught
    }
  }, [])

  const signOut = useCallback(async () => {
    const current = generation.current
    const { error } = await supabase.auth.signOut()
    if (error) {
      if (current === generation.current) setState((value) => ({ ...value, error: error.message }))
      throw error
    }
    if (current === generation.current) setState({ session: null, status: 'ready', error: null })
  }, [])

  const value = useMemo<AuthContextValue>(() => ({
    ...state,
    isAnonymous: state.session?.user.is_anonymous === true,
    ensureGuestSession,
    retrySession,
    signOut,
  }), [state, ensureGuestSession, retrySession, signOut])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
