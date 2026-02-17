import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from '@/components/Sidebar';
import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { DEFAULT_SETTINGS, getSettings, loadSettingsFromDatabase, SETTINGS_UPDATED_EVENT, type AppSettings } from '@/lib/settings';
import { MapPin, Building2, MessageCircleMore } from 'lucide-react';
import { openBizmapSupportChat } from '@/lib/bizmapSupport';

function buildRouteContext(pathname: string): string {
  const labelBySegment: Record<string, string> = {
    dashboard: 'Dashboard',
    transactions: 'Transactions',
    'daily-ledger': 'Journal Quotidien',
    help: 'Aide',
    gardes: 'Gardes',
    depenses: 'Depenses',
    dettes: 'Suivi Dettes',
    assurances: 'Assurances',
    ledger: 'Ledger',
    claims: 'Claims',
    about: 'A Propos',
    'other-apps': 'Ecosysteme',
    solutions: 'Solutions',
    'google-maps': 'Google Maps',
    'custom-apps': 'Apps Sur Mesure',
    safeguard: 'SafeGuard',
    parametres: 'Parametres',
    personnel: 'Personnel',
  };

  const segments = pathname.split('/').filter(Boolean);
  if (segments.length === 0) return 'Dashboard';
  const labels = segments.map((segment) => labelBySegment[segment] || segment);
  return labels.join(' > ');
}

export function DashboardLayout() {
  const { role } = useAuth();
  const location = useLocation();
  const [isSupabaseOnline, setIsSupabaseOnline] = useState<boolean>(true);
  const [settings, setSettings] = useState<AppSettings>(getSettings());
  const isCashier = role?.toLowerCase() === 'cashier';
  const viewParam = new URLSearchParams(location.search).get('view');
  const isCashierTerminalFocus = isCashier && location.pathname === '/dashboard' && viewParam === 'terminal';
  const routeContext = buildRouteContext(location.pathname);

  useEffect(() => {
    let poller: { stop?: () => void } | null = null;
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

  useEffect(() => {
    let mounted = true;
    const loadSettings = async () => {
      try {
        const dbSettings = await loadSettingsFromDatabase();
        if (!mounted) return;
        setSettings(dbSettings);
      } catch {
        if (!mounted) return;
        setSettings(getSettings() || DEFAULT_SETTINGS);
      }
    };
    loadSettings();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const onSettingsUpdated = (event: Event) => {
      const detail = (event as CustomEvent<AppSettings>).detail;
      setSettings(detail || getSettings() || DEFAULT_SETTINGS);
    };
    window.addEventListener(SETTINGS_UPDATED_EVENT, onSettingsUpdated as EventListener);
    return () => {
      window.removeEventListener(SETTINGS_UPDATED_EVENT, onSettingsUpdated as EventListener);
    };
  }, []);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {!isCashierTerminalFocus && <Sidebar />}
      <div className={`flex flex-1 flex-col overflow-hidden ${isCashierTerminalFocus ? 'bg-slate-950' : 'bg-slate-50/50'}`}>
        {/* Global Branding Header */}
        {!isCashierTerminalFocus && (
          <header className="flex h-20 items-center justify-between border-b border-slate-200/60 bg-white/40 backdrop-blur-xl px-8 z-10 transition-all duration-300">
          <div className="flex items-center gap-5">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-sm border border-slate-200 group hover:border-emerald-500/30 transition-all">
              <Building2 className="h-7 w-7 text-emerald-600 group-hover:scale-110 transition-transform" />
            </div>
            <div className="flex flex-col">
              <h2 className="text-base font-extrabold text-slate-800 leading-tight tracking-tight uppercase">
                {settings.pharmacy.name}
              </h2>
              <div className="flex items-center gap-2 text-[11px] font-medium text-slate-500 mt-0.5">
                <MapPin className="h-3 w-3 text-slate-400" strokeWidth={2.5} />
                <span>{settings.pharmacy.address}</span>
              </div>
              <p className="mt-1 text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">
                {routeContext}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {role === 'administrator' && !isSupabaseOnline && (
              <div className="flex items-center gap-2 rounded-xl bg-rose-50 px-4 py-2 text-[10px] font-bold text-rose-600 border border-rose-100 shadow-sm animate-pulse">
                <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                OFFLINE MODE
              </div>
            )}
            <div className={`group relative flex items-center justify-center h-10 w-10 rounded-xl bg-white border border-slate-200 shadow-sm transition-all ${isSupabaseOnline ? 'hover:border-emerald-500/30' : 'hover:border-rose-500/30'}`}>
              <div className={`h-2.5 w-2.5 rounded-full ${isSupabaseOnline ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.4)]' : 'bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.4)] animate-pulse'}`} />
              <div className="absolute top-12 right-0 hidden group-hover:block transition-all opacity-0 group-hover:opacity-100">
                <div className="bg-slate-900 text-white text-[10px] px-3 py-1.5 rounded-lg whitespace-nowrap shadow-xl">
                  Status: {isSupabaseOnline ? 'Serveur Opérationnel' : 'Connexion Perdue'}
                </div>
              </div>
            </div>
          </div>
          </header>
        )}

        <main className="flex-1 overflow-y-auto relative">
          {/* Admin-visible server connectivity banner */}
          {role === 'administrator' && !isSupabaseOnline && (
            <div className="absolute top-0 left-0 right-0 z-20 bg-rose-500/90 backdrop-blur-sm text-white px-6 py-2 text-[10px] uppercase font-bold tracking-[0.2em] text-center shadow-lg transform transition-all animate-in slide-in-from-top duration-300">
              ⚠️ Attention: Synchronisation interrompue • Risque de perte de données
            </div>
          )}
          {isCashierTerminalFocus ? (
            <Outlet />
          ) : (
            <div className="max-w-[1600px] mx-auto">
              <Outlet />
            </div>
          )}

          {!isCashierTerminalFocus && (
            <button
              type="button"
              onClick={openBizmapSupportChat}
              title="Besoin d'aide ? Contactez BIZMAP"
              className="fixed bottom-6 right-6 z-40 group inline-flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500 text-white shadow-xl shadow-emerald-500/30 hover:bg-emerald-600 transition-all"
            >
              <MessageCircleMore className="h-7 w-7" />
              <span className="pointer-events-none absolute right-16 whitespace-nowrap rounded-lg bg-slate-900 px-3 py-1.5 text-[11px] font-bold text-white opacity-0 transition-opacity group-hover:opacity-100">
                Besoin d'aide ? Contactez BIZMAP
              </span>
            </button>
          )}
        </main>
      </div>
    </div>
  );
}

export default DashboardLayout;
