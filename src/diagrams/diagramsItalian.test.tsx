import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DiagramSaveError, diagramSaveErrorText } from './diagramSaveError';
import { Palette } from './Palette';
import { PropertiesPanel } from './PropertiesPanel';
import { createItem } from './sceneFactory';
import { I18nProvider } from '../i18n/I18nProvider';
import { en } from '../i18n/en';
import { it as itCatalog } from '../i18n/it';

vi.mock('../auth/AuthContext', () => ({ useAuth: () => ({ club: null }) }));
vi.mock('../i18n/locales', async (orig) => ({ ...(await orig<typeof import('../i18n/locales')>()), ITALIAN_ENABLED: true }));

describe('court diagrams in Italian', () => {
  beforeEach(() => {
    window.localStorage.setItem('vcb.locale', 'it');
  });

  it('labels the palette and the properties panel, while the typed role stays as written', async () => {
    const item = { ...createItem('player', { x: 10, y: 10 }), id: 'p1', label: 'OH' };
    render(
      <I18nProvider>
        <Palette onAdd={vi.fn()} variant="grid" />
        <PropertiesPanel item={item} dispatch={vi.fn()} selectedCount={1} />
      </I18nProvider>,
    );
    expect(await screen.findByRole('button', { name: 'Scaletta' })).toBeInTheDocument();
    expect(screen.getByLabelText('Ruolo')).toHaveValue('OH');
    expect(screen.getByRole('button', { name: 'blu' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sposta a sinistra' })).toBeInTheDocument();
    expect(screen.queryByText('Ladder')).not.toBeInTheDocument();
  });

  it('turns a save failure into text in the active language, keeping an English message for logs', () => {
    const err = new DiagramSaveError({ code: 'invalidScene', title: 'Setup', scene: { code: 'tooManyItems', max: 60 } });
    expect(err.message).toBe('Diagram "Setup" is invalid: a scene may hold at most 60 items');
    expect(diagramSaveErrorText(err.issue, en)).toBe(err.message);
    expect(diagramSaveErrorText(err.issue, itCatalog)).toBe('Il diagramma "Setup" non è valido: una scena può contenere al massimo 60 elementi');
  });
});
