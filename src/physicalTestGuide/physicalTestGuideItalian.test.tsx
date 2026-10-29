import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PhysicalTestGuideEditor } from './PhysicalTestGuideEditor';
import { I18nProvider } from '../i18n/I18nProvider';
import { useAuth } from '../auth/AuthContext';
import { authValue, clubAdminAccess } from '../test/authValue';
import { NoticeProvider } from '../components/Notice';
import { WithChrome } from '../test/chromeProbe';

const mockGetDoc = vi.fn();
vi.mock('firebase/firestore', () => ({
  doc: vi.fn(() => 'doc-ref'),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
  setDoc: vi.fn(),
  serverTimestamp: () => 'server-timestamp',
}));
vi.mock('../auth/AuthContext');
vi.mock('../firebase/config', () => ({ auth: {}, db: {} }));
vi.mock('../i18n/locales', async (orig) => ({ ...(await orig<typeof import('../i18n/locales')>()), ITALIAN_ENABLED: true }));

function renderEditor() {
  return render(
    <MemoryRouter>
      <NoticeProvider>
        <I18nProvider>
          <WithChrome>
            <PhysicalTestGuideEditor />
          </WithChrome>
        </I18nProvider>
      </NoticeProvider>
    </MemoryRouter>
  );
}

describe('physical test guide in Italian', () => {
  beforeEach(() => {
    mockGetDoc.mockReset();
    window.localStorage.setItem('vcb.locale', 'it');
    vi.mocked(useAuth).mockReturnValue(
      authValue({
        firebaseUser: { uid: 'coach-uid' } as never,
        appUser: { uid: 'coach-uid', email: 'coach@example.com' },
        access: clubAdminAccess,
      })
    );
  });

  it('shows the Italian fallback protocols until the guide is saved', async () => {
    mockGetDoc.mockResolvedValue({ exists: () => false });
    renderEditor();

    expect(await screen.findByText('Registra altezza (cm) e massa corporea (kg).', { exact: false })).toBeInTheDocument();
    expect(document.querySelectorAll('li button')).toHaveLength(8);
  });

  it('shows a saved guide as stored, not translated', async () => {
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({
        tests: [{ key: 'cmj', label: 'Countermovement Jump', protocol: 'Our own protocol text' }],
        updatedBy: 'someone',
        updatedAt: null,
      }),
    });
    renderEditor();

    fireEvent.click(await screen.findByRole('button', { name: /Salto con contromovimento/ }));
    expect(screen.getByDisplayValue('Our own protocol text')).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Salto con contromovimento' })).toBeInTheDocument();
    expect(screen.queryByText('Registra altezza', { exact: false })).not.toBeInTheDocument();
  });
});
