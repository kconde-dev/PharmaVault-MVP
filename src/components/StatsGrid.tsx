import { useEffect, useMemo, useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { formatSupabaseError } from '@/lib/supabaseError';

type TxType = 'income' | 'expense' | 'recette' | 'dépense' | 'crédit' | 'credit';

interface TxRow {
  amount: number;
  amount_paid?: number | null;
  insurance_amount?: number | null;
  type: TxType;
  created_at: string;
  payment_method?: string | null;
  payment_status?: string | null;
  status?: string | null;
}

interface DailyPoint {
  dateKey: string;
  label: string;
  in: number;
  out: number;
  net: number;
}

function toDateKey(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatAmount(value: number): string {
  return value.toLocaleString('fr-FR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function isIncome(type: TxType): boolean {
  return type === 'income' || type === 'recette';
}

function isExpense(type: TxType): boolean {
  return type === 'expense' || type === 'dépense';
}

function isCredit(type: TxType): boolean {
  return type === 'crédit' || type === 'credit';
}

function isApprovedStatus(raw: string | null | undefined): boolean {
  const value = String(raw || '').toLowerCase();
  return value === '' || value === 'approved' || value === 'validé';
}

function isCashOrOrangeMethod(raw: string | null | undefined): boolean {
  const value = String(raw || '').toLowerCase().trim();
  return (
    value === 'espèces'
    || value === 'especes'
    || value === 'cash'
    || value === 'orange money (code marchand)'
    || value === 'orange money'
    || value === 'orange_money'
    || value === 'mobile_money'
  );
}

interface GlobalSummary {
  totalReceipts: number;
  totalExpenses: number;
  totalDebts: number;
}

export function StatsGrid() {
  const { role, loading: authLoading } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [series, setSeries] = useState<DailyPoint[]>([]);
  const [globalSummary, setGlobalSummary] = useState<GlobalSummary>({
    totalReceipts: 0,
    totalExpenses: 0,
    totalDebts: 0,
  });
  const [error, setError] = useState<string | null>(null);

  const isAdmin = role?.toLowerCase() === 'admin' || role?.toLowerCase() === 'administrator';

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      if (authLoading) return;
      if (isAdmin !== true) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      const today = new Date();
      today.setHours(23, 59, 59, 999);
      const start = new Date(today);
      start.setDate(start.getDate() - 6);
      start.setHours(0, 0, 0, 0);

      const [seriesResult, totalsResult] = await Promise.allSettled([
        supabase
          .from('transactions')
          .select('amount, amount_paid, insurance_amount, type, created_at, status')
          .gte('created_at', start.toISOString())
          .lte('created_at', today.toISOString())
          .order('created_at', { ascending: true }),
        supabase
          .from('transactions')
          .select('amount, amount_paid, insurance_amount, type, payment_method, payment_status, status'),
      ]);

      if (!mounted) return;

      if (seriesResult.status !== 'fulfilled') {
        setError('Erreur de chargement des statistiques.');
        setSeries([]);
        setIsLoading(false);
        return;
      }
      if (seriesResult.value.error) {
        setError(formatSupabaseError(seriesResult.value.error, 'Erreur de chargement des statistiques.'));
        setSeries([]);
        setIsLoading(false);
        return;
      }
      if (totalsResult.status === 'fulfilled' && !totalsResult.value.error) {
        const totalsRows = (totalsResult.value.data || []) as TxRow[];
        const totalReceipts = totalsRows.reduce((sum, row) => {
          if (!isIncome(row.type)) return sum;
          if (!isApprovedStatus(row.status)) return sum;
          if (!isCashOrOrangeMethod(row.payment_method)) return sum;
          return sum + (Number(row.amount_paid ?? row.amount) || 0);
        }, 0);
        const totalInsurance = totalsRows.reduce((sum, row) => {
          if (!isIncome(row.type)) return sum;
          if (!isApprovedStatus(row.status)) return sum;
          return sum + (Number(row.insurance_amount || 0) || 0);
        }, 0);
        const totalExpenses = totalsRows.reduce((sum, row) => {
          if (!isExpense(row.type)) return sum;
          if (!isApprovedStatus(row.status)) return sum;
          return sum + (Number(row.amount) || 0);
        }, 0);
        const totalDebts = totalsRows.reduce((sum, row) => {
          if (!isCredit(row.type)) return sum;
          if (!isApprovedStatus(row.status)) return sum;
          if (String(row.payment_status || '') !== 'Dette Totale') return sum;
          return sum + (Number(row.amount) || 0);
        }, 0);
        setGlobalSummary({ totalReceipts: totalReceipts + totalInsurance, totalExpenses, totalDebts });
      }

      const points = new Map<string, DailyPoint>();
      for (let i = 6; i >= 0; i -= 1) {
        const day = new Date();
        day.setDate(day.getDate() - i);
        const key = toDateKey(day);
        points.set(key, {
          dateKey: key,
          label: day.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }),
          in: 0,
          out: 0,
          net: 0,
        });
      }

      ((seriesResult.value.data || []) as TxRow[]).forEach((row) => {
        if (!isApprovedStatus(row.status)) return;
        const rowDate = new Date(row.created_at);
        const key = toDateKey(rowDate);
        const point = points.get(key);
        if (!point) return;

        if (isIncome(row.type)) {
          point.in += (Number(row.amount_paid ?? row.amount) || 0) + (Number(row.insurance_amount || 0) || 0);
        } else {
          point.out += Number(row.amount) || 0;
        }
        point.net = point.in - point.out;
      });

      setSeries(Array.from(points.values()));
      setIsLoading(false);
    };

    const onTransactionsUpdated = () => {
      void load();
    };
    load();
    window.addEventListener('transactions-updated', onTransactionsUpdated);

    return () => {
      mounted = false;
      window.removeEventListener('transactions-updated', onTransactionsUpdated);
    };
  }, [authLoading, isAdmin]);

  const bilanNet = useMemo(() => globalSummary.totalReceipts - globalSummary.totalExpenses, [globalSummary]);

  if (!isAdmin) return null;

  return (
    <section className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-4 w-1 bg-emerald-500 rounded-full" />
        <h2 className="text-sm font-bold text-slate-800 uppercase tracking-widest">Indicateurs Admin</h2>
      </div>

      {isLoading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm font-semibold text-slate-500">
          Chargement des statistiques...
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-8 text-center text-sm font-semibold text-rose-600">
          {error}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 shadow-sm">
              <p className="text-[11px] font-bold uppercase tracking-widest text-emerald-700">Bilan Global: Total Recettes (Cash/OM)</p>
              <p className="mt-3 text-3xl font-black text-emerald-700">{formatAmount(globalSummary.totalReceipts)}</p>
            </div>

            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 shadow-sm">
              <p className="text-[11px] font-bold uppercase tracking-widest text-rose-700">Bilan Global: Total Dépenses</p>
              <p className="mt-3 text-3xl font-black text-rose-700">{formatAmount(globalSummary.totalExpenses)}</p>
            </div>

            <div className="rounded-2xl border border-blue-200 bg-blue-50 p-6 shadow-sm">
              <p className="text-[11px] font-bold uppercase tracking-widest text-blue-700">Bilan Global: Total Créances</p>
              <p className="mt-3 text-3xl font-black text-blue-700">{formatAmount(globalSummary.totalDebts)}</p>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 text-xs font-bold uppercase tracking-wider text-slate-600">
            Solde net global (Recettes - Dépenses):{' '}
            <span className={bilanNet >= 0 ? 'text-emerald-700' : 'text-rose-700'}>
              {bilanNet >= 0 ? '+' : ''}
              {formatAmount(bilanNet)} GNF
            </span>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="mb-4 text-xs font-bold uppercase tracking-widest text-slate-500">
              Flux de Trésorerie - 7 Derniers Jours
            </p>
            <div className="overflow-x-auto">
              <LineChart width={900} height={280} data={series}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="label" stroke="#64748b" tickLine={false} axisLine={false} />
                <YAxis stroke="#64748b" tickLine={false} axisLine={false} />
                <Tooltip
                  formatter={(value: number | string | undefined) => `${formatAmount(Number(value ?? 0))} GNF`}
                  labelStyle={{ color: '#0f172a', fontWeight: 700 }}
                />
                <Line
                  type="monotone"
                  dataKey="net"
                  stroke="#0ea5e9"
                  strokeWidth={3}
                  dot={{ r: 3, strokeWidth: 1 }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </div>
          </div>
        </>
      )}
    </section>
  );
}

export default StatsGrid;
