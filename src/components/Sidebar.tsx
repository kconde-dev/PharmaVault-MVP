import { NavLink } from 'react-router-dom';
import React from 'react';
import {
  LayoutDashboard,
  CalendarClock,
  Receipt,
  Building2,
  Settings,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { connectionConfig } from '@/lib/connectionConfig';
import { useConnection } from '@/context/ConnectionContext';

const publicNavItems = [
  { to: '/dashboard', label: 'Tableau de bord', icon: LayoutDashboard },
  { to: '/dashboard/gardes', label: 'Gestion des Gardes', icon: CalendarClock },
  { to: '/dashboard/depenses', label: 'Dépenses', icon: Receipt },
  { to: '/dashboard/assurances', label: 'Suivi des Assurances', icon: Building2 },
  { to: '/dashboard/parametres', label: 'Paramètres', icon: Settings },
] as const;

const adminNavItems = [
  { to: '/dashboard/personnel', label: 'Gestion du Personnel', icon: Users },
] as const;

export function Sidebar() {
  const { role } = useAuth();
  const { isOnline } = useConnection();

  const navItems = [
    ...publicNavItems,
    ...(role === 'administrator' ? adminNavItems : []),
  ];

  return (
    <aside className="flex h-full w-56 flex-col border-r border-border bg-card">
      <div className="flex h-14 items-center justify-between gap-2 border-b border-border px-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/15 text-primary">
            <ShieldCheck className="h-5 w-5" aria-hidden />
          </div>
          <span className="font-semibold tracking-tight text-foreground">PharmaVault</span>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-2 text-xs font-medium rounded px-2 py-1 ${
              isOnline ? connectionConfig.onlineBadgeClasses : connectionConfig.offlineBadgeClasses
            }`}
            title={isOnline ? connectionConfig.tooltipOnline : connectionConfig.tooltipOffline}
          >
            <span className={`h-2 w-2 rounded-full ${isOnline ? connectionConfig.onlineDotClasses : connectionConfig.offlineDotClasses}`} />
            {isOnline ? connectionConfig.connectedText : connectionConfig.offlineText}
          </span>
        </div>
      </div>

      <nav className="flex-1 space-y-0.5 p-3" aria-label="Navigation principale">
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/dashboard'}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-primary/15 text-primary'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`
            }
          >
            <Icon className="h-5 w-5 shrink-0" aria-hidden />
            {label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}

export default Sidebar;
