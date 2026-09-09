import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DiagramEditorPage } from './DiagramEditorPage';
import * as diagramsApi from './diagramsApi';
import { useAuth } from '../auth/AuthContext';

vi.mock('./diagramsApi');
vi.mock('../auth/AuthContext');
vi.mock('../firebase/config', () => ({ auth: {}, db: {} }));

// A data router is required because DiagramEditorPage uses useBlocker().
function renderPage() {
  const router = createMemoryRouter(
    [
      { path: '/exercises/:exerciseId/diagram', element: <DiagramEditorPage /> },
      { path: '/exercises', element: <div>Exercises list</div> },
    ],
    { initialEntries: ['/exercises/ex-1/diagram'] },
  );
  return render(<RouterProvider router={router} />);
}

describe('DiagramEditorPage', () => {
  beforeEach(() => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    vi.mocked(useAuth).mockReturnValue({
      firebaseUser: { uid: 'coach-uid', email: 'c@e.com' } as never,
      appUser: null,
      loading: false,
      authError: null,
    });
    vi.mocked(diagramsApi.listDiagrams).mockResolvedValue([
      { id: 'd1', title: 'Setup', order: 0, scene: { v: 1, court: 'full', showZones: false, items: [] }, updatedBy: 'x', updatedAt: null },
    ]);
    vi.mocked(diagramsApi.saveDiagramSet).mockResolvedValue({ idMap: {} });
  });

  it('loads the diagram set and shows its tab', async () => {
    renderPage();
    expect(await screen.findByDisplayValue('Setup')).toBeInTheDocument();
  });

  it('adds an element from the palette and shows it selected in the canvas', async () => {
    renderPage();
    await screen.findByDisplayValue('Setup');
    fireEvent.click(screen.getByRole('button', { name: 'Cone' }));
    await waitFor(() => {
      const container = document.querySelector('[data-canvas-stage]')!;
      expect(container.querySelector('[data-item-type="cone"]')).not.toBeNull();
      expect(container.querySelector('[data-selection-outline]')).not.toBeNull();
    });
  });

  it('keeps Save disabled until a change, then calls saveDiagramSet once', async () => {
    renderPage();
    await screen.findByDisplayValue('Setup');
    const save = screen.getByRole('button', { name: /save/i });
    expect(save).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Ball' }));
    await waitFor(() => expect(save).toBeEnabled());
    fireEvent.click(save);
    await waitFor(() => expect(diagramsApi.saveDiagramSet).toHaveBeenCalledTimes(1));
  });

  it('renders a load error instead of the editor when listDiagrams rejects', async () => {
    vi.mocked(diagramsApi.listDiagrams).mockRejectedValueOnce(new Error('boom'));
    renderPage();
    expect(await screen.findByText(/could not load diagrams/i)).toBeInTheDocument();
  });
});
