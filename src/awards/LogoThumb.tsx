import { useEffect, useRef } from 'react';

/** Small preview of a logo canvas (kept in memory only), drawn contain-fit. */
export function LogoThumb({ img, size = 48 }: { img: HTMLCanvasElement; size?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const ctx = ref.current?.getContext('2d');
    if (!ctx || !img.width || !img.height) return;
    const s = Math.min(size / img.width, size / img.height);
    const w = img.width * s, h = img.height * s;
    ctx.clearRect(0, 0, size, size);
    ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
  }, [img, size]);
  return <canvas ref={ref} width={size} height={size} className="rounded-sm bg-bg ring-1 ring-separator" aria-hidden="true" />;
}
