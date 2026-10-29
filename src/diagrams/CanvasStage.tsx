import { useGesture } from '@use-gesture/react';
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';

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
  /**
   * The part of the 0-100 grid to frame at rest (the court's outline), in grid units: the resting view zooms and
   * pans so this box is as large as fits and centred in the inset area, so a half court is not pinned to the top.
   * Without it the whole 0-100 square is fitted.
   */
  fitBox?: { x: number; y: number; w: number; h: number };
}

type Transform = { x: number; y: number; scale: number };
const IDENTITY: Transform = { x: 0, y: 0, scale: 1 };
/** A framed box never grows past this zoom, so a small drawing does not fill the screen. */
const MAX_FIT = 1.6;

/** The resting transform that centres `box` (grid units) in the inset area of a `width` x `height` stage. */
export function fitTransform(width: number, height: number, insets: StageInsets, box?: Props['fitBox']): Transform {
  if (!box || width <= 0 || height <= 0 || box.w <= 0 || box.h <= 0) return IDENTITY;
  const i = effectiveInsets(width, height, insets);
  const w = width - i.left - i.right;
  const h = height - i.top - i.bottom;
  const side = Math.min(w, h);
  if (side <= 0) return IDENTITY;
  // At scale 1 the 0-100 square is a `side` px square centred in the inset area (DiagramSvg's xMidYMid meet).
  const offX = i.left + (w - side) / 2;
  const offY = i.top + (h - side) / 2;
  const unit = side / 100;
  const scale = Math.min(MAX_FIT, w / (box.w * unit), h / (box.h * unit));
  const cx = offX + (box.x + box.w / 2) * unit;
  const cy = offY + (box.y + box.h / 2) * unit;
  return { scale, x: i.left + w / 2 - scale * cx, y: i.top + h / 2 - scale * cy };
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

export function CanvasStage({ children, onReady, insets = NO_INSETS, fitBox }: Props) {
  const outerRef = useRef<HTMLDivElement>(null);
  const [t, setT] = useState<Transform>(IDENTITY);
  // True until the coach pans or zooms: a resting view follows the stage size and the framed box.
  const resting = useRef(true);
  const fitKey = fitBox ? `${fitBox.x},${fitBox.y},${fitBox.w},${fitBox.h}` : '';
  const restingView = useCallback((): Transform => {
    const r = outerRef.current?.getBoundingClientRect();
    return fitTransform(r?.width ?? 0, r?.height ?? 0, insetsRef.current, fitBox);
    // fitKey stands for fitBox's value
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitKey]);
  // Pinch starts from the live scale, so it stays in sync after the zoom
  // buttons / reset change it outside the gesture.
  const scaleRef = useRef(t.scale);
  scaleRef.current = t.scale;
  const insetsRef = useRef(insets);
  insetsRef.current = insets;

  // Frame the box on mount, when it changes and when the stage resizes, until the coach moves the view.
  useLayoutEffect(() => {
    resting.current = true;
    setT(restingView());
    const el = outerRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => {
      if (resting.current) setT(restingView());
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [restingView]);

  useGesture(
    {
      onDrag: ({ delta: [dx, dy], pinching, event }) => {
        if (pinching) return;
        if (startedOnItem(event.target)) return;
        // Shift+drag on the background draws a marquee-select box instead of
        // panning (see DiagramEditorPage's beginMarquee).
        if ('shiftKey' in event && event.shiftKey) return;
        resting.current = false;
        setT((s) => ({ ...s, x: s.x + dx, y: s.y + dy }));
      },
      onPinch: ({ offset: [s] }) => {
        resting.current = false;
        setT((cur) => ({ ...cur, scale: Math.max(MIN, Math.min(MAX, s)) }));
      },
      onWheel: ({ delta: [, dy] }) => {
        resting.current = false;
        setT((s) => ({ ...s, scale: Math.max(MIN, Math.min(MAX, s.scale - dy * 0.001)) }));
      },
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
        resting.current = false;
        setT((cur) => {
          const scale = Math.max(MIN, Math.min(MAX, cur.scale * factor));
          const k = scale / cur.scale;
          // Keep the point under the stage centre fixed while scaling.
          return { scale, x: cx - (cx - cur.x) * k, y: cy - (cy - cur.y) * k };
        });
      },
      resetView: () => {
        resting.current = true;
        setT(restingView());
      },
    });
  }, [t, onReady, restingView]);

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
