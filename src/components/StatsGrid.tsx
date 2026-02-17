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

type TxType = 'income' | 'expense' | 'recette' | 'dépense';

interface TxRow {
  amount: number;
  type: TxType;
  created_at: string;
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

export function StatsGrid() {
  const { role, loading: authLoading } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [series, setSeries] = useState<DailyPoint[]>([]);
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

      const { data, error: fetchError } = await supabase
        .from('transactions')
        .select('amount, type, created_at')
        .gte('created_at', start.toISOString())
        .lte('created_at', today.toISOString())
        .order('created_at', { ascending: true });

      if (!mounted) return;

      if (fetchError) {
        setError(formatSupabaseError(fetchError, 'Erreur de chargement des statistiques.'));
        setSeries([]);
        setIsLoading(false);
        return;
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

      ((data || []) as TxRow[]).forEach((row) => {
        const rowDate = new Date(row.created_at);
        const key = toDateKey(rowDate);
        const point = points.get(key);
        if (!point) return;

        if (isIncome(row.type)) {
          point.in += Number(row.amount) || 0;
        } else {
          point.out += Number(row.amount) || 0;
        }
        point.net = point.in - point.out;
      });

      setSeries(Array.from(points.values()));
      setIsLoading(false);
    };

    load();

    return () => {
      mounted = false;
    };
  }, [authLoading, isAdmin]);

  const todayStats = useMemo(() => {
    const todayKey = toDateKey(new Date());
    const today = series.find((d) => d.dateKey === todayKey);
    return {
      totalIn: today?.in ?? 0,
      totalOut: today?.out ?? 0,
      net: (today?.in ?? 0) - (today?.out ?? 0),
    };
  }, [series]);

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
              <p className="text-[11px] font-bold uppercase tracking-widest text-emerald-700">Chiffre d&apos;Affaires (Aujourd&apos;hui)</p>
              <p className="mt-3 text-3xl font-black text-emerald-700">{formatAmount(todayStats.totalIn)}</p>
            </div>

            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 shadow-sm">
              <p className="text-[11px] font-bold uppercase tracking-widest text-rose-700">Dépenses (Aujourd&apos;hui)</p>
              <p className="mt-3 text-3xl font-black text-rose-700">{formatAmount(todayStats.totalOut)}</p>
            </div>

            <div className="rounded-2xl border border-blue-200 bg-blue-50 p-6 shadow-sm">
              <p className="text-[11px] font-bold uppercase tracking-widest text-blue-700">Bénéfice Net</p>
              <p className={`mt-3 text-3xl font-black ${todayStats.net >= 0 ? 'text-blue-700' : 'text-rose-700'}`}>
                {todayStats.net >= 0 ? '+' : ''}
                {formatAmount(todayStats.net)}
              </p>
            </div>
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
