import { describe, expect, it } from 'vitest';
import { cropRect, fitSize, loadImageFile } from './photo';

describe('photo', () => {
  it('fitSize keeps the aspect ratio and caps the long side', () => {
    expect(fitSize(4000, 2000, 1920)).toEqual({ w: 1920, h: 960 });
    expect(fitSize(1000, 3000, 1920)).toEqual({ w: 640, h: 1920 });
    expect(fitSize(800, 600, 1920)).toEqual({ w: 800, h: 600 });
  });

  it('centre crop of a landscape image at zoom 1 is the full height square', () => {
    expect(cropRect(1600, 1000, { cx: 0.5, cy: 0.5, zoom: 1 })).toEqual({ sx: 300, sy: 0, size: 1000 });
  });

  it('zoom shrinks the square and clamps inside the image', () => {
    expect(cropRect(1000, 1000, { cx: 0.5, cy: 0.5, zoom: 2 })).toEqual({ sx: 250, sy: 250, size: 500 });
    expect(cropRect(1000, 1000, { cx: 0, cy: 1, zoom: 2 })).toEqual({ sx: 0, sy: 500, size: 500 });
  });

  it('rejects non-image files', async () => {
    await expect(loadImageFile(new File(['x'], 'a.txt', { type: 'text/plain' }))).rejects.toThrow('Choose an image file.');
  });
});
