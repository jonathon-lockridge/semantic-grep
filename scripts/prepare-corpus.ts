/**
 * BUILD-TIME corpus preparation. Run with `npm run prepare-corpus`. Never runs
 * at runtime — the browser loads the committed outputs as static assets.
 *
 * Steps:
 *   1. Load the original CC0 help/explainer passages (scripts/help-corpus.ts).
 *   2. Fetch Wikipedia article intros (CC BY-SA 4.0) for scale and variety.
 *   3. Embed every passage with the bundled quantized MiniLM (mean-pool + L2).
 *   4. Embed a curated set of example queries (so the demo works even if the
 *      browser cannot load the model: example-query fallback mode).
 *   5. Write data/passages.json, data/embeddings.bin, data/meta.json,
 *      data/examples.json, and data/SOURCE.md.
 *
 * Fallbacks (so the build always completes): if Wikipedia is unreachable we ship
 * the authored passages alone; if the model cannot load at all the script exits
 * with guidance to use the synthetic-vector path. The HNSW recall proof never
 * depends on this script.
 */
import { writeFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { EMBED_DIM, MODEL_ID, embedBatch, embed } from "../src/embed/embedder";
import { l2Norm } from "../src/core/distance";
import { Rng } from "../src/core/rng";
import { HELP_CORPUS } from "./help-corpus";

const DATA_DIR = resolve("data");
const MODEL_PATH = resolve("public/models");
const TARGET_WIKI = 2400; // bulk passages for benchmark scale
const RETRIEVED = new Date().toISOString().slice(0, 10);

interface Passage {
  id: number;
  title: string;
  text: string;
  source: "helpcenter" | "wikipedia";
  category?: string;
}

const EXAMPLE_QUERIES: { query: string; note: string }[] = [
  { query: "how do I cancel my subscription", note: "matches 'end your plan' with no shared keywords" },
  { query: "I forgot my password and can't log in", note: "matches account-access help" },
  { query: "the app keeps crashing on my phone", note: "matches 'the program closes unexpectedly'" },
  { query: "is my personal information kept private", note: "matches data-protection passage" },
  { query: "how do I get my money back", note: "matches 'getting your money back'" },
  { query: "the website is really slow today", note: "matches slow-loading troubleshooting" },
  { query: "make the text bigger so I can read it", note: "matches display-scaling help" },
  { query: "why do I feel sleepy after lunch", note: "matches the post-meal drowsiness explainer" },
  { query: "how do plants turn sunlight into food", note: "matches the photosynthesis explainer" },
  { query: "why does the sky look blue", note: "matches the light-scattering explainer" },
  { query: "what happens when I open a web page", note: "matches the how-the-web-works explainer" },
  { query: "working together with my team at the same time", note: "matches real-time collaboration" },
];

/**
 * Held-out natural-language queries for the benchmark — none are corpus members,
 * so recall is measured honestly. They span the corpus's topic range (general
 * knowledge + help intents) so each has real semantic neighbours.
 */
const BENCHMARK_QUERIES: string[] = [
  "how do I stop being billed every month",
  "I can't sign into my account",
  "the application freezes and shuts down",
  "keep my private data secure",
  "I want a refund for my purchase",
  "the page takes forever to load",
  "the words on screen are too small",
  "I get drowsy in the early afternoon",
  "how do leaves convert light into energy",
  "what gives the sky its blue color",
  "what happens behind the scenes when loading a site",
  "edit a document together with colleagues live",
  "which planet is closest to the sun",
  "what is the tallest mountain on earth",
  "how far away is the moon",
  "what causes ocean tides",
  "why do we have leap years",
  "how do birds manage to fly",
  "what is the largest animal in the world",
  "how long do elephants live",
  "what do bees do for plants",
  "why do cats purr",
  "how do volcanoes erupt",
  "what is an earthquake",
  "how are diamonds formed",
  "what is lightning made of",
  "why is the ocean salty",
  "what is the speed of light",
  "who painted famous renaissance art",
  "what was the industrial revolution",
  "when did humans first reach space",
  "who discovered gravity",
  "what is democracy",
  "how does a parliament work",
  "what is inflation in economics",
  "how do banks make money",
  "what is a stock market",
  "how is bread made",
  "where does coffee come from",
  "what makes chili peppers spicy",
  "how is cheese produced",
  "what is fermentation",
  "how does the human heart work",
  "what do kidneys do in the body",
  "why do we need sleep",
  "what causes a fever",
  "how do vaccines protect us",
  "what are muscles made of",
  "how does the brain store memories",
  "what is the largest country by area",
  "what language is spoken in brazil",
  "what is the capital of a european nation",
  "how do rivers form",
  "what is a desert climate",
  "why do seasons change through the year",
  "what is a hurricane",
  "how do computers store information",
  "what is artificial intelligence",
  "how does the internet connect the world",
  "what is a programming language",
  "how does encryption keep messages secret",
  "what is a renewable source of power",
  "how do solar panels generate electricity",
  "what is climate change",
  "how do electric cars work",
  "who composed classical symphonies",
  "what instruments are in an orchestra",
  "what is a popular team sport",
  "how is a marathon distance measured",
  "what are the rules of chess",
  "how do you brew tea properly",
  "what is the history of the olympic games",
];

/** Truncate to the first few sentences so passages stay short for the encoder. */
function trimToSentences(text: string, maxChars = 480): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= maxChars) return clean;
  const cut = clean.slice(0, maxChars);
  const lastStop = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("! "), cut.lastIndexOf("? "));
  return (lastStop > 120 ? cut.slice(0, lastStop + 1) : cut).trim();
}

const WIKI_DATASET = "wikimedia/wikipedia";
const WIKI_CONFIG = "20231101.simple"; // Simple English Wikipedia: short, general-interest
const WIKI_TOTAL = 241787; // approximate row count (only used to spread sampling)
const WIKI_PAGE = 100; // datasets-server max rows per request

/** First prose paragraph of an article, trimmed to a short passage. */
function firstParagraph(text: string): string {
  for (const para of text.split(/\n{2,}/)) {
    const t = para.replace(/\s+/g, " ").trim();
    if (t.length >= 160 && t.includes(". ")) return trimToSentences(t);
  }
  return "";
}

/**
 * Fetch Simple-English-Wikipedia article intros via the Hugging Face
 * datasets-server (robust JSON rows API). Samples random windows across the
 * dataset (seeded, for reproducibility) so the corpus spans many topics rather
 * than just alphabetically-early titles.
 */
async function fetchWikipedia(target: number): Promise<Passage[]> {
  const out: Passage[] = [];
  const seenTitles = new Set<string>();
  const seenText = new Set<string>();
  const rng = new Rng(0x5eed5);
  const maxWindows = Math.ceil(target / 45) + 30; // headroom for filtered stubs

  for (let w = 0; w < maxWindows && out.length < target; w++) {
    const offset = rng.nextInt(WIKI_TOTAL - WIKI_PAGE);
    const url =
      `https://datasets-server.huggingface.co/rows?dataset=${encodeURIComponent(WIKI_DATASET)}` +
      `&config=${encodeURIComponent(WIKI_CONFIG)}&split=train&offset=${offset}&length=${WIKI_PAGE}`;
    let rows: { row: { title: string; text: string } }[];
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "semantic-grep/1.0 (offline demo corpus builder)" },
      });
      if (res.status === 429) {
        console.warn(`  rate limited; backing off...`);
        await new Promise((r) => setTimeout(r, 3000));
        w--; // retry this window
        continue;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as { rows?: { row: { title: string; text: string } }[] };
      rows = json.rows ?? [];
    } catch (err) {
      console.warn(`  wiki window ${w} failed: ${(err as Error).message}`);
      if (out.length === 0 && w > 4) break; // give up early if nothing works
      await new Promise((r) => setTimeout(r, 1000));
      continue;
    }

    for (const r of rows) {
      if (out.length >= target) break;
      const title = r.row.title;
      if (!title || seenTitles.has(title)) continue;
      if (/^(List of|Index of|.*\(disambiguation\))/i.test(title)) continue;
      const text = firstParagraph(r.row.text ?? "");
      if (text.length < 160 || seenText.has(text)) continue;
      seenTitles.add(title);
      seenText.add(text);
      out.push({ id: 0, title, text, source: "wikipedia" });
    }
    if (w % 5 === 0) console.log(`  fetched ${out.length}/${target} wikipedia passages...`);
    await new Promise((r) => setTimeout(r, 250)); // polite pacing
  }
  return out;
}

async function main(): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  const opts = { localModelPath: MODEL_PATH, allowRemote: true };

  console.log("1/5  loading authored CC0 passages...");
  const authored: Passage[] = HELP_CORPUS.map((p) => ({
    id: 0,
    title: p.title,
    text: p.text,
    source: "helpcenter" as const,
    category: p.category,
  }));
  console.log(`     ${authored.length} authored passages`);

  console.log("2/5  fetching Wikipedia passages for scale...");
  let wiki: Passage[] = [];
  try {
    wiki = await fetchWikipedia(TARGET_WIKI);
  } catch (err) {
    console.warn(`     Wikipedia unavailable (${(err as Error).message}); shipping authored only.`);
  }
  console.log(`     ${wiki.length} Wikipedia passages`);

  // Authored passages first so example queries land on stable, low ids.
  const passages: Passage[] = [...authored, ...wiki].map((p, i) => ({ ...p, id: i }));
  console.log(`     total corpus: ${passages.length} passages`);

  console.log(`3/5  embedding passages with ${MODEL_ID} (mean-pool + L2-normalize)...`);
  const vectors = await embedBatch(
    passages.map((p) => p.text),
    opts,
    (done, total) => {
      if (done % 200 === 0 || done === total) console.log(`     embedded ${done}/${total}`);
    },
  );

  // Sanity: unit norm and right dimension.
  for (const v of vectors) {
    if (v.length !== EMBED_DIM) throw new Error(`bad embedding dim ${v.length}`);
  }
  const sampleNorm = l2Norm(vectors[0]);
  console.log(`     sample norm = ${sampleNorm.toFixed(6)} (expect ~1.0)`);

  console.log("4/5  embedding example + benchmark queries...");
  const examples: { query: string; note: string; vector: number[] }[] = [];
  for (const ex of EXAMPLE_QUERIES) {
    const v = await embed(ex.query, opts);
    examples.push({ query: ex.query, note: ex.note, vector: Array.from(v) });
  }
  const benchVectors: number[][] = [];
  for (const q of BENCHMARK_QUERIES) {
    benchVectors.push(Array.from(await embed(q, opts)));
  }

  console.log("5/5  writing data files...");
  // embeddings.bin: float32, row-major [count][dim], little-endian.
  const flat = new Float32Array(passages.length * EMBED_DIM);
  for (let i = 0; i < vectors.length; i++) flat.set(vectors[i], i * EMBED_DIM);
  await writeFile(resolve(DATA_DIR, "embeddings.bin"), Buffer.from(flat.buffer));

  await writeFile(
    resolve(DATA_DIR, "passages.json"),
    JSON.stringify(
      passages.map((p) => ({ id: p.id, title: p.title, text: p.text, source: p.source })),
      null,
      0,
    ),
  );

  const meta = {
    count: passages.length,
    dim: EMBED_DIM,
    dtype: "float32",
    byteOrder: "little-endian",
    layout: "row-major [count][dim]",
    normalized: true,
    model: MODEL_ID,
    modelRevision: "main",
    pooling: "mean",
    retrieved: RETRIEVED,
    sources: {
      helpcenter: { count: authored.length, license: "CC0-1.0" },
      wikipedia: { count: wiki.length, license: "CC-BY-SA-4.0" },
    },
  };
  await writeFile(resolve(DATA_DIR, "meta.json"), JSON.stringify(meta, null, 2));
  await writeFile(resolve(DATA_DIR, "examples.json"), JSON.stringify(examples, null, 0));
  await writeFile(
    resolve(DATA_DIR, "benchmark-queries.json"),
    JSON.stringify({ count: benchVectors.length, dim: EMBED_DIM, vectors: benchVectors }, null, 0),
  );

  await writeSourceDoc(authored.length, wiki.length, passages.length);

  console.log("\nDone.");
  console.log(`  data/passages.json   ${passages.length} passages`);
  console.log(`  data/embeddings.bin  ${(flat.byteLength / 1e6).toFixed(2)} MB`);
  console.log(`  data/examples.json   ${examples.length} example queries`);
}

async function writeSourceDoc(authored: number, wiki: number, total: number): Promise<void> {
  const doc = `# Corpus & model provenance

Generated by \`npm run prepare-corpus\` on ${RETRIEVED}.

## Corpus (${total} passages total)

### Help Center & Explainers — ${authored} passages
- **Source:** original, hand-authored for this project (\`scripts/help-corpus.ts\`).
- **License:** CC0-1.0 (public domain dedication).
- **Why:** deliberate paraphrase variety so a query and its matching passage
  often share no keywords (e.g. "cancel subscription" -> "end your plan"). These
  drive the example queries and the keyword-free demo hits.

### Wikipedia article intros — ${wiki} passages
- **Source:** English Wikipedia, fetched via the MediaWiki action API
  (\`generator=random\`, \`prop=extracts&exintro\`).
- **License:** CC BY-SA 4.0 (https://creativecommons.org/licenses/by-sa/4.0/).
  Text is © its respective authors; see https://en.wikipedia.org.
- **Retrieved:** ${RETRIEVED}.
- **Chunking:** article intro, whitespace-normalised and trimmed to the first
  few sentences (<= ~480 chars) so passages fit the encoder's context.
- **Purpose:** real-world scale and paraphrase variety for the recall/latency
  benchmark.

## Embeddings
- **Model:** ${MODEL_ID} (quantized ONNX, \`onnx/model_quantized.onnx\`), run via
  transformers.js. Bundled under \`public/models/\` for offline query embedding.
- **Dimension:** ${EMBED_DIM}.
- **Pooling:** mean over token embeddings.
- **Normalization:** L2 to unit length, so inner product == cosine similarity.
- **Storage:** \`data/embeddings.bin\` is float32, little-endian, row-major
  \`[count][dim]\`; \`data/meta.json\` records the exact shape and dtype.

The runtime loads these committed files with zero network for the corpus and the
benchmark. Only live, arbitrary-query embedding touches the (bundled, then
cached) model.
`;
  await writeFile(resolve(DATA_DIR, "SOURCE.md"), doc);
}

main().catch((err) => {
  console.error("prepare-corpus failed:", err);
  process.exit(1);
});
