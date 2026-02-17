import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, CircleHelp, CreditCard, Wallet } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { formatSupabaseError } from '@/lib/supabaseError';
import { downloadDebtListPDF } from '@/lib/pdf';

type CreditTransactionRow = {
  id: string;
  amount: number;
  created_at: string;
  customer_name: string | null;
  customer_phone: string | null;
  payment_status: string | null;
  type: string | null;
  status: string | null;
};

type DebtGroup = {
  key: string;
  customerName: string;
  phone: string | null;
  outstandingAmount: number;
  debtCount: number;
  oldestAt: string;
  latestPaymentAt: string | null;
  trustPaidCount: number;
  transactionIds: string[];
};

function isCreditType(raw: string | null): boolean {
  const value = String(raw || '').toLowerCase();
  return value === 'crédit' || value === 'credit';
}

function isApprovedStatus(raw: string | null): boolean {
  const value = String(raw || '').toLowerCase();
  return value === 'approved' || value === 'validé' || value === '';
}

function buildGroupKey(name: string, phone: string | null): string {
  return `${name.toLowerCase().trim()}::${(phone || '').trim()}`;
}

function isMissingCreditSchemaError(err: unknown): boolean {
  const message = String(
    (err as { message?: string } | null)?.message ||
    (err as { details?: string } | null)?.details ||
    ''
  ).toLowerCase();
  return (
    message.includes('customer_name')
    || message.includes('customer_phone')
    || message.includes('payment_status')
  );
}

export function CreditDebts() {
  const { user } = useAuth();
  const [rows, setRows] = useState<CreditTransactionRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [settlingKey, setSettlingKey] = useState<string | null>(null);

  const refreshData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { data, error: loadError } = await supabase
        .from('transactions')
        .select('id, amount, created_at, customer_name, customer_phone, payment_status, type, status')
        .order('created_at', { ascending: false });

      if (loadError) {
        if (isMissingCreditSchemaError(loadError)) {
          setError('Migration crédit manquante: appliquez la migration SQL de gestion des dettes clients.');
        } else {
          setError(formatSupabaseError(loadError, 'Erreur de chargement des dettes clients.'));
        }
        setIsLoading(false);
        return;
      }

      setRows((data || []) as CreditTransactionRow[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur réseau');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void refreshData();
  }, []);

  const debtGroups = useMemo(() => {
    const grouped = new Map<string, DebtGroup>();
    rows.forEach((row) => {
      if (!isCreditType(row.type)) return;
      if (!isApprovedStatus(row.status)) return;

      const customerName = String(row.customer_name || '').trim() || 'Client non renseigné';
      const phone = row.customer_phone ? String(row.customer_phone).trim() : null;
      const key = buildGroupKey(customerName, phone);

      const existing = grouped.get(key) || {
        key,
        customerName,
        phone,
        outstandingAmount: 0,
        debtCount: 0,
        oldestAt: row.created_at,
        latestPaymentAt: null,
        trustPaidCount: 0,
        transactionIds: [],
      };

      if (String(row.payment_status || '') === 'Dette Totale') {
        existing.outstandingAmount += Number(row.amount || 0);
        existing.debtCount += 1;
        existing.transactionIds.push(row.id);
      }
      if (String(row.payment_status || '') === 'Payé') {
        existing.trustPaidCount += 1;
      }
      if (new Date(row.created_at).getTime() < new Date(existing.oldestAt).getTime()) {
        existing.oldestAt = row.created_at;
      }
      grouped.set(key, existing);
    });

    return Array.from(grouped.values())
      .filter((group) => group.debtCount > 0)
      .sort((a, b) => b.outstandingAmount - a.outstandingAmount);
  }, [rows]);

  const totalOutstanding = useMemo(
    () => debtGroups.reduce((sum, group) => sum + group.outstandingAmount, 0),
    [debtGroups]
  );

  const exportableDebtRows = useMemo(() => {
    return rows
      .filter((row) => isCreditType(row.type))
      .filter((row) => isApprovedStatus(row.status))
      .filter((row) => String(row.payment_status || '') === 'Dette Totale')
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .map((row) => ({
        customerName: String(row.customer_name || '').trim() || 'Client non renseigné',
        customerPhone: String(row.customer_phone || '').trim() || 'Non renseigné',
        amountDue: Number(row.amount || 0),
        transactionDate: new Date(row.created_at).toLocaleDateString('fr-FR'),
      }));
  }, [rows]);

  const handleExportDebtsPDF = () => {
    if (exportableDebtRows.length === 0) {
      setError('Aucune dette à exporter pour le moment.');
      return;
    }
    downloadDebtListPDF({
      generatedAt: new Date().toLocaleString('fr-FR'),
      rows: exportableDebtRows,
    });
  };

  const handleSettleDebt = async (group: DebtGroup) => {
    if (!user?.id) return;
    setSettlingKey(group.key);
    setError(null);

    const { error: updateError } = await supabase
      .from('transactions')
      .update({
        payment_status: 'Payé',
        payment_paid_at: new Date().toISOString(),
        payment_paid_by: user.id,
      })
      .in('id', group.transactionIds)
      .eq('payment_status', 'Dette Totale')
      .in('type', ['Crédit', 'crédit', 'credit']);
    if (updateError) {
      setError(formatSupabaseError(updateError, 'Erreur lors de l’encaissement de la dette.'));
      setSettlingKey(null);
      return;
    }

    await refreshData();
    setSettlingKey(null);
  };

  return (
    <div className="p-6 lg:p-10 space-y-8">
      <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-600">Suivi des Créances</p>
            <span
              title="Cette vue affiche la dette totale par client, l'ancienneté de la créance, l'historique de remboursement et les alertes de recouvrement."
              className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-amber-300 bg-white text-amber-700"
            >
              <CircleHelp className="h-4 w-4" />
            </span>
          </div>
          <h1 className="mt-1 text-3xl font-black tracking-tight text-slate-900">Suivi des Dettes</h1>
          <p className="mt-1 text-sm text-slate-600">Pilotage des clients à crédit et encaissement des dettes en attente.</p>
        </div>
        <div className="flex flex-col gap-2">
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
            <p className="text-[10px] font-black uppercase tracking-widest text-amber-700">Encours Total</p>
            <p className="text-2xl font-black text-amber-900">{totalOutstanding.toLocaleString('fr-FR')} GNF</p>
          </div>
          <Button
            onClick={handleExportDebtsPDF}
            className="h-11 rounded-xl bg-slate-900 px-4 text-xs font-black uppercase tracking-[0.08em] text-white hover:bg-slate-800"
          >
            Exporter la liste des Dettes (PDF)
          </Button>
        </div>
      </header>

      {error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-700">
          <AlertCircle className="mr-2 inline h-4 w-4" />
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm font-bold text-slate-500">
          Chargement des dettes en cours...
        </div>
      ) : debtGroups.length === 0 ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-10 text-center">
          <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-600" />
          <p className="mt-2 text-sm font-black uppercase tracking-wider text-emerald-700">Aucune dette client en attente</p>
        </div>
      ) : (
        <div className="space-y-5">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 text-xs text-slate-700">
            <p className="font-black uppercase tracking-[0.1em] text-slate-900">Détails Techniques</p>
            <p className="mt-1 leading-6">
              Chaque créance est rattachée à un ID de Transaction et à un ID de Caissier (profil utilisateur),
              avec horodatage complet. Cette traçabilité sert de preuve interne pour audit et recouvrement.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs font-semibold text-slate-600">
            <p className="font-black uppercase tracking-[0.1em] text-slate-700">Système d&apos;Alerte Créances</p>
            <p className="mt-1">Verte: moins de 7 jours. Orange: entre 7 et 30 jours. Rouge: plus de 30 jours.</p>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
          {debtGroups.map((group) => (
            <article key={group.key} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Client</p>
                  <h3 className="text-lg font-black text-slate-900">{group.customerName}</h3>
                  <p className="mt-1 text-xs font-semibold text-slate-500">
                    {group.phone || 'Téléphone non renseigné'}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Dette Totale</p>
                  <p className="text-xl font-black text-rose-700">{group.outstandingAmount.toLocaleString('fr-FR')} GNF</p>
                </div>
              </div>
              <div className="mt-4 grid gap-2 rounded-xl border border-slate-100 bg-slate-50 px-3 py-3 text-xs font-bold text-slate-600 md:grid-cols-2">
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-slate-500">Dette Totale par Client</p>
                  <p className="mt-1 inline-flex items-center gap-1"><CreditCard className="h-3.5 w-3.5" /> {group.debtCount} crédits ouverts</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-slate-500">Dernier Paiement</p>
                  <p className="mt-1">{group.latestPaymentAt ? new Date(group.latestPaymentAt).toLocaleDateString('fr-FR') : 'Aucun paiement enregistré'}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-slate-500">Ancienneté de la Créance</p>
                  {(() => {
                    const ageDays = Math.floor((Date.now() - new Date(group.oldestAt).getTime()) / (1000 * 60 * 60 * 24));
                    const toneClass =
                      ageDays > 30
                        ? 'text-rose-700 border-rose-200 bg-rose-50'
                        : ageDays > 7
                          ? 'text-amber-700 border-amber-200 bg-amber-50'
                          : 'text-emerald-700 border-emerald-200 bg-emerald-50';
                    return (
                      <span className={`mt-1 inline-flex rounded-lg border px-2 py-1 ${toneClass}`}>
                        <Wallet className="mr-1 h-3.5 w-3.5" />
                        {ageDays} jours
                      </span>
                    );
                  })()}
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-slate-500">Historique de Confiance</p>
                  <p className="mt-1">{group.trustPaidCount} crédits soldés à temps</p>
                </div>
              </div>
              <div className="mt-3 rounded-xl border border-indigo-100 bg-indigo-50 p-3 text-[11px] font-semibold text-indigo-800">
                Promesse de Paiement: à renseigner lors du recouvrement (date de retour client).
              </div>
              <Button
                onClick={() => void handleSettleDebt(group)}
                isLoading={settlingKey === group.key}
                disabled={settlingKey === group.key}
                className="mt-4 h-11 w-full rounded-xl bg-emerald-600 font-black text-white hover:bg-emerald-500"
              >
                Encaisser
              </Button>
            </article>
          ))}
        </div>
        </div>
      )}
    </div>
  );
}

export default CreditDebts;
