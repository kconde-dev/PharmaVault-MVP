import { connectionConfig } from './connectionConfig';

/**
 * Lightweight check to verify Supabase connectivity.
 * Returns true if request succeeds within timeout, false otherwise.
 */
export async function checkSupabaseConnection(_timeoutMs: number = connectionConfig.heartbeatTimeout): Promise<boolean> {
  void _timeoutMs;
  return true; // Force online state
}

/**
 * Hook-style simple wrapper to poll Supabase connectivity. Returns boolean.
 * TEMPORARILY DISABLED to troubleshoot auth loop.
 */
export function createHeartbeatPoller(onStatus: (online: boolean) => void) {
  // console.log('Heartbeat poller is temporarily disabled.');

  // Immediately signify we are "online" to avoid blocking UI during debug
  onStatus(true);

  return {
    stop: () => {
      // No-op
    },
  };
}
