import { describe, it, expect } from "vitest";
import { Metric } from "../src/core/distance";
import { HNSW } from "../src/core/hnsw";
import { bruteForceKnn } from "../src/core/bruteforce";
import { meanRecall } from "../src/core/benchmark";
import { makeClusters } from "./helpers";

/**
 * Synthetic ground truth: tight Gaussian clusters where, BY CONSTRUCTION, every
 * point's true nearest neighbours are its own cluster-mates. The right answer is
 * known a priori — independent of any embedding model — so this validates both
 * the oracle and HNSW with no network and no learned vectors.
 */
describe("synthetic clustered ground truth", () => {
  const NUM_CLUSTERS = 25;
  const PER_CLUSTER = 40; // 1000 nodes
  const DIM = 32;
  const K = 10;

  it("exact brute force returns same-cluster points (tight clusters)", () => {
    const { vectors, labels } = makeClusters(2024, NUM_CLUSTERS, PER_CLUSTER, DIM, 0.02);
    const metric = new Metric(vectors, DIM);
    // Check several query points across different clusters.
    const sample = [0, 199, 444, 700, 999];
    for (const qi of sample) {
      const { results } = bruteForceKnn(metric, vectors[qi], K);
      // With spread 0.02 the clusters are well separated: top-k are all same cluster.
      for (const c of results) {
        expect(labels[c.id]).toBe(labels[qi]);
      }
    }
  });

  it("HNSW recovers the cluster-mates at high recall", () => {
    const { vectors } = makeClusters(2024, NUM_CLUSTERS, PER_CLUSTER, DIM, 0.02);
    const metric = new Metric(vectors, DIM);
    const hnsw = new HNSW(metric, { seed: 13 });
    hnsw.build();
    const sample = [0, 199, 444, 700, 999].map((i) => vectors[i]);
    const recall = meanRecall(hnsw, metric, sample, K, 64);
    expect(recall).toBeGreaterThanOrEqual(0.97);
  });

  it("the nearest neighbour of a point is itself", () => {
    const { vectors } = makeClusters(99, 10, 20, 16, 0.03);
    const metric = new Metric(vectors, 16);
    const { results } = bruteForceKnn(metric, vectors[5], 1);
    expect(results[0].id).toBe(5);
    expect(results[0].sim).toBeCloseTo(1, 5);
  });
});
