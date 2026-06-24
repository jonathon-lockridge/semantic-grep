/**
 * Distance / similarity math and the single canonical ordering used everywhere.
 *
 * Convention (pinned, never paraphrased elsewhere):
 *   - All vectors are L2-normalised to unit length, at prep time and at query
 *     time. Under that assumption the inner product IS the cosine similarity,
 *     lives in [-1, 1], and "nearer" means HIGHER similarity.
 *   - One comparator (`compareCandidates`) orders candidates by DESCENDING
 *     similarity, breaking ties by ASCENDING id. Brute force, HNSW, and the
 *     recall metric all sort with this exact comparator so their notions of
 *     "the top-k" can never silently disagree.
 */

export type Vector = Float32Array | number[];

/** A scored node: `id` indexes into the dataset, `sim` is its similarity. */
export interface Candidate {
  id: number;
  sim: number;
}

/** Inner product of two equal-length vectors. */
export function dot(a: Vector, b: Vector): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

/** Euclidean (L2) norm. */
export function l2Norm(v: Vector): number {
  let s = 0;
  for (let i = 0; i < v.length; i++) s += v[i] * v[i];
  return Math.sqrt(s);
}

/**
 * Return a unit-length copy of `v`. The zero vector has no direction, so we
 * leave it as zeros (documented edge case) rather than dividing by zero.
 */
export function normalize(v: Vector): Float32Array {
  const out = new Float32Array(v.length);
  const norm = l2Norm(v);
  if (norm === 0) return out; // all-zeros guard
  for (let i = 0; i < v.length; i++) out[i] = v[i] / norm;
  return out;
}

/**
 * Cosine similarity for unit vectors == their inner product. Kept as a named
 * function so call sites read as "similarity", not "dot".
 */
export function similarity(a: Vector, b: Vector): number {
  return dot(a, b);
}

/**
 * THE canonical comparator. Sorts so the nearest (highest similarity) comes
 * first; ties are broken deterministically by ascending id. Returns a negative
 * number when `a` should sort before `b`, matching Array.prototype.sort.
 */
export function compareCandidates(a: Candidate, b: Candidate): number {
  if (a.sim > b.sim) return -1;
  if (a.sim < b.sim) return 1;
  // Equal similarity -> smaller id wins (stable, reproducible tie-break).
  if (a.id < b.id) return -1;
  if (a.id > b.id) return 1;
  return 0;
}

/**
 * True when `a` is strictly nearer than `b` under the canonical order. Used by
 * the heaps inside HNSW so their internal tie-breaking matches the comparator.
 */
export function isNearer(a: Candidate, b: Candidate): boolean {
  return compareCandidates(a, b) < 0;
}

/**
 * Holds the dataset vectors and counts every similarity evaluation. This is the
 * project's efficiency proxy: brute force costs N evaluations per query, and the
 * whole point of HNSW is to reach the same answer in far fewer. The counter is
 * deterministic (unlike wall-clock time), so the benchmark can assert on it.
 */
export class Metric {
  readonly vectors: Float32Array[];
  readonly dim: number;
  count = 0;

  constructor(vectors: Float32Array[], dim: number) {
    this.vectors = vectors;
    this.dim = dim;
  }

  /** Similarity between an external query vector and dataset node `id`. */
  toQuery(query: Vector, id: number): number {
    this.count++;
    return dot(query, this.vectors[id]);
  }

  /** Similarity between two dataset nodes (used during graph construction). */
  between(idA: number, idB: number): number {
    this.count++;
    return dot(this.vectors[idA], this.vectors[idB]);
  }

  reset(): void {
    this.count = 0;
  }
}
