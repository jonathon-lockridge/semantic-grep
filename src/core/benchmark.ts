/**
 * The product's proof: measure HNSW's recall against the exact oracle, and its
 * cost (similarity evaluations + wall-clock) against brute force, as a function
 * of the efSearch knob. Produces the recall-vs-speed tradeoff curve the UI
 * draws and the recall test asserts on. Pure: no DOM, no embedding dependency.
 */
import { Metric, compareCandidates, type Vector } from "./distance";
import { bruteForceKnn } from "./bruteforce";
import { HNSW } from "./hnsw";

/**
 * recall@k for one query: fraction of the exact top-k that HNSW also returned.
 * Both sets are defined by the SAME canonical comparator, so ties never make
 * this ill-defined.
 */
export function recallAtK(approxIds: number[], exactIds: Set<number>, k: number): number {
  if (k <= 0) return 1;
  let hit = 0;
  for (const id of approxIds) if (exactIds.has(id)) hit++;
  return hit / Math.min(k, exactIds.size || k);
}

export interface EfPoint {
  efSearch: number;
  /** Mean recall@k over the query set, in [0, 1]. */
  recall: number;
  /** Mean similarity evaluations per query for HNSW. */
  avgEvals: number;
  /** Mean wall-clock ms per query for HNSW. */
  avgMs: number;
  /** N / avgEvals: how many fewer distance evals than brute force, on average. */
  speedupEvals: number;
}

export interface BenchmarkResult {
  k: number;
  n: number;
  numQueries: number;
  bruteForce: { avgEvals: number; avgMs: number };
  points: EfPoint[];
}

/** Exact top-k id sets for each query (the ground truth), computed once. */
export function exactGroundTruth(metric: Metric, queries: Vector[], k: number): Set<number>[] {
  return queries.map((q) => new Set(bruteForceKnn(metric, q, k).results.map((c) => c.id)));
}

/**
 * Evaluate HNSW at a single efSearch over the whole query set: mean recall, mean
 * evals/query, mean ms/query. `exact` is the precomputed ground truth.
 */
export function evaluateEf(
  hnsw: HNSW,
  metric: Metric,
  queries: Vector[],
  exact: Set<number>[],
  k: number,
  efSearch: number,
): EfPoint {
  let recallSum = 0;
  let evalSum = 0;
  const n = metric.vectors.length;

  const start = performance.now();
  for (let i = 0; i < queries.length; i++) {
    const { results, evals } = hnsw.search(queries[i], k, efSearch);
    evalSum += evals;
    recallSum += recallAtK(
      results.map((c) => c.id),
      exact[i],
      k,
    );
  }
  const elapsed = performance.now() - start;

  const q = queries.length || 1;
  const avgEvals = evalSum / q;
  return {
    efSearch,
    recall: recallSum / q,
    avgEvals,
    avgMs: elapsed / q,
    speedupEvals: avgEvals > 0 ? n / avgEvals : Infinity,
  };
}

/** Time brute force over the query set: mean evals (== N) and mean ms per query. */
export function evaluateBruteForce(
  metric: Metric,
  queries: Vector[],
  k: number,
): { avgEvals: number; avgMs: number } {
  let evalSum = 0;
  const start = performance.now();
  for (const q of queries) {
    evalSum += bruteForceKnn(metric, q, k).evals;
  }
  const elapsed = performance.now() - start;
  const q = queries.length || 1;
  return { avgEvals: evalSum / q, avgMs: elapsed / q };
}

/** Full sweep across efSearch values, producing the recall-vs-speed curve. */
export function runBenchmark(
  hnsw: HNSW,
  metric: Metric,
  queries: Vector[],
  k: number,
  efValues: number[],
): BenchmarkResult {
  const exact = exactGroundTruth(metric, queries, k);
  const bruteForce = evaluateBruteForce(metric, queries, k);
  const points = efValues.map((ef) => evaluateEf(hnsw, metric, queries, exact, k, ef));
  return {
    k,
    n: metric.vectors.length,
    numQueries: queries.length,
    bruteForce,
    points,
  };
}

/** Smallest-ef point whose mean recall meets `target` (for "speedup at recall R"). */
export function pointAtRecall(result: BenchmarkResult, target: number): EfPoint | null {
  const sorted = [...result.points].sort((a, b) => a.efSearch - b.efSearch);
  return sorted.find((p) => p.recall >= target) ?? null;
}

/** Convenience: average recall@k over a query set at one efSearch. */
export function meanRecall(
  hnsw: HNSW,
  metric: Metric,
  queries: Vector[],
  k: number,
  efSearch: number,
): number {
  const exact = exactGroundTruth(metric, queries, k);
  let sum = 0;
  for (let i = 0; i < queries.length; i++) {
    const { results } = hnsw.search(queries[i], k, efSearch);
    sum += recallAtK(
      results.map((c) => c.id),
      exact[i],
      k,
    );
  }
  return sum / (queries.length || 1);
}

/** Re-export so callers can sort approx results identically to the oracle. */
export { compareCandidates };
