import { BookOpen, Building2, ClipboardList, Dumbbell, House, KeyRound, Users, type LucideIcon } from 'lucide-react';
import type { Access } from '../auth/access';

export interface NavItem {
  to: string;
  label: string;
  Icon: LucideIcon;
  /** Exact match only (Home), so `/` is not active on every page. */
  end?: boolean;
  /** Carries the pending sign-up count. */
  pending?: boolean;
}

export interface NavGroup {
  id: 'main' | 'coaching' | 'club' | 'platform';
  /** Shown above the group; null for the ungrouped top (Home). */
  label: string | null;
  items: NavItem[];
}

/**
 * Every destination exactly once, grouped by who it is for: coaching work, running the
 * club (club admins and section admins), running the platform (the operator). The
 * sidebar and the phone "More" page both render from this; nothing else lists pages.
 */
export function navGroups(access: Access | null, isPlatformAdmin: boolean): NavGroup[] {
  const groups: NavGroup[] = [
    { id: 'main', label: null, items: [{ to: '/', label: 'Home', Icon: House, end: true }] },
    {
      id: 'coaching',
      label: 'Coaching',
      items: [
        { to: '/teams', label: 'Teams', Icon: Users },
        ...(access?.sections.trainings ? [{ to: '/trainings', label: 'Trainings', Icon: ClipboardList }] : []),
        ...(access?.sections.exercises ? [{ to: '/exercises', label: 'Exercises', Icon: Dumbbell }] : []),
      ],
    },
    {
      id: 'club',
      label: 'Club',
      items: [
        ...(access?.sections.guides ? [{ to: '/admin/guides', label: 'Guides', Icon: BookOpen }] : []),
        ...(access?.isClubAdmin ? [{ to: '/club', label: 'Members & settings', Icon: KeyRound }] : []),
      ],
    },
    {
      id: 'platform',
      label: 'Platform',
      items: isPlatformAdmin ? [{ to: '/platform', label: 'Clubs & sign-ups', Icon: Building2, pending: true }] : [],
    },
  ];
  return groups.filter((g) => g.items.length > 0);
}

/** The phone bottom bar: Home and the coaching pages; the club and platform groups live on More. */
export function phoneTabs(access: Access | null, isPlatformAdmin: boolean): NavItem[] {
  return navGroups(access, isPlatformAdmin)
    .filter((g) => g.id === 'main' || g.id === 'coaching')
    .flatMap((g) => g.items);
}
