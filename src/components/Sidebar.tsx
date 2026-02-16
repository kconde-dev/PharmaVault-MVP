import { NavLink, useNavigate } from 'react-router-dom';
import React, { useEffect, useState } from 'react';
import {
  LayoutDashboard,
  Receipt,
  Building2,
  CircleHelp,
  Info,
  Grid2x2,
  BrainCircuit,
  BookOpenCheck,
  ShieldCheck,
  Settings,
  Users,
  LogOut,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useConnection } from '@/context/ConnectionContext';
import { supabase } from '@/lib/supabase';
import { getSettings, loadSettingsFromDatabase, SETTINGS_UPDATED_EVENT, type AppSettings } from '@/lib/settings';
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
  const navigate = useNavigate();
  const [settings, setSettings] = useState<AppSettings>(getSettings());

  const isAdmin = role?.toLowerCase() === 'admin' || role?.toLowerCase() === 'administrator';

  const staffNavItems: NavItem[] = [
    { to: '/dashboard', label: 'Tableau de bord', tooltip: 'Tableau de bord', icon: LayoutDashboard },
    { to: '/dashboard/daily-ledger', label: 'Journal Quotidien', tooltip: 'Journal quotidien', icon: BookOpenCheck },
    { to: '/dashboard/help', label: 'Aide', tooltip: 'Centre d’aide', icon: CircleHelp },
    { to: '/dashboard/intelligence', label: 'Intelligence', tooltip: 'Analyse IA Inventaire', icon: BrainCircuit },
  ];

  const adminNavItems: NavItem[] = [
    { to: '/dashboard', label: 'Tableau de bord', tooltip: 'Tableau de bord', icon: LayoutDashboard },
    { to: '/dashboard/transactions', label: 'Transactions', tooltip: 'Transactions', icon: Receipt },
    { to: '/dashboard/assurances', label: 'Assurances', tooltip: 'Assurances', icon: Building2 },
    { to: '/dashboard/personnel', label: 'Personnel', tooltip: 'Gestion du Personnel', icon: Users },
    { to: '/dashboard/about', label: 'À Propos', tooltip: 'À Propos', icon: Info },
    { to: '/dashboard/other-apps', label: 'Écosystème BIZMAP', tooltip: 'Marketplace BIZMAP', icon: Grid2x2 },
    { to: '/dashboard/intelligence', label: 'Intelligence', tooltip: 'Analyse IA Inventaire', icon: BrainCircuit },
    { to: '/dashboard/help', label: 'Aide', tooltip: 'Centre d’aide', icon: CircleHelp },
    { to: '/dashboard/parametres', label: 'Paramètres', tooltip: 'Paramètres Administrateur', icon: Settings },
  ];

  const navItems = isAdmin ? adminNavItems : staffNavItems;

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

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      navigate('/login');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  return (
    <aside className="flex h-full w-64 flex-col border-r border-border/50 bg-slate-950 text-slate-300">
      <div className="flex h-20 items-center gap-3 px-6 border-b border-slate-800/50">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl pharmacy-gradient text-white shadow-lg shadow-emerald-500/20">
          <ShieldCheck className="h-6 w-6" aria-hidden />
        </div>
        <div className="flex flex-col">
          <span className="font-bold tracking-tight text-white leading-none">{settings.pharmacy.name}</span>
          <span className="text-[10px] text-emerald-500 font-bold uppercase tracking-widest mt-1">Gestion</span>
        </div>
      </div>

      <nav className="flex-1 space-y-1 p-4 mt-4" aria-label="Navigation principale">
        <p className="px-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Menu Principal</p>
        {navItems.map(({ to, label, tooltip, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/dashboard'}
            title={tooltip}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200 group ${isActive
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-inner'
                : 'text-slate-400 hover:bg-slate-900 hover:text-white'
              }`
            }
          >
            <Icon className={`h-5 w-5 shrink-0 transition-transform group-hover:scale-110 ${to === '/dashboard' ? 'text-emerald-500' : ''}`} aria-hidden />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="mt-auto border-t border-slate-800/50 p-6 bg-slate-950/50">
        <div className="mb-6 flex items-center gap-3">
          <div className="relative">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 font-bold text-xs uppercase shadow-inner">
              {(user?.user_metadata?.display_name?.charAt(0) || user?.email?.charAt(0)) || 'U'}
            </div>
            <div className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-slate-950 ${isOnline ? 'bg-emerald-500' : 'bg-rose-500'}`} />
          </div>
          <div className="flex flex-col overflow-hidden">
            <span className="truncate text-xs font-semibold text-white">
              {user?.user_metadata?.display_name || user?.email?.split('@')[0] || 'Utilisateur'}
            </span>
            <span className="truncate text-[10px] text-slate-500 font-medium capitalize">
              {role || 'Session active'}
            </span>
          </div>
        </div>
        <Button
          variant="ghost"
          onClick={handleLogout}
          className="w-full justify-start gap-3 px-4 py-2 text-xs font-semibold text-slate-400 hover:bg-rose-500/10 hover:text-rose-400 rounded-xl border border-transparent hover:border-rose-500/20 transition-all"
        >
          <LogOut className="h-4 w-4" aria-hidden />
          <span>Déconnexion</span>
        </Button>
      </div>
    </aside>
  );
}

export default Sidebar;
