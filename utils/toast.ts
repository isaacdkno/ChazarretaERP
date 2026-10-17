export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastMessage {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
  duration?: number;
}

type ToastListener = (toast: ToastMessage) => void;

const listeners: Set<ToastListener> = new Set();

export const subscribeToToasts = (listener: ToastListener): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const inferToastType = (msg: string): ToastType => {
  const lower = msg.toLowerCase();
  if (
    lower.includes('error') ||
    lower.includes('❌') ||
    lower.includes('bloqueado') ||
    lower.includes('excedido') ||
    lower.includes('no se pudo') ||
    lower.includes('denegado') ||
    lower.includes('obligatorio') ||
    lower.includes('falta')
  ) {
    return 'error';
  }
  if (
    lower.includes('aviso') ||
    lower.includes('⚠️') ||
    lower.includes('atención') ||
    lower.includes('pendiente')
  ) {
    return 'warning';
  }
  if (
    lower.includes('éxito') ||
    lower.includes('✅') ||
    lower.includes('correctamente') ||
    lower.includes('completada') ||
    lower.includes('copiado') ||
    lower.includes('guardado') ||
    lower.includes('cerrada')
  ) {
    return 'success';
  }
  return 'info';
};

export const showToast = (
  message: string,
  type?: ToastType,
  title?: string,
  duration = 4200
) => {
  const cleanMessage = message.replace(/^[✅❌⚠️]\s*/, '').trim();
  const resolvedType = type || inferToastType(message);
  const toastObj: ToastMessage = {
    id: 't-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7),
    type: resolvedType,
    title,
    message: cleanMessage,
    duration
  };
  listeners.forEach(l => l(toastObj));
};

export const toast = {
  success: (message: string, title = 'Operación exitosa') => showToast(message, 'success', title),
  error: (message: string, title = 'Atención') => showToast(message, 'error', title, 5500),
  warning: (message: string, title = 'Aviso') => showToast(message, 'warning', title, 5000),
  info: (message: string, title = 'Información') => showToast(message, 'info', title)
};

/**
 * Reproduce un sonido sutil y agradable (Web Audio API) para eventos en tiempo real o confirmaciones.
 */
export const playNotificationSound = (kind: 'chime' | 'success' = 'chime') => {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    const now = ctx.currentTime;

    if (kind === 'success') {
      osc.frequency.setValueAtTime(587.33, now); // D5
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.12); // A5
    } else {
      osc.frequency.setValueAtTime(523.25, now); // C5
      osc.frequency.exponentialRampToValueAtTime(659.25, now + 0.15); // E5
    }

    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.35);
  } catch {
    // Ignorar si el navegador bloquea audio sin interacción previa
  }
};

/**
 * Instala el puente global para convertir cualquier window.alert(...) en una notificación Toast moderna.
 */
export const installGlobalAlertBridge = () => {
  if (typeof window === 'undefined') return;
  window.alert = (message?: any) => {
    const text = message !== undefined && message !== null ? String(message) : '';
    if (!text) return;
    showToast(text);
  };
};
