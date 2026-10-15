// src/awards/cutout/segment.ts
/**
 * On-device background removal. The MediaPipe runtime and model are served from this
 * site (/mediapipe, /models) and loaded on first use only; photos never leave the device.
 */
interface Mask { width: number; height: number; getAsFloat32Array(): Float32Array; close(): void }
interface Segmenter { segment(image: HTMLCanvasElement): { confidenceMasks?: Mask[]; close(): void } }

let loading: Promise<Segmenter> | null = null;

function getSegmenter(): Promise<Segmenter> {
  if (!loading) {
    loading = (async () => {
      const { FilesetResolver, ImageSegmenter } = await import('@mediapipe/tasks-vision');
      const fileset = await FilesetResolver.forVisionTasks('/mediapipe');
      return (await ImageSegmenter.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: '/models/selfie_segmenter.tflite', delegate: 'CPU' },
        runningMode: 'IMAGE',
        outputConfidenceMasks: true,
        outputCategoryMask: false,
      })) as unknown as Segmenter;
    })();
    loading.catch(() => { loading = null; }); // a failed load can be retried
  }
  return loading;
}

const smooth = (lo: number, hi: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - lo) / (hi - lo)));
  return t * t * (3 - 2 * t);
};

/** Person confidence → alpha (0–255) at the image size; a smoothstep gives the soft edge. */
export function maskToAlpha(mask: Float32Array, mw: number, mh: number, w: number, h: number): Uint8ClampedArray {
  const out = new Uint8ClampedArray(w * h);
  for (let y = 0; y < h; y++) {
    const my = Math.min(mh - 1, Math.floor((y * mh) / h));
    for (let x = 0; x < w; x++) {
      const mx = Math.min(mw - 1, Math.floor((x * mw) / w));
      out[y * w + x] = Math.round(255 * smooth(0.3, 0.7, mask[my * mw + mx]));
    }
  }
  return out;
}

export function opaqueBounds(alpha: Uint8ClampedArray, w: number, h: number, threshold = 8): { x: number; y: number; w: number; h: number } | null {
  let minX = w, minY = h, maxX = -1, maxY = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (alpha[y * w + x] > threshold) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  return maxX < 0 ? null : { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

export async function removeBackground(photo: HTMLCanvasElement): Promise<HTMLCanvasElement> {
  const segmenter = await getSegmenter();
  const result = segmenter.segment(photo);
  try {
    const masks = result.confidenceMasks ?? [];
    // Selfie models return either [person] or [background, person]: the last mask is the person.
    const mask = masks[masks.length - 1];
    if (!mask) throw new Error('No person found in the photo');
    const { width: w, height: h } = photo;
    const alpha = maskToAlpha(mask.getAsFloat32Array(), mask.width, mask.height, w, h);
    const box = opaqueBounds(alpha, w, h);
    if (!box) throw new Error('No person found in the photo');
    const src = photo.getContext('2d')!.getImageData(0, 0, w, h);
    for (let i = 0; i < alpha.length; i++) src.data[i * 4 + 3] = Math.min(src.data[i * 4 + 3], alpha[i]);
    const full = document.createElement('canvas');
    full.width = w;
    full.height = h;
    full.getContext('2d')!.putImageData(src, 0, 0);
    const out = document.createElement('canvas');
    out.width = box.w;
    out.height = box.h;
    out.getContext('2d')!.drawImage(full, box.x, box.y, box.w, box.h, 0, 0, box.w, box.h);
    full.width = 0;
    return out;
  } finally {
    result.close();
  }
}
