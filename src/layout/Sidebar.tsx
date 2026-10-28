import { useEffect, useLayoutEffect, useRef, type KeyboardEvent as ReactKeyboardEvent, type RefObject } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { ChevronsUpDown, FileText, LogOut, Repeat, Settings } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { Menu } from '../components/Menu';
import { otherUsableClubs } from '../clubs/activeClub';
import { useT } from '../i18n/I18nProvider';
import { animateSpring, SPRING_DEFAULT } from '../motion/spring';
import { useReducedMotion } from '../motion/useReducedMotion';
import { navGroups, type NavGroup, type NavItem } from './navModel';

const PANEL_WIDTH = 248;

/** First letters of the first two words of the club name, upper-cased. */
function clubInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => Array.from(w)[0])
    .join('')
    .toUpperCase();
}

/** Overlay rows are 44 px for touch; the desktop column stays at 36 px. */
const linkClass = (variant: 'solid' | 'glass') => ({ isActive }: { isActive: boolean }): string => {
  return `pressable flex ${variant === 'glass' ? 'min-h-11' : 'min-h-9'} items-center gap-3 rounded-md px-3 text-callout focus:outline-none focus-visible:ring-2 focus-visible:ring-focus ${
    isActive ? 'bg-surface-3 font-semibold text-ink' : 'text-ink-2 hover:bg-surface-2'
  }`;
};

/** The content of the 248 px column: club header, grouped navigation, account menu. No positioning. */
export function Sidebar({
  onNavigate,
  onSignOut,
  pendingSignups = 0,
  variant = 'solid',
}: {
  /** Called with the destination after a link or menu item navigates. */
  onNavigate?: (to: string) => void;
  onSignOut: () => void;
  /** Unreviewed sign-ups (platform admin); counted once in AppShell. */
  pendingSignups?: number;
  /** 'solid' is the desktop column; 'glass' sits inside the overlay's glass panel. */
  variant?: 'solid' | 'glass';
}) {
  const { access, club, firebaseUser, isPlatformAdmin, memberships, activeClubId, switchClub, role } = useAuth();
  const t = useT().layout;
  const navigate = useNavigate();
  const email = firebaseUser?.email ?? '';
  const initials = (email.split('@')[0] || '?').slice(0, 2).toUpperCase();
  const otherClubs = otherUsableClubs(memberships, activeClubId);
  const groups = navGroups(access, !!isPlatformAdmin);

  const renderLink = ({ to, label, Icon, end, pending }: NavItem) => (
    <NavLink key={to} to={to} end={end} className={linkClass(variant)} onClick={() => onNavigate?.(to)}>
      <Icon size={18} strokeWidth={1.75} aria-hidden="true" />
      {label}
      {pending && pendingSignups > 0 && (
        <span className="ml-auto rounded-full bg-orange-strong px-1.5 py-0.5 text-xs font-semibold text-on-ink">{pendingSignups}</span>
      )}
    </NavLink>
  );

  const renderGroup = (g: NavGroup) =>
    g.label === null ? (
      <div key={g.id} className="flex flex-col gap-0.5">{g.items.map(renderLink)}</div>
    ) : (
      <div key={g.id} role="group" aria-labelledby={`nav-${g.id}`} className="mt-5 flex flex-col gap-0.5">
        <p id={`nav-${g.id}`} className="px-3 pb-1 text-footnote font-semibold text-ink-2">{g.label}</p>
        {g.items.map(renderLink)}
      </div>
    );

  const headerBody = club && (
    <>
      <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-surface-3 text-footnote font-semibold text-ink">
        {clubInitials(club.name)}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-headline text-ink">{club.name}</span>
        <span className="block truncate text-footnote text-ink-2">{role === 'admin' ? t.appShell.roleAdmin : t.appShell.roleMember}</span>
      </span>
    </>
  );

  return (
    <div className={`flex h-full min-h-0 flex-col border-r border-separator p-3 ${variant === 'solid' ? 'bg-sidebar' : ''}`}>
      {/* The logo moves out in Plan 6; the home link stays reachable for assistive tech. */}
      <NavLink to="/" aria-label={t.appShell.homeLabel} onClick={() => onNavigate?.('/')} className="sr-only focus:not-sr-only focus:rounded-md focus:bg-surface focus:px-2 focus:py-1 focus:shadow-pop focus:outline-none focus:ring-2 focus:ring-focus">
        {t.appShell.homeLabel}
      </NavLink>
      {club && (
        <div className="mb-4">
          {otherClubs.length > 0 ? (
            <Menu
              label={t.appShell.clubMenu(club.name)}
              align="start"
              triggerClassName="pressable flex w-full items-center gap-2 rounded-md p-1.5 text-left hover:bg-surface-2"
              trigger={
                <>
                  {headerBody}
                  <ChevronsUpDown size={16} aria-hidden="true" className="shrink-0 text-ink-3" />
                </>
              }
              items={otherClubs.map((m) => ({
                kind: 'action' as const,
                label: t.appShell.switchTo(m.clubName),
                icon: <Repeat size={16} />,
                onSelect: () => switchClub(m.clubId),
              }))}
            />
          ) : (
            <div className="flex items-center gap-2 p-1.5">{headerBody}</div>
          )}
        </div>
      )}
      <nav aria-label={t.appShell.mainNav} className="flex flex-1 flex-col overflow-y-auto">
        {groups.map(renderGroup)}
      </nav>
      <div className="border-t border-separator pt-3">
        <Menu
          label={t.appShell.accountMenu(email)}
          placement="up"
          align="start"
          triggerClassName="pressable flex w-full items-center gap-3 rounded-md px-2 py-2 text-left text-callout text-ink-2 hover:bg-surface-2"
          trigger={
            <>
              <span aria-hidden="true" className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface-3 text-footnote font-semibold text-ink">
                {initials}
              </span>
              <span className="min-w-0 flex-1 truncate">{email}</span>
              <ChevronsUpDown size={16} aria-hidden="true" className="shrink-0 text-ink-3" />
            </>
          }
          items={[
            { kind: 'action', label: t.appShell.settings, icon: <Settings size={16} />, onSelect: () => { navigate('/settings'); onNavigate?.('/settings'); } },
            { kind: 'action', label: t.appShell.termsAndPrivacy, icon: <FileText size={16} />, onSelect: () => { navigate('/legal/terms'); onNavigate?.('/legal/terms'); } },
            { kind: 'divider' },
            { kind: 'action', label: t.appShell.signOut, icon: <LogOut size={16} />, danger: true, onSelect: onSignOut },
          ]}
        />
      </div>
    </div>
  );
}

const FOCUSABLE = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** The tablet sidebar: a glass panel over a scrim, opened from the toolbar. */
export function SidebarOverlay({
  open,
  onClose,
  returnFocusTo,
  onSignOut,
  onNavigate,
  pendingSignups,
}: {
  open: boolean;
  onClose: () => void;
  returnFocusTo: RefObject<HTMLElement>;
  onSignOut: () => void;
  /** After closing for a navigation, with the destination (AppShell uses it for a same-route click). */
  onNavigate?: (to: string) => void;
  pendingSignups?: number;
}) {
  const t = useT().layout;
  const reduced = useReducedMotion();
  const panelRef = useRef<HTMLDivElement>(null);

  const dismiss = () => {
    onClose();
    returnFocusTo.current?.focus();
  };

  // Lock page scroll behind the modal; restore whatever was there before.
  useEffect(() => {
    if (!open) return;
    const html = document.documentElement;
    const prevHtml = html.style.overflow;
    const prevBody = document.body.style.overflow;
    html.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    return () => {
      html.style.overflow = prevHtml;
      document.body.style.overflow = prevBody;
    };
  }, [open]);

  // Slide in from the left; instant with reduced motion. Layout effect: no frame painted at x=0 first.
  useLayoutEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    if (!panel) return;
    panel.querySelector<HTMLElement>('nav a[href]')?.focus({ preventScroll: true });
    if (reduced) {
      panel.style.transform = 'none';
      return;
    }
    panel.style.transform = `translateX(${-PANEL_WIDTH}px)`;
    const anim = animateSpring({
      from: -PANEL_WIDTH,
      to: 0,
      params: SPRING_DEFAULT,
      onUpdate: (x) => {
        panel.style.transform = `translateX(${x}px)`;
      },
    });
    return () => {
      anim.stop();
    };
  }, [open, reduced]);

  if (!open) return null;

  const onKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      dismiss();
      return;
    }
    if (e.key !== 'Tab') return;
    const items = Array.from(panelRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []);
    if (items.length === 0) return;
    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement;
    if (e.shiftKey && (active === first || !panelRef.current?.contains(active))) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && (active === last || !panelRef.current?.contains(active))) {
      e.preventDefault();
      first.focus();
    }
  };

  return (
    <div role="dialog" aria-modal="true" aria-label={t.appShell.mainNav} onKeyDown={onKeyDown} className="fixed inset-0 z-40 print:hidden">
      <div data-testid="sidebar-scrim" className="absolute inset-0 bg-black/20" onClick={dismiss} />
      <div ref={panelRef} className="glass glass-pop absolute inset-y-0 left-0 overflow-hidden" style={{ width: PANEL_WIDTH }}>
        <Sidebar
          onNavigate={(to) => {
            onClose();
            onNavigate?.(to);
          }}
          onSignOut={onSignOut}
          pendingSignups={pendingSignups}
          variant="glass"
        />
      </div>
    </div>
  );
}
