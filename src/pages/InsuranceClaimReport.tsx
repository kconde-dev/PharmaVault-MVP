import { useEffect, useMemo, useState } from 'react';
import { Download, RefreshCcw } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { DEFAULT_SETTINGS, getSettings, loadSettingsFromDatabase, type AppSettings } from '@/lib/settings';
import { downloadInsuranceClaimInvoicePDF } from '@/lib/pdf';
import { useAuth } from '@/hooks/useAuth';

type InsuranceProvider = {
  id: string;
  name: string;
};

type ClaimRow = {
  id: string;
  created_at: string;
  insurance_card_id: string | null;
  amount: number;
  amount_covered_by_insurance: number | null;
};

const toDateInput = (d: Date) => d.toISOString().slice(0, 10);
const firstDayOfMonth = () => {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
};
const endOfDayIso = (dateInput: string) => {
  const d = new Date(`${dateInput}T23:59:59.999`);
  return d.toISOString();
};

export function InsuranceClaimReport() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<AppSettings>(getSettings());
  const [providers, setProviders] = useState<InsuranceProvider[]>([]);
  const [providerId, setProviderId] = useState('');
  const [fromDate, setFromDate] = useState(toDateInput(firstDayOfMonth()));
  const [toDate, setToDate] = useState(toDateInput(new Date()));
  const [rows, setRows] = useState<ClaimRow[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const loadProviders = async () => {
      const { data, error: loadError } = await supabase
        .from('insurances')
        .select('id, name')
        .eq('is_active', true)
        .order('name', { ascending: true });

      if (!mounted) return;
      if (loadError) {
        setError(loadError.message);
        return;
      }

      const list = (data || []) as InsuranceProvider[];
      setProviders(list);
      if (!providerId && list.length > 0) {
        setProviderId(list[0].id);
      }
    };
    loadProviders();
    return () => {
      mounted = false;
    };
  }, [providerId]);

  useEffect(() => {
    let mounted = true;
    const loadSettings = async () => {
      try {
        const dbSettings = await loadSettingsFromDatabase();
        if (!mounted) return;
        setSettings(dbSettings);
      } catch {
        if (!mounted) return;
        setSettings(getSettings() || DEFAULT_SETTINGS);
      }
    };
    loadSettings();
    return () => {
      mounted = false;
    };
  }, []);

  const loadRows = async () => {
    if (!providerId) return;
    setIsLoading(true);
    setError(null);

    const { data, error: loadError } = await supabase
      .from('transactions')
      .select('id, created_at, insurance_card_id, amount, amount_covered_by_insurance')
      .eq('insurance_id', providerId)
      .in('status', ['approved', 'validé'])
      .gte('created_at', `${fromDate}T00:00:00.000Z`)
      .lte('created_at', endOfDayIso(toDate))
      .order('created_at', { ascending: false });

    if (loadError) {
      setError(loadError.message);
      setIsLoading(false);
      return;
    }

    setRows((data || []) as ClaimRow[]);
    setSelectedIds([]);
    setIsLoading(false);
  };

  useEffect(() => {
    loadRows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [providerId, fromDate, toDate]);

  const selectedProviderName = useMemo(
    () => providers.find((p) => p.id === providerId)?.name || 'Assurance',
    [providerId, providers]
  );

  const totalToPay = useMemo(
    () => rows.reduce((sum, row) => sum + Number(row.amount_covered_by_insurance || 0), 0),
    [rows]
  );

  const toggleSelection = (id: string) => {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id]
    );
  };

  const selectAll = () => setSelectedIds(rows.map((row) => row.id));
  const clearSelection = () => setSelectedIds([]);

  const handleExportPDF = () => {
    const exportRows = rows.filter((row) => selectedIds.includes(row.id));
    if (exportRows.length === 0) return;

    downloadInsuranceClaimInvoicePDF({
      pharmacyName: settings.pharmacy.name,
      pharmacyAddress: settings.pharmacy.address,
      insuranceName: selectedProviderName,
      fromDate,
      toDate,
      rows: exportRows.map((row) => ({
        date: new Date(row.created_at).toLocaleDateString('fr-FR'),
        insuranceCardId: row.insurance_card_id || '-',
        totalAmount: Number(row.amount || 0),
        amountDue: Number(row.amount_covered_by_insurance || 0),
      })),
    });
  };

  const handleMarkSelectedAsPaid = async () => {
    if (!user || selectedIds.length === 0) return;

    const { error: updateError } = await supabase
      .from('transactions')
      .update({
        insurance_payment_status: 'paid',
        insurance_paid_at: new Date().toISOString(),
        insurance_paid_by: user.id,
      })
      .in('id', selectedIds);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    await loadRows();
  };

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <header>
        <h1 className="text-2xl font-black text-slate-900">Rapport de Réclamation Assurance</h1>
        <p className="text-sm text-slate-500">Export mensuel et suivi de règlement des créances assurances</p>
      </header>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-700">
          {error}
        </div>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="grid gap-4 md:grid-cols-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">Assurance</label>
            <select
              value={providerId}
              onChange={(e) => setProviderId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
            >
              {providers.map((provider) => (
                <option key={provider.id} value={provider.id}>
                  {provider.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">Date Début</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">Date Fin</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
            />
          </div>

          <div className="flex items-end">
            <button
              onClick={loadRows}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-300 px-4 text-sm font-bold text-slate-700 hover:bg-slate-50"
            >
              <RefreshCcw className="h-4 w-4" />
              Actualiser
            </button>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-bold text-slate-700">
            Total à Payer: <span className="text-emerald-700">{totalToPay.toLocaleString('fr-FR')} GNF</span>
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={selectAll}
              disabled={rows.length === 0}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-bold text-slate-700 disabled:opacity-50"
            >
              Tout sélectionner
            </button>
            <button
              onClick={clearSelection}
              disabled={selectedIds.length === 0}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-bold text-slate-700 disabled:opacity-50"
            >
              Effacer sélection
            </button>
            <button
              onClick={handleExportPDF}
              disabled={selectedIds.length === 0}
              className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"
            >
              <Download className="h-3.5 w-3.5" />
              Export PDF
            </button>
            <button
              onClick={handleMarkSelectedAsPaid}
              disabled={selectedIds.length === 0}
              className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"
            >
              Marquer comme Payé
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px]">
            <thead className="border-b border-slate-100 bg-slate-50">
              <tr className="text-left text-xs font-bold uppercase tracking-widest text-slate-500">
                <th className="px-4 py-3" />
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Patient Card ID</th>
                <th className="px-4 py-3">Total Amount</th>
                <th className="px-4 py-3">Amount Due (Insurance Part)</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-sm text-slate-500">Chargement...</td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-sm text-slate-500">Aucune transaction approuvée.</td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id} className="border-t border-slate-100">
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(row.id)}
                        onChange={() => toggleSelection(row.id)}
                      />
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700">
                      {new Date(row.created_at).toLocaleDateString('fr-FR')}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700">{row.insurance_card_id || '-'}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-slate-900">
                      {Number(row.amount || 0).toLocaleString('fr-FR')} GNF
                    </td>
                    <td className="px-4 py-3 text-sm font-black text-emerald-700">
                      {Number(row.amount_covered_by_insurance || 0).toLocaleString('fr-FR')} GNF
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

export default InsuranceClaimReport;
