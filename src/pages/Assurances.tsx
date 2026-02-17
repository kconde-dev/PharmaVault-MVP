import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Building2, Landmark, Receipt, PieChart, ArrowUpRight, CheckCircle2, Clock } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import type { Transaction } from '@/lib/database.types';
import { formatSupabaseError } from '@/lib/supabaseError';

type InsuranceGroup = {
  name: string;
  transactions: Transaction[];
  total: number;
  count: number;
};

type InsuranceDebtSummary = {
  insuranceId: string;
  insuranceName: string;
  totalVolume: number;
  totalDue: number;
  transactionCount: number;
};

type InsuranceTransactionRow = Transaction & {
  payment_method?: string;
  category?: string;
  insurance_id?: string | null;
  insurance_payment_status?: string | null;
  amount_covered_by_insurance?: number | null;
};

function normalizeInsuranceStatus(tx: InsuranceTransactionRow): 'pending' | 'approved' | 'rejected' {
  const raw = String(tx.status || '').toLowerCase();
  if (raw === 'approved' || raw === 'validé') return 'approved';
  if (raw === 'rejected' || raw === 'rejeté') return 'rejected';
  if (raw === 'pending' || raw === 'en_attente') return 'pending';
  return 'approved';
}

export function Assurances() {
  const { role, user } = useAuth();
  const [insuranceGroups, setInsuranceGroups] = useState<InsuranceGroup[]>([]);
  const [insuranceDebtSummaries, setInsuranceDebtSummaries] = useState<InsuranceDebtSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isMarkingPaidId, setIsMarkingPaidId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isAdmin = role?.toLowerCase() === 'admin' || role?.toLowerCase() === 'administrator';

  const refreshData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { data: insuranceData, error: insuranceError } = await supabase
        .from('insurances')
        .select('id, name');

      if (insuranceError) {
        setError(formatSupabaseError(insuranceError, 'Erreur de chargement des assurances.'));
        setIsLoading(false);
        return;
      }

      const insuranceNameById = new Map<string, string>(
        (insuranceData || []).map((insurance) => [insurance.id as string, insurance.name as string])
      );

      const { data: transactions, error: txError } = await supabase
        .from('transactions')
        .select('*')
        .order('created_at', { ascending: false });

      if (txError) {
        setError(formatSupabaseError(txError, 'Erreur de chargement des transactions assurances.'));
        setIsLoading(false);
        return;
      }

      const insuranceRows = ((transactions || []) as InsuranceTransactionRow[])
        .filter((tx) => {
          const method = String(tx.method || '').toLowerCase();
          const paymentMethod = String(tx.payment_method || '').toLowerCase();
          const category = String(tx.category || '').toLowerCase();
          const description = String(tx.description || '').toLowerCase();
          const type = String(tx.type || '').toLowerCase();

          const insuranceFlag =
            method === 'assurance' ||
            paymentMethod === 'assurance' ||
            category.includes('assurance') ||
            description.includes('assurance') ||
            Boolean(tx.insurance_name);

          const isIncome = type === 'recette' || type === 'income' || type === '';
          return insuranceFlag && isIncome;
        });

      const grouped = new Map<string, Transaction[]>();
      insuranceRows.forEach((tx) => {
        const description = String(tx.description || '');
        const fromDescription = description.match(/assurance\s*:\s*(.+)$/i)?.[1]?.trim();
        const fromCategory = String((tx as InsuranceTransactionRow).category || '').trim();
        const insuranceName = tx.insurance_name || fromDescription || (fromCategory && fromCategory.toLowerCase().includes('assurance') ? fromCategory : null) || 'Sans nom';
        if (!grouped.has(insuranceName)) {
          grouped.set(insuranceName, []);
        }
        grouped.get(insuranceName)!.push(tx);
      });

      const groups: InsuranceGroup[] = Array.from(grouped, ([name, txs]) => ({
        name,
        transactions: txs,
        total: txs.reduce((sum, t) => sum + t.amount, 0),
        count: txs.length,
      })).sort((a, b) => b.total - a.total);

      const debtMap = new Map<string, InsuranceDebtSummary>();
      insuranceRows.forEach((tx) => {
        const status = normalizeInsuranceStatus(tx);
        const insuranceId = tx.insurance_id || null;
        const paymentStatus = String(tx.insurance_payment_status || 'unpaid').toLowerCase();
        if (!insuranceId || status !== 'approved' || paymentStatus === 'paid') return;

        const insuranceName = insuranceNameById.get(insuranceId) || tx.insurance_name || 'Sans nom';
        const current = debtMap.get(insuranceId) || {
          insuranceId,
          insuranceName,
          totalVolume: 0,
          totalDue: 0,
          transactionCount: 0,
        };

        current.totalVolume += Number(tx.amount || 0);
        current.totalDue += Number(tx.amount_covered_by_insurance || 0);
        current.transactionCount += 1;
        debtMap.set(insuranceId, current);
      });

      setInsuranceGroups(groups);
      setInsuranceDebtSummaries(
        Array.from(debtMap.values()).sort((a, b) => b.totalDue - a.totalDue)
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur réseau');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleMarkAsPaid = async (insuranceId: string) => {
    if (!isAdmin || !user) return;
    if (!window.confirm('Confirmer le règlement de cette assurance ?')) return;

    setIsMarkingPaidId(insuranceId);
    setError(null);

    const { error: updateError } = await supabase
      .from('transactions')
      .update({
        insurance_payment_status: 'paid',
        insurance_paid_at: new Date().toISOString(),
        insurance_paid_by: user.id,
      })
      .eq('insurance_id', insuranceId)
      .in('status', ['approved', 'validé'])
      .or('insurance_payment_status.is.null,insurance_payment_status.eq.unpaid');

    if (updateError) {
      setError(formatSupabaseError(updateError, 'Erreur lors du marquage en payé.'));
      setIsMarkingPaidId(null);
      return;
    }

    await refreshData();
    setIsMarkingPaidId(null);
  };

  const handleDelete = async (id: string) => {
    if (!isAdmin) return;
    if (!window.confirm('Supprimer cette transaction assurance ?')) return;

    const { error: deleteError } = await supabase
      .from('transactions')
      .delete()
      .eq('id', id);

    if (deleteError) {
      setError(formatSupabaseError(deleteError, 'Erreur lors de la suppression.'));
      return;
    }
    await refreshData();
  };

  const handleEdit = async (tx: Transaction) => {
    if (!isAdmin) return;

    const newDescription = window.prompt('Nouvelle description', tx.description || '');
    if (newDescription === null) return;
    const amountInput = window.prompt('Nouveau montant', String(tx.amount ?? ''));
    if (amountInput === null) return;
    const parsedAmount = Number(amountInput);
    if (!Number.isFinite(parsedAmount) || parsedAmount < 0) {
      setError('Montant invalide');
      return;
    }

    const { error: updateError } = await supabase
      .from('transactions')
      .update({
        description: newDescription.trim(),
        amount: parsedAmount,
      })
      .eq('id', tx.id);

    if (updateError) {
      setError(formatSupabaseError(updateError, 'Erreur lors de la mise à jour.'));
      return;
    }
    await refreshData();
  };

  useEffect(() => {
    let mounted = true;

    const fetchData = async () => {
      if (!mounted) return;
      await refreshData();
    };

    fetchData();

    return () => {
      mounted = false;
    };
  }, [refreshData]);

  const grandTotal = insuranceGroups.reduce((sum, group) => sum + group.total, 0);
  const totalTransactions = insuranceGroups.reduce((sum, group) => sum + group.count, 0);

  return (
    <div className="p-6 lg:p-10 space-y-10">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="h-2 w-8 bg-blue-500 rounded-full" />
            <span className="text-[10px] font-bold text-blue-600 uppercase tracking-[0.2em]">Tiers-Payant & Prises en Charge</span>
          </div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900">
            Suivi des Assurances
          </h1>
          <p className="mt-1 text-sm font-medium text-slate-500">
            Portefeuille des créances par compagnie conventionnée.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex h-11 px-6 items-center gap-3 bg-white rounded-xl border border-slate-200 shadow-sm">
            <Landmark className="h-4 w-4 text-slate-400" />
            <span className="text-xs font-bold text-slate-700 uppercase tracking-tight">Registre Mutualiste</span>
          </div>
        </div>
      </header>

      {error && (
        <div className="p-5 rounded-2xl bg-rose-50 border border-rose-100 flex items-center gap-4 text-rose-600 animate-in fade-in slide-in-from-top-4">
          <p className="text-xs font-bold uppercase tracking-widest">⚠️ {error}</p>
        </div>
      )}

      {!isAdmin && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-100 text-amber-700">
          <p className="text-xs font-bold uppercase tracking-widest">Mode Lecture Seule: Affichage autorisé, modifications réservées à l&apos;administrateur.</p>
        </div>
      )}

      <div className="grid gap-6 sm:grid-cols-3">
        <div className="stats-card border-l-4 border-l-blue-500">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Créance Totale</p>
            <ArrowUpRight className="h-4 w-4 text-blue-500" />
          </div>
          <p className="text-3xl font-black text-slate-900 tabular-nums">
            {grandTotal.toLocaleString('fr-FR')}
            <span className="text-xs font-bold text-slate-400 ml-2 uppercase">GNF</span>
          </p>
        </div>

        <div className="stats-card">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Partenaires</p>
            <Building2 className="h-4 w-4 text-slate-400" />
          </div>
          <p className="text-3xl font-black text-slate-900">
            {insuranceGroups.length}
          </p>
          <p className="text-[9px] font-bold text-slate-400 uppercase mt-1">Sociétés de Prévoyance</p>
        </div>

        <div className="stats-card">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Flux Transactions</p>
            <Receipt className="h-4 w-4 text-slate-400" />
          </div>
          <p className="text-3xl font-black text-slate-900">
            {totalTransactions}
          </p>
          <p className="text-[9px] font-bold text-slate-400 uppercase mt-1">Prises en charge émises</p>
        </div>
      </div>

      {isAdmin && (
        <section className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="h-4 w-1 bg-emerald-500 rounded-full" />
            <h2 className="text-sm font-bold text-slate-800 uppercase tracking-widest">Suivi des Assurances</h2>
          </div>

          <div className="overflow-x-auto rounded-3xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr className="text-left text-[11px] uppercase tracking-widest text-slate-500">
                  <th className="px-5 py-3">Assurance</th>
                  <th className="px-5 py-3">Volume Total</th>
                  <th className="px-5 py-3">Total Dû Pharmacie</th>
                  <th className="px-5 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {insuranceDebtSummaries.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-5 py-8 text-center text-slate-500 font-medium">
                      Aucun paiement assurance en attente.
                    </td>
                  </tr>
                ) : (
                  insuranceDebtSummaries.map((row) => (
                    <tr key={row.insuranceId} className="border-t border-slate-100">
                      <td className="px-5 py-4 font-bold text-slate-900">{row.insuranceName}</td>
                      <td className="px-5 py-4 font-semibold text-slate-700 tabular-nums">
                        {row.totalVolume.toLocaleString('fr-FR')} GNF
                      </td>
                      <td className="px-5 py-4 font-black text-emerald-700 tabular-nums">
                        {row.totalDue.toLocaleString('fr-FR')} GNF
                      </td>
                      <td className="px-5 py-4 text-right">
                        <button
                          onClick={() => handleMarkAsPaid(row.insuranceId)}
                          disabled={isMarkingPaidId === row.insuranceId}
                          className="px-4 py-2 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed text-[11px] font-black uppercase tracking-wider transition-colors"
                        >
                          {isMarkingPaidId === row.insuranceId ? 'Traitement...' : 'Marquer comme payé'}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <div className="space-y-8">
        <div className="flex items-center gap-3">
          <div className="h-4 w-1 bg-slate-400 rounded-full" />
          <h2 className="text-sm font-bold text-slate-800 uppercase tracking-widest">Ventilation par Compagnie</h2>
        </div>

        {isLoading ? (
          <div className="h-40 flex items-center justify-center bg-white rounded-3xl border border-slate-200">
            <p className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] animate-pulse">Synchronisation du portefeuille...</p>
          </div>
        ) : insuranceGroups.length === 0 ? (
          <div className="h-60 flex flex-col items-center justify-center bg-slate-50 border-2 border-dashed border-slate-200 rounded-[2.5rem]">
            <PieChart className="h-10 w-10 text-slate-300 mb-4" />
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Aucun historique d'assurance</p>
          </div>
        ) : (
          <div className="grid gap-8">
            {insuranceGroups.map((group) => (
              <div
                key={group.name}
                className="glass-card rounded-[2.5rem] p-8 border border-white/60 shadow-xl shadow-slate-200/50"
              >
                <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-slate-100 pb-8">
                  <div className="flex items-center gap-5">
                    <div className="h-16 w-16 rounded-3xl bg-blue-50 text-blue-600 flex items-center justify-center shadow-inner border border-blue-100">
                      <Landmark className="h-8 w-8" />
                    </div>
                    <div>
                      <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight italic">
                        {group.name}
                      </h2>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">{group.count} Dossiers</span>
                        <div className="h-1 w-1 rounded-full bg-slate-300" />
                        <span className="text-[10px] font-bold text-blue-500 uppercase">Portefeuille Actif</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-slate-50 rounded-2xl p-4 px-6 border border-slate-100 flex flex-col items-end">
                    <div className="flex items-baseline gap-2">
                      <p className="text-2xl font-black text-slate-900 tabular-nums leading-none">
                        {group.total.toLocaleString('fr-FR')}
                      </p>
                      <span className="text-[10px] font-bold text-slate-400">GNF</span>
                    </div>
                    <div className="mt-2 flex items-center gap-2 w-full max-w-[140px]">
                      <div className="h-1.5 flex-1 bg-slate-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500 rounded-full"
                          style={{ width: `${Math.min(100, (group.total / grandTotal) * 100)}%` }}
                        />
                      </div>
                      <span className="text-[9px] font-black text-slate-500 tabular-nums">
                        {((group.total / grandTotal) * 100).toFixed(1)}%
                      </span>
                    </div>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {group.transactions.map((tx) => (
                    <div
                      key={tx.id}
                      className="group flex flex-col justify-between bg-white border border-slate-100 rounded-2xl p-5 hover:border-blue-500/30 hover:shadow-lg transition-all"
                    >
                      <div className="flex justify-between items-start mb-4">
                        <div className="max-w-[70%]">
                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight mb-0.5">Désignation</p>
                          <p className="text-xs font-bold text-slate-800 line-clamp-2 uppercase italic">{tx.description}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight mb-0.5">Montant</p>
                          <p className="text-xs font-black text-slate-900">{tx.amount.toLocaleString('fr-FR')} G</p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between border-t border-slate-50 pt-4">
                        <div className="flex items-center gap-1.5">
                          <Clock className="h-3 w-3 text-slate-400" />
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">
                            {new Date(tx.created_at).toLocaleDateString('fr-FR')}
                          </span>
                        </div>
                        <div className={`flex items-center gap-1.5 px-3 py-1 rounded-lg border text-[9px] font-black uppercase tracking-widest ${normalizeInsuranceStatus(tx as InsuranceTransactionRow) === 'approved'
                          ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
                          : normalizeInsuranceStatus(tx as InsuranceTransactionRow) === 'rejected'
                            ? 'bg-rose-50 text-rose-600 border-rose-100'
                            : 'bg-amber-50 text-amber-600 border-amber-100'
                          }`}>
                          {normalizeInsuranceStatus(tx as InsuranceTransactionRow) === 'approved' ? <CheckCircle2 className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                          {normalizeInsuranceStatus(tx as InsuranceTransactionRow) === 'approved' ? 'Approuvé' : normalizeInsuranceStatus(tx as InsuranceTransactionRow) === 'rejected' ? 'Rejeté' : 'En attente'}
                        </div>
                      </div>
                      {isAdmin && (
                        <div className="mt-3 pt-3 border-t border-slate-100 flex gap-2 justify-end">
                          <button
                            onClick={() => handleEdit(tx)}
                            className="px-3 py-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white text-[10px] font-black uppercase tracking-widest transition-all"
                          >
                            Modifier
                          </button>
                          <button
                            onClick={() => handleDelete(tx.id)}
                            className="px-3 py-1.5 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white text-[10px] font-black uppercase tracking-widest transition-all"
                          >
                            Supprimer
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default Assurances;
