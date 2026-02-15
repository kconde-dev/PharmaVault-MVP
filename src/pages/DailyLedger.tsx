import TransactionLedger from '@/components/TransactionLedger';

export function DailyLedger() {
  return (
    <div className="p-6 lg:p-8 space-y-6">
      <header>
        <h1 className="text-3xl font-black text-slate-900" title="Daily Ledger">Journal Quotidien</h1>
        <p className="text-sm text-slate-500" title="Live view of all transactions for the selected day">
          Suivi en direct des opérations de la journée.
        </p>
      </header>
      <TransactionLedger />
    </div>
  );
}

export default DailyLedger;
