import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, FileText, LogOut, Repeat, Settings } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { useSignOut } from '../auth/useSignOut';
import { otherUsableClubs } from '../clubs/activeClub';
import { usePendingSignups } from '../interest/usePendingSignups';
import { navGroups } from './navModel';
import { useT } from '../i18n/I18nProvider';
import { usePageMeta } from './usePageMeta';

const ROW = 'flex min-h-12 w-full items-center gap-3 px-4 py-2 text-left text-sm font-medium text-ink hover:bg-bg';

function Section({ title, children }: { title: string; children: ReactNode }) {
  const id = `more-${title.toLowerCase()}`;
  return (
    <section aria-labelledby={id}>
      <h2 id={id} className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-slate">{title}</h2>
      <div className="flex flex-col divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface shadow-card">{children}</div>
    </section>
  );
}

/**
 * The phone's "More" tab: the sidebar's Club and Platform groups (the bottom bar holds
 * Home and Coaching) plus the account. Same groups and names as the desktop sidebar.
 */
export function MorePage() {
  const t = useT().layout;
  usePageMeta({ title: t.morePage.title });
  const { access, club, isPlatformAdmin, memberships, activeClubId, switchClub } = useAuth();
  const { signOut, unsyncedDialog } = useSignOut();
  const pendingSignups = usePendingSignups(!!isPlatformAdmin);
  const groups = navGroups(access, !!isPlatformAdmin).filter((g) => g.id === 'club' || g.id === 'platform');
  const otherClubs = otherUsableClubs(memberships, activeClubId);

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6 p-4 sm:p-6">
      {club && <h1 className="text-title text-ink">{club.name}</h1>}

      {groups.map((g) => (
        <Section key={g.id} title={g.label ?? ''}>
          {g.items.map(({ to, label, Icon, pending }) => (
            <Link key={to} to={to} className={ROW}>
              <Icon size={18} strokeWidth={1.5} aria-hidden="true" className="text-slate" />
              <span className="flex-1">{label}</span>
              {pending && pendingSignups > 0 && (
                <span className="rounded-full bg-orange-strong px-1.5 py-0.5 text-xs font-semibold text-white">
                  {pendingSignups}<span className="sr-only">{t.morePage.pendingSignups}</span>
                </span>
              )}
              <ChevronRight size={16} aria-hidden="true" className="text-slate" />
            </Link>
          ))}
        </Section>
      ))}

      <Section title={t.morePage.account}>
        <Link to="/settings" className={ROW}>
          <Settings size={18} strokeWidth={1.5} aria-hidden="true" className="text-slate" />
          <span className="flex-1">{t.appShell.settings}</span>
          <ChevronRight size={16} aria-hidden="true" className="text-slate" />
        </Link>
        <Link to="/legal/terms" className={ROW}>
          <FileText size={18} strokeWidth={1.5} aria-hidden="true" className="text-slate" />
          <span className="flex-1">{t.appShell.termsAndPrivacy}</span>
          <ChevronRight size={16} aria-hidden="true" className="text-slate" />
        </Link>
        {otherClubs.map((m) => (
          <button key={m.clubId} type="button" className={ROW} onClick={() => switchClub(m.clubId)}>
            <Repeat size={18} strokeWidth={1.5} aria-hidden="true" className="text-slate" />
            <span className="flex-1">{t.appShell.switchTo(m.clubName)}</span>
          </button>
        ))}
        <button type="button" className={`${ROW} text-red`} onClick={signOut}>
          <LogOut size={18} strokeWidth={1.5} aria-hidden="true" />
          <span className="flex-1">{t.appShell.signOut}</span>
        </button>
      </Section>
      {unsyncedDialog}
    </div>
  );
}
