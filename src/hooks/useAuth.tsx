import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

export type UserRole = 'administrator' | string;

export interface UseAuthResult {
  user: User | null;
  role: UserRole | null;
  loading: boolean;
  error: Error | null;
}

const AuthContext = createContext<UseAuthResult | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

function isAbortError(err: unknown): boolean {
  return err instanceof Error && err.name === 'AbortError';
}

/**
 * Global auth provider (single source of truth for auth/user role state).
 */
export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let mounted = true;
    let roleRequestSeq = 0;
    const ADMIN_EMAIL = 'admin@pharmavault.com';

    const getRoleFromMetadata = (authUser: User): UserRole | null => {
      const email = String(authUser.email || '').toLowerCase().trim();
      if (email === ADMIN_EMAIL) {
        return 'administrator';
      }

      const roleCandidate = String(
        authUser.user_metadata?.role ??
        authUser.app_metadata?.role ??
        ''
      ).toLowerCase();

      if (roleCandidate === 'administrator' || roleCandidate === 'admin') {
        return 'administrator';
      }
      if (roleCandidate === 'staff') {
        return 'staff';
      }
      return null;
    };

    const fetchRole = async (authUser: User) => {
      try {
        const roleFromMetadata = getRoleFromMetadata(authUser);
        if (roleFromMetadata) {
          return roleFromMetadata;
        }
        return 'staff';
      } catch (err) {
        if (!isAbortError(err)) {
          console.error('Error fetching role:', err);
        }
        return 'staff';
      }
    };

    const syncAuthUser = async (authUser: User | null) => {
      setUser(authUser);

      if (!authUser) {
        setRole(null);
        setLoading(false);
        return;
      }

      const requestSeq = ++roleRequestSeq;
      const userRole = await fetchRole(authUser);

      if (!mounted || requestSeq !== roleRequestSeq) {
        return;
      }

      setRole(userRole);
      setLoading(false);
    };

    const initializeAuth = async () => {
      try {
        setLoading(true);
        // getSession is faster and less likely to trigger AbortErrors than getUser for initial state
        const { data: { session } } = await supabase.auth.getSession();

        if (!mounted) return;

        await syncAuthUser(session?.user ?? null);
      } catch (err) {
        if (isAbortError(err)) {
          // Expected during effect teardown in React StrictMode.
          return;
        }

        console.error('Auth initialization error:', err);
        if (mounted) {
          setError(err instanceof Error ? err : new Error(String(err)));
          setLoading(false);
        }
      }
    };

    initializeAuth();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;

      const authUser = session?.user ?? null;

      try {
        if (
          event === 'SIGNED_IN' ||
          event === 'USER_UPDATED' ||
          event === 'INITIAL_SESSION' ||
          event === 'TOKEN_REFRESHED'
        ) {
          setLoading(true);
          await syncAuthUser(authUser);
        } else if (event === 'SIGNED_OUT') {
          setUser(null);
          setRole(null);
          setLoading(false);
        }
      } catch (err) {
        if (!isAbortError(err)) {
          console.error('Auth state sync error:', err);
        }
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const value = useMemo(
    () => ({ user, role, loading, error }),
    [user, role, loading, error]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): UseAuthResult {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  return context;
}

export default useAuth;
