import { BookOpen, Building2, ClipboardList, Dumbbell, House, KeyRound, Settings, Users, type LucideIcon } from 'lucide-react';
import type { Access } from '../auth/access';
import { getT } from '../i18n/I18nProvider';

export interface NavItem {
  to: string;
  label: string;
  Icon: LucideIcon;
  /** Exact match only (Today), so `/` is not active on every page. */
  end?: boolean;
  /** Carries the pending sign-up count. */
  pending?: boolean;
}

export interface NavGroup {
  id: 'main' | 'coaching' | 'club' | 'platform';
  /** Shown above the group; null for the ungrouped top (Today). */
  label: string | null;
  items: NavItem[];
}

/**
 * Every destination exactly once, grouped by who it is for: coaching work, running the
 * club (club admins and section admins), running the platform (the operator). The
 * sidebar, the phone "More" page and search all render from this; nothing else lists pages.
 */
export function navGroups(access: Access | null, isPlatformAdmin: boolean): NavGroup[] {
  const t = getT().layout.nav;
  const groups: NavGroup[] = [
    { id: 'main', label: null, items: [{ to: '/', label: t.home, Icon: House, end: true }] },
    {
      id: 'coaching',
      label: t.coaching,
      items: [
        { to: '/teams', label: t.teams, Icon: Users },
        ...(access?.sections.trainings ? [{ to: '/trainings', label: t.trainings, Icon: ClipboardList }] : []),
        ...(access?.sections.exercises ? [{ to: '/exercises', label: t.exercises, Icon: Dumbbell }] : []),
      ],
    },
    {
      id: 'club',
      label: t.club,
      items: [
        ...(access?.sections.guides ? [{ to: '/admin/guides', label: t.guides, Icon: BookOpen }] : []),
        ...(access?.isClubAdmin ? [{ to: '/club', label: t.membersAndSettings, Icon: KeyRound }] : []),
      ],
    },
    {
      id: 'platform',
      label: t.platform,
      items: isPlatformAdmin ? [{ to: '/platform', label: t.clubsAndSignups, Icon: Building2, pending: true }] : [],
    },
  ];
  return groups.filter((g) => g.items.length > 0);
}

/** The phone bottom bar: Today and the coaching pages; the club and platform groups live on More. */
export function phoneTabs(access: Access | null, isPlatformAdmin: boolean): NavItem[] {
  return navGroups(access, isPlatformAdmin)
    .filter((g) => g.id === 'main' || g.id === 'coaching')
    .flatMap((g) => g.items);
}

/** Everything search's "Go to" group offers: each page the person can reach, then Settings. */
export function goToDestinations(access: Access | null, isPlatformAdmin: boolean): NavItem[] {
  return [
    ...navGroups(access, isPlatformAdmin).flatMap((g) => g.items),
    { to: '/settings', label: getT().layout.appShell.settings, Icon: Settings },
  ];
}
