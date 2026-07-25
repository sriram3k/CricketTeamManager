import { defineConfig } from 'vitest/config';

export default defineConfig({
  // This is a Node API with no stylesheets. Without an inline postcss config,
  // Vite searches upward and picks up the parent repository's Tailwind setup.
  css: { postcss: { plugins: [] } },
  test: {
    environment: 'node',
    globals: false,
    setupFiles: ['./tests/setup.ts'],
    // Money tests share one database; running files in parallel would let one
    // suite's truncate wipe another's fixtures mid-assertion.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
