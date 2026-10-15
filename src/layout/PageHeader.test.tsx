import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PageHeader } from './PageHeader';

describe('PageHeader', () => {
  it('renders the title as the page h1 in the spec page-title size', () => {
    render(<PageHeader title="Teams" />);
    const h1 = screen.getByRole('heading', { level: 1, name: 'Teams' });
    expect(h1.className).toContain('text-title');
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
