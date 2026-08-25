import { fileURLToPath } from 'node:url';
import { defineConfig, configDefaults } from 'vitest/config';

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
    // Keep vitest's default excludes (node_modules, dist, etc.) and add the
    // dashboard e2e specs, which are Playwright files that must not run under vitest.
    exclude: [
      ...configDefaults.exclude,
      '**/e2e/**',
      // Compiled test artifacts (tsc -p tsconfig.sqlite-test.json output) must
      // never be scanned as sources.
      'dist-sqlite-test/**',
      // node:sqlite cannot be resolved by Vite 5's transform pipeline
      // (vitest-dev/vitest#7177). This spec has a dedicated runner:
      // `node --test sqlite-entity-repository.nodetest.mjs` in packages/kernel.
      'packages/kernel/src/entity/sqlite-entity-repository.test.ts',
    ],
  },
});
