import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    // Rules drive a real browser, and the countdown rule waits on purpose.
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
