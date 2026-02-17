import { useEffect, useState, useCallback, useRef } from 'react';
import { useConnection } from '@/context/ConnectionContext';
import { Play, X, CheckCircle, AlertTriangle, Check, RotateCcw, Maximize2, Minimize2, CircleHelp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import AppToast, { type ToastVariant } from '@/components/AppToast';
import StatsGrid from '@/components/StatsGrid';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { useLocation, useNavigate } from 'react-router-dom';
import type { Shift, Transaction, PaymentMethod } from '@/lib/database.types';
import { formatSupabaseError } from '@/lib/supabaseError';

function fromModernPaymentMethod(method?: string): PaymentMethod {
  if (method === 'cash') return 'Espèces';
  if (method === 'mobile_money' || method === 'orange_money') return 'Orange Money (Code Marchand)';
  if (method === 'credit' || method === 'crédit_dette') return 'Crédit / Dette';
  if (method === 'card') return 'Espèces';
  return 'Espèces';
}

type DbPaymentMethod = 'Espèces' | 'Orange Money (Code Marchand)' | 'crédit_dette';
type CanonicalPaymentMethod = 'cash' | 'orange_money' | 'credit' | 'assurance';

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
  if (
    value === 'crédit / dette'
    || value === 'credit / dette'
    || value === 'crédit_dette'
    || value === 'credit_debt'
    || value === 'credit'
    || value === 'crédit'
  ) {
    return 'crédit_dette';
  }
  return 'Espèces';
}

function toCanonicalPaymentMethod(raw: string, isInsuranceSale: boolean, isCreditSale: boolean): CanonicalPaymentMethod {
  if (isInsuranceSale) return 'assurance';
  if (isCreditSale) return 'credit';
  const normalized = normalizePaymentMethodForDb(raw);
  if (normalized === 'Orange Money (Code Marchand)') return 'orange_money';
  return 'cash';
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

function isMissingShiftCloseReasonColumnError(err: unknown): boolean {
  const message = String(
    (err as { message?: string } | null)?.message ||
    (err as { details?: string } | null)?.details ||
    ''
  ).toLowerCase();
  return message.includes('closed_reason');
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

type ClientSuggestion = {
  id: string;
  nom: string;
  telephone: string | null;
  solde_dette: number;
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
      ? (
        String(row.payment_method).toLowerCase() === 'crédit_dette'
          || String(row.payment_method).toLowerCase() === 'credit'
          ? 'Crédit / Dette'
          : fromModernPaymentMethod(row.payment_method)
      )
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
    total_amount:
      row.total_amount != null
        ? Number(row.total_amount)
        : row.amount != null
          ? Number(row.amount)
          : null,
    amount_paid:
      row.amount_paid != null
        ? Number(row.amount_paid)
        : row.amount != null && row.amount_covered_by_insurance != null
          ? Number(row.amount) - Number(row.amount_covered_by_insurance)
          : row.amount != null
            ? Number(row.amount)
            : null,
    insurance_amount:
      row.insurance_amount != null
        ? Number(row.insurance_amount)
        : row.amount_covered_by_insurance != null
          ? Number(row.amount_covered_by_insurance)
          : null,
    description: String(row.description || ''),
    type: type as Transaction['type'],
    method: method as Transaction['method'],
    status,
    insurance_name: ((row.insurance_name as string | null) ?? (row.insurance_provider as string | null)) ?? null,
    insurance_provider: ((row.insurance_provider as string | null) ?? (row.insurance_name as string | null)) ?? null,
    insurance_reference: ((row.insurance_reference as string | null) ?? (row.insurance_card_id as string | null)) ?? null,
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
  if (transaction.insurance_amount != null && Number.isFinite(Number(transaction.insurance_amount))) {
    return Number(transaction.insurance_amount);
  }
  return Number(transaction.amount_covered_by_insurance || 0);
}

function getPatientCashPart(transaction: Transaction): number {
  if (transaction.amount_paid != null && Number.isFinite(Number(transaction.amount_paid))) {
    return Number(transaction.amount_paid);
  }
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

function sanitizeGnfAmountInput(raw: string): string {
  const digitsOnly = raw.replace(/[^\d]/g, '');
  if (!digitsOnly) return '';
  return String(Number.parseInt(digitsOnly, 10));
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
  const [showTerminal, setShowTerminal] = useState(false);
  const [showPreCloseModal, setShowPreCloseModal] = useState(false);
  const [closeShiftConfirmed, setCloseShiftConfirmed] = useState(false);
  const [closeShiftDelayLeft, setCloseShiftDelayLeft] = useState(0);
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
  const [flashPatientPart, setFlashPatientPart] = useState(false);
  const amountInputRef = useRef<HTMLInputElement | null>(null);
  const terminalSectionRef = useRef<HTMLElement | null>(null);
  const verifyConfirmButtonRef = useRef<HTMLButtonElement | null>(null);
  const hasActiveShiftRpcRef = useRef<boolean | null>(null);
  const hasClientsTableRef = useRef<boolean | null>(null);
  const clientsLookupPendingRef = useRef(false);

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
  const [clientSuggestions, setClientSuggestions] = useState<ClientSuggestion[]>([]);
  const [showClientSuggestions, setShowClientSuggestions] = useState(false);
  const [clientDebtHint, setClientDebtHint] = useState<number | null>(null);
  const [clientsLookupDisabled, setClientsLookupDisabled] = useState(false);

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
    recettesDettes: number;
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
    if (!showVerificationModal) return;
    const timer = window.setTimeout(() => {
      verifyConfirmButtonRef.current?.focus();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [showVerificationModal]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!showCloseShiftForm) return;
    setCloseShiftConfirmed(false);
    setCloseShiftDelayLeft(2);
    const timer = window.setInterval(() => {
      setCloseShiftDelayLeft((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [showCloseShiftForm]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(QUICK_AMOUNTS_STORAGE_KEY, JSON.stringify(quickAmounts));
  }, [quickAmounts]);

  useEffect(() => {
    const isCreditSale = isCreditMethod(String(recetteForm.method));
    const search = recetteForm.customerName.trim();
    if (!isCreditSale || search.length < 2 || hasClientsTableRef.current === false || clientsLookupDisabled) {
      setClientSuggestions([]);
      setShowClientSuggestions(false);
      if (!search) setClientDebtHint(null);
      return;
    }

    let active = true;
    const timer = window.setTimeout(async () => {
      if (clientsLookupPendingRef.current) return;
      clientsLookupPendingRef.current = true;
      try {
        const { data, error } = await supabase
          .from('clients')
          .select('id, nom, telephone, solde_dette')
          .ilike('nom', `%${search}%`)
          .order('nom', { ascending: true })
          .limit(6);

        if (!active) return;
        if (error) {
          hasClientsTableRef.current = false;
          setClientsLookupDisabled(true);
          setClientSuggestions([]);
          setShowClientSuggestions(false);
          return;
        }

        hasClientsTableRef.current = true;
        const rows = ((data || []) as ClientSuggestion[]).map((row) => ({
          ...row,
          solde_dette: Number(row.solde_dette || 0),
        }));
        setClientSuggestions(rows);
        setShowClientSuggestions(rows.length > 0);

        const exact = rows.find((row) => row.nom.toLowerCase() === search.toLowerCase());
        setClientDebtHint(exact ? Number(exact.solde_dette || 0) : null);
      } catch {
        if (!active) return;
        hasClientsTableRef.current = false;
        setClientsLookupDisabled(true);
        setClientSuggestions([]);
        setShowClientSuggestions(false);
      } finally {
        clientsLookupPendingRef.current = false;
      }
    }, 140);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [recetteForm.customerName, recetteForm.method]);

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

  const upsertClientDebt = useCallback(async (name: string, phone: string, debtDelta: number) => {
    if (!name.trim() || debtDelta <= 0) return;
    if (hasClientsTableRef.current === false) return;

    try {
      const { data: existing, error: findError } = await supabase
        .from('clients')
        .select('id, nom, telephone, solde_dette')
        .eq('nom', name.trim())
        .maybeSingle();

      if (findError) {
        hasClientsTableRef.current = false;
        return;
      }

      hasClientsTableRef.current = true;
      const existingDebt = Number(existing?.solde_dette || 0);
      const nextDebt = Math.max(0, existingDebt + debtDelta);
      const nextPhone = phone.trim() || existing?.telephone || null;
      const payload = {
        nom: name.trim(),
        telephone: nextPhone,
        solde_dette: nextDebt,
        updated_at: new Date().toISOString(),
      };
      const { error: upsertError } = await supabase
        .from('clients')
        .upsert(payload, { onConflict: 'nom' });
      if (upsertError) {
        hasClientsTableRef.current = false;
      }
    } catch {
      hasClientsTableRef.current = false;
    }
  }, []);

  const handleSelectClientSuggestion = useCallback((client: ClientSuggestion) => {
    setRecetteForm((prev) => ({
      ...prev,
      customerName: client.nom,
      customerPhone: prev.customerPhone.trim() ? prev.customerPhone : (client.telephone || ''),
    }));
    setClientDebtHint(Number(client.solde_dette || 0));
    setShowClientSuggestions(false);
  }, []);

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

    if (!recetteForm.amount || isNaN(Number.parseInt(recetteForm.amount, 10))) {
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

    const totalAmount = Number.parseInt(recetteForm.amount, 10);
    const isCreditSale = isCreditMethod(String(recetteForm.method));
    const customerName = recetteForm.customerName.trim() || 'Client Comptant';
    const isInsuranceSale = !isCreditSale && recetteForm.isInsuranceSale;
    const insuranceReference = recetteForm.matricule.trim() || 'N/A';
    const coverageRate = isInsuranceSale ? Number(recetteForm.coverageRate || 0) : 0;
    const insurancePart = isInsuranceSale ? Number((totalAmount * (coverageRate / 100)).toFixed(2)) : 0;
    const patientPart = isInsuranceSale ? Math.max(0, Number((totalAmount - insurancePart).toFixed(2))) : totalAmount;
    const canonicalMethod: CanonicalPaymentMethod = toCanonicalPaymentMethod(
      String(recetteForm.method || 'Espèces'),
      isInsuranceSale,
      isCreditSale
    );
    const cashierName = getCashierName({
      email: writer.email,
      user_metadata: writer.user_metadata as Record<string, unknown> | null,
    });
    const modernType = isCreditSale ? 'Crédit' : 'Recette';
    const legacyTypePreferred = isCreditSale ? 'Crédit' : 'Recette';

    const transactionDescription = isCreditSale
      ? `Crédit Client - ${customerName}${recetteForm.customerPhone ? ` | Tel: ${recetteForm.customerPhone}` : ''}`
      : isInsuranceSale
      ? `Recette Assurance - ${recetteForm.insurerName} | Matricule: ${insuranceReference} | Part Patient: ${formatAmountGNF(patientPart)} | Part Assurance: ${formatAmountGNF(insurancePart)}`
      : 'Recette';

    const payloadBase = {
      shift_id: currentShift.id,
      amount: totalAmount,
      total_amount: totalAmount,
      amount_paid: patientPart,
      insurance_amount: isInsuranceSale ? insurancePart : 0,
      description: transactionDescription,
      type: modernType,
      category: isCreditSale ? 'Crédit Client' : 'Vente',
      payment_method: canonicalMethod,
      status: 'approved',
      payment_status: isCreditSale ? 'Dette Totale' : null,
      insurance_provider: isInsuranceSale ? recetteForm.insurerName : null,
      insurance_reference: isInsuranceSale ? insuranceReference : null,
      insurance_name: isInsuranceSale ? recetteForm.insurerName : null,
      insurance_card_id: isInsuranceSale ? insuranceReference : null,
      insurance_percentage: isInsuranceSale ? coverageRate : null,
      amount_covered_by_insurance: isInsuranceSale ? insurancePart : null,
      customer_name: isCreditSale ? customerName : null,
      customer_phone: isCreditSale ? recetteForm.customerPhone || null : null,
      created_by: writer.id,
      cashier_name: cashierName,
      is_approved: true,
    };

    const payloadLegacyCompatible = {
      shift_id: currentShift.id,
      amount: totalAmount,
      description: isCreditSale
        ? `Crédit Client - ${customerName}${recetteForm.customerPhone ? ` | Tel: ${recetteForm.customerPhone}` : ''}`
        : isInsuranceSale
        ? `Recette Assurance - ${recetteForm.insurerName} | Matricule: ${insuranceReference}`
        : 'Recette',
      type: legacyTypePreferred,
      category: isCreditSale ? 'Crédit Client' : 'Vente',
      payment_method: canonicalMethod,
      status: 'approved',
      payment_status: isCreditSale ? 'Dette Totale' : null,
      insurance_name: isInsuranceSale ? recetteForm.insurerName : null,
      insurance_card_id: isInsuranceSale ? insuranceReference : null,
      coverage_percent: isInsuranceSale ? coverageRate : null,
      amount_covered_by_insurance: isInsuranceSale ? insurancePart : null,
      customer_name: isCreditSale ? customerName : null,
      customer_phone: isCreditSale ? recetteForm.customerPhone || null : null,
      created_by: writer.id,
      is_approved: true,
    };

    const payloadLegacyMinimal = {
      shift_id: currentShift.id,
      amount: totalAmount,
      description: transactionDescription,
      type: isCreditSale ? 'Crédit' : 'Recette',
      payment_method: canonicalMethod,
      status: 'approved',
      created_by: writer.id,
      is_approved: true,
    };

    const payloadLegacyLabels = {
      shift_id: currentShift.id,
      amount: totalAmount,
      description: transactionDescription,
      type: isCreditSale ? 'Crédit' : 'Recette',
      payment_method: isCreditSale
        ? 'Crédit / Dette'
        : normalizePaymentMethodForDb(String(recetteForm.method || 'Espèces')) === 'Orange Money (Code Marchand)'
          ? 'Orange Money (Code Marchand)'
          : 'Espèces',
      status: 'approved',
      created_by: writer.id,
      is_approved: true,
    };

    const payloadBareFrench = {
      shift_id: currentShift.id,
      amount: totalAmount,
      description: transactionDescription,
      type: isCreditSale ? 'Crédit' : 'Recette',
      payment_method: isCreditSale
        ? 'crédit_dette'
        : normalizePaymentMethodForDb(String(recetteForm.method || 'Espèces')) === 'Orange Money (Code Marchand)'
          ? 'orange_money'
          : 'espèces',
      created_by: writer.id,
    };

    const payloadAttempts: Array<Record<string, unknown>> = [
      payloadBase,
      payloadLegacyCompatible,
      payloadLegacyMinimal,
      payloadLegacyLabels,
      payloadBareFrench,
    ];

    let insertError: unknown = null;
    for (const payload of payloadAttempts) {
      const { error: attemptError } = await supabase.from('transactions').insert(payload);
      if (!attemptError) {
        insertError = null;
        break;
      }
      insertError = attemptError;
      console.error(
        'Transaction insert attempt failed',
        JSON.stringify(attemptError),
        JSON.stringify(payload)
      );
      const message = String(
        (attemptError as { message?: string } | null)?.message ||
        (attemptError as { details?: string } | null)?.details ||
        ''
      ).toLowerCase();
      if (!message.includes('column') && !message.includes('schema cache') && !message.includes('invalid input value for enum')) {
        // Continue anyway; final error surfaced after all compatibility attempts.
      }
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

    if (isCreditSale) {
      await upsertClientDebt(customerName, recetteForm.customerPhone || '', totalAmount);
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
    setClientSuggestions([]);
    setShowClientSuggestions(false);
    setClientDebtHint(null);
    setShowVerificationModal(false);
    await refreshTransactions();
    window.dispatchEvent(new CustomEvent('transactions-updated'));
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
    const amount = Number.parseInt(recetteForm.amount, 10);
    if (!recetteForm.amount || Number.isNaN(amount) || amount <= 0) {
      setError('Montant invalide.');
      return false;
    }
    if (isCreditMethod(String(recetteForm.method))) {
      setReceivedAmount('');
      setShowVerificationModal(true);
      return true;
    }
    if (recetteForm.isInsuranceSale) {
      if (!recetteForm.insurerName.trim()) {
        setError('Veuillez sélectionner un assureur.');
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

  const handleAddAmountDelta = (delta: number) => {
    setRecetteForm((prev) => {
      const current = Number.parseInt(String(prev.amount || '0'), 10);
      const safeCurrent = Number.isFinite(current) ? current : 0;
      return { ...prev, amount: String(Math.max(0, safeCurrent + delta)) };
    });
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

    const recettesDettes = transactions
      .filter((t) => isCreditMethod(String(t.method)) && t.status === 'approved')
      .reduce((sum, t) => sum + Number(t.total_amount || t.amount || 0), 0);

    const totalRetours = Math.abs(
      transactions
        .filter(t => t.type === 'retour')
        .reduce((sum, t) => sum + Number(t.amount || 0), 0)
    );

    const totalRecettes = recettesEspeces + recettesOrangeMoney + recettesAssurance + recettesDettes;

    const totalDepenses = transactions
      .filter(t => t.type === 'dépense' && t.status === 'approved')
      .reduce((sum, t) => sum + t.amount, 0);

    const soldeNetARemettre = recettesEspeces - totalRetours - totalDepenses;

    // Écart = Physical_Cash_Reported - (Fond_de_Caisse + Espèces_Recettes - Dépenses)
    const openingBalance = Number((currentShift as unknown as { opening_balance?: number | null })?.opening_balance || 0);
    const expectedCash = openingBalance + recettesEspeces - totalDepenses;

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

      if (updateError && (isMissingShiftBalanceColumnsError(updateError) || isMissingShiftCloseReasonColumnError(updateError))) {
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
      recettesDettes,
      totalRetours,
      totalDepenses,
      soldeNetARemettre,
      cashDifference,
    });
    setCurrentShift(null);
    await refreshGlobalActiveShift();

    setShowCloseShiftForm(false);
    setCloseShiftForm({ actualCash: '' });
    setCloseShiftConfirmed(false);
    setCloseShiftDelayLeft(0);
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

    if (forceError && (isMissingShiftBalanceColumnsError(forceError) || isMissingShiftCloseReasonColumnError(forceError))) {
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

  const handlePostShiftLogout = async () => {
    try {
      await supabase.auth.signOut();
      navigate('/login', { replace: true });
    } catch (logoutError) {
      setToast({
        variant: 'error',
        title: 'Déconnexion échouée',
        message: logoutError instanceof Error ? logoutError.message : 'Impossible de se déconnecter.',
      });
    }
  };

  const handleCloseShift = async () => {
    setCloseShiftFieldError(null);
    const value = Number.parseFloat(closeShiftForm.actualCash || '');
    if (!Number.isFinite(value) || value < 0) {
      setCloseShiftFieldError('Le montant du tiroir doit être un nombre positif.');
      return;
    }
    if (!closeShiftConfirmed) {
      setCloseShiftFieldError('Veuillez confirmer l’exactitude du fond de caisse.');
      return;
    }
    if (closeShiftDelayLeft > 0) {
      setCloseShiftFieldError('Veuillez attendre la fin du délai de sécurité.');
      return;
    }
    await executeCloseShift();
  };

  const cashierName = getCashierName({
    email: user?.email ?? null,
    user_metadata: (user?.user_metadata as Record<string, unknown> | null) ?? null,
  });
  const amountValue = Number.parseInt(recetteForm.amount || '0', 10);
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
  const shiftCashTotal = transactions
    .filter((tx) => tx.type === 'recette' && isCashMethod(String(tx.method)))
    .reduce((sum, tx) => sum + getPatientCashPart(tx), 0)
    - transactions
      .filter((tx) => tx.type === 'dépense' && tx.status === 'approved')
      .reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
  const shiftOrangeMoneyTotal = transactions
    .filter((tx) => tx.type === 'recette' && isOrangeMethod(String(tx.method)))
    .reduce((sum, tx) => sum + getPatientCashPart(tx), 0);
  const shiftDebtTotal = transactions
    .filter((tx) => tx.type === 'crédit' || tx.type === 'Crédit' || isCreditMethod(String(tx.method)))
    .reduce((sum, tx) => sum + Number(tx.total_amount || tx.amount || 0), 0);
  const shiftAssuranceClaimTotal = transactions
    .filter((tx) => tx.type === 'recette')
    .reduce((sum, tx) => sum + getInsuranceCoveredAmount(tx), 0);
  const preCloseReturnsTotal = Math.abs(
    cashierTransactions
      .filter((tx) => tx.type === 'retour')
      .reduce((sum, tx) => sum + Number(tx.amount || 0), 0)
  );
  const insurerOptions = ['CNAMGS', 'NSIA', 'LANALA', 'SAHAM', 'Activa', 'Autre'];
  const coverageRateOptions = [70, 80, 90, 100];
  const saleReady = Number.isFinite(amountValue) && amountValue > 0;
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
    if (!recetteForm.isInsuranceSale || isCreditSale) return;
    setFlashPatientPart(true);
    const timer = window.setTimeout(() => setFlashPatientPart(false), 420);
    return () => window.clearTimeout(timer);
  }, [recetteForm.coverageRate, recetteForm.amount, recetteForm.isInsuranceSale, isCreditSale]);

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

      if (event.key === 'Escape' && !showVerificationModal) {
        event.preventDefault();
        setRecetteForm((prev) => ({
          ...prev,
          amount: '',
          customerName: '',
          customerPhone: '',
          matricule: '',
          isInsuranceSale: false,
        }));
        setReceivedAmount('');
        setClientSuggestions([]);
        setShowClientSuggestions(false);
        setClientDebtHint(null);
        window.requestAnimationFrame(() => amountInputRef.current?.focus());
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
    <div className={isTerminalMode ? 'h-full overflow-hidden space-y-0' : (isCashierFocusedTerminal ? 'space-y-0' : 'p-6 lg:p-8 space-y-6')}>
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
          <section className="shift-print-area mb-8 rounded-lg border border-green-200 bg-green-50 p-8">
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
                    <span className="font-bold text-emerald-700">💵 Espèces</span>
                    <span className="font-black text-emerald-700">{closedShiftSummary.recettesEspeces.toFixed(2).replace('.', ',')} GNF</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-bold text-orange-600">📱 Orange Money</span>
                    <span className="font-black text-orange-600">{closedShiftSummary.recettesOrangeMoney.toFixed(2).replace('.', ',')} GNF</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-bold text-blue-600">🏥 Assurance</span>
                    <span className="font-black text-blue-600">{closedShiftSummary.recettesAssurance.toFixed(2).replace('.', ',')} GNF</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-bold text-rose-600">💳 Crédits/Dettes Clients</span>
                    <span className="font-black text-rose-600">{closedShiftSummary.recettesDettes.toFixed(2).replace('.', ',')} GNF</span>
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

              <div className="border-t border-slate-300 pt-4">
                <p className="text-xs font-black uppercase tracking-wider text-slate-500">Final Balance (Écart)</p>
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

            <div className="no-print mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Button
                onClick={() => {
                  const whatsappMessage =
                    `Rapport de Garde - Pharmacie Djoma. ` +
                    `Caissier: ${user?.email?.split('@')[0] || 'Caissier'}. ` +
                    `Date: ${closedShiftSummary.date}. ` +
                    `Espèces: ${formatAmountGNF(closedShiftSummary.recettesEspeces)} GNF. ` +
                    `OM: ${formatAmountGNF(closedShiftSummary.recettesOrangeMoney)} GNF. ` +
                    `Assurance: ${formatAmountGNF(closedShiftSummary.recettesAssurance)} GNF. ` +
                    `Dettes: ${formatAmountGNF(closedShiftSummary.recettesDettes)} GNF. ` +
                    `Écart: ${formatAmountGNF(closedShiftSummary.cashDifference)} GNF.`;
                  window.open(`https://wa.me/?text=${encodeURIComponent(whatsappMessage)}`, '_blank', 'noopener,noreferrer');
                }}
                className="h-14 justify-center rounded-xl bg-green-600 px-4 text-sm font-black text-white hover:bg-green-700"
              >
                📱 Rapport WhatsApp (Admin)
              </Button>
              <Button
                onClick={() => window.print()}
                className="h-14 justify-center rounded-xl bg-blue-600 px-4 text-sm font-black text-white hover:bg-blue-700"
              >
                🖨️ Imprimer le Bilan
              </Button>
              <Button
                onClick={() => {
                  setClosedShiftSummary(null);
                  navigate('/dashboard?view=terminal', { replace: true });
                  setShowTerminal(true);
                }}
                className="h-14 justify-center rounded-xl bg-violet-600 px-4 text-sm font-black text-white hover:bg-violet-700"
              >
                🔄 Nouvelle Garde
              </Button>
              <Button
                onClick={() => void handlePostShiftLogout()}
                className="h-14 justify-center rounded-xl bg-slate-700 px-4 text-sm font-black text-white hover:bg-rose-700"
              >
                🚪 Déconnexion
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
                  <section
                    ref={terminalSectionRef}
                    className={`relative overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 text-white ${
                      isCashierFocusedTerminal
                        ? 'h-[100vh] border-0 rounded-none shadow-none'
                        : 'h-[calc(100vh-10rem)] rounded-3xl border border-slate-200 shadow-2xl'
                    }`}
                  >
                    <div className="pointer-events-none absolute -left-20 -top-20 h-72 w-72 rounded-full bg-emerald-500/20 blur-3xl" />
                    <div className="pointer-events-none absolute -right-10 top-1/4 h-72 w-72 rounded-full bg-cyan-500/10 blur-3xl" />

                    <div className="relative flex h-full flex-col gap-3 p-3 md:p-4">
                      <div className="flex shrink-0 items-center justify-between gap-3">
                        <div>
                          <h2 className="text-xl font-black tracking-tight">Pharmacie Djoma</h2>
                          <p className="text-xs text-slate-200">Caissier: <span className="font-black text-white">{cashierName}</span></p>
                        </div>
                        <div className="hidden xl:block">
                          <TerminalTimePanel startedAt={currentShift.started_at} isOnline={isOnline} />
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button type="button" variant="outline" onClick={() => void toggleFullscreen()} className="border-cyan-400/40 bg-cyan-900/20 text-cyan-100 hover:bg-cyan-900/40">
                            {isFullscreen ? <Minimize2 className="mr-2 h-4 w-4" /> : <Maximize2 className="mr-2 h-4 w-4" />}
                            {isFullscreen ? 'Quitter Plein Écran' : 'Plein Écran'}
                          </Button>
                          <Button type="button" variant="outline" onClick={() => setShowPreCloseModal(true)} className="border-amber-400/40 bg-amber-900/20 text-amber-100 hover:bg-amber-900/40">
                            Pré-Clôture
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                              setCloseShiftForm({ actualCash: String(Math.max(0, Number(shiftCashTotal.toFixed(2)))) });
                              setShowCloseShiftForm(true);
                            }}
                            className="border-rose-400/40 bg-rose-900/20 text-rose-100 hover:bg-rose-900/40"
                          >
                            Fin de Garde
                          </Button>
                        </div>
                      </div>

                      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 xl:grid-cols-[25%_50%_25%]">
                        <aside className="order-2 flex min-h-0 flex-col gap-3 rounded-2xl border border-slate-700 bg-slate-900/60 p-3 xl:order-1">
                          <div className="rounded-xl border border-slate-700 bg-slate-900/70 p-3">
                            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Mini Shift Info</p>
                            <p className="mt-1 text-sm font-bold text-white">{cashierName}</p>
                            <p className="text-xs text-slate-300">{isOnline ? 'Status: Online' : 'Status: Offline'}</p>
                            <p className="text-xs font-bold text-amber-300">Temps de garde: {formatElapsed(currentShift.started_at)}</p>
                          </div>
                          <div className="flex min-h-0 flex-1 flex-col rounded-xl border border-slate-700 bg-slate-900/70 p-3">
                            <p className="mb-2 text-[10px] font-black uppercase tracking-[0.18em] text-slate-300">10 Dernières Entrées</p>
                            <div className="sidebar-scrollbar max-h-[40vh] space-y-2 overflow-y-auto pr-1">
                              {recentEntries.length === 0 ? (
                                <p className="text-xs text-slate-400">Aucune entrée récente.</p>
                              ) : (
                                recentEntries.map((tx) => (
                                  <div key={tx.id} className="rounded-lg border border-slate-800 bg-slate-950/70 p-2">
                                    <p className="text-sm font-black text-white">{formatAmountGNF(tx.amount)} GNF</p>
                                    <p className="text-[10px] text-slate-400">{new Date(tx.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</p>
                                  </div>
                                ))
                              )}
                            </div>
                          </div>
                        </aside>

                        <form onSubmit={handleAddRecette} className="order-1 flex min-h-0 flex-col gap-3 xl:order-2">
                          <Input
                            ref={amountInputRef}
                            type="number"
                            inputMode="numeric"
                            step="500"
                            min="0"
                            required
                            placeholder="0"
                            value={recetteForm.amount}
                            onChange={(e) => setRecetteForm((prev) => ({ ...prev, amount: sanitizeGnfAmountInput(e.target.value) }))}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                openVerificationModal();
                              }
                            }}
                            className="h-28 rounded-2xl border-2 border-emerald-300/60 bg-black text-center font-black text-[#39ff14] shadow-2xl placeholder:text-slate-600 focus-visible:border-emerald-500 focus-visible:ring-emerald-500/40"
                            style={{ fontSize: 'clamp(2.25rem, 7vw, 5rem)', lineHeight: 1.05 }}
                          />

                          <div className="grid gap-2">
                            <button
                              type="button"
                              onClick={() => setRecetteForm((prev) => ({ ...prev, method: 'Espèces' }))}
                              className={`h-14 rounded-xl px-5 text-sm font-black uppercase tracking-[0.12em] transition ${normalizePaymentMethodForDb(String(recetteForm.method)) === 'Espèces' ? 'bg-emerald-500 text-slate-950' : 'bg-emerald-900/40 text-emerald-100 hover:bg-emerald-800/60'}`}
                            >
                              Espèces
                            </button>
                            <div className="grid grid-cols-2 gap-2">
                              <button
                                type="button"
                                onClick={() => setRecetteForm((prev) => ({ ...prev, method: 'Orange Money (Code Marchand)' }))}
                                className={`h-14 rounded-xl px-4 text-sm font-black uppercase tracking-[0.1em] transition ${normalizePaymentMethodForDb(String(recetteForm.method)) === 'Orange Money (Code Marchand)' ? 'bg-orange-500 text-slate-950' : 'bg-orange-900/40 text-orange-100 hover:bg-orange-800/60'}`}
                              >
                                Orange Money
                              </button>
                              <button
                                type="button"
                                onClick={() => setRecetteForm((prev) => ({ ...prev, method: 'Crédit / Dette', isInsuranceSale: false }))}
                                className={`h-14 rounded-xl px-4 text-sm font-black uppercase tracking-[0.1em] transition ${normalizePaymentMethodForDb(String(recetteForm.method)) === 'crédit_dette' ? 'bg-rose-500 text-white' : 'bg-rose-900/40 text-rose-100 hover:bg-rose-800/60'}`}
                              >
                                Crédit
                              </button>
                            </div>
                          </div>

                          {isCreditSale && (
                            <div className="rounded-xl border border-amber-300/40 bg-amber-950/30 p-3">
                              <div className="grid gap-2">
                                <Input
                                  type="text"
                                  required
                                  autoComplete="off"
                                  value={recetteForm.customerName}
                                  onChange={(e) => {
                                    setRecetteForm((prev) => ({ ...prev, customerName: e.target.value }));
                                    setShowClientSuggestions(true);
                                  }}
                                  onBlur={() => window.setTimeout(() => setShowClientSuggestions(false), 120)}
                                  onFocus={() => clientSuggestions.length > 0 && setShowClientSuggestions(true)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      openVerificationModal();
                                    }
                                  }}
                                  placeholder="Nom complet du débiteur"
                                  className="h-10 rounded-xl !border-2 !border-slate-300 !bg-white !text-black text-sm font-semibold placeholder:!text-slate-400"
                                />
                                <Input
                                  type="tel"
                                  inputMode="tel"
                                  value={recetteForm.customerPhone}
                                  onChange={(e) => setRecetteForm((prev) => ({ ...prev, customerPhone: e.target.value }))}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      openVerificationModal();
                                    }
                                  }}
                                  placeholder="N° de téléphone (6xx xx xx xx)"
                                  className="h-10 rounded-xl !border-2 !border-slate-300 !bg-white !text-black text-sm font-semibold placeholder:!text-slate-400"
                                />
                              </div>
                              {showClientSuggestions && clientSuggestions.length > 0 && (
                                <div className="mt-2 max-h-32 overflow-auto rounded-xl border border-slate-300 bg-white">
                                  {clientSuggestions.map((client) => (
                                    <button key={client.id} type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => handleSelectClientSuggestion(client)} className="flex w-full items-center justify-between px-3 py-1.5 text-left text-xs hover:bg-slate-100">
                                      <span className="font-semibold text-slate-900">{client.nom}</span>
                                      <span className="font-bold text-slate-500">{formatAmountGNF(Number(client.solde_dette || 0))} GNF</span>
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}

                          <Button
                            type="submit"
                            disabled={!isOnline}
                            className={`h-16 rounded-2xl text-lg font-black uppercase tracking-[0.15em] ${saleReady ? 'animate-pulse bg-emerald-500 text-slate-950 hover:bg-emerald-400' : 'bg-slate-700 text-slate-200 hover:bg-slate-600'}`}
                          >
                            Valider
                          </Button>
                        </form>

                        <aside className="order-3 flex min-h-0 flex-col gap-3 rounded-2xl border border-slate-700 bg-slate-900/60 p-3">
                          <div>
                            <p className="mb-2 text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Quick Add</p>
                            <div className="grid grid-cols-2 gap-2">
                              {[1000, 5000, 10000, 20000].map((delta) => (
                                <button key={delta} type="button" onClick={() => handleAddAmountDelta(delta)} className="h-12 rounded-xl border border-emerald-300/40 bg-emerald-500/15 text-sm font-black text-emerald-100 hover:bg-emerald-500/30">
                                  +{(delta / 1000).toLocaleString('fr-FR')}k
                                </button>
                              ))}
                            </div>
                          </div>

                          {!isCreditSale && (
                            <div className="rounded-xl border border-cyan-300/40 bg-cyan-950/20 p-3">
                              <div className="mb-2 flex items-center justify-between">
                                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-cyan-100">Mode Assurance</p>
                                <button
                                  type="button"
                                  onClick={() => setRecetteForm((prev) => ({ ...prev, isInsuranceSale: !prev.isInsuranceSale }))}
                                  className={`rounded-lg px-2 py-1 text-[10px] font-black uppercase ${recetteForm.isInsuranceSale ? 'bg-cyan-500 text-white' : 'bg-slate-200 text-slate-900'}`}
                                >
                                  {recetteForm.isInsuranceSale ? 'On' : 'Off'}
                                </button>
                              </div>
                              {recetteForm.isInsuranceSale && (
                                <div className="space-y-2">
                                  <div className="flex flex-wrap gap-1">
                                    {insurerOptions.map((insurer) => (
                                      <button key={insurer} type="button" onClick={() => setRecetteForm((prev) => ({ ...prev, insurerName: insurer }))} className={`rounded-md px-2 py-1 text-[10px] font-black ${recetteForm.insurerName === insurer ? 'bg-cyan-500 text-white' : 'bg-white text-slate-900'}`}>
                                        {insurer}
                                      </button>
                                    ))}
                                  </div>
                                  <div className="flex flex-wrap gap-1">
                                    {coverageRateOptions.map((rate) => (
                                      <button key={rate} type="button" onClick={() => setRecetteForm((prev) => ({ ...prev, coverageRate: rate }))} className={`rounded-md px-2 py-1 text-[10px] font-black ${recetteForm.coverageRate === rate ? 'bg-emerald-600 text-white' : 'bg-white text-slate-900'}`}>
                                        {rate}%
                                      </button>
                                    ))}
                                  </div>
                                  <Input type="text" value={recetteForm.matricule} onChange={(e) => setRecetteForm((prev) => ({ ...prev, matricule: e.target.value }))} placeholder="N° de Bon" className="h-9 rounded-lg !border-2 !border-slate-300 !bg-white !text-black placeholder:!text-slate-400" />
                                  <div className="text-xs font-bold">
                                    <p className={`${flashPatientPart ? 'text-emerald-300' : 'text-emerald-200'}`}>Part Patient: {formatAmountGNF(patientPart)} GNF</p>
                                    <p className="text-cyan-200">Part Assurance: {formatAmountGNF(insurancePart)} GNF</p>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}

                          <div className="mt-auto rounded-xl border border-slate-700 bg-slate-950/60 p-3 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                            <p>Alt+1 Espèces</p>
                            <p>Alt+2 Orange Money</p>
                            <p>Alt+3 Crédit / Dette</p>
                            <p>Ctrl+Entrée Vérifier</p>
                            <p>Entrée Confirmer</p>
                          </div>
                        </aside>
                      </div>
                    </div>
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
                        event.stopPropagation();
                        setShowVerificationModal(false);
                        window.requestAnimationFrame(() => amountInputRef.current?.focus());
                      }
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        event.stopPropagation();
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
                          ref={verifyConfirmButtonRef}
                          type="button"
                          onClick={handleConfirmRecette}
                          isLoading={isSubmittingRecette}
                          disabled={!isOnline || isSubmittingRecette}
                          autoFocus
                          className="h-16 rounded-2xl bg-emerald-500 text-lg font-black text-slate-950 hover:bg-emerald-400 focus-visible:animate-pulse focus-visible:ring-4 focus-visible:ring-emerald-300 focus-visible:ring-offset-2"
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
                  <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 p-4">
                    <div className="w-full max-w-2xl rounded-3xl border border-rose-400/40 bg-slate-900 p-6 text-white shadow-2xl">
                      <div className="mb-4 flex items-center justify-between">
                        <h3 className="text-xl font-black uppercase tracking-[0.16em] text-rose-200">Vérification Fin de Garde</h3>
                        <button
                          type="button"
                          onClick={() => setShowCloseShiftForm(false)}
                          className="rounded-md p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
                        >
                          <X className="h-5 w-5" />
                        </button>
                      </div>

                      <div className="grid gap-2 rounded-2xl border border-slate-700 bg-slate-800/60 p-4 text-sm md:grid-cols-2">
                        <p>Total Espèces : <span className="font-black text-emerald-300">{formatAmountGNF(shiftCashTotal)} GNF</span></p>
                        <p>Total Orange Money : <span className="font-black text-orange-300">{formatAmountGNF(shiftOrangeMoneyTotal)} GNF</span></p>
                        <p>Total Dettes : <span className="font-black text-rose-300">{formatAmountGNF(shiftDebtTotal)} GNF</span></p>
                        <p>Total Assurance : <span className="font-black text-cyan-300">{formatAmountGNF(shiftAssuranceClaimTotal)} GNF</span></p>
                      </div>

                      <div className="mt-4">
                        <label className="block text-sm font-bold text-slate-200">Montant exact du tiroir (GNF) *</label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          required
                          value={closeShiftForm.actualCash}
                          onChange={(e) => {
                            setCloseShiftForm({ actualCash: e.target.value });
                            setCloseShiftFieldError(null);
                          }}
                          className="mt-2 h-12 rounded-xl border-slate-600 bg-white text-lg font-black text-slate-900"
                        />
                      </div>

                      <label className="mt-4 flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800/70 p-3 text-sm">
                        <input
                          type="checkbox"
                          checked={closeShiftConfirmed}
                          onChange={(e) => setCloseShiftConfirmed(e.target.checked)}
                          className="h-4 w-4 accent-rose-500"
                        />
                        Je confirme l&apos;exactitude du fond de caisse.
                      </label>

                      {closeShiftFieldError && (
                        <p className="mt-2 text-xs font-semibold text-rose-300">{closeShiftFieldError}</p>
                      )}

                      <div className="mt-5 flex gap-3">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setShowCloseShiftForm(false)}
                          className="flex-1 border-slate-600 bg-transparent text-slate-100 hover:bg-slate-800"
                        >
                          Annuler
                        </Button>
                        <Button
                          type="button"
                          variant="destructive"
                          disabled={!isOnline || closeShiftDelayLeft > 0 || !closeShiftConfirmed}
                          onClick={() => void handleCloseShift()}
                          className="flex-1 text-base font-black"
                        >
                          {closeShiftDelayLeft > 0 ? `Confirmer la Fermeture (${closeShiftDelayLeft})` : 'Confirmer la Fermeture'}
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
