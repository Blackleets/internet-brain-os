import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@internet-brain-os/shared': fileURLToPath(
        new URL('./packages/shared/src/index.ts', import.meta.url),
      ),
      '@internet-brain-os/kernel': fileURLToPath(
        new URL('./packages/kernel/src/index.ts', import.meta.url),
      ),
    },
  },
  test: {
    passWithNoTests: true,
  },
});
