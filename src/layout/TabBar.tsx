import { NavLink } from 'react-router-dom';
import { Menu as MenuIcon } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { useT } from '../i18n/I18nProvider';
import { phoneTabs } from './navModel';

/** Inactive tabs are 48 px icon circles; the current one is an ink capsule that takes the remaining width. */
function tabClass({ isActive }: { isActive: boolean }): string {
  return `pressable flex h-12 min-w-0 items-center justify-center rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-focus ${
    isActive ? 'flex-1 gap-1.5 bg-ink px-3.5 text-on-ink' : 'w-12 flex-none text-ink-2'
  }`;
}

/** The tab's label: shown (and faded in, opacity only) on the current tab, read aloud but not shown on the others. */
function TabLabel({ active, children }: { active: boolean; children: string }) {
  if (!active) return <span className="sr-only">{children}</span>;
  return <span className="tab-label-in min-w-0 truncate text-[13px] font-semibold leading-none">{children}</span>;
}

/**
 * The phone's floating tab bar: a glass capsule (at most 5 tabs, More last for everything else). Icon-only
 * circles, and the current page grows into an ink capsule with its label. Sits 24 px above the bottom edge
 * (plus the safe area), 60 px tall: AppShell and the notice region keep that space clear.
 */
export function TabBar({ pendingSignups = 0 }: { pendingSignups?: number }) {
  const { access, isPlatformAdmin } = useAuth();
  const t = useT().layout;
  const tabs = phoneTabs(access, !!isPlatformAdmin);

  return (
    <nav
      aria-label={t.appShell.phoneNav}
      className="glass glass-pop fixed inset-x-3.5 bottom-[calc(24px+env(safe-area-inset-bottom))] z-30 flex h-[60px] items-center justify-between gap-0.5 rounded-full p-1.5 md:hidden print:hidden"
    >
      {tabs.map(({ to, label, Icon, end }) => (
        <NavLink key={to} to={to} end={end} className={tabClass}>
          {({ isActive }) => (
            <>
              <Icon size={22} strokeWidth={1.75} aria-hidden="true" className="shrink-0" />
              <TabLabel active={isActive}>{label}</TabLabel>
            </>
          )}
        </NavLink>
      ))}
      {/* Everything else (club, platform, account) is one tap away on More. */}
      <NavLink to="/more" className={tabClass}>
        {({ isActive }) => (
          <>
            <span className="relative shrink-0">
              <MenuIcon size={22} strokeWidth={1.75} aria-hidden="true" />
              {pendingSignups > 0 && (
                <span className="absolute -right-2 -top-2 rounded-full bg-orange-strong px-1.5 text-[11px] font-semibold text-on-ink">
                  {pendingSignups}
                </span>
              )}
            </span>
            <TabLabel active={isActive}>{t.nav.more}</TabLabel>
          </>
        )}
      </NavLink>
    </nav>
  );
}
