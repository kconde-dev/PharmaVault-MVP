import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { AlertCircle, FileText, CheckCircle2, TrendingDown, TrendingUp, History, ClipboardCheck } from 'lucide-react';
import { downloadShiftReceiptPDF } from '@/lib/pdf';
import type { Shift } from '@/lib/database.types';

interface ShiftWithUser extends Shift {
  user_email?: string;
}

export function Gardes() {
  const [shifts, setShifts] = useState<ShiftWithUser[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const fetchData = async () => {
      if (mounted) {
        setIsLoading(true);
        setError(null);
      }

      try {
        const { data: shiftsData, error: shiftsError } = await supabase
          .from('shifts')
          .select('*')
          .not('ended_at', 'is', null)
          .order('ended_at', { ascending: false })
          .limit(100);

        if (shiftsError) throw shiftsError;

        if (shiftsData && shiftsData.length > 0) {
          const shiftsWithUsers = await Promise.all(
            shiftsData.map(async (shift) => {
              try {
                const { data: userData } = await supabase
                  .from('user_roles')
                  .select('username')
                  .eq('user_id', shift.user_id)
                  .single();

                return {
                  ...shift,
                  user_email: userData ? `${userData.username}@pharmavault.com` : 'Utilisateur',
                };
              } catch {
                return { ...shift, user_email: 'Inconnu' };
              }
            })
          );
          if (mounted) setShifts(shiftsWithUsers);
        } else {
          if (mounted) setShifts([]);
        }
      } catch (err) {
        if (mounted) setError(err instanceof Error ? err.message : 'Défaut de synchronisation financière');
      } finally {
        if (mounted) setIsLoading(false);
      }
    };

    fetchData();

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="p-6 lg:p-10 space-y-10">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="h-2 w-8 bg-indigo-500 rounded-full" />
            <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-[0.2em]">Audit & Rapprochement Bancaire</span>
          </div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900">
            Bilans de Caisse
          </h1>
          <p className="mt-1 text-sm font-medium text-slate-500">
            Archive centrale des clôtures de sessions et écarts inventoriés.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex h-11 px-6 items-center gap-3 bg-white rounded-xl border border-slate-200 shadow-sm text-slate-500">
            <History className="h-4 w-4" />
            <span className="text-xs font-bold uppercase tracking-tight">Historique (100 derniers)</span>
          </div>
        </div>
      </header>

      {error && (
        <div className="p-5 rounded-2xl bg-rose-50 border border-rose-100 flex items-center gap-4 text-rose-600 animate-in fade-in slide-in-from-top-4">
          <AlertCircle className="h-5 w-5" />
          <p className="text-xs font-bold uppercase tracking-widest">{error}</p>
        </div>
      )}

      <div className="space-y-6">
        {isLoading ? (
          <div className="h-40 flex items-center justify-center bg-white rounded-[2.5rem] border border-slate-100">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] animate-pulse">Extraction des registres...</p>
          </div>
        ) : shifts.length === 0 ? (
          <div className="h-60 flex flex-col items-center justify-center bg-slate-50 border-2 border-dashed border-slate-200 rounded-[2.5rem]">
            <ClipboardCheck className="h-10 w-10 text-slate-200 mb-4" />
            <p className="text-sm font-bold text-slate-400 uppercase tracking-widest italic">Aucun bilan de caisse disponible</p>
          </div>
        ) : (
          <div className="glass-card rounded-[2.5rem] overflow-hidden border border-white/60 shadow-xl shadow-slate-200/50">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Date & Période</th>
                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Opérateur</th>
                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Théorique (Caisse)</th>
                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Inventorié (Réel)</th>
                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Écart Fiscal</th>
                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Conformité</th>
                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white/50">
                  {shifts.map((shift) => {
                    const discrepancy = shift.cash_difference ?? 0;
                    const isPerfect = Math.abs(discrepancy) < 0.01;
                    const isDeficit = discrepancy < 0;

                    return (
                      <tr key={shift.id} className="group hover:bg-slate-50/80 transition-colors">
                        <td className="px-8 py-6">
                          <div>
                            <p className="text-sm font-black text-slate-900 tracking-tight">
                              {shift.ended_at ? new Date(shift.ended_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                            </p>
                            <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">
                              {shift.started_at ? `Start: ${new Date(shift.started_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}` : ''}
                            </p>
                          </div>
                        </td>
                        <td className="px-8 py-6">
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 w-1.5 rounded-full bg-slate-300" />
                            <span className="text-[11px] font-black text-slate-600 uppercase italic">
                              {shift.user_email?.split('@')[0] || 'Anonyme'}
                            </span>
                          </div>
                        </td>
                        <td className="px-8 py-6 text-right font-bold text-slate-500 tabular-nums text-xs">
                          {shift.expected_cash?.toLocaleString('fr-FR')} G
                        </td>
                        <td className="px-8 py-6 text-right font-black text-slate-900 tabular-nums text-xs">
                          {shift.actual_cash?.toLocaleString('fr-FR')} G
                        </td>
                        <td className={`px-8 py-6 text-right font-black tabular-nums text-xs ${isPerfect ? 'text-emerald-500' : isDeficit ? 'text-rose-600' : 'text-amber-600'}`}>
                          {discrepancy >= 0 ? '+' : ''}{discrepancy.toLocaleString('fr-FR')} G
                        </td>
                        <td className="px-8 py-6 text-center">
                          <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[9px] font-black uppercase tracking-widest ${isPerfect ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                            isDeficit ? 'bg-rose-50 text-rose-600 border-rose-100 shadow-[0_0_15px_rgba(225,29,72,0.1)]' :
                              'bg-amber-50 text-amber-600 border-amber-100'
                            }`}>
                            {isPerfect ? <CheckCircle2 className="h-3 w-3" /> : isDeficit ? <TrendingDown className="h-3 w-3" /> : <TrendingUp className="h-3 w-3" />}
                            {isPerfect ? 'CONFORME' : isDeficit ? 'MANQUANT' : 'SURPLUS'}
                          </div>
                        </td>
                        <td className="px-8 py-6 text-right">
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
                            className="bg-slate-900 hover:bg-black text-white px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ml-auto shadow-md shadow-slate-900/10 active:scale-95 border-0"
                          >
                            <FileText className="h-3 w-3" />
                            Archiver PDF
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default Gardes;
