import type { DiagramItem } from '../types/diagram';

/**
 * A single-slot, module-level clipboard for diagram elements. Living outside
 * React state means a copy made in one diagram tab can be pasted into another.
 */
let clipboard: DiagramItem | null = null;

export function setDiagramClipboard(item: DiagramItem): void {
  clipboard = item;
}

export function getDiagramClipboard(): DiagramItem | null {
  return clipboard;
}

/** Reset the clipboard. Primarily for tests that need a clean slate. */
export function clearDiagramClipboard(): void {
  clipboard = null;
}
