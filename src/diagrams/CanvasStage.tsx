import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useGesture } from '@use-gesture/react';

interface StageApi {
  screenToCourt: (clientX: number, clientY: number) => { x: number; y: number };
}

interface Props {
  children: ReactNode;
  onReady?: (api: StageApi) => void;
}

const MIN = 0.5;
const MAX = 4;

export function CanvasStage({ children, onReady }: Props) {
  const outerRef = useRef<HTMLDivElement>(null);
  const [t, setT] = useState({ x: 0, y: 0, scale: 1 });

  useGesture(
    {
      onDrag: ({ delta: [dx, dy], pinching }) => {
        if (pinching) return;
        setT((s) => ({ ...s, x: s.x + dx, y: s.y + dy }));
      },
      onPinch: ({ offset: [s] }) => setT((cur) => ({ ...cur, scale: Math.max(MIN, Math.min(MAX, s)) })),
      onWheel: ({ delta: [, dy] }) => setT((s) => ({ ...s, scale: Math.max(MIN, Math.min(MAX, s.scale - dy * 0.001)) })),
    },
    { target: outerRef, eventOptions: { passive: false } },
  );

  // Publish a fresh screen→court converter whenever the transform changes.
  useEffect(() => {
    if (!onReady) return;
    onReady({
      screenToCourt: (clientX, clientY) => {
        const el = outerRef.current;
        if (!el) return { x: 50, y: 50 };
        const r = el.getBoundingClientRect();
        const side = Math.min(r.width, r.height) || 1;
        const px = (clientX - r.left - t.x) / t.scale;
        const py = (clientY - r.top - t.y) / t.scale;
        return { x: (px / side) * 100, y: (py / side) * 100 };
      },
    });
  }, [t, onReady]);

  return (
    <div ref={outerRef} data-canvas-stage className="relative h-full w-full overflow-hidden bg-bg" style={{ touchAction: 'none' }}>
      <div className="absolute inset-0" style={{ transform: `translate(${t.x}px, ${t.y}px) scale(${t.scale})`, transformOrigin: '0 0' }}>
        {children}
      </div>
    </div>
  );
}
