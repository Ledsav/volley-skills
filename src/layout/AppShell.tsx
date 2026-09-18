import { useEffect, useState, type ReactNode } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { BookOpen, ClipboardList, Dumbbell, KeyRound, LogOut, Settings, Users, type LucideIcon } from 'lucide-react';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase/config';
import { useAuth } from '../auth/AuthContext';
import { ThemeToggle } from '../theme/ThemeToggle';
import { countUnreviewedInterestSignups } from '../interest/interestApi';
import { SIGNUPS_CHANGED_EVENT } from '../interest/signupEvents';
import { Logo } from '../components/Logo';

function sidebarLinkClass({ isActive }: { isActive: boolean }): string {
  return `flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium ${
    isActive ? 'bg-white/10 text-white' : 'text-white/70 hover:bg-white/5 hover:text-white'
  }`;
}

// Icon-only on phones (labels stay as sr-only text for screen readers); labels
// reappear from `sm` up, where the bar has room for them.
function bottomTabClass({ isActive }: { isActive: boolean }): string {
  return `flex min-h-12 flex-1 flex-col items-center justify-center gap-1 py-2 text-xs font-medium ${
    isActive ? 'text-blue' : 'text-slate'
  }`;
}

export function AppShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const { access } = useAuth();
  const [pendingSignups, setPendingSignups] = useState(0);

  useEffect(() => {
    if (!access?.isSuperAdmin) return;
    const recount = () => { void countUnreviewedInterestSignups().then(setPendingSignups); };
    recount();
    window.addEventListener(SIGNUPS_CHANGED_EVENT, recount);
    return () => window.removeEventListener(SIGNUPS_CHANGED_EVENT, recount);
  }, [access?.isSuperAdmin]);

  const navItems: { to: string; label: string; Icon: LucideIcon; show: boolean; badge?: number }[] = [
    { to: '/teams', label: 'Teams', Icon: Users, show: true },
    { to: '/exercises', label: 'Exercises', Icon: Dumbbell, show: !!access?.sections.exercises },
    { to: '/trainings', label: 'Trainings', Icon: ClipboardList, show: !!access?.sections.trainings },
    { to: '/admin/guides', label: 'Guides', Icon: BookOpen, show: !!access?.sections.guides },
    {
      to: '/admin/access', label: 'Access', Icon: KeyRound, show: !!access?.isSuperAdmin,
      badge: pendingSignups > 0 ? pendingSignups : undefined,
    },
  ].filter((item) => item.show);

  async function handleSignOut() {
    await signOut(auth);
    navigate('/login', { replace: true });
  }

  return (
    <div className="min-h-screen bg-bg lg:flex">
      <aside className="hidden w-56 shrink-0 flex-col overflow-y-auto bg-navy p-4 lg:sticky lg:top-0 lg:flex lg:h-screen">
        <div className="mb-6 px-3">
          <Logo className="text-[28px]" />
        </div>
        <nav className="flex flex-1 flex-col gap-1">
          {navItems.map(({ to, label, Icon, badge }) => (
            <NavLink key={to} to={to} className={sidebarLinkClass}>
              <Icon size={20} strokeWidth={1.5} />
              {label}
              {!!badge && (
                <span className="ml-auto rounded-full bg-orange px-1.5 py-0.5 text-xs font-semibold text-white">
                  {badge}
                </span>
              )}
            </NavLink>
          ))}
        </nav>
        <ThemeToggle className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-white/70 transition-colors hover:bg-white/5 hover:text-white" />
        <button
          onClick={() => void handleSignOut()}
          className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-white/70 transition-colors hover:bg-white/5 hover:text-white"
        >
          <LogOut size={20} strokeWidth={1.5} />
          Sign out
        </button>
        <NavLink to="/privacy" className="px-3 py-2 text-xs font-medium text-white/50 hover:text-white/80">
          Privacy
        </NavLink>
      </aside>

      {/* min-w-0: as a flex item beside the sidebar, wide content (tables)
          would otherwise stretch the whole page past the viewport. */}
      <div className="min-w-0 flex-1 pb-16 lg:pb-0">{children}</div>

      <nav className="fixed inset-x-0 bottom-0 flex border-t border-border bg-surface lg:hidden">
        {navItems.map(({ to, label, Icon, badge }) => (
          <NavLink key={to} to={to} className={bottomTabClass}>
            <span className="relative">
              <Icon size={22} strokeWidth={1.5} />
              {!!badge && (
                <span className="absolute -right-1.5 -top-1.5 rounded-full bg-orange px-1 text-[10px] font-semibold text-white">
                  {badge}
                </span>
              )}
            </span>
            <span className="sr-only sm:not-sr-only">{label}</span>
          </NavLink>
        ))}
        <NavLink to="/settings" className={bottomTabClass}>
          <Settings size={22} strokeWidth={1.5} />
          <span className="sr-only sm:not-sr-only">Settings</span>
        </NavLink>
      </nav>
    </div>
  );
}
