import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LegalReviewScreen } from './LegalReviewScreen';
import { useAuth } from '../auth/AuthContext';
import { I18nProvider } from '../i18n/I18nProvider';
import { authValue, clubAdminAccess, testClub } from '../test/authValue';

import { EMPTY_ONBOARDING } from '../onboarding/onboardingState';
vi.mock('../auth/AuthContext');
vi.mock('../clubs/clubAdminApi');
vi.mock('../auth/reauth', () => ({ sendSigningLink: vi.fn().mockResolvedValue(undefined) }));
vi.mock('../components/Notice', () => ({ useNotify: () => vi.fn() }));
vi.mock('../firebase/signOut', () => ({ signOutAndClearLocalData: vi.fn() }));
vi.mock('../firebase/config', () => ({ auth: {}, db: {} }));
vi.mock('../i18n/locales', async (orig) => ({ ...(await orig<typeof import('../i18n/locales')>()), ITALIAN_ENABLED: true }));

describe('LegalReviewScreen in Italian', () => {
  beforeEach(() => {
    window.localStorage.setItem('vcb.locale', 'it');
    vi.mocked(useAuth).mockReturnValue(authValue({
      role: 'admin', access: clubAdminAccess, club: testClub({ legal: null }),
      appUser: { uid: 'u-1', email: 'admin@example.com', onboarding: EMPTY_ONBOARDING },
    }));
  });

  it('shows Italian chrome around the Italian document', async () => {
    render(<MemoryRouter><I18nProvider><LegalReviewScreen /></I18nProvider></MemoryRouter>);
    expect(await screen.findByRole('heading', { name: 'Accetta le Condizioni e il DPA' })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Il tuo nome'), { target: { value: 'Ada' } });
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Avanti' }));

    expect(screen.getByText('Prima versione delle Condizioni di servizio.')).toBeInTheDocument();
    expect(screen.getByText("Prima versione dell'Accordo sul trattamento dei dati.")).toBeInTheDocument();
    expect(screen.queryByText('First version of the Terms of Service.')).not.toBeInTheDocument();
    // The document language is its own switch, independent of the app language.
    fireEvent.click(screen.getByRole('button', { name: 'Italiano' }));
    expect(screen.getByRole('group', { name: 'Lingua del testo legale' })).toBeInTheDocument();
    const terms = screen.getByRole('region', { name: 'Condizioni di servizio' });
    expect(within(terms).getByRole('heading', { level: 1, name: 'Condizioni di servizio' })).toBeInTheDocument();
    expect(screen.getAllByText(/Apri in una nuova scheda/).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Avanti' })).toBeInTheDocument();
    expect(screen.queryByText('Open in a new tab')).not.toBeInTheDocument();
  });
});
