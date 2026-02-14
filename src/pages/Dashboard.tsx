import { useEffect, useState, useCallback } from 'react';
import { useConnection } from '@/context/ConnectionContext';
import { CalendarClock, TrendingUp, Receipt, Play, Plus, X, Share2, Download, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { useNavigate } from 'react-router-dom';
import { generateWhatsAppMessage, shareViaWhatsApp } from '@/lib/whatsapp';

type Shift = {
  id: string;
  user_id: string;
  started_at: string;
  ended_at: string | null;
  expected_cash?: number | null;
  actual_cash?: number | null;
  cash_difference?: number | null;
};

type Transaction = {
  id: string;
  shift_id: string;
  amount: number;
  description: string;
  type: 'recette' | 'dépense';
  method: 'espèces' | 'orange_money' | 'assurance';
  status: string;
  is_approved: boolean;
  insurance_name: string | null;
  created_at: string;
};

export function Dashboard() {
  const { user, role } = useAuth();
  const { isOnline } = useConnection();
  const navigate = useNavigate();
  const [currentShift, setCurrentShift] = useState<Shift | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [showRecetteForm, setShowRecetteForm] = useState(false);
  const [showCloseShiftForm, setShowCloseShiftForm] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Recette form state
  const [recetteForm, setRecetteForm] = useState({
    amount: '',
    method: 'espèces' as 'espèces' | 'orange_money' | 'assurance',
    insuranceName: '',
  });

  // Close shift form state
  const [closeShiftForm, setCloseShiftForm] = useState({
    actualCash: '',
  });

  // Closed shift summary state (for success screen)
  type ClosedShiftSummary = {
    date: string;
    totalRecettes: number;
    recettesEspeces: number;
    recettesOrangeMoney: number;
    recettesAssurance: number;
    totalDepenses: number;
    cashDifference: number;
  };

  const [closedShiftSummary, setClosedShiftSummary] = useState<ClosedShiftSummary | null>(null);

  // Admin daily totals (24h) snapshot
  const [dailyTotals, setDailyTotals] = useState({
    especes: 0,
    orange: 0,
    assurances: 0,
  });

  useEffect(() => {
    if (role !== 'administrator') return;

    const loadDailyTotals = async () => {
      try {
        const start = new Date();
        start.setHours(0, 0, 0, 0);
        const end = new Date(start);
        end.setDate(start.getDate() + 1);

        const { data, error } = await supabase
          .from('transactions')
          .select('amount, method, type')
          .gte('created_at', start.toISOString())
          .lt('created_at', end.toISOString());

        if (error) {
          console.error('Failed to load daily totals:', error);
          return;
        }

        const rows = data || [];
        const totals = rows.reduce(
          (acc: any, r: any) => {
            if (r.type === 'recette') {
              if (r.method === 'espèces') acc.especes += r.amount;
              if (r.method === 'orange_money') acc.orange += r.amount;
              if (r.method === 'assurance') acc.assurances += r.amount;
            }
            return acc;
          },
          { especes: 0, orange: 0, assurances: 0 }
        );

        setDailyTotals(totals);
      } catch (err) {
        console.error('Error loading daily snapshot:', err);
      }
    };

    loadDailyTotals();
  }, [role]);

  const fetchActiveShift = useCallback(async () => {
    if (!user) return null;
    const { data, error: err } = await supabase
      .from('shifts')
      .select('id, user_id, started_at, ended_at, expected_cash, actual_cash, cash_difference')
      .eq('user_id', user.id)
      .is('ended_at', null)
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (err) return null;
    return data ?? null;
  }, [user]);

  // Fetch transactions for current shift
  const fetchTransactions = useCallback(async () => {
    if (!currentShift) return;
    const { data } = await supabase
      .from('transactions')
      .select('*')
      .eq('shift_id', currentShift.id)
      .order('created_at', { ascending: false });
    setTransactions((data || []) as Transaction[]);
  }, [currentShift]);

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

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  const handleStartShift = async () => {
    setError(null);
    setClosedShiftSummary(null); // Clear closed shift summary
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

  const handleAddRecette = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!user || !currentShift) {
      setError('Une garde active est requise.');
      return;
    }

    if (!recetteForm.amount || isNaN(parseFloat(recetteForm.amount))) {
      setError('Montant invalide.');
      return;
    }

    if (recetteForm.method === 'assurance' && !recetteForm.insuranceName.trim()) {
      setError('Veuillez spécifier le nom de l\'assurance.');
      return;
    }

    const { error: insertError } = await supabase.from('transactions').insert({
      shift_id: currentShift.id,
      amount: parseFloat(recetteForm.amount),
      description: 'Recette',
      type: 'recette',
      method: recetteForm.method,
      status: 'validé',
      is_approved: true,
      insurance_name: recetteForm.method === 'assurance' ? recetteForm.insuranceName : null,
      created_by: user.id,
    });

    if (insertError) {
      setError(insertError.message || 'Erreur lors de l\'enregistrement.');
      return;
    }

    // Reset and refresh
    setRecetteForm({ amount: '', method: 'espèces', insuranceName: '' });
    setShowRecetteForm(false);
    await fetchTransactions();
  };

  const handleCloseShift = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!currentShift) {
      setError('Aucune garde active.');
      return;
    }

    if (!closeShiftForm.actualCash || isNaN(parseFloat(closeShiftForm.actualCash))) {
      setError('Montant du tiroir invalide.');
      return;
    }

    const actualCashAmount = parseFloat(closeShiftForm.actualCash);
    
    // Calculate totals by method
    const recettesEspeces = transactions
      .filter(t => t.type === 'recette' && t.method === 'espèces')
      .reduce((sum, t) => sum + t.amount, 0);

    const recettesOrangeMoney = transactions
      .filter(t => t.type === 'recette' && t.method === 'orange_money')
      .reduce((sum, t) => sum + t.amount, 0);

    const recettesAssurance = transactions
      .filter(t => t.type === 'recette' && t.method === 'assurance')
      .reduce((sum, t) => sum + t.amount, 0);

    const totalRecettes = recettesEspeces + recettesOrangeMoney + recettesAssurance;

    const totalDepenses = transactions
      .filter(t => t.type === 'dépense' && t.is_approved)
      .reduce((sum, t) => sum + t.amount, 0);

    // Expected cash = espèces income + approved espèces expenses
    const expectedCash = transactions
      .filter(t => t.method === 'espèces')
      .reduce((sum, t) => {
        if (t.type === 'recette') {
          return sum + t.amount;
        } else if (t.type === 'dépense' && t.is_approved) {
          return sum - t.amount;
        }
        return sum;
      }, 0);

    // Difference between what's in the drawer and what we expect
    const cashDifference = actualCashAmount - expectedCash;

    const { error: updateError } = await supabase
      .from('shifts')
      .update({
        ended_at: new Date().toISOString(),
        expected_cash: expectedCash,
        actual_cash: actualCashAmount,
        cash_difference: cashDifference,
        closed_by: user?.id,
      })
      .eq('id', currentShift.id);

    if (updateError) {
      setError(updateError.message || 'Erreur lors de la clôture.');
      return;
    }

    // Set the summary for the success screen
    setClosedShiftSummary({
      date: new Date().toLocaleDateString('fr-FR'),
      totalRecettes,
      recettesEspeces,
      recettesOrangeMoney,
      recettesAssurance,
      totalDepenses,
      cashDifference,
    });

    setShowCloseShiftForm(false);
    setCloseShiftForm({ actualCash: '' });
  };

  const totalRecettes = transactions
    .filter(t => t.type === 'recette')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalDepenses = transactions
    .filter(t => t.type === 'dépense')
    .reduce((sum, t) => sum + t.amount, 0);

  // Breakdown of recettes by method
  const recettesEspeces = transactions
    .filter(t => t.type === 'recette' && t.method === 'espèces')
    .reduce((sum, t) => sum + t.amount, 0);

  const recettesOrangeMoney = transactions
    .filter(t => t.type === 'recette' && t.method === 'orange_money')
    .reduce((sum, t) => sum + t.amount, 0);

  const recettesAssurance = transactions
    .filter(t => t.type === 'recette' && t.method === 'assurance')
    .reduce((sum, t) => sum + t.amount, 0);

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

      {role === 'administrator' && (
        <section className="mb-6">
          <div className="grid grid-cols-3 gap-4">
            <div className="rounded-lg border border-border bg-card p-4">
              <p className="text-xs text-muted-foreground">💵 Espèces (24h)</p>
              <p className="mt-2 text-lg font-bold text-foreground">{dailyTotals.especes.toFixed(2).replace('.', ',')} GNF</p>
            </div>
            <div className="rounded-lg border border-border bg-card p-4">
              <p className="text-xs text-muted-foreground">📱 Orange Paiement Marchand (24h)</p>
              <p className="mt-2 text-lg font-bold text-foreground">{dailyTotals.orange.toFixed(2).replace('.', ',')} GNF</p>
            </div>
            <div className="rounded-lg border border-border bg-card p-4">
              <p className="text-xs text-muted-foreground">🏥 Assurances (24h)</p>
              <p className="mt-2 text-lg font-bold text-foreground">{dailyTotals.assurances.toFixed(2).replace('.', ',')} GNF</p>
            </div>
          </div>
        </section>
      )}

      {closedShiftSummary && (
        <section className="mb-8 rounded-lg border border-green-200 bg-green-50 p-8">
          <div className="mb-6 flex items-center justify-center gap-3">
            <CheckCircle className="h-8 w-8 text-green-600" />
            <h2 className="text-2xl font-bold text-green-900">Garde Clôturée avec Succès</h2>
          </div>

          <div className="space-y-4 rounded-lg border border-green-200 bg-white p-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-sm text-muted-foreground">Date</p>
                <p className="mt-1 font-semibold text-foreground">{closedShiftSummary.date}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Caissier</p>
                <p className="mt-1 font-semibold text-foreground">
                  {user?.email?.split('@')[0] || 'Utilisateur'}
                </p>
              </div>
            </div>

            <div className="border-t border-border pt-4">
              <p className="text-sm font-medium text-foreground">Recettes Totales</p>
              <p className="mt-2 text-2xl font-bold text-green-600">
                {closedShiftSummary.totalRecettes.toFixed(2).replace('.', ',')} GNF
              </p>
              <div className="mt-3 space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">💵 Espèces</span>
                  <span>{closedShiftSummary.recettesEspeces.toFixed(2).replace('.', ',')} GNF</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">📱 Orange Money</span>
                  <span>{closedShiftSummary.recettesOrangeMoney.toFixed(2).replace('.', ',')} GNF</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">🏥 Assurance</span>
                  <span>{closedShiftSummary.recettesAssurance.toFixed(2).replace('.', ',')} GNF</span>
                </div>
              </div>
            </div>

            <div className="border-t border-border pt-4">
              <p className="text-sm text-muted-foreground">Dépenses Approuvées</p>
              <p className="mt-1 font-semibold text-foreground">
                {closedShiftSummary.totalDepenses.toFixed(2).replace('.', ',')} GNF
              </p>
            </div>

            <div className="border-t border-border pt-4">
              <p className="text-sm text-muted-foreground">Écart de Caisse</p>
              <p
                className={`mt-1 text-lg font-bold ${
                  closedShiftSummary.cashDifference === 0
                    ? 'text-green-600'
                    : closedShiftSummary.cashDifference < 0
                      ? 'text-red-600'
                      : 'text-orange-600'
                }`}
              >
                {closedShiftSummary.cashDifference >= 0 ? '+' : ''}
                {closedShiftSummary.cashDifference.toFixed(2).replace('.', ',')} GNF
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {closedShiftSummary.cashDifference === 0
                  ? '✅ Parfait - Aucun écart'
                  : closedShiftSummary.cashDifference < 0
                    ? '❌ Manquant - Vérifiez le tiroir'
                    : '✓ Surplus - Argent supplémentaire'}
              </p>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <Button
              onClick={() => {
                const message = generateWhatsAppMessage({
                  date: closedShiftSummary.date,
                  cashierName: user?.email?.split('@')[0] || 'Caissier',
                  totalRecettes: closedShiftSummary.totalRecettes,
                  recettesEspeces: closedShiftSummary.recettesEspeces,
                  recettesOrangeMoney: closedShiftSummary.recettesOrangeMoney,
                  recettesAssurance: closedShiftSummary.recettesAssurance,
                  totalDepenses: closedShiftSummary.totalDepenses,
                  cashDifference: closedShiftSummary.cashDifference,
                });
                shareViaWhatsApp(message);
              }}
              className="gap-2 bg-green-600 hover:bg-green-700"
            >
              <Share2 className="h-4 w-4" />
              Partager sur WhatsApp
            </Button>
            <Button
              onClick={() => {
                setClosedShiftSummary(null);
                window.location.href = '/dashboard';
              }}
              variant="outline"
            >
              Retour au Tableau de bord
            </Button>
          </div>
        </section>
      )}

      {!closedShiftSummary && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          title="Garde actuelle"
          value={gardeStatus}
          icon={CalendarClock}
          subtitle={currentShift ? 'Garde en cours' : 'Démarrez une garde'}
        />
        <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-muted-foreground">Recettes du jour</p>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/15 text-primary">
              <TrendingUp className="h-4 w-4" aria-hidden />
            </div>
          </div>
          <p className="mt-2 text-xl font-semibold text-foreground">{`${totalRecettes.toFixed(2).replace('.', ',')} GNF`}</p>
          <div className="mt-3 space-y-1 border-t border-border pt-3">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">💵 Espèces</span>
              <span className="font-medium text-foreground">{recettesEspeces.toFixed(2).replace('.', ',')} GNF</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">📱 Orange Money</span>
              <span className="font-medium text-foreground">{recettesOrangeMoney.toFixed(2).replace('.', ',')} GNF</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">🏥 Assurance</span>
              <span className="font-medium text-foreground">{recettesAssurance.toFixed(2).replace('.', ',')} GNF</span>
            </div>
          </div>
        </div>
        <StatCard
          title="Dépenses du jour"
          value={`${totalDepenses.toFixed(2).replace('.', ',')} GNF`}
          icon={Receipt}
          subtitle={`${transactions.filter(t => t.type === 'dépense').length} transactions`}
        />
      </div>

      {error && (
        <div className="mt-6 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {error && (
        <div className="mt-6 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {currentShift && (
        <section className="mt-8 rounded-lg border border-border bg-card p-6">
          <h2 className="text-lg font-medium text-foreground">Actions Rapides</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Enregistrez rapidement les recettes et dépenses de votre garde
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            {!showRecetteForm ? (
              <Button
                onClick={() => setShowRecetteForm(true)}
                className="gap-2"
              >
                <Plus className="h-4 w-4" />
                Nouvelle Recette
              </Button>
            ) : null}

            <Button
              variant="outline"
              onClick={() => navigate('/dashboard/depenses')}
              className="gap-2"
            >
              <Plus className="h-4 w-4" />
              Nouvelle Dépense
            </Button>

            {!showCloseShiftForm ? (
              <Button
                variant="outline"
                onClick={() => setShowCloseShiftForm(true)}
                className="gap-2 text-destructive hover:bg-destructive/10"
              >
                <X className="h-4 w-4" />
                Fin de Garde
              </Button>
            ) : null}
          </div>
        </section>
      )}

      {showRecetteForm && (
        <section className="mt-6 rounded-lg border border-border bg-card p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-medium text-foreground">Nouvelle Recette</h2>
            <button onClick={() => setShowRecetteForm(false)} className="text-muted-foreground hover:text-foreground">
              <X className="h-5 w-5" />
            </button>
          </div>

          <form onSubmit={handleAddRecette} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground">Montant (GNF) *</label>
              <Input
                type="number"
                step="0.01"
                min="0"
                required
                placeholder="Ex: 100000"
                value={recetteForm.amount}
                onChange={(e) => setRecetteForm({ ...recetteForm, amount: e.target.value })}
                className="mt-1"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground">Méthode de paiement *</label>
              <select
                value={recetteForm.method}
                onChange={(e) =>
                  setRecetteForm({
                    ...recetteForm,
                    method: e.target.value as 'espèces' | 'orange_money' | 'assurance',
                  })
                }
                className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground"
              >
                <option value="espèces">💵 Espèces</option>
                <option value="orange_money">📱 Orange Money</option>
                <option value="assurance">🏥 Assurance</option>
              </select>
            </div>

            {recetteForm.method === 'assurance' && (
              <div>
                <label className="block text-sm font-medium text-foreground">Nom de l'assurance *</label>
                <Input
                  type="text"
                  placeholder="Ex: NSIA, Saham"
                  value={recetteForm.insuranceName}
                  onChange={(e) => setRecetteForm({ ...recetteForm, insuranceName: e.target.value })}
                  className="mt-1"
                />
              </div>
            )}

            <div className="flex gap-3">
              <div className="flex-1">
                <Button type="submit" disabled={!isOnline} className="w-full">
                  Enregistrer Recette
                </Button>
                {!isOnline && (
                  <p className="mt-2 text-xs text-amber-700">Connexion perdue. Enregistrement désactivé pour éviter la perte de données.</p>
                )}
              </div>
              <Button type="button" variant="outline" onClick={() => setShowRecetteForm(false)}>
                Annuler
              </Button>
            </div>
          </form>
        </section>
      )}

      {showCloseShiftForm && (
        <section className="mt-6 rounded-lg border border-destructive/30 bg-destructive/5 p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-medium text-foreground">Clôturer la Garde</h2>
            <button onClick={() => setShowCloseShiftForm(false)} className="text-muted-foreground hover:text-foreground">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="mb-4 rounded-lg border border-border bg-card p-4">
            <p className="text-sm text-muted-foreground">
              <strong>Espèces attendues :</strong> {transactions
                .filter(t => t.method === 'espèces')
                .reduce((sum, t) => {
                  if (t.type === 'recette') {
                    return sum + t.amount;
                  } else if (t.type === 'dépense' && t.is_approved) {
                    return sum - t.amount;
                  }
                  return sum;
                }, 0)
                .toFixed(2)
                .replace('.', ',')} GNF
            </p>
          </div>

          <form onSubmit={handleCloseShift} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground">Montant exact du tiroir (GNF) *</label>
              <Input
                type="number"
                step="0.01"
                min="0"
                required
                placeholder="Entrez le montant compté dans le tiroir"
                value={closeShiftForm.actualCash}
                onChange={(e) => setCloseShiftForm({ actualCash: e.target.value })}
                className="mt-1"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Veuillez compter l'argent réel dans le tiroir avant de valider.
              </p>
            </div>

            <div className="flex gap-3">
              <div className="flex-1">
                <Button type="submit" variant="destructive" disabled={!isOnline} className="w-full">
                  Valider la Clôture
                </Button>
                {!isOnline && (
                  <p className="mt-2 text-xs text-amber-700">Connexion requise pour clôturer la garde. Veuillez rétablir internet pour synchroniser le rapport final.</p>
                )}
              </div>
              <Button type="button" variant="outline" onClick={() => setShowCloseShiftForm(false)}>
                Annuler
              </Button>
            </div>
          </form>
        </section>
      )}

      {!currentShift && (
        <section className="mt-8 rounded-lg border border-border bg-card p-6">
          <h2 className="text-lg font-medium text-foreground">Garde</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Démarrez une garde pour enregistrer votre tour et associer les recettes et dépenses.
          </p>
          <Button
            className="mt-4"
            onClick={handleStartShift}
            disabled={isStarting}
            isLoading={isStarting}
          >
            <Play className="mr-2 h-4 w-4" aria-hidden />
            Démarrer la Garde
          </Button>
        </section>
      )}

      {currentShift && transactions.length > 0 && (
        <section className="mt-8 rounded-lg border border-border bg-card p-6">
          <h2 className="text-lg font-medium text-foreground">Transactions Récentes</h2>
          <div className="mt-4 space-y-2">
            {transactions.slice(0, 5).map((tx) => (
              <div key={tx.id} className="flex items-center justify-between border-b border-border py-2 last:border-0">
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {tx.type === 'recette' ? '📥 Recette' : '📤 Dépense'}
                  </p>
                  <p className="text-xs text-muted-foreground">{tx.description}</p>
                </div>
                <p className={`text-sm font-semibold ${tx.type === 'recette' ? 'text-green-600' : 'text-red-600'}`}>
                  {tx.type === 'recette' ? '+' : '-'}{tx.amount.toFixed(2).replace('.', ',')} GNF
                </p>
              </div>
            ))}
          </div>
        </section>
      )}
        </>
      )}
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
