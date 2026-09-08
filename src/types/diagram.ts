export type PaletteColor = 'navy' | 'blue' | 'orange' | 'green' | 'red' | 'ink';
export const PALETTE_COLORS: PaletteColor[] = ['navy', 'blue', 'orange', 'green', 'red', 'ink'];

export type CourtPreset = 'full' | 'half' | 'blank';

export interface Point {
  x: number;
  y: number;
}

interface BaseItem {
  id: string;
  x: number;
  y: number;
  rotation: number;
  size: number;
  color: PaletteColor;
}

export interface PlayerItem extends BaseItem {
  type: 'player';
  label: string;
  shape: 'circle' | 'square';
}
export interface BallItem extends BaseItem {
  type: 'ball';
}
export interface ConeItem extends BaseItem {
  type: 'cone';
}
export interface LadderItem extends BaseItem {
  type: 'ladder';
  rungs: number;
  length: number;
}
export interface NetItem extends BaseItem {
  type: 'net';
  length: number;
}
export interface PoleItem extends BaseItem {
  type: 'pole';
}
export interface LineItem extends BaseItem {
  type: 'line';
  points: Point[];
  style: 'solid' | 'dashed';
  thickness: number;
}
export interface ArrowItem extends BaseItem {
  type: 'arrow';
  from: Point;
  to: Point;
  curved: boolean;
  style: 'pass' | 'shot' | 'run';
  head: 'single' | 'double';
}
export interface TextItem extends BaseItem {
  type: 'text';
  content: string;
  fontSize: number;
}
export interface ZoneLabelItem extends BaseItem {
  type: 'zoneLabel';
  zone: number;
}

export type DiagramItem =
  | PlayerItem
  | BallItem
  | ConeItem
  | LadderItem
  | NetItem
  | PoleItem
  | LineItem
  | ArrowItem
  | TextItem
  | ZoneLabelItem;

export type DiagramItemType = DiagramItem['type'];

export interface Scene {
  v: 1;
  court: CourtPreset;
  showZones: boolean;
  items: DiagramItem[];
}

export interface Diagram {
  id: string;
  title: string;
  order: number;
  scene: Scene;
  updatedBy: string;
  updatedAt: unknown;
}

export const SCENE_LIMITS = {
  diagramsPerExercise: 12,
  itemsPerScene: 60,
  titleLength: 40,
  labelLength: 3,
  textLength: 60,
  linePoints: 12,
} as const;
