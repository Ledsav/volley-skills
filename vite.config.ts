import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { robotsTxt, sitemapXml } from './src/seo/seoRoutes';

function seoFiles(origin: string): Plugin {
  return {
    name: 'seo-files',
    apply: 'build',
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'robots.txt', source: robotsTxt(origin) });
      this.emitFile({ type: 'asset', fileName: 'sitemap.xml', source: sitemapXml(origin) });
    },
  };
}

function siteUrlToken(origin: string): Plugin {
  return {
    name: 'site-url-token',
    transformIndexHtml: (html) => html.split('__SITE_URL__').join(origin),
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const origin = (env.VITE_SITE_URL || 'https://volley-skills.web.app').replace(/\/$/, '');
  return {
    plugins: [react(), seoFiles(origin), siteUrlToken(origin)],
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: './tests/setupTests.ts',
      exclude: ['**/node_modules/**', '**/dist/**', 'tests/rules/**'],
    },
  };
});
