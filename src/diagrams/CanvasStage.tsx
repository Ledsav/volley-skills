import { useGesture } from '@use-gesture/react';
import { useEffect, useRef, useState, type ReactNode } from 'react';

interface StageApi {
  screenToCourt: (clientX: number, clientY: number) => { x: number; y: number };
}

interface Props {
  children: ReactNode;
  onReady?: (api: StageApi) => void;
}

const MIN = 0.5;
const MAX = 4;

/**
 * True when a gesture started on a diagram item or a selection handle. The
 * `useGesture` drag listener is native and fires before React's synthetic
 * `stopPropagation()` in `DiagramSvg`, so without this guard a token drag also
 * pans the stage (the court slides while the token moves ~2×).
 */
export function startedOnItem(target: EventTarget | null): boolean {
  const el = target as Element | null;
  return Boolean(
    el?.closest?.('[data-item-id],[data-endpoint-handle],[data-transform-handle]'),
  );
}

export function CanvasStage({ children, onReady }: Props) {
  const outerRef = useRef<HTMLDivElement>(null);
  const [t, setT] = useState({ x: 0, y: 0, scale: 1 });

  useGesture(
    {
      onDrag: ({ delta: [dx, dy], pinching, event }) => {
        if (pinching) return;
        if (startedOnItem(event.target)) return;
        // Shift+drag on the background draws a marquee-select box instead of
        // panning (see DiagramEditorPage's beginMarquee).
        if ('shiftKey' in event && event.shiftKey) return;
        setT((s) => ({ ...s, x: s.x + dx, y: s.y + dy }));
      },
      onPinch: ({ offset: [s] }) => setT((cur) => ({ ...cur, scale: Math.max(MIN, Math.min(MAX, s)) })),
      onWheel: ({ delta: [, dy] }) => setT((s) => ({ ...s, scale: Math.max(MIN, Math.min(MAX, s.scale - dy * 0.001)) })),
    },
    { target: outerRef, eventOptions: { passive: false } },
  );

  // Publish a fresh screen→court converter whenever the transform changes.
  useEffect(() => {
    if (!onReady) return;
    onReady({
      screenToCourt: (clientX, clientY) => {
        const el = outerRef.current;
        if (!el) return { x: 50, y: 50 };
        // DiagramSvg uses preserveAspectRatio="xMidYMid meet", which centres the
        // 100×100 viewBox as a letterboxed square — account for that offset
        // before converting to court units.
        const r = el.getBoundingClientRect();
        const side = Math.min(r.width, r.height) || 1;
        const offX = (r.width - side) / 2;
        const offY = (r.height - side) / 2;
        const px = (clientX - r.left - offX - t.x) / t.scale;
        const py = (clientY - r.top - offY - t.y) / t.scale;
        return { x: (px / side) * 100, y: (py / side) * 100 };
      },
    });
  }, [t, onReady]);

  return (
    <div ref={outerRef} data-canvas-stage className="relative h-full w-full overflow-hidden bg-bg" style={{ touchAction: 'none' }}>
      <div
        data-canvas-transform
        className="absolute inset-0"
        style={{ transform: `translate(${t.x}px, ${t.y}px) scale(${t.scale})`, transformOrigin: '0 0' }}
      >
        {children}
      </div>
    </div>
  );
}
