import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../auth/AuthContext', () => ({ useAuth: () => ({ club: null }) }));
vi.mock('../i18n/locales', async (orig) => ({ ...(await orig<typeof import('../i18n/locales')>()), ITALIAN_ENABLED: true }));

import { I18nProvider } from '../i18n/I18nProvider';
import { LanguageToggle } from '../i18n/LanguageToggle';
import { LanguageSettings } from './LanguageSettings';

function renderIt() {
  return render(
    <I18nProvider>
      <LanguageSettings />
      <LanguageToggle />
    </I18nProvider>,
  );
}

describe('language choice (Italian enabled)', () => {
  it('switches a visible label to Italian without a reload', async () => {
    localStorage.setItem('vcb.locale', 'en');
    renderIt();
    expect(screen.getByRole('heading', { name: 'Language' })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Language'), { target: { value: 'it' } });
    expect(await screen.findByRole('heading', { name: 'Lingua' })).toBeInTheDocument();
    expect(localStorage.getItem('vcb.locale')).toBe('it');
    expect(document.documentElement.lang).toBe('it');
  });

  it('the public toggle switches the app language and labels itself', async () => {
    localStorage.setItem('vcb.locale', 'en');
    renderIt();
    const group = screen.getByRole('group', { name: 'App language' });
    expect(group).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'IT' }));
    expect(await screen.findByRole('heading', { name: 'Lingua' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'IT' })).toHaveAttribute('aria-pressed', 'true');
  });
});
