import React, { useState, useEffect } from 'react';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';
import { ToastMessage, subscribeToToasts } from '../utils/toast';

const ToastContainer: React.FC = () => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  useEffect(() => {
    const unsubscribe = subscribeToToasts((newToast) => {
      setToasts((prev) => [newToast, ...prev].slice(0, 5));
      const duration = newToast.duration || 4200;
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== newToast.id));
      }, duration);
    });
    return unsubscribe;
  }, []);

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  if (toasts.length === 0) return null;

  const getStyles = (type: ToastMessage['type']) => {
    switch (type) {
      case 'success':
        return {
          bg: 'bg-slate-900/95 border-emerald-500/40 text-white shadow-emerald-950/20',
          badge: 'bg-emerald-500/20 text-emerald-400',
          icon: <CheckCircle2 size={20} className="text-emerald-400 shrink-0" />,
          defaultTitle: 'Confirmado'
        };
      case 'error':
        return {
          bg: 'bg-slate-900/95 border-red-500/40 text-white shadow-red-950/20',
          badge: 'bg-red-500/20 text-red-400',
          icon: <AlertCircle size={20} className="text-red-400 shrink-0" />,
          defaultTitle: 'Atención'
        };
      case 'warning':
        return {
          bg: 'bg-slate-900/95 border-amber-500/40 text-white shadow-amber-950/20',
          badge: 'bg-amber-500/20 text-amber-400',
          icon: <AlertTriangle size={20} className="text-amber-400 shrink-0" />,
          defaultTitle: 'Aviso del Sistema'
        };
      default:
        return {
          bg: 'bg-slate-900/95 border-blue-500/40 text-white shadow-blue-950/20',
          badge: 'bg-blue-500/20 text-blue-400',
          icon: <Info size={20} className="text-blue-400 shrink-0" />,
          defaultTitle: 'Notificación'
        };
    }
  };

  return (
    <div className="fixed top-5 right-5 z-[9999] flex flex-col gap-3 max-w-md w-full pointer-events-none px-4 sm:px-0">
      {toasts.map((item) => {
        const style = getStyles(item.type);
        return (
          <div
            key={item.id}
            className={`pointer-events-auto flex items-start gap-3.5 p-4 rounded-2xl border backdrop-blur-xl shadow-2xl transition-all duration-300 animate-in slide-in-from-right-5 fade-in ${style.bg}`}
          >
            <div className={`p-2 rounded-xl ${style.badge}`}>
              {style.icon}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-0.5">
                {item.title || style.defaultTitle}
              </p>
              <p className="text-xs font-bold leading-relaxed break-words text-slate-100">
                {item.message}
              </p>
            </div>
            <button
              onClick={() => removeToast(item.id)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors shrink-0"
              aria-label="Cerrar notificación"
            >
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
};

export default ToastContainer;
