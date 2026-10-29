export const TAP_FLASH_MS = 80;

const timers = new WeakMap<HTMLElement, number>();

/**
 * Instant press feedback for recording targets: `data-flash` swaps the background to `surface-3`
 * for 80 ms (no scale, no easing). A repeat press restarts the timer.
 */
export function tapFlash(el: HTMLElement): void {
  const running = timers.get(el);
  if (running !== undefined) window.clearTimeout(running);
  el.setAttribute('data-flash', '');
  timers.set(
    el,
    window.setTimeout(() => {
      el.removeAttribute('data-flash');
      timers.delete(el);
    }, TAP_FLASH_MS),
  );
}
