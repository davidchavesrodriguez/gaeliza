import { createClient } from '@supabase/supabase-js';
import type { Database } from './types/supabase';

const supabaseUrl = import.meta.env.VITE_GAELIZA_V2_SUPABASE_URL;
const supabaseKey =
  import.meta.env.VITE_GAELIZA_V2_SUPABASE_PUBLISHABLE_KEY ??
  import.meta.env.VITE_GAELIZA_V2_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    'Faltan variables de configuración de Supabase para Gaeliza v2'
  );
}

export const supabase = createClient<Database>(supabaseUrl, supabaseKey);
