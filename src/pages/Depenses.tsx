import { useEffect, useState, useCallback } from 'react';
import { useConnection } from '@/context/ConnectionContext';
import { AlertCircle, Check, Clock, Plus, Trash2, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';

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
  approved_by: string | null;
};

type Shift = {
  id: string;
  user_id: string;
  started_at: string;
  ended_at: string | null;
};

export function Depenses() {
  const { user, role } = useAuth();
  const { isOnline } = useConnection();
  const [currentShift, setCurrentShift] = useState<Shift | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    amount: '',
    description: '',
    method: 'espèces' as const,
  });

  // Fetch active shift
  const fetchActiveShift = useCallback(async () => {
    if (!user) return null;
    const { data } = await supabase
      .from('shifts')
      .select('id, user_id, started_at, ended_at')
      .eq('user_id', user.id)
      .is('ended_at', null)
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    return data ?? null;
  }, [user]);

  // Fetch transactions
  const fetchTransactions = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    const { data, error: err } = await supabase
      .from('transactions')
      .select('*')
      .eq('type', 'dépense')
      .order('created_at', { ascending: false })
      .limit(50);

    if (err) {
      setError(err.message);
    } else {
      setTransactions((data || []) as Transaction[]);
    }
    setIsLoading(false);
  }, [user]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const shift = await fetchActiveShift();
      if (!mounted) return;
      setCurrentShift(shift);
    })();
    fetchTransactions();
    return () => {
      mounted = false;
    };
  }, [fetchActiveShift, fetchTransactions]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!user || !currentShift) {
      setError('Une garde active est requise pour enregistrer une dépense.');
      return;
    }

    if (!formData.amount || isNaN(parseFloat(formData.amount))) {
      setError('Veuillez entrer un montant valide.');
      return;
    }

    if (!formData.description.trim()) {
      setError('Veuillez entrer une description.');
      return;
    }

    setIsLoading(true);
    const { error: insertError } = await supabase.from('transactions').insert({
      shift_id: currentShift.id,
      amount: parseFloat(formData.amount),
      description: formData.description,
      type: 'dépense',
      method: formData.method,
      status: role === 'cashier' || role !== 'administrator' ? 'en_attente' : 'validé',
      is_approved: role === 'administrator',
      created_by: user.id,
    });

    setIsLoading(false);

    if (insertError) {
      setError(insertError.message || 'Erreur lors de l\'enregistrement de la dépense.');
      return;
    }

    // Reset form and refresh list
    setFormData({ amount: '', description: '', method: 'espèces' });
    setShowForm(false);
    await fetchTransactions();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette dépense ?')) return;

    setError(null);
    const { error: deleteError } = await supabase
      .from('transactions')
      .delete()
      .eq('id', id);

    if (deleteError) {
      setError(deleteError.message || 'Erreur lors de la suppression.');
      return;
    }

    await fetchTransactions();
  };

  const handleApprove = async (id: string) => {
    if (!confirm('Êtes-vous sûr de vouloir approuver cette dépense ?')) return;

    setError(null);
    const { error: updateError } = await supabase
      .from('transactions')
      .update({
        is_approved: true,
        status: 'validé',
        approved_by: user?.id,
        approved_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (updateError) {
      setError(updateError.message || 'Erreur lors de l\'approbation.');
      return;
    }

    await fetchTransactions();
  };

  const handleReject = async (id: string) => {
    if (!confirm('Êtes-vous sûr de vouloir rejeter cette dépense ?')) return;

    setError(null);
    const { error: deleteError } = await supabase
      .from('transactions')
      .delete()
      .eq('id', id);

    if (deleteError) {
      setError(deleteError.message || 'Erreur lors du rejet.');
      return;
    }

    await fetchTransactions();
  };

  const totalExpenses = transactions.reduce((sum, t) => sum + t.amount, 0);
  const pendingExpenses = transactions.filter(t => t.status === 'en_attente').length;
  const approvedExpenses = transactions.filter(t => t.is_approved).length;

  return (
    <div className="p-6 lg:p-8">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Dépenses
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Enregistrement et suivi des dépenses de la pharmacie
        </p>
      </header>

      {!currentShift && (
        <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-900">
          <p className="text-sm">
            ⚠️ Vous devez démarrer une garde pour enregistrer une dépense. Allez au Tableau de bord.
          </p>
        </div>
      )}

      <div className="mb-6 grid gap-4 sm:grid-cols-4">
        <StatCard
          title="Dépenses totales"
          value={`${totalExpenses.toFixed(2).replace('.', ',')} GNF`}
        />
        <StatCard
          title="En attente"
          value={pendingExpenses.toString()}
          color="amber"
        />
        <StatCard
          title="Approuvées"
          value={approvedExpenses.toString()}
          color="green"
        />
        <StatCard
          title="Garde active"
          value={currentShift ? 'Oui' : 'Non'}
          color={currentShift ? 'green' : 'gray'}
        />
      </div>

      {role === 'administrator' && (
        <section className="mb-8 rounded-lg border border-blue-200 bg-blue-50 p-6">
          <h2 className="mb-4 text-lg font-semibold text-blue-900">📋 Dépenses en Attente d'Approbation</h2>
          {transactions.filter(t => t.status === 'en_attente').length === 0 ? (
            <p className="text-sm text-blue-800">Aucune dépense en attente d'approbation.</p>
          ) : (
            <div className="space-y-3">
              {transactions
                .filter(t => t.status === 'en_attente')
                .map((tx) => (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between rounded-lg bg-white p-4 border border-blue-100"
                  >
                    <div className="flex-1">
                      <p className="font-medium text-foreground">{tx.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(tx.created_at).toLocaleDateString('fr-FR')} • {tx.amount.toFixed(2).replace('.', ',')} GNF
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={() => handleApprove(tx.id)}
                        size="sm"
                        className="bg-green-600 hover:bg-green-700 text-white"
                      >
                        ✓ Approuver
                      </Button>
                      <Button
                        onClick={() => handleReject(tx.id)}
                        size="sm"
                        variant="outline"
                        className="border-red-300 text-red-600 hover:bg-red-50"
                      >
                        ✕ Rejeter
                      </Button>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </section>
      )}

      <div className="mb-6">
        {!showForm ? (
          <Button
            onClick={() => setShowForm(true)}
            disabled={!currentShift}
            className="gap-2"
          >
            <Plus className="h-4 w-4" />
            Nouvelle Dépense
          </Button>
        ) : (
          <form onSubmit={handleSubmit} className="rounded-lg border border-border bg-card p-6">
            <h2 className="mb-4 text-lg font-medium text-foreground">Enregistrer une dépense</h2>

            {error && (
              <div className="mb-4 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground">
                  Montant (GNF) *
                </label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  placeholder="Ex: 100000"
                  value={formData.amount}
                  onChange={(e) =>
                    setFormData({ ...formData, amount: e.target.value })
                  }
                  className="mt-1"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground">
                  Description *
                </label>
                <Input
                  type="text"
                  required
                  placeholder="Ex: Achat de médicaments"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  className="mt-1"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground">
                  Méthode de paiement *
                </label>
                <select
                  value={formData.method}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      method: e.target.value as 'espèces' | 'orange_money' | 'assurance',
                    })
                  }
                  className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground"
                >
                  <option value="espèces">💵 Espèces</option>
                  <option value="orange_money">📱 Orange Money</option>
                  <option value="assurance">🏥 Assurance</option>
                </select>
              </div>
            </div>

            {role !== 'administrator' && (
              <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                <p>
                  Cette dépense sera en attente d'approbation par un administrateur.
                </p>
              </div>
            )}

            <div className="mt-6 flex gap-3">
              <div className="flex-1">
                <Button type="submit" disabled={isLoading || !isOnline} className="w-full">
                  {isLoading ? 'Enregistrement...' : 'Enregistrer'}
                </Button>
                {!isOnline && (
                  <p className="mt-2 text-xs text-amber-700">Connexion perdue. Enregistrement désactivé pour éviter la perte de données.</p>
                )}
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowForm(false)}
              >
                Annuler
              </Button>
            </div>
          </form>
        )}
      </div>

      <div>
        <h2 className="mb-4 text-lg font-medium text-foreground">Dépenses récentes</h2>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Chargement...</p>
        ) : transactions.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune dépense enregistrée.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/30">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">Date</th>
                  <th className="px-4 py-2 text-left font-medium">Description</th>
                  <th className="px-4 py-2 text-right font-medium">Montant</th>
                  <th className="px-4 py-2 text-left font-medium">Méthode</th>
                  <th className="px-4 py-2 text-left font-medium">Statut</th>
                  <th className="px-4 py-2 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {transactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3">
                      {new Date(tx.created_at).toLocaleDateString('fr-FR')}
                    </td>
                    <td className="px-4 py-3">{tx.description}</td>
                    <td className="px-4 py-3 text-right font-medium">
                      {tx.amount.toFixed(2).replace('.', ',')} GNF
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {tx.method === 'espèces' ? '💵 Espèces' : tx.method === 'orange_money' ? '📱 Orange Money' : '🏥 Assurance'}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium ${
                          tx.status === 'en_attente'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-green-100 text-green-800'
                        }`}
                      >
                        {tx.status === 'en_attente' ? (
                          <>
                            <Clock className="h-3 w-3" />
                            En attente
                          </>
                        ) : (
                          <>
                            <Check className="h-3 w-3" />
                            Validé
                          </>
                        )}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-1">
                        {role === 'administrator' && tx.status === 'en_attente' && (
                          <button
                            onClick={() => handleApprove(tx.id)}
                            className="flex items-center gap-1 rounded px-2 py-1 text-xs bg-green-100 text-green-800 hover:bg-green-200 transition"
                            title="Approuver"
                          >
                            <CheckCircle className="h-3 w-3" />
                            Approuver
                          </button>
                        )}
                        {(role !== 'administrator' || tx.status === 'en_attente') && (
                          <button
                            onClick={() => handleDelete(tx.id)}
                            className="flex items-center gap-1 rounded px-2 py-1 text-xs text-destructive hover:bg-destructive/10 transition"
                            title="Supprimer"
                          >
                            <Trash2 className="h-3 w-3" />
                            Supprimer
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ title, value, color = 'default' }: { title: string; value: string; color?: string }) {
  const colorClasses = {
    default: 'border-border',
    amber: 'border-amber-200 bg-amber-50',
    green: 'border-green-200 bg-green-50',
    gray: 'border-gray-200 bg-gray-50',
  };

  return (
    <div className={`rounded-lg border ${colorClasses[color as keyof typeof colorClasses] || colorClasses.default} bg-card p-5 shadow-sm`}>
      <p className="text-sm font-medium text-muted-foreground">{title}</p>
      <p className="mt-2 text-2xl font-semibold text-foreground">{value}</p>
    </div>
  );
}

export default Depenses;
