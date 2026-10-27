import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider, useT } from '../i18n/I18nProvider';
import { formatPhysicalTestDetail } from './physicalTestFormat';

vi.mock('../auth/AuthContext', () => ({ useAuth: () => ({ club: null }) }));
vi.mock('../firebase/config', () => ({ auth: {}, db: {} }));
vi.mock('../i18n/locales', async (orig) => ({ ...(await orig<typeof import('../i18n/locales')>()), ITALIAN_ENABLED: true }));

const common = { id: 't-1', date: '2026-09-07', notes: '', recordedBy: 'coach-uid', createdAt: null };

function Probe() {
  const t = useT();
  return <p>{t.common.loading}</p>;
}

describe('physical test detail in Italian', () => {
  beforeEach(() => window.localStorage.setItem('vcb.locale', 'it'));

  it('joins attempts with "; " so decimal commas stay readable', async () => {
    render(<I18nProvider><Probe /></I18nProvider>);
    await screen.findByText('Caricamento…');
    const rows = formatPhysicalTestDetail({ ...common, testType: 'sprint10m', attemptsSeconds: [2.35, 2.4], bestSeconds: 2.35 });
    expect(rows[0].value).toBe('2,35; 2,4 s');
  });
});
