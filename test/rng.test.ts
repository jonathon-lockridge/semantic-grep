import { describe, it, expect } from "vitest";
import { Rng } from "../src/core/rng";

describe("Rng (seeded PRNG)", () => {
  it("is deterministic: same seed yields the same sequence", () => {
    const a = new Rng(42);
    const b = new Rng(42);
    const seqA = Array.from({ length: 100 }, () => a.next());
    const seqB = Array.from({ length: 100 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });

  it("produces different sequences for different seeds", () => {
    const a = new Rng(1);
    const b = new Rng(2);
    const seqA = Array.from({ length: 20 }, () => a.next());
    const seqB = Array.from({ length: 20 }, () => b.next());
    expect(seqA).not.toEqual(seqB);
  });

  it("stays within [0, 1)", () => {
    const r = new Rng(123);
    for (let i = 0; i < 10_000; i++) {
      const x = r.next();
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    }
  });

  it("is roughly uniform (mean near 0.5 over many draws)", () => {
    const r = new Rng(7);
    let sum = 0;
    const n = 100_000;
    for (let i = 0; i < n; i++) sum += r.next();
    const mean = sum / n;
    expect(mean).toBeGreaterThan(0.49);
    expect(mean).toBeLessThan(0.51);
  });

  it("nextInt returns integers in [0, n)", () => {
    const r = new Rng(99);
    for (let i = 0; i < 1000; i++) {
      const x = r.nextInt(13);
      expect(Number.isInteger(x)).toBe(true);
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(13);
    }
  });

  it("nextGaussian is approximately standard normal", () => {
    const r = new Rng(2024);
    const n = 200_000;
    let sum = 0;
    let sumSq = 0;
    for (let i = 0; i < n; i++) {
      const g = r.nextGaussian();
      sum += g;
      sumSq += g * g;
    }
    const mean = sum / n;
    const variance = sumSq / n - mean * mean;
    expect(Math.abs(mean)).toBeLessThan(0.02);
    expect(Math.abs(variance - 1)).toBeLessThan(0.05);
  });
});
