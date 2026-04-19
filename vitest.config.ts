import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    setupFiles: ["./tests/setup.ts"],
    testTimeout: 60000,
    pool: "forks",
    // Browser and API e2e suites manage their own app lifecycle and should not
    // run under the default Vitest pass.
    exclude: ["tests/e2e/**", "tests/e2e-browser/**", "node_modules/**", ".claude/**"],
    // Run test files one at a time. LLM-calling tests (agent-*, pipeline, security)
    // exhaust Gemini API rate limits when run concurrently. Non-LLM tests are fast
    // enough (~2s total) that sequential execution doesn't matter.
    fileParallelism: false,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
