import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
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

const StateContext = createContext<PageChromeState>(EMPTY);
// The setter is stable, so publishers do not re-render when the shell does.
const SetterContext = createContext<((state: PageChromeState) => void) | null>(null);

/** Holds what the current page publishes for the shell's toolbar. */
export function PageChromeProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<PageChromeState>(EMPTY);
  return (
    <SetterContext.Provider value={setState}>
      <StateContext.Provider value={state}>{children}</StateContext.Provider>
    </SetterContext.Provider>
  );
}

/** The shell reads the published title, main action and overflow items here. */
export function usePageChromeState(): PageChromeState {
  return useContext(StateContext);
}

/**
 * A page writes its toolbar state here. It publishes on mount and on change and resets to
 * empty on unmount. If two components publish, the last mounted wins (documented, not guarded).
 * Without a provider this is a no-op, so PageHeader works standalone in tests.
 */
export function usePublishPageChrome(state: Partial<PageChromeState>): void {
  const set = useContext(SetterContext);
  const { title = null, mainAction = null, more } = state;
  const moreItems = useMemo(() => more ?? [], [more]);
  useEffect(() => {
    set?.({ title, mainAction, more: moreItems });
  }, [set, title, mainAction, moreItems]);
  useEffect(() => () => set?.(EMPTY), [set]);
}
