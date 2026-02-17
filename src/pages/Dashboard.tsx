import { useEffect, useState, useCallback, useRef } from 'react';
import { useConnection } from '@/context/ConnectionContext';
import { Play, X, Share2, CheckCircle, AlertTriangle, History, Check, RotateCcw, Maximize2, Minimize2, CircleHelp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import AppToast, { type ToastVariant } from '@/components/AppToast';
import StatsGrid from '@/components/StatsGrid';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { useLocation, useNavigate } from 'react-router-dom';
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

type DbPaymentMethod = 'Espèces' | 'Orange Money (Code Marchand)' | 'crédit_dette';

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
  if (value === 'crédit / dette' || value === 'credit / dette' || value === 'crédit_dette' || value === 'credit_debt') {
    return 'crédit_dette';
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

function isCreditMethod(method: string): boolean {
  const normalized = normalizePaymentMethodForDb(method);
  return normalized === 'crédit_dette';
}

function paymentMethodLabel(raw: string): string {
  const normalized = normalizePaymentMethodForDb(raw);
  if (normalized === 'crédit_dette') return 'Crédit / Dette';
  return normalized;
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
    || message.includes('payment_paid_at')
    || message.includes('payment_paid_by')
  );
}

function isMissingShiftBalanceColumnsError(err: unknown): boolean {
  const message = String(
    (err as { message?: string } | null)?.message ||
    (err as { details?: string } | null)?.details ||
    ''
  ).toLowerCase();
  return message.includes('opening_balance') || message.includes('closing_balance');
}

function isSingleActiveShiftConflict(err: unknown): boolean {
  const code = String((err as { code?: string } | null)?.code || '');
  const message = String(
    (err as { message?: string } | null)?.message ||
    (err as { details?: string } | null)?.details ||
    ''
  ).toLowerCase();
  return code === '23505' || message.includes('single_active') || message.includes('active shift');
}

function isMissingRpcFunction(err: unknown): boolean {
  const code = String((err as { code?: string } | null)?.code || '');
  const message = String((err as { message?: string } | null)?.message || '').toLowerCase();
  return code === 'PGRST202' || message.includes('get_active_shift_guardian') || message.includes('could not find the function');
}

type ActiveShiftGuardian = {
  shift_id: string;
  user_id: string;
  started_at: string;
  cashier_name: string;
};

const ENABLE_ACTIVE_SHIFT_RPC = String(import.meta.env.VITE_ENABLE_ACTIVE_SHIFT_RPC || 'false').toLowerCase() === 'true';

function normalizeTransaction(row: Record<string, unknown>): Transaction {
  const rawType = String(row.type || '').toLowerCase();
  const type =
    rawType === 'income' || rawType === 'recette'
      ? 'recette'
      : rawType === 'crédit' || rawType === 'credit'
        ? 'crédit'
      : rawType === 'retour' || rawType === 'refund' || rawType === 'returned'
        ? 'retour'
      : rawType === 'expense' || rawType === 'dépense' || rawType === 'depense'
        ? 'dépense'
        : 'recette';
  const method = row.method
    ? String(row.method)
    : typeof row.payment_method === 'string'
      ? (String(row.payment_method).toLowerCase() === 'crédit_dette' ? 'Crédit / Dette' : fromModernPaymentMethod(row.payment_method))
      : fromModernPaymentMethod(undefined);
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
    customer_name: (row.customer_name as string | null) ?? null,
    customer_phone: (row.customer_phone as string | null) ?? null,
    payment_status: (row.payment_status as string | null) ?? null,
    payment_paid_at: (row.payment_paid_at as string | null) ?? null,
    payment_paid_by: (row.payment_paid_by as string | null) ?? null,
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

function TerminalTimePanel({
  startedAt,
  isOnline,
}: {
  startedAt: string;
  isOnline: boolean;
}) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="text-center">
      <p className="text-[10px] font-black uppercase tracking-[0.35em] text-cyan-200/80">Temps Réel</p>
      <p className="mt-1 text-5xl font-black tracking-[0.14em] text-white md:text-7xl">{formatRealtimeClock(now)}</p>
      <div className="mt-2 flex items-center justify-center gap-2">
        <p className="text-[10px] uppercase tracking-[0.25em] text-slate-300">{formatRealtimeDate(now)}</p>
        <span
          className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${
            isOnline
              ? 'border border-emerald-300/50 bg-emerald-500/20 text-emerald-200'
              : 'border border-amber-300/50 bg-amber-500/20 text-amber-200'
          }`}
        >
          Statut : {isOnline ? 'En ligne' : 'Hors ligne'}
        </span>
      </div>
      <p className="mt-2 text-sm font-black uppercase tracking-[0.2em] text-amber-300">Temps de garde: {formatElapsed(startedAt)}</p>
    </div>
  );
}

const QUICK_AMOUNTS_STORAGE_KEY = 'pharmavault.quick_amounts.v1';
const DEFAULT_QUICK_AMOUNTS = [5000, 10000, 20000, 50000];

function loadQuickAmounts(): number[] {
  if (typeof window === 'undefined') return DEFAULT_QUICK_AMOUNTS;
  try {
    const raw = window.localStorage.getItem(QUICK_AMOUNTS_STORAGE_KEY);
    if (!raw) return DEFAULT_QUICK_AMOUNTS;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return DEFAULT_QUICK_AMOUNTS;
    const clean = parsed
      .map((value) => Number(value))
      .filter((value) => Number.isFinite(value) && value > 0)
      .map((value) => Math.round(value));
    if (clean.length === 0) return DEFAULT_QUICK_AMOUNTS;
    return Array.from(new Set(clean)).slice(0, 8);
  } catch {
    return DEFAULT_QUICK_AMOUNTS;
  }
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
  const location = useLocation();

  const [currentShift, setCurrentShift] = useState<Shift | null>(null);
  const [globalActiveShift, setGlobalActiveShift] = useState<ActiveShiftGuardian | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [showCloseShiftForm, setShowCloseShiftForm] = useState(false);
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [showHistoryPanel, setShowHistoryPanel] = useState(false);
  const [showTerminal, setShowTerminal] = useState(false);
  const [showPreCloseModal, setShowPreCloseModal] = useState(false);
  const [showCloseShiftConfirm, setShowCloseShiftConfirm] = useState(false);
  const [toast, setToast] = useState<{ variant: ToastVariant; title: string; message: string; hint?: string } | null>(null);
  const [receivedAmount, setReceivedAmount] = useState('');
  const [isSubmittingRecette, setIsSubmittingRecette] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pendingApprovalsCount, setPendingApprovalsCount] = useState(0);
  const [quickAmounts, setQuickAmounts] = useState<number[]>(() => loadQuickAmounts());
  const [quickAmountInput, setQuickAmountInput] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(
    typeof document !== 'undefined' ? Boolean(document.fullscreenElement) : false
  );
  const amountInputRef = useRef<HTMLInputElement | null>(null);
  const terminalSectionRef = useRef<HTMLElement | null>(null);
  const hasActiveShiftRpcRef = useRef<boolean | null>(null);

  // Recette form state
  const [recetteForm, setRecetteForm] = useState({
    amount: '',
    method: 'Espèces' as PaymentMethod,
    isInsuranceSale: false,
    insurerName: 'CNAMGS',
    coverageRate: 80,
    matricule: '',
    customerName: '',
    customerPhone: '',
  });

  // Close shift form state
  const [closeShiftForm, setCloseShiftForm] = useState({
    actualCash: '',
  });
  const [closeShiftFieldError, setCloseShiftFieldError] = useState<string | null>(null);

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
  const isCashier = role?.toLowerCase() === 'cashier';
  const roleLabel = isAdmin ? 'administrateur' : isCashier ? 'caissier' : String(role || 'utilisateur');
  const view = new URLSearchParams(location.search).get('view');
  const isTerminalQueryView = view === 'terminal';
  const forcedTerminalView = isCashier;

  useEffect(() => {
    if (isCashier && view !== 'terminal') {
      navigate('/dashboard?view=terminal', { replace: true });
    }
  }, [isCashier, view, navigate]);

  useEffect(() => {
    if (isAdmin && view === 'terminal') {
      navigate('/dashboard', { replace: true });
    }
  }, [isAdmin, view, navigate]);

  useEffect(() => {
    if (!isAdmin) return;

    const loadPendingApprovals = async () => {
      try {
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
      } catch {
        setToast({
          variant: 'warning',
          title: 'Mise à jour admin limitée',
          message: 'Impossible de rafraîchir les approbations en attente.',
        });
      }
    };

    loadPendingApprovals();
  }, [isAdmin]);

  const fetchActiveShift = useCallback(async () => {
    if (!user) return null;
    try {
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
    } catch {
      return null;
    }
  }, [user]);

  const refreshGlobalActiveShift = useCallback(async () => {
    try {
      if (ENABLE_ACTIVE_SHIFT_RPC && hasActiveShiftRpcRef.current !== false) {
        const { data, error: activeError } = await supabase.rpc('get_active_shift_guardian');
        if (!activeError) {
          hasActiveShiftRpcRef.current = true;
          const row = (Array.isArray(data) ? data[0] : data) as ActiveShiftGuardian | null;
          setGlobalActiveShift(row ?? null);
          return row ?? null;
        }
        if (isMissingRpcFunction(activeError)) {
          hasActiveShiftRpcRef.current = false;
        } else {
          setGlobalActiveShift(null);
          return null;
        }
      }

      // Fallback path when RPC is not deployed yet.
      const { data: shiftRows, error: shiftError } = await supabase
        .from('shifts')
        .select('id, user_id, started_at')
        .is('ended_at', null)
        .order('started_at', { ascending: true })
        .limit(1);

      if (shiftError || !shiftRows || shiftRows.length === 0) {
        setGlobalActiveShift(null);
        return null;
      }

      const row = shiftRows[0] as { id: string; user_id: string; started_at: string };
      const fallbackCashierName =
        row.user_id === user?.id
          ? getCashierName({
            email: user?.email ?? null,
            user_metadata: (user?.user_metadata as Record<string, unknown> | null) ?? null,
          })
          : 'Caissier';

      const fallback: ActiveShiftGuardian = {
        shift_id: row.id,
        user_id: row.user_id,
        started_at: row.started_at,
        cashier_name: fallbackCashierName,
      };
      setGlobalActiveShift(fallback);
      return fallback;
    } catch {
      setGlobalActiveShift(null);
      return null;
    }
  }, [user]);

  // Helper to query transactions
  const queryTransactions = async (shiftId: string) => {
    try {
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
    } catch (err) {
      return { data: null, error: err };
    }
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
      const [shift] = await Promise.all([
        fetchActiveShift(),
        refreshGlobalActiveShift(),
      ]);
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
  }, [fetchActiveShift, refreshGlobalActiveShift]);

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
    const syncFullscreenState = () => {
      setIsFullscreen(document.fullscreenElement === terminalSectionRef.current);
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
  }, [showTerminal, closedShiftSummary, currentShift, showVerificationModal, showPreCloseModal, showCloseShiftForm]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(QUICK_AMOUNTS_STORAGE_KEY, JSON.stringify(quickAmounts));
  }, [quickAmounts]);

  const handleStartShift = async () => {
    setError(null);
    setClosedShiftSummary(null); // Clear closed shift summary
    setIsStarting(true);
    if (!user) {
      setError('Session expirée. Veuillez vous reconnecter.');
      setIsStarting(false);
      return;
    }
    try {
      const activeShift = await refreshGlobalActiveShift();
      if (activeShift) {
        const message = 'Une garde est déjà en cours. Veuillez clôturer la garde actuelle avant d\'en démarrer une nouvelle.';
        setError(message);
        setToast({
          variant: 'warning',
          title: 'Garde deja active',
          message,
          hint: `Garde en cours par : ${activeShift.cashier_name || 'Caissier'}.`,
        });
        setIsStarting(false);
        return;
      }

      const openingPayload = {
        user_id: user.id,
        started_at: new Date().toISOString(),
        opening_balance: 0,
        expected_cash: 0,
      };
      let { error: insertError } = await supabase.from('shifts').insert(openingPayload);
      if (insertError && isMissingShiftBalanceColumnsError(insertError)) {
        const retry = await supabase.from('shifts').insert({
          user_id: user.id,
          started_at: new Date().toISOString(),
          expected_cash: 0,
        });
        insertError = retry.error;
      }
      if (insertError) {
        if (isSingleActiveShiftConflict(insertError)) {
          const message = 'Une garde est déjà en cours. Veuillez clôturer la garde actuelle avant d\'en démarrer une nouvelle.';
          const currentActiveShift = await refreshGlobalActiveShift();
          setError(message);
          setToast({
            variant: 'warning',
            title: 'Garde deja active',
            message,
            hint: currentActiveShift ? `Garde en cours par : ${currentActiveShift.cashier_name || 'Caissier'}.` : undefined,
          });
          setIsStarting(false);
          return;
        }
        setError(formatSupabaseError(insertError, 'Impossible de démarrer la garde.'));
        setToast({
          variant: 'error',
          title: 'Echec ouverture caisse',
          message: 'Impossible de démarrer la garde.',
          hint: 'Vérifiez le réseau puis réessayez.',
        });
        setIsStarting(false);
        return;
      }

      const shift = await fetchActiveShift();
      setCurrentShift(shift);
      await refreshGlobalActiveShift();
      setToast({
        variant: 'success',
        title: 'Garde ouverte',
        message: 'La caisse est active et prête pour les ventes.',
        hint: 'Saisissez un montant puis Ctrl+Entrée.',
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors du démarrage de garde.');
      setToast({
        variant: 'error',
        title: 'Echec ouverture caisse',
        message: 'Erreur réseau pendant l’ouverture de garde.',
      });
    } finally {
      setIsStarting(false);
    }
  };

  const saveRecette = async () => {
    setError(null);
    setIsSubmittingRecette(true);

    if (!isOnline) {
      setToast({
        variant: 'warning',
        title: 'Connexion requise',
        message: 'Impossible de valider une vente hors connexion.',
        hint: 'Attendez la reconnexion serveur.',
      });
      setIsSubmittingRecette(false);
      return;
    }

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
    const isCreditSale = isCreditMethod(String(recetteForm.method));
    if (isCreditSale && !recetteForm.customerName.trim()) {
      setError('Le nom du client est obligatoire pour une vente à crédit.');
      setIsSubmittingRecette(false);
      return;
    }
    const isInsuranceSale = !isCreditSale && recetteForm.isInsuranceSale;
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
      description: isCreditSale
        ? `Crédit Client - ${recetteForm.customerName}${recetteForm.customerPhone ? ` | Tel: ${recetteForm.customerPhone}` : ''}`
        : isInsuranceSale
        ? `Recette Assurance - ${recetteForm.insurerName} | Matricule: ${recetteForm.matricule} | Part Patient: ${formatAmountGNF(patientPart)} | Part Assurance: ${formatAmountGNF(insurancePart)}`
        : 'Recette',
      type: isCreditSale ? 'Crédit' : 'Recette',
      category: isCreditSale ? 'Crédit Client' : 'Vente',
      payment_method: paymentMethod,
      status: 'approved',
      payment_status: isCreditSale ? 'Dette Totale' : null,
      insurance_name: isInsuranceSale ? recetteForm.insurerName : null,
      insurance_card_id: isInsuranceSale ? recetteForm.matricule : null,
      insurance_percentage: isInsuranceSale ? coverageRate : null,
      amount_covered_by_insurance: isInsuranceSale ? insurancePart : null,
      customer_name: isCreditSale ? recetteForm.customerName : null,
      customer_phone: isCreditSale ? recetteForm.customerPhone || null : null,
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
        description: isCreditSale
          ? `Crédit Client - ${recetteForm.customerName}${recetteForm.customerPhone ? ` | Tel: ${recetteForm.customerPhone}` : ''}`
          : isInsuranceSale
          ? `Recette Assurance - ${recetteForm.insurerName} | Matricule: ${recetteForm.matricule}`
          : 'Recette',
        type: isCreditSale ? 'Crédit' : 'Recette',
        category: isCreditSale ? 'Crédit Client' : 'Vente',
        payment_method: paymentMethod,
        status: 'approved',
        payment_status: isCreditSale ? 'Dette Totale' : null,
        insurance_name: isInsuranceSale ? recetteForm.insurerName : null,
        insurance_card_id: isInsuranceSale ? recetteForm.matricule : null,
        insurance_percentage: isInsuranceSale ? coverageRate : null,
        amount_covered_by_insurance: isInsuranceSale ? insurancePart : null,
        customer_name: isCreditSale ? recetteForm.customerName : null,
        customer_phone: isCreditSale ? recetteForm.customerPhone || null : null,
        created_by: writer.id,
        is_approved: true,
      };
      const retryMinimal = await supabase.from('transactions').insert(payloadMinimal);
      insertError = retryMinimal.error;
    }

    if (insertError) {
      if (isCreditSale && isMissingCreditSchemaError(insertError)) {
        setError('Migration crédit manquante: appliquez la migration SQL des colonnes de dette client.');
        setToast({
          variant: 'error',
          title: 'Schema credit incomplet',
          message: 'Les colonnes de dette client ne sont pas encore disponibles.',
          hint: 'Exécutez la migration Supabase puis rechargez.',
        });
        setIsSubmittingRecette(false);
        return;
      }
      setError(formatSupabaseError(insertError, 'Erreur lors de l\'enregistrement.'));
      setToast({
        variant: 'error',
        title: 'Echec enregistrement',
        message: 'La vente n’a pas pu être enregistrée.',
        hint: 'Contrôlez la connexion puis validez à nouveau.',
      });
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
      customerName: '',
      customerPhone: '',
    });
    setReceivedAmount('');
    setShowVerificationModal(false);
    await refreshTransactions();
    setIsSubmittingRecette(false);
    setToast({
      variant: 'success',
      title: 'Transaction enregistree',
      message: 'Vente ajoutée au journal.',
      hint: 'Passez immédiatement à la vente suivante.',
    });
    playSuccessTone();
    window.requestAnimationFrame(() => amountInputRef.current?.focus());
  };

  const openVerificationModal = useCallback(() => {
    setError(null);
    const amount = parseFloat(recetteForm.amount);
    if (!recetteForm.amount || Number.isNaN(amount) || amount <= 0) {
      setError('Montant invalide.');
      return false;
    }
    if (isCreditMethod(String(recetteForm.method))) {
      if (!recetteForm.customerName.trim()) {
        setError('Le nom du client est obligatoire pour une vente à crédit.');
        return false;
      }
      setReceivedAmount('');
      setShowVerificationModal(true);
      return true;
    }
    if (recetteForm.isInsuranceSale) {
      if (!recetteForm.insurerName.trim()) {
        setError('Veuillez sélectionner un assureur.');
        return false;
      }
      if (!recetteForm.matricule.trim()) {
        setError('Veuillez renseigner le Numéro Matricule / Bon.');
        return false;
      }
      const coverageRate = Number(recetteForm.coverageRate);
      if (Number.isNaN(coverageRate) || coverageRate < 0 || coverageRate > 100) {
        setError('Le taux de prise en charge doit être entre 0% et 100%.');
        return false;
      }
    }
    setReceivedAmount('');
    setShowVerificationModal(true);
    return true;
  }, [recetteForm.amount, recetteForm.method, recetteForm.isInsuranceSale, recetteForm.insurerName, recetteForm.matricule, recetteForm.coverageRate, recetteForm.customerName]);

  const handleAddRecette = (e: React.FormEvent) => {
    e.preventDefault();
    openVerificationModal();
  };

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        const target = terminalSectionRef.current || document.documentElement;
        await target.requestFullscreen();
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

  const handleApplyQuickAmount = (amount: number) => {
    setRecetteForm((prev) => ({ ...prev, amount: String(amount) }));
    window.requestAnimationFrame(() => amountInputRef.current?.focus());
  };

  const handleAddQuickAmount = () => {
    const value = Number.parseFloat(quickAmountInput);
    if (!Number.isFinite(value) || value <= 0) {
      setError('Montant rapide invalide.');
      setToast({
        variant: 'warning',
        title: 'Montant rapide invalide',
        message: 'Utilisez un nombre positif.',
      });
      return;
    }
    const normalized = Math.round(value);
    setQuickAmounts((prev) => {
      const next = Array.from(new Set([...prev, normalized])).sort((a, b) => a - b);
      return next.slice(0, 8);
    });
    setQuickAmountInput('');
  };

  const handleRemoveQuickAmount = (amount: number) => {
    setQuickAmounts((prev) => {
      const next = prev.filter((value) => value !== amount);
      return next.length > 0 ? next : DEFAULT_QUICK_AMOUNTS;
    });
  };

  const executeCloseShift = async () => {
    setError(null);
    setCloseShiftFieldError(null);
    setShowCloseShiftConfirm(false);

    if (!currentShift) {
      setError('Aucune garde active.');
      return;
    }
    if (!user?.id) {
      setError('Session utilisateur invalide. Veuillez vous reconnecter.');
      return;
    }

    if (!closeShiftForm.actualCash || isNaN(parseFloat(closeShiftForm.actualCash))) {
      setCloseShiftFieldError('Indiquez un montant compté valide pour clôturer la garde.');
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

    try {
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

      const closePayload = {
        ended_at: new Date().toISOString(),
        expected_cash: Number(expectedCash),
        actual_cash: Number(actualCashAmount),
        cash_difference: Number(cashDifference),
        closing_balance: Number(actualCashAmount),
        closed_reason: 'normal',
        closed_by: closedById,
      };
      let { error: updateError } = await supabase
        .from('shifts')
        .update(closePayload)
        .eq('id', currentShift.id);

      if (updateError && isMissingShiftBalanceColumnsError(updateError)) {
        const retry = await supabase
          .from('shifts')
          .update({
            ended_at: new Date().toISOString(),
            expected_cash: Number(expectedCash),
            actual_cash: Number(actualCashAmount),
            cash_difference: Number(cashDifference),
            closed_by: closedById,
          })
          .eq('id', currentShift.id);
        updateError = retry.error;
      }

      if (updateError) {
        setError(formatSupabaseError(updateError, 'Erreur lors de la clôture.'));
        setToast({
          variant: 'error',
          title: 'Cloture echouee',
          message: 'La garde n’a pas pu être clôturée.',
          hint: 'Vérifiez le tiroir et la connexion.',
        });
        return;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur réseau pendant la clôture.');
      setToast({
        variant: 'error',
        title: 'Cloture echouee',
        message: 'Erreur réseau pendant la clôture.',
      });
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
    setCurrentShift(null);
    await refreshGlobalActiveShift();

    setShowCloseShiftForm(false);
    setCloseShiftForm({ actualCash: '' });
    setShowCloseShiftConfirm(false);
    setToast({
      variant: 'success',
      title: 'Garde cloturee',
      message: 'Clôture enregistrée avec succès.',
      hint: 'Partagez le rapport propriétaire.',
    });
  };

  const handleForceCloseActiveShift = async () => {
    if (!isAdmin || !user?.id || !globalActiveShift) return;
    if (!window.confirm(`Forcer la clôture de la garde de ${globalActiveShift.cashier_name || 'ce caissier'} ?`)) return;

    setError(null);
    const forcedPayload = {
      ended_at: new Date().toISOString(),
      closed_by: user.id,
      closed_reason: 'forced_by_admin',
    };

    let { error: forceError } = await supabase
      .from('shifts')
      .update(forcedPayload)
      .eq('id', globalActiveShift.shift_id)
      .is('ended_at', null);

    if (forceError && isMissingShiftBalanceColumnsError(forceError)) {
      const retry = await supabase
        .from('shifts')
        .update({
          ended_at: new Date().toISOString(),
          closed_by: user.id,
        })
        .eq('id', globalActiveShift.shift_id)
        .is('ended_at', null);
      forceError = retry.error;
    }

    if (forceError) {
      setError(formatSupabaseError(forceError, 'Impossible de forcer la clôture.'));
      setToast({
        variant: 'error',
        title: 'Force close echoue',
        message: 'La garde active n’a pas pu être clôturée.',
      });
      return;
    }

    if (currentShift && currentShift.id === globalActiveShift.shift_id) {
      setCurrentShift(null);
    }
    await refreshGlobalActiveShift();
    setToast({
      variant: 'success',
      title: 'Force close admin',
      message: `Garde de ${globalActiveShift.cashier_name || 'ce caissier'} clôturée par administrateur.`,
      hint: 'Motif: Forced by Admin',
    });
  };

  const handleCloseShift = (e: React.FormEvent) => {
    e.preventDefault();
    setCloseShiftFieldError(null);
    const value = Number.parseFloat(closeShiftForm.actualCash || '');
    if (!Number.isFinite(value) || value < 0) {
      setCloseShiftFieldError('Le montant du tiroir doit être un nombre positif.');
      return;
    }
    setShowCloseShiftConfirm(true);
  };

  const cashierName = getCashierName({
    email: user?.email ?? null,
    user_metadata: (user?.user_metadata as Record<string, unknown> | null) ?? null,
  });
  const amountValue = Number.parseFloat(recetteForm.amount || '0');
  const isCreditSale = isCreditMethod(String(recetteForm.method));
  const insuranceCoverageRate = Number(recetteForm.coverageRate || 0);
  const insurancePart = recetteForm.isInsuranceSale && !isCreditSale ? Number((amountValue * (insuranceCoverageRate / 100)).toFixed(2)) : 0;
  const patientPart = recetteForm.isInsuranceSale && !isCreditSale ? Math.max(0, Number((amountValue - insurancePart).toFixed(2))) : amountValue;
  const amountToCollect = isCreditSale ? 0 : (recetteForm.isInsuranceSale ? patientPart : amountValue);
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
  const insurerOptions = ['CNAMGS', 'NSIA', 'LANALA', 'SAHAM', 'Activa', 'Autre'];
  const isTerminalMode = (showTerminal || forcedTerminalView || isTerminalQueryView) && !closedShiftSummary;
  const isCashierFocusedTerminal = isCashier && isTerminalMode;
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const todayStartMs = startOfToday.getTime();
  const isToday = (isoDate: string) => new Date(isoDate).getTime() >= todayStartMs;
  const todaysTransactionsCount = transactions.filter((tx) => isToday(tx.created_at)).length;
  const todayReturnsCount = transactions.filter((tx) => isToday(tx.created_at) && tx.type === 'retour').length;
  const highValuePendingExpensesCount = transactions.filter(
    (tx) => isToday(tx.created_at) && tx.type === 'dépense' && tx.status === 'pending' && Number(tx.amount || 0) >= 500000
  ).length;
  const todayRiskSignalsCount = todayReturnsCount + highValuePendingExpensesCount;
  const hasAnotherActiveGuard = Boolean(globalActiveShift && (!currentShift || globalActiveShift.shift_id !== currentShift.id));
  const activeGuardCashierName = globalActiveShift?.cashier_name || 'Caissier';
  const canStartShift = !isStarting && !currentShift && !hasAnotherActiveGuard;

  useEffect(() => {
    if (!isTerminalMode || !currentShift || showPreCloseModal || showCloseShiftForm) return;
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isInputTarget = target
        ? target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable
        : false;

      if (event.altKey && event.key === '1') {
        event.preventDefault();
        setRecetteForm((prev) => ({ ...prev, method: 'Espèces' }));
        return;
      }

      if (event.altKey && event.key === '2') {
        event.preventDefault();
        setRecetteForm((prev) => ({ ...prev, method: 'Orange Money (Code Marchand)' }));
        return;
      }

      if (event.altKey && event.key === '3') {
        event.preventDefault();
        setRecetteForm((prev) => ({ ...prev, method: 'Crédit / Dette', isInsuranceSale: false }));
        return;
      }

      if (event.key === '/' && !event.ctrlKey && !event.metaKey && !event.altKey && !showVerificationModal) {
        event.preventDefault();
        amountInputRef.current?.focus();
        return;
      }

      if (event.ctrlKey && event.key === 'Enter' && !showVerificationModal) {
        event.preventDefault();
        openVerificationModal();
        return;
      }

      if (!showVerificationModal && !isInputTarget && /^[1-8]$/.test(event.key)) {
        const index = Number(event.key) - 1;
        if (quickAmounts[index] != null) {
          event.preventDefault();
          handleApplyQuickAmount(quickAmounts[index]);
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isTerminalMode, currentShift, showPreCloseModal, showCloseShiftForm, showVerificationModal, quickAmounts, recetteForm.amount, recetteForm.method, recetteForm.isInsuranceSale, recetteForm.insurerName, recetteForm.matricule, recetteForm.coverageRate, recetteForm.customerName, recetteForm.customerPhone, openVerificationModal]);

  return (
    <div className={isCashierFocusedTerminal ? 'space-y-0' : 'p-6 lg:p-8 space-y-6'}>
      {!isCashierFocusedTerminal && (
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
            Session {roleLabel}: <span className="font-bold text-slate-900">{user?.email?.split('@')[0]}</span>
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          {isAdmin ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 shadow-sm">
              <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-emerald-700">
                Mode Actuel: {isTerminalMode ? 'Terminal' : 'Admin'}
              </p>
              <div className="inline-flex h-11 items-center rounded-xl border border-emerald-300 bg-white p-1">
                <button
                  type="button"
                  onClick={() => {
                    if (isTerminalQueryView) {
                      navigate('/dashboard', { replace: true });
                    }
                    setShowTerminal(false);
                  }}
                  className={`rounded-lg px-4 text-xs font-black uppercase tracking-wider transition ${
                    !isTerminalMode
                      ? 'bg-emerald-600 text-white'
                      : 'text-slate-700 hover:bg-emerald-100'
                  }`}
                >
                  Vue Admin
                </button>
                <button
                  type="button"
                  onClick={() => {
                    navigate('/dashboard?view=terminal', { replace: true });
                    setShowTerminal(true);
                  }}
                  className={`rounded-lg px-4 text-xs font-black uppercase tracking-wider transition ${
                    isTerminalMode
                      ? 'bg-emerald-600 text-white'
                      : 'text-slate-700 hover:bg-emerald-100'
                  }`}
                >
                  Vue Terminal
                </button>
              </div>
            </div>
          ) : isTerminalMode ? (
            <Button
              onClick={() => {
                if (forcedTerminalView) return;
                if (isTerminalQueryView) {
                  navigate('/dashboard', { replace: true });
                }
                setShowTerminal(false);
              }}
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
              disabled={!canStartShift}
              className="gap-2 h-11 rounded-xl pharmacy-gradient text-white font-bold shadow-lg shadow-emerald-500/25 px-6 border-0"
            >
              <Play className="h-4 w-4" />
              Ouvrir la Caisse
            </Button>
          )}
          {isAdmin && hasAnotherActiveGuard && (
            <Button
              variant="destructive"
              onClick={() => void handleForceCloseActiveShift()}
              className="h-11 rounded-xl px-5 text-xs font-black uppercase tracking-wider"
            >
              Forcer la Clôture (Admin)
            </Button>
          )}
        </div>
        {hasAnotherActiveGuard && (
          <p className="mt-2 text-xs font-black uppercase tracking-wider text-amber-700">
            Garde en cours par : {activeGuardCashierName}
          </p>
        )}
        </header>
      )}

      {error && (
        <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-100 flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
          <AlertTriangle className="h-5 w-5 text-rose-500" />
          <p className="text-xs font-bold text-rose-600 uppercase tracking-widest">{error}</p>
        </div>
      )}

      <AppToast
        open={Boolean(toast)}
        variant={toast?.variant || 'success'}
        title={toast?.title || ''}
        message={toast?.message || ''}
        hint={toast?.hint}
        onClose={() => setToast(null)}
      />

      {!isTerminalMode && (
        <section className={`rounded-2xl border p-4 shadow-sm ${
          globalActiveShift
            ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
            : 'border-slate-200 bg-white text-slate-700'
        }`}>
          <p className="text-sm font-black uppercase tracking-[0.1em]">
            {globalActiveShift ? `🟢 Garde Active : ${activeGuardCashierName}` : '⚪ Aucune Garde en cours'}
          </p>
        </section>
      )}

      {!isTerminalMode && <StatsGrid />}
      {!isTerminalMode && (
        <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-700">Formule de Contrôle Caisse</p>
            <span
              title="Formule de rapprochement utilisée pour comparer le théorique et le physique à la clôture."
              className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-emerald-300 bg-white text-emerald-700"
            >
              <CircleHelp className="h-3.5 w-3.5" />
            </span>
          </div>
          <p className="mt-2 text-sm font-black text-emerald-900">
            Espèces Finales = (Fond de Caisse + Recettes Cash) - Dépenses
          </p>
        </section>
      )}

      {!isTerminalMode && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-black uppercase tracking-[0.1em] text-slate-900">Rules of Engagement - Gestion du Cash (Petite Caisse)</h2>
          <ul className="mt-3 space-y-2 text-sm leading-7 text-slate-700">
            <li><span className="font-black">Rule 1:</span> Aucun montant ne sort du tiroir sans un Engagement de Dépense enregistré.</li>
            <li><span className="font-black">Rule 2:</span> Tout transfert Orange Money doit inclure l&apos;ID de transaction pour le rapprochement.</li>
          </ul>
        </section>
      )}

      {!isTerminalMode && isAdmin && (
        <section className="grid gap-4 md:grid-cols-3">
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Volume Aujourd&apos;hui</p>
            <p className="mt-2 text-3xl font-black text-slate-900">{todaysTransactionsCount}</p>
            <p className="mt-1 text-xs text-slate-500">Transactions enregistrées depuis minuit.</p>
          </article>
          <article className="rounded-2xl border border-rose-200 bg-rose-50 p-5 shadow-sm">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-rose-600">Approbations En Attente</p>
            <p className="mt-2 text-3xl font-black text-rose-700">{pendingApprovalsCount}</p>
            <Button
              variant="outline"
              onClick={() => navigate('/dashboard/depenses')}
              className="mt-3 h-9 rounded-xl border-rose-300 bg-white text-xs font-bold text-rose-700 hover:bg-rose-100"
            >
              Ouvrir la file d&apos;approbation
            </Button>
          </article>
          <article className="rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-700">Signaux de Risque (Jour)</p>
            <p className="mt-2 text-3xl font-black text-amber-800">{todayRiskSignalsCount}</p>
            <p className="mt-1 text-xs text-amber-700">
              {todayReturnsCount} retours + {highValuePendingExpensesCount} dépenses élevées en attente.
            </p>
          </article>
        </section>
      )}

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
                  <section ref={terminalSectionRef} className={`relative overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 text-white ${isCashierFocusedTerminal ? 'min-h-screen border-0 rounded-none shadow-none' : 'min-h-[74vh] rounded-3xl border border-slate-200 shadow-2xl'}`}>
                  <div className="pointer-events-none absolute -left-20 -top-20 h-72 w-72 rounded-full bg-emerald-500/20 blur-3xl" />
                  <div className="pointer-events-none absolute -right-10 top-1/4 h-72 w-72 rounded-full bg-cyan-500/10 blur-3xl" />

                  <div className="relative flex min-h-[74vh] flex-col p-5 md:p-8">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h2 className="text-2xl font-black tracking-tight md:text-3xl">Pharmacie Djoma</h2>
                        <p className="mt-1 text-sm text-slate-100">Caissier: <span className="font-black text-white">{cashierName}</span></p>
                      </div>
                      <TerminalTimePanel startedAt={currentShift.started_at} isOnline={isOnline} />
                      <div className="flex flex-wrap gap-2">
                        {isAdmin && (
                          <div className="inline-flex h-11 items-center rounded-xl border border-emerald-300/40 bg-emerald-900/20 p-1">
                            <button
                              type="button"
                              onClick={() => {
                                navigate('/dashboard', { replace: true });
                                setShowTerminal(false);
                              }}
                              className={`rounded-lg px-3 text-[10px] font-black uppercase tracking-wider transition ${
                                !isTerminalMode
                                  ? 'bg-emerald-500 text-slate-950'
                                  : 'text-emerald-100 hover:bg-emerald-800/40'
                              }`}
                            >
                              Vue Admin
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                navigate('/dashboard?view=terminal', { replace: true });
                                setShowTerminal(true);
                              }}
                              className={`rounded-lg px-3 text-[10px] font-black uppercase tracking-wider transition ${
                                isTerminalMode
                                  ? 'bg-emerald-500 text-slate-950'
                                  : 'text-emerald-100 hover:bg-emerald-800/40'
                              }`}
                            >
                              Vue Terminal
                            </button>
                          </div>
                        )}
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

                    <form onSubmit={handleAddRecette} className="mx-auto mt-8 flex w-full max-w-3xl flex-1 flex-col items-center justify-center gap-6 pb-32 md:mt-12 md:pb-0">
                      <Input
                        ref={amountInputRef}
                        type="number"
                        inputMode="decimal"
                        step="0.01"
                        min="0"
                        required
                        placeholder="0"
                        value={recetteForm.amount}
                        onChange={(e) => setRecetteForm((prev) => ({ ...prev, amount: e.target.value }))}
                        className="h-24 w-full rounded-3xl border-2 border-emerald-300/70 bg-white/95 text-center text-4xl font-black text-slate-900 shadow-2xl placeholder:text-slate-300 focus-visible:border-emerald-500 focus-visible:ring-emerald-500/40 md:h-28 md:text-6xl"
                      />
                      <div className="w-full max-w-3xl rounded-2xl border border-slate-700 bg-slate-900/60 p-3">
                        <div className="flex flex-wrap items-center gap-2">
                          {quickAmounts.map((quickAmount, index) => (
                            <div key={quickAmount} className="group inline-flex items-center">
                              <button
                                type="button"
                                onClick={() => handleApplyQuickAmount(quickAmount)}
                                className="rounded-l-xl border border-emerald-300/40 bg-emerald-500/15 px-3 py-2.5 text-xs font-black uppercase tracking-wider text-emerald-100 hover:bg-emerald-500/25"
                                title={`Raccourci clavier: ${index + 1}`}
                              >
                                {index + 1}. {formatAmountGNF(quickAmount)}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRemoveQuickAmount(quickAmount)}
                                className="rounded-r-xl border border-l-0 border-emerald-300/40 bg-slate-900/70 px-2 py-2 text-[10px] font-black text-slate-300 hover:bg-rose-900/40 hover:text-rose-100"
                                title="Supprimer ce montant rapide"
                              >
                                X
                              </button>
                            </div>
                          ))}
                          <div className="ml-auto flex items-center gap-2">
                            <Input
                                type="number"
                                inputMode="numeric"
                                min="1"
                                step="1"
                                value={quickAmountInput}
                                onChange={(e) => setQuickAmountInput(e.target.value)}
                                placeholder="Ajouter montant"
                                className="h-10 w-36 rounded-xl border-slate-600 bg-slate-950 text-xs font-bold text-white placeholder:text-slate-500"
                              />
                              <Button
                                type="button"
                                onClick={handleAddQuickAmount}
                                variant="outline"
                                className="h-10 rounded-xl border-slate-600 bg-slate-900 text-xs font-black text-slate-100 hover:bg-slate-800"
                              >
                                Ajouter
                              </Button>
                            </div>
                          </div>
                      </div>
                      <div className="flex w-full max-w-xl flex-wrap items-center justify-center gap-3">
                        <button
                          type="button"
                          onClick={() => setRecetteForm((prev) => ({ ...prev, method: 'Espèces' }))}
                          className={`min-h-12 flex-1 rounded-2xl border px-6 py-3 text-sm font-black uppercase tracking-wider transition sm:flex-none ${normalizePaymentMethodForDb(String(recetteForm.method)) === 'Espèces'
                            ? 'border-emerald-300 bg-emerald-500 text-slate-950'
                            : 'border-slate-600 bg-slate-800/70 text-slate-200 hover:bg-slate-700/80'
                            }`}
                        >
                          Espèces
                        </button>
                        <button
                          type="button"
                          onClick={() => setRecetteForm((prev) => ({ ...prev, method: 'Orange Money (Code Marchand)' }))}
                          className={`min-h-12 flex-1 rounded-2xl border px-6 py-3 text-sm font-black uppercase tracking-wider transition sm:flex-none ${normalizePaymentMethodForDb(String(recetteForm.method)) === 'Orange Money (Code Marchand)'
                            ? 'border-emerald-300 bg-emerald-500 text-slate-950'
                            : 'border-slate-600 bg-slate-800/70 text-slate-200 hover:bg-slate-700/80'
                            }`}
                        >
                          Orange Money
                        </button>
                        <button
                          type="button"
                          onClick={() => setRecetteForm((prev) => ({ ...prev, method: 'Crédit / Dette', isInsuranceSale: false }))}
                          className={`min-h-12 flex-1 rounded-2xl border px-6 py-3 text-sm font-black uppercase tracking-wider transition sm:flex-none ${normalizePaymentMethodForDb(String(recetteForm.method)) === 'crédit_dette'
                            ? 'border-emerald-300 bg-emerald-500 text-slate-950'
                            : 'border-slate-600 bg-slate-800/70 text-slate-200 hover:bg-slate-700/80'
                            }`}
                        >
                          Crédit / Dette
                        </button>
                      </div>
                      {isCreditSale && (
                        <div className="w-full max-w-xl rounded-2xl border border-amber-300/40 bg-amber-950/30 p-4">
                          <div className="grid gap-3 md:grid-cols-2">
                            <label className="text-left">
                              <span className="mb-1 block text-xs font-black uppercase tracking-wider text-amber-100">Nom du Client *</span>
                              <Input
                                type="text"
                                required
                                value={recetteForm.customerName}
                                onChange={(e) => setRecetteForm((prev) => ({ ...prev, customerName: e.target.value }))}
                                placeholder="Ex: Mamadou Diallo"
                                className="h-11 rounded-xl border-amber-300/30 bg-slate-900 text-sm font-semibold text-white placeholder:text-slate-500"
                              />
                            </label>
                            <label className="text-left">
                              <span className="mb-1 block text-xs font-black uppercase tracking-wider text-amber-100">Téléphone</span>
                              <Input
                                type="tel"
                                inputMode="tel"
                                value={recetteForm.customerPhone}
                                onChange={(e) => setRecetteForm((prev) => ({ ...prev, customerPhone: e.target.value }))}
                                placeholder="Ex: +2246..."
                                className="h-11 rounded-xl border-amber-300/30 bg-slate-900 text-sm font-semibold text-white placeholder:text-slate-500"
                              />
                            </label>
                          </div>
                          <p className="mt-2 text-xs font-semibold text-amber-100/90">
                            Vente enregistrée en dette client jusqu&apos;à encaissement.
                          </p>
                        </div>
                      )}
                      <div className="w-full max-w-3xl rounded-2xl border border-cyan-300/30 bg-cyan-950/20 p-3">
                        <p className="text-[11px] font-black uppercase tracking-[0.18em] text-cyan-100">Raccourcis Terminal</p>
                        <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-bold text-cyan-50">
                          <span className="rounded-lg border border-cyan-300/30 bg-cyan-900/40 px-2 py-1">/ Cibler montant</span>
                          <span className="rounded-lg border border-cyan-300/30 bg-cyan-900/40 px-2 py-1">Alt+1 Espèces</span>
                          <span className="rounded-lg border border-cyan-300/30 bg-cyan-900/40 px-2 py-1">Alt+2 Orange Money</span>
                          <span className="rounded-lg border border-cyan-300/30 bg-cyan-900/40 px-2 py-1">Alt+3 Crédit / Dette</span>
                          <span className="rounded-lg border border-cyan-300/30 bg-cyan-900/40 px-2 py-1">Ctrl+Entrée Vérifier</span>
                          <span className="rounded-lg border border-cyan-300/30 bg-cyan-900/40 px-2 py-1">Entrée valider (dans la fenêtre)</span>
                        </div>
                      </div>
                      {!isCreditSale && (
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
                              Part Patient: <span className="text-emerald-100">{formatAmountGNF(patientPart)} GNF</span>
                            </p>
                            <p className="rounded-xl border border-cyan-400/40 bg-cyan-900/20 px-3 py-2 text-cyan-200">
                              Part Assurance: <span className="text-cyan-100">{formatAmountGNF(insurancePart)} GNF</span>
                            </p>
                          </div>
                        )}
                        </div>
                      )}
                      <Button
                        type="submit"
                        disabled={!isOnline}
                        className="hidden h-16 w-full max-w-xl rounded-2xl bg-emerald-500 text-lg font-black text-slate-950 hover:bg-emerald-400 md:inline-flex"
                      >
                        {isCreditSale ? 'Vérifier la Dette Client' : 'Vérifier la Vente (Entrée)'}
                      </Button>

                      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-emerald-300/30 bg-slate-950/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-md md:hidden">
                        <div className="mx-auto flex w-full max-w-xl items-center justify-between rounded-xl border border-slate-700 bg-slate-900/80 px-3 py-2">
                          <p className="text-[10px] font-black uppercase tracking-wider text-slate-300">{isCreditSale ? 'Dette Totale' : 'A encaisser'}</p>
                          <p className="text-lg font-black text-emerald-300">{formatAmountGNF(isCreditSale ? amountValue : amountToCollect)} GNF</p>
                        </div>
                        <Button
                          type="submit"
                          disabled={!isOnline}
                          className="mt-2 h-14 w-full rounded-xl bg-emerald-500 text-base font-black text-slate-950 hover:bg-emerald-400"
                        >
                          {isCreditSale ? 'Vérifier la Dette' : 'Vérifier la Vente'}
                        </Button>
                      </div>
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
                      disabled={!canStartShift}
                      isLoading={isStarting}
                    >
                      <Play className="mr-2 h-4 w-4" aria-hidden />
                      Démarrer la Garde
                    </Button>
                    {isAdmin && hasAnotherActiveGuard && (
                      <Button
                        variant="destructive"
                        className="mt-3"
                        onClick={() => void handleForceCloseActiveShift()}
                      >
                        Forcer la Clôture (Admin)
                      </Button>
                    )}
                    {hasAnotherActiveGuard && (
                      <p className="mt-3 text-xs font-black uppercase tracking-wider text-amber-700">
                        Garde en cours par : {activeGuardCashierName}
                      </p>
                    )}
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
                        Méthode: {paymentMethodLabel(String(recetteForm.method))}
                        {recetteForm.isInsuranceSale ? ` | Assureur: ${recetteForm.insurerName}` : ''}
                        {isCreditSale ? ` | Client: ${recetteForm.customerName}` : ''}
                      </p>

                      {!isCreditSale ? (
                        <div className="mx-auto mt-6 max-w-xl">
                          <label className="mb-2 block text-sm font-bold uppercase tracking-wider text-slate-300">
                            {recetteForm.isInsuranceSale ? 'Montant Reçu Patient (optionnel)' : 'Montant Reçu (optionnel)'}
                          </label>
                          <Input
                            type="number"
                            inputMode="decimal"
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
                      ) : (
                        <div className="mx-auto mt-6 max-w-xl rounded-2xl border border-amber-300/40 bg-amber-900/20 p-4 text-center">
                          <p className="text-sm font-black uppercase tracking-wider text-amber-200">Mode Crédit / Dette</p>
                          <p className="mt-1 text-xs font-semibold text-amber-100">
                            Calculateur de monnaie désactivé. La vente est enregistrée en dette totale.
                          </p>
                        </div>
                      )}

                      <div className="mt-8 grid gap-3 md:grid-cols-2">
                        <Button
                          type="button"
                          onClick={handleConfirmRecette}
                          isLoading={isSubmittingRecette}
                          disabled={!isOnline || isSubmittingRecette}
                          className="h-16 rounded-2xl bg-emerald-500 text-lg font-black text-slate-950 hover:bg-emerald-400"
                        >
                          <Check className="mr-2 h-5 w-5" />
                          {isCreditSale ? 'CONFIRMER (Dette)' : 'CONFIRMER (Entrée)'}
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
                          <p className="mt-1 text-3xl font-black text-amber-200">{currentShift ? formatElapsed(currentShift.started_at) : '00:00:00'}</p>
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
                          onChange={(e) => {
                            setCloseShiftForm({ actualCash: e.target.value });
                            setCloseShiftFieldError(null);
                          }}
                          className="mt-1"
                        />
                        {closeShiftFieldError && (
                          <p className="mt-2 text-xs font-semibold text-rose-600">{closeShiftFieldError}</p>
                        )}
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

                {showCloseShiftConfirm && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 p-4">
                    <div className="w-full max-w-lg rounded-2xl border border-rose-400/40 bg-slate-900 p-6 text-white shadow-2xl">
                      <h3 className="text-lg font-black uppercase tracking-wider text-rose-200">Confirmation Clôture</h3>
                      <p className="mt-3 text-sm text-slate-200">
                        Cette action termine la garde en cours et enregistre l&apos;écart de caisse. Voulez-vous confirmer la clôture ?
                      </p>
                      <p className="mt-3 rounded-xl border border-slate-700 bg-slate-800/70 px-4 py-3 text-sm">
                        Montant saisi: <span className="font-black text-emerald-300">{formatAmountGNF(Number(closeShiftForm.actualCash || 0))} GNF</span>
                      </p>
                      <div className="mt-5 flex gap-3">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setShowCloseShiftConfirm(false)}
                          className="flex-1 border-slate-600 bg-transparent text-slate-100 hover:bg-slate-800"
                        >
                          Annuler
                        </Button>
                        <Button
                          type="button"
                          onClick={() => void executeCloseShift()}
                          className="flex-1 bg-rose-600 text-white hover:bg-rose-500"
                        >
                          Confirmer la Clôture
                        </Button>
                      </div>
                    </div>
                  </div>
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
                      disabled={!canStartShift}
                      isLoading={isStarting}
                      className="h-11 rounded-xl"
                    >
                      <Play className="mr-2 h-4 w-4" aria-hidden />
                      Démarrer la Garde
                    </Button>
                  )}
                  {isAdmin && hasAnotherActiveGuard && (
                    <Button
                      variant="destructive"
                      onClick={() => void handleForceCloseActiveShift()}
                      className="h-11 rounded-xl px-5 text-xs font-black uppercase tracking-wider"
                    >
                      Forcer la Clôture (Admin)
                    </Button>
                  )}
                </div>
                {hasAnotherActiveGuard && (
                  <p className="mt-3 text-xs font-black uppercase tracking-wider text-amber-700">
                    Garde en cours par : {activeGuardCashierName}
                  </p>
                )}
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
