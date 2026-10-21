import { createContext, useContext } from 'react'
import type { Session } from '@supabase/supabase-js'

export type AuthStatus = 'loading' | 'ready'

export type AuthContextValue = {
  session: Session | null
  status: AuthStatus
  error: string | null
  isAnonymous: boolean
  ensureGuestSession: () => Promise<Session>
  signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth() {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider.')
  }

  return context
}
