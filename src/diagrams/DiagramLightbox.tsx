import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { DiagramSvg } from './DiagramSvg';
import type { Diagram } from '../types/diagram';

interface Props {
  diagrams: Diagram[];
  startIndex: number;
  onClose: () => void;
}

export function DiagramLightbox({ diagrams, startIndex, onClose }: Props) {
  const [i, setI] = useState(startIndex);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') setI((n) => (n + 1) % diagrams.length);
      if (e.key === 'ArrowLeft') setI((n) => (n - 1 + diagrams.length) % diagrams.length);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [diagrams.length, onClose]);

  const current = diagrams[i];
  if (!current) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={current.title}
      className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-black/70 p-4"
    >
      <div className="flex w-full max-w-3xl items-center justify-between text-white">
        <span className="font-medium">{current.title}</span>
        <button ref={closeRef} type="button" aria-label="Close" onClick={onClose}>
          <X className="h-5 w-5" />
        </button>
      </div>
      <div className="my-3 w-full max-w-3xl rounded-lg bg-surface p-4">
        <DiagramSvg scene={current.scene} />
      </div>
      {diagrams.length > 1 && (
        <div className="flex gap-4 text-white">
          <button
            type="button"
            aria-label="Previous diagram"
            onClick={() => setI((n) => (n - 1 + diagrams.length) % diagrams.length)}
          >
            ‹ Prev
          </button>
          <button
            type="button"
            aria-label="Next diagram"
            onClick={() => setI((n) => (n + 1) % diagrams.length)}
          >
            Next ›
          </button>
        </div>
      )}
    </div>
  );
}
