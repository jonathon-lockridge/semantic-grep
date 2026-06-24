import { describe, it, expect } from "vitest";
import { Metric, normalize } from "../src/core/distance";
import { bruteForceKnn, exactTopKIds } from "../src/core/bruteforce";

/**
 * Tiny hand-traced fixture in 2-D so every similarity is computable by hand.
 * Vectors (after L2-normalisation):
 *   v0 = [1, 0]            v1 = [0, 1]
 *   v2 = [0.7071, 0.7071]  v3 = [1, 0]   (deliberate duplicate of v0)
 *   v4 = [-1, 0]
 * Query q = [1, 0].
 * Similarities to q: v0=1, v1=0, v2=0.7071, v3=1, v4=-1.
 */
function fixture(): Metric {
  const vectors = [
    normalize([1, 0]),
    normalize([0, 1]),
    normalize([1, 1]),
    normalize([1, 0]),
    normalize([-1, 0]),
  ];
  return new Metric(vectors, 2);
}

describe("brute-force KNN oracle", () => {
  it("returns the hand-traced top-3 with the id tie-break", () => {
    const m = fixture();
    const q = [1, 0];
    const { results } = bruteForceKnn(m, q, 3);
    // v0 and v3 both have sim 1.0 -> ascending id wins, so v0 before v3.
    expect(results.map((c) => c.id)).toEqual([0, 3, 2]);
    expect(results[0].sim).toBeCloseTo(1, 12);
    expect(results[1].sim).toBeCloseTo(1, 12);
    expect(results[2].sim).toBeCloseTo(Math.SQRT1_2, 6);
  });

  it("top-1 is the (tie-broken) nearest", () => {
    const m = fixture();
    expect(bruteForceKnn(m, [1, 0], 1).results.map((c) => c.id)).toEqual([0]);
  });

  it("costs exactly N similarity evaluations", () => {
    const m = fixture();
    const { evals } = bruteForceKnn(m, [1, 0], 3);
    expect(evals).toBe(5);
  });

  it("clamps k > N and returns all nodes fully ordered", () => {
    const m = fixture();
    const { results } = bruteForceKnn(m, [1, 0], 10);
    expect(results.map((c) => c.id)).toEqual([0, 3, 2, 1, 4]);
  });

  it("exactTopKIds returns the id set of the top-k", () => {
    const m = fixture();
    expect(exactTopKIds(m, [1, 0], 3)).toEqual(new Set([0, 3, 2]));
  });
});
