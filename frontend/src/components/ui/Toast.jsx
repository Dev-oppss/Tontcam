import { useContext } from 'react';
import { AppContext } from '../../context/AppContext';
import { CheckCircle2, AlertTriangle, X } from 'lucide-react';
import clsx from 'clsx';

export function Toast() {
  const app = useContext(AppContext);
  const toast = app?.toast;
  if (!toast) return null;

  const isWarning = toast.type === 'warning';
  const isError   = toast.type === 'error';

  return (
    <div className={clsx(
      'fixed bottom-6 right-6 z-[9999] flex items-center gap-3 px-4 py-3 rounded-2xl shadow-xl text-sm font-medium',
      'scale-in border',
      isError   ? 'bg-red-600 text-white border-red-700'
      : isWarning ? 'bg-amber-50 text-amber-800 border-amber-200'
      : 'bg-ink-900 text-white border-white/10'
    )}>
      {isError
        ? <X size={16} className="shrink-0 text-white/80" />
        : isWarning
          ? <AlertTriangle size={16} className="shrink-0 text-amber-600" />
          : <CheckCircle2 size={16} className="shrink-0 text-primary-400" />
      }
      <span>{toast.message}</span>
    </div>
  );
}
