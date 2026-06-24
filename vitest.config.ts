import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // The deterministic core suite is CPU-bound and network-free.
    include: ["test/**/*.test.ts"],
    environment: "node",
    // Generous but bounded: the recall suite builds real HNSW graphs.
    testTimeout: 30_000,
  },
});
