import { afterEach, describe, expect, it, vi } from 'vitest';
import { shareOrDownload } from './shareFile';

describe('shareOrDownload', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    // @ts-expect-error test cleanup
    delete navigator.share; // @ts-expect-error test cleanup
    delete navigator.canShare;
  });

  it('shares when files can be shared', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { share, canShare: () => true });
    const f = new File(['x'], 'a.png', { type: 'image/png' });
    expect(await shareOrDownload([f], 'MVP')).toBe('shared');
    expect(share).toHaveBeenCalledWith({ files: [f], title: 'MVP' });
  });

  it('treats a dismissed share sheet as cancelled', async () => {
    Object.assign(navigator, { share: vi.fn().mockRejectedValue(Object.assign(new Error('x'), { name: 'AbortError' })), canShare: () => true });
    expect(await shareOrDownload([new File(['x'], 'a.png')], 'MVP')).toBe('cancelled');
  });

  it('falls back to downloads', async () => {
    vi.useFakeTimers();
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    URL.createObjectURL = vi.fn(() => 'blob:x');
    URL.revokeObjectURL = vi.fn();
    const p = shareOrDownload([new File(['x'], 'a.png'), new File(['y'], 'b.png')], 'Awards');
    await vi.advanceTimersByTimeAsync(300);
    expect(click).toHaveBeenCalledTimes(2);
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1000);
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(2);
    await vi.runAllTimersAsync();
    expect(await p).toBe('downloaded');
    expect(click).toHaveBeenCalledTimes(2);
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });
});
