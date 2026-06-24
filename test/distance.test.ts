import { describe, it, expect } from "vitest";
import {
  dot,
  l2Norm,
  normalize,
  similarity,
  compareCandidates,
  isNearer,
  type Candidate,
} from "../src/core/distance";

describe("distance math (hand-computed unit vectors)", () => {
  it("identity: a · a == 1 for a unit vector", () => {
    const a = [1, 0, 0];
    expect(similarity(a, a)).toBeCloseTo(1, 12);
  });

  it("orthogonal: perpendicular unit vectors have similarity 0", () => {
    expect(similarity([1, 0], [0, 1])).toBeCloseTo(0, 12);
  });

  it("opposite: antiparallel unit vectors have similarity -1", () => {
    expect(similarity([1, 0], [-1, 0])).toBeCloseTo(-1, 12);
  });

  it("symmetry: a · b == b · a", () => {
    const a = [0.2, -0.5, 0.84];
    const b = [-0.1, 0.9, 0.3];
    expect(dot(a, b)).toBeCloseTo(dot(b, a), 12);
  });

  it("closed form: [1,1]/sqrt(2) · [1,0] == 1/sqrt(2)", () => {
    const a = normalize([1, 1]);
    const b = [1, 0];
    expect(similarity(a, b)).toBeCloseTo(Math.SQRT1_2, 6);
  });

  it("l2Norm and normalize: [3,4] -> norm 5 -> unit [0.6, 0.8]", () => {
    expect(l2Norm([3, 4])).toBeCloseTo(5, 12);
    const u = normalize([3, 4]);
    // normalize() returns a Float32Array, so components carry ~1e-7 precision.
    expect(u[0]).toBeCloseTo(0.6, 6);
    expect(u[1]).toBeCloseTo(0.8, 6);
    expect(l2Norm(u)).toBeCloseTo(1, 6);
  });

  it("normalize guards the zero vector (stays zeros, no NaN)", () => {
    const z = normalize([0, 0, 0]);
    expect(Array.from(z)).toEqual([0, 0, 0]);
  });
});

describe("canonical comparator", () => {
  it("orders by descending similarity", () => {
    const a: Candidate = { id: 0, sim: 0.9 };
    const b: Candidate = { id: 1, sim: 0.5 };
    expect(compareCandidates(a, b)).toBeLessThan(0);
    expect(compareCandidates(b, a)).toBeGreaterThan(0);
  });

  it("breaks ties by ascending id", () => {
    const hi: Candidate = { id: 5, sim: 0.5 };
    const lo: Candidate = { id: 2, sim: 0.5 };
    // same sim -> smaller id sorts first
    expect(compareCandidates(lo, hi)).toBeLessThan(0);
    expect(compareCandidates(hi, lo)).toBeGreaterThan(0);
    expect(compareCandidates(hi, hi)).toBe(0);
  });

  it("sorting yields descending sim then ascending id", () => {
    const list: Candidate[] = [
      { id: 3, sim: 0.5 },
      { id: 1, sim: 0.9 },
      { id: 0, sim: 0.5 },
      { id: 2, sim: 0.9 },
    ];
    list.sort(compareCandidates);
    expect(list.map((c) => c.id)).toEqual([1, 2, 0, 3]);
  });

  it("isNearer agrees with the comparator", () => {
    expect(isNearer({ id: 0, sim: 0.8 }, { id: 1, sim: 0.7 })).toBe(true);
    expect(isNearer({ id: 9, sim: 0.7 }, { id: 1, sim: 0.7 })).toBe(false);
    expect(isNearer({ id: 1, sim: 0.7 }, { id: 9, sim: 0.7 })).toBe(true);
  });
});
