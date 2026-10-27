import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider, useT } from '../../i18n/I18nProvider';
import { latestRosterIndex } from '../../teams/stats/rosterIndex';
import { finished } from '../testMatches';
import { storyStats } from './storyStats';

vi.mock('../../i18n/locales', async (orig) => ({ ...(await orig<typeof import('../../i18n/locales')>()), ITALIAN_ENABLED: true }));

function Probe() {
  const t = useT();
  return <p data-testid="probe">{t.awards.story.finalScore}</p>;
}

describe('storyStats in Italian', () => {
  beforeEach(() => {
    window.localStorage.setItem('vcb.locale', 'it');
  });

  it('the match record slide names the opponent in Italian', async () => {
    render(<I18nProvider><Probe /></I18nProvider>);
    expect(await screen.findByText('Risultato finale')).toBeInTheDocument();
    const ms = [finished('a', '2026-09-01', null, { opponent: 'Rivals' })];
    const [record] = storyStats('match', ms, latestRosterIndex(ms));
    expect(record).toMatchObject({ kicker: 'Risultato finale', caption: 'contro Rivals' });
  });
});
