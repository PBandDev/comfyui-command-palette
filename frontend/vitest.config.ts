import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "happy-dom",
    include: ["frontend/test/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["frontend/src/**/*.ts"],
      exclude: ["frontend/src/index.ts"],
      thresholds: {
        lines: 70,
      },
    },
  },
});
