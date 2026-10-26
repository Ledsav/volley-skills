import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LegalDocPage } from './LegalDocPage';
import { LegalLinks } from './LegalLinks';
import { OPERATOR } from './operator';
import { DRAFT_BANNER } from './versions';

const authState = vi.hoisted(() => ({ firebaseUser: null as null | { uid: string } }));
vi.mock('../auth/AuthContext', () => ({ useAuth: () => authState }));

function at(url: string) {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <Routes><Route path="/legal/:doc" element={<LegalDocPage />} /></Routes>
    </MemoryRouter>
  );
}

describe('LegalDocPage', () => {
  beforeEach(() => {
    authState.firebaseUser = null;
  });

  it('offers sign-in when signed out, and the way back to the app when signed in', () => {
    const first = at('/legal/terms');
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/login');
    first.unmount();
    authState.firebaseUser = { uid: 'u1' };
    at('/legal/terms');
    expect(screen.queryByRole('link', { name: 'Sign in' })).toBeNull();
    expect(screen.getByRole('link', { name: 'Back to the app' })).toHaveAttribute('href', '/');
  });

  it('shows the English terms with their banner and clause anchors', () => {
    const { container } = at('/legal/terms?lang=en');
    expect(screen.getByText(DRAFT_BANNER.en + '.')).toBeInTheDocument();
    expect(container.querySelector('h2#t12')).not.toBeNull();
    expect(screen.getByText(/Version 2026-10-22, in force since/)).toBeInTheDocument();
    expect(container.textContent).not.toContain('{{');
  });

  it('shows the Italian banner for ?lang=it', () => {
    at('/legal/terms?lang=it');
    expect(screen.getByText(DRAFT_BANNER.it + '.')).toBeInTheDocument();
  });

  it('switches language on click', () => {
    at('/legal/terms?lang=en');
    fireEvent.click(screen.getByRole('button', { name: 'Deutsch' }));
    expect(screen.getByText(DRAFT_BANNER.de + '.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Deutsch' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'English' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('says Not found for an unknown version or document', () => {
    const first = at('/legal/terms?v=1999-01-01');
    expect(screen.getByRole('heading', { name: 'Not found' })).toBeInTheDocument();
    first.unmount();
    at('/legal/nope');
    expect(screen.getByRole('heading', { name: 'Not found' })).toBeInTheDocument();
  });
});

describe('LegalLinks', () => {
  it('links the legal texts and a Report content mailto', () => {
    render(<MemoryRouter><LegalLinks /></MemoryRouter>);
    expect(screen.getByRole('link', { name: 'Terms' })).toHaveAttribute('href', '/legal/terms');
    expect(screen.getByRole('link', { name: 'Report content' })).toHaveAttribute('href', `mailto:${OPERATOR.contactEmail}`);
  });
});
