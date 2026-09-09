import type { PointerEvent } from 'react';
import { CourtBackdrop } from './primitives/CourtBackdrop';
import { renderItem } from './primitives';
import type { DiagramItem, Scene } from '../types/diagram';

interface DiagramSvgProps {
  scene: Scene;
  interactive?: boolean;
  selectedId?: string | null;
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

function bbox(item: DiagramItem): { x: number; y: number; w: number; h: number } {
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
  selectedId = null,
  onItemPointerDown,
  onBackgroundPointerDown,
  onTransformHandlePointerDown,
  onEndpointPointerDown,
  className,
}: DiagramSvgProps) {
  const selected = interactive && selectedId ? scene.items.find((i) => i.id === selectedId) ?? null : null;

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

      {selected &&
        (() => {
          const b = bbox(selected);
          const onHandleDown = (e: PointerEvent) => {
            e.stopPropagation();
            onTransformHandlePointerDown?.(selected.id, e);
          };
          const endpointsInteractive = interactive && !!onEndpointPointerDown;
          return (
            <g style={{ pointerEvents: 'none' }}>
              <rect
                data-selection-outline
                x={b.x}
                y={b.y}
                width={b.w}
                height={b.h}
                fill="none"
                stroke="rgb(var(--color-blue))"
                strokeWidth={0.6}
                strokeDasharray="2 1.5"
              />
              {endpoints(selected).length > 0 ? (
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
              )}
            </g>
          );
        })()}
    </svg>
  );
}
