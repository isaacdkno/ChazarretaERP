
import { createClient } from '@supabase/supabase-js';

// Estas variables se inyectan automáticamente en el entorno de ejecución
const supabaseUrl = (process.env as any).SUPABASE_URL || '';
const supabaseAnonKey = (process.env as any).SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
