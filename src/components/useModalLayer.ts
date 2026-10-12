import { useEffect, useRef } from 'react';

// Open modal layers, bottom → top. Only the topmost layer reacts to Escape, so
// a viewer stacked over a dialog closes alone instead of taking the dialog with it.
const stack: symbol[] = [];

/**
 * Registers a modal layer for the lifetime of the component: Escape calls
 * `onEscape` only while this is the topmost layer, and page scroll is locked
 * while any layer is open (so a full-screen sheet on a phone doesn't scroll
 * the page behind it).
 */
export function useModalLayer(onEscape: () => void) {
  const onEscapeRef = useRef(onEscape);
  useEffect(() => {
    onEscapeRef.current = onEscape;
  });

  useEffect(() => {
    const id = Symbol('modal-layer');
    if (stack.length === 0) document.body.style.overflow = 'hidden';
    stack.push(id);

    // Listen on window (not document) so events dispatched on either reach it.
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && stack[stack.length - 1] === id) onEscapeRef.current();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      const at = stack.indexOf(id);
      if (at !== -1) stack.splice(at, 1);
      if (stack.length === 0) document.body.style.overflow = '';
    };
  }, []);
}
