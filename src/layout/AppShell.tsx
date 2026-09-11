import type { ReactNode } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { BookOpen, ClipboardList, Dumbbell, KeyRound, LogOut, Settings, Users } from 'lucide-react';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase/config';
import { useAuth } from '../auth/AuthContext';
import { ThemeToggle } from '../theme/ThemeToggle';
import logo from '../assets/logo.png';

function sidebarLinkClass({ isActive }: { isActive: boolean }): string {
  return `flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium ${
    isActive ? 'bg-white/10 text-white' : 'text-white/70 hover:bg-white/5 hover:text-white'
  }`;
}

function bottomTabClass({ isActive }: { isActive: boolean }): string {
  return `flex flex-1 flex-col items-center gap-1 py-2 text-xs font-medium ${
    isActive ? 'text-blue' : 'text-slate'
  }`;
}

export function AppShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const { access } = useAuth();

  const navItems = [
    { to: '/teams', label: 'Teams', Icon: Users, show: true },
    { to: '/exercises', label: 'Exercises', Icon: Dumbbell, show: !!access?.sections.exercises },
    { to: '/trainings', label: 'Trainings', Icon: ClipboardList, show: !!access?.sections.trainings },
    { to: '/admin/guides', label: 'Guides', Icon: BookOpen, show: !!access?.sections.guides },
    { to: '/admin/access', label: 'Access', Icon: KeyRound, show: !!access?.isSuperAdmin },
  ].filter((item) => item.show);

  async function handleSignOut() {
    await signOut(auth);
    navigate('/login', { replace: true });
  }

  return (
    <div className="min-h-screen bg-bg lg:flex">
      <aside className="hidden w-56 shrink-0 flex-col overflow-y-auto bg-navy p-4 lg:sticky lg:top-0 lg:flex lg:h-screen">
        <div className="mb-6 flex items-center gap-2 px-3">
          <img src={logo} alt="" className="h-8 w-8 rounded-full border-2 border-white" />
          <span className="text-lg font-semibold tracking-[-0.01em] text-white">Volley Skills</span>
        </div>
        <nav className="flex flex-1 flex-col gap-1">
          {navItems.map(({ to, label, Icon }) => (
            <NavLink key={to} to={to} className={sidebarLinkClass}>
              <Icon size={20} strokeWidth={1.5} />
              {label}
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

      <div className="flex-1 pb-16 lg:pb-0">{children}</div>

      <nav className="fixed inset-x-0 bottom-0 flex border-t border-border bg-surface lg:hidden">
        {navItems.map(({ to, label, Icon }) => (
          <NavLink key={to} to={to} className={bottomTabClass}>
            <Icon size={22} strokeWidth={1.5} />
            {label}
          </NavLink>
        ))}
        <NavLink to="/settings" className={bottomTabClass}>
          <Settings size={22} strokeWidth={1.5} />
          Settings
        </NavLink>
      </nav>
    </div>
  );
}
