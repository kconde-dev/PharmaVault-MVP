import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { AlertCircle } from 'lucide-react';

type Transaction = {
  id: string;
  shift_id: string;
  amount: number;
  description: string;
  type: 'recette' | 'dépense';
  method: 'espèces' | 'orange_money' | 'assurance';
  status: string;
  is_approved: boolean;
  insurance_name: string | null;
  created_at: string;
  created_by: string;
};

type InsuranceGroup = {
  name: string;
  transactions: Transaction[];
  total: number;
  count: number;
};

export function Assurances() {
  const { user, role } = useAuth();
  const [insuranceGroups, setInsuranceGroups] = useState<InsuranceGroup[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchInsuranceTransactions = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const { data: transactions, error: txError } = await supabase
        .from('transactions')
        .select('*')
        .eq('method', 'assurance')
        .order('created_at', { ascending: false });

      if (txError) {
        setError(txError.message);
        setIsLoading(false);
        return;
      }

      // Group by insurance name
      const grouped = new Map<string, Transaction[]>();
      (transactions || []).forEach((tx) => {
        const insuranceName = tx.insurance_name || 'Sans nom';
        if (!grouped.has(insuranceName)) {
          grouped.set(insuranceName, []);
        }
        grouped.get(insuranceName)!.push(tx);
      });

      // Convert to array of InsuranceGroup
      const groups: InsuranceGroup[] = Array.from(grouped, ([name, txs]) => ({
        name,
        transactions: txs,
        total: txs.reduce((sum, t) => sum + t.amount, 0),
        count: txs.length,
      })).sort((a, b) => b.total - a.total); // Sort by total amount descending

      setInsuranceGroups(groups);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors du chargement');
    }

    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetchInsuranceTransactions();
  }, [fetchInsuranceTransactions]);

  const grandTotal = insuranceGroups.reduce((sum, group) => sum + group.total, 0);
  const totalTransactions = insuranceGroups.reduce((sum, group) => sum + group.count, 0);

  return (
    <div className="p-6 lg:p-8">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Suivi des Assurances
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Montants dus par compagnie d'assurance
        </p>
      </header>

      {error && (
        <div className="mb-6 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {role === 'administrator' ? (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard
              title="Total dû"
              value={`${grandTotal.toFixed(2).replace('.', ',')} GNF`}
              color="blue"
            />
            <StatCard
              title="Compagnies"
              value={insuranceGroups.length.toString()}
              color="purple"
            />
            <StatCard
              title="Transactions"
              value={totalTransactions.toString()}
              color="indigo"
            />
          </div>

          {isLoading ? (
            <p className="text-sm text-muted-foreground">Chargement...</p>
          ) : insuranceGroups.length === 0 ? (
            <div className="rounded-lg border border-border bg-card p-8 text-center">
              <p className="text-sm text-muted-foreground">
                Aucune transaction d'assurance enregistrée.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {insuranceGroups.map((group) => (
                <div
                  key={group.name}
                  className="rounded-lg border border-border bg-card p-6 shadow-sm"
                >
                  <div className="mb-4 flex items-center justify-between border-b border-border pb-4">
                    <div>
                      <h2 className="text-lg font-semibold text-foreground">
                        {group.name}
                      </h2>
                      <p className="text-xs text-muted-foreground">
                        {group.count} transaction{group.count > 1 ? 's' : ''}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-primary">
                        {group.total.toFixed(2).replace('.', ',')} GNF
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {((group.total / grandTotal) * 100).toFixed(1)}% du total
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {group.transactions.map((tx) => (
                      <div
                        key={tx.id}
                        className="flex items-center justify-between rounded-lg bg-muted/30 p-3 text-sm"
                      >
                        <div className="flex-1">
                          <p className="font-medium text-foreground">
                            {tx.description}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(tx.created_at).toLocaleDateString('fr-FR')} •{' '}
                            {tx.type === 'recette' ? '📥 Recette' : '📤 Dépense'}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-foreground">
                            {tx.amount.toFixed(2).replace('.', ',')} GNF
                          </p>
                          <span
                            className={`inline-flex text-xs font-medium px-2 py-1 rounded ${
                              tx.is_approved
                                ? 'bg-green-100 text-green-800'
                                : 'bg-yellow-100 text-yellow-800'
                            }`}
                          >
                            {tx.is_approved ? '✓ Approuvé' : '⏳ En attente'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-6 text-amber-900">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">Accès Réservé Administrateur</p>
              <p className="text-sm mt-1">
                Cette page n'est accessible que pour les administrateurs. Contactez votre responsable pour accéder au suivi des assurances.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard(
  { title, value, color = 'default' }: 
  { title: string; value: string; color?: string }
) {
  const colorClasses: Record<string, string> = {
    default: 'bg-card border-border',
    blue: 'bg-blue-50 border-blue-200',
    purple: 'bg-purple-50 border-purple-200',
    indigo: 'bg-indigo-50 border-indigo-200',
  };

  return (
    <div className={`rounded-lg border ${colorClasses[color] || colorClasses.default} p-5 shadow-sm`}>
      <p className="text-sm font-medium text-muted-foreground">{title}</p>
      <p className="mt-2 text-2xl font-semibold text-foreground">{value}</p>
    </div>
  );
}

export default Assurances;
