
import { createClient } from '@supabase/supabase-js';

// Intentamos obtener de process.env o del localStorage del navegador
const getSupabaseConfig = () => {
  // Use optional chaining or check for process to be safe in all environments
  const envUrl = typeof process !== 'undefined' ? (process.env as any).SUPABASE_URL : undefined;
  const envKey = typeof process !== 'undefined' ? (process.env as any).SUPABASE_ANON_KEY : undefined;
  
  const localUrl = localStorage.getItem('supabase_url');
  const localKey = localStorage.getItem('supabase_key');

  const url = envUrl || localUrl || '';
  const key = envKey || localKey || '';

  return { url, key };
};

const config = getSupabaseConfig();

/**
 * Para evitar el error "supabaseUrl is required" al iniciar la app sin configuración,
 * usamos una URL de marcador de posición si los valores están vacíos.
 * La app detectará que no está conectada y pedirá los datos al usuario en AdminDashboard.
 */
const IS_CONFIGURED = config.url !== '' && config.key !== '';
const FINAL_URL = IS_CONFIGURED ? config.url : 'https://placeholder.supabase.co';
const FINAL_KEY = IS_CONFIGURED ? config.key : 'placeholder';

export const supabase = createClient(FINAL_URL, FINAL_KEY);

// Helper para saber si la configuración es real
export const isSupabaseConfigured = () => IS_CONFIGURED;

// Helper para guardar configuración manualmente desde la UI
export const saveSupabaseConfig = (url: string, key: string) => {
  localStorage.setItem('supabase_url', url);
  localStorage.setItem('supabase_key', key);
  window.location.reload(); // Recargamos para re-instanciar el cliente
};

export const clearSupabaseConfig = () => {
  localStorage.removeItem('supabase_url');
  localStorage.removeItem('supabase_key');
  window.location.reload();
};
