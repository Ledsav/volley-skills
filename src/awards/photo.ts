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
