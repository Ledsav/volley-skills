import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DiagramEditorPage } from './DiagramEditorPage';
import * as diagramsApi from './diagramsApi';
import { clearDiagramClipboard } from './diagramClipboard';
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
    // The clipboard is a module-level singleton — reset it so a copy in one test
    // can't make a later paste-test pass for the wrong reason.
    clearDiagramClipboard();
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

  it('reshapes an arrow by dragging its endpoint dot', async () => {
    renderPage();
    await screen.findByDisplayValue('Setup');
    fireEvent.click(screen.getByRole('button', { name: 'Arrow' }));

    const stage = document.querySelector('[data-canvas-stage]')!;
    const path = () => stage.querySelector('[data-item-type="arrow"] path');
    await waitFor(() => expect(path()).not.toBeNull());
    const before = path()!.getAttribute('d');

    // jsdom: no PointerEvent ctor, and getBoundingClientRect is all-zeros so the
    // letterbox offset makes screenToCourt map clientX c -> (c + 0.5) * 100.
    // clientX -0.1 / clientY -0.25 therefore lands the `to` endpoint on (40, 25).
    // Use MouseEvent typed as pointer* events, same as the transform-handle test.
    const handle = stage.querySelector('[data-endpoint-index="1"]')!;
    await act(async () => {
      handle.dispatchEvent(new MouseEvent('pointerdown', { clientX: 0, clientY: 0, bubbles: true }));
    });
    await act(async () => {
      window.dispatchEvent(new MouseEvent('pointermove', { clientX: -0.1, clientY: -0.25 }));
    });
    await act(async () => {
      window.dispatchEvent(new MouseEvent('pointerup', {}));
    });

    await waitFor(() => {
      const d = path()!.getAttribute('d')!;
      expect(d).not.toBe(before);
      // `from` (M 50 50) is untouched; only the dragged `to` endpoint moved.
      expect(d).toBe('M 50 50 L 40 25');
    });
  });

  it('copies the selected item with Ctrl+C and pastes an offset clone with Ctrl+V', async () => {
    renderPage();
    await screen.findByDisplayValue('Setup');
    fireEvent.click(screen.getByRole('button', { name: 'Cone' }));

    const stage = () => document.querySelector('[data-canvas-stage]')!;
    const cones = () => stage().querySelectorAll('[data-item-type="cone"]');
    await waitFor(() => expect(cones()).toHaveLength(1));

    fireEvent.keyDown(window, { key: 'c', ctrlKey: true });
    fireEvent.keyDown(window, { key: 'v', ctrlKey: true });

    await waitFor(() => expect(cones()).toHaveLength(2));
    // In jsdom screenToCourt maps client (0,0) to court (50,50), so the original
    // cone sits at (50,50) and the pasted clone is shifted to (52.5, 52.5)...
    expect(
      [...cones()].some((c) => c.getAttribute('transform')?.includes('translate(52.5 52.5)')),
    ).toBe(true);
    // ...and the selection outline follows the new clone (bbox x = 52.5 - 6).
    expect(stage().querySelector('[data-selection-outline]')!.getAttribute('x')).toBe('46.5');
  });

  it('duplicates the selected item in place with Ctrl+D', async () => {
    renderPage();
    await screen.findByDisplayValue('Setup');
    fireEvent.click(screen.getByRole('button', { name: 'Ball' }));

    const balls = () => document.querySelectorAll('[data-canvas-stage] [data-item-type="ball"]');
    await waitFor(() => expect(balls()).toHaveLength(1));

    fireEvent.keyDown(window, { key: 'd', ctrlKey: true });
    await waitFor(() => expect(balls()).toHaveLength(2));
  });

  it('deletes the selected item with the Delete key and clears the selection', async () => {
    renderPage();
    await screen.findByDisplayValue('Setup');
    fireEvent.click(screen.getByRole('button', { name: 'Cone' }));

    const stage = () => document.querySelector('[data-canvas-stage]')!;
    await waitFor(() => expect(stage().querySelector('[data-item-type="cone"]')).not.toBeNull());

    fireEvent.keyDown(window, { key: 'Delete' });
    await waitFor(() => expect(stage().querySelector('[data-item-type="cone"]')).toBeNull());
    expect(stage().querySelector('[data-selection-outline]')).toBeNull();
  });

  it('opens a right-click menu on an item and its Duplicate action adds a copy', async () => {
    renderPage();
    await screen.findByDisplayValue('Setup');
    fireEvent.click(screen.getByRole('button', { name: 'Cone' }));

    const stage = () => document.querySelector('[data-canvas-stage]')!;
    const cone = () => stage().querySelector('[data-item-type="cone"]')!;
    await waitFor(() => expect(cone()).not.toBeNull());
    // Deselect first so the menu is what re-selects the right-clicked item.
    fireEvent.pointerDown(stage().querySelector('svg')!);

    fireEvent.contextMenu(cone(), { clientX: 40, clientY: 40 });

    const menu = await screen.findByRole('menu');
    const dup = screen.getByRole('menuitem', { name: 'Duplicate' });
    expect(menu).toBeInTheDocument();
    expect(dup).toBeEnabled();

    fireEvent.click(dup);
    await waitFor(() =>
      expect(stage().querySelectorAll('[data-item-type="cone"]')).toHaveLength(2),
    );
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('ignores clipboard shortcuts while the diagram-title input is focused', async () => {
    renderPage();
    const title = await screen.findByDisplayValue('Setup');
    fireEvent.click(screen.getByRole('button', { name: 'Cone' }));

    const stage = () => document.querySelector('[data-canvas-stage]')!;
    await waitFor(() => expect(stage().querySelectorAll('[data-item-type="cone"]')).toHaveLength(1));

    // Ctrl+C then Ctrl+V from inside the <input> must not touch the canvas...
    fireEvent.keyDown(title, { key: 'c', ctrlKey: true });
    fireEvent.keyDown(title, { key: 'v', ctrlKey: true });
    // ...and neither must Delete.
    fireEvent.keyDown(title, { key: 'Delete' });

    expect(stage().querySelectorAll('[data-item-type="cone"]')).toHaveLength(1);
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

  it('shows the active diagram\'s current court in the Court select', async () => {
    renderPage();
    await screen.findByDisplayValue('Setup');
    expect(screen.getByLabelText('Court preset')).toHaveValue('full');
  });

  it('changes the court to half via the select, re-rendering the backdrop and enabling Save', async () => {
    renderPage();
    await screen.findByDisplayValue('Setup');
    const save = screen.getByRole('button', { name: /save/i });
    expect(save).toBeDisabled();

    fireEvent.change(screen.getByLabelText('Court preset'), { target: { value: 'half' } });

    await waitFor(() => {
      const stage = document.querySelector('[data-canvas-stage]')!;
      expect(stage.querySelector('[data-court="half"]')).not.toBeNull();
    });
    expect(save).toBeEnabled();
  });

  it('toggles zone labels on via the Zones checkbox and enables Save', async () => {
    renderPage();
    await screen.findByDisplayValue('Setup');
    const save = screen.getByRole('button', { name: /save/i });
    const zones = screen.getByRole('checkbox', { name: 'Zones' });
    expect(zones).not.toBeChecked();

    fireEvent.click(zones);

    await waitFor(() => {
      const stage = document.querySelector('[data-canvas-stage]')!;
      expect(stage.querySelectorAll('[data-zone-label]').length).toBeGreaterThan(0);
    });
    expect(zones).toBeChecked();
    expect(save).toBeEnabled();
  });

  it('does not render the Court select when the exercise has no diagrams', async () => {
    vi.mocked(diagramsApi.listDiagrams).mockResolvedValueOnce([]);
    renderPage();
    expect(await screen.findByText('Add the first diagram')).toBeInTheDocument();
    expect(screen.queryByLabelText('Court preset')).not.toBeInTheDocument();
  });
});
