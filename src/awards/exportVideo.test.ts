// src/awards/exportVideo.test.ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildStory } from './story/buildStory';
import { pickVideoMime, recordStory, storyTimeline, videoExtension, VIDEO_TIMING } from './exportVideo';
import { PRESET_PALETTES } from './palette';

const slides = buildStory({ introTitle: 'Season', teamName: 'U17', stats: [], awardCount: 1, includeStory: true });
const deps = { palette: PRESET_PALETTES[0], cards: [], artFor: () => ({ photo: null, cutout: null, background: null }), clubName: '' };

describe('exportVideo', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('prefers MP4 and falls back to WebM, or null', () => {
    expect(pickVideoMime((t) => t.startsWith('video/mp4'))).toBe('video/mp4;codecs=avc1');
    expect(pickVideoMime((t) => t === 'video/webm')).toBe('video/webm');
    expect(pickVideoMime(() => false)).toBeNull();
    expect(videoExtension('video/mp4;codecs=avc1')).toBe('mp4');
    expect(videoExtension('video/webm;codecs=vp9')).toBe('webm');
  });

  it('lays slides end to end with the fixed timings', () => {
    const tl = storyTimeline(slides); // intro, title, suspense, reveal, summary
    expect(tl.total).toBe(VIDEO_TIMING.intro + VIDEO_TIMING.awardTitle + VIDEO_TIMING.awardSuspense + VIDEO_TIMING.awardReveal + VIDEO_TIMING.summary);
    expect(tl.at(0)).toEqual({ index: 0, elapsed: 0 });
    expect(tl.at(VIDEO_TIMING.intro + 10)).toEqual({ index: 1, elapsed: 10 });
    expect(tl.at(tl.total + 999).index).toBe(slides.length - 1);
  });

  it('abort rejects with AbortError and stops the recorder', async () => {
    const stop = vi.fn();
    class FakeRecorder {
      static isTypeSupported = () => true;
      state = 'recording';
      ondataavailable: ((e: { data: Blob }) => void) | null = null;
      onstop: (() => void) | null = null;
      start() {}
      stop() { stop(); this.state = 'inactive'; this.onstop?.(); }
    }
    vi.stubGlobal('MediaRecorder', FakeRecorder);
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ setTransform() {} } as unknown as CanvasRenderingContext2D);
    (HTMLCanvasElement.prototype as unknown as { captureStream: () => MediaStream }).captureStream = () => ({ getTracks: () => [] }) as unknown as MediaStream;
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(() => 1);
    const ctrl = new AbortController();
    const p = recordStory(slides, deps, { signal: ctrl.signal, onProgress: () => {} });
    await new Promise((r) => setTimeout(r, 0)); // let the recorder start
    ctrl.abort();
    await expect(p).rejects.toMatchObject({ name: 'AbortError' });
    expect(stop).toHaveBeenCalled();
  });

  it('a drawing error mid-recording stops the recorder and rejects', async () => {
    const stop = vi.fn();
    class FakeRecorder {
      static isTypeSupported = () => true;
      state = 'recording';
      ondataavailable: ((e: { data: Blob }) => void) | null = null;
      onstop: (() => void) | null = null;
      start() {}
      stop() { stop(); this.state = 'inactive'; this.onstop?.(); }
    }
    vi.stubGlobal('MediaRecorder', FakeRecorder);
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ setTransform() { throw new Error('canvas gone'); } } as unknown as CanvasRenderingContext2D);
    (HTMLCanvasElement.prototype as unknown as { captureStream: () => MediaStream }).captureStream = () => ({ getTracks: () => [] }) as unknown as MediaStream;
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => { setTimeout(() => cb(performance.now()), 0); return 1; });
    await expect(recordStory(slides, deps, { signal: new AbortController().signal, onProgress: () => {} })).rejects.toThrow('canvas gone');
    expect(stop).toHaveBeenCalled();
  });
});
