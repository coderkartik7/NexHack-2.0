import React from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export interface ToastMessage {
  id: string;
  type: 'success' | 'warning' | 'info';
  message: string;
}

interface ToastsProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export const Toasts: React.FC<ToastsProps> = ({ toasts, onDismiss }) => {
  return (
    <div className="fixed bottom-16 right-6 z-50 flex flex-col gap-2 max-w-sm pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto flex items-center justify-between gap-3 p-3 rounded-lg border shadow-lg backdrop-blur-md transition-all duration-200 ${
            t.type === 'success'
              ? 'bg-emerald-950/90 border-emerald-800/80 text-emerald-200'
              : t.type === 'warning'
              ? 'bg-amber-950/90 border-amber-800/80 text-amber-200'
              : 'bg-zinc-900/90 border-zinc-700/80 text-zinc-200'
          }`}
        >
          <div className="flex items-center gap-2 text-xs font-medium font-sans">
            {t.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : t.type === 'warning' ? (
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
            ) : (
              <Info className="w-4 h-4 text-teal-400 shrink-0" />
            )}
            <span>{t.message}</span>
          </div>
          <button
            onClick={() => onDismiss(t.id)}
            className="text-zinc-400 hover:text-zinc-200 p-0.5 rounded transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
};
