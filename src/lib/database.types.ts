export type TransactionType = 'recette' | 'dépense' | 'retour' | 'crédit' | 'Crédit';
export type PaymentMethod =
    | 'Espèces'
    | 'Orange Money (Code Marchand)'
    | 'Crédit / Dette'
    | 'espèces'
    | 'orange_money'
    | 'crédit_dette'
    | 'virement_cheque'
    | 'carte_bancaire'
    | 'assurance';
export type TransactionStatus = 'en_attente' | 'validé' | 'rejeté';

export interface Transaction {
    id: string;
    shift_id: string;
    amount: number;
    description: string;
    type: TransactionType;
    method: PaymentMethod;
    status: string;
    insurance_name: string | null;
    insurance_id?: string | null;
    insurance_card_id?: string | null;
    insurance_percentage?: number | null;
    amount_covered_by_insurance?: number | null;
    customer_name?: string | null;
    customer_phone?: string | null;
    payment_status?: string | null;
    payment_paid_at?: string | null;
    payment_paid_by?: string | null;
    created_at: string;
    created_by: string;
    approved_by?: string | null;
    approved_at?: string | null;
}

export interface Shift {
    id: string;
    user_id: string;
    started_at: string;
    ended_at: string | null;
    expected_cash?: number | null;
    actual_cash?: number | null;
    cash_difference?: number | null;
    closed_by?: string | null;
}
