import { supabase } from './supabase';
import { connectionConfig } from './connectionConfig';

/**
 * Lightweight check to verify Supabase connectivity.
 * Uses `supabase.auth.getUser()` which performs a network request to the Supabase API.
 * Returns true if request succeeds within timeout, false otherwise.
 */
export async function checkSupabaseConnection(timeoutMs = connectionConfig.heartbeatTimeout): Promise<boolean> {
  try {
    // First try a lightweight public RPC named `health` if available on the Supabase project.
    // This is more efficient than an auth call when provided by the backend.
    const deadline = Date.now() + timeoutMs;

    try {
      const rpcPromise = supabase.rpc('health');
      const rpcTimeout = new Promise((_, rej) => setTimeout(() => rej(new Error('rpc timeout')), Math.max(1000, timeoutMs)));
      const rpcResp = await Promise.race([rpcPromise, rpcTimeout]) as any;
      // If RPC returns without throwing, assume server is reachable.
      if (rpcResp && (rpcResp.data !== undefined || rpcResp !== null)) return true;
    } catch (rpcErr) {
      // RPC either does not exist or failed; fallback to auth.getUser()
    }

    const controller = new AbortController();
    const remaining = Math.max(1000, deadline - Date.now());
    const id = setTimeout(() => controller.abort(), remaining);

    // supabase.auth.getUser() will fail if network request cannot be made
    const resp = await supabase.auth.getUser({ signal: controller.signal as any });
    clearTimeout(id);

    return typeof resp === 'object';
  } catch (err) {
    return false;
  }
}

/**
 * Hook-style simple wrapper to poll Supabase connectivity. Returns boolean.
 */
export function createHeartbeatPoller(onStatus: (online: boolean) => void) {
  let timer: number | null = null;
  let stopped = false;

  const poll = async () => {
    try {
      const ok = await checkSupabaseConnection();
      onStatus(ok);
    } catch (e) {
      onStatus(false);
    }

    if (stopped) return;
    timer = window.setTimeout(poll, connectionConfig.heartbeatInterval);
  };

  // start
  poll();

  return {
    stop: () => {
      stopped = true;
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    },
  };
}
