import { useEffect, useState, useCallback, useRef } from 'react';
import { useConnection } from '@/context/ConnectionContext';
import { Play, X, Share2, CheckCircle, AlertTriangle, History, Check, RotateCcw, Maximize2, Minimize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import StatsGrid from '@/components/StatsGrid';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { useNavigate } from 'react-router-dom';
import { generateWhatsAppMessage, shareViaWhatsApp } from '@/lib/whatsapp';
import { downloadShiftReceiptPDF } from '@/lib/pdf';
import type { Shift, Transaction, PaymentMethod } from '@/lib/database.types';
import { formatSupabaseError } from '@/lib/supabaseError';

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

function formatAmountGNF(value: number): string {
  return Number(value || 0).toLocaleString('fr-FR', { maximumFractionDigits: 2 });
}

function formatElapsed(startedAt: string): string {
  const now = Date.now();
  const start = new Date(startedAt).getTime();
  const totalSeconds = Math.max(0, Math.floor((now - start) / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map((n) => String(n).padStart(2, '0')).join(':');
}

function formatRealtimeClock(value: Date): string {
  return new Intl.DateTimeFormat('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(value);
}

function formatRealtimeDate(value: Date): string {
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
    .format(value)
    .replace('.', '')
    .toUpperCase();
}

function playSuccessTone() {
  try {
    const AudioCtx = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const context = new AudioCtx();
    const oscillator = context.createOscillator();
    const gain = context.createGain();

    oscillator.type = 'triangle';
    oscillator.frequency.setValueAtTime(740, context.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(1040, context.currentTime + 0.18);
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.08, context.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.22);

    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.22);
  } catch {
    // Silent fallback if browser audio context is blocked.
  }
}

export function Dashboard() {
  const { user, role } = useAuth();
  const { isOnline } = useConnection();
  const navigate = useNavigate();

  const [currentShift, setCurrentShift] = useState<Shift | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [showCloseShiftForm, setShowCloseShiftForm] = useState(false);
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [showHistoryPanel, setShowHistoryPanel] = useState(false);
  const [showTerminal, setShowTerminal] = useState(false);
  const [showPreCloseModal, setShowPreCloseModal] = useState(false);
  const [showSaveConfirmation, setShowSaveConfirmation] = useState(false);
  const [receivedAmount, setReceivedAmount] = useState('');
  const [isSubmittingRecette, setIsSubmittingRecette] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pendingApprovalsCount, setPendingApprovalsCount] = useState(0);
  const [clockNow, setClockNow] = useState(() => new Date());
  const [isFullscreen, setIsFullscreen] = useState(
    typeof document !== 'undefined' ? Boolean(document.fullscreenElement) : false
  );
  const amountInputRef = useRef<HTMLInputElement | null>(null);

  // Recette form state
  const [recetteForm, setRecetteForm] = useState({
    amount: '',
    method: 'Espèces' as PaymentMethod,
    isInsuranceSale: false,
    insurerName: 'CNAMGS',
    coverageRate: 80,
    matricule: '',
  });

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

  useEffect(() => {
    const timer = window.setInterval(() => {
      setClockNow(new Date());
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const syncFullscreenState = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', syncFullscreenState);
    return () => document.removeEventListener('fullscreenchange', syncFullscreenState);
  }, []);

  useEffect(() => {
    if (!currentShift) return;
    const timer = window.setTimeout(() => {
      amountInputRef.current?.focus();
    }, 50);
    return () => window.clearTimeout(timer);
  }, [currentShift]);

  useEffect(() => {
    if (!showTerminal || closedShiftSummary || !currentShift || showVerificationModal || showPreCloseModal || showCloseShiftForm) return;
    const amountInput = amountInputRef.current;
    if (!amountInput) return;
    if (document.activeElement !== amountInput) {
      amountInput.focus();
    }
  }, [clockNow, showTerminal, closedShiftSummary, currentShift, showVerificationModal, showPreCloseModal, showCloseShiftForm]);

  useEffect(() => {
    if (!showSaveConfirmation) return;
    const timer = window.setTimeout(() => setShowSaveConfirmation(false), 1800);
    return () => window.clearTimeout(timer);
  }, [showSaveConfirmation]);

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

  const saveRecette = async () => {
    setError(null);
    setIsSubmittingRecette(true);

    if (!user || !currentShift) {
      setError('Une garde active est requise.');
      setIsSubmittingRecette(false);
      return;
    }

    if (!recetteForm.amount || isNaN(parseFloat(recetteForm.amount))) {
      setError('Montant invalide.');
      setIsSubmittingRecette(false);
      return;
    }

    // Refresh auth context before write to avoid stale user/session data.
    const { data: freshUserData, error: freshUserError } = await supabase.auth.getUser();
    if (freshUserError) {
      setError(formatSupabaseError(freshUserError, 'Impossible de vérifier la session utilisateur.'));
      setIsSubmittingRecette(false);
      return;
    }
    const writer = freshUserData.user || user;
    if (!writer?.id) {
      setError('Session utilisateur invalide. Veuillez vous reconnecter.');
      setIsSubmittingRecette(false);
      return;
    }

    const totalAmount = parseFloat(recetteForm.amount);
    const isInsuranceSale = recetteForm.isInsuranceSale;
    const coverageRate = isInsuranceSale ? Number(recetteForm.coverageRate || 0) : 0;
    const insurancePart = isInsuranceSale ? Number((totalAmount * (coverageRate / 100)).toFixed(2)) : 0;
    const patientPart = isInsuranceSale ? Math.max(0, Number((totalAmount - insurancePart).toFixed(2))) : totalAmount;
    const paymentMethod: DbPaymentMethod = normalizePaymentMethodForDb(String(recetteForm.method || 'Espèces'));
    const cashierName = getCashierName({
      email: writer.email,
      user_metadata: writer.user_metadata as Record<string, unknown> | null,
    });

    const payloadBase = {
      shift_id: currentShift.id,
      amount: totalAmount,
      description: isInsuranceSale
        ? `Recette Assurance - ${recetteForm.insurerName} | Matricule: ${recetteForm.matricule} | Patient: ${formatAmountGNF(patientPart)} | Assurance: ${formatAmountGNF(insurancePart)}`
        : 'Recette',
      type: 'Recette',
      category: 'Vente',
      payment_method: paymentMethod,
      status: 'approved',
      insurance_name: isInsuranceSale ? recetteForm.insurerName : null,
      insurance_card_id: isInsuranceSale ? recetteForm.matricule : null,
      insurance_percentage: isInsuranceSale ? coverageRate : null,
      amount_covered_by_insurance: isInsuranceSale ? insurancePart : null,
      created_by: writer.id,
      cashier_name: cashierName,
      is_approved: true,
    };

    // Primary write path, then minimal schema fallback.
    let { error: insertError } = await supabase.from('transactions').insert(payloadBase);

    if (insertError) {
      const payloadMinimal = {
        shift_id: currentShift.id,
        amount: totalAmount,
        description: isInsuranceSale
          ? `Recette Assurance - ${recetteForm.insurerName} | Matricule: ${recetteForm.matricule}`
          : 'Recette',
        type: 'Recette',
        category: 'Vente',
        payment_method: paymentMethod,
        status: 'approved',
        insurance_name: isInsuranceSale ? recetteForm.insurerName : null,
        insurance_card_id: isInsuranceSale ? recetteForm.matricule : null,
        insurance_percentage: isInsuranceSale ? coverageRate : null,
        amount_covered_by_insurance: isInsuranceSale ? insurancePart : null,
        created_by: writer.id,
        is_approved: true,
      };
      const retryMinimal = await supabase.from('transactions').insert(payloadMinimal);
      insertError = retryMinimal.error;
    }

    if (insertError) {
      setError(formatSupabaseError(insertError, 'Erreur lors de l\'enregistrement.'));
      setIsSubmittingRecette(false);
      return;
    }

    // Reset and refresh
    setRecetteForm({
      amount: '',
      method: 'Espèces',
      isInsuranceSale: false,
      insurerName: 'CNAMGS',
      coverageRate: 80,
      matricule: '',
    });
    setReceivedAmount('');
    setShowVerificationModal(false);
    await refreshTransactions();
    setIsSubmittingRecette(false);
    setShowSaveConfirmation(true);
    playSuccessTone();
    window.requestAnimationFrame(() => amountInputRef.current?.focus());
  };

  const handleAddRecette = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const amount = parseFloat(recetteForm.amount);
    if (!recetteForm.amount || Number.isNaN(amount) || amount <= 0) {
      setError('Montant invalide.');
      return;
    }
    if (recetteForm.isInsuranceSale) {
      if (!recetteForm.insurerName.trim()) {
        setError('Veuillez sélectionner un assureur.');
        return;
      }
      if (!recetteForm.matricule.trim()) {
        setError('Veuillez renseigner le Numéro Matricule / Bon.');
        return;
      }
      const coverageRate = Number(recetteForm.coverageRate);
      if (Number.isNaN(coverageRate) || coverageRate < 0 || coverageRate > 100) {
        setError('Le taux de prise en charge doit être entre 0% et 100%.');
        return;
      }
    }
    setReceivedAmount('');
    setShowVerificationModal(true);
  };

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch {
      setError('Impossible d\'activer le mode plein ecran sur ce navigateur.');
    }
  };

  const handleConfirmRecette = async () => {
    await saveRecette();
  };

  const handleCloseShift = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!currentShift) {
      setError('Aucune garde active.');
      return;
    }
    if (!user?.id) {
      setError('Session utilisateur invalide. Veuillez vous reconnecter.');
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

    const { data: closingUserData, error: closingUserError } = await supabase.auth.getUser();
    if (closingUserError) {
      setError(formatSupabaseError(closingUserError, 'Impossible de verifier la session utilisateur.'));
      return;
    }
    const closedById = closingUserData.user?.id || user.id;
    if (!closedById) {
      setError('Session utilisateur invalide. Veuillez vous reconnecter.');
      return;
    }

    const { error: updateError } = await supabase
      .from('shifts')
      .update({
        ended_at: new Date().toISOString(),
        expected_cash: expectedCash,
        actual_cash: actualCashAmount,
        cash_difference: cashDifference,
        closed_by: closedById,
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

  const cashierName = getCashierName({
    email: user?.email ?? null,
    user_metadata: (user?.user_metadata as Record<string, unknown> | null) ?? null,
  });
  const shiftElapsed = currentShift ? formatElapsed(currentShift.started_at) : '00:00:00';
  const amountValue = Number.parseFloat(recetteForm.amount || '0');
  const insuranceCoverageRate = Number(recetteForm.coverageRate || 0);
  const insurancePart = recetteForm.isInsuranceSale ? Number((amountValue * (insuranceCoverageRate / 100)).toFixed(2)) : 0;
  const patientPart = recetteForm.isInsuranceSale ? Math.max(0, Number((amountValue - insurancePart).toFixed(2))) : amountValue;
  const amountToCollect = recetteForm.isInsuranceSale ? patientPart : amountValue;
  const receivedValue = Number.parseFloat(receivedAmount || '0');
  const hasReceived = receivedAmount.trim() !== '' && !Number.isNaN(receivedValue);
  const changeDue = hasReceived ? Math.max(0, Number((receivedValue - amountToCollect).toFixed(2))) : null;
  const recentEntries = transactions.slice(0, 10);
  const cashierTransactions = transactions.filter((tx) => tx.created_by === user?.id);
  const preCloseCashInDrawer = cashierTransactions
    .filter((tx) => isCashMethod(String(tx.method)))
    .reduce((sum, tx) => {
      if (tx.type === 'recette') return sum + getPatientCashPart(tx);
      if (tx.type === 'retour') return sum - Math.abs(Number(tx.amount || 0));
      if (tx.type === 'dépense' && tx.status === 'approved') return sum - tx.amount;
      return sum;
    }, 0);
  const preCloseCashTotal = cashierTransactions
    .filter((tx) => tx.type === 'recette' && isCashMethod(String(tx.method)))
    .reduce((sum, tx) => sum + getPatientCashPart(tx), 0);
  const preCloseOrangeMoneyTotal = cashierTransactions
    .filter((tx) => tx.type === 'recette' && isOrangeMethod(String(tx.method)))
    .reduce((sum, tx) => sum + getPatientCashPart(tx), 0);
  const preCloseReturnsTotal = Math.abs(
    cashierTransactions
      .filter((tx) => tx.type === 'retour')
      .reduce((sum, tx) => sum + Number(tx.amount || 0), 0)
  );
  const realTimeDisplay = formatRealtimeClock(clockNow);
  const realtimeDate = formatRealtimeDate(clockNow);
  const insurerOptions = ['CNAMGS', 'NSIA', 'LANALA', 'SAHAM', 'Activa', 'Autre'];
  const isTerminalMode = showTerminal && !closedShiftSummary;

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
          {showTerminal ? (
            <Button
              onClick={() => setShowTerminal(false)}
              variant="outline"
              className="rounded-xl border-slate-300 bg-white text-slate-700 hover:bg-slate-50 font-bold text-xs px-5 h-11"
            >
              Retour au Dashboard
            </Button>
          ) : (
            <Button
              onClick={() => setShowTerminal(true)}
              className="rounded-xl bg-slate-900 text-white hover:bg-slate-800 font-bold text-xs px-5 h-11"
            >
              Accéder au Terminal de Vente
            </Button>
          )}

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

      {showSaveConfirmation && (
        <div className="fixed right-4 top-24 z-50 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 shadow-lg animate-in fade-in slide-in-from-top-2">
          <p className="text-sm font-black uppercase tracking-widest text-emerald-700">
            Transaction enregistrée
          </p>
        </div>
      )}

      {!isTerminalMode && <StatsGrid />}

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
            {isTerminalMode ? (
              <>
                {currentShift ? (
                  <section className="relative min-h-[74vh] overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 text-white shadow-2xl">
                  <div className="pointer-events-none absolute -left-20 -top-20 h-72 w-72 rounded-full bg-emerald-500/20 blur-3xl" />
                  <div className="pointer-events-none absolute -right-10 top-1/4 h-72 w-72 rounded-full bg-cyan-500/10 blur-3xl" />

                  <div className="relative flex min-h-[74vh] flex-col p-5 md:p-8">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h2 className="text-2xl font-black tracking-tight md:text-3xl">Pharmacie Djoma</h2>
                        <p className="mt-1 text-sm text-slate-100">Caissier: <span className="font-black text-white">{cashierName}</span></p>
                        <p className="mt-2 text-sm font-black uppercase tracking-[0.2em] text-amber-300">Temps de garde: {shiftElapsed}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-[10px] font-black uppercase tracking-[0.35em] text-cyan-200/80">Temps Réel</p>
                        <p className="mt-1 text-5xl font-black tracking-[0.14em] text-white md:text-7xl">{realTimeDisplay}</p>
                        <div className="mt-2 flex items-center justify-center gap-2">
                          <p className="text-[10px] uppercase tracking-[0.25em] text-slate-300">{realtimeDate}</p>
                          <span
                            className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${
                              isOnline
                                ? 'border border-emerald-300/50 bg-emerald-500/20 text-emerald-200'
                                : 'border border-amber-300/50 bg-amber-500/20 text-amber-200'
                            }`}
                          >
                            Status: {isOnline ? 'Online' : 'Offline'}
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => void toggleFullscreen()}
                          className="border-cyan-400/40 bg-cyan-900/20 text-cyan-100 hover:bg-cyan-900/40"
                        >
                          {isFullscreen ? <Minimize2 className="mr-2 h-4 w-4" /> : <Maximize2 className="mr-2 h-4 w-4" />}
                          {isFullscreen ? 'Quitter Plein Écran' : 'Plein Écran'}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setShowHistoryPanel((prev) => !prev)}
                          className="border-slate-600 bg-slate-900/60 text-slate-100 hover:bg-slate-800"
                        >
                          <History className="mr-2 h-4 w-4" />
                          Historique
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setShowPreCloseModal(true)}
                          className="border-amber-400/40 bg-amber-900/20 text-amber-100 hover:bg-amber-900/40"
                        >
                          Pré-Clôture
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setShowCloseShiftForm(true)}
                          className="border-rose-400/40 bg-rose-900/20 text-rose-100 hover:bg-rose-900/40"
                        >
                          Fin de Garde
                        </Button>
                      </div>
                    </div>

                    <form onSubmit={handleAddRecette} className="mx-auto mt-12 flex w-full max-w-3xl flex-1 flex-col items-center justify-center gap-6">
                      <Input
                        ref={amountInputRef}
                        type="number"
                        step="0.01"
                        min="0"
                        required
                        placeholder="0"
                        value={recetteForm.amount}
                        onChange={(e) => setRecetteForm((prev) => ({ ...prev, amount: e.target.value }))}
                        className="h-28 w-full rounded-3xl border-2 border-emerald-300/70 bg-white/95 text-center text-5xl font-black text-slate-900 shadow-2xl placeholder:text-slate-300 focus-visible:border-emerald-500 focus-visible:ring-emerald-500/40 md:text-6xl"
                      />
                      <div className="flex w-full max-w-xl flex-wrap items-center justify-center gap-3">
                        <button
                          type="button"
                          onClick={() => setRecetteForm((prev) => ({ ...prev, method: 'Espèces' }))}
                          className={`rounded-2xl border px-6 py-3 text-sm font-black uppercase tracking-wider transition ${normalizePaymentMethodForDb(String(recetteForm.method)) === 'Espèces'
                            ? 'border-emerald-300 bg-emerald-500 text-slate-950'
                            : 'border-slate-600 bg-slate-800/70 text-slate-200 hover:bg-slate-700/80'
                            }`}
                        >
                          Espèces
                        </button>
                        <button
                          type="button"
                          onClick={() => setRecetteForm((prev) => ({ ...prev, method: 'Orange Money (Code Marchand)' }))}
                          className={`rounded-2xl border px-6 py-3 text-sm font-black uppercase tracking-wider transition ${normalizePaymentMethodForDb(String(recetteForm.method)) === 'Orange Money (Code Marchand)'
                            ? 'border-emerald-300 bg-emerald-500 text-slate-950'
                            : 'border-slate-600 bg-slate-800/70 text-slate-200 hover:bg-slate-700/80'
                            }`}
                        >
                          Orange Money
                        </button>
                      </div>
                      <div className="w-full max-w-xl rounded-2xl border-2 border-cyan-300/40 bg-cyan-950/35 p-4 shadow-lg shadow-cyan-500/10">
                        <div className="mb-3 flex items-center justify-between">
                          <p className="text-sm font-black uppercase tracking-[0.2em] text-cyan-100">Mode Assurance</p>
                          <button
                            type="button"
                            onClick={() => setRecetteForm((prev) => ({
                              ...prev,
                              isInsuranceSale: !prev.isInsuranceSale,
                            }))}
                            className={`rounded-xl px-4 py-2 text-xs font-black uppercase tracking-wider transition ${
                              recetteForm.isInsuranceSale
                                ? 'bg-cyan-300 text-slate-950'
                                : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                            }`}
                          >
                            {recetteForm.isInsuranceSale ? 'Activé' : 'Désactivé'}
                          </button>
                        </div>
                        <p className="mb-3 text-xs font-semibold text-cyan-100/90">
                          Activez ce mode pour split automatique Patient / Assurance sans calcul manuel.
                        </p>
                        {recetteForm.isInsuranceSale && (
                          <div className="grid gap-3 md:grid-cols-3">
                            <label className="text-left">
                              <span className="mb-1 block text-xs font-black uppercase tracking-wider text-slate-200">Assureur</span>
                              <select
                                value={recetteForm.insurerName}
                                onChange={(e) => setRecetteForm((prev) => ({ ...prev, insurerName: e.target.value }))}
                                className="h-11 w-full rounded-xl border border-slate-600 bg-slate-900 px-3 text-sm font-semibold text-white outline-none focus:border-cyan-300"
                              >
                                {insurerOptions.map((insurer) => (
                                  <option key={insurer} value={insurer}>{insurer}</option>
                                ))}
                              </select>
                            </label>
                            <label className="text-left">
                              <span className="mb-1 block text-xs font-black uppercase tracking-wider text-slate-200">Taux Prise en Charge</span>
                              <select
                                value={String(recetteForm.coverageRate)}
                                onChange={(e) => setRecetteForm((prev) => ({ ...prev, coverageRate: Number(e.target.value) }))}
                                className="h-11 w-full rounded-xl border border-slate-600 bg-slate-900 px-3 text-sm font-semibold text-white outline-none focus:border-cyan-300"
                              >
                                <option value="70">70%</option>
                                <option value="80">80%</option>
                                <option value="90">90%</option>
                                <option value="100">100%</option>
                              </select>
                            </label>
                            <label className="text-left">
                              <span className="mb-1 block text-xs font-black uppercase tracking-wider text-slate-200">N° de Bon</span>
                              <Input
                                type="text"
                                value={recetteForm.matricule}
                                onChange={(e) => setRecetteForm((prev) => ({ ...prev, matricule: e.target.value }))}
                                placeholder="Ex: CN-84593"
                                className="h-11 rounded-xl border-slate-600 bg-slate-900 text-sm font-semibold text-white placeholder:text-slate-500"
                              />
                            </label>
                          </div>
                        )}
                        {recetteForm.isInsuranceSale && (
                          <div className="mt-3 grid gap-2 text-sm font-bold md:grid-cols-3">
                            <p className="rounded-xl border border-slate-700 bg-slate-900/70 px-3 py-2 text-slate-100">
                              Total: <span className="text-white">{formatAmountGNF(amountValue)} GNF</span>
                            </p>
                            <p className="rounded-xl border border-emerald-400/40 bg-emerald-900/20 px-3 py-2 text-emerald-200">
                              Patient: <span className="text-emerald-100">{formatAmountGNF(patientPart)} GNF</span>
                            </p>
                            <p className="rounded-xl border border-cyan-400/40 bg-cyan-900/20 px-3 py-2 text-cyan-200">
                              Assurance: <span className="text-cyan-100">{formatAmountGNF(insurancePart)} GNF</span>
                            </p>
                          </div>
                        )}
                      </div>
                      <Button
                        type="submit"
                        disabled={!isOnline}
                        className="h-16 w-full max-w-xl rounded-2xl bg-emerald-500 text-lg font-black text-slate-950 hover:bg-emerald-400"
                      >
                        Vérifier la Vente (Entrée)
                      </Button>
                    </form>

                    <p className="mt-6 text-center text-xs uppercase tracking-[0.3em] text-slate-400">
                      Propulsé par <span className="font-semibold text-slate-200">BIZMAP</span>
                    </p>
                  </div>

                  <aside className={`absolute bottom-0 right-0 top-0 z-20 w-full max-w-sm border-l border-slate-700/70 bg-slate-950/95 p-5 transition-transform duration-300 md:w-[360px] ${showHistoryPanel ? 'translate-x-0' : 'translate-x-full'}`}>
                    <div className="mb-4 flex items-center justify-between">
                      <h3 className="text-sm font-black uppercase tracking-widest text-slate-300">10 Dernières Entrées</h3>
                      <button type="button" onClick={() => setShowHistoryPanel(false)} className="rounded-md p-1 text-slate-400 hover:bg-slate-800 hover:text-white">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="space-y-3">
                      {recentEntries.length === 0 ? (
                        <p className="text-sm text-slate-400">Aucune entrée récente.</p>
                      ) : (
                        recentEntries.map((tx) => {
                          const statusLabel = tx.type === 'retour' ? 'Retourné' : 'Validé';
                          return (
                            <div key={tx.id} className="rounded-xl border border-slate-800 bg-slate-900/70 p-3">
                              <div className="flex items-center justify-between gap-3">
                                <p className="text-sm font-bold text-white">{formatAmountGNF(tx.amount)} GNF</p>
                                <span className={`text-[10px] font-black uppercase tracking-widest ${statusLabel === 'Retourné' ? 'text-amber-300' : 'text-emerald-300'}`}>
                                  {statusLabel}
                                </span>
                              </div>
                              <p className="mt-1 text-xs text-slate-400">{new Date(tx.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</p>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </aside>
                  </section>
                ) : (
                  <section className="mt-8 rounded-lg border border-border bg-card p-6">
                    <h2 className="text-lg font-medium text-foreground">Garde</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Démarrez une garde pour ouvrir le terminal caisse.
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

                {showVerificationModal && (
                  <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 p-4"
                    onKeyDown={(event) => {
                      if (isSubmittingRecette) return;
                      if (event.key === 'Escape') {
                        event.preventDefault();
                        setShowVerificationModal(false);
                        window.requestAnimationFrame(() => amountInputRef.current?.focus());
                      }
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        void handleConfirmRecette();
                      }
                    }}
                  >
                    <div className="w-full max-w-3xl rounded-3xl border border-slate-700 bg-slate-900 p-6 text-white shadow-2xl md:p-10">
                      <p className="text-center text-xl font-black uppercase tracking-[0.2em] text-amber-300 md:text-2xl">
                        VÉRIFICATION : {formatAmountGNF(amountValue)} GNF
                      </p>
                      {recetteForm.isInsuranceSale && (
                        <div className="mx-auto mt-5 grid max-w-2xl gap-2 text-sm md:grid-cols-3">
                          <div className="rounded-xl border border-slate-700 bg-slate-800/80 p-3 text-center">
                            <p className="text-[11px] uppercase tracking-widest text-slate-400">Montant Total</p>
                            <p className="mt-1 text-xl font-black text-white">{formatAmountGNF(amountValue)} GNF</p>
                          </div>
                          <div className="rounded-xl border border-emerald-400/40 bg-emerald-900/20 p-3 text-center">
                            <p className="text-[11px] uppercase tracking-widest text-emerald-200">Part à Encaisser (Patient)</p>
                            <p className="mt-1 text-xl font-black text-emerald-100">{formatAmountGNF(patientPart)} GNF</p>
                          </div>
                          <div className="rounded-xl border border-cyan-400/40 bg-cyan-900/20 p-3 text-center">
                            <p className="text-[11px] uppercase tracking-widest text-cyan-200">Part à Réclamer (Assurance)</p>
                            <p className="mt-1 text-xl font-black text-cyan-100">{formatAmountGNF(insurancePart)} GNF</p>
                          </div>
                        </div>
                      )}
                      <p className="mt-3 text-center text-base font-semibold text-slate-300 md:text-lg">
                        Méthode: {normalizePaymentMethodForDb(String(recetteForm.method))}
                        {recetteForm.isInsuranceSale ? ` | Assureur: ${recetteForm.insurerName}` : ''}
                      </p>

                      <div className="mx-auto mt-6 max-w-xl">
                        <label className="mb-2 block text-sm font-bold uppercase tracking-wider text-slate-300">
                          {recetteForm.isInsuranceSale ? 'Montant Reçu Patient (optionnel)' : 'Montant Reçu (optionnel)'}
                        </label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={receivedAmount}
                          onChange={(e) => setReceivedAmount(e.target.value)}
                          className="h-14 rounded-2xl border-slate-700 bg-slate-800 text-xl font-black text-white placeholder:text-slate-500"
                          placeholder="0"
                        />
                        {changeDue !== null && (
                          <p className="mt-4 text-center text-3xl font-black text-emerald-300 md:text-4xl">
                            Monnaie à rendre : {formatAmountGNF(changeDue)} GNF
                          </p>
                        )}
                      </div>

                      <div className="mt-8 grid gap-3 md:grid-cols-2">
                        <Button
                          type="button"
                          onClick={handleConfirmRecette}
                          isLoading={isSubmittingRecette}
                          disabled={!isOnline || isSubmittingRecette}
                          className="h-16 rounded-2xl bg-emerald-500 text-lg font-black text-slate-950 hover:bg-emerald-400"
                        >
                          <Check className="mr-2 h-5 w-5" />
                          CONFIRMER (Entrée)
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            setShowVerificationModal(false);
                            window.requestAnimationFrame(() => amountInputRef.current?.focus());
                          }}
                          disabled={isSubmittingRecette}
                          className="h-16 rounded-2xl border-slate-600 bg-transparent text-lg font-black text-slate-200 hover:bg-slate-800"
                        >
                          <RotateCcw className="mr-2 h-5 w-5" />
                          CORRIGER (Esc)
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {showPreCloseModal && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 p-4">
                    <div className="w-full max-w-2xl rounded-2xl border border-slate-700 bg-slate-900 p-6 text-white shadow-2xl">
                      <div className="mb-5 flex items-center justify-between">
                        <h3 className="text-xl font-black">Pré-Clôture - {cashierName}</h3>
                        <button
                          type="button"
                          onClick={() => setShowPreCloseModal(false)}
                          className="rounded-md p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
                        >
                          <X className="h-5 w-5" />
                        </button>
                      </div>
                      <p className="mb-5 text-sm text-slate-300">
                        Synthèse du caissier courant uniquement pour comparer votre caisse physique avant l&apos;appel Admin.
                      </p>
                      <div className="space-y-3">
                        <div className="rounded-xl border border-slate-700 bg-slate-800/70 p-4">
                          <p className="text-xs uppercase tracking-widest text-slate-400">Total Cash in Drawer</p>
                          <p className="mt-1 text-3xl font-black text-emerald-300">{formatAmountGNF(preCloseCashInDrawer)} GNF</p>
                        </div>
                        <div className="rounded-xl border border-slate-700 bg-slate-800/70 p-4">
                          <p className="text-xs uppercase tracking-widest text-slate-400">Total Orange Money</p>
                          <p className="mt-1 text-3xl font-black text-cyan-300">{formatAmountGNF(preCloseOrangeMoneyTotal)} GNF</p>
                        </div>
                        <div className="rounded-xl border border-slate-700 bg-slate-800/70 p-4">
                          <p className="text-xs uppercase tracking-widest text-slate-400">Total Retours effectués</p>
                          <p className="mt-1 text-3xl font-black text-amber-300">{formatAmountGNF(preCloseReturnsTotal)} GNF</p>
                        </div>
                        <div className="rounded-xl border border-slate-700 bg-slate-800/70 p-4">
                          <p className="text-xs uppercase tracking-widest text-slate-400">Total Shift Duration</p>
                          <p className="mt-1 text-3xl font-black text-amber-200">{shiftElapsed}</p>
                        </div>
                        <p className="text-xs text-slate-400">
                          Recettes Espèces cumulées: <span className="font-bold text-slate-200">{formatAmountGNF(preCloseCashTotal)} GNF</span>
                        </p>
                      </div>
                    </div>
                  </div>
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
                            if (t.type === 'recette') return sum + getPatientCashPart(t);
                            if (t.type === 'dépense' && t.status === 'approved') return sum - t.amount;
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
                      </div>
                      <div className="flex gap-3">
                        <div className="flex-1">
                          <Button type="submit" variant="destructive" disabled={!isOnline} className="w-full">
                            Valider la Clôture
                          </Button>
                        </div>
                        <Button type="button" variant="outline" onClick={() => setShowCloseShiftForm(false)}>
                          Annuler
                        </Button>
                      </div>
                    </form>
                  </section>
                )}
              </>
            ) : (
              <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="text-xl font-black text-slate-900">Espace d&apos;Analyse & Supervision</h2>
                <p className="mt-2 text-sm text-slate-600">
                  Le dashboard reste disponible pour le suivi administratif. Le terminal de vente est maintenant isolé dans une vue dédiée.
                </p>
                <div className="mt-5 flex flex-wrap gap-3">
                  <Button onClick={() => setShowTerminal(true)} className="h-11 rounded-xl bg-slate-900 px-5 font-bold text-white hover:bg-slate-800">
                    Accéder au Terminal de Vente
                  </Button>
                  {!currentShift && (
                    <Button
                      variant="outline"
                      onClick={handleStartShift}
                      disabled={isStarting}
                      isLoading={isStarting}
                      className="h-11 rounded-xl"
                    >
                      <Play className="mr-2 h-4 w-4" aria-hidden />
                      Démarrer la Garde
                    </Button>
                  )}
                </div>
                {currentShift && (
                  <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-emerald-700">
                    Garde active depuis {new Date(currentShift.started_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                )}
              </section>
            )}
          </>
        )
      }
    </div >
  );
}

export default Dashboard;
