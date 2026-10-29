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

describe('useDiagramEditor save pipeline (B2)', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.mocked(diagramsApi.saveDiagramSet).mockReset();
    vi.mocked(diagramsApi.saveDiagramSet).mockResolvedValue({ idMap: {} });
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('autosaves 3 s after the last change, once', async () => {
    await dirtyEditor();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2900);
    });
    expect(diagramsApi.saveDiagramSet).not.toHaveBeenCalled();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(200);
    });
    expect(diagramsApi.saveDiagramSet).toHaveBeenCalledTimes(1);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10000);
    });
    expect(diagramsApi.saveDiagramSet).toHaveBeenCalledTimes(1);
  });

  it('pagehide flushes a pending change at once', async () => {
    await dirtyEditor();
    await act(async () => {
      window.dispatchEvent(new Event('pagehide'));
    });
    expect(diagramsApi.saveDiagramSet).toHaveBeenCalledTimes(1);
  });

  it('a hidden page flushes too', async () => {
    await dirtyEditor();
    const spy = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    spy.mockRestore();
    expect(diagramsApi.saveDiagramSet).toHaveBeenCalledTimes(1);
  });

  it('beforeunload warns while edits exist only in memory or a save is failing, not once handed over', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { result } = await dirtyEditor();
    const mem = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(mem);
    expect(mem.defaultPrevented).toBe(true);
    await act(() => result.current.save());
    const clean = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(clean);
    expect(clean.defaultPrevented).toBe(false);
    vi.mocked(diagramsApi.saveDiagramSet).mockRejectedValue(new Error('x'));
    act(() => result.current.dispatch({ type: 'undo' }));
    await act(() => result.current.save());
    const after = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(after);
    expect(after.defaultPrevented).toBe(true);
  });

  it('status is saving while dirty, failed after a rejected save, saved after a success', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { result } = await dirtyEditor();
    expect(result.current.status).toBe('saving');
    vi.mocked(diagramsApi.saveDiagramSet).mockRejectedValueOnce(new Error('x'));
    await act(() => result.current.save());
    expect(result.current.status).toBe('failed');
    await act(() => result.current.save());
    expect(result.current.status).toBe('saved');
  });

  it('unmount during an in-flight save writes the later edits under the real ids', async () => {
    let resolveFirst!: (v: { idMap: Record<string, string> }) => void;
    vi.mocked(diagramsApi.saveDiagramSet)
      .mockImplementationOnce((_e, ops, _u, onQueued) => {
        onQueued?.(Object.fromEntries(ops.creates.map((c) => [c.tempId, 'real-2'])));
        return new Promise((res) => { resolveFirst = res; });
      })
      .mockResolvedValue({ idMap: {} });
    vi.mocked(diagramsApi.listDiagrams).mockResolvedValue([
      { id: 'd1', title: 'Setup', order: 0, scene: emptyScene('full'), updatedBy: 'u', updatedAt: null },
    ]);
    const { result, unmount } = renderHook(() => useDiagramEditor('ex-1', 'uid'));
    await waitFor(() => expect(result.current.activeDiagram).not.toBeNull());
    act(() => result.current.dispatch({ type: 'addDiagram' }));
    const t = result.current.state.activeDiagramId as string;
    let flushed!: Promise<void>;
    act(() => {
      flushed = result.current.flush();
    });
    expect(diagramsApi.saveDiagramSet).toHaveBeenCalledTimes(1);
    act(() => result.current.dispatch({ type: 'addItem', item: { ...createItem('cone', { x: 1, y: 1 }), id: 'x' } }));
    unmount();
    await act(async () => {
      resolveFirst({ idMap: { [t]: 'real-2' } });
      await flushed;
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(diagramsApi.saveDiagramSet).toHaveBeenCalledTimes(2);
    const ops = vi.mocked(diagramsApi.saveDiagramSet).mock.calls[1][1];
    expect(ops.creates).toEqual([]);
    expect(ops.updates).toHaveLength(1);
    expect(ops.updates[0].id).toBe('real-2');
    expect(ops.updates[0].scene.items.map((i) => i.id)).toEqual(['x']);
  });

  it('an undo after a save is autosaved', async () => {
    const { result } = await dirtyEditor();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3100);
    });
    expect(diagramsApi.saveDiagramSet).toHaveBeenCalledTimes(1);
    act(() => result.current.dispatch({ type: 'undo' }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3100);
    });
    expect(diagramsApi.saveDiagramSet).toHaveBeenCalledTimes(2);
    const ops = vi.mocked(diagramsApi.saveDiagramSet).mock.calls[1][1];
    expect(ops.updates[0].scene.items).toHaveLength(0);
  });

  it('a follow-up batch is queued at once, without waiting for the first ack, under the real ids (I-3)', async () => {
    let resolveFirst!: (v: { idMap: Record<string, string> }) => void;
    vi.mocked(diagramsApi.saveDiagramSet)
      .mockImplementationOnce((_e, ops, _u, onQueued) => {
        onQueued?.(Object.fromEntries(ops.creates.map((c) => [c.tempId, 'real-2'])));
        return new Promise((res) => { resolveFirst = res; });
      })
      .mockResolvedValue({ idMap: {} });
    vi.mocked(diagramsApi.listDiagrams).mockResolvedValue([
      { id: 'd1', title: 'Setup', order: 0, scene: emptyScene('full'), updatedBy: 'u', updatedAt: null },
    ]);
    const { result } = renderHook(() => useDiagramEditor('ex-1', 'uid'));
    await waitFor(() => expect(result.current.activeDiagram).not.toBeNull());
    act(() => result.current.dispatch({ type: 'addDiagram' }));
    act(() => void result.current.save());
    act(() => result.current.dispatch({ type: 'addItem', item: { ...createItem('cone', { x: 1, y: 1 }), id: 'x' } }));
    await act(() => result.current.flush());
    expect(diagramsApi.saveDiagramSet).toHaveBeenCalledTimes(2);
    const ops = vi.mocked(diagramsApi.saveDiagramSet).mock.calls[1][1];
    expect(ops.creates).toEqual([]);
    expect(ops.updates.map((u) => u.id)).toEqual(['real-2']);
    await act(async () => resolveFirst({ idMap: {} }));
  });

  it('an edit dispatched but not rendered when the ack lands stays dirty and is written next (I-1)', async () => {
    vi.mocked(diagramsApi.saveDiagramSet)
      .mockImplementationOnce(async (_e, _o, _u, onQueued) => {
        result.current.dispatch({ type: 'addItem', item: { ...createItem('cone', { x: 2, y: 2 }), id: 'late' } });
        onQueued?.({});
        return { idMap: {} };
      })
      .mockResolvedValue({ idMap: {} });
    const { result } = await dirtyEditor();
    await act(() => result.current.save());
    expect(result.current.dirty).toBe(true);
    await act(() => result.current.flush());
    expect(diagramsApi.saveDiagramSet).toHaveBeenCalledTimes(2);
    const ops = vi.mocked(diagramsApi.saveDiagramSet).mock.calls[1][1];
    expect(ops.updates[0].scene.items.map((i) => i.id)).toEqual(['x', 'late']);
    expect(result.current.dirty).toBe(false);
  });

  it('a commit that fails after it was queued makes the edits dirty again and reports failed', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(diagramsApi.saveDiagramSet).mockImplementationOnce(async (_e, _o, _u, onQueued) => {
      onQueued?.({});
      throw Object.assign(new Error('offline'), { code: 'unavailable' });
    });
    const { result } = await dirtyEditor();
    await act(() => result.current.save());
    expect(result.current.dirty).toBe(true);
    expect(result.current.status).toBe('failed');
    await act(() => result.current.save());
    expect(result.current.status).toBe('saved');
  });
});

describe('a rejected save waits for the next change or Retry (fix round 2)', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(diagramsApi.saveDiagramSet).mockReset();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  const rejecting = (code: string) => (_e: string, _o: unknown, _u: string, onQueued?: (m: Record<string, string>) => void) => {
    onQueued?.({});
    return Promise.reject(Object.assign(new Error(code), { code }));
  };

  async function failedEditor(code = 'permission-denied') {
    vi.mocked(diagramsApi.saveDiagramSet).mockImplementation(rejecting(code) as never);
    const hook = await dirtyEditor();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3100);
    });
    expect(diagramsApi.saveDiagramSet).toHaveBeenCalledTimes(1);
    return hook;
  }

  it.each(['permission-denied', 'not-found'])('a %s rejection makes exactly one attempt over 15 s idle', async (code) => {
    const { result } = await failedEditor(code);
    expect(result.current.status).toBe('failed');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(15000);
    });
    expect(diagramsApi.saveDiagramSet).toHaveBeenCalledTimes(1);
    expect(result.current.status).toBe('failed');
  });

  it('keeps warning on leave while failed', async () => {
    await failedEditor();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(15000);
    });
    const ev = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(true);
  });

  it('an edit after the failure makes one new attempt', async () => {
    const { result } = await failedEditor();
    act(() => result.current.dispatch({ type: 'addItem', item: { ...createItem('cone', { x: 3, y: 3 }), id: 'y' } }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3100);
    });
    expect(diagramsApi.saveDiagramSet).toHaveBeenCalledTimes(2);
  });

  it('Retry makes one attempt', async () => {
    const { result } = await failedEditor();
    await act(() => result.current.save());
    expect(diagramsApi.saveDiagramSet).toHaveBeenCalledTimes(2);
  });

  it('is never saved while an error is set', async () => {
    vi.mocked(diagramsApi.saveDiagramSet).mockImplementation(rejecting('permission-denied') as never);
    const { result } = await dirtyEditor();
    await act(() => result.current.save());
    expect(result.current.saveError).not.toBeNull();
    act(() => result.current.dispatch({ type: 'loaded', diagrams: [] }));
    expect(result.current.dirty).toBe(false);
    expect(result.current.status).toBe('failed');
    // Nothing is left to lose: Retry clears the error instead of doing nothing.
    await act(() => result.current.save());
    expect(result.current.saveError).toBeNull();
    expect(result.current.status).toBe('saved');
  });

  it('a failure that leaves nothing unsaved does not leave a stuck error (m-1)', async () => {
    const { result } = await dirtyEditor();
    vi.mocked(diagramsApi.saveDiagramSet).mockImplementation(((_e: string, _o: unknown, _u: string, onQueued?: (m: Record<string, string>) => void) => {
      onQueued?.({});
      result.current.dispatch({ type: 'loaded', diagrams: [] });
      return new Promise((_res, rej) => setTimeout(() => rej(Object.assign(new Error('x'), { code: 'permission-denied' })), 10));
    }) as never);
    let done!: Promise<void>;
    act(() => {
      done = result.current.save();
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(20);
      await done;
    });
    expect(result.current.saveError).toBeNull();
    expect(result.current.status).toBe('saved');
    const ev = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(false);
  });
});
