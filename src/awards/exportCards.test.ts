import { afterEach, describe, expect, it, vi } from 'vitest';
import { cardFileName, shareOrDownload } from './exportCards';

describe('exportCards', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    // @ts-expect-error test cleanup
    delete navigator.share; // @ts-expect-error test cleanup
    delete navigator.canShare;
  });

  it('file names', () => {
    expect(cardFileName('mvp', { kind: 'match', date: '2026-10-12', opponent: 'VC Rivals / B' })).toBe('vcb-mvp-2026-10-12-vs-VC-Rivals-B.png');
    expect(cardFileName('c-123', { kind: 'season', season: '2026-27' })).toBe('vcb-c-123-season-2026-27.png');
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
    await vi.runAllTimersAsync();
    expect(await p).toBe('downloaded');
    expect(click).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });
});
