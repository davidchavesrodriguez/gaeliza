import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_GAELIZA_V2_SUPABASE_URL
const supabaseKey =
  import.meta.env.VITE_GAELIZA_V2_SUPABASE_PUBLISHABLE_KEY ??
  import.meta.env.VITE_GAELIZA_V2_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    'Missing Gaeliza v2 Supabase configuration. Set VITE_GAELIZA_V2_SUPABASE_URL and VITE_GAELIZA_V2_SUPABASE_PUBLISHABLE_KEY (or VITE_GAELIZA_V2_SUPABASE_ANON_KEY for legacy key compatibility).',
  )
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})
