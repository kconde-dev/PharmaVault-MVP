import React, { useState, useEffect } from 'react';
import { Plus, RotateCcw, Trash2, AlertCircle, Loader } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  role: 'administrator' | 'cashier';
  created_at: string;
  email: string;
}

interface AddEmployeeForm {
  username: string;
  password: string;
  role: 'administrator' | 'cashier';
}

export const Personnel: React.FC = () => {
  const { user, role } = useAuth();
  const { isOnline } = useConnection();
  const [staff, setStaff] = useState<Staff[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<AddEmployeeForm>({
    username: '',
    password: '',
    role: 'cashier',
  });
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Fetch staff list
  const loadStaff = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const staffData = await getAllStaff();
      setStaff(staffData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors du chargement du personnel');
      console.error('Error loading staff:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (role !== 'administrator') {
      setError('Accès réservé aux administrateurs');
      return;
    }
    loadStaff();
  }, [role]);

  const handleAddEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.username.trim() || !formData.password.trim()) {
      setError('Veuillez remplir tous les champs');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    
    try {
      await createUser({
        username: formData.username.toLowerCase().trim(),
        password: formData.password,
        role: formData.role,
      });

      setSuccessMessage(`Employé "${formData.username}" créé avec succès`);
      setFormData({ username: '', password: '', role: 'cashier' });
      setShowModal(false);

      // Reload staff list
      await loadStaff();

      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur lors de la création';
      setError(message);
      console.error('Error creating user:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetPassword = async (userId: string, username: string) => {
    if (!window.confirm(`Êtes-vous sûr de vouloir réinitialiser le mot de passe pour "${username}" ?`)) {
      return;
    }

    try {
      setError(null);
      await resetUserPassword(userId);
      setSuccessMessage(`Email de réinitialisation envoyé à ${username}@pharmavault.local`);
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur lors de la réinitialisation';
      setError(message);
      console.error('Error resetting password:', err);
    }
  };

  const handleDeleteUser = async (userId: string, username: string) => {
    if (!window.confirm(`Êtes-vous sûr de vouloir supprimer l'utilisateur "${username}" ? Cette action est irréversible.`)) {
      return;
    }

    try {
      setError(null);
      await deleteUser(userId);
      setSuccessMessage(`Employé "${username}" supprimé`);
      await loadStaff();
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur lors de la suppression';
      setError(message);
      console.error('Error deleting user:', err);
    }
  };

  const handleChangeRole = async (userId: string, currentRole: string, username: string) => {
    const newRole = currentRole === 'administrator' ? 'cashier' : 'administrator';
    
    if (!window.confirm(`Changer le rôle de "${username}" en "${newRole === 'administrator' ? 'Administrateur' : 'Caissier'}" ?`)) {
      return;
    }

    try {
      setError(null);
      await updateUserRole(userId, newRole as 'administrator' | 'cashier');
      setSuccessMessage(`Rôle mis à jour pour ${username}`);
      await loadStaff();
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur lors de la mise à jour';
      setError(message);
      console.error('Error updating role:', err);
    }
  };

  if (role !== 'administrator') {
    return (
      <div className="flex items-center justify-center min-h-screen px-4">
        <div className="text-center space-y-4">
          <AlertCircle className="h-12 w-12 text-destructive mx-auto" />
          <h1 className="text-xl font-semibold text-foreground">Accès refusé</h1>
          <p className="text-sm text-muted-foreground">
            Cette page est réservée aux administrateurs.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Gestion du Personnel
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Créez et gérez les comptes des collaborateurs
          </p>
        </div>
        <Button
          onClick={() => setShowModal(true)}
          disabled={!isOnline}
          className="inline-flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Ajouter un Employé
        </Button>
      </div>

      {/* Messages */}
      {error && (
        <div className="bg-destructive/15 border border-destructive/50 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
          <div className="text-sm text-destructive">{error}</div>
        </div>
      )}

      {successMessage && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-start gap-3">
          <div className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5 flex items-center justify-center">
            ✓
          </div>
          <div className="text-sm text-green-800">{successMessage}</div>
        </div>
      )}

      {!isOnline && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-amber-800">Connexion perdue. Les fonctionnalités de gestion du personnel sont désactivées pour éviter la perte de données.</div>
        </div>
      )}

      {/* Loading State */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        /* Staff Table */
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          {staff.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <p className="text-sm text-muted-foreground">
                Aucun employé enregistré. Créez un nouveau collaborateur pour commencer.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted/50 border-b border-border">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Nom d'utilisateur
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Rôle
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Date d'ajout
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {staff.map((member) => (
                    <tr key={member.id} className="hover:bg-muted/30 transition">
                      <td className="px-6 py-4">
                        <div>
                          <p className="font-medium text-foreground">{member.username}</p>
                          <p className="text-xs text-muted-foreground">{member.email}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => handleChangeRole(member.id, member.role, member.username)}
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium cursor-pointer hover:opacity-80 transition ${
                            member.role === 'administrator'
                              ? 'bg-purple-100 text-purple-800'
                              : 'bg-blue-100 text-blue-800'
                          }`}
                          title="Cliquez pour changer le rôle"
                        >
                          {member.role === 'administrator' ? '👨‍💼 Admin' : '👤 Caissier'}
                        </button>
                      </td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">
                        {new Date(member.created_at).toLocaleDateString('fr-FR')}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleResetPassword(member.id, member.username)}
                            disabled={!isOnline}
                            className="inline-flex items-center gap-1 rounded px-2.5 py-1.5 text-xs font-medium bg-amber-100 text-amber-800 hover:bg-amber-200 transition disabled:opacity-50 disabled:cursor-not-allowed"
                            title={isOnline ? "Réinitialiser le mot de passe" : "Connexion requise"}
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                            Réinitialiser
                          </button>
                          <button
                            onClick={() => handleDeleteUser(member.id, member.username)}
                            disabled={!isOnline}
                            className="inline-flex items-center gap-1 rounded px-2.5 py-1.5 text-xs font-medium bg-red-100 text-red-800 hover:bg-red-200 transition disabled:opacity-50 disabled:cursor-not-allowed"
                            title={isOnline ? "Supprimer cet utilisateur" : "Connexion requise"}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Supprimer
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Add Employee Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-card border-b border-border px-6 py-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">Ajouter un Employé</h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-muted-foreground hover:text-foreground transition"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddEmployee} className="p-6 space-y-4">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-foreground">
                  Nom d'utilisateur
                </label>
                <Input
                  type="text"
                  placeholder="moussa"
                  value={formData.username}
                  onChange={(e) =>
                    setFormData({ ...formData, username: e.target.value })
                  }
                  disabled={isSubmitting}
                />
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-foreground">
                  Mot de passe
                </label>
                <Input
                  type="password"
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={(e) =>
                    setFormData({ ...formData, password: e.target.value })
                  }
                  disabled={isSubmitting}
                />
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-foreground">
                  Rôle
                </label>
                <select
                  value={formData.role}
                  onChange={(e) =>
                    setFormData({ ...formData, role: e.target.value as 'administrator' | 'cashier' })
                  }
                  disabled={isSubmitting}
                  className="w-full px-3 py-2 bg-background border border-input rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                >
                  <option value="cashier">Caissier</option>
                  <option value="administrator">Administrateur</option>
                </select>
              </div>

              <div className="pt-4 flex gap-3">
                <Button
                  type="submit"
                  isLoading={isSubmitting}
                  disabled={isSubmitting || !formData.username.trim() || !formData.password.trim() || !isOnline}
                  className="flex-1"
                >
                  Créer l'Employé
                </Button>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-2 border border-input rounded-lg text-sm font-medium text-foreground hover:bg-muted transition disabled:opacity-50"
                >
                  Annuler
                </button>
              </div>

              {error && (
                <div className="text-xs text-destructive bg-destructive/10 border border-destructive/30 rounded p-2">
                  {error}
                </div>
              )}

              {!isOnline && (
                <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
                  Connexion perdue. Création d'employé désactivée pour éviter la perte de données.
                </div>
              )}
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Personnel;
