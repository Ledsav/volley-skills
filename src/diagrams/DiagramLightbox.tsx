import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useModalLayer } from '../components/useModalLayer';
import { DiagramSvg } from './DiagramSvg';
import type { Diagram } from '../types/diagram';
import { useT } from '../i18n/I18nProvider';

interface Props {
  diagrams: Diagram[];
  startIndex: number;
  onClose: () => void;
}

const roundBtn = 'glass inline-flex h-11 w-11 items-center justify-center rounded-full text-ink';

export function DiagramLightbox({ diagrams, startIndex, onClose }: Props) {
  const t = useT();
  const [i, setI] = useState(startIndex);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  useModalLayer(onClose);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') setI((n) => (n + 1) % diagrams.length);
      if (e.key === 'ArrowLeft') setI((n) => (n - 1 + diagrams.length) % diagrams.length);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [diagrams.length]);

  const current = diagrams[i];
  if (!current) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={current.title}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-[var(--scrim)] p-4"
    >
      <div className="flex w-full max-w-3xl items-center justify-between gap-3">
        <span className="glass min-w-0 truncate rounded-full px-4 py-2 text-headline text-ink">{current.title}</span>
        <button
          ref={closeRef}
          type="button"
          aria-label={t.common.close}
          onClick={onClose}
          className={`${roundBtn} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus`}
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>
      <div className="my-3 aspect-square w-full max-w-[min(90vw,70vh)] overflow-hidden rounded-xl bg-surface p-4 shadow-pop">
        <DiagramSvg scene={current.scene} />
      </div>
      {diagrams.length > 1 && (
        <div className="flex gap-4">
          <button
            type="button"
            aria-label={t.diagrams.nav.previous}
            onClick={() => setI((n) => (n - 1 + diagrams.length) % diagrams.length)}
            className={roundBtn}
          >
            <ChevronLeft className="h-5 w-5" aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label={t.diagrams.nav.next}
            onClick={() => setI((n) => (n + 1) % diagrams.length)}
            className={roundBtn}
          >
            <ChevronRight className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  );
}
