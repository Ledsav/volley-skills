import type { ReactNode } from 'react';
import { useAuth } from '../auth/AuthContext';
import { useSignOut } from '../auth/useSignOut';
import { useT } from '../i18n/I18nProvider';
import { Button } from '../components/Button';
import { MAIN_ACTION_CLASS, MainAction } from '../components/Toolbar';
import { Menu } from '../components/Menu';
import { PageChromeProvider, usePageChromeState } from './PageChrome';
import { BrandMark } from '../components/Logo';

function Frame({ title, actions, children }: { title: string; actions?: ReactNode; children: ReactNode }) {
  const { appUser } = useAuth();
  const t = useT();
  const { signOut, unsyncedDialog } = useSignOut();
  const { mainAction } = usePageChromeState();
  const MainIcon = mainAction?.icon;
  const mainContent = mainAction && (
    <>
      {MainIcon && <MainIcon size={16} strokeWidth={1.75} aria-hidden="true" />}
      {mainAction.label}
    </>
  );
  return (
    <div className="canvas flex min-h-screen flex-col bg-bg text-ink">
      <header className="glass sticky top-0 z-30 shadow-[inset_0_-1px_0_rgb(var(--color-separator))] print:hidden">
        <div className="mx-auto flex w-full max-w-screen-xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-2 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <BrandMark wordmark={false} className="shrink-0" />
            <span className="min-w-0 truncate text-headline">{title}</span>
          </div>
          <div className="flex min-w-0 flex-wrap items-center gap-3">
            {actions}
            <span className="hidden min-w-0 truncate text-footnote text-ink-2 sm:inline">{appUser?.email}</span>
            <Button variant="secondary" onClick={signOut}>{t.layout.appShell.signOut}</Button>
            {mainAction &&
              (mainAction.menu ? (
                <Menu label={mainAction.label} items={mainAction.menu} align="end" disabled={mainAction.disabled} triggerClassName={MAIN_ACTION_CLASS} trigger={mainContent} />
              ) : (
                <MainAction className="gap-2" onClick={mainAction.onSelect} disabled={mainAction.disabled}>
                  {mainContent}
                </MainAction>
              ))}
          </div>
        </div>
      </header>
      <main className="canvas mx-auto w-full max-w-screen-xl min-w-0 flex-1 bg-bg">
        {children}
      </main>
      {unsyncedDialog}
    </div>
  );
}

/**
 * A bare page frame for people who can't use the full app: logo, title, who is signed in, sign out.
 * A page inside it may publish a main action (usePublishPageChrome), shown last in the header.
 */
export function MinimalShell({ title, actions, children }: { title: string; actions?: ReactNode; children: ReactNode }) {
  return (
    <PageChromeProvider>
      <Frame title={title} actions={actions}>{children}</Frame>
    </PageChromeProvider>
  );
}
