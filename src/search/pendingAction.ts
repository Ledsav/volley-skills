import type { PendingActionId } from './types';

/** Router navigation options that tell the destination page to open its create form. */
export function withPendingAction(id: PendingActionId): { state: { pendingAction: PendingActionId } } {
  return { state: { pendingAction: id } };
}
