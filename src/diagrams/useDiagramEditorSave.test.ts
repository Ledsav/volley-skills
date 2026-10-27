import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as diagramsApi from './diagramsApi';
import { DiagramSaveError } from './diagramSaveError';
import { createItem, emptyScene } from './sceneFactory';
import { useDiagramEditor } from './useDiagramEditor';

vi.mock('./diagramsApi');
vi.mock('../firebase/config', () => ({ auth: {}, db: {} }));

async function dirtyEditor() {
  vi.mocked(diagramsApi.listDiagrams).mockResolvedValue([
    { id: 'd1', title: 'Setup', order: 0, scene: emptyScene('full'), updatedBy: 'u', updatedAt: null },
  ]);
  const hook = renderHook(() => useDiagramEditor('ex-1', 'uid'));
  await waitFor(() => expect(hook.result.current.activeDiagram).not.toBeNull());
  act(() => hook.result.current.dispatch({ type: 'addItem', item: { ...createItem('cone', { x: 1, y: 1 }), id: 'x' } }));
  return hook;
}

describe('useDiagramEditor save failures', () => {
  let logged: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    logged = vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => logged.mockRestore());

  it('shows the generic text and logs when the write fails for any other reason', async () => {
    vi.mocked(diagramsApi.saveDiagramSet).mockRejectedValue(Object.assign(new Error('permission-denied'), { code: 'permission-denied' }));
    const { result } = await dirtyEditor();
    await act(() => result.current.save());
    expect(result.current.saveError).toBe('Could not save diagrams. Please try again.');
    expect(logged).toHaveBeenCalledWith('Diagram save failed', 'permission-denied', expect.any(Error));
  });

  it('shows the mapped text of a diagram check failure without logging it', async () => {
    vi.mocked(diagramsApi.saveDiagramSet).mockRejectedValue(new DiagramSaveError({ code: 'titleLength', title: '' }));
    const { result } = await dirtyEditor();
    await act(() => result.current.save());
    expect(result.current.saveError).toBe('Diagram "(untitled)" needs a title of 1–40 characters.');
    expect(logged).not.toHaveBeenCalled();
  });
});
