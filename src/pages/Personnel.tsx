import React, { useState, useEffect } from 'react';
import { RotateCcw, Trash2, AlertCircle, Loader, UserPlus, Users, ShieldCheck, Mail, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import AppToast, { type ToastVariant } from '@/components/AppToast';
import { useAuth } from '@/hooks/useAuth';
import { useConnection } from '@/context/ConnectionContext';
import {
  createUser,
  getAllStaff,
  resetUserPassword,
  deleteUser,
  updateUserRole,
} from '@/lib/userManagement';

interface Staff {
  id: string;
  username: string;
  role: 'administrator' | 'staff';
  created_at: string;
  email: string;
}

interface AddEmployeeForm {
  username: string;
  accessCode: string; // 6-digit PIN
}

export const Personnel: React.FC = () => {
  const { role } = useAuth();
  const { isOnline } = useConnection();
  const [staff, setStaff] = useState<Staff[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState<{ variant: ToastVariant; title: string; message: string; hint?: string } | null>(null);
  const [formData, setFormData] = useState<AddEmployeeForm>({
    username: '',
    accessCode: '',
  });
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [pendingUserDelete, setPendingUserDelete] = useState<{ id: string; username: string } | null>(null);

  const loadStaff = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const staffData = await getAllStaff();
      setStaff(staffData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Dépassement de capacité ou erreur réseau');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (role !== 'administrator') {
      setError('Droits d\'accès insuffisants pour ce module');
      return;
    }
    loadStaff();
  }, [role]);

  const showToast = (variant: ToastVariant, title: string, message: string, hint?: string) => {
    setToast({ variant, title, message, hint });
  };

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const handleAddEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.username.trim() || !formData.accessCode.trim()) {
      setError('Tous les champs cliniques sont requis');
      return;
    }
    if (!/^\d{6}$/.test(formData.accessCode)) {
      setError('Le code PIN doit comporter 6 chiffres');
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      await createUser({
        username: formData.username.toLowerCase().trim(),
        accessCode: formData.accessCode,
        role: 'staff',
      });
      setSuccessMessage(`Compte "${formData.username}" activé avec succès`);
      showToast('success', 'Utilisateur cree', 'Nouveau membre enregistré.', 'Communiquez le PIN de manière sécurisée.');
      setFormData({ username: '', accessCode: '' });
      setShowModal(false);
      await loadStaff();
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur fatale lors de l\'inscription');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetPassword = async (userId: string, username: string) => {
    try {
      setError(null);
      const member = staff.find((s) => s.id === userId);
      await resetUserPassword(userId, member?.email);
      setSuccessMessage(`Protocole de réinitialisation lancé pour ${username}`);
      showToast('success', 'Reinitialisation lancee', `Accès relancé pour ${username}.`);
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Echec du protocole');
    }
  };

  const handleDeleteUser = async (userId: string, username: string) => {
    setPendingUserDelete({ id: userId, username });
  };

  const executeDeleteUser = async () => {
    if (!pendingUserDelete) return;
    const { id, username } = pendingUserDelete;
    setPendingUserDelete(null);
    try {
      setError(null);
      await deleteUser(id);
      setSuccessMessage(`Session "${username}" révoquée définitivement`);
      showToast('success', 'Compte revoque', `${username} retiré de l'application.`);
      await loadStaff();
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de révocation');
    }
  };

  const handleChangeRole = async (userId: string, currentRole: string, requestedRole: 'administrator' | 'staff', username: string) => {
    if (currentRole === requestedRole) return;
    const newRole = requestedRole;
    try {
      setError(null);
      await updateUserRole(userId, newRole as 'administrator' | 'staff');
      setSuccessMessage(`Privilèges mis à jour pour ${username}`);
      showToast('success', 'Role mis a jour', `Niveau d'accès actualisé pour ${username}.`);
      await loadStaff();
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de privilège');
    }
  };

  return (
    <div className="p-6 lg:p-10 space-y-10">
      <AppToast
        open={Boolean(toast)}
        variant={toast?.variant || 'success'}
        title={toast?.title || ''}
        message={toast?.message || ''}
        hint={toast?.hint}
        onClose={() => setToast(null)}
      />
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="h-2 w-8 bg-emerald-500 rounded-full" />
            <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-[0.2em]">Ressources Humaines</span>
          </div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900">
            Gestion du Personnel
          </h1>
          <p className="mt-1 text-sm font-medium text-slate-500">
            Contrôle des accès collaborateurs et niveaux de privilèges.
          </p>
        </div>

        <Button
          onClick={() => setShowModal(true)}
          disabled={!isOnline}
          className="h-14 rounded-2xl pharmacy-gradient text-white font-black uppercase tracking-widest px-8 shadow-xl shadow-emerald-500/20 group hover:scale-[1.02] active:scale-95 transition-all border-0"
        >
          <UserPlus className="h-5 w-5 mr-3 group-hover:scale-110 transition-transform" />
          Nouveau Membre
        </Button>
      </header>

      {(error || successMessage || !isOnline) && (
        <div className="space-y-4 animate-in slide-in-from-top-4">
          {error && (
            <div className="p-5 rounded-2xl bg-rose-50 border border-rose-100 flex items-center gap-4 text-rose-600">
              <AlertCircle className="h-5 w-5" />
              <p className="text-xs font-bold uppercase tracking-widest">Erreur: {error}</p>
            </div>
          )}
          {successMessage && (
            <div className="p-5 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center gap-4 text-emerald-600">
              <ShieldCheck className="h-5 w-5" />
              <p className="text-xs font-bold uppercase tracking-widest">Succès: {successMessage}</p>
            </div>
          )}
          {!isOnline && (
            <div className="p-5 rounded-2xl bg-amber-50 border border-amber-100 flex items-center gap-4 text-amber-600">
              <AlertCircle className="h-5 w-5" />
              <p className="text-xs font-bold uppercase tracking-widest underline decoration-wavy">Mode Hors-Ligne: Modifications Restreintes</p>
            </div>
          )}
        </div>
      )}

      {isLoading ? (
        <div className="h-60 flex items-center justify-center bg-white rounded-[2.5rem] border border-slate-100">
          <Loader className="h-8 w-8 animate-spin text-emerald-500" />
        </div>
      ) : (
        <div className="glass-card rounded-[2.5rem] overflow-hidden border border-white/60 shadow-xl shadow-slate-200/50">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Collaborateur / ID</th>
                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Email</th>
                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Niveau d'Accès</th>
                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Date d'Enrôlement</th>
                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Contrôle de Sécurité</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white/50">
                {staff.map((member) => (
                  <tr key={member.id} className="group hover:bg-slate-50/80 transition-colors">
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-4">
                        <div className="h-12 w-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-emerald-50 group-hover:text-emerald-500 transition-colors">
                          <Users className="h-6 w-6" />
                        </div>
                        <div>
                          <p className="text-sm font-black text-slate-900 tracking-tight uppercase italic">{member.username}</p>
                          <p className="text-[10px] text-slate-400 font-bold tracking-tight">{member.id.slice(0, 8)}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-2 text-[11px] font-bold text-slate-600">
                        <Mail className="h-3.5 w-3.5 text-slate-400" />
                        {member.email}
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="relative inline-flex items-center gap-2">
                        {member.role === 'administrator' ? <ShieldCheck className="h-3.5 w-3.5 text-indigo-500" /> : <Users className="h-3.5 w-3.5 text-emerald-500" />}
                        <select
                          value={member.role}
                          onChange={(e) => handleChangeRole(member.id, member.role, e.target.value as 'administrator' | 'staff', member.username)}
                          disabled={!isOnline}
                          className={`rounded-xl border px-3 py-2 text-[10px] font-black uppercase tracking-widest transition-all ${member.role === 'administrator'
                            ? 'bg-indigo-50 text-indigo-600 border-indigo-100'
                            : 'bg-emerald-50 text-emerald-600 border-emerald-100'
                            }`}
                        >
                          <option value="staff">Collaborateur</option>
                          <option value="administrator">Administrateur</option>
                        </select>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-2 text-[11px] font-bold text-slate-500 uppercase tracking-tight">
                        <Calendar className="h-3.5 w-3.5 text-slate-300" />
                        {new Date(member.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}
                      </div>
                    </td>
                    <td className="px-8 py-6 text-right">
                      <div className="flex items-center justify-end gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => handleResetPassword(member.id, member.username)}
                          disabled={!isOnline}
                          className="h-10 w-10 flex items-center justify-center rounded-xl bg-amber-50 text-amber-600 hover:bg-amber-500 hover:text-white transition-all shadow-sm border border-amber-100"
                          title="Réinitialiser l'Accès"
                        >
                          <RotateCcw className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteUser(member.id, member.username)}
                          disabled={!isOnline}
                          className="h-10 w-10 flex items-center justify-center rounded-xl bg-rose-50 text-rose-600 hover:bg-rose-500 hover:text-white transition-all shadow-sm border border-rose-100"
                          title="Révoquer l'Employé"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {pendingUserDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 p-4">
          <div className="w-full max-w-md rounded-2xl border border-rose-300 bg-white p-6 shadow-2xl">
            <h3 className="text-lg font-black text-slate-900">Confirmer la révocation</h3>
            <p className="mt-2 text-sm text-slate-600">
              Cette action est irréversible. Le compte <span className="font-black text-slate-900">{pendingUserDelete.username}</span> sera retiré de l&apos;application.
            </p>
            <div className="mt-5 flex gap-3">
              <Button type="button" variant="outline" onClick={() => setPendingUserDelete(null)} className="flex-1">
                Annuler
              </Button>
              <Button type="button" onClick={() => void executeDeleteUser()} className="flex-1 bg-rose-600 text-white hover:bg-rose-500">
                Révoquer définitivement
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modern Add Employee Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-300">
          <div className="glass-card border border-white/40 rounded-[2.5rem] shadow-2xl max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-300">
            <header className="pharmacy-gradient p-8 text-white relative">
              <button
                onClick={() => setShowModal(false)}
                className="absolute top-6 right-6 h-8 w-8 flex items-center justify-center rounded-full bg-black/10 hover:bg-black/20 text-white transition-colors"
              >
                ✕
              </button>
              <div className="h-14 w-14 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center mb-6">
                <UserPlus className="h-7 w-7" />
              </div>
              <h2 className="text-2xl font-black tracking-tight uppercase">Nouveau Membre</h2>
              <p className="text-white/70 text-xs font-bold uppercase tracking-widest mt-1">Sécurisation des accès officinaux</p>
            </header>

            <form onSubmit={handleAddEmployee} className="p-10 space-y-6 bg-white/80">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">
                  Identifiant Système (ID)
                </label>
                <div className="relative">
                  <Input
                    type="text"
                    placeholder="moussa"
                    value={formData.username}
                    onChange={(e) =>
                      setFormData({ ...formData, username: e.target.value.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() })
                    }
                    disabled={isSubmitting}
                    className="h-12 bg-slate-100 border-slate-200 rounded-xl px-4 text-sm font-bold text-slate-900"
                  />
                  <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none">
                    <span className="text-[10px] font-black text-slate-400">@pharmavault.com</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">
                  Code PIN de Sécurité (6 Chiffres)
                </label>
                <Input
                  type="password"
                  placeholder="••••••"
                  maxLength={6}
                  value={formData.accessCode}
                  onChange={(e) =>
                    setFormData({ ...formData, accessCode: e.target.value.replace(/\D/g, '') })
                  }
                  disabled={isSubmitting}
                  className="h-12 bg-slate-100 border-slate-200 rounded-xl px-4 text-sm font-bold tracking-[0.8em]"
                />
              </div>

              <div className="pt-6 flex flex-col gap-3">
                <Button
                  type="submit"
                  isLoading={isSubmitting}
                  disabled={isSubmitting || !formData.username.trim() || formData.accessCode.length !== 6 || !isOnline}
                  className="h-14 rounded-2xl pharmacy-gradient text-white font-black uppercase tracking-widest shadow-xl shadow-emerald-500/20 border-0"
                >
                  Créer le Membre
                </Button>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  disabled={isSubmitting}
                  className="h-12 rounded-xl text-xs font-black text-slate-400 uppercase tracking-widest hover:text-slate-600 transition-colors"
                >
                  Abandonner
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Personnel;
