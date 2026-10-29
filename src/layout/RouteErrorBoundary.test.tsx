import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PageContainer } from './PageContainer';
import { RouteErrorBoundary, RouteLoadError } from './RouteErrorBoundary';

function Broken(): never {
  throw new TypeError('Failed to fetch dynamically imported module: /src/matches/scout/ScoutPage.tsx');
}

describe('RouteErrorBoundary', () => {
  afterEach(() => vi.restoreAllMocks());

  it('shows the load-error screen with a Reload action instead of a blank page', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <RouteErrorBoundary fallback={<RouteLoadError />}>
        <Broken />
      </RouteErrorBoundary>,
    );
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: "This page didn't load" })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reload' })).toBeInTheDocument();
  });

  it('renders its children when nothing fails', () => {
    render(
      <RouteErrorBoundary fallback={<RouteLoadError />}>
        <p>Scouting</p>
      </RouteErrorBoundary>,
    );
    expect(screen.getByText('Scouting')).toBeInTheDocument();
  });
});

describe('PageContainer', () => {
  it('uses the page gutter and the content cap, or the form cap', () => {
    const { rerender } = render(<PageContainer data-testid="page">x</PageContainer>);
    const page = screen.getByTestId('page');
    expect(page).toHaveAttribute('data-page-container', 'content');
    expect(page.className).toContain('px-[var(--page-gutter)]');
    expect(page.className).toContain('1080px');
    rerender(<PageContainer data-testid="page" width="form">x</PageContainer>);
    expect(screen.getByTestId('page').className).toContain('720px');
  });
});
