/** Moves focus to the page's h1 (or the main landmark when it has none), without scrolling. */
export function focusPageHeading(main: HTMLElement | null) {
  const heading = main?.querySelector<HTMLElement>('h1');
  if (heading) {
    if (!heading.hasAttribute('tabindex')) heading.setAttribute('tabindex', '-1');
    heading.focus({ preventScroll: true });
  } else {
    main?.focus({ preventScroll: true });
  }
}
