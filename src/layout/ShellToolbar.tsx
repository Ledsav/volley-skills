import type { RefObject } from 'react';
import { MoreHorizontal, PanelLeft, Search } from 'lucide-react';
import { MAIN_ACTION_CLASS, MainAction, Toolbar } from '../components/Toolbar';
import { Menu } from '../components/Menu';
import { useMediaQuery } from '../components/useMediaQuery';
import { useT } from '../i18n/I18nProvider';
import { useSearch } from '../search/SearchProvider';
import { usePageChromeState } from './PageChrome';

const ICON_BUTTON =
  'pressable flex h-11 w-11 items-center justify-center rounded-md text-ink-2 hover:bg-surface-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-focus';

/** The shell's top bar: navigation on tablet, the page's title, search, overflow menu and one main action. */
export function ShellToolbar({
  onOpenNav,
  navButtonRef,
}: {
  onOpenNav: () => void;
  navButtonRef?: RefObject<HTMLButtonElement>;
}) {
  const t = useT().layout.appShell;
  const { title, mainAction, more } = usePageChromeState();
  const { open } = useSearch();
  const isPhone = useMediaQuery('(max-width: 767px)', false);
  const isDesktop = useMediaQuery('(min-width: 1280px)', false);
  const isMac = typeof navigator !== 'undefined' && navigator.platform.includes('Mac');

  const leading = (
    <button ref={navButtonRef} type="button" aria-label={t.openNavigation} onClick={onOpenNav} className={`${ICON_BUTTON} hidden md:flex xl:hidden`}>
      <PanelLeft size={20} strokeWidth={1.75} aria-hidden="true" />
    </button>
  );

  const searchEntry = isDesktop ? (
    <button
      type="button"
      aria-label={t.search}
      onClick={open}
      className="pressable flex h-9 w-[220px] items-center gap-2 rounded-md bg-surface-2 px-3 text-callout text-ink-3 hover:bg-surface-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
    >
      <Search size={16} strokeWidth={1.75} aria-hidden="true" />
      <span className="flex-1 text-left">{t.search}</span>
      <span aria-hidden="true" className="text-footnote">{isMac ? '⌘K' : 'Ctrl K'}</span>
    </button>
  ) : (
    <button type="button" aria-label={t.search} onClick={open} className={ICON_BUTTON}>
      <Search size={20} strokeWidth={1.75} aria-hidden="true" />
    </button>
  );

  const actions = (
    <>
      {searchEntry}
      {more.length > 0 && (
        <Menu
          label={t.moreActions}
          items={more}
          triggerClassName={ICON_BUTTON}
          trigger={<MoreHorizontal size={20} strokeWidth={1.75} aria-hidden="true" />}
        />
      )}
    </>
  );

  const MainIcon = mainAction?.icon;
  const iconOnly = isPhone && !!MainIcon;
  const mainContent = mainAction && (
    <>
      {MainIcon && <MainIcon size={16} strokeWidth={1.75} aria-hidden="true" />}
      {!iconOnly && mainAction.label}
    </>
  );
  const main = mainAction &&
    (mainAction.menu ? (
      <Menu label={mainAction.label} items={mainAction.menu} align="end" triggerClassName={MAIN_ACTION_CLASS} trigger={mainContent} />
    ) : (
      <MainAction className="gap-2" onClick={mainAction.onSelect} disabled={mainAction.disabled} aria-label={iconOnly ? mainAction.label : undefined}>
        {mainContent}
      </MainAction>
    ));

  return <Toolbar title={title ?? ''} leading={leading} actions={actions} mainAction={main} />;
}
