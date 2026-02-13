import { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

export type UserRole = 'administrator' | string;

export interface UseAuthResult {
  user: User | null;
  role: UserRole | null;
  loading: boolean;
  error: Error | null;
}

/**
 * Fetches the current user and their role from public.user_roles.
 * Role is read from the row where user_id = auth user id (e.g. 'administrator').
 */
export function useAuth(): UseAuthResult {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      try {
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (!mounted) return;
        setUser(authUser ?? null);

        if (!authUser) {
          setRole(null);
          setLoading(false);
          return;
        }

        const { data: roleRow, error: roleError } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', authUser.id)
          .maybeSingle();

        if (!mounted) return;
        if (roleError) {
          setError(roleError);
          setRole(null);
        } else {
          setRole(roleRow?.role ?? null);
        }
      } catch (err) {
        if (mounted) setError(err instanceof Error ? err : new Error(String(err)));
      } finally {
        if (mounted) setLoading(false);
      }
    };

    init();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const authUser = session?.user ?? null;
      if (!mounted) return;
      setUser(authUser);

      if (!authUser) {
        setRole(null);
        return;
      }

      const { data: roleRow, error: roleError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', authUser.id)
        .maybeSingle();

      if (!mounted) return;
      if (!roleError) setRole(roleRow?.role ?? null);
      else setRole(null);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  return { user, role, loading, error };
}

export default useAuth;
