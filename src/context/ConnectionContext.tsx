/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useEffect, useState } from 'react';
import { checkSupabaseConnection } from '@/lib/heartbeat';

type ConnectionContextValue = {
  isOnline: boolean;
};

const ConnectionContext = createContext<ConnectionContextValue | undefined>(undefined);

function isAbortError(err: unknown): boolean {
  return err instanceof Error && err.name === 'AbortError';
}

async function checkHealth(): Promise<boolean> {
  try {
    // Uses the shared heartbeat adapter (currently non-blocking/no-db probe).
    return await checkSupabaseConnection();
  } catch (err) {
    if (isAbortError(err)) {
      return typeof navigator !== 'undefined' ? navigator.onLine : false;
    }
    // Do not spam console on transient network/runtime failures.
    return typeof navigator !== 'undefined' ? navigator.onLine : false;
  }
}

export const ConnectionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isOnline, setIsOnline] = useState<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true);

  useEffect(() => {
    let mounted = true;

    const checkOnce = async () => {
      const healthy = await checkHealth();
      if (!mounted) return;
      setIsOnline(healthy);
    };

    // initial check
    checkOnce();

    // Poll occasionally to resync the badge state.
    const interval = window.setInterval(checkOnce, 30000);

    const handleOnline = () => {
      // immediate re-check when browser regains connectivity
      checkOnce();
    };
    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      mounted = false;
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, []);

  return <ConnectionContext.Provider value={{ isOnline }}>{children}</ConnectionContext.Provider>;
};

export function useConnection() {
  const ctx = useContext(ConnectionContext);
  if (!ctx) throw new Error('useConnection must be used within a ConnectionProvider');
  return ctx;
}
