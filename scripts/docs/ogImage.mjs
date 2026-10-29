// Pure helpers for the link-preview image (public/og-image.svg and .png).

export const OG = { width: 1200, height: 630, bg: '#000000', lockupWidth: 720 };

/**
 * The white lockup centred on black at 1200x630. The lockup's viewBox and inner markup (outer svg and
 * title stripped) are nested unchanged; nothing is redrawn.
 */
export function ogImageSvg(lockupSvg) {
  const vb = /viewBox="([^"]+)"/.exec(lockupSvg)?.[1];
  const inner = /<svg[^>]*>([\s\S]*)<\/svg>/.exec(lockupSvg)?.[1];
  if (!vb || inner === undefined) throw new Error('Not a lockup SVG');
  const [, , vw, vh] = vb.split(/\s+/).map(Number);
  const w = OG.lockupWidth;
  const h = +((w * vh) / vw).toFixed(1);
  const x = (OG.width - w) / 2;
  const y = +((OG.height - h) / 2).toFixed(1);
  const body = inner.replace(/<title>[\s\S]*?<\/title>/g, '');
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${OG.width}" height="${OG.height}" ` +
    `viewBox="0 0 ${OG.width} ${OG.height}" role="img" aria-label="Volley Skills">` +
    `<rect width="${OG.width}" height="${OG.height}" fill="${OG.bg}"/>` +
    `<svg x="${x}" y="${y}" width="${w}" height="${h}" viewBox="${vb}" fill="#ffffff">${body}</svg></svg>\n`
  );
}

/** Width and height from a PNG's IHDR chunk. Throws when the signature is wrong. */
export function pngSize(buf) {
  const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (buf.length < 24 || sig.some((b, i) => buf[i] !== b)) throw new Error('Not a PNG');
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}
