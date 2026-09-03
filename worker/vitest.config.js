import { defineConfig } from "vitest/config";

// Pure-function unit tests (normalizers, csv, releases logic) run in plain node.
// Integration tests that need the Workers runtime can add a separate project with
// @cloudflare/vitest-pool-workers later.
export default defineConfig({
  test: {
    include: ["test/**/*.test.js"],
    environment: "node",
  },
});
