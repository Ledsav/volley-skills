import { act, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const gate = vi.hoisted(() => {
  let release!: () => void;
  const promise = new Promise<void>((r) => {
    release = r;
  });
  return { promise, release };
});

vi.mock('./locales', async (orig) => ({ ...(await orig<typeof import('./locales')>()), ITALIAN_ENABLED: true }));
vi.mock('./it', async () => {
  await gate.promise;
  const { en } = await import('./en');
  return { it: { common: { ...en.common, save: 'Salva' } } };
});

import { getLocale, getT, I18nProvider, useLocale, useT } from './I18nProvider';

function Probe() {
  const t = useT();
  const { locale, setLocale } = useLocale();
  return (
    <div>
      <span data-testid="save">{String(t.common.save)}</span>
      <span data-testid="locale">{locale}</span>
      <button onClick={() => setLocale('it')}>go-it</button>
    </div>
  );
}

describe('I18nProvider', () => {
  beforeEach(() => localStorage.setItem('vcb.locale', 'en'));

  it('keeps English until the Italian catalog has loaded', async () => {
    render(
      <I18nProvider>
        <Probe />
      </I18nProvider>,
    );
    expect(screen.getByTestId('save')).toHaveTextContent('Save');
    act(() => screen.getByText('go-it').click());
    expect(localStorage.getItem('vcb.locale')).toBe('it');
    expect(document.documentElement.lang).toBe('it');
    // Still pending: English, never undefined.
    expect(screen.getByTestId('save')).toHaveTextContent('Save');
    expect(getT().common.save).toBe('Save');
    expect(getLocale()).toBe('en');
    await act(async () => gate.release());
    await waitFor(() => expect(screen.getByTestId('save')).toHaveTextContent('Salva'));
    expect(getT().common.save).toBe('Salva');
    expect(getLocale()).toBe('it');
  });
});
