import type {
  ArrowItem,
  CourtPreset,
  DiagramItem,
  DiagramItemType,
  LineItem,
  Point,
  Scene,
} from '../types/diagram';

export function newId(): string {
  return crypto.randomUUID().slice(0, 8);
}

export function emptyScene(court: CourtPreset = 'full'): Scene {
  return { v: 1, court, showZones: false, items: [] };
}

export function createItem(type: DiagramItemType, at: Point): DiagramItem {
  const base = { id: newId(), x: at.x, y: at.y, rotation: 0, size: 1, color: 'ink' as const };
  switch (type) {
    case 'player':
      return { ...base, color: 'blue', type, label: '', shape: 'circle', view: 'above' };
    case 'ball':
      return { ...base, color: 'orange', type, style: 'plain' };
    case 'cone':
      return { ...base, color: 'orange', type };
    case 'pole':
      return { ...base, type };
    case 'ladder':
      return { ...base, type, rungs: 5, length: 20 };
    case 'net':
      return { ...base, type, length: 30 };
    case 'text':
      return { ...base, type, content: 'Text', fontSize: 4 };
    case 'zoneLabel':
      return { ...base, type, zone: 1 };
    case 'line':
      return { ...base, type, points: [{ x: at.x, y: at.y }, { x: at.x + 15, y: at.y }], style: 'solid', thickness: 2 };
    case 'arrow':
      return { ...base, type, from: { x: at.x, y: at.y }, to: { x: at.x + 15, y: at.y - 10 }, curved: false, style: 'pass', head: 'single' };
  }
}

/**
 * A deep-independent copy of `item` with a fresh id, shifted by `(dx, dy)`.
 * Line points and arrow endpoints are rebuilt as new objects so mutating the
 * clone never reaches the original. The result survives `parseScene` unchanged.
 */
export function cloneItemAt(item: DiagramItem, dx: number, dy: number): DiagramItem {
  const base = { ...item, id: newId(), x: item.x + dx, y: item.y + dy };
  if (item.type === 'line') {
    return { ...(base as LineItem), points: item.points.map((p) => ({ x: p.x + dx, y: p.y + dy })) };
  }
  if (item.type === 'arrow') {
    return {
      ...(base as ArrowItem),
      from: { x: item.from.x + dx, y: item.from.y + dy },
      to: { x: item.to.x + dx, y: item.to.y + dy },
    };
  }
  return base;
}
