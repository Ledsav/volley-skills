import { DiagramSvg } from '../diagrams/DiagramSvg';
import type { Scene } from '../types/diagram';

interface Props {
  scene: Scene | null;
  label: string;
  /** Omit for a plain (non-clickable) preview. */
  onOpen?: () => void;
  className?: string;
}

/** Small read-only preview of a draft diagram; a dashed box when there is none. */
export function DraftDiagramPreview({ scene, label, onOpen, className = 'h-32 w-32' }: Props) {
  const box = `${className} shrink-0 overflow-hidden rounded-md border`;
  if (!scene) {
    return (
      <div className={`${box} flex items-center justify-center border-dashed border-border text-xs text-slate`}>No diagram</div>
    );
  }
  if (!onOpen) {
    return (
      <div className={`${box} border-border bg-surface`}>
        <DiagramSvg scene={scene} />
      </div>
    );
  }
  return (
    <button type="button" aria-label={label} onClick={onOpen} className={`${box} border-border bg-surface hover:border-blue`}>
      <DiagramSvg scene={scene} />
    </button>
  );
}
