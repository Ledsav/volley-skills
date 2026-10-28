import type { ReactNode } from 'react';
import { PageChromeProvider, usePageChromeState } from '../layout/PageChrome';

/** Renders what a page published to the shell toolbar as plain buttons, so page tests can click them. */
function ChromeProbe() {
  const s = usePageChromeState();
  return (
    <div data-testid="chrome-probe">
      {s.mainAction && (
        <button disabled={s.mainAction.disabled} onClick={s.mainAction.onSelect}>
          {s.mainAction.label}
        </button>
      )}
      {s.more.map((m, i) =>
        m.kind === 'action' ? (
          <button key={i} onClick={m.onSelect}>
            {m.label}
          </button>
        ) : null
      )}
    </div>
  );
}

/** Wraps a page the way the shell does for chrome: a provider plus a probe beside it. */
export function WithChrome({ children }: { children: ReactNode }) {
  return (
    <PageChromeProvider>
      <ChromeProbe />
      {children}
    </PageChromeProvider>
  );
}
