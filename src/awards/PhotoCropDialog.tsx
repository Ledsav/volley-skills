import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { Dialog } from '../components/Dialog';
import { Button } from '../components/Button';
import { cropRect, loadImageFile, renderCrop, type Crop } from './photo';

const PREVIEW = 280;

export function PhotoCropDialog({ open, file, onCancel, onDone }: { open: boolean; file: File | null; onCancel: () => void; onDone: (img: HTMLCanvasElement) => void }) {
  const [bitmap, setBitmap] = useState<ImageBitmap | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [crop, setCrop] = useState<Crop>({ cx: 0.5, cy: 0.5, zoom: 1 });
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drag = useRef<{ x: number; y: number; crop: Crop } | null>(null);

  useEffect(() => {
    setError(null);
    setBitmap(null);
    setCrop({ cx: 0.5, cy: 0.5, zoom: 1 });
    if (!file) return;
    let cancelled = false;
    let loaded: ImageBitmap | null = null;
    loadImageFile(file)
      .then((b) => {
        loaded = b;
        if (!cancelled) setBitmap(b);
      })
      .catch((e: Error) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
      loaded?.close();
    };
  }, [file]);

  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx || !bitmap) return;
    const { sx, sy, size } = cropRect(bitmap.width, bitmap.height, crop);
    ctx.clearRect(0, 0, PREVIEW, PREVIEW);
    ctx.save();
    ctx.beginPath();
    ctx.arc(PREVIEW / 2, PREVIEW / 2, PREVIEW / 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(bitmap, sx, sy, size, size, 0, 0, PREVIEW, PREVIEW);
    ctx.restore();
  }, [bitmap, crop]);

  function onPointerDown(e: PointerEvent<HTMLCanvasElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, crop };
  }
  function onPointerMove(e: PointerEvent<HTMLCanvasElement>) {
    if (!drag.current || !bitmap) return;
    const { size } = cropRect(bitmap.width, bitmap.height, drag.current.crop);
    const k = size / PREVIEW; // source px per preview px
    setCrop({
      ...drag.current.crop,
      cx: Math.max(0, Math.min(1, drag.current.crop.cx - ((e.clientX - drag.current.x) * k) / bitmap.width)),
      cy: Math.max(0, Math.min(1, drag.current.crop.cy - ((e.clientY - drag.current.y) * k) / bitmap.height)),
    });
  }

  if (!open) return null;
  return (
    <Dialog onClose={onCancel} title="Position the photo">
      <p className="mb-3 text-sm text-slate">The photo stays on this device and is forgotten when you leave this page.</p>
      {error && <p role="alert" className="mb-3 text-red">{error}</p>}
      {bitmap && (
        <>
          <canvas
            ref={canvasRef} width={PREVIEW} height={PREVIEW}
            className="mx-auto block touch-none cursor-grab rounded-full bg-bg"
            onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={() => (drag.current = null)}
            aria-label="Drag to position the photo"
          />
          <label className="mt-3 block text-sm text-slate">
            Zoom
            <input type="range" min={1} max={4} step={0.05} value={crop.zoom} className="ml-2 w-48 align-middle"
              onChange={(e) => setCrop({ ...crop, zoom: Number(e.target.value) })} />
          </label>
        </>
      )}
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button variant="primary" disabled={!bitmap} onClick={() => bitmap && onDone(renderCrop(bitmap, crop))}>Use photo</Button>
      </div>
    </Dialog>
  );
}
