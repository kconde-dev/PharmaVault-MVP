import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/lib/supabase';

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const from = (location.state as { from?: { pathname: string } })?.from?.pathname ?? '/dashboard';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    // Automatically append @pharmavault.local to username
    const email = `${username}@pharmavault.local`;
    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setIsLoading(false);
    if (signInError) {
      console.error('signInWithPassword failed:', signInError);
      const message = signInError.message === 'Invalid login credentials'
        ? 'Identifiants incorrects. Vérifiez votre nom d\'utilisateur et mot de passe.'
        : signInError.message;
      setError(message);
      alert(message);
      return;
    }
    console.log('signInWithPassword success – session:', data.session, 'user:', data.user);
    navigate(from, { replace: true });
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-card/80 backdrop-blur border border-border rounded-2xl shadow-xl p-8 space-y-8">
        <header className="space-y-4 text-center">
          <div className="inline-flex items-center justify-center space-x-3">
            <div className="h-11 w-11 rounded-full bg-primary/15 flex items-center justify-center border border-primary/40">
              <ShieldCheck className="h-6 w-6 text-primary" aria-hidden="true" />
            </div>
            <div className="text-left">
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-muted-foreground">
                PharmaVault
              </p>
              <p className="text-[11px] text-muted-foreground">
                Plateforme sécurisée de gestion officinale
              </p>
            </div>
          </div>
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">
              Connexion à PharmaVault
            </h1>
            <p className="text-sm text-muted-foreground">
              Identifiez-vous pour accéder à vos prescriptions, stocks et tableaux
              de bord en temps réel.
            </p>
          </div>
        </header>

        <form className="space-y-6" onSubmit={handleSubmit}>
          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label
                htmlFor="username"
                className="block text-sm font-medium text-foreground"
              >
                Nom d'utilisateur
              </label>
              <Input
                id="username"
                name="username"
                type="text"
                autoComplete="username"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="moussa"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <label
                  htmlFor="password"
                  className="block text-sm font-medium text-foreground"
                >
                  Mot de passe
                </label>
                <button
                  type="button"
                  className="text-xs text-primary hover:underline underline-offset-4"
                >
                  Mot de passe oublié ?
                </button>
              </div>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>
          </div>

          <Button type="submit" className="w-full" isLoading={isLoading}>
            Se connecter
          </Button>
        </form>

        <footer className="pt-2 border-t border-border/60">
          <p className="text-[11px] text-muted-foreground text-center leading-relaxed">
            Accès strictement réservé au personnel autorisé. Toute connexion est
            journalisée pour garantir la traçabilité et la sécurité des données
            patients.
          </p>
        </footer>
      </div>
    </div>
  );
};

export default Login;


