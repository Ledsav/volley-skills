// src/awards/exportVideo.ts
import { CARD_H, CARD_W } from './card/drawAwardCard';
import { renderStoryFrame, type StoryDeps } from './card/drawSlide';
import { ensureCardFonts } from './exportCards';
import type { Slide } from './story/buildStory';

export const VIDEO_TIMING: Record<Slide['kind'], number> = {
  intro: 2000, stat: 3000, awardTitle: 1500, awardSuspense: 1500, awardReveal: 4000, summary: 4000,
};
const MIME_PREFERENCE = ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm'];

export function pickVideoMime(isSupported: (t: string) => boolean = (t) => MediaRecorder.isTypeSupported(t)): string | null {
  return MIME_PREFERENCE.find((t) => isSupported(t)) ?? null;
}

export function videoExtension(mime: string): 'mp4' | 'webm' {
  return mime.startsWith('video/mp4') ? 'mp4' : 'webm';
}

export function videoSupported(): boolean {
  return typeof MediaRecorder !== 'undefined' && typeof HTMLCanvasElement.prototype.captureStream === 'function' && pickVideoMime() !== null;
}

export function storyTimeline(slides: Slide[]): { total: number; at(ms: number): { index: number; elapsed: number } } {
  const starts: number[] = [];
  let total = 0;
  for (const s of slides) { starts.push(total); total += VIDEO_TIMING[s.kind]; }
  return {
    total,
    at(ms) {
      let index = 0;
      while (index + 1 < slides.length && starts[index + 1] <= ms) index++;
      return { index, elapsed: ms - starts[index] };
    },
  };
}

/** Plays the whole story once onto an off-screen canvas and records it. Nothing leaves the device. */
export async function recordStory(slides: Slide[], deps: StoryDeps, opts: { signal: AbortSignal; onProgress: (p: number) => void }): Promise<Blob> {
  await ensureCardFonts();
  if (opts.signal.aborted) throw new DOMException('Recording cancelled', 'AbortError');
  const mime = pickVideoMime();
  if (!mime) throw new Error('Video export is not supported in this browser');
  const canvas = document.createElement('canvas');
  canvas.width = CARD_W;
  canvas.height = CARD_H;
  const ctx = canvas.getContext('2d')!;
  const stream = canvas.captureStream(30);
  const recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 6_000_000 });
  const chunks: Blob[] = [];
  const tl = storyTimeline(slides);

  return new Promise<Blob>((resolve, reject) => {
    let raf = 0;
    let aborted = false;
    let failure: unknown = null;
    recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
    recorder.onstop = () => {
      cancelAnimationFrame(raf);
      stream.getTracks().forEach((t) => t.stop());
      canvas.width = 0;
      if (failure) reject(failure);
      else if (aborted) reject(new DOMException('Recording cancelled', 'AbortError'));
      else resolve(new Blob(chunks, { type: mime.split(';')[0] }));
    };
    opts.signal.addEventListener('abort', () => { aborted = true; if (recorder.state !== 'inactive') recorder.stop(); }, { once: true });
    recorder.start(250);
    const start = performance.now();
    let last = -1;
    const frame = (now: number) => {
      try {
        draw(now);
      } catch (e) {
        // e.g. an image released mid-recording: stop cleanly instead of leaving the recorder running
        failure = e;
        if (recorder.state !== 'inactive') recorder.stop();
      }
    };
    const draw = (now: number) => {
      const ms = now - start;
      const { index, elapsed } = tl.at(ms);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      renderStoryFrame(ctx, slides, index, elapsed, deps, false, index > 0 && index !== last ? index - 1 : null);
      if (index !== last) last = index;
      opts.onProgress(Math.min(1, ms / tl.total));
      if (ms >= tl.total) { if (recorder.state !== 'inactive') recorder.stop(); return; }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
  });
}
