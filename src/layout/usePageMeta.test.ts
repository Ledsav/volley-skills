import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { DEFAULT_DESCRIPTION, pageTitle, usePageMeta } from './usePageMeta';

const meta = (name: string) => document.head.querySelector<HTMLMetaElement>(`meta[name="${name}"]`)?.content;
const canonical = () => document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href ?? null;

describe('usePageMeta', () => {
  afterEach(() => {
    document.head.innerHTML = '';
    document.title = '';
  });

  it('formats the title', () => {
    expect(pageTitle('Home')).toBe('Home · Volley Skills · VCB');
  });

  it('sets title, description and noindex by default', () => {
    renderHook(() => usePageMeta({ title: 'Home' }));
    expect(document.title).toBe('Home · Volley Skills · VCB');
    expect(meta('description')).toBe(DEFAULT_DESCRIPTION);
    expect(meta('robots')).toBe('noindex, nofollow');
    expect(canonical()).toBeNull();
  });

  it('sets index + canonical for public pages', () => {
    renderHook(() => usePageMeta({ title: 'Sign in', description: 'Sign in to VCB', robots: 'index', canonicalPath: '/login' }));
    expect(meta('description')).toBe('Sign in to VCB');
    expect(meta('robots')).toBe('index, follow');
    expect(canonical()).toMatch(/\/login$/);
  });

  it('restores defaults on unmount', () => {
    const { unmount } = renderHook(() => usePageMeta({ title: 'Sign in', robots: 'index', canonicalPath: '/login' }));
    unmount();
    expect(document.title).toBe('Volley Skills · VCB');
    expect(meta('robots')).toBe('noindex, nofollow');
    expect(canonical()).toBeNull();
  });
});
