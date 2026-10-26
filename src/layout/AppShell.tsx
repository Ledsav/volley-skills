import { useEffect, useRef, type ReactNode } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { ChevronsUpDown, FileText, LogOut, Menu as MenuIcon, Repeat, Settings } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { useSignOut } from '../auth/useSignOut';
import { Menu } from '../components/Menu';
import { usePendingSignups } from '../interest/usePendingSignups';
import { Logo } from '../components/Logo';
import { useNotify } from '../components/Notice';
import { ContractEndingBanner } from '../clubs/ContractEndingBanner';
import { LegalNoticeBanner } from '../legal/LegalNoticeBanner';
import { otherUsableClubs } from '../clubs/activeClub';
import { navGroups, phoneTabs, type NavGroup, type NavItem } from './navModel';

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
  const { access, club, firebaseUser, isPlatformAdmin, memberships, activeClubId, switchClub, droppedClub } = useAuth();
  const notify = useNotify();
  const notifiedDropped = useRef(false);
  const navigate = useNavigate();
  const email = firebaseUser?.email ?? '';
  const initials = (email.split('@')[0] || '?').slice(0, 2).toUpperCase();
  const { signOut, unsyncedDialog } = useSignOut();
  const pendingSignups = usePendingSignups(isPlatformAdmin);
  const { pathname } = useLocation();
  const mainRef = useRef<HTMLElement>(null);
  const prevPathname = useRef(pathname);

  useEffect(() => {
    if (!droppedClub || notifiedDropped.current) return;
    notifiedDropped.current = true;
    notify('You no longer have access to your previous club.');
  }, [droppedClub, notify]);

  const otherClubs = otherUsableClubs(memberships, activeClubId);

  // Move focus into the new page on route change (not on the initial load).
  useEffect(() => {
    if (prevPathname.current === pathname) return;
    prevPathname.current = pathname;
    const heading = mainRef.current?.querySelector<HTMLElement>('h1');
    if (heading) {
      if (!heading.hasAttribute('tabindex')) heading.setAttribute('tabindex', '-1');
      heading.focus({ preventScroll: true });
    } else {
      mainRef.current?.focus({ preventScroll: true });
    }
  }, [pathname]);

  const groups = navGroups(access, !!isPlatformAdmin);
  const tabs = phoneTabs(access, !!isPlatformAdmin);

  const badge = (count: number, className: string) =>
    count > 0 ? <span className={`rounded-full bg-orange-strong font-semibold text-white ${className}`}>{count}</span> : null;

  const renderSidebarLink = ({ to, label, Icon, end, pending }: NavItem) => (
    <NavLink key={to} to={to} end={end} className={sidebarLinkClass}>
      <Icon size={20} strokeWidth={1.5} />
      {label}
      {pending && badge(pendingSignups, 'ml-auto px-1.5 py-0.5 text-xs')}
    </NavLink>
  );

  const renderGroup = (g: NavGroup) =>
    g.label === null ? (
      <div key={g.id} className="flex flex-col gap-1">{g.items.map(renderSidebarLink)}</div>
    ) : (
      <div key={g.id} role="group" aria-labelledby={`nav-${g.id}`} className="mt-5 flex flex-col gap-1">
        <p id={`nav-${g.id}`} className="px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-white/60">{g.label}</p>
        {g.items.map(renderSidebarLink)}
      </div>
    );

  return (
    <div className="min-h-screen bg-bg lg:flex">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:rounded-md focus:bg-surface focus:px-3 focus:py-2 focus:text-ink focus:shadow-pop">
        Skip to content
      </a>
      <aside className="hidden print:hidden w-56 shrink-0 flex-col overflow-y-auto bg-navy p-4 lg:sticky lg:top-0 lg:flex lg:h-screen">
        <div className="mb-6 px-3">
          <NavLink to="/" aria-label="Volley Skills home">
            <Logo className="text-[28px]" />
          </NavLink>
          {/* Which club you are in; with more than one, this is where you switch. */}
          {club && (otherClubs.length > 0 ? (
            <Menu
              label={`Club: ${club.name}`}
              align="start"
              triggerClassName="-mx-2 mt-3 flex w-[calc(100%+1rem)] items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm font-semibold text-white hover:bg-white/5"
              trigger={
                <>
                  <span className="min-w-0 flex-1 truncate">{club.name}</span>
                  <ChevronsUpDown size={16} aria-hidden="true" className="shrink-0 text-white/70" />
                </>
              }
              items={otherClubs.map((m) => ({
                kind: 'action' as const,
                label: `Switch to ${m.clubName}`,
                icon: <Repeat size={16} />,
                onSelect: () => switchClub(m.clubId),
              }))}
            />
          ) : (
            <p className="mt-3 truncate text-sm font-semibold text-white">{club.name}</p>
          ))}
        </div>
        <nav aria-label="Main" className="flex flex-1 flex-col">
          {groups.map(renderGroup)}
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
              { kind: 'action', label: 'Terms & privacy', icon: <FileText size={16} />, onSelect: () => navigate('/legal/terms') },
              { kind: 'divider' },
              { kind: 'action', label: 'Sign out', icon: <LogOut size={16} />, danger: true, onSelect: signOut },
            ]}
          />
        </div>
      </aside>

      {/* min-w-0: as a flex item beside the sidebar, wide content (tables)
          would otherwise stretch the whole page past the viewport. */}
      <div className="min-w-0 flex-1 pb-16 lg:pb-0">
        <ContractEndingBanner />
        <LegalNoticeBanner />
        {/* One content width for every page: long lines on a wide monitor are hard to scan. */}
        <main id="main" ref={mainRef} tabIndex={-1} className="mx-auto w-full max-w-screen-xl focus:outline-none">
          {children}
        </main>
      </div>

      <nav aria-label="Main (phone)" className="fixed inset-x-0 bottom-0 flex border-t border-border bg-surface lg:hidden print:hidden">
        {tabs.map(({ to, label, Icon, end }) => (
          <NavLink key={to} to={to} end={end} className={bottomTabClass}>
            <Icon size={22} strokeWidth={1.5} />
            <span className="max-w-full truncate">{label}</span>
          </NavLink>
        ))}
        {/* Everything else (club, platform, account) is one tap away on More. */}
        <NavLink to="/more" className={bottomTabClass}>
          <span className="relative">
            <MenuIcon size={22} strokeWidth={1.5} />
            {pendingSignups > 0 && (
              <span className="absolute -right-1.5 -top-1.5 rounded-full bg-orange-strong px-1.5 text-[11px] font-semibold text-white">
                {pendingSignups}
              </span>
            )}
          </span>
          <span className="max-w-full truncate">More</span>
        </NavLink>
      </nav>
      {unsyncedDialog}
    </div>
  );
}
