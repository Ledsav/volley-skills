import type { ReactNode } from 'react';
import { Sheet } from './Sheet';

interface DialogProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** `lg` widens the panel for form-heavy content (development plan, skills). */
  size?: 'md' | 'lg';
  /**
   * For content meant to be read or worked in on a phone: the sheet opens at its
   * large detent instead of fitting its content. Desktop is unaffected.
   */
  mobileSheet?: boolean;
  /**
   * Pinned below the scrolling body, so primary actions (Save / Cancel) stay
   * reachable on a phone without scrolling to the end of a long form. A form
   * in the body wires its submit button here via the `form` attribute.
   */
  footer?: ReactNode;
  /**
   * The form has unsaved changes: a backdrop tap, Escape or the close button asks
   * "Discard changes?" first instead of closing. Explicit Cancel buttons in the
   * body still call `onClose` directly.
   */
  dirty?: boolean;
  /**
   * Treat the dialog as dirty once any field inside it changes (inputs bubble
   * `onChange`), so form dialogs get the discard guard without tracking state.
   */
  guardUnsaved?: boolean;
}

/** The long-standing dialog API, rendered by the v2 `Sheet` (centred on desktop, bottom sheet on phones). */
export function Dialog({ title, onClose, children, size = 'md', mobileSheet = false, footer, dirty = false, guardUnsaved = false }: DialogProps) {
  return (
    <Sheet
      title={title}
      onClose={onClose}
      size={size}
      footer={footer}
      dirty={dirty}
      guardUnsaved={guardUnsaved}
      detent={mobileSheet ? 'large' : 'content'}
    >
      {children}
    </Sheet>
  );
}
