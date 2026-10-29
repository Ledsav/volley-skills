import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useGuideEditor } from './useGuideEditor';
import { useAuth } from '../auth/AuthContext';
import { authValue, clubAdminAccess } from '../test/authValue';
import { I18nProvider } from '../i18n/I18nProvider';
import { NoticeProvider } from '../components/Notice';
import { WithChrome } from '../test/chromeProbe';
import type { ReactNode } from 'react';

vi.mock('../auth/AuthContext');
vi.mock('../firebase/config', () => ({ auth: {}, db: {} }));

type Item = { key: string; text: string };
const messages = { loadError: 'load failed', saveError: 'save failed', saved: 'saved' };

function wrapper({ children }: { children: ReactNode }) {
  return <I18nProvider><NoticeProvider><WithChrome>{children}</WithChrome></NoticeProvider></I18nProvider>;
}

beforeEach(() => {
  vi.mocked(useAuth).mockReturnValue(authValue({ firebaseUser: { uid: 'u' } as never, access: clubAdminAccess }));
});

describe('useGuideEditor', () => {
  it('does not reload over an unsaved draft when the catalog changes', async () => {
    const load = vi.fn(async () => ({ items: [{ key: 'a', text: 'original' }] as Item[], stored: true }));
    const save = vi.fn();
    const { result, rerender } = renderHook(
      ({ on }) => useGuideEditor<Item>({ load, save, reloadOn: on, messages, active: true }),
      { wrapper, initialProps: { on: 'en' } },
    );
    await waitFor(() => expect(result.current.loaded).toBe(true));
    act(() => result.current.replace({ key: 'a', text: 'edited' }));
    expect(result.current.items[0].text).toBe('edited');
    rerender({ on: 'it' });
    await Promise.resolve();
    expect(load).toHaveBeenCalledTimes(1);
    expect(result.current.items[0].text).toBe('edited');
  });

  it('clears the load error once a later load succeeds', async () => {
    const load = vi.fn()
      .mockRejectedValueOnce(new Error('denied'))
      .mockResolvedValueOnce({ items: [{ key: 'a', text: 'ok' }], stored: true });
    const { result, rerender } = renderHook(
      ({ on }) => useGuideEditor<Item>({ load, save: vi.fn(), reloadOn: on, messages, active: true }),
      { wrapper, initialProps: { on: 'en' } },
    );
    await waitFor(() => expect(result.current.loadError).toBe('load failed'));
    rerender({ on: 'it' });
    await waitFor(() => expect(result.current.loadError).toBeNull());
    expect(result.current.items).toEqual([{ key: 'a', text: 'ok' }]);
    expect(result.current.loaded).toBe(true);
  });
});
