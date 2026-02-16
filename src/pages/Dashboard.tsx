import { useEffect, useState, useCallback } from 'react';
import { useConnection } from '@/context/ConnectionContext';
import { CalendarClock, TrendingUp, Receipt, Play, Plus, X, Share2, CheckCircle, Users, AlertTriangle, Building2, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import CashEntryForm, { type InsuranceOption } from '@/components/CashEntryForm';
import TransactionLedger from '@/components/TransactionLedger';
import StatsGrid from '@/components/StatsGrid';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { useNavigate } from 'react-router-dom';
import { generateWhatsAppMessage, shareViaWhatsApp } from '@/lib/whatsapp';
import { downloadShiftReceiptPDF } from '@/lib/pdf';
import type { Shift, Transaction, PaymentMethod } from '@/lib/database.types';
import { formatSupabaseError } from '@/lib/supabaseError';

function toModernPaymentMethod(method: PaymentMethod): 'cash' | 'mobile_money' | 'card' {
  if (method === 'espèces' || method === 'Espèces') return 'cash';
  if (method === 'orange_money' || method === 'Orange Money (Code Marchand)') return 'mobile_money';
  return 'card';
}

function fromModernPaymentMethod(method?: string): PaymentMethod {
  if (method === 'cash') return 'Espèces';
  if (method === 'mobile_money') return 'Orange Money (Code Marchand)';
  if (method === 'card') return 'Espèces';
  return 'Espèces';
}

type DbPaymentMethod = 'Espèces' | 'Orange Money (Code Marchand)';

function getCashierName(raw: { email?: string | null; user_metadata?: Record<string, unknown> | null } | null): string {
  if (!raw) return 'Caissier';
  const meta = raw.user_metadata || {};
  const fullName = typeof meta.full_name === 'string' ? meta.full_name.trim() : '';
  if (fullName) return fullName;
  const name = typeof meta.name === 'string' ? meta.name.trim() : '';
  if (name) return name;
  const email = String(raw.email || '').trim();
  if (email.includes('@')) return email.split('@')[0];
  return email || 'Caissier';
}

function normalizePaymentMethodForDb(raw: string): DbPaymentMethod {
  const value = raw.trim().toLowerCase();
  if (value === 'espèces' || value === 'especes' || value === 'cash') return 'Espèces';
  if (
    value === 'orange money (code marchand)'
    || value === 'orange_money'
    || value === 'mobile_money'
    || value === 'orange money'
  ) {
    return 'Orange Money (Code Marchand)';
  }
  return 'Espèces';
}

function isCashMethod(method: string): boolean {
  const normalized = normalizePaymentMethodForDb(method);
  return normalized === 'Espèces';
}

function isOrangeMethod(method: string): boolean {
  const normalized = normalizePaymentMethodForDb(method);
  return normalized === 'Orange Money (Code Marchand)';
}

function normalizeTransaction(row: Record<string, unknown>): Transaction {
  const rawType = String(row.type || '').toLowerCase();
  const type =
    rawType === 'income' || rawType === 'recette'
      ? 'recette'
      : rawType === 'retour' || rawType === 'refund' || rawType === 'returned'
        ? 'retour'
      : rawType === 'expense' || rawType === 'dépense' || rawType === 'depense'
        ? 'dépense'
        : 'recette';
  const method = row.method ? String(row.method) : fromModernPaymentMethod(typeof row.payment_method === 'string' ? row.payment_method : undefined);
  const normalizeStatus = (raw: unknown, approvedFlag: unknown, txType: string): 'pending' | 'approved' | 'rejected' => {
    const rawStatus = String(raw || '').toLowerCase();
    const isApproved = approvedFlag === true;
    if (rawStatus === 'approved' || rawStatus === 'validé') return 'approved';
    if (rawStatus === 'rejected' || rawStatus === 'rejeté') return 'rejected';
    if (rawStatus === 'pending' || rawStatus === 'en_attente') return 'pending';
    if (txType === 'dépense') return isApproved ? 'approved' : 'pending';
    return 'approved';
  };
  const status = normalizeStatus(row.status, row.is_approved, type);

  return {
    id: String(row.id || ''),
    shift_id: String(row.shift_id || ''),
    amount: Number(row.amount || 0),
    description: String(row.description || ''),
    type: type as Transaction['type'],
    method: method as Transaction['method'],
    status,
    insurance_name: ((row.insurance_name as string | null) ?? (row.insurance_provider as string | null)) ?? null,
    insurance_id: (row.insurance_id as string | null) ?? null,
    insurance_card_id: ((row.insurance_card_id as string | null) ?? (row.matricule_number as string | null)) ?? null,
    insurance_percentage:
      row.insurance_percentage != null
        ? Number(row.insurance_percentage)
        : row.coverage_percent != null
          ? Number(row.coverage_percent)
          : null,
    amount_covered_by_insurance:
      row.amount_covered_by_insurance != null ? Number(row.amount_covered_by_insurance) : null,
    created_at: String(row.created_at || new Date().toISOString()),
    created_by: String(row.created_by || row.cashier_id || ''),
    approved_by: (row.approved_by as string | null) ?? null,
    approved_at: (row.approved_at as string | null) ?? null,
  };
}

function getInsuranceCoveredAmount(transaction: Transaction): number {
  return Number(transaction.amount_covered_by_insurance || 0);
}

function getPatientCashPart(transaction: Transaction): number {
  if (transaction.type !== 'recette') return transaction.amount;
  const covered = getInsuranceCoveredAmount(transaction);
  if (covered <= 0) return transaction.amount;
  return Math.max(0, transaction.amount - covered);
}

function isInsuranceTransaction(transaction: Transaction): boolean {
  return Boolean(transaction.insurance_id) || getInsuranceCoveredAmount(transaction) > 0;
}

export function Dashboard() {
  const { user, role } = useAuth();
  const { isOnline } = useConnection();
  const navigate = useNavigate();

  const [currentShift, setCurrentShift] = useState<Shift | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [showRecetteForm, setShowRecetteForm] = useState(false);
  const [showCloseShiftForm, setShowCloseShiftForm] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [transactionSchema, setTransactionSchema] = useState<'legacy' | 'modern'>('legacy');
  const [error, setError] = useState<string | null>(null);
  const [pendingApprovalsCount, setPendingApprovalsCount] = useState(0);

  // Recette form state
  const [recetteForm, setRecetteForm] = useState({
    amount: '',
    method: 'Espèces' as PaymentMethod,
    isInsurancePayment: false,
    insuranceId: '',
    insuranceCardId: '',
    insurancePercentage: 80,
  });
  const [insurances, setInsurances] = useState<InsuranceOption[]>([]);
  const [insuranceLoadError, setInsuranceLoadError] = useState<string | null>(null);

  // Close shift form state
  const [closeShiftForm, setCloseShiftForm] = useState({
    actualCash: '',
  });

  // Closed shift summary state (for success screen)
  type ClosedShiftSummary = {
    date: string;
    totalRecettes: number;
    recettesEspeces: number;
    recettesOrangeMoney: number;
    recettesAssurance: number;
    totalRetours: number;
    totalDepenses: number;
    soldeNetARemettre: number;
    cashDifference: number;
  };

  const [closedShiftSummary, setClosedShiftSummary] = useState<ClosedShiftSummary | null>(null);

  const isAdmin = role?.toLowerCase() === 'admin' || role?.toLowerCase() === 'administrator';
  useEffect(() => {
    if (!isAdmin) return;

    const loadPendingApprovals = async () => {
      const { data: pendingData, error: pendingError } = await supabase
        .from('transactions')
        .select('*')
        .limit(1000);

      if (!pendingError && pendingData) {
        const count = pendingData
          .map((row) => normalizeTransaction(row as Record<string, unknown>))
          .filter((tx) => tx.type === 'dépense' && tx.status === 'pending')
          .length;
        setPendingApprovalsCount(count);
      }
    };

    loadPendingApprovals();
  }, [isAdmin]);

  useEffect(() => {
    let mounted = true;
    const loadInsurances = async () => {
      const { data, error } = await supabase
        .from('insurances')
        .select('id, name')
        .eq('is_active', true)
        .order('name', { ascending: true });

      if (!mounted) return;

      if (error) {
        setInsuranceLoadError(error.message);
        setInsurances([]);
        return;
      }

      setInsuranceLoadError(null);
      setInsurances((data || []) as InsuranceOption[]);
    };

    loadInsurances();
    return () => {
      mounted = false;
    };
  }, []);

  const fetchActiveShift = useCallback(async () => {
    if (!user) return null;
    const { data, error: err } = await supabase
      .from('shifts')
      .select('id, user_id, started_at, ended_at, expected_cash, actual_cash, cash_difference')
      .eq('user_id', user.id)
      .is('ended_at', null)
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (err) return null;
    return data ?? null;
  }, [user]);

  // Helper to query transactions
  const queryTransactions = async (shiftId: string) => {
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500);

    if (error) {
      return { data: null, error };
    }

    const rows = (data || []) as Array<Record<string, unknown> & { shift_id?: string }>;
    const hasLegacyShape =
      rows.length === 0
        || rows.some((row) => typeof row.shift_id === 'string' || typeof row.method === 'string');
    setTransactionSchema(hasLegacyShape ? 'legacy' : 'modern');
    const hasShiftId = rows.some((row) => typeof row.shift_id === 'string');
    const filtered = hasShiftId
      ? rows.filter((row) => row.shift_id === shiftId)
      : rows;

    return {
      data: filtered.map((row) => normalizeTransaction(row)),
      error: null,
    };
  };

  const refreshTransactions = useCallback(async (shiftId?: string) => {
    const id = shiftId || currentShift?.id;
    if (!id) return;

    const { data } = await queryTransactions(id);
    setTransactions((data || []) as Transaction[]);
  }, [currentShift]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const shift = await fetchActiveShift();
      if (!mounted) return;
      setCurrentShift(shift);

      if (shift) {
        const { data } = await queryTransactions(shift.id);
        if (mounted) setTransactions((data || []) as Transaction[]);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [fetchActiveShift]);

  // Update lists when currentShift changes
  useEffect(() => {
    let mounted = true;
    if (currentShift) {
      (async () => {
        const { data } = await queryTransactions(currentShift.id);
        if (mounted) {
          setTransactions((data || []) as Transaction[]);
        }
      })();
    }
    return () => {
      mounted = false;
    };
  }, [currentShift]);

  const handleStartShift = async () => {
    setError(null);
    setClosedShiftSummary(null); // Clear closed shift summary
    setIsStarting(true);
    if (!user) {
      setError('Session expirée. Veuillez vous reconnecter.');
      setIsStarting(false);
      return;
    }
    const { error: insertError } = await supabase.from('shifts').insert({
      user_id: user.id,
      started_at: new Date().toISOString(),
    });
    if (insertError) {
      setError(formatSupabaseError(insertError, 'Impossible de démarrer la garde.'));
      setIsStarting(false);
      return;
    }
    const shift = await fetchActiveShift();
    setCurrentShift(shift);
    setIsStarting(false);
  };

  const handleAddRecette = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!user || !currentShift) {
      setError('Une garde active est requise.');
      return;
    }

    if (!recetteForm.amount || isNaN(parseFloat(recetteForm.amount))) {
      setError('Montant invalide.');
      return;
    }

    if (recetteForm.isInsurancePayment && !recetteForm.insuranceId) {
      setError('Veuillez sélectionner une assurance.');
      return;
    }

    if (recetteForm.isInsurancePayment && recetteForm.method === 'assurance') {
      setError('Pour une vente assurance, choisissez un mode de paiement client (Ticket Modérateur).');
      return;
    }

    if (recetteForm.isInsurancePayment && !recetteForm.insuranceCardId.trim()) {
      setError('Veuillez renseigner le N° Carte / Matricule.');
      return;
    }

    if (recetteForm.isInsurancePayment && (recetteForm.insurancePercentage < 0 || recetteForm.insurancePercentage > 100)) {
      setError('Le pourcentage de prise en charge doit être entre 0 et 100.');
      return;
    }

    // Refresh auth context before write to avoid stale user/session data.
    const { data: freshUserData, error: freshUserError } = await supabase.auth.getUser();
    if (freshUserError) {
      setError(formatSupabaseError(freshUserError, 'Impossible de vérifier la session utilisateur.'));
      return;
    }
    const writer = freshUserData.user || user;
    if (!writer?.id) {
      setError('Session utilisateur invalide. Veuillez vous reconnecter.');
      return;
    }

    const totalAmount = parseFloat(recetteForm.amount);
    const coveragePercent = recetteForm.isInsurancePayment ? recetteForm.insurancePercentage : 0;
    const insurancePart = Number((totalAmount * (coveragePercent / 100)).toFixed(2));
    const patientPart = Number((totalAmount - insurancePart).toFixed(2));
    const selectedInsurance = insurances.find((i) => i.id === recetteForm.insuranceId);
    const insuranceName = selectedInsurance?.name || 'Assurance';
    const paymentMethod: DbPaymentMethod = normalizePaymentMethodForDb(String(recetteForm.method || 'Espèces'));
    const cashierName = getCashierName({
      email: writer.email,
      user_metadata: writer.user_metadata as Record<string, unknown> | null,
    });

    const payloadBase = {
      shift_id: currentShift.id,
      amount: totalAmount,
      description: recetteForm.isInsurancePayment
        ? `Recette assurance: ${insuranceName} | Carte: ${recetteForm.insuranceCardId}`
        : 'Recette',
      type: 'Recette',
      category: 'Vente',
      payment_method: paymentMethod,
      status: 'approved',
      insurance_name: recetteForm.isInsurancePayment ? insuranceName : null,
      created_by: writer.id,
      cashier_name: cashierName,
      is_approved: true,
      ...(recetteForm.isInsurancePayment
        ? {
          insurance_id: recetteForm.insuranceId,
          insurance_card_id: recetteForm.insuranceCardId,
          coverage_percent: coveragePercent,
          amount_covered_by_insurance: insurancePart,
        }
        : {}),
    };

    // Primary write path, then minimal schema fallback.
    let { error: insertError } = await supabase.from('transactions').insert(payloadBase);

    if (insertError) {
      const payloadMinimal = {
        shift_id: currentShift.id,
        amount: totalAmount,
        description: recetteForm.isInsurancePayment
          ? `Recette assurance: ${insuranceName} | Carte: ${recetteForm.insuranceCardId}`
          : 'Recette',
        type: 'Recette',
        category: 'Vente',
        payment_method: paymentMethod,
        status: 'approved',
        insurance_name: recetteForm.isInsurancePayment ? insuranceName : null,
        created_by: writer.id,
        is_approved: true,
      };
      const retryMinimal = await supabase.from('transactions').insert(payloadMinimal);
      insertError = retryMinimal.error;
    }

    if (insertError) {
      setError(formatSupabaseError(insertError, 'Erreur lors de l\'enregistrement.'));
      return;
    }

    // Reset and refresh
    setRecetteForm({
      amount: '',
      method: 'Espèces',
      isInsurancePayment: false,
      insuranceId: '',
      insuranceCardId: '',
      insurancePercentage: 80,
    });
    setShowRecetteForm(false);
    await refreshTransactions();
  };

  const handleApprove = async (id: string) => {
    if (!user) return;
    const updatePayload = { status: 'approved', is_approved: true, approved_by: user.id, approved_at: new Date().toISOString() };

    const { error: updateError } = await supabase
      .from('transactions')
      .update(updatePayload)
      .eq('id', id);

    if (updateError) {
      setError(formatSupabaseError(updateError, 'Erreur lors de la validation.'));
      return;
    }
    await refreshTransactions();
  };

  const handleReject = async (id: string) => {
    if (!user) return;
    const updatePayload = { status: 'rejected', is_approved: false, rejected_by: user.id, rejected_at: new Date().toISOString() };

    const { error: updateError } = await supabase
      .from('transactions')
      .update(updatePayload)
      .eq('id', id);

    if (updateError) {
      setError(formatSupabaseError(updateError, 'Erreur lors du rejet.'));
      return;
    }
    await refreshTransactions();
  };

  const handleCloseShift = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!currentShift) {
      setError('Aucune garde active.');
      return;
    }

    if (!closeShiftForm.actualCash || isNaN(parseFloat(closeShiftForm.actualCash))) {
      setError('Montant du tiroir invalide.');
      return;
    }

    const actualCashAmount = parseFloat(closeShiftForm.actualCash);

    // Calculate totals by method
    const recettesEspeces = transactions
      .filter(t => t.type === 'recette' && isCashMethod(String(t.method)))
      .reduce((sum, t) => sum + getPatientCashPart(t), 0);

    const recettesOrangeMoney = transactions
      .filter(t => t.type === 'recette' && isOrangeMethod(String(t.method)))
      .reduce((sum, t) => sum + getPatientCashPart(t), 0);

    const recettesAssurance = transactions
      .filter(t => t.type === 'recette' && isInsuranceTransaction(t))
      .reduce((sum, t) => sum + getInsuranceCoveredAmount(t), 0);

    const totalRetours = Math.abs(
      transactions
        .filter(t => t.type === 'retour')
        .reduce((sum, t) => sum + Number(t.amount || 0), 0)
    );

    const totalRecettes = transactions
      .filter(t => t.type === 'recette')
      .reduce((sum, t) => sum + getPatientCashPart(t) + getInsuranceCoveredAmount(t), 0);

    const totalDepenses = transactions
      .filter(t => t.type === 'dépense' && t.status === 'approved')
      .reduce((sum, t) => sum + t.amount, 0);

    const soldeNetARemettre = (recettesEspeces + recettesOrangeMoney) - totalRetours - totalDepenses;

    // Expected cash = espèces income + approved espèces expenses
    const expectedCash = transactions
      .filter(t => isCashMethod(String(t.method)))
      .reduce((sum, t) => {
        if (t.type === 'recette') {
          return sum + getPatientCashPart(t);
        } else if (t.type === 'dépense' && t.status === 'approved') {
          return sum - t.amount;
        }
        return sum;
      }, 0);

    // Difference between what's in the drawer and what we expect
    const cashDifference = actualCashAmount - expectedCash;

    const { error: updateError } = await supabase
      .from('shifts')
      .update({
        ended_at: new Date().toISOString(),
        expected_cash: expectedCash,
        actual_cash: actualCashAmount,
        cash_difference: cashDifference,
        closed_by: user?.id,
      })
      .eq('id', currentShift.id);

    if (updateError) {
      setError(formatSupabaseError(updateError, 'Erreur lors de la clôture.'));
      return;
    }

    // Set the summary for the success screen
    setClosedShiftSummary({
      date: new Date().toLocaleDateString('fr-FR'),
      totalRecettes,
      recettesEspeces,
      recettesOrangeMoney,
      recettesAssurance,
      totalRetours,
      totalDepenses,
      soldeNetARemettre,
      cashDifference,
    });

    setShowCloseShiftForm(false);
    setCloseShiftForm({ actualCash: '' });
  };

  const totalRecettes = transactions
    .filter(t => t.type === 'recette')
    .reduce((sum, t) => sum + getPatientCashPart(t), 0);

  const totalRetoursClient = Math.abs(
    transactions
      .filter(t => t.type === 'retour')
      .reduce((sum, t) => sum + Number(t.amount || 0), 0)
  );

  const totalDepenses = transactions
    .filter(t => t.type === 'dépense' && t.status === 'approved')
    .reduce((sum, t) => sum + t.amount, 0);

  // Breakdown of recettes by method
  const recettesEspeces = transactions
    .filter(t => t.type === 'recette' && isCashMethod(String(t.method)))
    .reduce((sum, t) => sum + getPatientCashPart(t), 0);

  const recettesOrangeMoney = transactions
    .filter(t => t.type === 'recette' && isOrangeMethod(String(t.method)))
    .reduce((sum, t) => sum + getPatientCashPart(t), 0);

  const recettesAssurance = transactions
    .filter(t => t.type === 'recette' && isInsuranceTransaction(t))
    .reduce((sum, t) => sum + getInsuranceCoveredAmount(t), 0);

  const totalEspecesCaisse = transactions
    .filter(t => isCashMethod(String(t.method)))
    .reduce((sum, t) => {
      if (t.type === 'recette') return sum + getPatientCashPart(t);
      if (t.type === 'retour') return sum + Number(t.amount || 0);
      if (t.type === 'dépense' && t.status === 'approved') return sum - t.amount;
      return sum;
    }, 0);

  const totalOrangeMoney = transactions
    .filter(t => isOrangeMethod(String(t.method)))
    .reduce((sum, t) => {
      if (t.type === 'recette') return sum + getPatientCashPart(t);
      if (t.type === 'retour') return sum + Number(t.amount || 0);
      return sum;
    }, 0);

  const soldeNetARemettre = totalEspecesCaisse + totalOrangeMoney;

  const handleGenerateDailyReport = () => {
    try {
      const dateLabel = new Date().toLocaleDateString('fr-FR');
      const format = (value: number) => Number(value || 0).toFixed(2).replace('.', ',');
      const message =
        `Rapport Pharmacie Djoma - ${dateLabel}. ` +
        `Espèces: ${format(totalEspecesCaisse)} GNF, ` +
        `OM: ${format(totalOrangeMoney)} GNF, ` +
        `Retours: ${format(totalRetoursClient)} GNF. ` +
        `Solde Net: ${format(soldeNetARemettre)} GNF. ` +
        `Propulsé par BIZMAP.`;

      downloadShiftReceiptPDF({
        date: dateLabel,
        cashierName: user?.email?.split('@')[0] || 'Caissier',
        expectedCash: totalEspecesCaisse,
        actualCash: totalEspecesCaisse,
        cashDifference: 0,
      });

      const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
      window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossible de générer le rapport de clôture.');
    }
  };

  const gardeStatus = currentShift
    ? `En cours depuis ${new Date(currentShift.started_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`
    : 'Aucune garde en cours';

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <header className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="h-2 w-8 bg-emerald-500 rounded-full" />
            <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-[0.2em]">Pilotage Officine</span>
          </div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900">
            Pharmacie Djoma
          </h1>
          <p className="mt-1 text-sm font-medium text-slate-500">
            Session {role}: <span className="font-bold text-slate-900">{user?.email?.split('@')[0]}</span>
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          {isAdmin && pendingApprovalsCount > 0 && (
            <Button
              onClick={() => navigate('/dashboard/depenses')}
              variant="outline"
              className="rounded-xl border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100 font-bold text-xs px-5 h-11"
            >
              <AlertTriangle className="mr-2 h-4 w-4" />
              {pendingApprovalsCount} Dépenses à valider
            </Button>
          )}

          {!currentShift && (
            <Button
              onClick={handleStartShift}
              isLoading={isStarting}
              className="gap-2 h-11 rounded-xl pharmacy-gradient text-white font-bold shadow-lg shadow-emerald-500/25 px-6 border-0"
            >
              <Play className="h-4 w-4" />
              Ouvrir la Caisse
            </Button>
          )}
        </div>
      </header>

      {error && (
        <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-100 flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
          <AlertTriangle className="h-5 w-5 text-rose-500" />
          <p className="text-xs font-bold text-rose-600 uppercase tracking-widest">{error}</p>
        </div>
      )}

      <StatsGrid />

      {
        closedShiftSummary && (
          <section className="mb-8 rounded-lg border border-green-200 bg-green-50 p-8">
            <div className="mb-6 flex items-center justify-center gap-3">
              <CheckCircle className="h-8 w-8 text-green-600" />
              <h2 className="text-2xl font-bold text-green-900">Garde Clôturée avec Succès</h2>
            </div>

            <div className="space-y-4 rounded-lg border border-green-200 bg-white p-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-sm text-muted-foreground">Date</p>
                  <p className="mt-1 font-semibold text-foreground">{closedShiftSummary.date}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Caissier</p>
                  <p className="mt-1 font-semibold text-foreground">
                    {user?.email?.split('@')[0] || 'Utilisateur'}
                  </p>
                </div>
              </div>

              <div className="border-t border-border pt-4">
                <p className="text-sm font-medium text-foreground">Recettes Totales</p>
                <p className="mt-2 text-2xl font-bold text-green-600">
                  {closedShiftSummary.totalRecettes.toFixed(2).replace('.', ',')} GNF
                </p>
                <div className="mt-3 space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">💵 Espèces</span>
                    <span>{closedShiftSummary.recettesEspeces.toFixed(2).replace('.', ',')} GNF</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">📱 Orange Money</span>
                    <span>{closedShiftSummary.recettesOrangeMoney.toFixed(2).replace('.', ',')} GNF</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">🏥 Assurance</span>
                    <span>{closedShiftSummary.recettesAssurance.toFixed(2).replace('.', ',')} GNF</span>
                  </div>
                </div>
              </div>

              <div className="border-t border-border pt-4">
                <p className="text-sm text-muted-foreground">Dépenses Approuvées</p>
                <p className="mt-1 font-semibold text-foreground">
                  {closedShiftSummary.totalDepenses.toFixed(2).replace('.', ',')} GNF
                </p>
              </div>

              <div className="border-t border-border pt-4">
                <p className="text-sm text-muted-foreground">Retours Client</p>
                <p className="mt-1 font-semibold text-foreground">
                  {closedShiftSummary.totalRetours.toFixed(2).replace('.', ',')} GNF
                </p>
              </div>

              <div className="border-t border-border pt-4">
                <p className="text-sm text-muted-foreground">Écart de Caisse</p>
                <p
                  className={`mt-1 text-lg font-bold ${closedShiftSummary.cashDifference === 0
                    ? 'text-green-600'
                    : closedShiftSummary.cashDifference < 0
                      ? 'text-red-600'
                      : 'text-orange-600'
                    }`}
                >
                  {closedShiftSummary.cashDifference >= 0 ? '+' : ''}
                  {closedShiftSummary.cashDifference.toFixed(2).replace('.', ',')} GNF
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {closedShiftSummary.cashDifference === 0
                    ? '✅ Parfait - Aucun écart'
                    : closedShiftSummary.cashDifference < 0
                      ? '❌ Manquant - Vérifiez le tiroir'
                      : '✓ Surplus - Argent supplémentaire'}
                </p>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <Button
                onClick={() => {
                  const message = generateWhatsAppMessage({
                    date: closedShiftSummary.date,
                    cashierName: user?.email?.split('@')[0] || 'Caissier',
                    totalRecettes: closedShiftSummary.totalRecettes,
                    recettesEspeces: closedShiftSummary.recettesEspeces,
                    recettesOrangeMoney: closedShiftSummary.recettesOrangeMoney,
                    recettesAssurance: closedShiftSummary.recettesAssurance,
                    totalDepenses: closedShiftSummary.totalDepenses,
                    cashDifference: closedShiftSummary.cashDifference,
                  });
                  shareViaWhatsApp(message);
                }}
                className="gap-2 bg-green-600 hover:bg-green-700"
              >
                <Share2 className="h-4 w-4" />
                Partager sur WhatsApp
              </Button>
              <Button
                onClick={() => {
                  downloadShiftReceiptPDF({
                    date: closedShiftSummary.date,
                    cashierName: user?.email?.split('@')[0] || 'Caissier',
                    expectedCash: closedShiftSummary.recettesEspeces,
                    actualCash: closedShiftSummary.recettesEspeces,
                    cashDifference: 0,
                  });

                  const ownerMessage =
                    `*RAPPORT JOURNALIER - PHARMACIE DJOMA*\n` +
                    `-----------------------------------\n` +
                    `📅 Date: ${closedShiftSummary.date}\n` +
                    `💰 Espèces: ${closedShiftSummary.recettesEspeces.toFixed(2).replace('.', ',')} GNF\n` +
                    `📱 Orange Money: ${closedShiftSummary.recettesOrangeMoney.toFixed(2).replace('.', ',')} GNF\n` +
                    `🔄 Retours: ${closedShiftSummary.totalRetours.toFixed(2).replace('.', ',')} GNF\n` +
                    `📉 Dépenses: ${closedShiftSummary.totalDepenses.toFixed(2).replace('.', ',')} GNF\n` +
                    `✅ *Net à Remettre: ${closedShiftSummary.soldeNetARemettre.toFixed(2).replace('.', ',')} GNF*\n` +
                    `-----------------------------------\n` +
                    `Propulsé par BIZMAP - Croissance Digitale.`;

                  const ownerUrl = `https://wa.me/?text=${encodeURIComponent(ownerMessage)}`;
                  window.open(ownerUrl, '_blank', 'noopener,noreferrer');
                }}
                className="gap-2 bg-emerald-800 hover:bg-emerald-900"
              >
                <Share2 className="h-4 w-4" />
                Partager sur WhatsApp Propriétaire
              </Button>
              <Button
                onClick={() => {
                  setClosedShiftSummary(null);
                  window.location.href = '/dashboard';
                }}
                variant="outline"
              >
                Retour à Pharmacie Djoma
              </Button>
            </div>
          </section>
        )
      }

      {
        !closedShiftSummary && (
          <>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 mb-12">
              <StatCard
                title="Garde Actuelle"
                value={gardeStatus}
                icon={CalendarClock}
                subtitle={currentShift ? 'Rapport de session actif' : 'Prêt pour l\'ouverture'}
                className="border-l-4 border-l-emerald-500"
              />

              <div className="stats-card border-l-4 border-l-blue-500">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Recettes Opérationnelles</p>
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                    <TrendingUp className="h-4 w-4" aria-hidden />
                  </div>
                </div>
                <p className="mt-3 text-2xl font-black text-slate-900">{`${totalRecettes.toFixed(2).replace('.', ',')} GNF`}</p>
                <div className="mt-4 grid grid-cols-3 gap-2 border-t border-slate-100 pt-4">
                  <div className="text-center">
                    <p className="text-[9px] font-bold text-slate-400 uppercase">Espèces</p>
                    <p className="text-[11px] font-bold text-slate-800">{Math.round(recettesEspeces / 1000)}k</p>
                  </div>
                  <div className="text-center border-x border-slate-100 px-1">
                    <p className="text-[9px] font-bold text-slate-400 uppercase">O. Money</p>
                    <p className="text-[11px] font-bold text-slate-800">{Math.round(recettesOrangeMoney / 1000)}k</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[9px] font-bold text-slate-400 uppercase">Assur.</p>
                    <p className="text-[11px] font-bold text-slate-800">{Math.round(recettesAssurance / 1000)}k</p>
                  </div>
                </div>
              </div>

              <StatCard
                title="Charge de Dépenses"
                value={`${totalDepenses.toFixed(2).replace('.', ',')} GNF`}
                icon={Receipt}
                subtitle={`${transactions.filter(t => t.type === 'dépense' && t.status === 'approved').length} Dépenses validées`}
                className="border-l-4 border-l-rose-500"
              />
            </div>

            <section className="mb-10 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-lg font-black text-slate-900">Clôture de Caisse</h2>
                  <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                    Synthèse Quotidienne PharmaVault
                  </p>
                </div>
                <Button
                  onClick={handleGenerateDailyReport}
                  className="h-11 rounded-xl bg-emerald-600 px-5 font-bold text-white hover:bg-emerald-700"
                >
                  Générer Rapport PDF & WhatsApp
                </Button>
              </div>
              <div className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-500">💵 Espèces en Caisse</p>
                  <p className="mt-1 text-lg font-black text-slate-900">{totalEspecesCaisse.toFixed(2).replace('.', ',')} GNF</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-500">📱 Orange Money</p>
                  <p className="mt-1 text-lg font-black text-slate-900">{totalOrangeMoney.toFixed(2).replace('.', ',')} GNF</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-500">🔄 Retours Client</p>
                  <p className="mt-1 text-lg font-black text-slate-900">{totalRetoursClient.toFixed(2).replace('.', ',')} GNF</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-500">📉 Dépenses</p>
                  <p className="mt-1 text-lg font-black text-slate-900">{totalDepenses.toFixed(2).replace('.', ',')} GNF</p>
                </div>
              </div>
              <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                <p className="text-xs font-bold uppercase tracking-wider text-emerald-700">Solde Net à Remettre</p>
                <p className="mt-1 text-xl font-black text-emerald-700">{soldeNetARemettre.toFixed(2).replace('.', ',')} GNF</p>
              </div>
            </section>

            <section className="space-y-6">
              <div className="flex items-center gap-3">
                <div className="h-4 w-1 bg-slate-400 rounded-full" />
                <h2 className="text-sm font-bold text-slate-800 uppercase tracking-widest">Postes de Gestion</h2>
              </div>

              <div className={`grid grid-cols-2 ${isAdmin ? 'md:grid-cols-4' : 'md:grid-cols-3'} gap-6`}>
                <button
                  onClick={() => navigate('/dashboard/depenses')}
                  className="group flex flex-col items-center justify-center gap-4 p-8 rounded-2xl bg-white border border-slate-200 shadow-sm hover:border-emerald-500/50 hover:shadow-xl hover:shadow-emerald-500/5 transition-all duration-300"
                >
                  <div className="h-14 w-14 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center group-hover:scale-110 group-hover:bg-rose-500 group-hover:text-white transition-all shadow-sm">
                    <Receipt className="h-7 w-7" />
                  </div>
                  <div>
                    <span className="block text-sm font-bold text-slate-800">Dépenses</span>
                    <span className="text-[10px] text-slate-400 font-medium uppercase tracking-tighter">Comptabilité</span>
                  </div>
                </button>

                <button
                  onClick={() => navigate('/dashboard/assurances')}
                  className="group flex flex-col items-center justify-center gap-4 p-8 rounded-2xl bg-white border border-slate-200 shadow-sm hover:border-emerald-500/50 hover:shadow-xl hover:shadow-emerald-500/5 transition-all duration-300"
                >
                  <div className="h-14 w-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center group-hover:scale-110 group-hover:bg-blue-500 group-hover:text-white transition-all shadow-sm">
                    <Building2 className="h-7 w-7" />
                  </div>
                  <div>
                    <span className="block text-sm font-bold text-slate-800">Assurances</span>
                    <span className="text-[10px] text-slate-400 font-medium uppercase tracking-tighter">Tiers-Payant</span>
                  </div>
                </button>

                {isAdmin && (
                  <button
                    onClick={() => navigate('/dashboard/personnel')}
                    className="group flex flex-col items-center justify-center gap-4 p-8 rounded-2xl bg-white border border-slate-200 shadow-sm hover:border-emerald-500/50 hover:shadow-xl hover:shadow-emerald-500/5 transition-all duration-300"
                  >
                    <div className="h-14 w-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:scale-110 group-hover:bg-emerald-500 group-hover:text-white transition-all shadow-sm">
                      <Users className="h-7 w-7" />
                    </div>
                    <div>
                      <span className="block text-sm font-bold text-slate-800">Personnel</span>
                      <span className="text-[10px] text-slate-400 font-medium uppercase tracking-tighter">Ressources</span>
                    </div>
                  </button>
                )}

                <button
                  onClick={() => navigate('/dashboard/parametres')}
                  className="group flex flex-col items-center justify-center gap-4 p-8 rounded-2xl bg-white border border-slate-200 shadow-sm hover:border-emerald-500/50 hover:shadow-xl hover:shadow-emerald-500/5 transition-all duration-300"
                >
                  <div className="h-14 w-14 rounded-2xl bg-slate-50 text-slate-500 flex items-center justify-center group-hover:scale-110 group-hover:bg-slate-600 group-hover:text-white transition-all shadow-sm">
                    <Settings className="h-7 w-7" />
                  </div>
                  <div>
                    <span className="block text-sm font-bold text-slate-800">Réglages</span>
                    <span className="text-[10px] text-slate-400 font-medium uppercase tracking-tighter">Système</span>
                  </div>
                </button>
              </div>
            </section>

            {currentShift && (
              <section className="mt-8 rounded-lg border border-border bg-card p-6">
                <h2 className="text-lg font-medium text-foreground">Actions Rapides</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Enregistrez rapidement les recettes et dépenses de votre garde
                </p>

                <div className="mt-6 flex flex-wrap gap-3">
                  {!showRecetteForm ? (
                    <Button
                      onClick={() => setShowRecetteForm(true)}
                      className="gap-2"
                    >
                      <Plus className="h-4 w-4" />
                      Nouvelle Recette
                    </Button>
                  ) : null}

                  <Button
                    variant="outline"
                    onClick={() => navigate('/dashboard/depenses')}
                    className="gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    Nouvelle Dépense
                  </Button>

                  {!showCloseShiftForm ? (
                    <Button
                      variant="outline"
                      onClick={() => setShowCloseShiftForm(true)}
                      className="gap-2 text-destructive hover:bg-destructive/10"
                    >
                      <X className="h-4 w-4" />
                      Fin de Garde
                    </Button>
                  ) : null}
                </div>
              </section>
            )}

            {showRecetteForm && (
              <CashEntryForm
                value={recetteForm}
                onChange={setRecetteForm}
                onSubmit={handleAddRecette}
                onCancel={() => setShowRecetteForm(false)}
                insurances={insurances}
                insuranceLoadError={insuranceLoadError}
                isOnline={isOnline}
              />
            )}

            {showCloseShiftForm && (
              <section className="mt-6 rounded-lg border border-destructive/30 bg-destructive/5 p-6">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-lg font-medium text-foreground">Clôturer la Garde</h2>
                  <button onClick={() => setShowCloseShiftForm(false)} className="text-muted-foreground hover:text-foreground">
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div className="mb-4 rounded-lg border border-border bg-card p-4">
                  <p className="text-sm text-muted-foreground">
                    <strong>Espèces attendues :</strong> {transactions
                      .filter(t => isCashMethod(String(t.method)))
                      .reduce((sum, t) => {
                        if (t.type === 'recette') {
                          return sum + getPatientCashPart(t);
                        } else if (t.type === 'dépense' && t.status === 'approved') {
                          return sum - t.amount;
                        }
                        return sum;
                      }, 0)
                      .toFixed(2)
                      .replace('.', ',')} GNF
                  </p>
                </div>

                <form onSubmit={handleCloseShift} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground">Montant exact du tiroir (GNF) *</label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      placeholder="Entrez le montant compté dans le tiroir"
                      value={closeShiftForm.actualCash}
                      onChange={(e) => setCloseShiftForm({ actualCash: e.target.value })}
                      className="mt-1"
                    />
                    <p className="mt-1 text-xs text-muted-foreground">
                      Veuillez compter l'argent réel dans le tiroir avant de valider.
                    </p>
                  </div>

                  <div className="flex gap-3">
                    <div className="flex-1">
                      <Button type="submit" variant="destructive" disabled={!isOnline} className="w-full">
                        Valider la Clôture
                      </Button>
                      {!isOnline && (
                        <p className="mt-2 text-xs text-amber-700">Connexion requise pour clôturer la garde. Veuillez rétablir internet pour synchroniser le rapport final.</p>
                      )}
                    </div>
                    <Button type="button" variant="outline" onClick={() => setShowCloseShiftForm(false)}>
                      Annuler
                    </Button>
                  </div>
                </form>
              </section>
            )}

            {!currentShift && (
              <section className="mt-8 rounded-lg border border-border bg-card p-6">
                <h2 className="text-lg font-medium text-foreground">Garde</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Démarrez une garde pour enregistrer votre tour et associer les recettes et dépenses.
                </p>
                <Button
                  className="mt-4"
                  onClick={handleStartShift}
                  disabled={isStarting}
                  isLoading={isStarting}
                >
                  <Play className="mr-2 h-4 w-4" aria-hidden />
                  Démarrer la Garde
                </Button>
              </section>
            )}

            {currentShift && transactions.length > 0 && (
              <section className="mt-8 rounded-lg border border-border bg-card p-6">
                <h2 className="text-lg font-medium text-foreground">Transactions Récentes</h2>
                <div className="mt-4 space-y-2">
                  {transactions.slice(0, 5).map((tx) => (
                    <div key={tx.id} className="flex items-center justify-between border-b border-border py-2 last:border-0">
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {tx.type === 'recette' ? '📥 Recette' : '📤 Dépense'}
                        </p>
                        <div className="flex items-center gap-2">
                          <p className="text-xs text-muted-foreground">{tx.description}</p>
                          <span className={`text-[10px] font-black uppercase tracking-widest ${tx.status === 'pending'
                            ? 'text-amber-600'
                            : tx.status === 'rejected'
                              ? 'text-rose-600'
                              : 'text-emerald-600'
                            }`}>
                            {tx.status === 'pending' ? '[EN ATTENTE]' : tx.status === 'rejected' ? '[REJETÉ]' : '[VALIDÉ]'}
                          </span>
                        </div>
                      </div>
                      <p className={`text-sm font-semibold ${tx.type === 'recette' ? 'text-green-600' : 'text-red-600'}`}>
                        {tx.type === 'recette' ? '+' : '-'}{tx.amount.toFixed(2).replace('.', ',')} GNF
                      </p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            <section className="mt-8">
              <TransactionLedger />
            </section>
          </>
        )
      }
    </div >
  );
}

function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  className,
}: {
  title: string;
  value: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
  className?: string;
}) {
  return (
    <div className={`rounded-lg border border-border bg-card p-5 shadow-sm ${className || ''}`}>
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-muted-foreground">{title}</p>
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/15 text-primary">
          <Icon className="h-4 w-4" aria-hidden />
        </div>
      </div>
      <p className="mt-2 text-xl font-semibold text-foreground">{value}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>
    </div>
  );
}

export default Dashboard;
