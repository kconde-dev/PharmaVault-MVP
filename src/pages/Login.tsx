import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, Lock, User, AtSign } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    const normalizedUsername = username.toLowerCase().trim().split('@')[0];
    const email = `${normalizedUsername}@pharmavault.com`;
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setIsLoading(false);

    if (signInError) {
      const message = signInError.message === 'Invalid login credentials'
        ? "Identifiants refusés. Vérifiez votre nom et code PIN."
        : signInError.message;
      setError(message);
      return;
    }

    navigate('/dashboard', { replace: true });
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4 relative overflow-hidden">
      {/* Dynamic Background Elements */}
      <div className="absolute top-0 left-0 w-full h-full opacity-[0.03] pointer-events-none">
        <div className="absolute top-10 left-10"><ShieldCheck size={120} /></div>
        <div className="absolute bottom-20 right-20"><ShieldCheck size={180} /></div>
        <div className="absolute top-1/2 left-1/3 rotate-12"><AtSign size={100} /></div>
      </div>

      <div className="absolute -top-24 -left-24 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl" />
      <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />

      <div className="w-full max-w-[440px] z-10">
        <div className="glass-card rounded-[2rem] p-10 shadow-2xl shadow-emerald-900/10 border border-white/40">
          <header className="mb-10 text-center">
            <div className="inline-flex items-center justify-center mb-6">
              <div className="h-20 w-20 rounded-[1.75rem] pharmacy-gradient p-0.5 shadow-xl shadow-emerald-500/20 rotate-3 transition-transform hover:rotate-0 duration-500">
                <div className="h-full w-full bg-slate-900 rounded-[1.65rem] flex items-center justify-center">
                  <ShieldCheck className="h-10 w-10 text-emerald-400" />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <h1 className="text-3xl font-black tracking-tight text-slate-900 flex items-center justify-center gap-2">
                PharmaVault
                <span className="text-[10px] font-bold text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full uppercase tracking-widest">v2.0</span>
              </h1>
              <p className="text-sm font-medium text-slate-500 px-6 leading-relaxed">
                Portail de Gestion Officinale Sécurisé. Connectez-vous pour piloter votre activité.
              </p>
            </div>
          </header>

          <form className="space-y-6" onSubmit={handleSubmit}>
            {error && (
              <div className="bg-rose-50 border border-rose-100 p-4 rounded-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
                <div className="h-2 w-2 rounded-full bg-rose-500 animate-pulse" />
                <p className="text-xs font-bold text-rose-600 uppercase tracking-wide">
                  {error}
                </p>
              </div>
            )}

            <div className="space-y-5">
              <div className="space-y-2">
                <label htmlFor="username" className="text-xs font-bold text-slate-600 uppercase tracking-widest ml-1">
                  Identifiant Pharmacie
                </label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <User className="h-4 w-4 text-slate-400 group-focus-within:text-emerald-500 transition-colors" />
                  </div>
                  <input
                    id="username"
                    name="username"
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full bg-slate-100/50 border border-slate-200 rounded-2xl py-3.5 pl-11 pr-4 text-sm font-bold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                    placeholder="Ex: admin"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between ml-1">
                  <label htmlFor="password" className="text-xs font-bold text-slate-600 uppercase tracking-widest">
                    Code PIN (6 Chiffres)
                  </label>
                </div>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Lock className="h-4 w-4 text-slate-400 group-focus-within:text-emerald-500 transition-colors" />
                  </div>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    inputMode="numeric"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value.replace(/\D/g, ''))}
                    className="w-full bg-slate-100/50 border border-slate-200 rounded-2xl py-3.5 pl-11 pr-4 text-sm font-bold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all tracking-[0.5em]"
                    placeholder="••••••"
                    maxLength={6}
                  />
                </div>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full h-14 rounded-2xl pharmacy-gradient text-white text-base font-black uppercase tracking-widest shadow-xl shadow-emerald-500/30 hover:shadow-emerald-500/40 hover:scale-[1.02] active:scale-95 transition-all border-0"
              isLoading={isLoading}
            >
              Accéder au Coffre
            </Button>
          </form>

          <footer className="mt-10 pt-8 border-t border-slate-200/60 text-center">
            <div className="flex items-center justify-center gap-2 text-[11px] font-bold text-slate-400 uppercase tracking-[0.1em]">
              <Lock className="h-3 w-3" />
              <span>Chiffrement 256-bit AES</span>
            </div>
            <p className="mt-2 text-[9px] text-slate-400 font-medium px-4 leading-relaxed italic">
              Seulement le personnel certifié PharmaVault est autorisé à traiter ces données sensibles.
            </p>
          </footer>
        </div>
      </div>
    </div>
  );
};

export default Login;
