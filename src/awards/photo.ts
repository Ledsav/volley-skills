import { opaqueBounds } from './card/branding';

export interface Crop { cx: number; cy: number; zoom: number }

const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));

export function cropRect(srcW: number, srcH: number, crop: Crop): { sx: number; sy: number; size: number } {
  const size = Math.min(srcW, srcH) / Math.max(1, crop.zoom);
  const sx = clamp(crop.cx * srcW - size / 2, 0, srcW - size);
  const sy = clamp(crop.cy * srcH - size / 2, 0, srcH - size);
  return { sx: Math.round(sx), sy: Math.round(sy), size: Math.round(size) };
}

/** Decodes in the browser only; the file never leaves the device. */
export async function loadImageFile(file: File): Promise<ImageBitmap> {
  if (!file.type.startsWith('image/')) throw new Error('Choose an image file.');
  try {
    return await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    throw new Error('This image could not be opened.');
  }
}

export function renderCrop(src: ImageBitmap, crop: Crop, out = 1080): HTMLCanvasElement {
  const { sx, sy, size } = cropRect(src.width, src.height, crop);
  const side = Math.min(out, size);
  const canvas = document.createElement('canvas');
  canvas.width = side;
  canvas.height = side;
  canvas.getContext('2d')!.drawImage(src, sx, sy, size, size, 0, 0, side, side);
  return canvas;
}

/** Scale (w, h) so the long side is at most `max`, keeping the aspect ratio. */
export function fitSize(w: number, h: number, max: number): { w: number; h: number } {
  const k = Math.min(1, max / Math.max(w, h));
  return { w: Math.max(1, Math.round(w * k)), h: Math.max(1, Math.round(h * k)) };
}

/**
 * A club or sponsor logo for the cards: at most 512px, kept in memory only. A white
 * background (typical of JPG logos) is made transparent so the logo can sit on any slide.
 */
export async function loadLogoFile(file: File, knockOut: (px: Uint8ClampedArray, w: number, h: number) => boolean): Promise<HTMLCanvasElement> {
  const bmp = await loadImageFile(file);
  const { w, h } = fitSize(bmp.width, bmp.height, 512);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('This image could not be opened.');
  ctx.drawImage(bmp, 0, 0, w, h);
  bmp.close();
  const data = ctx.getImageData(0, 0, w, h);
  if (knockOut(data.data, w, h)) ctx.putImageData(data, 0, 0);
  // Crop transparent padding so every logo is sized by what is actually drawn.
  const box = opaqueBounds(data.data, w, h);
  if (!box || (box.w === w && box.h === h)) return c;
  const out = document.createElement('canvas');
  out.width = box.w;
  out.height = box.h;
  out.getContext('2d')?.drawImage(c, box.x, box.y, box.w, box.h, 0, 0, box.w, box.h);
  return out;
}
