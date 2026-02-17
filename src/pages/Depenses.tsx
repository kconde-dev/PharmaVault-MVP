import { useEffect, useState, useCallback } from 'react';
import { useConnection } from '@/context/ConnectionContext';
import { AlertCircle, Clock, Plus, Trash2, CheckCircle, ClipboardList } from 'lucide-react';
import { Button } from '@/components/ui/button';
import AppToast, { type ToastVariant } from '@/components/AppToast';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import type { Shift, Transaction, PaymentMethod } from '@/lib/database.types';
import { formatSupabaseError } from '@/lib/supabaseError';

function normalizeMethodLabel(method: string): PaymentMethod {
  if (method === 'Espèces' || method === 'Orange Money (Code Marchand)' || method === 'espèces' || method === 'orange_money') {
    return method;
  }
  return 'Espèces';
}

function isExpenseType(type: string): boolean {
  const value = type.toLowerCase();
  return value === 'dépense' || value === 'depense' || value === 'expense';
}

type ApprovalQueueFilter = 'urgent' | 'oldest' | 'high_amount';

function getAgeInMinutes(isoDate: string): number {
  const createdAt = new Date(isoDate).getTime();
  if (!Number.isFinite(createdAt)) return 0;
  const diffMs = Date.now() - createdAt;
  return Math.max(0, Math.floor(diffMs / (1000 * 60)));
}

function formatAgeBadge(isoDate: string): string {
  const minutes = getAgeInMinutes(isoDate);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h`;
  const days = Math.floor(hours / 24);
  return `${days} j`;
}

function isUrgentExpense(amount: number, createdAt: string): boolean {
  return amount >= 500000 || getAgeInMinutes(createdAt) >= 120;
}

function ownerLabel(rawOwner: string): string {
  const value = String(rawOwner || '').trim();
  if (!value) return 'Inconnu';
  if (value.includes('@')) return value.split('@')[0];
  return value.slice(0, 8);
}

export function Depenses() {
  const { user, role } = useAuth();
  const { isOnline } = useConnection();
  const [currentShift, setCurrentShift] = useState<Shift | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ variant: ToastVariant; title: string; message: string; hint?: string } | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{ amount?: string; description?: string }>({});
  const [pendingAction, setPendingAction] = useState<{
    type: 'delete' | 'approve' | 'reject';
    id: string;
    amount: number;
    description: string;
  } | null>(null);
  const [queueFilter, setQueueFilter] = useState<ApprovalQueueFilter>('urgent');

  // Form state
  const [formData, setFormData] = useState({
    amount: '',
    description: '',
    method: 'Espèces' as PaymentMethod,
  });

  // Fetch active shift
  const fetchActiveShift = useCallback(async () => {
    if (!user) return null;
    const { data } = await supabase
      .from('shifts')
      .select('id, user_id, started_at, ended_at')
      .eq('user_id', user.id)
      .is('ended_at', null)
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    return data ?? null;
  }, [user]);

  // Helper to query expenses
  const queryExpenses = async () => {
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      return { data: null, error };
    }

    const rows = (data || []) as Array<Transaction & { type: string; payment_method?: string; cashier_id?: string; is_approved?: boolean; shift_id?: string }>;
    const normalized = rows
      .filter((t) => isExpenseType(String(t.type || '')))
      .map((t) => ({
        ...t,
        type: 'dépense',
        method: normalizeMethodLabel(
          String(
            t.method ||
            (t.payment_method === 'Espèces'
              ? 'Espèces'
              : t.payment_method === 'Orange Money (Code Marchand)'
                ? 'Orange Money (Code Marchand)'
                :
            (t.payment_method === 'cash'
              ? 'Espèces'
              : t.payment_method === 'mobile_money'
                ? 'Orange Money (Code Marchand)'
                : 'Espèces'))
          )
        ),
        created_by: t.created_by || t.cashier_id || '',
        status: t.status === 'validé' || t.status === 'approved' || t.is_approved === true
          ? 'approved'
          : t.status === 'rejeté' || t.status === 'rejected'
            ? 'rejected'
            : 'pending',
      }));

    return { data: normalized as Transaction[], error: null };
  };

  const refreshTransactions = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    const { data, error: err } = await queryExpenses();
    if (err) {
      setError(formatSupabaseError(err, 'Erreur de chargement des dépenses.'));
    } else {
      setTransactions((data || []) as Transaction[]);
    }
    setIsLoading(false);
  }, [user]);

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      // Load Active Shift
      const shift = await fetchActiveShift();
      if (!mounted) return;
      setCurrentShift(shift);

      // Load Expenses
      if (user) {
        setIsLoading(true);
        const { data, error: err } = await queryExpenses();
        if (mounted) {
          if (err) setError(formatSupabaseError(err, 'Erreur de chargement des dépenses.'));
          else setTransactions((data || []) as Transaction[]);
          setIsLoading(false);
        }
      }
    };

    init();

    return () => {
      mounted = false;
    };
  }, [fetchActiveShift, user]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const isAdmin = role?.toLowerCase() === 'admin' || role?.toLowerCase() === 'administrator';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setFieldErrors({});

    if (!user || !currentShift) {
      setError('Une garde active est requise pour enregistrer une dépense.');
      return;
    }

    const amountValue = Number.parseFloat(formData.amount);
    if (!Number.isFinite(amountValue) || amountValue <= 0) {
      setFieldErrors((prev) => ({ ...prev, amount: 'Entrez un montant supérieur à zéro.' }));
      return;
    }

    if (formData.description.trim().length < 3) {
      setFieldErrors((prev) => ({ ...prev, description: 'Décrivez la dépense en au moins 3 caractères.' }));
      return;
    }

    setIsLoading(true);
    const payload = {
      shift_id: currentShift.id,
      amount: amountValue,
      description: formData.description,
      type: 'Dépense',
      category: 'Dépense',
      payment_method: formData.method,
      status: 'approved',
      is_approved: true,
      created_by: user.id,
    };

    const { error: insertError } = await supabase.from('transactions').insert(payload);

    setIsLoading(false);

    if (insertError) {
      setError(formatSupabaseError(insertError, 'Erreur lors de l\'enregistrement de la dépense.'));
      setToast({
        variant: 'error',
        title: 'Echec enregistrement',
        message: 'La dépense n’a pas été enregistrée.',
        hint: 'Vérifiez la connexion puis réessayez.',
      });
      return;
    }

    // Reset form and refresh list
    setFormData({ amount: '', description: '', method: 'Espèces' });
    setShowForm(false);
    await refreshTransactions();
    setToast({
      variant: 'success',
      title: 'Depense enregistree',
      message: 'La sortie de caisse a été ajoutée.',
      hint: isAdmin ? 'Vérifiez la file d’approbation.' : 'Attendez la validation admin.',
    });
  };

  const requestAction = (id: string, type: 'delete' | 'approve' | 'reject') => {
    const tx = transactions.find((item) => item.id === id);
    if (!tx) return;
    setPendingAction({
      type,
      id,
      amount: tx.amount,
      description: tx.description,
    });
  };

  const executePendingAction = async () => {
    if (!pendingAction) return;
    setError(null);
    const action = pendingAction;
    setPendingAction(null);

    if (action.type === 'delete') {
      const { error: deleteError } = await supabase
        .from('transactions')
        .delete()
        .eq('id', action.id);

      if (deleteError) {
        setError(formatSupabaseError(deleteError, 'Erreur lors de la suppression.'));
        setToast({
          variant: 'error',
          title: 'Suppression echouee',
          message: 'Impossible de supprimer cette dépense.',
        });
        return;
      }

      await refreshTransactions();
      setToast({
        variant: 'success',
        title: 'Depense supprimee',
        message: 'L’élément a été retiré du registre.',
      });
      return;
    }

    const updatePayload = action.type === 'approve'
      ? {
          status: 'approved',
          is_approved: true,
          approved_by: user?.id,
          approved_at: new Date().toISOString(),
        }
      : {
          status: 'rejected',
          is_approved: false,
          rejected_by: user?.id,
          rejected_at: new Date().toISOString(),
        };

    const { error: updateError } = await supabase
      .from('transactions')
      .update(updatePayload)
      .eq('id', action.id);

    if (updateError) {
      setError(
        formatSupabaseError(
          updateError,
          action.type === 'approve' ? 'Erreur lors de l\'approbation.' : 'Erreur lors du rejet.'
        )
      );
      setToast({
        variant: 'error',
        title: action.type === 'approve' ? 'Validation echouee' : 'Rejet echoue',
        message: 'La mise à jour du statut a échoué.',
      });
      return;
    }

    await refreshTransactions();
    setToast({
      variant: 'success',
      title: action.type === 'approve' ? 'Depense validee' : 'Depense rejetee',
      message: action.type === 'approve' ? 'La demande est approuvée.' : 'La demande est rejetée.',
      hint: 'Le statut est synchronisé dans le journal.',
    });
  };

  const totalExpenses = transactions.reduce((sum, t) => sum + t.amount, 0);
  const pendingExpenses = transactions.filter(t => t.status === 'pending').length;
  const approvedExpenses = transactions.filter(t => t.status === 'approved').length;
  const pendingQueue = transactions.filter((t) => t.status === 'pending');
  const filteredPendingQueue = [...pendingQueue].sort((a, b) => {
    if (queueFilter === 'oldest') {
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    }
    if (queueFilter === 'high_amount') {
      return b.amount - a.amount;
    }
    const urgencyA = Number(isUrgentExpense(a.amount, a.created_at));
    const urgencyB = Number(isUrgentExpense(b.amount, b.created_at));
    if (urgencyA !== urgencyB) return urgencyB - urgencyA;
    return getAgeInMinutes(b.created_at) - getAgeInMinutes(a.created_at);
  });

  return (
    <div className="p-6 lg:p-10 space-y-10">
      <AppToast
        open={Boolean(toast)}
        variant={toast?.variant || 'success'}
        title={toast?.title || ''}
        message={toast?.message || ''}
        hint={toast?.hint}
        onClose={() => setToast(null)}
      />
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="h-2 w-8 bg-rose-500 rounded-full" />
            <span className="text-[10px] font-bold text-rose-600 uppercase tracking-[0.2em]">Flux de Sortie</span>
          </div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900">
            Gestion des Dépenses
          </h1>
          <p className="mt-1 text-sm font-medium text-slate-500">
            Rapport de charges et validation des sorties de caisse.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex h-11 px-4 items-center gap-2 bg-white rounded-xl border border-slate-200 shadow-sm text-xs font-bold text-slate-600">
            <div className={`h-2 w-2 rounded-full ${isOnline ? 'bg-emerald-500' : 'bg-rose-500 animate-pulse'}`} />
            {isOnline ? 'Serveur Synchronisé' : 'Mode Local'}
          </div>
        </div>
      </header>

      {!currentShift && (
        <div className="p-5 rounded-2xl bg-rose-50 border border-rose-100 flex items-center gap-4 animate-in slide-in-from-top-4">
          <div className="h-10 w-10 rounded-xl bg-white flex items-center justify-center shadow-sm text-rose-600">
            <AlertCircle className="h-6 w-6" />
          </div>
          <p className="text-sm font-bold text-rose-900">
            ⚠️ Attention: Aucune garde active détectée. Veuillez ouvrir une caisse pour enregistrer des frais.
          </p>
        </div>
      )}

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <div className="stats-card">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Total Décaissé</p>
          <p className="text-2xl font-black text-slate-900">
            {totalExpenses.toFixed(2).replace('.', ',')}
          </p>
          <div className="mt-2 flex items-center gap-1 text-[10px] font-bold text-slate-400">
            GNF <span className="text-rose-500 font-black">SORTIE BRUTE</span>
          </div>
        </div>

        <div className="stats-card border-l-4 border-l-amber-500">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">En Attente</p>
          <p className="text-2xl font-black text-amber-600">
            {pendingExpenses}
          </p>
          <div className="mt-2 flex items-center gap-1 text-[10px] font-bold text-slate-400 uppercase">
            Demandes <Clock className="h-3 w-3" />
          </div>
        </div>

        <div className="stats-card border-l-4 border-l-emerald-500">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Validées</p>
          <p className="text-2xl font-black text-emerald-600">
            {approvedExpenses}
          </p>
          <div className="mt-2 flex items-center gap-1 text-[10px] font-bold text-slate-400 uppercase">
            Confirmées <CheckCircle className="h-3 w-3" />
          </div>
        </div>

        <div className="stats-card">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">État Guichet</p>
          <div className="flex items-center gap-2">
            {currentShift ? (
              <span className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-1 text-[10px] font-bold text-emerald-600 uppercase border border-emerald-100">
                Ouvert
              </span>
            ) : (
              <span className="flex items-center gap-3 rounded-lg bg-slate-50 px-3 py-1 text-[10px] font-bold text-slate-400 uppercase border border-slate-200">
                Fermé
              </span>
            )}
          </div>
        </div>
      </div>

      {isAdmin && (
        <section className="p-8 rounded-[2rem] bg-indigo-50/50 border border-indigo-100 shadow-sm animate-in fade-in duration-500">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-sm font-black text-indigo-900 uppercase tracking-[0.2em] flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-indigo-500" />
              Demandes d'Approbation prioritaires
            </h2>
            <span className="text-[10px] font-bold text-indigo-400 bg-white px-3 py-1 rounded-full shadow-inner">
              PANEL DE CONTRÔLE ADMIN
            </span>
          </div>

          <div className="mb-5 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setQueueFilter('urgent')}
              className={`rounded-lg px-3 py-1.5 text-[10px] font-black uppercase tracking-wider transition ${
                queueFilter === 'urgent'
                  ? 'bg-rose-600 text-white'
                  : 'bg-white text-rose-600 border border-rose-200 hover:bg-rose-50'
              }`}
            >
              Urgent
            </button>
            <button
              type="button"
              onClick={() => setQueueFilter('oldest')}
              className={`rounded-lg px-3 py-1.5 text-[10px] font-black uppercase tracking-wider transition ${
                queueFilter === 'oldest'
                  ? 'bg-indigo-700 text-white'
                  : 'bg-white text-indigo-700 border border-indigo-200 hover:bg-indigo-50'
              }`}
            >
              Oldest
            </button>
            <button
              type="button"
              onClick={() => setQueueFilter('high_amount')}
              className={`rounded-lg px-3 py-1.5 text-[10px] font-black uppercase tracking-wider transition ${
                queueFilter === 'high_amount'
                  ? 'bg-amber-600 text-white'
                  : 'bg-white text-amber-700 border border-amber-200 hover:bg-amber-50'
              }`}
            >
              High amount
            </button>
          </div>

          {filteredPendingQueue.length === 0 ? (
            <div className="text-center py-6 bg-white/40 rounded-2xl border border-dashed border-indigo-200">
              <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">Aucune demande en attente de traitement</p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {filteredPendingQueue.map((tx) => (
                  <div
                    key={tx.id}
                    className="group relative overflow-hidden flex flex-col justify-between rounded-2xl bg-white p-5 border border-indigo-100 shadow-sm hover:shadow-lg hover:shadow-indigo-500/10 transition-all duration-300"
                  >
                    <div className="mb-3 flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center rounded-full border border-amber-100 bg-amber-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-amber-700">
                        En attente
                      </span>
                      <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-slate-600">
                        Âge: {formatAgeBadge(tx.created_at)}
                      </span>
                      {isUrgentExpense(tx.amount, tx.created_at) && (
                        <span className="inline-flex items-center rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-rose-700">
                          Urgent
                        </span>
                      )}
                    </div>
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mb-1">{tx.method}</p>
                        <p className="text-sm font-black text-slate-800 uppercase tracking-tight line-clamp-1">{tx.description}</p>
                      </div>
                      <span className="text-md font-black text-indigo-600 tabular-nums">
                        {tx.amount.toLocaleString('fr-FR')} GNF
                      </span>
                    </div>

                    <div className="flex items-center justify-between border-t border-slate-50 pt-4">
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                        Propriétaire: {ownerLabel(tx.created_by)}
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => requestAction(tx.id, 'reject')}
                          className="px-3 py-1.5 text-[10px] font-black text-rose-500 hover:text-white hover:bg-rose-500 rounded-lg transition-all"
                        >
                          REJETER
                        </button>
                        <button
                          onClick={() => requestAction(tx.id, 'approve')}
                          className="px-4 py-1.5 text-[10px] font-black text-white bg-emerald-500 hover:bg-emerald-600 shadow-lg shadow-emerald-500/20 rounded-lg transition-all"
                        >
                          CAPTURER & VALIDER
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </section>
      )}

      <div className="mb-12">
        {!showForm ? (
          <Button
            onClick={() => setShowForm(true)}
            disabled={!currentShift}
            className="h-14 rounded-2xl pharmacy-gradient text-white font-bold px-8 shadow-xl shadow-emerald-500/20 group hover:scale-[1.02] active:scale-95 transition-all border-0"
          >
            <Plus className="h-5 w-5 mr-2 group-hover:rotate-90 transition-transform" />
            Nouvelle Opération de Dépense
          </Button>
        ) : (
          <form onSubmit={handleSubmit} className="glass-card rounded-3xl p-8 border border-white/40 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-xl font-black text-slate-900">Enregistrer une Dépense</h2>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setShowForm(false)}
                className="h-8 w-8 rounded-full p-0 text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                ✕
              </Button>
            </div>

            {error && (
              <div className="mb-6 rounded-2xl bg-rose-50 border border-rose-100 p-4 text-xs font-bold text-rose-600 uppercase tracking-wide">
                ⚠️ {error}
              </div>
            )}

            <div className="grid gap-6 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">
                  Montant (GNF)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  placeholder="Ex: 100000"
                  value={formData.amount}
                  onChange={(e) => {
                    setFormData({ ...formData, amount: e.target.value });
                    setFieldErrors((prev) => ({ ...prev, amount: undefined }));
                  }}
                  className="w-full h-12 bg-slate-100 border border-slate-200 rounded-xl px-4 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                />
                {fieldErrors.amount && <p className="text-xs font-semibold text-rose-600">{fieldErrors.amount}</p>}
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">
                  Description / Libellé
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Facture Electricité"
                  value={formData.description}
                  onChange={(e) => {
                    setFormData({ ...formData, description: e.target.value });
                    setFieldErrors((prev) => ({ ...prev, description: undefined }));
                  }}
                  className="w-full h-12 bg-slate-100 border border-slate-200 rounded-xl px-4 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                />
                {fieldErrors.description && <p className="text-xs font-semibold text-rose-600">{fieldErrors.description}</p>}
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">
                  Mode de Règlement
                </label>
                <select
                  value={formData.method}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      method: e.target.value as PaymentMethod,
                    })
                  }
                  className="w-full h-12 bg-slate-100 border border-slate-200 rounded-xl px-4 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all appearance-none"
                >
                  <option value="Espèces">Espèces</option>
                  <option value="Orange Money (Code Marchand)">Orange Money (Code Marchand)</option>
                </select>
              </div>
            </div>

            {!isAdmin && (
              <div className="mt-8 p-4 rounded-2xl bg-amber-50 border border-amber-100 text-[10px] font-bold text-amber-700 uppercase tracking-wider">
                ℹ️ Cette opération nécessite une validation administrative avant d'être décomptée du bilan.
              </div>
            )}

            <div className="mt-8 flex gap-4">
              <Button
                type="submit"
                disabled={isLoading || !isOnline}
                className="flex-1 h-12 rounded-xl pharmacy-gradient text-white font-bold border-0 shadow-lg shadow-emerald-500/20"
              >
                {isLoading ? 'Traitement...' : 'Confirmer la Dépense'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowForm(false)}
                className="h-12 rounded-xl px-8 border-slate-200 text-slate-600 font-bold"
              >
                Annuler
              </Button>
            </div>
          </form>
        )}
      </div>

      <div>
        <div className="flex items-center gap-3 mb-6">
          <div className="h-4 w-1 bg-slate-400 rounded-full" />
          <h2 className="text-sm font-bold text-slate-800 uppercase tracking-widest">Historique des Charges</h2>
        </div>

        {isLoading ? (
          <div className="h-40 flex items-center justify-center bg-white rounded-3xl border border-slate-100">
            <p className="text-sm font-bold text-slate-400 animate-pulse uppercase tracking-[0.2em]">Chargement des données...</p>
          </div>
        ) : transactions.length === 0 ? (
          <div className="h-40 flex items-center justify-center bg-white rounded-3xl border border-slate-100">
            <p className="text-sm font-bold text-slate-400 uppercase tracking-[0.2em]">Aucun enregistrement trouvé</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Date / Heure</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Désignation</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Montant (GNF)</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Mode</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Validation</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {transactions.map((tx) => (
                  <tr key={tx.id} className="group hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <p className="text-xs font-bold text-slate-700">
                        {new Date(tx.created_at).toLocaleDateString('fr-FR')}
                      </p>
                      <p className="text-[10px] text-slate-400 font-medium tracking-tight">
                        {new Date(tx.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </td>
                    <td className="px-6 py-4 text-xs font-bold text-slate-900 uppercase tracking-tight italic">
                      {tx.description}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="text-sm font-black text-slate-900 tabular-nums">
                        {tx.amount.toLocaleString('fr-FR', { minimumFractionDigits: 2 })}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter flex items-center gap-1.5">
                        {tx.method === 'espèces'
                          ? '💵 Espèces'
                          : tx.method === 'orange_money'
                            ? '📱 O. Money'
                            : tx.method === 'virement_cheque'
                              ? '🏦 Virement / Chèque'
                              : tx.method === 'carte_bancaire'
                                ? '💳 Carte Bancaire'
                                : '💵 Espèces'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-widest ${tx.status === 'pending'
                          ? 'bg-amber-50 text-amber-600 border border-amber-100'
                          : tx.status === 'rejected'
                            ? 'bg-rose-50 text-rose-600 border border-rose-100'
                            : 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                          }`}
                      >
                        {tx.status === 'pending' ? 'En attente' : tx.status === 'rejected' ? 'Rejeté' : '✓ Validé'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        {isAdmin && tx.status === 'pending' && (
                          <button
                            onClick={() => requestAction(tx.id, 'approve')}
                            className="h-8 w-8 flex items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-500 hover:text-white transition-all shadow-sm"
                            title="Approuver"
                          >
                            <CheckCircle className="h-4 w-4" />
                          </button>
                        )}
                        {(!isAdmin || tx.status === 'pending') && (
                          <button
                            onClick={() => requestAction(tx.id, isAdmin ? 'reject' : 'delete')}
                            className="h-8 w-8 flex items-center justify-center rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-500 hover:text-white transition-all shadow-sm"
                            title={isAdmin ? 'Rejeter' : 'Supprimer'}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {pendingAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-slate-300 bg-white p-6 shadow-2xl">
            <h3 className="text-lg font-black text-slate-900">
              {pendingAction.type === 'approve'
                ? 'Confirmer la validation'
                : pendingAction.type === 'reject'
                  ? 'Confirmer le rejet'
                  : 'Confirmer la suppression'}
            </h3>
            <p className="mt-2 text-sm text-slate-600">
              {pendingAction.type === 'approve'
                ? 'Cette dépense sera marquée comme validée.'
                : pendingAction.type === 'reject'
                  ? 'Cette dépense sera marquée comme rejetée.'
                  : 'Cette dépense sera supprimée définitivement.'}
            </p>
            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Dépense ciblée</p>
              <p className="mt-1 text-sm font-bold text-slate-900">{pendingAction.description}</p>
              <p className="text-sm font-black text-slate-800">{pendingAction.amount.toLocaleString('fr-FR')} GNF</p>
            </div>
            <div className="mt-5 flex gap-3">
              <Button type="button" variant="outline" onClick={() => setPendingAction(null)} className="flex-1">
                Annuler
              </Button>
              <Button
                type="button"
                onClick={() => void executePendingAction()}
                className={`flex-1 ${
                  pendingAction.type === 'approve'
                    ? 'bg-emerald-600 hover:bg-emerald-500'
                    : 'bg-rose-600 hover:bg-rose-500'
                } text-white`}
              >
                Confirmer
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Depenses;
