import { supabase } from './supabase';

let deleteUserRpcVariant: 'legacy' | 'new' = 'legacy';
let updateRoleRpcVariant: 'legacy' | 'new' = 'legacy';

interface CreateUserParams {
  username: string;
  accessCode: string; // 6-digit PIN
  role: 'administrator' | 'staff';
}

interface UserInfo {
  id: string;
  username: string;
  role: 'administrator' | 'staff';
  created_at: string;
  email: string;
}

/**
 * Create a new user with Name + Access Code (PIN) flow
 * Internal mapping: email = name@pharmavault.com, password = PIN
 */
export async function createUser(params: CreateUserParams): Promise<UserInfo | null> {
  try {
    // Validate 6-digit PIN
    if (!/^\d{6}$/.test(params.accessCode)) {
      throw new Error('Le code d\'accès doit être composé de exactement 6 chiffres.');
    }

    const email = `${params.username.toLowerCase().trim()}@pharmavault.com`;

    // Use standard signup; a DB trigger is responsible for syncing public.user_roles.
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email,
      password: params.accessCode,
      options: {
        data: {
          username: params.username,
          display_name: params.username, // Original display name
          role: params.role,
        },
      },
    });

    if (signUpError) {
      if (signUpError.message.toLowerCase().includes('email')) {
        throw new Error('Format d\'identifiant invalide. Utilisez uniquement des lettres et chiffres.');
      }
      throw signUpError;
    }
    if (!signUpData.user) throw new Error('Échec de la création de l\'utilisateur');

    const user = signUpData.user;

    return {
      id: user.id,
      username: params.username,
      role: params.role,
      created_at: user.created_at,
      email: user.email || email,
    };
  } catch (error) {
    console.error('Error creating user:', error);
    throw error;
  }
}

/**
 * Get all staff members (admin only)
 */
export async function getAllStaff(): Promise<UserInfo[]> {
  try {
    const { data, error } = await supabase.rpc('admin_list_staff');
    if (error) throw error;

    const rows = (data || []) as Array<{
      user_id: string;
      username: string;
      role: 'administrator' | 'staff';
      created_at: string | null;
      email: string | null;
    }>;

    return rows.map((row) => ({
      id: row.user_id,
      username: row.username,
      role: row.role,
      created_at: row.created_at || new Date().toISOString(),
      email: row.email || `${row.username}@pharmavault.com`,
    }));
  } catch (error) {
    console.error('Error fetching staff:', error);
    throw error;
  }
}

/**
 * Reset password for a user (sends email)
 */
export async function resetUserPassword(userId: string, userEmail?: string): Promise<boolean> {
  try {
    const email = userEmail?.trim();
    if (!email) throw new Error('Email utilisateur manquant');

    // Send password recovery email
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error) throw error;

    return true;
  } catch (error) {
    console.error('Error resetting password:', error);
    throw error;
  }
}

/**
 * Remove user from the system.
 * Note: Without a service role key, this only removes the user from the application's
 * user_roles mapping. The Auth account remains in Supabase.
 */
export async function deleteUser(userId: string): Promise<boolean> {
  try {
    if (deleteUserRpcVariant === 'legacy') {
      const attemptLegacy = await supabase.rpc('admin_delete_user_mapping', {
        target_uid: userId,
      });
      if (!attemptLegacy.error) return Boolean(attemptLegacy.data);

      const attemptNew = await supabase.rpc('admin_delete_user_mapping', {
        target_user_id: userId,
      });
      if (attemptNew.error) throw attemptNew.error;
      deleteUserRpcVariant = 'new';
      return Boolean(attemptNew.data);
    }

    const attemptNew = await supabase.rpc('admin_delete_user_mapping', {
      target_user_id: userId,
    });
    if (!attemptNew.error) return Boolean(attemptNew.data);

    const attemptLegacy = await supabase.rpc('admin_delete_user_mapping', {
      target_uid: userId,
    });
    if (attemptLegacy.error) throw attemptLegacy.error;
    deleteUserRpcVariant = 'legacy';
    return Boolean(attemptLegacy.data);
  } catch (error) {
    console.error('Error deleting user mapping:', error);
    throw error;
  }
}

export async function updateUserRole(
  userId: string,
  newRole: 'administrator' | 'staff'
): Promise<boolean> {
  try {
    if (updateRoleRpcVariant === 'legacy') {
      const attemptLegacy = await supabase.rpc('admin_update_user_role', {
        target_uid: userId,
        role_value: newRole,
      });
      if (!attemptLegacy.error) return Boolean(attemptLegacy.data);

      const attemptNew = await supabase.rpc('admin_update_user_role', {
        target_user_id: userId,
        new_role: newRole,
      });
      if (attemptNew.error) throw attemptNew.error;
      updateRoleRpcVariant = 'new';
      return Boolean(attemptNew.data);
    }

    const attemptNew = await supabase.rpc('admin_update_user_role', {
      target_user_id: userId,
      new_role: newRole,
    });
    if (!attemptNew.error) return Boolean(attemptNew.data);

    const attemptLegacy = await supabase.rpc('admin_update_user_role', {
      target_uid: userId,
      role_value: newRole,
    });
    if (attemptLegacy.error) throw attemptLegacy.error;
    updateRoleRpcVariant = 'legacy';
    return Boolean(attemptLegacy.data);
  } catch (error) {
    console.error('Error updating user role:', error);
    throw error;
  }
}
