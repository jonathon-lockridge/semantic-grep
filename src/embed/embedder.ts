/**
 * Thin wrapper over transformers.js for sentence embedding. This is the ONLY
 * place the embedding dependency is used — the index, oracle, and benchmark
 * never import it, so the core stays pure and offline-testable.
 *
 * The model (a quantized all-MiniLM-L6-v2) is bundled under public/models so the
 * deployed demo embeds queries with ZERO network after first load. We mean-pool
 * the token embeddings and L2-normalise to unit length, so the inner product the
 * index uses equals cosine similarity. Loading is lazy: nothing downloads or
 * initialises until the first live query.
 */
import {
  env,
  pipeline,
  type FeatureExtractionPipeline,
} from "@huggingface/transformers";

export const MODEL_ID = "Xenova/all-MiniLM-L6-v2";
export const EMBED_DIM = 384;

export interface EmbedderOptions {
  /** Directory that contains `<MODEL_ID>/...` (a path in Node, a URL in browser). */
  localModelPath: string;
  /** Fall back to the Hugging Face hub if the local files are missing. */
  allowRemote?: boolean;
}

let pipePromise: Promise<FeatureExtractionPipeline> | null = null;
let configured = false;

function configure(opts: EmbedderOptions): void {
  if (configured) return;
  // Prefer the bundled local copy; only reach the network if explicitly allowed.
  env.allowRemoteModels = opts.allowRemote ?? false;
  env.allowLocalModels = true;
  env.localModelPath = opts.localModelPath;
  // Single-threaded wasm: multi-threaded ORT needs SharedArrayBuffer, which in
  // turn needs COOP/COEP headers GitHub Pages does not send. One short forward
  // pass per query is plenty fast single-threaded, and this just works on Pages.
  if (env.backends?.onnx?.wasm) {
    env.backends.onnx.wasm.numThreads = 1;
  }
  configured = true;
}

/** Lazily load (and cache) the feature-extraction pipeline. */
export async function loadEmbedder(
  opts: EmbedderOptions,
): Promise<FeatureExtractionPipeline> {
  configure(opts);
  if (!pipePromise) {
    // dtype 'q8' selects onnx/model_quantized.onnx (the bundled ~23 MB file).
    pipePromise = pipeline("feature-extraction", MODEL_ID, { dtype: "q8" });
  }
  return pipePromise;
}

/** Embed one string into a unit-norm Float32 vector of length EMBED_DIM. */
export async function embed(
  text: string,
  opts: EmbedderOptions,
): Promise<Float32Array> {
  const extractor = await loadEmbedder(opts);
  const output = await extractor(text, { pooling: "mean", normalize: true });
  return new Float32Array(output.data as Float32Array);
}

/** Embed many strings sequentially (used by the offline prep script). */
export async function embedBatch(
  texts: string[],
  opts: EmbedderOptions,
  onProgress?: (done: number, total: number) => void,
): Promise<Float32Array[]> {
  const out: Float32Array[] = [];
  for (let i = 0; i < texts.length; i++) {
    out.push(await embed(texts[i], opts));
    if (onProgress && (i % 25 === 0 || i === texts.length - 1)) {
      onProgress(i + 1, texts.length);
    }
  }
  return out;
}
