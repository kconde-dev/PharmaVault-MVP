import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import React, { useEffect, useState } from 'react';
import {
  LayoutDashboard,
  Receipt,
  Building2,
  CircleHelp,
  Info,
  Grid2x2,
  BookOpenCheck,
  ShieldCheck,
  Settings,
  Users,
  LogOut,
  Wallet,
  ChevronDown,
  CreditCard,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useConnection } from '@/context/ConnectionContext';
import { supabase } from '@/lib/supabase';
import { getSettings, loadSettingsFromDatabase, SETTINGS_UPDATED_EVENT, type AppSettings } from '@/lib/settings';
import { checkSupabaseConnection } from '@/lib/heartbeat';
import { Button } from './ui/button';

type NavItem = {
  to: string;
  label: string;
  tooltip: string;
  icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;
};

export function Sidebar() {
  const { user, role } = useAuth();
  const { isOnline } = useConnection();
  const location = useLocation();
  const navigate = useNavigate();
  const [settings, setSettings] = useState<AppSettings>(getSettings());
  const [systemHealth, setSystemHealth] = useState<'checking' | 'healthy' | 'degraded'>('checking');

  const isAdmin = role?.toLowerCase() === 'admin' || role?.toLowerCase() === 'administrator';
  const isCashier = role?.toLowerCase() === 'cashier';
  const dashboardPath = isCashier ? '/dashboard?view=terminal' : '/dashboard';

  const staffNavItems: NavItem[] = [
    { to: dashboardPath, label: 'Tableau de bord', tooltip: 'Tableau de bord', icon: LayoutDashboard },
    { to: '/dashboard/daily-ledger', label: 'Journal Quotidien', tooltip: 'Journal quotidien', icon: BookOpenCheck },
    ...(isCashier ? [] : [{ to: '/dashboard/help', label: 'Aide', tooltip: 'Centre d’aide', icon: CircleHelp }]),
  ];

  const adminCoreNavItems: NavItem[] = [
    { to: '/dashboard', label: 'Tableau de bord', tooltip: 'Tableau de bord', icon: LayoutDashboard },
    { to: '/dashboard/transactions', label: 'Transactions', tooltip: 'Transactions', icon: Receipt },
    { to: '/dashboard/depenses', label: 'Dépenses', tooltip: 'Gestion des dépenses', icon: Wallet },
    { to: '/dashboard/dettes', label: 'Suivi des Dettes', tooltip: 'Crédits clients', icon: CreditCard },
    { to: '/dashboard/assurances', label: 'Assurances', tooltip: 'Assurances', icon: Building2 },
    { to: '/dashboard/personnel', label: 'Personnel', tooltip: 'Gestion du Personnel', icon: Users },
    { to: '/dashboard/parametres', label: 'Paramètres', tooltip: 'Paramètres Administrateur', icon: Settings },
  ];

  const adminMoreNavItems: NavItem[] = [
    { to: '/dashboard/about', label: 'À Propos', tooltip: 'À Propos', icon: Info },
    { to: '/dashboard/other-apps', label: 'Écosystème BIZMAP', tooltip: 'Marketplace BIZMAP', icon: Grid2x2 },
    { to: '/dashboard/help', label: 'Aide', tooltip: 'Centre d’aide', icon: CircleHelp },
  ];

  const navItems = isAdmin ? adminCoreNavItems : staffNavItems;
  const moreActive = adminMoreNavItems.some((item) => location.pathname === item.to || location.pathname.startsWith(`${item.to}/`));
  const [isMoreOpen, setIsMoreOpen] = useState(moreActive);
  const isMoreExpanded = moreActive || isMoreOpen;

  useEffect(() => {
    let mounted = true;
    const loadSettings = async () => {
      const dbSettings = await loadSettingsFromDatabase();
      if (!mounted) return;
      setSettings(dbSettings);
    };
    loadSettings().catch(() => {
      if (!mounted) return;
      setSettings(getSettings());
    });

    const onSettingsUpdated = (event: Event) => {
      const detail = (event as CustomEvent<AppSettings>).detail;
      setSettings(detail || getSettings());
    };
    window.addEventListener(SETTINGS_UPDATED_EVENT, onSettingsUpdated as EventListener);
    return () => {
      mounted = false;
      window.removeEventListener(SETTINGS_UPDATED_EVENT, onSettingsUpdated as EventListener);
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    let timer: ReturnType<typeof setInterval> | null = null;

    const probeHealth = async () => {
      if (!mounted) return;
      setSystemHealth('checking');

      const [connectionOk, sessionRes, txRes, shiftsRes] = await Promise.allSettled([
        checkSupabaseConnection(),
        supabase.auth.getSession(),
        supabase.from('transactions').select('id').limit(1),
        supabase.from('shifts').select('id').limit(1),
      ]);

      if (!mounted) return;

      const isConnectionOk = connectionOk.status === 'fulfilled' && connectionOk.value === true;
      const isSessionOk = sessionRes.status === 'fulfilled' && !sessionRes.value.error;
      const isTransactionsOk = txRes.status === 'fulfilled' && !txRes.value.error;
      const isShiftsOk = shiftsRes.status === 'fulfilled' && !shiftsRes.value.error;

      setSystemHealth(isConnectionOk && isSessionOk && isTransactionsOk && isShiftsOk ? 'healthy' : 'degraded');
    };

    void probeHealth();
    timer = setInterval(() => {
      void probeHealth();
    }, 30000);

    return () => {
      mounted = false;
      if (timer) clearInterval(timer);
    };
  }, []);

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      navigate('/login');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  return (
    <aside className="flex h-[100vh] w-64 flex-col border-r border-border/50 bg-slate-950 text-slate-300">
      <div className="flex h-20 shrink-0 items-center gap-3 border-b border-slate-800/50 px-5">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl pharmacy-gradient text-white shadow-lg shadow-emerald-500/20">
          <ShieldCheck className="h-6 w-6" aria-hidden />
        </div>
        <div className="flex flex-col">
          <span className="leading-none font-bold tracking-tight text-white">{settings.pharmacy.name}</span>
          <span className="mt-1 text-[9px] font-bold uppercase tracking-widest text-emerald-500">Gestion</span>
        </div>
      </div>

      <div className="sidebar-scrollbar min-h-0 flex-1 overflow-y-auto">
        <nav className="space-y-1 px-3 pb-3 pt-3" aria-label="Navigation principale">
          <p className="mb-2 px-2 text-[9px] font-bold uppercase tracking-[0.14em] text-slate-500">Menu Principal</p>
          {navItems.map(({ to, label, tooltip, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={/^\/dashboard(\?.*)?$/.test(to)}
              title={tooltip}
              className={({ isActive }) =>
                `group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 ${isActive
                  ? 'border border-emerald-500/20 bg-emerald-500/10 text-emerald-400 shadow-inner'
                  : 'text-slate-400 hover:bg-slate-900 hover:text-white'
                }`
              }
            >
              <Icon className={`h-5 w-5 shrink-0 transition-transform group-hover:scale-110 ${to === '/dashboard' ? 'text-emerald-500' : ''}`} aria-hidden />
              {label}
            </NavLink>
          ))}

          {isAdmin && (
            <div className="mt-2">
              <button
                type="button"
                onClick={() => setIsMoreOpen((prev) => !prev)}
                className="flex w-full items-center justify-between rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-white"
              >
                Plus
                <ChevronDown className={`h-4 w-4 transition-transform ${isMoreExpanded ? 'rotate-180' : ''}`} aria-hidden />
              </button>
              {isMoreExpanded && (
                <div className="mt-2 space-y-1">
                  {adminMoreNavItems.map(({ to, label, tooltip, icon: Icon }) => (
                    <NavLink
                      key={to}
                      to={to}
                      title={tooltip}
                      className={({ isActive }) =>
                        `group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
                          isActive
                            ? 'border border-emerald-500/20 bg-emerald-500/10 text-emerald-400 shadow-inner'
                            : 'text-slate-400 hover:bg-slate-900 hover:text-white'
                        }`
                      }
                    >
                      <Icon className="h-5 w-5 shrink-0 transition-transform group-hover:scale-110" aria-hidden />
                      {label}
                    </NavLink>
                  ))}
                </div>
              )}
            </div>
          )}
        </nav>
      </div>

      <div className="mt-auto shrink-0 border-t border-slate-800/50 bg-slate-950/50 px-4 pb-4 pt-3">
        <div className={`mb-3 flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-[9px] font-black uppercase tracking-[0.12em] ${
          systemHealth === 'healthy'
            ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
            : systemHealth === 'degraded'
              ? 'border-rose-500/30 bg-rose-500/10 text-rose-300'
              : 'border-slate-700 bg-slate-900 text-slate-400'
        }`}>
          <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${
            systemHealth === 'healthy'
              ? 'bg-emerald-400'
              : systemHealth === 'degraded'
                ? 'bg-rose-400'
                : 'bg-slate-500'
          }`} />
          <span>
            {systemHealth === 'healthy'
              ? 'Système sain'
              : systemHealth === 'degraded'
                ? 'Système dégradé'
                : 'Vérification système'}
          </span>
        </div>

        <div className="mb-3 flex items-center gap-2.5">
          <div className="relative">
            <div className="flex h-10 w-10 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/20 text-xs font-bold uppercase text-emerald-400 shadow-inner">
              {(user?.user_metadata?.display_name?.charAt(0) || user?.email?.charAt(0)) || 'U'}
            </div>
            <div className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-slate-950 ${isOnline ? 'bg-emerald-500' : 'bg-rose-500'}`} />
          </div>
          <div className="flex flex-col overflow-hidden">
            <span className="truncate text-xs font-semibold text-white">
              {user?.user_metadata?.display_name || user?.email?.split('@')[0] || 'Utilisateur'}
            </span>
            <span className="truncate text-[9px] font-semibold uppercase tracking-[0.08em] text-slate-500">
              {role || 'Session active'}
            </span>
          </div>
        </div>

        <Button
          variant="ghost"
          onClick={handleLogout}
          className="w-full justify-start gap-3 rounded-xl border border-transparent px-3 py-2 text-xs font-semibold text-slate-400 transition-all hover:border-rose-500/20 hover:bg-rose-500/10 hover:text-rose-400"
        >
          <LogOut className="h-4 w-4" aria-hidden />
          <span>Déconnexion</span>
        </Button>
      </div>
    </aside>
  );
}

export default Sidebar;
