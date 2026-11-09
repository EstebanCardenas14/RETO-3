import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, ".") } },
  test: { pool: "forks", poolOptions: { forks: { minForks: 1, maxForks: 1 } } },
});
