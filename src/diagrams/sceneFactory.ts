import type { CourtPreset, DiagramItem, DiagramItemType, Point, Scene } from '../types/diagram';

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
      return { ...base, color: 'blue', type, label: '', shape: 'circle' };
    case 'ball':
      return { ...base, color: 'orange', type };
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
