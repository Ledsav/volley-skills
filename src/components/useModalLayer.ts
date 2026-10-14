import { useEffect, useRef, type RefObject } from 'react';

// Open modal layers, bottom → top. Only the topmost layer reacts to Escape and Tab, so
// a viewer stacked over a dialog closes alone instead of taking the dialog with it.
const stack: symbol[] = [];

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Registers a modal layer for the lifetime of the component: Escape calls
 * `onEscape` only while this is the topmost layer, and page scroll is locked
 * while any layer is open (so a full-screen sheet on a phone doesn't scroll
 * the page behind it). Given the layer's panel, Tab and Shift+Tab stay inside
 * it, and focus returns to whatever was focused before the layer opened.
 */
export function useModalLayer(onEscape: () => void, panelRef?: RefObject<HTMLElement | null>) {
  const onEscapeRef = useRef(onEscape);
  useEffect(() => {
    onEscapeRef.current = onEscape;
  });

  // Read during the first render, before the layer moves focus into itself.
  const openerRef = useRef<Element | null | undefined>(undefined);
  if (openerRef.current === undefined) openerRef.current = typeof document === 'undefined' ? null : document.activeElement;

  useEffect(() => {
    const id = Symbol('modal-layer');
    const opener = openerRef.current;
    if (stack.length === 0) document.body.style.overflow = 'hidden';
    stack.push(id);

    // Listen on window (not document) so events dispatched on either reach it.
    const onKeyDown = (event: KeyboardEvent) => {
      if (stack[stack.length - 1] !== id) return;
      if (event.key === 'Escape') {
        onEscapeRef.current();
        return;
      }
      const panel = panelRef?.current;
      if (event.key !== 'Tab' || !panel) return;
      const focusables = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (focusables.length === 0) {
        event.preventDefault();
        panel.focus();
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;
      const inside = active instanceof Node && panel.contains(active);
      if (event.shiftKey && (!inside || active === first || active === panel)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (!inside || active === last)) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      const at = stack.indexOf(id);
      if (at !== -1) stack.splice(at, 1);
      if (stack.length === 0) document.body.style.overflow = '';
      if (panelRef && opener instanceof HTMLElement && opener.isConnected) opener.focus();
    };
    // panelRef is a stable ref object; the layer registers once per mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
