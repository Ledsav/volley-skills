import type { PointerEvent } from 'react';
import type { DiagramItem, Scene } from '../types/diagram';
import { renderItem } from './primitives';
import { CourtBackdrop } from './primitives/CourtBackdrop';

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
}: DiagramSvgProps) {
  const selectedItems = interactive
    ? scene.items.filter((i) => selectedIds.includes(i.id))
    : [];
  // Transform / endpoint handles are single-select affordances only.
  const single = selectedItems.length === 1 ? selectedItems[0] : null;

  return (
    <svg
      viewBox="0 0 100 100"
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
                stroke="rgb(var(--color-blue))"
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
                        fill="rgb(var(--color-blue))"
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
                    <g key={i} style={{ pointerEvents: 'auto', cursor: 'grab' }}>
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
                        fill="rgb(var(--color-blue))"
                        onPointerDown={onDown}
                      />
                    </g>
                  );
                })
              ) : (
                // Resize + rotate handle. Re-enable pointer events on just this
                // group (the outline + endpoint dots stay decorative). The large
                // transparent circle gives touch a ~44px target.
                <g style={{ pointerEvents: 'auto', cursor: 'grab' }}>
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
                    fill="rgb(var(--color-blue))"
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
          fill="rgb(var(--color-blue) / 0.1)"
          stroke="rgb(var(--color-blue))"
          strokeWidth={0.4}
          strokeDasharray="1.5 1"
          style={{ pointerEvents: 'none' }}
        />
      )}
    </svg>
  );
}
