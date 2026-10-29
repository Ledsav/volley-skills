import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SkillGuideEditor } from './SkillGuideEditor';
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
    <I18nProvider>
      <NoticeProvider>
        <WithChrome>
          <SkillGuideEditor />
        </WithChrome>
      </NoticeProvider>
    </I18nProvider>
  );
}

describe('skill guide in Italian', () => {
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

  it('shows the Italian fallback descriptions until the guide is saved', async () => {
    mockGetDoc.mockResolvedValue({ exists: () => false });
    renderEditor();

    // The row label comes from the catalog; the items reload after it, so wait for Italian item text.
    const row = await screen.findByRole('button', { name: /Battuta.*Conta la percentuale/ });
    expect(document.querySelectorAll('li')).toHaveLength(9);
    fireEvent.click(row);
    expect(await screen.findByDisplayValue('Irregolare, molti errori.')).toBeInTheDocument();
    expect(screen.getByLabelText('Come valutare')).toBeInTheDocument();
  });

  it('shows a saved guide as stored, not translated', async () => {
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({
        skills: [
          {
            key: 'serve',
            label: 'Serve',
            ranges: [{ min: 1, max: 3, description: 'Our own wording' }],
            howToEvaluate: 'Our own evaluation notes',
          },
        ],
        updatedBy: 'someone',
        updatedAt: null,
      }),
    });
    renderEditor();

    fireEvent.click(await screen.findByRole('button', { name: /Battuta/ }));
    expect(await screen.findByDisplayValue('Our own wording')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Our own evaluation notes')).toBeInTheDocument();
    expect(screen.queryByDisplayValue('Irregolare, molti errori.')).not.toBeInTheDocument();
  });
});
