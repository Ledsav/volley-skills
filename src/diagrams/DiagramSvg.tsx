import { useLayoutEffect, useRef, useState, type PointerEvent } from 'react';
import type { DiagramItem, Scene } from '../types/diagram';
import { renderItem } from './primitives';
import { CourtBackdrop } from './primitives/CourtBackdrop';
import { courtBox } from './courtGeometry';

interface DiagramSvgProps {
  scene: Scene;
  interactive?: boolean;
  selectedIds?: string[];
  marqueeRect?: { x: number; y: number; w: number; h: number } | null;
  onItemPointerDown?: (id: string, e: PointerEvent) => void;
  onBackgroundPointerDown?: (e: PointerEvent) => void;
  onTransformHandlePointerDown?: (id: string, e: PointerEvent) => void;
  onEndpointPointerDown?: (id: string, index: number, e: PointerEvent) => void;
  className?: string;
  /**
   * Previews only: frame the drawing (the court plus every item, labels included) instead of the fixed 0-100 grid,
   * so nothing overflows the box and a half court is centred. Never on the editor canvas, whose pointer maths
   * assumes the 0-100 grid.
   */
  fit?: boolean;
}

type Box = { x: number; y: number; w: number; h: number };
/** Space around a fitted drawing, in grid units. */
const FIT_PAD = 3;


function union(a: Box, b: Box): Box {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return { x, y, w: Math.max(a.x + a.w, b.x + b.w) - x, h: Math.max(a.y + a.h, b.y + b.h) - y };
}

function pad(b: Box): Box {
  return { x: b.x - FIT_PAD, y: b.y - FIT_PAD, w: b.w + 2 * FIT_PAD, h: b.h + 2 * FIT_PAD };
}

const viewBoxOf = (b: Box) => `${b.x} ${b.y} ${b.w} ${b.h}`;

/** The fitted frame: the court, grown to every drawn item (measured, so text labels count at their real width). */
function useFitBox(scene: Scene, enabled: boolean) {
  const contentRef = useRef<SVGGElement>(null);
  const [box, setBox] = useState<Box>(() => pad(courtBox(scene.court)));
  useLayoutEffect(() => {
    if (!enabled) return;
    const base = courtBox(scene.court);
    let next = base;
    const g = contentRef.current;
    // getBBox needs layout (absent in jsdom); without it the court frame stands.
    if (g && typeof g.getBBox === 'function') {
      try {
        const r = g.getBBox();
        const b = { x: r.x, y: r.y, w: r.width, h: r.height };
        if (b.w > 0 && b.h > 0) next = scene.court === 'blank' ? b : union(base, b);
      } catch {
        /* not rendered yet */
      }
    }
    const padded = pad(next);
    setBox((cur) => (viewBoxOf(cur) === viewBoxOf(padded) ? cur : padded));
  }, [scene, enabled]);
  return { contentRef, viewBox: enabled ? viewBoxOf(box) : '0 0 100 100' };
}

function endpoints(item: DiagramItem): { x: number; y: number }[] {
  if (item.type === 'arrow') return [item.from, item.to];
  if (item.type === 'line') return item.points;
  return [];
}

export function bbox(item: DiagramItem): { x: number; y: number; w: number; h: number } {
  const pts = endpoints(item);
  if (pts.length > 0) {
    const xs = pts.map((p) => p.x);
    const ys = pts.map((p) => p.y);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    return { x: minX - 2, y: minY - 2, w: Math.max(...xs) - minX + 4, h: Math.max(...ys) - minY + 4 };
  }
  const pad = 6 * item.size;
  return { x: item.x - pad, y: item.y - pad, w: pad * 2, h: pad * 2 };
}

export function DiagramSvg({
  scene,
  interactive = false,
  selectedIds = [],
  marqueeRect = null,
  onItemPointerDown,
  onBackgroundPointerDown,
  onTransformHandlePointerDown,
  onEndpointPointerDown,
  className,
  fit = false,
}: DiagramSvgProps) {
  const { contentRef, viewBox } = useFitBox(scene, fit && !interactive);
  const selectedItems = interactive
    ? scene.items.filter((i) => selectedIds.includes(i.id))
    : [];
  // Transform / endpoint handles are single-select affordances only.
  const single = selectedItems.length === 1 ? selectedItems[0] : null;

  const drawing = (
    <>
      <CourtBackdrop court={scene.court} showZones={scene.showZones} />

      {scene.items.map((item) =>
        interactive ? (
          <g
            key={item.id}
            onPointerDown={(e) => {
              e.stopPropagation();
              onItemPointerDown?.(item.id, e);
            }}
            style={{ cursor: 'move' }}
          >
            {renderItem(item)}
          </g>
        ) : (
          renderItem(item)
        ),
      )}
    </>
  );

  return (
    <svg
      viewBox={viewBox}
      preserveAspectRatio="xMidYMid meet"
      className={className}
      style={{ width: '100%', height: '100%', display: 'block', touchAction: 'none' }}
      onPointerDown={interactive ? onBackgroundPointerDown : undefined}
    >
      <defs>
        <marker id="arrowhead-single" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
          <path d="M0,0 L6,3 L0,6 Z" fill="rgb(var(--color-ink))" />
        </marker>
        <marker id="arrowhead-double" markerWidth="10" markerHeight="6" refX="9" refY="3" orient="auto">
          <path d="M0,0 L5,3 L0,6 Z M4,0 L10,3 L4,6 Z" fill="rgb(var(--color-ink))" />
        </marker>
        <pattern id="netHatch" width="2" height="4" patternUnits="userSpaceOnUse">
          <path d="M0,0 L0,4" stroke="rgb(var(--color-ink) / 0.5)" strokeWidth="0.3" />
        </pattern>
      </defs>

      {fit && !interactive ? <g ref={contentRef}>{drawing}</g> : drawing}

      {selectedItems.length > 0 && (
        <g style={{ pointerEvents: 'none' }}>
          {selectedItems.map((it) => {
            const ob = bbox(it);
            return (
              <rect
                key={it.id}
                data-selection-outline
                x={ob.x}
                y={ob.y}
                width={ob.w}
                height={ob.h}
                fill="none"
                stroke="rgb(var(--color-focus))"
                strokeWidth={0.6}
                strokeDasharray="2 1.5"
              />
            );
          })}
          {single &&
            (() => {
              const selected = single;
              const b = bbox(selected);
              const onHandleDown = (e: PointerEvent) => {
                e.stopPropagation();
                onTransformHandlePointerDown?.(selected.id, e);
              };
              const endpointsInteractive = interactive && !!onEndpointPointerDown;
              return endpoints(selected).length > 0 ? (
                endpoints(selected).map((p, i) => {
                  if (!endpointsInteractive) {
                    return (
                      <circle
                        key={i}
                        data-endpoint-handle
                        data-endpoint-index={i}
                        cx={p.x}
                        cy={p.y}
                        r={1.8}
                        fill="rgb(var(--color-focus))"
                      />
                    );
                  }
                  // Drag handle for one endpoint. Re-enable pointer events on
                  // just this group; the large transparent circle gives touch a
                  // ~44px target behind the visible dot.
                  const onDown = (e: PointerEvent) => {
                    e.stopPropagation();
                    onEndpointPointerDown?.(selected.id, i, e);
                  };
                  return (
                    <g key={i} data-handle-hit style={{ pointerEvents: 'auto', cursor: 'grab' }}>
                      <circle
                        data-endpoint-index={i}
                        cx={p.x}
                        cy={p.y}
                        r={4}
                        fill="transparent"
                        onPointerDown={onDown}
                      />
                      <circle
                        data-endpoint-handle
                        data-endpoint-index={i}
                        cx={p.x}
                        cy={p.y}
                        r={1.8}
                        fill="rgb(var(--color-focus))"
                        onPointerDown={onDown}
                      />
                    </g>
                  );
                })
              ) : (
                // Resize + rotate handle. Re-enable pointer events on just this
                // group (the outline + endpoint dots stay decorative). The large
                // transparent circle gives touch a ~44px target.
                <g data-handle-hit style={{ pointerEvents: 'auto', cursor: 'grab' }}>
                  <circle
                    cx={b.x + b.w}
                    cy={b.y}
                    r={4}
                    fill="transparent"
                    onPointerDown={onHandleDown}
                  />
                  <circle
                    data-transform-handle
                    cx={b.x + b.w}
                    cy={b.y}
                    r={1.8}
                    fill="rgb(var(--color-focus))"
                    onPointerDown={onHandleDown}
                  />
                </g>
              );
            })()}
        </g>
      )}

      {interactive && marqueeRect && (
        <rect
          data-marquee-rect
          x={marqueeRect.x}
          y={marqueeRect.y}
          width={marqueeRect.w}
          height={marqueeRect.h}
          fill="rgb(var(--color-focus) / 0.1)"
          stroke="rgb(var(--color-focus))"
          strokeWidth={0.4}
          strokeDasharray="1.5 1"
          style={{ pointerEvents: 'none' }}
        />
      )}
    </svg>
  );
}
