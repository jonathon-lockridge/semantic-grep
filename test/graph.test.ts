import { describe, it, expect } from "vitest";
import { makeClusters, makeUniform, buildIndex } from "./helpers";
import { HNSW } from "../src/core/hnsw";

/**
 * Asserts every structural invariant from the spec (Section 2.9) on a fully
 * built index. These are the correctness anchors: if the graph violates any of
 * them, recall results would be meaningless.
 */
function checkInvariants(hnsw: HNSW): void {
  const n = hnsw.size;
  expect(n).toBeGreaterThan(0);

  // Entry point exists and sits at the maximum level.
  expect(hnsw.entryPoint).toBeGreaterThanOrEqual(0);
  expect(hnsw.levels[hnsw.entryPoint]).toBe(hnsw.maxLevel);
  for (let id = 0; id < n; id++) {
    expect(hnsw.levels[id]).toBeLessThanOrEqual(hnsw.maxLevel);
  }

  for (let id = 0; id < n; id++) {
    const level = hnsw.levels[id];
    // Layer 0 exists for every node; the per-node layer array is exactly level+1 long.
    expect(hnsw.links[id].length).toBe(level + 1);

    for (let layer = 0; layer <= level; layer++) {
      const nbrs = hnsw.links[id][layer];
      const cap = layer === 0 ? hnsw.Mmax0 : hnsw.Mmax;

      // Degree cap respected.
      expect(nbrs.length).toBeLessThanOrEqual(cap);
      // No self-loops.
      expect(nbrs).not.toContain(id);
      // No duplicate neighbours.
      expect(new Set(nbrs).size).toBe(nbrs.length);

      for (const nb of nbrs) {
        // Neighbour actually has this layer.
        expect(hnsw.levels[nb]).toBeGreaterThanOrEqual(layer);
        // Links are bidirectional.
        expect(hnsw.links[nb][layer]).toContain(id);
      }
    }
  }
}

/** BFS over layer-0 links; returns how many nodes are reachable from the entry. */
function layer0Reachable(hnsw: HNSW): number {
  const seen = new Set<number>([hnsw.entryPoint]);
  const queue = [hnsw.entryPoint];
  while (queue.length > 0) {
    const cur = queue.shift() as number;
    for (const nb of hnsw.links[cur][0]) {
      if (!seen.has(nb)) {
        seen.add(nb);
        queue.push(nb);
      }
    }
  }
  return seen.size;
}

describe("HNSW graph invariants", () => {
  it("holds on a clustered dataset", () => {
    const { vectors } = makeClusters(101, 12, 25, 32); // 300 nodes
    const { hnsw } = buildIndex(vectors, 32, { seed: 7 });
    checkInvariants(hnsw);
  });

  it("holds on uniform random vectors", () => {
    const vectors = makeUniform(202, 250, 24);
    const { hnsw } = buildIndex(vectors, 24, { seed: 7 });
    checkInvariants(hnsw);
  });

  it("layer 0 is fully connected (every node reachable from the entry point)", () => {
    const vectors = makeUniform(303, 400, 16);
    const { hnsw } = buildIndex(vectors, 16, { seed: 7 });
    expect(layer0Reachable(hnsw)).toBe(hnsw.size);
  });

  it("layer 0 contains every node; higher layers are progressively sparser", () => {
    const { vectors } = makeClusters(404, 10, 30, 32); // 300 nodes
    const { hnsw } = buildIndex(vectors, 32, { seed: 7 });
    const counts: number[] = [];
    for (let id = 0; id < hnsw.size; id++) {
      for (let l = 0; l <= hnsw.levels[id]; l++) counts[l] = (counts[l] ?? 0) + 1;
    }
    expect(counts[0]).toBe(hnsw.size); // every node on layer 0
    for (let l = 1; l < counts.length; l++) {
      expect(counts[l]).toBeLessThanOrEqual(counts[l - 1]);
    }
  });

  it("handles tiny indices (1 and 2 nodes) without violating invariants", () => {
    const one = buildIndex(makeUniform(1, 1, 8), 8, { seed: 7 }).hnsw;
    expect(one.size).toBe(1);
    checkInvariants(one);

    const two = buildIndex(makeUniform(2, 2, 8), 8, { seed: 7 }).hnsw;
    expect(two.size).toBe(2);
    checkInvariants(two);
  });
});
