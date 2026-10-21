import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

type AuthStatus = 'loading' | 'ready'

type AuthContextValue = {
  session: Session | null
  status: AuthStatus
  error: string | null
  isAnonymous: boolean
  ensureGuestSession: () => Promise<Session>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

let guestSessionPromise: Promise<Session> | null = null

async function getOrCreateGuestSession(): Promise<Session> {
  const { data: currentSession, error: sessionError } =
    await supabase.auth.getSession()

  if (sessionError) {
    throw sessionError
  }

  if (currentSession.session) {
    return currentSession.session
  }

  if (!guestSessionPromise) {
    guestSessionPromise = (async () => {
      const { data, error } = await supabase.auth.signInAnonymously()

      if (error) {
        throw error
      }

      if (!data.session) {
        throw new Error('Supabase did not return a session for anonymous sign-in.')
      }

      return data.session
    })().finally(() => {
      guestSessionPromise = null
    })
  }

  return guestSessionPromise
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null)
  const [status, setStatus] = useState<AuthStatus>('loading')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    void supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (!active) {
        return
      }

      if (sessionError) {
        setError(sessionError.message)
      }

      setSession(data.session)
      setStatus('ready')
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) {
        return
      }

      setSession(nextSession)
      setError(null)
      setStatus('ready')
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  const ensureGuestSession = useCallback(async () => {
    setError(null)

    try {
      const nextSession = await getOrCreateGuestSession()
      setSession(nextSession)
      return nextSession
    } catch (caughtError) {
      const message =
        caughtError instanceof Error
          ? caughtError.message
          : 'Could not start a guest session.'

      setError(message)
      throw caughtError
    }
  }, [])

  const signOut = useCallback(async () => {
    const { error: signOutError } = await supabase.auth.signOut()

    if (signOutError) {
      setError(signOutError.message)
      throw signOutError
    }

    setSession(null)
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      status,
      error,
      isAnonymous: session?.user.is_anonymous === true,
      ensureGuestSession,
      signOut,
    }),
    [session, status, error, ensureGuestSession, signOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider.')
  }

  return context
}
