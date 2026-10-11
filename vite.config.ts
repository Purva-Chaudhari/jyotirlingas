import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';
import { copyFileSync, existsSync } from 'node:fs';
import type { Connect, Plugin } from 'vite';
import { ALL_TEMPLES } from './src/open';

/**
 * Each temple has its own address, /<id> (e.g. /mahakaleshwar), served by the temple page (temples.html), which
 * enters the open ones and sends the rest back to the landing page: rewritten in dev and preview, and copied to
 * dist/<id>.html in the build (the static server finds /<id> → <id>.html).
 */
function templeAddresses(): Plugin {
  const rewrite: Connect.NextHandleFunction = (req, _res, next) => {
    const [path, query = ''] = (req.url ?? '').split('?');
    const id = path.replace(/^\/+|\/+$/g, '');
    if (ALL_TEMPLES.includes(id)) req.url = `/temples.html${query ? `?${query}` : ''}`;
    next();
  };
  let outDir = resolve(__dirname, 'dist');
  return {
    name: 'temple-addresses',
    configResolved(c) { outDir = resolve(c.root, c.build.outDir); },
    configureServer(server) { server.middlewares.use(rewrite); },
    configurePreviewServer(server) { server.middlewares.use(rewrite); },
    closeBundle() {
      const page = resolve(outDir, 'temples.html');
      if (!existsSync(page)) return;
      for (const id of ALL_TEMPLES) copyFileSync(page, resolve(outDir, `${id}.html`));
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [templeAddresses()],
  define: {
    // Cesium reads this global to find Workers/Assets
    CESIUM_BASE_URL: JSON.stringify('./cesium'),
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        temples: resolve(__dirname, 'temples.html'),
      },
    },
  },
  test: {
    environment: 'happy-dom',
    include: ['tests/**/*.test.ts'],
  },
});
