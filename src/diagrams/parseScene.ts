import { isPlainObject } from '../bulkImport/parseJsonArray';
import {
  BALL_STYLES,
  PALETTE_COLORS,
  PLAYER_VIEWS,
  SCENE_LIMITS,
  type CourtPreset,
  type DiagramItem,
  type Point,
  type Scene,
} from '../types/diagram';

export type ParseSceneResult = { ok: true; scene: Scene } | { ok: false; error: string };

const COURTS: CourtPreset[] = ['full', 'half', 'blank'];
const COLORS = new Set<string>(PALETTE_COLORS);
const KNOWN_TYPES = new Set<DiagramItem['type']>([
  'player', 'ball', 'cone', 'ladder', 'net', 'pole', 'line', 'arrow', 'text', 'zoneLabel',
]);

const clamp = (n: unknown, lo: number, hi: number, fallback: number): number => {
  const x = typeof n === 'number' && Number.isFinite(n) ? n : fallback;
  return Math.max(lo, Math.min(hi, x));
};
const clampInt = (n: unknown, lo: number, hi: number, fallback: number): number =>
  Math.round(clamp(n, lo, hi, fallback));
const str = (v: unknown, max: number, fallback = ''): string =>
  (typeof v === 'string' ? v : fallback).slice(0, max);
const color = (v: unknown): DiagramItem['color'] =>
  (typeof v === 'string' && COLORS.has(v) ? v : 'ink') as DiagramItem['color'];
const oneOf = <T extends string>(v: unknown, allowed: readonly T[], fallback: T): T =>
  (typeof v === 'string' && (allowed as readonly string[]).includes(v) ? v : fallback) as T;
const point = (v: unknown): Point | null =>
  isPlainObject(v) && typeof v.x === 'number' && typeof v.y === 'number'
    ? { x: clamp(v.x, -20, 120, 0), y: clamp(v.y, -20, 120, 0) }
    : null;

/** Returns a repaired item, or null if a required field is unusable (caller rejects the whole scene). */
function repairItem(raw: unknown): DiagramItem | null {
  if (!isPlainObject(raw)) return null;
  const type = raw.type;
  if (typeof type !== 'string' || !KNOWN_TYPES.has(type as DiagramItem['type'])) return null;

  const base = {
    id: str(raw.id, 12) || Math.random().toString(36).slice(2, 10),
    x: clamp(raw.x, -20, 120, 50),
    y: clamp(raw.y, -20, 120, 50),
    rotation: clamp(raw.rotation, -180, 180, 0),
    size: clamp(raw.size, 0.5, 2, 1),
    color: color(raw.color),
  };

  switch (type) {
    case 'cone':
    case 'pole':
      return { ...base, type };
    case 'ball':
      return { ...base, type, style: oneOf(raw.style, BALL_STYLES, 'plain') };
    case 'player':
      return {
        ...base,
        type,
        label: str(raw.label, SCENE_LIMITS.labelLength),
        shape: oneOf(raw.shape, ['circle', 'square'] as const, 'circle'),
        // Missing/unknown view backfills to 'token' so diagrams saved before
        // player views existed keep their original circle/square look.
        view: oneOf(raw.view, PLAYER_VIEWS, 'token'),
      };
    case 'ladder': {
      if (!Number.isFinite(raw.rungs) || !Number.isFinite(raw.length)) return null;
      return { ...base, type, rungs: clampInt(raw.rungs, 3, 10, 5), length: clamp(raw.length, 5, 40, 20) };
    }
    case 'net': {
      if (!Number.isFinite(raw.length)) return null;
      return { ...base, type, length: clamp(raw.length, 5, 60, 30) };
    }
    case 'text': {
      const content = str(raw.content, SCENE_LIMITS.textLength);
      if (content === '') return null;
      return { ...base, type, content, fontSize: clamp(raw.fontSize, 2, 8, 4) };
    }
    case 'zoneLabel': {
      if (!Number.isFinite(raw.zone)) return null;
      return { ...base, type, zone: clampInt(raw.zone, 1, 6, 1) };
    }
    case 'line': {
      const pts = Array.isArray(raw.points) ? raw.points.map(point).filter((p): p is Point => p !== null).slice(0, SCENE_LIMITS.linePoints) : [];
      if (pts.length < 2) return null;
      return { ...base, type, points: pts, style: oneOf(raw.style, ['solid', 'dashed'] as const, 'solid'), thickness: clamp(raw.thickness, 1, 4, 2) };
    }
    case 'arrow': {
      const from = point(raw.from);
      const to = point(raw.to);
      if (!from || !to) return null;
      return {
        ...base, type, from, to,
        curved: raw.curved === true,
        style: oneOf(raw.style, ['pass', 'shot', 'run'] as const, 'pass'),
        head: oneOf(raw.head, ['single', 'double'] as const, 'single'),
      };
    }
    default:
      return null;
  }
}

export function parseScene(input: unknown): ParseSceneResult {
  if (!isPlainObject(input)) return { ok: false, error: 'scene must be an object' };
  if (input.v !== 1) return { ok: false, error: 'unsupported scene version' };
  if (typeof input.court !== 'string' || !COURTS.includes(input.court as CourtPreset)) {
    return { ok: false, error: 'court must be one of full, half, blank' };
  }
  if (!Array.isArray(input.items)) return { ok: false, error: 'scene.items must be an array' };
  if (input.items.length > SCENE_LIMITS.itemsPerScene) {
    return { ok: false, error: `a scene may hold at most ${SCENE_LIMITS.itemsPerScene} items` };
  }

  const items: DiagramItem[] = [];
  for (const raw of input.items) {
    const repaired = repairItem(raw);
    if (repaired === null) {
      if (isPlainObject(raw) && typeof raw.type === 'string' && !KNOWN_TYPES.has(raw.type as DiagramItem['type'])) {
        continue; // unknown type: drop silently
      }
      return { ok: false, error: 'a scene item is missing a required field' };
    }
    items.push(repaired);
  }

  return {
    ok: true,
    scene: {
      v: 1,
      court: input.court as CourtPreset,
      showZones: input.showZones === true,
      items,
    },
  };
}
