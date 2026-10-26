/** The only routes search engines may index (spec D3). */
export const PUBLIC_ROUTES = [
  '/login', '/privacy', '/request-access', '/signup',
  '/legal/terms', '/legal/dpa', '/legal/subprocessors', '/legal/dpia-pack',
] as const;

/**
 * Private areas: path prefixes only, never IDs (robots.txt is public). A prefix
 * ending in '/' covers only what is below it, so the public '/signup' stays indexable.
 */
export const PRIVATE_PREFIXES = [
  '/teams', '/exercises', '/trainings', '/admin', '/settings', '/finish-sign-in',
  '/club', '/platform', '/signup/', '/sign/', '/welcome',
] as const;

export function robotsTxt(origin: string): string {
  return [
    'User-agent: *',
    ...PUBLIC_ROUTES.map((r) => `Allow: ${r}`),
    '',
    `Sitemap: ${origin}/sitemap.xml`,
    '',
  ].join('\n');
}

export function sitemapXml(origin: string): string {
  const urls = PUBLIC_ROUTES.map((r) => `  <url><loc>${origin}${r}</loc></url>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

/** Firebase Hosting `source` globs that must carry `X-Robots-Tag: noindex, nofollow`. */
export function noindexHeaderSources(): string[] {
  return ['/', ...PRIVATE_PREFIXES.flatMap((p) => (p.endsWith('/') ? [`${p}**`] : [p, `${p}/**`]))];
}
