import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect, beforeAll } from "vitest";
import { Metric } from "../src/core/distance";
import { HNSW } from "../src/core/hnsw";
import {
  evaluateEf,
  exactGroundTruth,
  evaluateBruteForce,
  type EfPoint,
} from "../src/core/benchmark";

/**
 * The README's benchmark table, replayed end-to-end on the REAL corpus: the
 * committed MiniLM embeddings (public/data/embeddings.bin) and the 72 held-out
 * query vectors (benchmark-queries.json) — the same files the demo's benchmark
 * panel loads. The index is rebuilt with the demo's exact parameters (seed
 * 0x5eed, M=16, efConstruction=200, ids inserted in order), so every cell of
 * the table is asserted, not just a floor. Deterministic and network-free:
 * everything read here is committed to the repo.
 */
const DATA_DIR = join(__dirname, "..", "public", "data");
const K = 10;

/** The table as printed in README.md — recall/speedup as displayed (1 d.p.). */
const README_TABLE = [
  { efSearch: 8, recallPct: "87.5", evals: 284, speedup: "8.7" },
  { efSearch: 16, recallPct: "93.6", evals: 379, speedup: "6.5" },
  { efSearch: 32, recallPct: "97.6", evals: 594, speedup: "4.2" },
  { efSearch: 64, recallPct: "99.4", evals: 964, speedup: "2.6" },
  { efSearch: 128, recallPct: "100.0", evals: 1487, speedup: "1.7" },
  { efSearch: 256, recallPct: "100.0", evals: 2049, speedup: "1.2" },
];

interface Meta {
  count: number;
  dim: number;
}

function loadCorpusVectors(): { meta: Meta; vectors: Float32Array[] } {
  const meta = JSON.parse(readFileSync(join(DATA_DIR, "meta.json"), "utf8")) as Meta;
  const buf = readFileSync(join(DATA_DIR, "embeddings.bin"));
  const flat = new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4);
  expect(flat.length).toBe(meta.count * meta.dim);
  const vectors: Float32Array[] = new Array(meta.count);
  for (let i = 0; i < meta.count; i++) {
    vectors[i] = flat.subarray(i * meta.dim, (i + 1) * meta.dim);
  }
  return { meta, vectors };
}

function loadBenchmarkQueries(dim: number): Float32Array[] {
  const bench = JSON.parse(
    readFileSync(join(DATA_DIR, "benchmark-queries.json"), "utf8"),
  ) as { count: number; dim: number; vectors: number[][] };
  expect(bench.dim).toBe(dim);
  expect(bench.vectors.length).toBe(bench.count);
  return bench.vectors.map((v) => new Float32Array(v));
}

// Built once for the whole file: one graph build (~3 s) serves every assertion.
let meta: Meta;
let metric: Metric;
let queries: Float32Array[];
let bruteEvals: number;
let points: EfPoint[];

beforeAll(() => {
  const corpus = loadCorpusVectors();
  meta = corpus.meta;
  metric = new Metric(corpus.vectors, meta.dim);
  queries = loadBenchmarkQueries(meta.dim);

  // The demo's exact configuration: seed 0x5eed with default M/efConstruction,
  // ids inserted in order (build() == the visualizer's chunked insert loop).
  const hnsw = new HNSW(metric, { seed: 0x5eed });
  hnsw.build();

  const exact = exactGroundTruth(metric, queries, K);
  bruteEvals = evaluateBruteForce(metric, queries, K).avgEvals;
  points = README_TABLE.map((row) => evaluateEf(hnsw, metric, queries, exact, K, row.efSearch));
}, 30_000);

describe("real corpus: the README benchmark table, replayed from committed data", () => {
  it("the corpus is the advertised 2,478 passages x 384 dims, 72 queries", () => {
    expect(meta.count).toBe(2478);
    expect(meta.dim).toBe(384);
    expect(queries.length).toBe(72);
  });

  it("brute force costs exactly N = 2,478 evals per query", () => {
    expect(bruteEvals).toBe(2478);
  });

  it.each(README_TABLE.map((row, i) => ({ ...row, i })))(
    "efSearch=$efSearch: recall@10 $recallPct% at $evals evals/query ($speedup x)",
    ({ i, recallPct, evals, speedup }) => {
      const p = points[i];
      expect((p.recall * 100).toFixed(1)).toBe(recallPct);
      expect(Math.round(p.avgEvals)).toBe(evals);
      expect(p.speedupEvals.toFixed(1)).toBe(speedup);
    },
  );

  it("recall is exactly 1.0 from efSearch=128 up (degenerates to exhaustive)", () => {
    expect(points[4].recall).toBe(1);
    expect(points[5].recall).toBe(1);
  });
});
