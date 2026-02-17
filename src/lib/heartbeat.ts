import { connectionConfig } from './connectionConfig';
import { supabase } from './supabase';

/**
 * Lightweight check to verify Supabase connectivity.
 * Returns true if request succeeds within timeout, false otherwise.
 */
export async function checkSupabaseConnection(timeoutMs: number = connectionConfig.heartbeatTimeout): Promise<boolean> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const { error } = await supabase
      .from('transactions')
      .select('id', { head: true, count: 'exact' })
      .limit(1)
      .abortSignal(controller.signal);
    return !error;
  } catch {
    return false;
  } finally {
    window.clearTimeout(timeout);
  }
}

/**
 * Hook-style simple wrapper to poll Supabase connectivity.
 */
export function createHeartbeatPoller(onStatus: (online: boolean) => void) {
  let stopped = false;
  let timer: ReturnType<typeof setInterval> | null = null;

  const probe = async () => {
    const isOnline = await checkSupabaseConnection();
    if (stopped) return;
    onStatus(isOnline);
  };

  void probe();
  timer = window.setInterval(() => {
    void probe();
  }, connectionConfig.heartbeatInterval);

  return {
    stop: () => {
      stopped = true;
      if (timer) {
        window.clearInterval(timer);
      }
    },
  };
}
