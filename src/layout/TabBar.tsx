import { NavLink } from 'react-router-dom';
import { Menu as MenuIcon } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { useT } from '../i18n/I18nProvider';
import { phoneTabs } from './navModel';

function tabClass({ isActive }: { isActive: boolean }): string {
  return `pressable flex min-h-[49px] min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-0.5 pt-1.5 pb-1 text-[10px] font-medium leading-tight focus:outline-none focus-visible:ring-2 focus-visible:ring-focus ${
    isActive ? 'text-ink' : 'text-ink-2'
  }`;
}

/** The phone's bottom bar: icon and label per tab (at most 5), More for everything else. */
export function TabBar({ pendingSignups = 0 }: { pendingSignups?: number }) {
  const { access, isPlatformAdmin } = useAuth();
  const t = useT().layout;
  const tabs = phoneTabs(access, !!isPlatformAdmin);

  return (
    <nav
      aria-label={t.appShell.phoneNav}
      className="glass fixed inset-x-0 bottom-0 z-30 flex border-t border-separator pb-[env(safe-area-inset-bottom)] md:hidden print:hidden"
    >
      {tabs.map(({ to, label, Icon, end }) => (
        <NavLink key={to} to={to} end={end} className={tabClass}>
          <Icon size={24} strokeWidth={1.75} aria-hidden="true" />
          <span className="max-w-full truncate">{label}</span>
        </NavLink>
      ))}
      {/* Everything else (club, platform, account) is one tap away on More. */}
      <NavLink to="/more" className={tabClass}>
        <span className="relative">
          <MenuIcon size={24} strokeWidth={1.75} aria-hidden="true" />
          {pendingSignups > 0 && (
            <span className="absolute -right-1.5 -top-1.5 rounded-full bg-orange-strong px-1.5 text-[11px] font-semibold text-on-ink">
              {pendingSignups}
            </span>
          )}
        </span>
        <span className="max-w-full truncate">{t.nav.more}</span>
      </NavLink>
    </nav>
  );
}
