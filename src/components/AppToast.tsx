import { AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';

export type ToastVariant = 'success' | 'warning' | 'error';

export interface AppToastProps {
  open: boolean;
  variant: ToastVariant;
  title: string;
  message: string;
  hint?: string;
  onClose?: () => void;
}

export function AppToast({ open, variant, title, message, hint, onClose }: AppToastProps) {
  if (!open) return null;

  const styleByVariant: Record<ToastVariant, { wrapper: string; icon: string; title: string; hint: string }> = {
    success: {
      wrapper: 'border-emerald-200 bg-emerald-50 text-emerald-900',
      icon: 'text-emerald-600',
      title: 'text-emerald-800',
      hint: 'text-emerald-700',
    },
    warning: {
      wrapper: 'border-amber-200 bg-amber-50 text-amber-900',
      icon: 'text-amber-600',
      title: 'text-amber-800',
      hint: 'text-amber-700',
    },
    error: {
      wrapper: 'border-rose-200 bg-rose-50 text-rose-900',
      icon: 'text-rose-600',
      title: 'text-rose-800',
      hint: 'text-rose-700',
    },
  };

  const Icon = variant === 'success' ? CheckCircle2 : variant === 'warning' ? AlertTriangle : XCircle;
  const styles = styleByVariant[variant];

  return (
    <div className={`fixed right-4 top-24 z-[90] w-full max-w-sm rounded-xl border p-4 shadow-lg animate-in fade-in slide-in-from-top-2 ${styles.wrapper}`}>
      <div className="flex items-start gap-3">
        <Icon className={`mt-0.5 h-5 w-5 ${styles.icon}`} />
        <div className="flex-1">
          <p className={`text-xs font-black uppercase tracking-wider ${styles.title}`}>{title}</p>
          <p className="mt-1 text-sm font-semibold leading-5">{message}</p>
          {hint && <p className={`mt-1 text-xs font-semibold ${styles.hint}`}>Astuce: {hint}</p>}
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-2 py-1 text-[10px] font-black uppercase tracking-wider text-slate-500 hover:bg-white/60"
          >
            Fermer
          </button>
        )}
      </div>
    </div>
  );
}

export default AppToast;
