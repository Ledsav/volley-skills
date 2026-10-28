import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PageHeader } from './PageHeader';
import { PageChromeProvider, usePageChromeState } from './PageChrome';

function Probe() {
  const s = usePageChromeState();
  return <div data-testid="probe">{`${s.title ?? 'none'}|${s.mainAction?.label ?? 'none'}`}</div>;
}

describe('PageHeader', () => {
  it('renders the title as the large title h1', () => {
    render(<PageHeader title="Teams" />);
    const h1 = screen.getByRole('heading', { level: 1, name: 'Teams' });
    expect(h1).toHaveClass('text-large-title');
    expect(h1).toHaveClass('md:text-title-1');
  });

  it('does not render mainAction in the content', () => {
    render(<PageHeader title="Teams" mainAction={{ label: 'New team', onSelect: () => {} }} />);
    expect(screen.queryByText('New team')).not.toBeInTheDocument();
  });

  it('does not render more items in the content', () => {
    render(<PageHeader title="Teams" more={[{ kind: 'action', label: 'Export list', onSelect: () => {} }]} />);
    expect(screen.queryByText('Export list')).not.toBeInTheDocument();
  });

  it('publishes a string title, or chromeTitle for a node title', () => {
    const { rerender } = render(
      <PageChromeProvider>
        <Probe />
        <PageHeader title="Teams" mainAction={{ label: 'New team', onSelect: () => {} }} />
      </PageChromeProvider>
    );
    expect(screen.getByTestId('probe')).toHaveTextContent('Teams|New team');
    rerender(
      <PageChromeProvider>
        <Probe />
        <PageHeader title={<span>U17</span>} chromeTitle="U17 team" />
      </PageChromeProvider>
    );
    expect(screen.getByTestId('probe')).toHaveTextContent('U17 team|none');
  });

  it('renders eyebrow, description and actions when given', () => {
    render(<PageHeader title="vs Rivals" eyebrow="2026-10-01" description="League" actions={<button>Delete</button>} />);
    expect(screen.getByText('2026-10-01')).toBeInTheDocument();
    expect(screen.getByText('League')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete' }).parentElement?.className).toContain('sm:flex');
  });

  it('renders no actions container without actions', () => {
    const { container } = render(<PageHeader title="Access" />);
    expect(container.querySelector('[data-page-header]')?.children).toHaveLength(1);
  });
});
