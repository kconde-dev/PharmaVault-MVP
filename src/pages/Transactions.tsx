import { useNavigate } from 'react-router-dom';
import { Building2, Receipt, Wallet } from 'lucide-react';
import TransactionLedger from '@/components/TransactionLedger';

export function Transactions() {
  const navigate = useNavigate();

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <header>
        <h1 className="text-3xl font-black text-slate-900" title="Transactions">Transactions</h1>
        <p className="text-sm text-slate-500" title="Modules opérationnels pour dépenses, recettes et flux assurance">
          Accès rapide aux modules opérationnels de caisse.
        </p>
      </header>

      <div className="grid gap-6 md:grid-cols-3">
        <button
          onClick={() => navigate('/dashboard')}
          className="rounded-2xl border border-slate-200 bg-white p-6 text-left shadow-sm hover:border-blue-300"
          title="Ouvrir la caisse et la garde en cours"
        >
          <Wallet className="h-6 w-6 text-blue-700" />
          <h2 className="mt-3 text-lg font-black text-slate-900">Caisse & Recettes</h2>
          <p className="mt-2 text-sm text-slate-600">Saisie des ventes et suivi de garde en cours.</p>
        </button>

        <button
          onClick={() => navigate('/dashboard/depenses')}
          className="rounded-2xl border border-slate-200 bg-white p-6 text-left shadow-sm hover:border-rose-300"
          title="Gérer et approuver les opérations de dépense"
        >
          <Receipt className="h-6 w-6 text-rose-500" />
          <h2 className="mt-3 text-lg font-black text-slate-900">Dépenses</h2>
          <p className="mt-2 text-sm text-slate-600">Soumission, validation et traçabilité des sorties.</p>
        </button>

        <button
          onClick={() => navigate('/dashboard/assurances')}
          className="rounded-2xl border border-slate-200 bg-white p-6 text-left shadow-sm hover:border-emerald-300"
          title="Créances assurance et rapprochement"
        >
          <Building2 className="h-6 w-6 text-emerald-600" />
          <h2 className="mt-3 text-lg font-black text-slate-900">Assurances</h2>
          <p className="mt-2 text-sm text-slate-600">Créances assurance, bordereaux et règlement.</p>
        </button>
      </div>

      <section className="pt-2">
        <TransactionLedger />
      </section>
    </div>
  );
}

export default Transactions;
