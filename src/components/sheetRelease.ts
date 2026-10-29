const FLICK_VELOCITY = 0.5; // px/ms
const CLOSE_FRACTION = 0.3;

/**
 * What a drag release means: close, ask to discard (dirty), or settle on a detent.
 * `height` is the visible height of the sheet when the drag started.
 */
export function decideRelease(i: {
  offset: number;
  velocity: number;
  height: number;
  dirty: boolean;
}): 'close' | 'guard' | 'snap' {
  const closes = i.velocity > FLICK_VELOCITY || i.offset > CLOSE_FRACTION * i.height;
  if (!closes) return 'snap';
  return i.dirty ? 'guard' : 'close';
}
