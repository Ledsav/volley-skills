import { useGesture } from '@use-gesture/react';
import { useEffect, useRef, useState, type ReactNode } from 'react';

export interface StageApi {
  screenToCourt: (clientX: number, clientY: number) => { x: number; y: number };
  /** Zoom by `factor` around the centre of the stage (clamped to MIN..MAX). */
  zoomBy: (factor: number) => void;
  /** Back to the fitted, unpanned view. */
  resetView: () => void;
}

/** Space kept clear of the fitted court on each side, in px (floating chrome over the canvas). */
export interface StageInsets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

interface Props {
  children: ReactNode;
  onReady?: (api: StageApi) => void;
  /** The court is fitted and centred inside the stage minus these insets; panning still reaches the edges. */
  insets?: StageInsets;
}

const NO_INSETS: StageInsets = { top: 0, right: 0, bottom: 0, left: 0 };

/** The insets that fit a stage of this size; none when the stage is too small for them (or has no layout). */
function effectiveInsets(width: number, height: number, insets: StageInsets): StageInsets {
  return width > insets.left + insets.right && height > insets.top + insets.bottom ? insets : NO_INSETS;
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
    el?.closest?.('[data-item-id],[data-endpoint-handle],[data-transform-handle],[data-handle-hit]'),
  );
}

export function CanvasStage({ children, onReady, insets = NO_INSETS }: Props) {
  const outerRef = useRef<HTMLDivElement>(null);
  const [t, setT] = useState({ x: 0, y: 0, scale: 1 });
  // Pinch starts from the live scale, so it stays in sync after the zoom
  // buttons / reset change it outside the gesture.
  const scaleRef = useRef(t.scale);
  scaleRef.current = t.scale;
  const insetsRef = useRef(insets);
  insetsRef.current = insets;

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
    {
      target: outerRef,
      eventOptions: { passive: false },
      pinch: { from: () => [scaleRef.current, 0] },
    },
  );

  // Publish a fresh screen→court converter whenever the transform changes.
  useEffect(() => {
    if (!onReady) return;
    onReady({
      screenToCourt: (clientX, clientY) => {
        const el = outerRef.current;
        if (!el) return { x: 50, y: 50 };
        // DiagramSvg uses preserveAspectRatio="xMidYMid meet", which centres the
        // 100×100 viewBox as a letterboxed square inside the inset area — undo
        // the pan/zoom first, then that offset, before converting to court units.
        const r = el.getBoundingClientRect();
        const i = effectiveInsets(r.width, r.height, insetsRef.current);
        const w = r.width - i.left - i.right;
        const h = r.height - i.top - i.bottom;
        const side = Math.min(w, h) || 1;
        const offX = i.left + (w - side) / 2;
        const offY = i.top + (h - side) / 2;
        const px = (clientX - r.left - t.x) / t.scale - offX;
        const py = (clientY - r.top - t.y) / t.scale - offY;
        return { x: (px / side) * 100, y: (py / side) * 100 };
      },
      zoomBy: (factor) => {
        const el = outerRef.current;
        const r = el?.getBoundingClientRect();
        const width = r?.width ?? 0;
        const height = r?.height ?? 0;
        const i = effectiveInsets(width, height, insetsRef.current);
        // Keep the centre of the court's area fixed.
        const cx = i.left + (width - i.left - i.right) / 2;
        const cy = i.top + (height - i.top - i.bottom) / 2;
        setT((cur) => {
          const scale = Math.max(MIN, Math.min(MAX, cur.scale * factor));
          const k = scale / cur.scale;
          // Keep the point under the stage centre fixed while scaling.
          return { scale, x: cx - (cx - cur.x) * k, y: cy - (cy - cur.y) * k };
        });
      },
      resetView: () => setT({ x: 0, y: 0, scale: 1 }),
    });
  }, [t, onReady]);

  return (
    <div ref={outerRef} data-canvas-stage className="relative h-full w-full overflow-hidden bg-bg" style={{ touchAction: 'none' }}>
      <div
        data-canvas-transform
        className="absolute inset-0"
        style={{ transform: `translate(${t.x}px, ${t.y}px) scale(${t.scale})`, transformOrigin: '0 0' }}
      >
        <div className="absolute" style={{ top: insets.top, right: insets.right, bottom: insets.bottom, left: insets.left }}>
          {children}
        </div>
      </div>
    </div>
  );
}
