import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { BookOpen, ChevronsUpDown, ClipboardList, Dumbbell, House, KeyRound, LogOut, Settings, Shield, Users, type LucideIcon } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { useSignOut } from '../auth/useSignOut';
import { Menu } from '../components/Menu';
import { useTheme } from '../theme/useTheme';
import { countUnreviewedInterestSignups } from '../interest/interestApi';
import { SIGNUPS_CHANGED_EVENT } from '../interest/signupEvents';
import { Logo } from '../components/Logo';

function sidebarLinkClass({ isActive }: { isActive: boolean }): string {
  return `flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium ${
    isActive ? 'bg-white/10 text-white' : 'text-white/80 hover:bg-white/5 hover:text-white'
  }`;
}

// Icon + short label at every width: icons alone (Dumbbell, ClipboardList,
// BookOpen…) are ambiguous. Five 11px labels fit a 375px bar.
function bottomTabClass({ isActive }: { isActive: boolean }): string {
  return `flex min-h-12 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-0.5 py-1.5 text-[11px] font-medium leading-tight sm:gap-1 sm:text-xs ${
    isActive ? 'text-blue' : 'text-slate'
  }`;
}

export function AppShell({ children }: { children: ReactNode }) {
  const { access, firebaseUser } = useAuth();
  const navigate = useNavigate();
  const [theme, toggleTheme] = useTheme();
  const adminGroupId = useId();
  const email = firebaseUser?.email ?? '';
  const initials = (email.split('@')[0] || '?').slice(0, 2).toUpperCase();
  const { signOut, unsyncedDialog } = useSignOut();
  const [pendingSignups, setPendingSignups] = useState(0);
  const { pathname } = useLocation();
  const mainRef = useRef<HTMLElement>(null);
  const firstRender = useRef(true);

  // Move focus into the new page on route change (not on the initial load).
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const heading = mainRef.current?.querySelector<HTMLElement>('h1');
    if (heading) {
      if (!heading.hasAttribute('tabindex')) heading.setAttribute('tabindex', '-1');
      heading.focus({ preventScroll: true });
    } else {
      mainRef.current?.focus({ preventScroll: true });
    }
  }, [pathname]);

  useEffect(() => {
    if (!access?.isSuperAdmin) return;
    const recount = () => { void countUnreviewedInterestSignups().then(setPendingSignups); };
    recount();
    window.addEventListener(SIGNUPS_CHANGED_EVENT, recount);
    return () => window.removeEventListener(SIGNUPS_CHANGED_EVENT, recount);
  }, [access?.isSuperAdmin]);

  const navItems: { to: string; label: string; Icon: LucideIcon; show: boolean; badge?: number; admin?: boolean; end?: boolean }[] = [
    { to: '/', label: 'Home', Icon: House, show: true, end: true },
    { to: '/teams', label: 'Teams', Icon: Users, show: true },
    { to: '/exercises', label: 'Exercises', Icon: Dumbbell, show: !!access?.sections.exercises },
    { to: '/trainings', label: 'Trainings', Icon: ClipboardList, show: !!access?.sections.trainings },
    { to: '/admin/guides', label: 'Guides', Icon: BookOpen, show: !!access?.sections.guides, admin: true },
    {
      to: '/admin/access', label: 'Access', Icon: KeyRound, show: !!access?.isSuperAdmin, admin: true,
      badge: pendingSignups > 0 ? pendingSignups : undefined,
    },
  ].filter((item) => item.show);

  const phoneItems = navItems.filter((i) => !i.admin).slice(0, 4);

  const renderSidebarLink = ({ to, label, Icon, badge, end }: (typeof navItems)[number]) => (
    <NavLink key={to} to={to} end={end} className={sidebarLinkClass}>
      <Icon size={20} strokeWidth={1.5} />
      {label}
      {!!badge && (
        <span className="ml-auto rounded-full bg-orange-strong px-1.5 py-0.5 text-xs font-semibold text-white">{badge}</span>
      )}
    </NavLink>
  );

  return (
    <div className="min-h-screen bg-bg lg:flex">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:rounded-md focus:bg-surface focus:px-3 focus:py-2 focus:text-ink focus:shadow-pop">
        Skip to content
      </a>
      <aside className="hidden w-56 shrink-0 flex-col overflow-y-auto bg-navy p-4 lg:sticky lg:top-0 lg:flex lg:h-screen">
        <div className="mb-6 px-3">
          <NavLink to="/" aria-label="Volley Skills home">
            <Logo className="text-[28px]" />
          </NavLink>
        </div>
        <nav aria-label="Main" className="flex flex-1 flex-col gap-1">
          {navItems.filter((item) => !item.admin).map(renderSidebarLink)}
          {navItems.some((item) => item.admin) && (
            <div role="group" aria-labelledby={adminGroupId} className="mt-6 flex flex-col gap-1">
              <p id={adminGroupId} className="flex items-center gap-2 px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-white/80">
                <Shield size={14} strokeWidth={1.75} aria-hidden="true" />
                Admin
              </p>
              {navItems.filter((item) => item.admin).map(renderSidebarLink)}
            </div>
          )}
        </nav>
        {/* Who is signed in, and everything about the account, behind one row. */}
        <div className="border-t border-white/10 pt-3">
          <Menu
            label={`Account: ${email}`}
            placement="up"
            align="start"
            triggerClassName="flex w-full items-center gap-3 rounded-md px-2 py-2 text-left text-sm text-white/80 hover:bg-white/5 hover:text-white"
            trigger={
              <>
                <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/15 text-xs font-semibold text-white">
                  {initials}
                </span>
                <span className="min-w-0 flex-1 truncate">{email}</span>
                <ChevronsUpDown size={16} aria-hidden="true" className="shrink-0" />
              </>
            }
            items={[
              { kind: 'action', label: 'Settings', icon: <Settings size={16} />, onSelect: () => navigate('/settings') },
              ...(access?.sections.guides ? [{ kind: 'action' as const, label: 'Guides', icon: <BookOpen size={16} />, onSelect: () => navigate('/admin/guides') }] : []),
              ...(access?.isSuperAdmin ? [{ kind: 'action' as const, label: 'Access', icon: <KeyRound size={16} />, onSelect: () => navigate('/admin/access') }] : []),
              { kind: 'check', label: 'Dark mode', checked: theme === 'dark', onSelect: toggleTheme },
              { kind: 'action', label: 'Privacy policy', onSelect: () => navigate('/privacy') },
              { kind: 'divider' },
              { kind: 'action', label: 'Sign out', icon: <LogOut size={16} />, danger: true, onSelect: signOut },
            ]}
          />
        </div>
      </aside>

      {/* min-w-0: as a flex item beside the sidebar, wide content (tables)
          would otherwise stretch the whole page past the viewport. */}
      <div className="min-w-0 flex-1 pb-16 lg:pb-0">
        {/* One content width for every page: long lines on a wide monitor are hard to scan. */}
        <main id="main" ref={mainRef} tabIndex={-1} className="mx-auto w-full max-w-screen-xl focus:outline-none">
          {children}
        </main>
      </div>

      <nav aria-label="Main (phone)" className="fixed inset-x-0 bottom-0 flex border-t border-border bg-surface lg:hidden">
        {phoneItems.map(({ to, label, Icon, badge, end }) => (
          <NavLink key={to} to={to} end={end} className={bottomTabClass}>
            <span className="relative">
              <Icon size={22} strokeWidth={1.5} />
              {!!badge && (
                <span className="absolute -right-1.5 -top-1.5 rounded-full bg-orange-strong px-1.5 text-[11px] font-semibold text-white">
                  {badge}
                </span>
              )}
            </span>
            <span className="max-w-full truncate">{label}</span>
          </NavLink>
        ))}
        <NavLink to="/settings" className={bottomTabClass}>
          <Settings size={22} strokeWidth={1.5} />
          <span className="max-w-full truncate">Settings</span>
        </NavLink>
      </nav>
      {unsyncedDialog}
    </div>
  );
}
