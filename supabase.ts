
import { createClient } from '@supabase/supabase-js';

// Intentamos obtener de process.env o del localStorage del navegador
const getSupabaseConfig = () => {
  const envUrl = (process.env as any).SUPABASE_URL;
  const envKey = (process.env as any).SUPABASE_ANON_KEY;
  
  const localUrl = localStorage.getItem('supabase_url');
  const localKey = localStorage.getItem('supabase_key');

  return {
    url: envUrl || localUrl || '',
    key: envKey || localKey || ''
  };
};

const config = getSupabaseConfig();

// Exportamos el cliente instanciado (estará vacío si no hay config)
export const supabase = createClient(config.url, config.key);

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
