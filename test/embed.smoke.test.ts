import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { l2Norm, similarity } from "../src/core/distance";

/**
 * OPTIONAL smoke test for the embedding wrapper. It is deliberately OUTSIDE the
 * deterministic core path: it loads the real model and so is the one test that
 * could be skipped. It runs fully offline against the bundled model and SKIPS
 * cleanly (never fails CI) if those files are absent. The rest of the suite
 * needs no model and no network.
 */
const MODEL_PATH = resolve("public/models");
const hasModel = existsSync(
  resolve(MODEL_PATH, "Xenova/all-MiniLM-L6-v2/onnx/model_quantized.onnx"),
);

describe.skipIf(!hasModel)("embedder smoke test (bundled model present)", () => {
  it("returns a unit-norm vector of the expected dimension, with sane semantics", async () => {
    const { embed, EMBED_DIM } = await import("../src/embed/embedder");
    const opts = { localModelPath: MODEL_PATH, allowRemote: false };

    const a = await embed("how do I cancel my subscription", opts);
    expect(a.length).toBe(EMBED_DIM);
    expect(l2Norm(a)).toBeCloseTo(1, 4);

    // A paraphrase with no shared keywords should score higher than something
    // unrelated — the whole premise of semantic search.
    const related = await embed("I want to end my plan and stop being billed", opts);
    const unrelated = await embed("the chemical composition of granite rock", opts);
    expect(similarity(a, related)).toBeGreaterThan(similarity(a, unrelated));
  }, 30_000);
});
