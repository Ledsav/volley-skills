import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Maximize, X } from 'lucide-react';
import { CARD_H, CARD_W } from './card/drawAwardCard';
import { renderStoryFrame, type PresentCard, type StoryDeps } from './card/drawSlide';
import { slideColors } from './palette';
import { sceneProgress, type Slide } from './story/buildStory';

function useReducedMotion(): boolean {
  const [reduced] = useState(() => typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  return reduced;
}

function useWakeLock() {
  useEffect(() => {
    let lock: { release: () => Promise<void> } | null = null;
    let gone = false;
    const nav = navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } };
    const acquire = () => nav.wakeLock?.request('screen').then((l) => { if (gone) void l.release().catch(() => undefined); else lock = l; }).catch(() => undefined);
    void acquire();
    const onVisible = () => document.visibilityState === 'visible' && void acquire();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      gone = true;
      document.removeEventListener('visibilitychange', onVisible);
      void lock?.release().catch(() => undefined);
    };
  }, []);
}


function slideAnnouncement(slide: Slide, cards: PresentCard[]): string {
  switch (slide.kind) {
    case 'intro': return `${slide.title} — ${slide.subtitle}`;
    case 'stat': return `${slide.stat.kicker}: ${slide.stat.big}${slide.stat.bigSuffix} ${slide.stat.caption}`;
    case 'awardTitle':
    case 'awardSuspense': return cards[slide.awardIndex].title;
    case 'awardReveal': return `${cards[slide.awardIndex].title}: ${cards[slide.awardIndex].model.name}`;
    case 'summary': return `Winners: ${cards.map((c) => `${c.title} — ${c.model.name}`).join(', ')}`;
  }
}

export function AwardsPresent({ slides, deps, onExit }: { slides: Slide[]; deps: StoryDeps; onExit: () => void }) {
  const [index, setIndex] = useState(0);
  const prevIndex = useRef<number | null>(null);
  const [controlsVisible, setControlsVisible] = useState(true);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  useWakeLock();

  const go = useCallback((delta: number) => {
    setIndex((i) => {
      const next = Math.max(0, Math.min(slides.length - 1, i + delta));
      if (next !== i) prevIndex.current = i;
      return next;
    });
  }, [slides.length]);
  const next = useCallback(() => go(1), [go]);
  const back = useCallback(() => go(-1), [go]);
  const fullscreen = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen?.();
    else void rootRef.current?.requestFullscreen?.()?.catch(() => undefined);
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === ' ' || e.key === 'ArrowRight' || e.key === 'PageDown') { e.preventDefault(); next(); }
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); back(); }
      else if (e.key === 'f' || e.key === 'F') fullscreen();
      else if (e.key === 'Escape') onExit();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [next, back, fullscreen, onExit]);

  useEffect(() => {
    if (!controlsVisible) return;
    const id = window.setTimeout(() => setControlsVisible(false), 2000);
    return () => window.clearTimeout(id);
  }, [controlsVisible]);

  // One rAF loop per slide; draws to the canvas, never sets React state per frame.
  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx || slides.length === 0) return;
    const start = performance.now();
    const from = prevIndex.current;
    let raf = 0;
    const frame = (now: number) => {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      const done = renderStoryFrame(ctx, slides, index, now - start, deps, reduced, from);
      if (!done) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [index, slides, deps, reduced]);

  if (slides.length === 0) return null;
  const slide = slides[index];
  const progress = sceneProgress(slides, index);
  const colors = slideColors(deps.palette, slide.colorIndex);

  return (
    <div ref={rootRef} className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: colors.bg }}
      onPointerMove={() => setControlsVisible(true)}>
      <p role="status" aria-live="polite" className="sr-only">{slideAnnouncement(slide, deps.cards)}</p>

      {/* Letterboxed 9:16; tap halves = back / next. */}
      <div className="relative aspect-[9/16] h-full max-w-full">
        <canvas ref={canvasRef} width={CARD_W} height={CARD_H} className="h-full w-full object-contain" aria-hidden="true" />
        <div role="progressbar" aria-label="Presentation progress" aria-valuemin={1} aria-valuemax={progress.scenes} aria-valuenow={progress.current + 1}
          className="pointer-events-none absolute inset-x-3 top-3 flex gap-1">
          {Array.from({ length: progress.scenes }, (_, i) => (
            <span key={i} className="h-1 flex-1 overflow-hidden rounded-full" style={{ background: `${colors.text}40` }}>
              <span className="block h-full rounded-full transition-[width] duration-300"
                style={{ background: colors.text, width: `${i < progress.current ? 100 : i === progress.current ? progress.fraction * 100 : 0}%` }} />
            </span>
          ))}
        </div>
        <button type="button" aria-label="Previous" className="absolute inset-y-0 left-0 w-1/2 cursor-w-resize" onClick={back} />
        <button type="button" aria-label="Next" className="absolute inset-y-0 right-0 w-1/2 cursor-e-resize" onClick={next} />
      </div>

      <div className={`absolute right-4 top-4 flex gap-2 transition-opacity ${controlsVisible ? 'opacity-100' : 'opacity-0'}`}>
        <button type="button" onClick={back} aria-label="Previous slide" className="rounded-full bg-black/40 p-3 text-white"><ChevronLeft size={20} /></button>
        <button type="button" onClick={next} aria-label="Next slide" className="rounded-full bg-black/40 p-3 text-white"><ChevronRight size={20} /></button>
        <button type="button" onClick={fullscreen} aria-label="Fullscreen" className="rounded-full bg-black/40 p-3 text-white"><Maximize size={20} /></button>
        <button type="button" onClick={onExit} aria-label="Exit presentation" className="rounded-full bg-black/40 p-3 text-white"><X size={20} /></button>
      </div>
    </div>
  );
}
