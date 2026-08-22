import { defineConfig } from 'vitest/config';
import { fileURLToPath, URL } from 'node:url';

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
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
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx', 'src/**/*.test.ts'],
    css: false,
  },
});
