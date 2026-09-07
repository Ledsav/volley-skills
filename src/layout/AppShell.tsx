import type { ReactNode } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { BookOpen, ClipboardList, Dumbbell, LogOut, Users } from 'lucide-react';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase/config';

const NAV_ITEMS = [
  { to: '/teams', label: 'Teams', Icon: Users },
  { to: '/exercises', label: 'Exercises', Icon: Dumbbell },
  { to: '/trainings', label: 'Trainings', Icon: ClipboardList },
  { to: '/admin/guides', label: 'Guides', Icon: BookOpen },
];

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

  async function handleSignOut() {
    await signOut(auth);
    navigate('/login', { replace: true });
  }

  return (
    <div className="min-h-screen bg-bg lg:flex">
      <aside className="hidden w-56 flex-col bg-navy p-4 lg:flex">
        <span className="mb-6 px-3 text-lg font-semibold tracking-[-0.01em] text-white">Volley Skills</span>
        <nav className="flex flex-1 flex-col gap-1">
          {NAV_ITEMS.map(({ to, label, Icon }) => (
            <NavLink key={to} to={to} className={sidebarLinkClass}>
              <Icon size={20} strokeWidth={1.5} />
              {label}
            </NavLink>
          ))}
        </nav>
        <button
          onClick={() => void handleSignOut()}
          className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-white/70 hover:bg-white/5 hover:text-white"
        >
          <LogOut size={20} strokeWidth={1.5} />
          Sign out
        </button>
      </aside>

      <div className="flex-1 pb-16 lg:pb-0">{children}</div>

      <nav className="fixed inset-x-0 bottom-0 flex border-t border-border bg-surface lg:hidden">
        {NAV_ITEMS.map(({ to, label, Icon }) => (
          <NavLink key={to} to={to} className={bottomTabClass}>
            <Icon size={22} strokeWidth={1.5} />
            {label}
          </NavLink>
        ))}
        <button
          onClick={() => void handleSignOut()}
          className="flex flex-1 flex-col items-center gap-1 py-2 text-xs font-medium text-slate"
        >
          <LogOut size={22} strokeWidth={1.5} />
          Sign out
        </button>
      </nav>
    </div>
  );
}
