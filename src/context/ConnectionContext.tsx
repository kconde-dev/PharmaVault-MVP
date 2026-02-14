import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

type ConnectionContextValue = {
  isOnline: boolean;
};

const ConnectionContext = createContext<ConnectionContextValue | undefined>(undefined);

/**
 * Lightweight health check against the health_check table.
 * This is a simple read query that validates Supabase connectivity.
 */
async function checkHealth(): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('health_check')
      .select('id')
      .limit(1)
      .maybeSingle();

    if (error) {
      console.warn('[ConnectionContext] Health check failed:', error.message);
      return false;
    }

    // If we received a response object (even if empty), the connection worked
    return true;
  } catch (err) {
    console.warn('[ConnectionContext] Health check threw:', err);
    return false;
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

    // poll every 30s
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
