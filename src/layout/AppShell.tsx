import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { focusPageHeading } from './focusPageHeading';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { useSignOut } from '../auth/useSignOut';
import { useNotify } from '../components/Notice';
import { useMediaQuery } from '../components/useMediaQuery';
import { ContractEndingBanner } from '../clubs/ContractEndingBanner';
import { LegalNoticeBanner } from '../legal/LegalNoticeBanner';
import { useT } from '../i18n/I18nProvider';
import { usePendingSignups } from '../interest/usePendingSignups';
import { Sidebar, SidebarOverlay } from './Sidebar';
import { ShellToolbar } from './ShellToolbar';
import { TabBar } from './TabBar';

export function AppShell({ children }: { children: ReactNode }) {
  const { droppedClub, isPlatformAdmin } = useAuth();
  // Counted once here and passed down: the sidebars and the tab bar only show it.
  const pendingSignups = usePendingSignups(!!isPlatformAdmin);
  const t = useT().layout;
  const notify = useNotify();
  const notifiedDropped = useRef(false);
  const { signOut, unsyncedDialog } = useSignOut();
  const { pathname } = useLocation();
  const mainRef = useRef<HTMLElement>(null);
  const navButtonRef = useRef<HTMLButtonElement>(null);
  const prevPathname = useRef(pathname);
  const [navOpen, setNavOpen] = useState(false);
  const isDesktop = useMediaQuery('(min-width: 1280px)', false);
  const isTabletUp = useMediaQuery('(min-width: 768px)', true);

  useEffect(() => {
    if (!droppedClub || notifiedDropped.current) return;
    notifiedDropped.current = true;
    notify(t.appShell.droppedClub);
  }, [droppedClub, notify, t]);

  // The overlay is for tablet widths: close it on any route change, once the solid sidebar takes
  // over, and when the viewport shrinks to a phone (its toolbar button is hidden there).
  useEffect(() => setNavOpen(false), [pathname, isDesktop, isTabletUp]);

  const focusHeading = useCallback(() => focusPageHeading(mainRef.current), []);

  // Move focus into the new page on route change (not on the initial load).
  useEffect(() => {
    if (prevPathname.current === pathname) return;
    prevPathname.current = pathname;
    focusHeading();
  }, [pathname, focusHeading]);

  return (
    <div data-app-shell className="canvas min-h-screen bg-bg xl:flex">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:rounded-md focus:bg-surface focus:px-3 focus:py-2 focus:text-ink focus:shadow-pop">
        {t.appShell.skipToContent}
      </a>
      <aside className="hidden print:hidden w-[248px] shrink-0 overflow-y-auto xl:sticky xl:top-0 xl:flex xl:h-screen">
        <div className="h-full w-full">
          <Sidebar onSignOut={signOut} pendingSignups={pendingSignups} />
        </div>
      </aside>

      {/* min-w-0: as a flex item beside the sidebar, wide content (tables)
          would otherwise stretch the whole page past the viewport. */}
      <div className="min-w-0 flex-1 pb-[calc(96px+env(safe-area-inset-bottom))] md:pb-0">
        <ContractEndingBanner />
        <LegalNoticeBanner />
        {/* A direct child of this tall column, so its `position: sticky` holds while the page scrolls (a wrapper
            as tall as the toolbar would carry it away). Print hides every <header>. */}
        <ShellToolbar onOpenNav={() => setNavOpen(true)} navButtonRef={navButtonRef} />
        {/* Pages set their own width and gutters through PageContainer. */}
        <main id="main" ref={mainRef} tabIndex={-1} className="w-full focus:outline-none">
          {children}
        </main>
      </div>

      <SidebarOverlay
        open={navOpen}
        onClose={() => setNavOpen(false)}
        returnFocusTo={navButtonRef}
        onSignOut={signOut}
        pendingSignups={pendingSignups}
        // The pathname will not change, so the route-change effect never runs: focus the page heading here.
        onNavigate={(to) => {
          if (to === pathname) focusHeading();
        }}
      />
      <TabBar pendingSignups={pendingSignups} />
      {/* Outside the overlay panel: a transformed/backdrop-filtered ancestor would clip a fixed dialog. */}
      {unsyncedDialog}
    </div>
  );
}
