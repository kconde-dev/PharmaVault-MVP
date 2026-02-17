import { useEffect, useState, useCallback } from 'react';
import { RotateCcw } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { formatSupabaseError } from '@/lib/supabaseError';
import { useAuth } from '@/hooks/useAuth';
import AppToast, { type ToastVariant } from '@/components/AppToast';

type DbPaymentMethod = 'Espèces' | 'Orange Money (Code Marchand)';

interface LedgerTransaction {
  id: string;
  created_at: string;
  description: string;
  type: string;
  amount: number;
  shift_id: string;
  created_by?: string | null;
  cashier_name?: string | null;
  payment_method?: string | null;
  status?: string | null;
}

function getTodayDateInputValue(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getDateBounds(dateValue: string): { start: string; end: string } {
  const startDate = new Date(`${dateValue}T00:00:00`);
  const endDate = new Date(`${dateValue}T23:59:59.999`);
  return {
    start: startDate.toISOString(),
    end: endDate.toISOString(),
  };
}

function formatTime(dateIso: string): string {
  return new Date(dateIso).toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function formatAmount(amount: number): string {
  return amount.toLocaleString('fr-FR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function TransactionLedger() {
  const { role, user } = useAuth();
  const isAdmin = role?.toLowerCase() === 'admin' || role?.toLowerCase() === 'administrator';
  const [selectedDate, setSelectedDate] = useState<string>(getTodayDateInputValue());
  const [transactions, setTransactions] = useState<LedgerTransaction[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [returnTarget, setReturnTarget] = useState<LedgerTransaction | null>(null);
  const [returnReason, setReturnReason] = useState<'Erreur de saisie' | 'Produit retourné' | 'Erreur prix'>('Erreur de saisie');
  const [isSubmittingReturn, setIsSubmittingReturn] = useState(false);
  const [toast, setToast] = useState<{ variant: ToastVariant; title: string; message: string; hint?: string } | null>(null);

  const normalizePaymentMethodForDb = (raw: string | null | undefined): DbPaymentMethod => {
    const value = String(raw || '').trim().toLowerCase();
    if (
      value === 'orange money (code marchand)'
      || value === 'orange_money'
      || value === 'mobile_money'
      || value === 'orange money'
    ) {
      return 'Orange Money (Code Marchand)';
    }
    return 'Espèces';
  };

  const getAdminName = (): string => {
    const meta = (user?.user_metadata || {}) as Record<string, unknown>;
    const fullName = typeof meta.full_name === 'string' ? meta.full_name.trim() : '';
    if (fullName) return fullName;
    const name = typeof meta.name === 'string' ? meta.name.trim() : '';
    if (name) return name;
    const email = String(user?.email || '').trim();
    if (email.includes('@')) return email.split('@')[0];
    return email || 'Admin';
  };

  const loadTransactions = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { start, end } = getDateBounds(selectedDate);
      const { data, error: fetchError } = await supabase
        .from('transactions')
        .select('id, created_at, description, type, amount, shift_id, created_by, cashier_name, payment_method, status')
        .gte('created_at', start)
        .lte('created_at', end)
        .order('created_at', { ascending: false });

      if (fetchError) {
        const message = formatSupabaseError(fetchError, 'Erreur de chargement des transactions.');
        setError(message);
        setTransactions([]);
        setToast({
          variant: 'error',
          title: 'Journal indisponible',
          message,
        });
      } else {
        setTransactions((data || []) as LedgerTransaction[]);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur réseau.';
      setError(message);
      setTransactions([]);
      setToast({
        variant: 'error',
        title: 'Échec de chargement',
        message,
      });
    }

    setIsLoading(false);
  }, [selectedDate]);

  useEffect(() => {
    let isMounted = true;
    let pollId: ReturnType<typeof setInterval> | null = null;

    const fetchTransactions = async () => {
      await loadTransactions();
      if (!isMounted) return;
    };

    void fetchTransactions();
    pollId = setInterval(() => {
      void fetchTransactions();
    }, 15000);

    return () => {
      isMounted = false;
      if (pollId) {
        clearInterval(pollId);
      }
    };
  }, [loadTransactions]);

  const handleReturnTransaction = async () => {
    if (!returnTarget || !user) return;
    if (!returnReason.trim()) {
      setError('Veuillez renseigner le motif du retour.');
      return;
    }

    setIsSubmittingReturn(true);
    setError(null);

    const paymentMethod = normalizePaymentMethodForDb(returnTarget.payment_method);
    const returnAmount = -Math.abs(Number(returnTarget.amount || 0));

    try {
      const { error: updateError } = await supabase
        .from('transactions')
        .update({
          status: 'Retourné',
        })
        .eq('id', returnTarget.id);

      if (updateError) {
        setError(formatSupabaseError(updateError, 'Erreur lors de la mise à jour du statut de retour.'));
        setToast({
          variant: 'error',
          title: 'Retour refusé',
          message: formatSupabaseError(updateError, 'Impossible de mettre à jour la transaction.'),
        });
        setIsSubmittingReturn(false);
        return;
      }

      const reversalPayload = {
        shift_id: returnTarget.shift_id,
        amount: returnAmount,
        description: `Remboursement: ${returnTarget.description || returnTarget.id}`,
        type: 'Retour',
        category: 'Retour',
        payment_method: paymentMethod,
        status: 'Retourné',
        created_by: user.id,
        is_approved: true,
      };

      const { error: createError } = await supabase
        .from('transactions')
        .insert(reversalPayload);

      if (createError) {
        setError(formatSupabaseError(createError, 'Erreur lors de la création de la transaction de retour.'));
        setToast({
          variant: 'error',
          title: 'Retour incomplet',
          message: formatSupabaseError(createError, 'La transaction de remboursement n’a pas pu être créée.'),
        });
        setIsSubmittingReturn(false);
        return;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur réseau pendant le retour.';
      setError(message);
      setToast({
        variant: 'error',
        title: 'Retour échoué',
        message,
      });
      setIsSubmittingReturn(false);
      return;
    }

    const amountLabel = formatAmount(Math.abs(returnTarget.amount || 0));
    window.alert(`Transaction annulée. Veuillez retirer ${amountLabel} GNF de la caisse pour le client.`);
    setReturnTarget(null);
    setReturnReason('Erreur de saisie');
    setIsSubmittingReturn(false);
    await loadTransactions();
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
      <AppToast
        open={Boolean(toast)}
        variant={toast?.variant || 'error'}
        title={toast?.title || ''}
        message={toast?.message || ''}
        hint={toast?.hint}
        onClose={() => setToast(null)}
      />
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-black text-slate-900" title="Live Cash Ledger">Journal de Caisse en Direct</h2>
          <p className="text-xs font-medium text-slate-500" title="Daily transaction journal">Journal des transactions quotidiennes</p>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="ledger-date" className="text-xs font-bold uppercase tracking-wider text-slate-600">
            Date
          </label>
          <input
            id="ledger-date"
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="h-10 rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
          />
        </div>
      </header>

      {isLoading ? (
        <div className="py-8 text-center text-sm font-semibold text-slate-500">Chargement des transactions...</div>
      ) : error ? (
        <div className="py-8 text-center text-sm font-semibold text-rose-600">{error}</div>
      ) : transactions.length === 0 ? (
        <div className="py-8 text-center text-sm font-semibold text-slate-500">
          Aucune transaction pour aujourd'hui. Commencez par en ajouter une !
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wider text-slate-500">
                <th className="pb-3 pr-4 font-bold" title="Time">Heure</th>
                <th className="pb-3 pr-4 font-bold" title="Cashier">Caissier</th>
                <th className="pb-3 pr-4 font-bold" title="Category">Catégorie</th>
                <th className="pb-3 pr-4 font-bold" title="Nature">Nature</th>
                <th className="pb-3 text-right font-bold" title="Amount">Montant</th>
                {isAdmin && <th className="pb-3 pl-4 text-right font-bold">Action</th>}
              </tr>
            </thead>
            <tbody>
              {transactions.map((tx) => (
                <tr key={tx.id} className="border-b border-slate-100 last:border-0">
                  <td className="py-3 pr-4 font-medium text-slate-700">{formatTime(tx.created_at)}</td>
                  <td className="py-3 pr-4 font-semibold text-slate-800">{tx.cashier_name || tx.created_by || '—'}</td>
                  <td className="py-3 pr-4 font-semibold text-slate-900">{tx.description || '-'}</td>
                  <td className="py-3 pr-4 capitalize text-slate-600">{tx.type}</td>
                  <td className="py-3 text-right">
                    <span className={(tx.amount || 0) >= 0 ? 'font-black text-emerald-600' : 'font-black text-rose-600'}>
                      {(tx.amount || 0) >= 0 ? '+' : '-'}
                      {formatAmount(tx.amount)}
                    </span>
                  </td>
                  {isAdmin && (
                    <td className="py-3 pl-4 text-right">
                      <button
                        type="button"
                        onClick={() => {
                          setReturnTarget(tx);
                          setReturnReason('Erreur de saisie');
                        }}
                        className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-100"
                        title="Rembourser"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        Rembourser
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {returnTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
            <h3 className="text-lg font-black text-slate-900">Confirmer le Retour - Pharmacie Djoma</h3>
            <p className="mt-2 text-sm text-slate-600">
              Transaction : <span className="font-bold text-slate-900">{returnTarget.description || returnTarget.id}</span>
            </p>
            <label htmlFor="return-reason" className="mt-4 block text-xs font-bold uppercase tracking-wider text-slate-600">
              Motif du retour
            </label>
            <select
              id="return-reason"
              value={returnReason}
              onChange={(e) => setReturnReason(e.target.value as 'Erreur de saisie' | 'Produit retourné' | 'Erreur prix')}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            >
              <option value="Erreur de saisie">Erreur de saisie</option>
              <option value="Produit retourné">Produit retourné</option>
              <option value="Erreur prix">Erreur prix</option>
            </select>
            <label className="mt-4 block text-xs font-bold uppercase tracking-wider text-slate-600">
              Validation admin
            </label>
            <div className="mt-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-800">
              {getAdminName()}
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setReturnTarget(null);
                  setReturnReason('Erreur de saisie');
                }}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
                disabled={isSubmittingReturn}
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={() => { void handleReturnTransaction(); }}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-60"
                disabled={isSubmittingReturn}
              >
                {isSubmittingReturn ? 'Validation...' : 'Valider le retour'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export default TransactionLedger;
