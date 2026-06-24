import { describe, it, expect } from "vitest";
import { Metric } from "../src/core/distance";
import { HNSW } from "../src/core/hnsw";
import { bruteForceKnn, exactTopKIds } from "../src/core/bruteforce";
import {
  runBenchmark,
  meanRecall,
  evaluateEf,
  exactGroundTruth,
  pointAtRecall,
} from "../src/core/benchmark";
import { makeUniform, makeClusters } from "./helpers";

/**
 * THE centerpiece test: HNSW recall measured against the exact brute-force
 * oracle. Nothing here is asserted by fiat — recall is computed by comparing
 * HNSW's results to ground truth, and the efficiency claim is a counted-
 * operations proxy, not wall-clock.
 *
 * Pinned parameters (documented so the numbers are reproducible):
 *   N = 1500 random unit vectors, d = 48, k = 10, 100 held-out queries.
 *   M = 16, efConstruction = 200, seed fixed. Default efSearch = 64.
 *   Recall target at default efSearch: >= 0.92 (the index measures ~0.99).
 *
 * Efficiency is proven two ways. Uniform random high-d vectors are the PESSIMAL
 * case for any ANN index (the curse of dimensionality: everything is roughly
 * equidistant), so there we only assert the floor — strictly fewer evals than
 * brute force's N. Clustered vectors mimic real sentence embeddings (low
 * intrinsic dimensionality), and there the speedup is large; that is the case
 * the value proposition is really about.
 */
const N = 1500;
const D = 48;
const K = 10;
const DEFAULT_EF = 64;
const RECALL_TARGET = 0.92;

function setup() {
  const vectors = makeUniform(1234, N, D);
  const metric = new Metric(vectors, D);
  const hnsw = new HNSW(metric, { M: 16, efConstruction: 200, seed: 0xc0ffee });
  hnsw.build();
  const queries = makeUniform(9876, 100, D); // held out (different seed)
  return { vectors, metric, hnsw, queries };
}

/** Minimal diagnostic on shortfall: which queries missed, and what they missed. */
function diagnose(hnsw: HNSW, metric: Metric, queries: Float32Array[]): void {
  for (let i = 0; i < queries.length; i++) {
    const exact = exactTopKIds(metric, queries[i], K);
    const approx = hnsw.search(queries[i], K, DEFAULT_EF).results.map((c) => c.id);
    const found = approx.filter((id) => exact.has(id));
    if (found.length < K) {
      const missed = [...exact].filter((id) => !approx.includes(id));
      // eslint-disable-next-line no-console
      console.error(`query ${i}: found ${found.length}/${K}, missed ids ${missed.join(",")}`);
    }
  }
}

describe("recall vs the exact oracle", () => {
  it(`reaches recall@${K} >= ${RECALL_TARGET} at the default efSearch=${DEFAULT_EF}`, () => {
    const { metric, hnsw, queries } = setup();
    const recall = meanRecall(hnsw, metric, queries, K, DEFAULT_EF);
    if (recall < RECALL_TARGET) diagnose(hnsw, metric, queries);
    expect(recall).toBeGreaterThanOrEqual(RECALL_TARGET);
  });

  it("reaches recall@10 == 1.0 when efSearch >= N (search degenerates to exact)", () => {
    const { metric, hnsw, queries } = setup();
    const recall = meanRecall(hnsw, metric, queries, K, N);
    expect(recall).toBe(1);
  });

  it("efficiency proxy (hard case): strictly fewer evals than brute force at target recall", () => {
    const { metric, hnsw, queries } = setup();
    const exact = exactGroundTruth(metric, queries, K);
    const point = evaluateEf(hnsw, metric, queries, exact, K, DEFAULT_EF);
    expect(point.recall).toBeGreaterThanOrEqual(RECALL_TARGET);
    // Even on pessimal uniform-random data, HNSW must cost strictly less than N.
    expect(point.avgEvals).toBeLessThan(N);
    expect(point.speedupEvals).toBeGreaterThan(1.5);
  });

  it("efficiency proxy (realistic clustered data): large speedup at high recall", () => {
    // Clustered vectors stand in for real sentence embeddings (low intrinsic dim).
    const { vectors } = makeClusters(7, 40, 50, 64, 0.05); // 2000 nodes
    const metric = new Metric(vectors, 64);
    const hnsw = new HNSW(metric, { seed: 0xc0ffee });
    hnsw.build();
    const queries = makeUniform(4321, 100, 64);
    const exact = exactGroundTruth(metric, queries, K);
    const point = evaluateEf(hnsw, metric, queries, exact, K, DEFAULT_EF);
    expect(point.recall).toBeGreaterThanOrEqual(0.92);
    // ~4x fewer evals than brute force at recall ~0.97 (see scripts measurement).
    expect(point.speedupEvals).toBeGreaterThan(3);
    expect(point.avgEvals).toBeLessThan(0.4 * metric.vectors.length);
  });

  it("recall is (weakly) non-decreasing as efSearch grows", () => {
    const { metric, hnsw, queries } = setup();
    const efValues = [10, 20, 40, 64, 128, 256];
    const result = runBenchmark(hnsw, metric, queries, K, efValues);
    const recalls = result.points.map((p) => p.recall);
    for (let i = 1; i < recalls.length; i++) {
      // allow a tiny epsilon for nothing — recall should be monotonic here
      expect(recalls[i]).toBeGreaterThanOrEqual(recalls[i - 1] - 1e-9);
    }
    // brute force baseline is N evals/query
    expect(result.bruteForce.avgEvals).toBe(N);
    // pointAtRecall finds a real tradeoff point below N evals
    const p = pointAtRecall(result, RECALL_TARGET);
    expect(p).not.toBeNull();
    expect(p!.avgEvals).toBeLessThan(N);
  });

  it("recovers cluster-mates on clustered data at high recall", () => {
    const { vectors, labels } = makeClusters(555, 20, 50, 32, 0.06); // 1000 nodes
    const metric = new Metric(vectors, 32);
    const hnsw = new HNSW(metric, { seed: 0xabc });
    hnsw.build();
    // Use a sample of dataset points as queries; their nearest neighbours are
    // overwhelmingly same-cluster by construction.
    let sameClusterFraction = 0;
    const sample = [0, 137, 401, 622, 815, 999];
    for (const qi of sample) {
      const { results } = bruteForceKnn(metric, vectors[qi], K);
      const same = results.filter((c) => labels[c.id] === labels[qi]).length;
      sameClusterFraction += same / K;
    }
    sameClusterFraction /= sample.length;
    expect(sameClusterFraction).toBeGreaterThan(0.9);

    const recall = meanRecall(
      hnsw,
      metric,
      sample.map((i) => vectors[i]),
      K,
      DEFAULT_EF,
    );
    expect(recall).toBeGreaterThanOrEqual(0.95);
  });
});
