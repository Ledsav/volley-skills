import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider, useT } from '../i18n/I18nProvider';
import { exerciseNameExample, exerciseNameHint, followsExerciseNaming, trainingNameHint } from './naming';

vi.mock('../auth/AuthContext', () => ({ useAuth: () => ({ club: null }) }));
vi.mock('../i18n/locales', async (orig) => ({ ...(await orig<typeof import('../i18n/locales')>()), ITALIAN_ENABLED: true }));

function Probe() {
  return <p data-testid="probe">{useT().aiDraft.naming.exerciseExample}</p>;
}

describe('exercise naming in English', () => {
  it('does not accept Italian focus words', () => {
    expect(followsExerciseNaming('Ricezione: battute miste sul bersaglio')).toBe(false);
  });
});

describe('exercise naming in Italian', () => {
  beforeEach(() => {
    window.localStorage.setItem('vcb.locale', 'it');
  });

  it('accepts the focus word in Italian or in English, and shows Italian examples and hints', async () => {
    render(<I18nProvider><Probe /></I18nProvider>);
    await screen.findByText('Ricezione: battute miste sul bersaglio');
    expect(exerciseNameExample()).toBe('Ricezione: battute miste sul bersaglio');
    expect(followsExerciseNaming('Ricezione: battute miste sul bersaglio')).toBe(true);
    expect(followsExerciseNaming('Alzata: palleggio a due mani')).toBe(true);
    expect(followsExerciseNaming('Reception: mixed serves to target')).toBe(true);
    expect(followsExerciseNaming('2 contro 2 Ricezione')).toBe(false);
    expect(followsExerciseNaming('Ricezione:')).toBe(false);
    expect(exerciseNameHint()).toContain('Riscaldamento, Fisico, Test, Battuta, Ricezione');
    expect(trainingNameHint()).toContain('Ricezione + free ball: controllo e conversione');
  });
});
