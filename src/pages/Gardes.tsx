import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { AlertCircle, Download } from 'lucide-react';
import { downloadShiftReceiptPDF } from '@/lib/pdf';

type ShiftWithUser = {
  id: string;
  user_id: string;
  started_at: string;
  ended_at: string | null;
  expected_cash: number | null;
  actual_cash: number | null;
  cash_difference: number | null;
  closed_by: string | null;
  user_email?: string;
};

export function Gardes() {
  const { user, role } = useAuth();
  const [shifts, setShifts] = useState<ShiftWithUser[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchShifts = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Fetch all closed shifts with user data
      const { data: shiftsData, error: shiftsError } = await supabase
        .from('shifts')
        .select('*')
        .not('ended_at', 'is', null)
        .order('ended_at', { ascending: false })
        .limit(100);

      if (shiftsError) {
        setError(shiftsError.message);
        setIsLoading(false);
        return;
      }

      // Get user emails for each shift
      if (shiftsData && shiftsData.length > 0) {
        const shiftsWithUsers = await Promise.all(
          shiftsData.map(async (shift) => {
            const { data: userData } = await supabase.auth.admin.getUserById(shift.user_id);
            return {
              ...shift,
              user_email: userData?.user?.email || 'Utilisateur supprimé',
            };
          })
        );
        setShifts(shiftsWithUsers);
      } else {
        setShifts([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors du chargement');
    }

    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetchShifts();
  }, [fetchShifts]);

  const getDiscrepancyColor = (difference: number | null) => {
    if (difference === null) return 'text-gray-600';
    if (difference < 0) return 'text-red-600 font-semibold';
    if (difference > 0) return 'text-orange-600';
    return 'text-green-600';
  };

  return (
    <div className="p-6 lg:p-8">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Gestion des Gardes
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Historique des gardes clôturées et rapprochement de caisse
        </p>
      </header>

      {error && (
        <div className="mb-6 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {role === 'administrator' ? (
        <div className="space-y-4">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Chargement des gardes...</p>
          ) : shifts.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune garde clôturée pour le moment.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead className="border-b border-border bg-muted/30">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold">Date</th>
                    <th className="px-4 py-3 text-left font-semibold">Caissier/ère</th>
                    <th className="px-4 py-3 text-right font-semibold">Espèces Attendues</th>
                    <th className="px-4 py-3 text-right font-semibold">Espèces Réelles</th>
                    <th className="px-4 py-3 text-right font-semibold">Écart</th>
                    <th className="px-4 py-3 text-center font-semibold">Statut</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {shifts.map((shift) => {
                    const discrepancy = shift.cash_difference ?? 0;
                    const isDiscrepant = discrepancy !== 0;
                    const rowClass = isDiscrepant && discrepancy < 0 ? 'bg-red-50 hover:bg-red-100' : 'hover:bg-muted/30';

                    return (
                      <tr key={shift.id} className={rowClass}>
                        <td className="px-4 py-3">
                          <div>
                            <p className="font-medium text-foreground">
                              {shift.ended_at
                                ? new Date(shift.ended_at).toLocaleDateString('fr-FR')
                                : 'N/A'}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {shift.started_at
                                ? `Début: ${new Date(shift.started_at).toLocaleTimeString('fr-FR', {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}`
                                : ''}
                            </p>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-foreground">
                          {shift.user_email?.split('@')[0] || 'Utilisateur'}
                        </td>
                        <td className="px-4 py-3 text-right font-medium">
                          {shift.expected_cash !== null
                            ? `${shift.expected_cash.toFixed(2).replace('.', ',')} GNF`
                            : '—'}
                        </td>
                        <td className="px-4 py-3 text-right font-medium">
                          {shift.actual_cash !== null
                            ? `${shift.actual_cash.toFixed(2).replace('.', ',')} GNF`
                            : '—'}
                        </td>
                        <td className={`px-4 py-3 text-right ${getDiscrepancyColor(shift.cash_difference)}`}>
                          {shift.cash_difference !== null
                            ? `${shift.cash_difference >= 0 ? '+' : ''}${shift.cash_difference
                                .toFixed(2)
                                .replace('.', ',')} GNF`
                            : '—'}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {shift.cash_difference === null ? (
                            <span className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium bg-gray-100 text-gray-800">
                              ℹ️ Non clôturée
                            </span>
                          ) : Math.abs(shift.cash_difference) < 0.01 ? (
                            <span className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium bg-green-100 text-green-800">
                              ✓ Parfait
                            </span>
                          ) : shift.cash_difference < 0 ? (
                            <span className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium bg-red-100 text-red-800">
                              ⚠️ Manquant
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium bg-orange-100 text-orange-800">
                              ⓘ Surplus
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {shift.cash_difference !== null && (
                            <button
                              onClick={() =>
                                downloadShiftReceiptPDF({
                                  date: new Date(shift.ended_at!).toLocaleDateString('fr-FR'),
                                  cashierName: shift.user_email?.split('@')[0] || 'Caissier',
                                  expectedCash: shift.expected_cash ?? 0,
                                  actualCash: shift.actual_cash ?? 0,
                                  cashDifference: shift.cash_difference ?? 0,
                                })
                              }
                              className="inline-flex items-center gap-2 rounded px-3 py-1.5 text-xs font-medium bg-blue-100 text-blue-800 hover:bg-blue-200 transition"
                            >
                              <Download className="h-3.5 w-3.5" />
                              Télécharger le Reçu
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
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
                Cette page n'est accessible que pour les administrateurs. Contactez votre responsable pour accéder à l'historique des gardes.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Gardes;
