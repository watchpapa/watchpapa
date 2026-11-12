import { configDefaults, defineConfig } from "vitest/config";

// Pure-function unit tests (normalizers, csv, releases logic) run in plain node.
// Integration tests that need the Workers runtime can add a separate project with
// @cloudflare/vitest-pool-workers later.
export default defineConfig({
  test: {
    include: ["test/**/*.test.js"],
    // E2E tests are node:test files with their own script (npm run test:e2e).
    exclude: [...configDefaults.exclude, "test/e2e/**"],
    environment: "node",
  },
});
