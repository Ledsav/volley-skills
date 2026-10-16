import { describe, expect, it } from 'vitest';
import { SCENE_LIMITS } from '../types/diagram';
import { diagramFormatGuide } from './diagramPrompt';

describe('diagramFormatGuide', () => {
  const guide = diagramFormatGuide();
  it('states the grid, both courts and the limits', () => {
    expect(guide).toContain('0-100');
    expect(guide).toContain('net at y=50');
    expect(guide).toContain('net at y=6');
    expect(guide).toContain(`At most ${SCENE_LIMITS.itemsPerScene} items`);
    expect(guide).toContain(`at most ${SCENE_LIMITS.labelLength} characters`);
  });
  it('only offers the item types drafts may use', () => {
    for (const t of ['player', 'ball', 'cone', 'arrow', 'text', 'zoneLabel']) expect(guide).toContain(`"type":"${t}"`);
    for (const t of ['ladder', 'net', 'pole', 'line']) expect(guide).not.toContain(`"type":"${t}"`);
  });
});
