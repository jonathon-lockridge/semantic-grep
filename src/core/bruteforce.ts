/**
 * Exact brute-force k-nearest-neighbour search — the ground-truth ORACLE.
 *
 * This is deliberately the dumbest possible correct algorithm: score the query
 * against every vector, sort by the canonical comparator, take the top k. It is
 * O(N·d) and costs exactly N similarity evaluations per query. The recall
 * benchmark measures HNSW against the set this returns, and the efficiency proxy
 * measures HNSW's evaluation count against this N.
 */
import { Metric, compareCandidates, type Candidate, type Vector } from "./distance";

export interface KnnResult {
  results: Candidate[];
  /** Similarity evaluations performed (always N for brute force). */
  evals: number;
}

export function bruteForceKnn(metric: Metric, query: Vector, k: number): KnnResult {
  const before = metric.count;
  const n = metric.vectors.length;
  const kk = Math.min(k, n); // clamp k > N

  const all: Candidate[] = new Array(n);
  for (let id = 0; id < n; id++) {
    all[id] = { id, sim: metric.toQuery(query, id) };
  }
  all.sort(compareCandidates);

  return { results: all.slice(0, kk), evals: metric.count - before };
}

/** Convenience: just the id set of the exact top-k (used by the recall metric). */
export function exactTopKIds(metric: Metric, query: Vector, k: number): Set<number> {
  return new Set(bruteForceKnn(metric, query, k).results.map((c) => c.id));
}
