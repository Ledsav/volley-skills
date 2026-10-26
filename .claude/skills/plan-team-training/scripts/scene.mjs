// Builders for court-diagram scenes (shape: src/types/diagram.ts). Coordinates 0–100.
// Court x 10–90. FULL: y 6–94, net y=50, attack lines y≈35/65, working team on the BOTTOM half.
// HALF: y 6–72, net along the top (y=6), attack line y≈28. BLANK: no court (pairs, stations).
// Style: working team blue, other side orange, coach red "C", setter green "S", ball orange mikasa.
// Arrows: ball flight 'pass' (ink, curved when lobbed), attack/serve 'shot' (red, size 0.8),
// player movement 'run' (blue). Tokens are ~7 units wide: keep them >= 9 apart, and start/end
// arrows at token edges, not centres. Text x,y is the LEFT anchor (~2 units per char at size 4).
// Limits: <= 60 items per scene, title 1–40 chars, player label <= 3 chars, text <= 60 chars.
// Avoid the "→" character in titles and text: the PDF font cannot draw it.

export const player = (id, x, y, label, color = 'blue') => ({ id, type: 'player', x, y, rotation: 0, size: 1, color, label, shape: 'circle', view: 'token' });
export const ball = (id, x, y) => ({ id, type: 'ball', x, y, rotation: 0, size: 1, color: 'orange', style: 'mikasa' });
export const cone = (id, x, y, color = 'orange') => ({ id, type: 'cone', x, y, rotation: 0, size: 1, color });
export const arrow = (id, from, to, style, { color = style === 'shot' ? 'red' : style === 'run' ? 'blue' : 'ink', curved = false, size = style === 'shot' ? 0.8 : 1 } = {}) => ({
  id,
  type: 'arrow',
  x: 0,
  y: 0,
  rotation: 0,
  size,
  color,
  from,
  to,
  curved,
  style,
  head: 'single',
});
export const text = (id, x, y, content, color = 'ink') => ({ id, type: 'text', x, y, rotation: 0, size: 1, color, content, fontSize: 4 });
export const scene = (items, court = 'full') => ({ v: 1, court, showZones: false, items });
