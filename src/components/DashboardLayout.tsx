import { Outlet } from 'react-router-dom';
import { Sidebar } from '@/components/Sidebar';
import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';

export function DashboardLayout() {
  const { role } = useAuth();
  const [isSupabaseOnline, setIsSupabaseOnline] = useState<boolean>(true);

  useEffect(() => {
    let poller: any = null;
    (async () => {
      const { createHeartbeatPoller } = await import('@/lib/heartbeat');
      poller = createHeartbeatPoller((status: boolean) => {
        setIsSupabaseOnline(status);
      });
    })();

    return () => {
      if (poller && typeof poller.stop === 'function') poller.stop();
    };
  }, []);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        {/* Admin-visible server connectivity banner */}
        {role === 'administrator' && !isSupabaseOnline && (
          <div className="bg-amber-50 border-b border-amber-200 text-amber-800 px-6 py-3 text-sm">
            ⚠️ Problème de connexion au serveur Supabase. Certaines fonctionnalités (création d'utilisateurs, synchronisation) peuvent être limitées. Vérifiez l'accès réseau.
          </div>
        )}
        <Outlet />
      </main>
    </div>
  );
}

export default DashboardLayout;
