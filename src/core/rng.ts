/**
 * Deterministic, seeded pseudo-random number generator.
 *
 * Every source of randomness in this project (HNSW layer assignment, synthetic
 * vector generation, query sampling in the benchmark) is driven by an instance
 * of this generator. `Math.random` is never used anywhere in `src/` or `test/`.
 * The same seed + the same data therefore produce a byte-identical graph and
 * identical recall numbers — the reproducibility guarantee the test suite leans
 * on (see test/determinism.test.ts).
 *
 * The algorithm is mulberry32: a tiny, fast, well-distributed 32-bit generator.
 */
export class Rng {
  private state: number;

  constructor(seed: number) {
    // Force the seed into an unsigned 32-bit integer so identical seeds always
    // start from an identical internal state regardless of how they were typed.
    this.state = seed >>> 0;
  }

  /** Next float in the half-open interval [0, 1). */
  next(): number {
    // mulberry32
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Next float in [min, max). */
  nextInRange(min: number, max: number): number {
    return min + (max - min) * this.next();
  }

  /**
   * Standard-normal sample via the Box–Muller transform. Used to generate
   * clustered synthetic vectors with a known ground truth (see the synthetic
   * test). Guards the `log(0)` edge by nudging a zero draw off the boundary.
   */
  nextGaussian(): number {
    let u = this.next();
    const v = this.next();
    if (u < 1e-12) u = 1e-12;
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  /** Integer in the half-open interval [0, n). */
  nextInt(n: number): number {
    return Math.floor(this.next() * n);
  }
}
