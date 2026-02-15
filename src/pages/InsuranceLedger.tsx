import { Fragment, useEffect, useMemo, useState } from 'react';
import { Building2, ChevronDown, ChevronUp, FileText } from 'lucide-react';
import { supabase } from '@/lib/supabase';

type Insurance = {
  id: string;
  name: string;
};

type InsuranceTx = {
  id: string;
  insurance_id: string | null;
  insurance_card_id: string | null;
  amount: number;
  amount_covered_by_insurance: number | null;
  status: string | null;
  insurance_payment_status: string | null;
  created_at: string;
  description: string | null;
};

type InsuranceSummary = {
  insuranceId: string;
  insuranceName: string;
  totalDue: number;
  caseCount: number;
  transactions: InsuranceTx[];
};

export function InsuranceLedger() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [insurances, setInsurances] = useState<Insurance[]>([]);
  const [transactions, setTransactions] = useState<InsuranceTx[]>([]);
  const [openInsuranceId, setOpenInsuranceId] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const fetchData = async () => {
      setIsLoading(true);
      setError(null);

      const [{ data: insuranceData, error: insuranceError }, { data: txData, error: txError }] = await Promise.all([
        supabase.from('insurances').select('id, name').order('name', { ascending: true }),
        supabase
          .from('transactions')
          .select('id, insurance_id, insurance_card_id, amount, amount_covered_by_insurance, status, created_at, description')
          .not('insurance_id', 'is', null)
          .in('status', ['approved', 'validé'])
          .order('created_at', { ascending: false }),
      ]);

      if (!mounted) return;
      if (insuranceError) {
        setError(insuranceError.message);
        setIsLoading(false);
        return;
      }
      if (txError) {
        setError(txError.message);
        setIsLoading(false);
        return;
      }

      setInsurances((insuranceData || []) as Insurance[]);
      setTransactions((txData || []) as InsuranceTx[]);
      setIsLoading(false);
    };

    fetchData();
    return () => {
      mounted = false;
    };
  }, []);

  const summaries = useMemo<InsuranceSummary[]>(() => {
    const byId = new Map(insurances.map((insurance) => [insurance.id, insurance.name]));
    const grouped = new Map<string, InsuranceSummary>();

    transactions.forEach((tx) => {
      if (!tx.insurance_id) return;
      const existing = grouped.get(tx.insurance_id) || {
        insuranceId: tx.insurance_id,
        insuranceName: byId.get(tx.insurance_id) || 'Sans nom',
        totalDue: 0,
        caseCount: 0,
        transactions: [],
      };

      existing.transactions.push(tx);
      existing.totalDue += Number(tx.amount_covered_by_insurance || 0);
      existing.caseCount += 1;
      grouped.set(tx.insurance_id, existing);
    });

    return Array.from(grouped.values()).sort((a, b) => b.totalDue - a.totalDue);
  }, [insurances, transactions]);

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900">Suivi Dette Assurances</h1>
          <p className="text-sm text-slate-500">Suivi global des créances d&apos;assurance approuvées</p>
        </div>
      </header>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs font-semibold text-rose-700">
          {error}
        </div>
      )}

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="w-full min-w-[720px]">
          <thead className="border-b border-slate-100 bg-slate-50">
            <tr className="text-left text-xs font-bold uppercase tracking-widest text-slate-500">
              <th className="px-5 py-3">Nom de l&apos;Assurance</th>
              <th className="px-5 py-3">Total dû à la Pharmacie</th>
              <th className="px-5 py-3">Nombre de Dossiers</th>
              <th className="px-5 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td className="px-5 py-8 text-sm text-slate-500" colSpan={4}>Chargement...</td>
              </tr>
            ) : summaries.length === 0 ? (
              <tr>
                <td className="px-5 py-8 text-sm text-slate-500" colSpan={4}>Aucune dette d&apos;assurance.</td>
              </tr>
            ) : (
              summaries.map((summary) => (
                <Fragment key={summary.insuranceId}>
                  <tr key={summary.insuranceId} className="border-t border-slate-100">
                    <td className="px-5 py-4 font-bold text-slate-900">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-slate-500" />
                        {summary.insuranceName}
                      </div>
                    </td>
                    <td className="px-5 py-4 font-black text-emerald-700">
                      {summary.totalDue.toLocaleString('fr-FR')} GNF
                    </td>
                    <td className="px-5 py-4 font-semibold text-slate-700">{summary.caseCount}</td>
                    <td className="px-5 py-4 text-right">
                      <button
                        onClick={() => setOpenInsuranceId(openInsuranceId === summary.insuranceId ? null : summary.insuranceId)}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50"
                      >
                        Détails
                        {openInsuranceId === summary.insuranceId ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                      </button>
                    </td>
                  </tr>
                  {openInsuranceId === summary.insuranceId && (
                    <tr className="border-t border-slate-100 bg-slate-50/40">
                      <td colSpan={4} className="px-5 py-4">
                        <div className="space-y-2">
                          {summary.transactions.map((tx) => (
                            <div key={tx.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white p-3 text-xs">
                              <div className="flex items-center gap-2 text-slate-700">
                                <FileText className="h-3.5 w-3.5" />
                                <span className="font-semibold">{tx.description || 'Recette assurance'}</span>
                              </div>
                              <div className="text-slate-600">
                                Carte: <span className="font-semibold">{tx.insurance_card_id || '-'}</span>
                              </div>
                              <div className="font-bold text-emerald-700">
                                {Number(tx.amount_covered_by_insurance || 0).toLocaleString('fr-FR')} GNF
                              </div>
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default InsuranceLedger;
