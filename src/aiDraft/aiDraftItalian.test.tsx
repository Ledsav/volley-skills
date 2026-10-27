import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AiError } from '../ai/aiClient';
import { I18nProvider, useT } from '../i18n/I18nProvider';
import { it as itCatalog } from '../i18n/it';
import { draftErrorText } from './draftRunner';
import { draftIssueText, draftSaveErrorText } from './draftMessages';
import { buildExerciseMessages } from './exercisePrompt';
import { buildTrainingMessages } from './trainingPrompt';

vi.mock('../auth/AuthContext', () => ({ useAuth: () => ({ club: null }) }));
vi.mock('../i18n/locales', async (orig) => ({ ...(await orig<typeof import('../i18n/locales')>()), ITALIAN_ENABLED: true }));

function Probe() {
  return <p data-testid="probe">{useT().aiDraft.badge}</p>;
}

const exerciseInput = { request: 'ricezione', category: null, count: 2, existingNames: [], alreadyProposed: [] };
const trainingInput = { goal: 'g', ageGroupTarget: '', totalMinutes: 60, allowNew: true, index: [] };

describe('AI drafts in English', () => {
  it('leave the prompts without a language directive', () => {
    expect(buildExerciseMessages(exerciseInput)[0].content).not.toContain('Write all names');
    expect(buildTrainingMessages(trainingInput)[0].content).not.toContain('Write all names');
    expect(buildExerciseMessages(exerciseInput)[0].content).toContain('"Purpose:", "Setup:", "How it runs:"');
  });
});

describe('AI drafts in Italian', () => {
  beforeEach(() => {
    window.localStorage.setItem('vcb.locale', 'it');
  });

  it('asks the model for Italian names and descriptions, with Italian description headings', async () => {
    render(<I18nProvider><Probe /></I18nProvider>);
    await screen.findByText('Bozza IA');
    const exercise = buildExerciseMessages(exerciseInput)[0].content;
    expect(exercise).toContain('Write all names and descriptions in Italiano.');
    expect(exercise).toContain('"Obiettivo:", "Impostazione:", "Come si svolge:", "Punti tecnici:" (then "- " bullets), "Più facile:", "Più difficile:"');
    expect(exercise).toContain('{"exercises":[');
    expect(buildTrainingMessages(trainingInput)[0].content).toContain('Write all names and descriptions in Italiano.');
    expect(draftErrorText(new AiError('rateLimited', 'x', 429, 12))).toBe('Limite di richieste raggiunto: riprova tra 12 s.');
  });

  it('maps issue and save-error codes to Italian text', () => {
    const t = itCatalog.aiDraft;
    expect(draftIssueText({ code: 'pickCategory' }, t)).toBe('Scegli una categoria.');
    expect(draftIssueText({ code: 'itemsDropped', n: 3 }, t)).toBe('Sono stati scartati 3 elementi del diagramma.');
    expect(draftIssueText({ code: 'stepsNotInLibrary', n: 1 }, t)).toContain('1 passaggio');
    expect(draftSaveErrorText({ code: 'addFailed', name: 'B', added: ['A'] }, t)).toBe('Impossibile aggiungere “B”. Già aggiunti: A.');
    expect(draftSaveErrorText({ code: 'trainingFailed' }, t)).toBe("Impossibile salvare l'allenamento. Riprova.");
  });
});
