import { describe, it, expect } from "vitest";
import { Metric } from "../src/core/distance";
import { HNSW } from "../src/core/hnsw";
import { meanRecall } from "../src/core/benchmark";
import { makeUniform } from "./helpers";

/**
 * Reproducibility guarantee: same seed + same data => byte-identical graph and
 * identical recall. Different seeds => a different but still valid graph.
 */
function buildOn(vectors: Float32Array[], dim: number, seed: number): HNSW {
  const hnsw = new HNSW(new Metric(vectors, dim), { seed });
  hnsw.build();
  return hnsw;
}

function adjacencySignature(hnsw: HNSW): string {
  // Canonical serialisation of the whole graph: levels + per-layer neighbour lists.
  return JSON.stringify({ levels: hnsw.levels, links: hnsw.links, entry: hnsw.entryPoint });
}

describe("determinism", () => {
  const vectors = makeUniform(31337, 600, 32);

  it("identical seed + data yields a byte-identical graph", () => {
    const a = buildOn(vectors, 32, 777);
    const b = buildOn(vectors, 32, 777);
    expect(adjacencySignature(a)).toBe(adjacencySignature(b));
    expect(a.maxLevel).toBe(b.maxLevel);
    expect(a.entryPoint).toBe(b.entryPoint);
  });

  it("identical seed yields identical recall", () => {
    const queries = makeUniform(2718, 40, 32);
    const a = buildOn(vectors, 32, 777);
    const b = buildOn(vectors, 32, 777);
    const ra = meanRecall(a, a.metric, queries, 10, 64);
    const rb = meanRecall(b, b.metric, queries, 10, 64);
    expect(ra).toBe(rb);
  });

  it("different seeds yield different graphs that are still valid", () => {
    const a = buildOn(vectors, 32, 1);
    const b = buildOn(vectors, 32, 2);
    expect(adjacencySignature(a)).not.toBe(adjacencySignature(b));
    // Both must still satisfy the core invariants: layer 0 has every node, and
    // every edge is bidirectional.
    for (const hnsw of [a, b]) {
      for (let id = 0; id < hnsw.size; id++) {
        expect(hnsw.links[id].length).toBe(hnsw.levels[id] + 1);
        for (const nb of hnsw.links[id][0]) {
          expect(hnsw.links[nb][0]).toContain(id);
        }
      }
    }
  });
});
