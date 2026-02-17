import { supabase } from '@/lib/supabase';

export type CreditSchemaStatus = 'ready' | 'missing' | 'unknown';

export type CreditSchemaReadiness = {
  status: CreditSchemaStatus;
  details?: string;
};

let cachedReadiness: CreditSchemaReadiness | null = null;
let inFlightCheck: Promise<CreditSchemaReadiness> | null = null;

async function runCheck(): Promise<CreditSchemaReadiness> {
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .limit(1);

  if (error) {
    return {
      status: 'unknown',
      details: String(error.message || error.details || 'Erreur de vérification du schéma crédit.'),
    };
  }

  const row = Array.isArray(data) && data.length > 0 ? data[0] as Record<string, unknown> : null;
  if (!row) {
    return {
      status: 'unknown',
      details: 'Aucune transaction disponible pour confirmer les colonnes crédit.',
    };
  }

  const hasCreditColumns =
    Object.hasOwn(row, 'customer_name')
    && Object.hasOwn(row, 'customer_phone')
    && Object.hasOwn(row, 'payment_status')
    && Object.hasOwn(row, 'payment_paid_at')
    && Object.hasOwn(row, 'payment_paid_by');

  if (!hasCreditColumns) {
    return {
      status: 'missing',
      details: 'Migration requise: supabase/migrations/20260216010000_add_customer_credit_support.sql',
    };
  }

  return { status: 'ready' };
}

export async function getCreditSchemaReadiness(forceRefresh = false): Promise<CreditSchemaReadiness> {
  if (cachedReadiness && !forceRefresh) return cachedReadiness;
  if (inFlightCheck && !forceRefresh) return inFlightCheck;

  inFlightCheck = runCheck()
    .then((result) => {
      cachedReadiness = result;
      return result;
    })
    .finally(() => {
      inFlightCheck = null;
    });

  return inFlightCheck;
}
