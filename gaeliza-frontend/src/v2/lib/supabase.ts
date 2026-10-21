import { createClient } from '@supabase/supabase-js'

// The cloud sandbox supplies the standard Vite names. Keep the explicit v2
// aliases for existing v2 deployments and CI; never infer a remote project.
const sandboxUrl = import.meta.env.VITE_SUPABASE_URL
const sandboxKey = import.meta.env.VITE_SUPABASE_ANON_KEY
const useSandbox = sandboxUrl !== undefined || sandboxKey !== undefined
const supabaseUrl = useSandbox
  ? sandboxUrl
  : import.meta.env.VITE_GAELIZA_V2_SUPABASE_URL
const supabaseKey = useSandbox
  ? sandboxKey
  : (import.meta.env.VITE_GAELIZA_V2_SUPABASE_PUBLISHABLE_KEY ??
    import.meta.env.VITE_GAELIZA_V2_SUPABASE_ANON_KEY)

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    'Missing Gaeliza v2 Supabase configuration. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY for the development sandbox, or the VITE_GAELIZA_V2_SUPABASE_* deployment aliases.',
  )
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})
