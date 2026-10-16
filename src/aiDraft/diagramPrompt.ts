import { courtGeometry } from '../diagrams/courtGeometry';
import { PALETTE_COLORS, SCENE_LIMITS } from '../types/diagram';

export function diagramFormatGuide(): string {
  const full = courtGeometry('full');
  const half = courtGeometry('half');
  return [
    'Diagram format: {"court":"full"|"half"|"blank","showZones":boolean,"items":[...]} on a 0-100 grid (x left to right, y top to bottom).',
    `Full court: lines x ${full.left}-${full.right}, y ${full.top}-${full.bottom}, net at y=${full.netY}; our side is the bottom half.`,
    `Half court: lines x ${half.left}-${half.right}, y ${half.top}-${half.bottom}, net at y=${half.netY}.`,
    `At most ${SCENE_LIMITS.itemsPerScene} items. Optional "color" on any item: ${PALETTE_COLORS.join('|')}.`,
    'Item shapes:',
    `- {"type":"player","x":n,"y":n,"label":string} (label at most ${SCENE_LIMITS.labelLength} characters, e.g. "S", "OH", "1")`,
    '- {"type":"ball","x":n,"y":n}',
    '- {"type":"cone","x":n,"y":n}',
    '- {"type":"arrow","from":{"x":n,"y":n},"to":{"x":n,"y":n},"style":"pass"|"shot"|"run","curved":boolean}',
    `- {"type":"text","x":n,"y":n,"content":string} (at most ${SCENE_LIMITS.textLength} characters)`,
    '- {"type":"zoneLabel","x":n,"y":n,"zone":1-6}',
    'Use color to tell groups apart (for example blue for players, red for the coach or feeder).',
  ].join('\n');
}
