import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PageChromeProvider, usePageChromeState, usePublishPageChrome } from './PageChrome';

function Probe() {
  const s = usePageChromeState();
  return <div data-testid="probe">{JSON.stringify({ title: s.title, action: s.mainAction?.label ?? null, more: s.more.length })}</div>;
}

function Publisher({ label }: { label: string }) {
  usePublishPageChrome({ title: 'Teams', mainAction: { label, onSelect: () => {} } });
  return null;
}

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
});
