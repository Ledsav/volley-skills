import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import type { MenuItem } from '../components/Menu';

export interface PageMainAction {
  label: string;
  onSelect: () => void;
  icon?: LucideIcon;
  disabled?: boolean;
}

export interface PageChromeState {
  title: string | null;
  mainAction: PageMainAction | null;
  more: MenuItem[];
}

const EMPTY: PageChromeState = { title: null, mainAction: null, more: [] };

interface Publisher {
  publish: (owner: symbol, next: PageChromeState) => void;
  release: (owner: symbol) => void;
}

const StateContext = createContext<PageChromeState>(EMPTY);
// The publisher API is stable, so publishers do not re-render when the shell does.
const PublisherContext = createContext<Publisher | null>(null);

function sameMore(a: MenuItem[], b: MenuItem[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((x, i) => {
    const y = b[i];
    if (x.kind !== y.kind) return false;
    if (x.kind === 'divider') return true;
    if (y.kind === 'divider') return false;
    return (
      x.label === y.label &&
      (x.kind === 'check' ? x.checked === (y as typeof x).checked : (x.danger ?? false) === ((y as typeof x).danger ?? false))
    );
  });
}

function sameChrome(a: PageChromeState, b: PageChromeState): boolean {
  const ma = a.mainAction;
  const mb = b.mainAction;
  const sameAction =
    ma === mb || (!!ma && !!mb && ma.label === mb.label && ma.icon === mb.icon && (ma.disabled ?? false) === (mb.disabled ?? false));
  return a.title === b.title && sameAction && sameMore(a.more, b.more);
}

/** Holds what the current page publishes for the shell's toolbar. */
export function PageChromeProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<PageChromeState>(EMPTY);
  const owner = useRef<symbol | null>(null);
  const current = useRef<PageChromeState>(EMPTY);
  const publisher = useMemo<Publisher>(
    () => ({
      publish(who, next) {
        // Identical chrome from the same publisher is not republished (its handlers are ref-backed).
        if (owner.current === who && sameChrome(current.current, next)) return;
        owner.current = who;
        current.current = next;
        setState(next);
      },
      release(who) {
        // Only the publisher that owns the chrome may clear it, so a swap in one commit keeps the new title.
        if (owner.current !== who) return;
        owner.current = null;
        current.current = EMPTY;
        setState(EMPTY);
      },
    }),
    []
  );
  return (
    <PublisherContext.Provider value={publisher}>
      <StateContext.Provider value={state}>{children}</StateContext.Provider>
    </PublisherContext.Provider>
  );
}

/** The shell reads the published title, main action and overflow items here. */
// eslint-disable-next-line react-refresh/only-export-components -- the hook belongs with its provider
export function usePageChromeState(): PageChromeState {
  return useContext(StateContext);
}

/**
 * A page writes its toolbar state here. It publishes on mount and on change and resets to
 * empty on unmount. If two components publish, the last to render wins (an earlier one reclaims the chrome on its next render); an unmount only clears
 * chrome it owns. Handlers stay current through refs, so a new closure does not re-render the shell.
 * Without a provider this is a no-op, so PageHeader works standalone in tests.
 */
// eslint-disable-next-line react-refresh/only-export-components -- the hook belongs with its provider
export function usePublishPageChrome(state: Partial<PageChromeState>): void {
  const publisher = useContext(PublisherContext);
  const { title = null, mainAction = null, more } = state;
  const latest = useRef({ mainAction, more });
  latest.current = { mainAction, more };
  const me = useRef<symbol>(Symbol('page-chrome'));
  const moreItems = more ?? [];

  useEffect(() => {
    if (!publisher) return;
    const action = latest.current.mainAction;
    publisher.publish(me.current, {
      title,
      mainAction: action && { ...action, onSelect: () => latest.current.mainAction?.onSelect() },
      more: moreItems.map((item, i) =>
        item.kind === 'divider'
          ? item
          : { ...item, onSelect: () => {
              const cur = latest.current.more?.[i];
              if (cur && cur.kind !== 'divider') cur.onSelect();
            } }
      ),
    });
  });

  useEffect(() => {
    const id = me.current;
    return () => publisher?.release(id);
  }, [publisher]);
}
