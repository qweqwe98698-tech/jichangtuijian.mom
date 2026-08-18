import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
    environment: 'node',
  },
  resolve: {
    alias: {
      '@config': path.resolve(root, 'src/config'),
      '@components': path.resolve(root, 'src/components'),
      '@layouts': path.resolve(root, 'src/layouts'),
      '@lib': path.resolve(root, 'src/lib'),
      '@data': path.resolve(root, 'src/data'),
      '@': path.resolve(root, 'src'),
    },
  },
});
