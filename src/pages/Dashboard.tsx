import { useEffect, useState, useCallback } from 'react';
import { CalendarClock, TrendingUp, Receipt, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';

type Shift = {
  id: string;
  user_id: string;
  started_at: string;
  ended_at: string | null;
};

export function Dashboard() {
  const { user } = useAuth();
  const [currentShift, setCurrentShift] = useState<Shift | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchActiveShift = useCallback(async () => {
    if (!user) return null;
    const { data, error: err } = await supabase
      .from('shifts')
      .select('id, user_id, started_at, ended_at')
      .eq('user_id', user.id)
      .is('ended_at', null)
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (err) return null;
    return data ?? null;
  }, [user]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const shift = await fetchActiveShift();
      if (!mounted) return;
      setCurrentShift(shift);
    })();
    return () => {
      mounted = false;
    };
  }, [fetchActiveShift]);

  const handleStartShift = async () => {
    setError(null);
    setIsStarting(true);
    if (!user) {
      setError('Session expirée. Veuillez vous reconnecter.');
      setIsStarting(false);
      return;
    }
    const { error: insertError } = await supabase.from('shifts').insert({
      user_id: user.id,
      started_at: new Date().toISOString(),
    });
    if (insertError) {
      setError(insertError.message || 'Impossible de démarrer la garde.');
      setIsStarting(false);
      return;
    }
    const shift = await fetchActiveShift();
    setCurrentShift(shift);
    setIsStarting(false);
  };

  const gardeStatus = currentShift
    ? `En cours depuis ${new Date(currentShift.started_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`
    : 'Aucune garde en cours';

  return (
    <div className="p-6 lg:p-8">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Tableau de bord
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Vue d'ensemble de votre activité officinale
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          title="Garde actuelle"
          value={gardeStatus}
          icon={CalendarClock}
          subtitle={currentShift ? 'Garde en cours' : 'Démarrez une garde pour enregistrer'}
        />
        <StatCard
          title="Chiffre d'affaires"
          value="—"
          icon={TrendingUp}
          subtitle="Ventes du jour (à venir)"
        />
        <StatCard
          title="Dépenses du jour"
          value="—"
          icon={Receipt}
          subtitle="Résumé des dépenses (à venir)"
        />
      </div>

      <section className="mt-8 rounded-lg border border-border bg-card p-6">
        <h2 className="text-lg font-medium text-foreground">Garde</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {currentShift
            ? 'Une garde est en cours. Vous pourrez la clôturer depuis Gestion des Gardes.'
            : 'Démarrez une garde pour enregistrer votre tour et associer les ventes et dépenses.'}
        </p>
        {error && (
          <p className="mt-2 text-sm text-destructive" role="alert">
            {error}
          </p>
        )}
        <Button
          className="mt-4"
          onClick={handleStartShift}
          disabled={!!currentShift || isStarting}
          isLoading={isStarting}
        >
          <Play className="mr-2 h-4 w-4" aria-hidden />
          Démarrer la Garde
        </Button>
      </section>
    </div>
  );
}

function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
}: {
  title: string;
  value: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-muted-foreground">{title}</p>
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/15 text-primary">
          <Icon className="h-4 w-4" aria-hidden />
        </div>
      </div>
      <p className="mt-2 text-xl font-semibold text-foreground">{value}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>
    </div>
  );
}

export default Dashboard;
