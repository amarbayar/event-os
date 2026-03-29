import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    setupFiles: ["./tests/setup.ts"],
    testTimeout: 60000,
    pool: "forks",
    exclude: ["tests/e2e-browser/**", "node_modules/**", ".claude/**"],
    // LLM tests (agent-*, pipeline) call Gemini API — running them in parallel
    // exhausts rate limits. fileParallelism: false runs all files sequentially.
    fileParallelism: false,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
