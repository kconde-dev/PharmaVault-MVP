import * as React from 'react';
import { Loader2 } from 'lucide-react';

type ButtonVariant = 'default' | 'outline' | 'ghost' | 'destructive' | 'secondary' | 'glass';
type ButtonSize = 'sm' | 'md' | 'lg' | 'xl';

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
}

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

const baseClasses =
  'inline-flex items-center justify-center rounded-2xl text-sm font-black transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/20 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap active:scale-[0.98] uppercase tracking-widest';

const variantClasses: Record<ButtonVariant, string> = {
  default:
    'bg-slate-900 text-white hover:bg-slate-800 shadow-lg shadow-slate-900/10',
  secondary:
    'bg-emerald-500 text-white hover:bg-emerald-600 shadow-lg shadow-emerald-500/20',
  outline:
    'border-2 border-slate-200 bg-transparent text-slate-700 hover:bg-slate-50 hover:border-slate-300',
  ghost: 'bg-transparent text-slate-600 hover:bg-slate-100',
  destructive: 'bg-rose-500 text-white hover:bg-rose-600 shadow-lg shadow-rose-500/20',
  glass: 'bg-white/40 backdrop-blur-md border border-white/60 text-slate-900 hover:bg-white/60 shadow-xl',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'h-9 px-4 text-[10px]',
  md: 'h-11 px-6 text-[11px]',
  lg: 'h-14 px-8 text-xs',
  xl: 'h-16 px-10 text-sm',
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = 'default',
      size = 'md',
      isLoading = false,
      children,
      disabled,
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        className={cn(
          baseClasses,
          variantClasses[variant],
          sizeClasses[size],
          className
        )}
        disabled={isLoading || disabled}
        {...props}
      >
        {isLoading && (
          <Loader2 className="mr-3 h-4 w-4 animate-spin opacity-70" aria-hidden="true" />
        )}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';

export default Button;

