import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DiagramEditorPage } from './DiagramEditorPage';
import * as diagramsApi from './diagramsApi';
import { useAuth } from '../auth/AuthContext';

vi.mock('./diagramsApi');
vi.mock('../auth/AuthContext');
vi.mock('../firebase/config', () => ({ auth: {}, db: {} }));

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/exercises/ex-1/diagram']}>
      <Routes>
        <Route path="/exercises/:exerciseId/diagram" element={<DiagramEditorPage />} />
        <Route path="/exercises" element={<div>Exercises list</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('DiagramEditorPage', () => {
  beforeEach(() => {
    // Reset call history between tests: the save-on-unmount safety net means a
    // test that leaves the editor dirty records a saveDiagramSet call on cleanup,
    // which would otherwise leak into the next test's call count.
    vi.clearAllMocks();
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
    // Let the save settle (dispatch `saved` → dirty clears → button re-disables)
    // so the now-live save-on-unmount safety net doesn't flush a second call.
    await waitFor(() => expect(save).toBeDisabled());
    expect(diagramsApi.saveDiagramSet).toHaveBeenCalledTimes(1);
  });

  it('undo removes the last added item and redo restores it', async () => {
    renderPage();
    await screen.findByDisplayValue('Setup');
    const undo = screen.getByRole('button', { name: 'Undo' });
    expect(undo).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'Cone' }));
    const stage = () => document.querySelector('[data-canvas-stage]')!;
    await waitFor(() => expect(stage().querySelector('[data-item-type="cone"]')).not.toBeNull());
    expect(undo).toBeEnabled();

    fireEvent.click(undo);
    await waitFor(() => expect(stage().querySelector('[data-item-type="cone"]')).toBeNull());

    fireEvent.click(screen.getByRole('button', { name: 'Redo' }));
    await waitFor(() => expect(stage().querySelector('[data-item-type="cone"]')).not.toBeNull());
  });

  it('flushes an unsaved change to saveDiagramSet when the editor unmounts', async () => {
    const { unmount } = renderPage();
    await screen.findByDisplayValue('Setup');
    fireEvent.click(screen.getByRole('button', { name: 'Ball' }));
    await waitFor(() => expect(screen.getByRole('button', { name: /save/i })).toBeEnabled());
    await act(async () => {
      unmount();
    });
    await waitFor(() => expect(diagramsApi.saveDiagramSet).toHaveBeenCalled());
  });

  it('renders a load error instead of the editor when listDiagrams rejects', async () => {
    vi.mocked(diagramsApi.listDiagrams).mockRejectedValueOnce(new Error('boom'));
    renderPage();
    expect(await screen.findByText(/could not load diagrams/i)).toBeInTheDocument();
  });

  it('resizes and rotates the selected point item by dragging its transform handle', async () => {
    renderPage();
    await screen.findByDisplayValue('Setup');
    fireEvent.click(screen.getByRole('button', { name: 'Cone' }));

    const stage = document.querySelector('[data-canvas-stage]')!;
    const cone = () => stage.querySelector('[data-item-type="cone"]');
    await waitFor(() => expect(cone()).not.toBeNull());
    expect(cone()!.getAttribute('transform')).toContain('rotate(0)');
    expect(cone()!.getAttribute('transform')).toContain('scale(1)');

    // jsdom lacks a PointerEvent constructor and its getBoundingClientRect is
    // all-zeros, so use MouseEvent (carries clientX/Y) typed as pointer* events.
    // screenToCourt is then linear in client coords; the pointer starts on the
    // +x axis from the centre and ends up-and-out, so the same drag pushes the
    // radius past 2× (size clamps to 2) AND sweeps a ~37° arc (snaps to 30°).
    const handle = stage.querySelector('[data-transform-handle]')!;
    await act(async () => {
      handle.dispatchEvent(new MouseEvent('pointerdown', { clientX: 10, clientY: 0, bubbles: true }));
    });
    await act(async () => {
      window.dispatchEvent(new MouseEvent('pointermove', { clientX: 40, clientY: 30 }));
    });
    await act(async () => {
      window.dispatchEvent(new MouseEvent('pointerup', {}));
    });

    await waitFor(() => {
      const t = cone()!.getAttribute('transform')!;
      expect(t).toMatch(/scale\(2\)/);
      expect(t).toMatch(/rotate\(30\)/);
    });
  });

  it('confirms before leaving via "‹ Exercises" when the editor is dirty', async () => {
    renderPage();
    await screen.findByDisplayValue('Setup');
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

    // Make the editor dirty by adding an element.
    fireEvent.click(screen.getByRole('button', { name: 'Ball' }));
    await waitFor(() => expect(screen.getByRole('button', { name: /save/i })).toBeEnabled());

    fireEvent.click(screen.getByRole('button', { name: '‹ Exercises' }));
    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(await screen.findByText('Exercises list')).toBeInTheDocument();
  });
});
