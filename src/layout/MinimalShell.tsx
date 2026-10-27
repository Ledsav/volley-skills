import type { ReactNode } from 'react';
import { useAuth } from '../auth/AuthContext';
import { useSignOut } from '../auth/useSignOut';
import { Logo } from '../components/Logo';
import { useT } from '../i18n/I18nProvider';
import { Button } from '../components/Button';

/** A bare page frame for people who can't use the full app: logo, title, who is signed in, sign out. */
export function MinimalShell({ title, actions, children }: { title: string; actions?: ReactNode; children: ReactNode }) {
  const { appUser } = useAuth();
  const t = useT();
  const { signOut, unsyncedDialog } = useSignOut();
  return (
    <div className="flex min-h-screen flex-col bg-bg text-ink">
      <header className="bg-navy text-white">
        <div className="mx-auto flex w-full max-w-screen-xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <Logo className="text-[22px]" />
            <span className="min-w-0 truncate text-sm font-medium text-white/90">{title}</span>
          </div>
          <div className="flex min-w-0 flex-wrap items-center gap-3">
            {actions}
            <span className="min-w-0 truncate text-sm text-white/80">{appUser?.email}</span>
            <Button variant="secondary" onClick={signOut}>{t.layout.appShell.signOut}</Button>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-screen-xl min-w-0 flex-1">
        {children}
      </main>
      {unsyncedDialog}
    </div>
  );
}
