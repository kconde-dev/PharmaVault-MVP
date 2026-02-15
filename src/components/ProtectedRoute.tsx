import { useLocation, Navigate } from 'react-router-dom';
import useAuth from '@/hooks/useAuth';
import { ShieldAlert, Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: 'administrator' | 'staff';
}

export function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
  const { loading: isLoading, user, role } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(16,185,129,0.05)_0%,transparent_50%)]" />
        <div className="relative flex flex-col items-center gap-6">
          <div className="relative">
            <div className="h-16 w-16 border-4 border-slate-100 rounded-full" />
            <Loader2 className="absolute top-0 left-0 h-16 w-16 animate-spin text-emerald-500 stroke-[3px]" />
          </div>
          <div className="text-center">
            <p className="text-[10px] font-black text-slate-800 uppercase tracking-[0.3em] mb-1">Authentification</p>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest animate-pulse">Synchronisation des protocoles...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (requiredRole === 'administrator') {
    const isSubscriberAdmin = role?.toLowerCase() === 'admin' || role?.toLowerCase() === 'administrator';

    if (!isSubscriberAdmin) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
          <div className="glass-card rounded-[3rem] p-10 max-w-md w-full border border-white/60 shadow-2xl text-center space-y-6 animate-in zoom-in duration-500">
            <div className="mx-auto w-20 h-20 rounded-3xl bg-rose-50 flex items-center justify-center border border-rose-100 shadow-inner">
              <ShieldAlert className="h-10 w-10 text-rose-500" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tight italic">Accès Restreint</h1>
              <div className="h-1 w-12 bg-rose-500 rounded-full mx-auto mt-2" />
            </div>
            <p className="text-sm font-medium text-slate-500 leading-relaxed">
              Désolé, cette infrastructure est exclusivement réservée au personnel de direction.
              Veuillez contacter votre administrateur système.
            </p>
            <div className="pt-4">
              <Navigate to="/dashboard" replace />
            </div>
          </div>
        </div>
      );
    }
  }

  return <>{children}</>;
}

export default ProtectedRoute;
