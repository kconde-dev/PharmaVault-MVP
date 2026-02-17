/* eslint-disable react-refresh/only-export-components */
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
const LAST_ROLE_STORAGE_KEY = 'pharmavault.last_role';

interface AuthProviderProps {
  children: ReactNode;
}

function isAbortError(err: unknown): boolean {
  return err instanceof Error && err.name === 'AbortError';
}

function isTimeoutError(err: unknown): boolean {
  return err instanceof Error && err.message.toLowerCase().includes('timeout after');
}

function normalizeRole(raw: unknown): 'administrator' | 'cashier' | null {
  const value = String(raw || '').toLowerCase().trim();
  if (value === 'administrator' || value === 'admin') return 'administrator';
  if (value === 'cashier' || value === 'staff') return 'cashier';
  return null;
}

function readCachedRole(): 'administrator' | 'cashier' | null {
  if (typeof window === 'undefined') return null;
  return normalizeRole(window.localStorage.getItem(LAST_ROLE_STORAGE_KEY));
}

function persistRole(role: 'administrator' | 'cashier'): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(LAST_ROLE_STORAGE_KEY, role);
}

function withTimeout<T>(promise: PromiseLike<T>, timeoutMs: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      reject(new Error(`${label} timeout after ${timeoutMs}ms`));
    }, timeoutMs);

    Promise.resolve(promise)
      .then((value) => {
        window.clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        window.clearTimeout(timer);
        reject(error);
      });
  });
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
    let isBootstrapping = true;
    let roleRequestSeq = 0;
    const fetchRole = async (authUser: User) => {
      const cachedRole = readCachedRole();
      const emailLocalPart = String(authUser.email || '').split('@')[0]?.toLowerCase().trim();
      try {
        const { data, error: profileError } = await withTimeout(
          supabase
            .from('profiles')
            .select('role')
            .eq('id', authUser.id)
            .maybeSingle(),
          2500,
          'profile role lookup'
        );

        if (profileError) {
          // Graceful fallback to cashier when role lookup is unavailable.
          if (cachedRole) return cachedRole;
          return emailLocalPart === 'admin' ? 'administrator' : 'cashier';
        }
        const profileRole = normalizeRole(data?.role);
        if (profileRole) {
          persistRole(profileRole);
          return profileRole;
        }
        if (cachedRole) return cachedRole;
        return emailLocalPart === 'admin' ? 'administrator' : 'cashier';
      } catch (err) {
        if (!isAbortError(err) && !isTimeoutError(err)) {
          console.error('Error fetching role from profiles:', err);
        }
        if (cachedRole) return cachedRole;
        return emailLocalPart === 'admin' ? 'administrator' : 'cashier';
      }
    };

    const syncAuthUser = async (authUser: User | null) => {
      setUser(authUser);

      if (!authUser) {
        setRole(null);
        setError(null);
        setLoading(false);
        return;
      }

      const requestSeq = ++roleRequestSeq;
      const userRole = await fetchRole(authUser);

      if (!mounted || requestSeq !== roleRequestSeq) {
        return;
      }

      setRole(userRole);
      setError(null);
      setLoading(false);
    };

    const initializeAuth = async () => {
      try {
        setLoading(true);
        // getSession is faster and less likely to trigger AbortErrors than getUser for initial state
        const { data: { session } } = await withTimeout(
          supabase.auth.getSession(),
          3000,
          'auth session lookup'
        );

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
          setUser(null);
          setRole(null);
          setLoading(false);
        }
      } finally {
        isBootstrapping = false;
      }
    };

    initializeAuth();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;
      if (event === 'INITIAL_SESSION' && isBootstrapping) return;

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
