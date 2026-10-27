import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ExerciseFormDialog } from './ExerciseFormDialog';
import * as exercisesApi from './exercisesApi';
import { useAuth } from '../auth/AuthContext';
import { I18nProvider } from '../i18n/I18nProvider';
import { authValue } from '../test/authValue';

vi.mock('./exercisesApi');
vi.mock('../auth/AuthContext');
vi.mock('../diagrams/diagramsApi');
vi.mock('../firebase/config', () => ({ auth: {}, db: {} }));
vi.mock('../i18n/locales', async (orig) => ({ ...(await orig<typeof import('../i18n/locales')>()), ITALIAN_ENABLED: true }));

describe('exercise form in Italian', () => {
  beforeEach(async () => {
    window.localStorage.setItem('vcb.locale', 'it');
    const diagramsApi = await import('../diagrams/diagramsApi');
    vi.mocked(diagramsApi.listDiagrams).mockResolvedValue([]);
  });

  it('shows the category in Italian but saves the English code', async () => {
    vi.mocked(useAuth).mockReturnValue(authValue({ firebaseUser: { uid: 'coach-uid', email: 'coach@example.com' } as never }));
    const createSpy = vi.spyOn(exercisesApi, 'createExercise').mockResolvedValue('ex-1');
    const onSaved = vi.fn();

    render(
      <MemoryRouter>
        <I18nProvider>
          <ExerciseFormDialog onClose={vi.fn()} onSaved={onSaved} />
        </I18nProvider>
      </MemoryRouter>,
    );

    fireEvent.change(await screen.findByLabelText('Nome'), { target: { value: 'Reception: battute miste' } });
    const category = screen.getByLabelText('Categoria');
    expect(screen.getByRole('option', { name: 'Ricezione' })).toBeInTheDocument();
    fireEvent.change(category, { target: { value: 'reception' } });
    fireEvent.click(screen.getByText('Salva'));

    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(createSpy).toHaveBeenCalledWith(
      { name: 'Reception: battute miste', description: '', category: 'reception' },
      'coach-uid',
    );
  });
});
