import { afterEach, describe, expect, it } from 'vitest';
import {
  clearDiagramClipboard,
  getDiagramClipboard,
  setDiagramClipboard,
} from './diagramClipboard';
import { createItem } from './sceneFactory';

afterEach(() => clearDiagramClipboard());

describe('diagramClipboard', () => {
  it('starts empty', () => {
    expect(getDiagramClipboard()).toBeNull();
  });

  it('returns the item last set', () => {
    const item = createItem('cone', { x: 10, y: 10 });
    setDiagramClipboard(item);
    expect(getDiagramClipboard()).toBe(item);
  });

  it('clearDiagramClipboard empties it again', () => {
    setDiagramClipboard(createItem('ball', { x: 5, y: 5 }));
    clearDiagramClipboard();
    expect(getDiagramClipboard()).toBeNull();
  });
});
