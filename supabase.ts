
import { createClient } from '@supabase/supabase-js';

/**
 * CONFIGURACIÓN DE SUPABASE
 * -------------------------
 * Opción A (Recomendada): Configura las variables de entorno en tu plataforma de hosting (Vercel/Netlify).
 * Opción B (Rápida): Pega tus credenciales en las constantes 'HARDCODED_URL' y 'HARDCODED_KEY' abajo.
 */

const HARDCODED_URL = 'https://ymxvpcfbobzvuwrdjlag.supabase.co'; // Pega aquí tu Project URL si quieres que sea permanente
const HARDCODED_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlteHZwY2Zib2J6dnV3cmRqbGFnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE1MTQ4NDgsImV4cCI6MjA4NzA5MDg0OH0.c4SG61RPMvTYmAi9GuN7L873tzGKUlgOtbG_6Bwihfg'; // Pega aquí tu Anon Key si quieres que sea permanente

const getSupabaseConfig = () => {
  // 1. Intentar obtener de variables de entorno (Vite / Proceso estándar)
  const envUrl = (import.meta as any).env?.VITE_SUPABASE_URL || (process.env as any).SUPABASE_URL;
  const envKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || (process.env as any).SUPABASE_ANON_KEY;
  
  // 2. Intentar obtener del almacenamiento local del navegador
  const localUrl = localStorage.getItem('supabase_url');
  const localKey = localStorage.getItem('supabase_key');

  // Prioridad: Hardcoded > Env Vars > LocalStorage
  const url = HARDCODED_URL || envUrl || localUrl || '';
  const key = HARDCODED_KEY || envKey || localKey || '';

  return { url, key };
};

const config = getSupabaseConfig();

// Para evitar errores de inicialización, usamos placeholders si no hay config
const IS_CONFIGURED = config.url !== '' && config.key !== '';
const FINAL_URL = IS_CONFIGURED ? config.url : 'https://placeholder.supabase.co';
const FINAL_KEY = IS_CONFIGURED ? config.key : 'placeholder';

export const supabase = createClient(FINAL_URL, FINAL_KEY);

export const isSupabaseConfigured = () => IS_CONFIGURED;

export const saveSupabaseConfig = (url: string, key: string) => {
  localStorage.setItem('supabase_url', url);
  localStorage.setItem('supabase_key', key);
  // Recargamos para que el cliente tome los nuevos valores
  window.location.reload();
};

export const clearSupabaseConfig = () => {
  localStorage.removeItem('supabase_url');
  localStorage.removeItem('supabase_key');
  window.location.reload();
};
