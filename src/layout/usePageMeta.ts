import { useEffect } from 'react';

interface PageMeta {
  title: string;
  description?: string;
  /** Private pages are `noindex` (the default); only /login, /privacy, /request-access pass `index`. */
  robots?: 'index' | 'noindex';
  /** Path for <link rel="canonical">; public pages only. */
  canonicalPath?: string;
}

export const DEFAULT_DESCRIPTION =
  'Volley Skills — team, player, training and match scouting tool for volleyball clubs.';
const DEFAULT_TITLE = 'Volley Skills';

export function pageTitle(title: string): string {
  return `${title} · ${DEFAULT_TITLE}`;
}

function siteOrigin(): string {
  return (import.meta.env.VITE_SITE_URL as string | undefined)?.replace(/\/$/, '') || window.location.origin;
}

function upsertMeta(name: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.name = name;
    document.head.appendChild(el);
  }
  el.content = content;
}

function setCanonical(href: string | null) {
  const existing = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!href) {
    existing?.remove();
    return;
  }
  const el = existing ?? document.head.appendChild(Object.assign(document.createElement('link'), { rel: 'canonical' }));
  el.href = href;
}

export function usePageMeta({ title, description, robots = 'noindex', canonicalPath }: PageMeta): void {
  useEffect(() => {
    document.title = pageTitle(title);
    upsertMeta('description', description ?? DEFAULT_DESCRIPTION);
    upsertMeta('robots', robots === 'index' ? 'index, follow' : 'noindex, nofollow');
    setCanonical(canonicalPath ? `${siteOrigin()}${canonicalPath}` : null);
    return () => {
      document.title = DEFAULT_TITLE;
      upsertMeta('description', DEFAULT_DESCRIPTION);
      upsertMeta('robots', 'noindex, nofollow');
      setCanonical(null);
    };
  }, [title, description, robots, canonicalPath]);
}
