import { fireEvent, render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { memo } from 'react';
import { describe, expect, it } from 'vitest';
import { PageChromeProvider, usePageChromeState, usePublishPageChrome } from './PageChrome';

function Probe() {
  const s = usePageChromeState();
  return <div data-testid="probe">{JSON.stringify({ title: s.title, action: s.mainAction?.label ?? null, more: s.more.length })}</div>;
}

function Publisher({ label, title = 'Teams', onSelect = () => {} }: { label: string; title?: string; onSelect?: () => void }) {
  usePublishPageChrome({ title, mainAction: { label, onSelect } });
  return null;
}

let probeRenders = 0;
const CountingProbe = memo(function CountingProbe() {
  probeRenders += 1;
  const s = usePageChromeState();
  return <button onClick={() => s.mainAction?.onSelect()}>{s.mainAction?.label ?? 'none'}</button>;
});

const read = () => JSON.parse(screen.getByTestId('probe').textContent ?? '{}');

describe('PageChrome', () => {
  it('publishes title and main action and clears them on unmount', () => {
    const { rerender } = render(
      <PageChromeProvider>
        <Probe />
        <Publisher label="New team" />
      </PageChromeProvider>
    );
    expect(read()).toEqual({ title: 'Teams', action: 'New team', more: 0 });
    rerender(
      <PageChromeProvider>
        <Probe />
      </PageChromeProvider>
    );
    expect(read()).toEqual({ title: null, action: null, more: 0 });
  });

  it('updates when the published label changes', () => {
    const { rerender } = render(
      <PageChromeProvider>
        <Probe />
        <Publisher label="New team" />
      </PageChromeProvider>
    );
    rerender(
      <PageChromeProvider>
        <Probe />
        <Publisher label="Add team" />
      </PageChromeProvider>
    );
    expect(read().action).toBe('Add team');
  });

  it('is a no-op without a provider', () => {
    expect(() => render(<Publisher label="x" />)).not.toThrow();
  });

  it('keeps the new title when one publisher replaces another in the same commit', () => {
    const tree = (k: string) => (
      <PageChromeProvider>
        <Probe />
        <Publisher key={k} label={k} title={k} />
      </PageChromeProvider>
    );
    const { rerender } = render(tree('A'));
    expect(read().title).toBe('A');
    rerender(tree('B'));
    expect(read().title).toBe('B');
  });

  it('an unmounting publisher does not clear chrome owned by another that does not re-render', () => {
    // B is memoised, so removing A never re-renders B and B cannot republish: only the owner token keeps B's title.
    const StaticB = memo(function StaticB() {
      usePublishPageChrome({ title: 'B', mainAction: { label: 'B action', onSelect: () => {} } });
      return null;
    });
    const tree = (withA: boolean) => (
      <PageChromeProvider>
        <Probe />
        {withA && <Publisher label="A action" title="A" />}
        <StaticB />
      </PageChromeProvider>
    );
    const { rerender } = render(tree(true));
    expect(read().title).toBe('B');
    rerender(tree(false));
    expect(read()).toEqual({ title: 'B', action: 'B action', more: 0 });
  });

  it('does not re-render the shell for equal chrome, and keeps onSelect current', () => {
    probeRenders = 0;
    const first = vi.fn();
    const second = vi.fn();
    const tree = (onSelect: () => void) => (
      <PageChromeProvider>
        <CountingProbe />
        <Publisher label="New" onSelect={onSelect} />
      </PageChromeProvider>
    );
    const { rerender } = render(tree(first));
    const after = probeRenders;
    rerender(tree(second));
    rerender(tree(() => second()));
    expect(probeRenders).toBe(after);
    fireEvent.click(screen.getByRole('button', { name: 'New' }));
    expect(second).toHaveBeenCalledTimes(1);
    expect(first).not.toHaveBeenCalled();
  });
});
