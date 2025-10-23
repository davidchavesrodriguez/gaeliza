import { createClient } from '@supabase/supabase-js';
import type { Database } from './types/supabase';


const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Faltan variables de verificación'
  );
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);


// Comprobación keys
console.log('Supabase client initialized with URL:', supabaseUrl ? 'Loaded' : 'Missing');
console.log('Supabase client initialized with Key:', supabaseAnonKey ? 'Loaded' : 'Missing');