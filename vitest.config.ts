import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['**/*.test.ts'],
    exclude: ['node_modules/**', '.next/**'],
  },
  resolve: {
    alias: {
      // Mirrors tsconfig.json's "@/*": ["./*"] so test files can use the
      // same import paths as application code.
      '@': path.resolve(__dirname, '.'),
    },
  },
});
