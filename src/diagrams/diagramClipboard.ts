import type { DiagramItem } from '../types/diagram';

/**
 * A module-level clipboard for diagram elements. Living outside React state
 * means a copy made in one diagram tab can be pasted into another. It holds a
 * list so a whole multi-selection can be copied and pasted as a unit.
 */
let clipboard: DiagramItem[] = [];

export function setDiagramClipboard(items: DiagramItem[]): void {
  clipboard = items;
}

export function getDiagramClipboard(): DiagramItem[] {
  return clipboard;
}

/** Reset the clipboard. Primarily for tests that need a clean slate. */
export function clearDiagramClipboard(): void {
  clipboard = [];
}
