import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    // Use jsdom for unit/integration tests that interact with browser APIs
    environment: "jsdom",
    include: ["tests/unit/**/*.{test,spec}.ts", "tests/integration/**/*.{test,spec}.ts"],
    setupFiles: ["tests/setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      include: ["src/**/*.ts"],
      exclude: ["src/main.tsx", "src/**/*.d.ts"],
    },
  },
});
