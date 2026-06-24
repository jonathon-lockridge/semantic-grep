/**
 * Deterministic synthetic data for the test suite. All randomness is seeded, so
 * every test is reproducible and runs with zero network access.
 */
import { Rng } from "../src/core/rng";
import { Metric, normalize } from "../src/core/distance";
import { HNSW } from "../src/core/hnsw";

export interface ClusteredData {
  vectors: Float32Array[];
  /** labels[i] = the cluster index that vector i was generated from. */
  labels: number[];
  numClusters: number;
}

/**
 * Generate `numClusters` tight Gaussian clusters of unit vectors in `dim`
 * dimensions. With a small `spread`, each point's true nearest neighbours are
 * its own cluster-mates BY CONSTRUCTION — a ground truth that needs no embedding
 * model. Cluster centres are themselves random unit vectors.
 */
export function makeClusters(
  seed: number,
  numClusters: number,
  perCluster: number,
  dim: number,
  spread = 0.05,
): ClusteredData {
  const rng = new Rng(seed);
  const centers: Float32Array[] = [];
  for (let c = 0; c < numClusters; c++) {
    const v = new Float32Array(dim);
    for (let i = 0; i < dim; i++) v[i] = rng.nextGaussian();
    centers.push(normalize(v));
  }

  const vectors: Float32Array[] = [];
  const labels: number[] = [];
  for (let c = 0; c < numClusters; c++) {
    for (let p = 0; p < perCluster; p++) {
      const v = new Float32Array(dim);
      for (let i = 0; i < dim; i++) v[i] = centers[c][i] + spread * rng.nextGaussian();
      vectors.push(normalize(v));
      labels.push(c);
    }
  }
  return { vectors, labels, numClusters };
}

/** Random unit vectors (no cluster structure), for stress / connectivity tests. */
export function makeUniform(seed: number, n: number, dim: number): Float32Array[] {
  const rng = new Rng(seed);
  const out: Float32Array[] = [];
  for (let i = 0; i < n; i++) {
    const v = new Float32Array(dim);
    for (let j = 0; j < dim; j++) v[j] = rng.nextGaussian();
    out.push(normalize(v));
  }
  return out;
}

/** Build a Metric + fully-constructed HNSW over the given vectors. */
export function buildIndex(
  vectors: Float32Array[],
  dim: number,
  params?: { M?: number; efConstruction?: number; seed?: number },
): { metric: Metric; hnsw: HNSW } {
  const metric = new Metric(vectors, dim);
  const hnsw = new HNSW(metric, params);
  hnsw.build();
  return { metric, hnsw };
}
