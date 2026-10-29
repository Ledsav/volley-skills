import type { ReactNode } from 'react';
import { PageChromeProvider, usePageChromeState } from '../layout/PageChrome';

/** Renders what a page published to the shell toolbar as plain buttons, so page tests can click them. */
function ChromeProbe() {
  const s = usePageChromeState();
  return (
    <div data-testid="chrome-probe">
      {s.mainAction && !s.mainAction.menu && (
        <button disabled={s.mainAction.disabled} onClick={s.mainAction.onSelect}>
          {s.mainAction.label}
        </button>
      )}
      {s.mainAction?.menu && (
        <>
          <span>{s.mainAction.label}</span>
          {s.mainAction.menu.map((m, i) =>
            m.kind === 'action' ? (
              <button key={i} disabled={m.disabled} onClick={m.onSelect}>
                {m.label}
              </button>
            ) : null
          )}
        </>
      )}
      {s.more.map((m, i) =>
        m.kind === 'action' ? (
          <button key={i} disabled={m.disabled} onClick={m.onSelect}>
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
