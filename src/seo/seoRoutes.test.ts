import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PUBLIC_ROUTES, noindexHeaderSources, robotsTxt, sitemapXml } from './seoRoutes';

describe('seoRoutes', () => {
  it('public routes are exactly the three indexable pages', () => {
    expect([...PUBLIC_ROUTES]).toEqual(['/login', '/privacy', '/request-access']);
  });

  it('robots.txt allows public, has no Disallow (so crawlers see the noindex header), links the sitemap', () => {
    const txt = robotsTxt('https://example.org');
    for (const r of PUBLIC_ROUTES) expect(txt).toContain(`Allow: ${r}`);
    expect(txt).not.toContain('Disallow');
    expect(txt).toContain('Sitemap: https://example.org/sitemap.xml');
    expect(txt).not.toMatch(/[0-9a-zA-Z]{20}/); // no doc IDs
  });

  it('sitemap lists exactly the public routes', () => {
    const xml = sitemapXml('https://example.org');
    const locs = [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => m[1]);
    expect(locs).toEqual(PUBLIC_ROUTES.map((r) => `https://example.org${r}`));
  });

  it('firebase.json sends X-Robots-Tag noindex for every private source', () => {
    const config = JSON.parse(readFileSync('firebase.json', 'utf8')) as {
      hosting: { headers: { source: string; headers: { key: string; value: string }[] }[] };
    };
    const noindexed = config.hosting.headers
      .filter((h) => h.headers.some((x) => x.key === 'X-Robots-Tag' && x.value === 'noindex, nofollow'))
      .map((h) => h.source);
    expect(noindexed.sort()).toEqual(noindexHeaderSources().sort());
  });
});
