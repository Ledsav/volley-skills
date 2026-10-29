import { Button } from '../../components/Button';

export type StatusStripProps =
  | { kind: 'error'; message: string; dismissLabel: string; onDismiss: () => void }
  | { kind: 'matchOver'; label: string; finishLabel: string; onFinish: () => void }
  | { kind: 'betweenSets'; label: string; undoLabel: string | null; onUndo: () => void; startLabel: string; onStart: () => void }
  | { kind: 'inserting'; label: string; backLabel: string; onBack: () => void };

const ROW = 'flex min-h-11 flex-wrap items-center justify-between gap-2 px-4 py-1 text-footnote';

/** The one slim row under the scouting header. */
export function StatusStrip(props: StatusStripProps) {
  switch (props.kind) {
    case 'error':
      return (
        <div role="alert" className={`${ROW} bg-red-tint text-red-strong`}>
          <span>{props.message}</span>
          <Button variant="ghost" size="sm" onClick={props.onDismiss}>{props.dismissLabel}</Button>
        </div>
      );
    case 'matchOver':
      return (
        <div className={`${ROW} bg-green-tint text-ink`}>
          <span className="font-semibold">{props.label}</span>
          <Button variant="primary" size="sm" onClick={props.onFinish}>{props.finishLabel}</Button>
        </div>
      );
    case 'betweenSets':
      return (
        <div className={`${ROW} bg-surface-2 text-ink`}>
          <span className="font-semibold">{props.label}</span>
          <div className="flex gap-2">
            {props.undoLabel && <Button variant="ghost" size="sm" onClick={props.onUndo}>{props.undoLabel}</Button>}
            <Button variant="primary" size="sm" onClick={props.onStart}>{props.startLabel}</Button>
          </div>
        </div>
      );
    case 'inserting':
      return (
        <div className={`${ROW} bg-surface-2 text-ink`}>
          <span>{props.label}</span>
          <Button variant="ghost" size="sm" onClick={props.onBack}>{props.backLabel}</Button>
        </div>
      );
  }
}
