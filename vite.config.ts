import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath, URL } from 'node:url';

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['fonts/*.ttf', 'favicon.svg'],
      manifest: {
        name: 'Nabz — Prescription',
        short_name: 'Nabz',
        description:
          'Bilingual clinical prescriptions. Records stay on this device.',
        theme_color: '#0f8055',
        background_color: '#eef1f2',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Fonts are large (Nastaliq ~700KB) but MUST be offline-available:
        // an un-embeddable font means no Urdu PDF, which is the whole product.
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        globPatterns: ['**/*.{js,css,html,svg,png,ttf,json}'],
      },
    }),
  ],
  /**
   * harfbuzzjs must NOT be pre-bundled.
   *
   * Its Emscripten glue locates the WASM with
   * `new URL('harfbuzz.wasm', import.meta.url)`. Pre-bundling rewrites
   * import.meta.url to `/node_modules/.vite/deps/`, where the .wasm does not
   * exist -- and Vite's SPA fallback answers that request with index.html and a
   * 200, so the failure arrives as a WASM magic-number error rather than a 404.
   * harfbuzzjs then rejects at TOP LEVEL (`init(await createHarfBuzz())`),
   * which takes down every module that imports it: a blank page in dev while
   * the production build is fine, because the build handles the URL properly.
   *
   * Excluding it keeps import.meta.url pointing at the package's own directory,
   * where the .wasm actually sits.
   */
  optimizeDeps: {
    exclude: ['harfbuzzjs'],
  },
  resolve: {
    alias: {
      '@domain': r('./src/domain'),
      '@data': r('./src/data'),
      '@config': r('./src/config'),
      '@storage': r('./src/storage'),
      '@render': r('./src/render'),
      '@app': r('./src/app'),
    },
  },
});
