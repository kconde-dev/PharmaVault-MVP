import { supabase } from './supabase';

interface CreateUserParams {
  username: string;
  password: string;
  role: 'administrator' | 'cashier';
}

interface UserInfo {
  id: string;
  username: string;
  role: 'administrator' | 'cashier';
  created_at: string;
  email: string;
}

/**
 * Create a new user with username-based authentication
 * This requires the VITE_SUPABASE_SERVICE_ROLE_KEY to be set
 * Note: For frontend, this function attempts to use the Supabase REST API
 */
export async function createUser(params: CreateUserParams): Promise<UserInfo | null> {
  try {
    const serviceRoleKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
    
    if (!serviceRoleKey) {
      console.warn('VITE_SUPABASE_SERVICE_ROLE_KEY is not configured. User creation via UI is disabled.');
      throw new Error(
        'Service role key not configured. ' +
        'Add VITE_SUPABASE_SERVICE_ROLE_KEY to your .env file for user management.'
      );
    }

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const email = `${params.username}@pharmavault.local`;

    // Use Supabase Admin API via REST endpoint
    const response = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${serviceRoleKey}`,
        apikey: serviceRoleKey,
      },
      body: JSON.stringify({
        email,
        password: params.password,
        email_confirm: true,
        user_metadata: {
          username: params.username,
        },
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.msg || error.message || 'Failed to create user');
    }

    const { user } = await response.json();

    // Add user to user_roles table
    const { error: roleError } = await supabase
      .from('user_roles')
      .insert([
        {
          user_id: user.id,
          role: params.role,
          username: params.username,
          created_at: new Date().toISOString(),
        },
      ]);

    if (roleError) {
      console.warn('VITE_SUPABASE_SERVICE_ROLE_KEY is not configured. Cannot perform rollback deletion of created user.');
      throw roleError;
    }

    return {
      id: user.id,
      username: params.username,
      role: params.role,
      created_at: user.created_at,
      email: user.email,
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
    const { data, error } = await supabase
      .from('user_roles')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Fetch user details from auth to get email
    const staffWithEmails: UserInfo[] = data.map((record: any) => ({
      id: record.user_id,
      username: record.username,
      role: record.role,
      created_at: record.created_at,
      email: `${record.username}@pharmavault.local`,
    }));

    return staffWithEmails;
  } catch (error) {
    console.error('Error fetching staff:', error);
    return [];
  }
}

/**
 * Reset password for a user (admin only)
 */
export async function resetUserPassword(userId: string): Promise<boolean> {
  try {
    const serviceRoleKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
    
    if (!serviceRoleKey) {
      console.warn('VITE_SUPABASE_SERVICE_ROLE_KEY is not configured. Password reset via UI is disabled.');
      throw new Error(
        'Service role key not configured. ' +
        'Add VITE_SUPABASE_SERVICE_ROLE_KEY to your .env file for password reset.'
      );
    }

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const { data: userData } = await supabase
      .from('user_roles')
      .select('username')
      .eq('user_id', userId)
      .single();

    if (!userData) {
      throw new Error('User not found');
    }

    const email = `${userData.username}@pharmavault.local`;

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
 * Delete a user and remove from user_roles (admin only)
 */
export async function deleteUser(userId: string): Promise<boolean> {
  try {
    const serviceRoleKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
    
    if (!serviceRoleKey) {
      console.warn('VITE_SUPABASE_SERVICE_ROLE_KEY is not configured. User deletion via UI is disabled.');
      throw new Error(
        'Service role key not configured. ' +
        'Add VITE_SUPABASE_SERVICE_ROLE_KEY to your .env file for user deletion.'
      );
    }

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

    // Delete from user_roles first
    const { error: roleError } = await supabase
      .from('user_roles')
      .delete()
      .eq('user_id', userId);

    if (roleError) throw roleError;

    // Delete from auth
    const response = await fetch(`${supabaseUrl}/auth/v1/admin/users/${userId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${serviceRoleKey}`,
        apikey: serviceRoleKey,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.msg || error.message || 'Failed to delete user');
    }

    return true;
  } catch (error) {
    console.error('Error deleting user:', error);
    throw error;
  }
}

/**
 * Update user role (admin only)
 */
export async function updateUserRole(
  userId: string,
  newRole: 'administrator' | 'cashier'
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('user_roles')
      .update({ role: newRole })
      .eq('user_id', userId);

    if (error) throw error;

    return true;
  } catch (error) {
    console.error('Error updating user role:', error);
    throw error;
  }
}
