import React, { useState, useEffect } from 'react';
import { useAuth } from './auth/AuthContext';
import { AuthScreen } from './screens/AuthScreen';
import { DashboardScreen } from './screens/DashboardScreen';
import { HealthScreen } from './screens/HealthScreen';
import { ClientsScreen } from './screens/ClientsScreen';
import { ClientDetailScreen } from './screens/ClientDetailScreen';
import { ReportsScreen } from './screens/ReportsScreen';
import { OnboardingScreen } from './screens/OnboardingScreen';
import { OnboardWizard } from './screens/OnboardWizard';
import { BillingScreen } from './screens/BillingScreen';
import { TeamScreen } from './screens/TeamScreen';
import { IdentityScreen } from './screens/IdentityScreen';
import { SupportScreen } from './screens/SupportScreen';
import { ProfileScreen } from './screens/ProfileScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { Icon, IconComponent } from './lib/icons';
import { Menu, MenuItem, Avatar, NavCtx, Forbidden } from './components';
import { ErrorBoundary } from './components/ErrorBoundary';
import { NotificationsBell } from './components/NotificationsBell';
import { ROLES } from './auth/rbac';

/* ---- nav structure (ported from app.jsx) ---- */
type NavItem = { key: string; label: string; icon: IconComponent; perm: string; route: string; match?: string[]; color: string };
type NavGroup = { group: string; items: NavItem[] };

const NAV: NavGroup[] = [
  { group: 'Overview', items: [
    { key: 'dashboard', label: 'Dashboard', icon: Icon.dashboard, perm: 'dashboard.view', route: 'dashboard', color: 'var(--accent)' },
  ] },
  { group: 'Clients', items: [
    { key: 'clients', label: 'Clients', icon: Icon.building, perm: 'clients.view', route: 'clients', match: ['clients', 'client', 'onboard'], color: 'var(--blue)' },
    { key: 'onboarding', label: 'Onboarding', icon: Icon.onboard, perm: 'onboarding.view', route: 'onboarding', color: 'var(--blue)' },
  ] },
  { group: 'Revenue', items: [
    { key: 'plans', label: 'Plans', icon: Icon.plans, perm: 'plans.view', route: 'plans', color: 'var(--green)' },
    { key: 'billing', label: 'Billing', icon: Icon.billing, perm: 'billing.view', route: 'billing', match: ['billing'], color: 'var(--green)' },
    { key: 'reports', label: 'Reports', icon: Icon.reports, perm: 'reports.view', route: 'reports', color: 'var(--violet)' },
  ] },
  { group: 'Operations', items: [
    { key: 'support', label: 'Support', icon: Icon.support, perm: 'support.view', route: 'support', match: ['support', 'health'], color: 'var(--amber)' },
  ] },
  { group: 'Admin', items: [
    { key: 'identity', label: 'Identity & Access', icon: Icon.shield, perm: 'identity.view', route: 'identity', color: 'var(--violet)' },
    { key: 'team', label: 'Team', icon: Icon.team, perm: 'team.view', route: 'team', color: 'var(--violet)' },
    { key: 'settings', label: 'Settings', icon: Icon.settings, perm: 'settings.view', route: 'settings', color: 'var(--slate)' },
  ] },
];

const ROUTE_PERM: Record<string, string> = {
  dashboard: 'dashboard.view', clients: 'clients.view', client: 'clients.view', onboard: 'clients.view',
  onboarding: 'onboarding.view', billing: 'billing.view', plans: 'plans.view', reports: 'reports.view',
  support: 'support.view', health: 'support.view', team: 'team.view', settings: 'settings.view',
  identity: 'identity.view',
};

const CRUMB: Record<string, string[]> = {
  dashboard: ['Dashboard'], clients: ['Clients'], client: ['Clients', 'Detail'], onboard: ['Clients', 'Onboard'],
  onboarding: ['Onboarding'], billing: ['Billing'], plans: ['Plans'], reports: ['Reports'], support: ['Support'],
  health: ['Support', 'System health'], team: ['Team'], settings: ['Settings'],
  identity: ['Identity & Access'], profile: ['My profile'],
};

type Route = { name: string; params: Record<string, unknown> };
type Theme = 'dark' | 'light';

/* Between the drawer breakpoint and this width the rail is the only sidebar that
   leaves the content a usable column, so the shell collapses itself. Above it the
   choice is the operator's. Keep in sync with the 1100px drawer breakpoint in styles.css. */
const AUTO_COLLAPSE = '(max-width: 1319px)';

function useAutoCollapse(setCollapsed: (v: boolean) => void) {
  useEffect(() => {
    const mq = window.matchMedia(AUTO_COLLAPSE);
    const apply = (matches: boolean) => setCollapsed(matches);
    apply(mq.matches);
    const onChange = (e: MediaQueryListEvent) => apply(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [setCollapsed]);
}

export function App() {
  const { status, role, can, signOut, user } = useAuth();
  // Light by default. Key renamed from 'sm_theme', which the old dark default auto-saved for everyone.
  const [theme, setTheme] = useState<Theme>(() => (localStorage.getItem('catre_theme') as Theme) || 'light');
  const [route, setRoute] = useState<Route>({ name: 'dashboard', params: {} });
  const [collapsed, setCollapsed] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  useAutoCollapse(setCollapsed);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('catre_theme', theme);
  }, [theme]);

  // if role loses access to current route, bounce to dashboard
  useEffect(() => {
    const perm = ROUTE_PERM[route.name];
    if (perm && role && !can(perm)) setRoute({ name: 'dashboard', params: {} });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role]);

  if (status === 'loading') {
    return <div className="muted" style={{ display: 'grid', placeItems: 'center', minHeight: '100vh' }}>Loading…</div>;
  }
  if (status === 'anon' || !role) return <AuthScreen />;

  const go = (name: string, params: Record<string, unknown> = {}) => {
    setRoute({ name, params });
    setMobileNav(false);
    const content = document.querySelector('.content');
    if (content) content.scrollTop = 0;
  };

  const roleInfo = ROLES[role];
  const userLabel = user?.id ?? role;

  const renderScreen = () => {
    const perm = ROUTE_PERM[route.name];
    if (perm && !can(perm)) return <Forbidden action={perm} />;
    switch (route.name) {
      case 'dashboard': return <DashboardScreen />;
      case 'health':    return <HealthScreen />;
      case 'clients':   return <ClientsScreen />;
      case 'client':    return <ClientDetailScreen />;
      case 'reports':   return <ReportsScreen />;
      case 'onboarding': return <OnboardingScreen />;
      case 'onboard':   return <OnboardWizard />;
      case 'plans':     return <BillingScreen plansOnly />;
      case 'billing':   return <BillingScreen />;
      case 'team':      return <TeamScreen />;
      case 'identity':  return <IdentityScreen />;
      case 'support':   return <SupportScreen />;
      case 'profile':   return <ProfileScreen />;
      case 'settings':  return <SettingsScreen theme={theme} setTheme={setTheme} />;
      default: {
        const title = (CRUMB[route.name] || [route.name]).join(' / ');
        return (
          <div className="page">
            <h1 style={{ fontSize: 22, fontWeight: 700 }}>{title}</h1>
            <p className="muted" style={{ marginTop: 8 }}>This screen is bound in a later sub-project.</p>
          </div>
        );
      }
    }
  };

  const isActive = (item: NavItem) => (item.match || [item.route]).includes(route.name);
  const crumbs = CRUMB[route.name] || ['Dashboard'];

  return (
    <NavCtx.Provider value={{ route, go }}>
      <div className="app">
        {mobileNav && <div className="scrim" onClick={() => setMobileNav(false)} />}

        {/* ---- Sidebar ---- */}
        <aside className={'sidebar' + (collapsed ? ' collapsed' : '') + (mobileNav ? ' open' : '')}>
          <div className="brand">
            <img className="brand-logo" src="/catre-emblem.png" alt="Catre" width={32} height={32} />
            {!collapsed && (
              <div style={{ minWidth: 0 }}>
                <div className="brand-name">Catre</div>
                <div className="brand-sub">Technology</div>
              </div>
            )}
          </div>
          <nav className="nav">
            {NAV.map(grp => {
              const items = grp.items.filter(it => can(it.perm));
              if (items.length === 0) return null;
              return (
                <div key={grp.group}>
                  {!collapsed && <div className="nav-group-label">{grp.group}</div>}
                  {items.map(it => (
                    <button
                      key={it.key}
                      className={'nav-item' + (isActive(it) ? ' active' : '')}
                      onClick={() => go(it.route)}
                      title={collapsed ? it.label : undefined}
                    >
                      <it.icon size={17} style={{ color: it.color }} />
                      <span className="nav-item-label">{it.label}</span>
                    </button>
                  ))}
                </div>
              );
            })}
          </nav>
          <div className="sidebar-foot">
            <button className="nav-item" onClick={() => setCollapsed(c => !c)} title="Collapse">
              <Icon.panelLeft size={17} />
              {!collapsed && <span className="nav-item-label">Collapse</span>}
            </button>
          </div>
        </aside>

        <div className="main">
          {/* ---- Topbar (role switcher removed) ---- */}
          <header className="topbar">
            <button className="btn btn-ghost btn-icon mobile-only" onClick={() => setMobileNav(true)}>
              <Icon.menu size={18} />
            </button>
            <div className="crumbs" aria-label="Breadcrumb">
              {crumbs.map((c, i) => (
                <span key={i} className="row gap6">
                  {i > 0 && <span className="sep"><Icon.chevRight size={13} /></span>}
                  {i === crumbs.length - 1 ? <b>{c}</b> : <span>{c}</span>}
                </span>
              ))}
            </div>
            <div className="topbar-spacer" />
            <div className="search-box">
              <Icon.search size={15} />
              <input placeholder="Search…" />
              <span className="kbd">⌘K</span>
            </div>

            <button
              className="btn btn-ghost btn-icon"
              onClick={() => setTheme(t => (t === 'dark' ? 'light' : 'dark'))}
              title="Toggle theme"
            >
              {React.createElement(theme === 'dark' ? Icon.sun : Icon.moon, { size: 17 })}
            </button>

            <NotificationsBell />

            {/* ---- account menu ---- */}
            <Menu
              width={230}
              trigger={
                <button className="row gap8" style={{ padding: '4px 4px 4px 8px', borderRadius: 9 }}>
                  <Avatar name={roleInfo.name} size={30} />
                  <Icon.chevDown size={14} style={{ color: 'var(--text-3)' }} />
                </button>
              }
            >
              <div style={{ padding: '8px 10px 10px' }}>
                <div className="row gap10">
                  <Avatar name={roleInfo.name} size={34} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 650, fontSize: 13 }}>{roleInfo.name}</div>
                    <div className="tiny muted truncate">{userLabel}</div>
                  </div>
                </div>
                <span className="role-badge" style={{ marginTop: 10, display: 'inline-block', background: roleInfo.color + '22', color: roleInfo.color }}>{roleInfo.name}</span>
              </div>
              <div className="menu-sep" />
              <MenuItem icon={Icon.user} onClick={() => go('profile')}>My profile</MenuItem>
              {can('settings.view') && <MenuItem icon={Icon.settings} onClick={() => go('settings')}>Settings</MenuItem>}
              <MenuItem
                icon={theme === 'dark' ? Icon.sun : Icon.moon}
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              >
                {theme === 'dark' ? 'Light mode' : 'Dark mode'}
              </MenuItem>
              <div className="menu-sep" />
              <MenuItem icon={Icon.logout} danger onClick={() => signOut()}>Sign out</MenuItem>
            </Menu>
          </header>

          <div className="content">
            <ErrorBoundary key={route.name}>{renderScreen()}</ErrorBoundary>
          </div>
        </div>
      </div>
    </NavCtx.Provider>
  );
}
