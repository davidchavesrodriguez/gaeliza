import { createClient } from '@supabase/supabase-js'

const v2Url = import.meta.env.VITE_GAELIZA_V2_SUPABASE_URL
const v2Key =
  import.meta.env.VITE_GAELIZA_V2_SUPABASE_PUBLISHABLE_KEY ??
  import.meta.env.VITE_GAELIZA_V2_SUPABASE_ANON_KEY

const hasV2Configuration = v2Url !== undefined || v2Key !== undefined

const supabaseUrl = hasV2Configuration
  ? v2Url
  : import.meta.env.VITE_SUPABASE_URL

const supabaseKey = hasV2Configuration
  ? v2Key
  : import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    'Missing Gaeliza v2 Supabase configuration. Set the VITE_GAELIZA_V2_SUPABASE_* deployment variables or the VITE_SUPABASE_* development sandbox variables.',
  )
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})