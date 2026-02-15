import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

type LedgerTransactionType = 'income' | 'expense';

interface LedgerTransaction {
  id: string;
  created_at: string;
  category: string;
  type: LedgerTransactionType;
  amount: number;
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
  const [selectedDate, setSelectedDate] = useState<string>(getTodayDateInputValue());
  const [transactions, setTransactions] = useState<LedgerTransaction[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    let pollId: ReturnType<typeof setInterval> | null = null;

    const fetchTransactions = async () => {
      setIsLoading(true);
      setError(null);

      const { start, end } = getDateBounds(selectedDate);
      const { data, error: fetchError } = await supabase
        .from('transactions')
        .select('id, created_at, category, type, amount')
        .gte('created_at', start)
        .lte('created_at', end)
        .order('created_at', { ascending: false });

      if (!isMounted) return;

      if (fetchError) {
        setError(fetchError.message);
        setTransactions([]);
      } else {
        setTransactions((data || []) as LedgerTransaction[]);
      }

      setIsLoading(false);
    };

    fetchTransactions();
    pollId = setInterval(() => {
      fetchTransactions();
    }, 15000);

    return () => {
      isMounted = false;
      if (pollId) {
        clearInterval(pollId);
      }
    };
  }, [selectedDate]);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
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
                <th className="pb-3 pr-4 font-bold" title="Category">Catégorie</th>
                <th className="pb-3 pr-4 font-bold" title="Type">Type</th>
                <th className="pb-3 text-right font-bold" title="Amount">Montant</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((tx) => (
                <tr key={tx.id} className="border-b border-slate-100 last:border-0">
                  <td className="py-3 pr-4 font-medium text-slate-700">{formatTime(tx.created_at)}</td>
                  <td className="py-3 pr-4 font-semibold text-slate-900">{tx.category}</td>
                  <td className="py-3 pr-4 capitalize text-slate-600">{tx.type}</td>
                  <td className="py-3 text-right">
                    <span className={tx.type === 'income' ? 'font-black text-emerald-600' : 'font-black text-rose-600'}>
                      {tx.type === 'income' ? '+' : '-'}
                      {formatAmount(tx.amount)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export default TransactionLedger;
