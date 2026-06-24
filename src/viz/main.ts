/**
 * Visualizer entry point. Loads the committed corpus, builds the from-scratch
 * HNSW index in the browser, and drives two modes:
 *   - Search: embed a natural-language query live and surface passages by MEANING.
 *   - Benchmark: measure recall vs the exact oracle and cost vs brute force, with
 *     an efSearch knob that redraws the recall-vs-speed tradeoff curve.
 * The benchmark needs no model; only live arbitrary-query search touches it.
 */
import "./style.css";
import { Metric } from "../core/distance";
import { HNSW } from "../core/hnsw";
import {
  evaluateEf,
  exactGroundTruth,
  evaluateBruteForce,
  type EfPoint,
} from "../core/benchmark";
import { embed, MODEL_ID } from "../embed/embedder";
import { loadCorpus, type Corpus } from "./data";
import { renderTradeoff, renderWorkBars } from "./charts";

const BASE = import.meta.env.BASE_URL;
const K = 10;
const SEARCH_EF = 100;
const CURVE_EFS = [8, 16, 24, 32, 48, 64, 96, 128, 192, 256];
const REPO_URL = "https://github.com/jonathon-lockridge/semantic-grep";

const STOPWORDS = new Set(
  "a an the is are am was were be been being do does did how do i to of in on for and or my me you your it that this with can could should would will if my our at as".split(
    " ",
  ),
);

type El = HTMLElement;
const $ = (id: string): El => document.getElementById(id) as El;

interface State {
  corpus: Corpus;
  metric: Metric;
  hnsw: HNSW;
  benchVectors: Float32Array[];
  exact: Set<number>[];
  bruteEvals: number;
  curve: EfPoint[];
  modelReady: boolean;
  modelFailed: boolean;
}

let state: State;

// ---------------------------------------------------------------- boot
async function boot(): Promise<void> {
  setOverlay("Loading corpus…", 5);
  const corpus = await loadCorpus(BASE);
  const metric = new Metric(corpus.vectors, corpus.meta.dim);
  const hnsw = new HNSW(metric, { seed: 0x5eed });

  setOverlay("Building the HNSW graph…", 10);
  await buildAsync(hnsw, corpus.meta.count, (done, total) => {
    setOverlay("Building the HNSW graph…", 10 + (done / total) * 80);
  });

  setOverlay("Preparing benchmark…", 92);
  const benchData = (await fetch(join(BASE, "data/benchmark-queries.json")).then((r) =>
    r.json(),
  )) as { dim: number; vectors: number[][] };
  const benchVectors = benchData.vectors.map((v) => new Float32Array(v));
  const exact = exactGroundTruth(metric, benchVectors, K);
  const bruteEvals = evaluateBruteForce(metric, benchVectors, K).avgEvals;
  const curve = CURVE_EFS.map((ef) => evaluateEf(hnsw, metric, benchVectors, exact, K, ef));

  state = {
    corpus,
    metric,
    hnsw,
    benchVectors,
    exact,
    bruteEvals,
    curve,
    modelReady: false,
    modelFailed: false,
  };

  initUI();
  hideOverlay();
}

/** Build the index in chunks, yielding to the event loop so the bar animates. */
async function buildAsync(
  hnsw: HNSW,
  total: number,
  onProgress: (done: number, total: number) => void,
): Promise<void> {
  const CHUNK = 64;
  for (let id = 0; id < total; id += CHUNK) {
    const end = Math.min(id + CHUNK, total);
    for (let i = id; i < end; i++) hnsw.insert(i);
    onProgress(end, total);
    await new Promise((r) => setTimeout(r));
  }
}

// ---------------------------------------------------------------- UI init
function initUI(): void {
  const { corpus } = state;
  $("corpus-pill").textContent = `${corpus.meta.count.toLocaleString()} passages · ${corpus.meta.dim}-dim`;
  $("bench-n").textContent = corpus.meta.count.toLocaleString();

  // tabs
  document.querySelectorAll<HTMLButtonElement>(".tab").forEach((tab) => {
    tab.addEventListener("click", () => switchTab(tab.dataset.tab as string));
  });

  // examples
  const ex = $("examples");
  ex.replaceChildren();
  for (const e of corpus.examples.slice(0, 6)) {
    const chip = document.createElement("button");
    chip.className = "chip";
    chip.textContent = e.query;
    chip.addEventListener("click", () => {
      ($("query-input") as HTMLInputElement).value = e.query;
      void runSearch();
    });
    ex.appendChild(chip);
  }

  // search wiring
  $("search-btn").addEventListener("click", () => void runSearch());
  $("query-input").addEventListener("keydown", (e) => {
    if ((e as KeyboardEvent).key === "Enter") void runSearch();
  });

  // benchmark wiring
  const slider = $("ef-slider") as HTMLInputElement;
  slider.addEventListener("input", () => updateBenchmark(parseInt(slider.value, 10)));
  updateBenchmark(parseInt(slider.value, 10));

  // footer links
  $("footer-links").innerHTML =
    `<a href="${REPO_URL}" target="_blank" rel="noopener">source on GitHub</a>`;

  // initial example search so the page isn't empty
  ($("query-input") as HTMLInputElement).value = corpus.examples[0].query;
  void runSearch();
}

function switchTab(name: string): void {
  document.querySelectorAll(".tab").forEach((t) =>
    t.classList.toggle("tab-active", (t as HTMLElement).dataset.tab === name),
  );
  $("panel-search").classList.toggle("panel-active", name === "search");
  $("panel-benchmark").classList.toggle("panel-active", name === "benchmark");
}

// ---------------------------------------------------------------- search
function findExampleVector(text: string): Float32Array | null {
  const norm = text.trim().toLowerCase();
  const hit = state.corpus.examples.find((e) => e.query.toLowerCase() === norm);
  return hit ? new Float32Array(hit.vector) : null;
}

async function embedQuery(text: string): Promise<{ vec: Float32Array; live: boolean }> {
  // Precomputed example vectors work with zero model (the fallback path).
  const pre = findExampleVector(text);
  if (pre && !state.modelReady) return { vec: pre, live: false };

  setModelStatus("Loading the embedding model (first query only)…", "");
  const vec = await embed(text, { localModelPath: join(BASE, "models"), allowRemote: true });
  state.modelReady = true;
  setModelStatus(`Live query embedding ready · ${MODEL_ID}`, "ready");
  return { vec, live: true };
}

async function runSearch(): Promise<void> {
  const input = $("query-input") as HTMLInputElement;
  const text = input.value.trim();
  if (!text) return;
  const btn = $("search-btn") as HTMLButtonElement;
  btn.disabled = true;

  let vec: Float32Array;
  try {
    const res = await embedQuery(text);
    vec = res.vec;
    if (!res.live && !state.modelReady) {
      setModelStatus("Showing a precomputed example (model not loaded yet).", "");
    }
  } catch (err) {
    state.modelFailed = true;
    const pre = findExampleVector(text);
    if (pre) {
      vec = pre;
      setModelStatus("Model unavailable — using the precomputed example vector.", "error");
    } else {
      setModelStatus(
        "Could not load the embedding model here. Try an example query (those use precomputed vectors).",
        "error",
      );
      btn.disabled = false;
      return;
    }
  }

  const { results } = state.hnsw.search(vec, K, SEARCH_EF);
  renderResults(text, results);
  btn.disabled = false;
}

function contentWords(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2 && !STOPWORDS.has(w)),
  );
}

function renderResults(query: string, results: { id: number; sim: number }[]): void {
  const box = $("results");
  box.replaceChildren();
  const qWords = contentWords(query);

  results.forEach((r, i) => {
    const p = state.corpus.passages[r.id];
    const pWords = contentWords(`${p.title} ${p.text}`);
    const shared = [...qWords].filter((w) => pWords.has(w));
    const keywordFree = i === 0 && shared.length === 0;

    const card = document.createElement("div");
    card.className = "result";

    // Cosine sims for relevant hits sit in ~0.3-0.7; map directly so the bar
    // length tracks similarity and the differences between results are visible.
    const pct = Math.max(0, Math.min(1, r.sim));
    card.innerHTML = `
      <div class="result-rank">${i + 1}</div>
      <div>
        <div class="result-head">
          <span class="result-title">${escapeHtml(p.title)}</span>
          <span class="tag tag-${p.source}">${p.source === "helpcenter" ? "help" : "wiki"}</span>
          ${keywordFree ? '<span class="tag tag-keyword-free">no shared keywords</span>' : ""}
          <span class="score">
            <span class="score-bar"><span class="score-fill" style="width:${(pct * 100).toFixed(0)}%"></span></span>
            <span class="score-num">${r.sim.toFixed(3)}</span>
          </span>
        </div>
        <div class="result-text">${escapeHtml(p.text)}</div>
      </div>`;
    box.appendChild(card);
  });
}

// ---------------------------------------------------------------- benchmark
function updateBenchmark(ef: number): void {
  $("ef-value").textContent = String(ef);
  const point = evaluateEf(state.hnsw, state.metric, state.benchVectors, state.exact, K, ef);

  $("stat-row").replaceChildren();
  stat("recall@10", `${(point.recall * 100).toFixed(1)}%`, "vs exact oracle", true);
  stat("speedup", `${point.speedupEvals.toFixed(1)}x`, "fewer distance evals");
  stat("HNSW work", `${Math.round(point.avgEvals)}`, "evals / query");
  stat("brute force", `${Math.round(state.bruteEvals)}`, "evals / query (N)");

  renderTradeoff($("tradeoff-chart"), { points: state.curve, active: point });
  renderWorkBars($("work-chart"), point.avgEvals, state.bruteEvals);
  $("work-note").textContent =
    `At ef=${ef}, HNSW reaches ${(point.recall * 100).toFixed(1)}% recall while touching ` +
    `${Math.round(point.avgEvals)} of ${Math.round(state.bruteEvals)} vectors — ` +
    `${point.speedupEvals.toFixed(1)}x less work than scanning them all.`;
  $("bench-meta").textContent =
    `Measured live over ${state.benchVectors.length} held-out natural-language queries · k=${K} · ` +
    `M=16, efConstruction=200 · recall and cost are counted, not estimated.`;
}

function stat(label: string, value: string, sub: string, accent = false): void {
  const div = document.createElement("div");
  div.className = "stat";
  div.innerHTML = `<div class="stat-label">${label}</div><div class="stat-value${accent ? " accent" : ""}">${value}</div><div class="stat-sub">${sub}</div>`;
  $("stat-row").appendChild(div);
}

// ---------------------------------------------------------------- helpers
function setOverlay(text: string, pct: number): void {
  $("overlay-text").textContent = text;
  ($("progress-bar") as El).style.width = `${pct}%`;
}
function hideOverlay(): void {
  $("overlay").classList.add("hidden");
}
function setModelStatus(text: string, cls: string): void {
  const el = $("model-status");
  el.textContent = text;
  el.className = `model-status ${cls}`;
}
function join(base: string, path: string): string {
  return base.replace(/\/$/, "") + "/" + path.replace(/^\//, "");
}
function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] as string);
}

boot().catch((err) => {
  console.error(err);
  setOverlay(`Failed to load: ${(err as Error).message}`, 0);
});
