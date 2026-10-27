import { useEffect, useState } from 'react';
import { getFirstDiagram, listDiagrams } from './diagramsApi';
import { DiagramLightbox } from './DiagramLightbox';
import { DiagramSvg } from './DiagramSvg';
import type { Diagram } from '../types/diagram';
import { useT } from '../i18n/I18nProvider';

const cache = new Map<string, Diagram | null>();

export function clearDiagramThumbnailCache() {
  cache.clear();
}

/** Drop one exercise's cached thumbnail so the next mount refetches it — call
 *  this after a diagram save so the `/exercises` row stops showing "no diagram". */
export function invalidateDiagramThumbnail(exerciseId: string) {
  cache.delete(exerciseId);
}

interface DiagramThumbnailProps {
  exerciseId: string;
  className?: string;
  /** `false` renders a plain preview (no lightbox button) for use inside
   *  another clickable element, where a nested button would be invalid. */
  interactive?: boolean;
}

export function DiagramThumbnail({ exerciseId, className, interactive = true }: DiagramThumbnailProps) {
  const t = useT();
  const [diagram, setDiagram] = useState<Diagram | null | undefined>(
    cache.has(exerciseId) ? cache.get(exerciseId) : undefined,
  );
  const [lightboxDiagrams, setLightboxDiagrams] = useState<Diagram[] | null>(null);

  async function openLightbox() {
    if (!diagram) return;
    try {
      const all = await listDiagrams(exerciseId);
      setLightboxDiagrams(all.length > 0 ? all : [diagram]);
    } catch {
      setLightboxDiagrams([diagram]);
    }
  }

  useEffect(() => {
    if (cache.has(exerciseId)) {
      setDiagram(cache.get(exerciseId) ?? null);
      return;
    }
    let cancelled = false;
    getFirstDiagram(exerciseId)
      .then((d) => {
        cache.set(exerciseId, d);
        if (!cancelled) setDiagram(d);
      })
      .catch(() => {
        if (!cancelled) setDiagram(null);
      });
    return () => {
      cancelled = true;
    };
  }, [exerciseId]);

  if (!diagram) return null;

  const boxClass =
    className ?? 'aspect-square w-16 shrink-0 overflow-hidden rounded-sm border border-border bg-surface';

  if (!interactive) {
    return (
      <span aria-hidden="true" className={`block ${boxClass}`}>
        <DiagramSvg scene={diagram.scene} />
      </span>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => void openLightbox()}
        aria-label={t.diagrams.thumbnail.expand(diagram.title)}
        className={boxClass}
      >
        <DiagramSvg scene={diagram.scene} />
      </button>
      {lightboxDiagrams && (
        <DiagramLightbox diagrams={lightboxDiagrams} startIndex={0} onClose={() => setLightboxDiagrams(null)} />
      )}
    </>
  );
}
