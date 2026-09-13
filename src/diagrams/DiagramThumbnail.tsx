import { useEffect, useState } from 'react';
import { getFirstDiagram, listDiagrams } from './diagramsApi';
import { DiagramLightbox } from './DiagramLightbox';
import { DiagramSvg } from './DiagramSvg';
import type { Diagram } from '../types/diagram';

const cache = new Map<string, Diagram | null>();

export function clearDiagramThumbnailCache() {
  cache.clear();
}

/** Drop one exercise's cached thumbnail so the next mount refetches it — call
 *  this after a diagram save so the `/exercises` row stops showing "no diagram". */
export function invalidateDiagramThumbnail(exerciseId: string) {
  cache.delete(exerciseId);
}

export function DiagramThumbnail({ exerciseId, className }: { exerciseId: string; className?: string }) {
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

  return (
    <>
      <button
        type="button"
        onClick={() => void openLightbox()}
        aria-label={`Expand diagram ${diagram.title}`}
        className={
          className ??
          'aspect-square w-16 shrink-0 overflow-hidden rounded-sm border border-border bg-surface'
        }
      >
        <DiagramSvg scene={diagram.scene} />
      </button>
      {lightboxDiagrams && (
        <DiagramLightbox diagrams={lightboxDiagrams} startIndex={0} onClose={() => setLightboxDiagrams(null)} />
      )}
    </>
  );
}
