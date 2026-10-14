import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Maximize, X } from 'lucide-react';
import type { CardTheme } from './card/cardTheme';
import { CARD_DURATION_MS } from './card/cardTimeline';
import { CARD_H, CARD_W, drawAwardCard, drawTitleCard, type CardArt, type CardModel } from './card/drawAwardCard';
import { FIRST_STEP, nextStep, prevStep, type Step } from './presentSteps';

interface PresentCard { key: string; title: string; model: CardModel }

function useReducedMotion(): boolean {
  const [reduced] = useState(() => typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  return reduced;
}

function useWakeLock() {
  useEffect(() => {
    let lock: { release: () => Promise<void> } | null = null;
    const nav = navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } };
    const acquire = () => nav.wakeLock?.request('screen').then((l) => (lock = l)).catch(() => undefined);
    void acquire();
    const onVisible = () => document.visibilityState === 'visible' && void acquire();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      void lock?.release().catch(() => undefined);
    };
  }, []);
}

export function AwardsPresent({ cards, theme, artFor, onExit }: { cards: PresentCard[]; theme: CardTheme; artFor: (key: string) => CardArt; onExit: () => void }) {
  const [step, setStep] = useState<Step>(cards.length ? FIRST_STEP : { kind: 'final' });
  const [controlsVisible, setControlsVisible] = useState(true);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const stepStart = useRef(performance.now());
  const reduced = useReducedMotion();
  useWakeLock();

  const next = useCallback(() => setStep((s) => nextStep(s, cards.length)), [cards.length]);
  const back = useCallback(() => setStep((s) => prevStep(s, cards.length)), [cards.length]);
  const fullscreen = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen?.();
    else void rootRef.current?.requestFullscreen?.()?.catch(() => undefined);
  }, []);

  useEffect(() => {
    stepStart.current = performance.now();
  }, [step]);

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

  // Auto-hide controls after 2 s without pointer movement.
  useEffect(() => {
    if (!controlsVisible) return;
    const id = window.setTimeout(() => setControlsVisible(false), 2000);
    return () => window.clearTimeout(id);
  }, [controlsVisible]);

  // One rAF loop; draws to the canvas, never sets React state per frame.
  useEffect(() => {
    if (step.kind === 'final') return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const card = cards[step.index];
    const art = artFor(card.key);
    let raf = 0;
    const frame = (now: number) => {
      const elapsed = now - stepStart.current;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      if (step.kind === 'reveal') {
        const t = reduced ? 1 : Math.min(1, elapsed / CARD_DURATION_MS);
        drawAwardCard(ctx, card.model, theme, art, t, reduced);
        if (t < 1) raf = requestAnimationFrame(frame);
      } else {
        const pulse = step.kind === 'suspense' && !reduced ? (elapsed % 1600) / 1600 : 0;
        drawTitleCard(ctx, card.title, theme, art, pulse);
        if (step.kind === 'suspense' && !reduced) raf = requestAnimationFrame(frame);
      }
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [step, cards, theme, artFor, reduced]);

  const announce =
    step.kind === 'final' ? 'All winners'
    : step.kind === 'reveal' ? `${cards[step.index].title}: ${cards[step.index].model.name}`
    : cards[step.index].title;

  return (
    <div ref={rootRef} className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: theme.bgTo }}
      onPointerMove={() => setControlsVisible(true)}>
      <p role="status" aria-live="polite" className="sr-only">{announce}</p>

      {step.kind === 'final' ? (
        <div className="max-h-full w-full max-w-4xl overflow-auto p-8" style={{ color: theme.text }}>
          <h1 className="mb-8 text-center text-5xl font-black" style={{ color: theme.accent }}>Winners</h1>
          <ul className="grid grid-cols-2 gap-6 sm:grid-cols-3">
            {cards.map((c) => (
              <li key={c.key} className="text-center">
                <p className="text-sm uppercase tracking-wide opacity-75">{c.title}</p>
                <p className="text-2xl font-extrabold">{c.model.name}</p>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        // Letterboxed 9:16; tap halves = back / next.
        <div className="relative aspect-[9/16] h-full max-w-full">
          <canvas ref={canvasRef} width={CARD_W} height={CARD_H} className="h-full w-full" aria-hidden="true" />
          <button type="button" aria-label="Previous" className="absolute inset-y-0 left-0 w-1/2 cursor-w-resize" onClick={back} />
          <button type="button" aria-label="Next" className="absolute inset-y-0 right-0 w-1/2 cursor-e-resize" onClick={next} />
        </div>
      )}

      <div className={`absolute right-4 top-4 flex gap-2 transition-opacity ${controlsVisible ? 'opacity-100' : 'opacity-0'}`}>
        <button type="button" onClick={back} aria-label="Previous award" className="rounded-full bg-black/40 p-3 text-white"><ChevronLeft size={20} /></button>
        <button type="button" onClick={next} aria-label="Next award" className="rounded-full bg-black/40 p-3 text-white"><ChevronRight size={20} /></button>
        <button type="button" onClick={fullscreen} aria-label="Fullscreen" className="rounded-full bg-black/40 p-3 text-white"><Maximize size={20} /></button>
        <button type="button" onClick={onExit} aria-label="Exit presentation" className="rounded-full bg-black/40 p-3 text-white"><X size={20} /></button>
      </div>
    </div>
  );
}
