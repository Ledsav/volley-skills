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
    expect(getDiagramClipboard()).toEqual([]);
  });

  it('returns the list last set', () => {
    const items = [createItem('cone', { x: 10, y: 10 }), createItem('ball', { x: 5, y: 5 })];
    setDiagramClipboard(items);
    expect(getDiagramClipboard()).toEqual(items);
  });

  it('clearDiagramClipboard empties it again', () => {
    setDiagramClipboard([createItem('ball', { x: 5, y: 5 })]);
    clearDiagramClipboard();
    expect(getDiagramClipboard()).toEqual([]);
  });
});
