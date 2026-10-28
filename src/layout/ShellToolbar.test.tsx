import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Plus } from 'lucide-react';
import { ShellToolbar } from './ShellToolbar';
import { PageChromeProvider, usePublishPageChrome } from './PageChrome';
import type { PageChromeState } from './PageChrome';
import { SearchProvider } from '../search/SearchProvider';
import * as search from '../search/SearchProvider';

function Publisher({ state }: { state: Partial<PageChromeState> }) {
  usePublishPageChrome(state);
  return null;
}

function mockPhone() {
  window.matchMedia = ((query: string) => ({
    matches: query.includes('max-width: 767px'),
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    onchange: null,
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

afterEach(() => {
  // @ts-expect-error restore jsdom's absence of matchMedia
  delete window.matchMedia;
  vi.restoreAllMocks();
});

function renderToolbar(state: Partial<PageChromeState> = {}) {
  return render(
    <PageChromeProvider>
      <SearchProvider>
        <Publisher state={state} />
        <ShellToolbar onOpenNav={() => {}} />
      </SearchProvider>
    </PageChromeProvider>
  );
}

describe('ShellToolbar', () => {
  it('shows the published title and main action', () => {
    const onSelect = vi.fn();
    renderToolbar({ title: 'Teams', mainAction: { label: 'New team', onSelect } });
    expect(screen.getByText('Teams')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'New team' }));
    expect(onSelect).toHaveBeenCalled();
  });

  it('shows the more menu only with items', () => {
    const { unmount } = renderToolbar();
    expect(screen.queryByRole('button', { name: 'More actions' })).not.toBeInTheDocument();
    unmount();
    renderToolbar({ more: [{ kind: 'action', label: 'Export', onSelect: () => {} }] });
    fireEvent.click(screen.getByRole('button', { name: 'More actions' }));
    expect(within(screen.getByRole('menu')).getByRole('menuitem', { name: 'Export' })).toBeInTheDocument();
  });

  it('phone main action with icon is icon-only with an accessible name', () => {
    mockPhone();
    renderToolbar({ mainAction: { label: 'New team', onSelect: () => {}, icon: Plus } });
    const button = screen.getByRole('button', { name: 'New team' });
    expect(button).toHaveAttribute('aria-label', 'New team');
    expect(button).not.toHaveTextContent('New team');
  });

  it('search entry calls open', () => {
    const open = vi.fn();
    vi.spyOn(search, 'useSearch').mockReturnValue({ open, close: () => {}, isOpen: false });
    renderToolbar();
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));
    expect(open).toHaveBeenCalled();
  });
});
