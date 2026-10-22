import type { Session, SupabaseClient } from '@supabase/supabase-js'

type AuthClient = SupabaseClient['auth']
export type SessionState = {
  session: Session | null
  status: 'loading' | 'ready' | 'error'
  error: string | null
}
export const authBootstrapTimeoutMs = 15_000

// One in-flight SDK recovery per client, including StrictMode effect replay and
// retry while recovery is still pending. getSession has no public abort API.
export function createAuthBootstrap(auth: Pick<AuthClient, 'getSession' | 'onAuthStateChange'>) {
  let pending: ReturnType<AuthClient['getSession']> | null = null
  function recoverSession() {
    pending ??= Promise.resolve().then(() => auth.getSession()).finally(() => { pending = null })
    return pending
  }

  return function start(update: (state: SessionState) => void) {
    let active = true
    let unsubscribe: (() => void) | undefined
    function fail(message: string) {
      if (!active) return
      active = false
      clearTimeout(timeout)
      unsubscribe?.()
      update({ session: null, status: 'error', error: message })
    }
    const timeout = setTimeout(() => fail('A recuperación tardou máis do previsto.'), authBootstrapTimeoutMs)
    update({ session: null, status: 'loading', error: null })

    void (async () => {
      try {
        const { data, error } = await recoverSession()
        if (!active) return
        if (error) { fail(error.message); return }
        clearTimeout(timeout)
        update({ session: data.session, status: 'ready', error: null })
        const { data: { subscription } } = auth.onAuthStateChange((event, session) => {
          // The initial state has already been resolved above. Keep this
          // callback synchronous and use it only for subsequent notifications.
          if (active && event !== 'INITIAL_SESSION') update({ session, status: 'ready', error: null })
        })
        unsubscribe = () => subscription.unsubscribe()
      } catch (caught) {
        fail(caught instanceof Error ? caught.message : 'Fallou a recuperación da sesión.')
      }
    })()

    return () => {
      active = false
      clearTimeout(timeout)
      unsubscribe?.()
    }
  }
}

// Deduplicate the whole read/create sequence, not just the anonymous request.
// A recovery error must never fall through to creating a replacement identity.
export function createGuestSession(auth: Pick<AuthClient, 'getSession' | 'signInAnonymously'>) {
  let pending: Promise<Session> | null = null
  return function getOrCreateGuestSession(): Promise<Session> {
    pending ??= (async () => {
      const { data: current, error: recoveryError } = await auth.getSession()
      if (recoveryError) throw recoveryError
      if (current.session) return current.session
      const { data, error } = await auth.signInAnonymously()
      if (error) throw error
      if (!data.session) throw new Error('Non se recibiu unha sesión de invitado.')
      return data.session
    })().finally(() => { pending = null })
    return pending
  }
}
