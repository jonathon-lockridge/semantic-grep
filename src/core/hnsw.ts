/**
 * Hierarchical Navigable Small World (HNSW) approximate-nearest-neighbour index,
 * implemented FROM SCRATCH — this is the centerpiece of the project. No ANN /
 * vector-search library is used; only the distance math and the seeded PRNG from
 * sibling modules. Follows Malkov & Yashunin (2016), "Efficient and robust
 * approximate nearest neighbor search using Hierarchical Navigable Small World
 * graphs", with the algorithm numbers from that paper cited at each step.
 *
 * Everything operates in SIMILARITY space (unit-vector inner product; higher is
 * nearer) using the single canonical comparator, so its notion of "the top-k"
 * is identical to the brute-force oracle's.
 */
import { Rng } from "./rng";
import { BinaryHeap } from "./heap";
import {
  Metric,
  compareCandidates,
  isNearer,
  type Candidate,
  type Vector,
} from "./distance";

export interface HnswParams {
  /** Max neighbours per node on layers >= 1. Default 16. */
  M: number;
  /** Size of the dynamic candidate list during construction. Default 200. */
  efConstruction: number;
  /** Seed for the layer-assignment PRNG. Fixed by default for reproducibility. */
  seed: number;
}

export const DEFAULT_PARAMS: HnswParams = {
  M: 16,
  efConstruction: 200,
  seed: 0x5eed,
};

export interface SearchResult {
  results: Candidate[];
  /** Similarity evaluations performed for this query (the efficiency proxy). */
  evals: number;
}

export class HNSW {
  readonly metric: Metric;
  readonly M: number;
  readonly Mmax: number; // degree cap on layers >= 1
  readonly Mmax0: number; // degree cap on layer 0
  readonly efConstruction: number;
  readonly mL: number; // level-generation normalisation factor, 1 / ln(M)

  /** levels[id] = the top layer that node id participates in. */
  readonly levels: number[] = [];
  /** links[id][layer] = neighbour ids of node id at that layer. */
  readonly links: number[][][] = [];

  entryPoint = -1;
  maxLevel = -1;

  private readonly rng: Rng;

  constructor(metric: Metric, params: Partial<HnswParams> = {}) {
    const p = { ...DEFAULT_PARAMS, ...params };
    this.metric = metric;
    this.M = p.M;
    this.Mmax = p.M;
    this.Mmax0 = 2 * p.M;
    this.efConstruction = p.efConstruction;
    this.mL = 1 / Math.log(p.M);
    this.rng = new Rng(p.seed);
  }

  get size(): number {
    return this.levels.length;
  }

  /**
   * Probabilistic level for a new node: l = floor(-ln(U) * mL), U ~ uniform(0,1)
   * from the seeded PRNG. Produces an exponentially-decaying layer distribution.
   */
  private randomLevel(): number {
    const u = Math.max(this.rng.next(), 1e-12); // guard ln(0)
    return Math.floor(-Math.log(u) * this.mL);
  }

  /** Neighbours of `id` at `layer`, or an empty array if it has no such layer. */
  private neighbors(id: number, layer: number): number[] {
    const perLayer = this.links[id];
    return perLayer !== undefined && layer < perLayer.length ? perLayer[layer] : [];
  }

  /**
   * SEARCH-LAYER (Algorithm 5). Greedy beam over a single layer: keep expanding
   * the closest unvisited candidate; stop once the closest remaining candidate
   * is farther than the farthest of the (ef-capped) results. `simTo` returns the
   * similarity of the query to a node id and bumps the evaluation counter.
   */
  private searchLayer(
    simTo: (id: number) => number,
    entryPoints: number[],
    ef: number,
    layer: number,
  ): Candidate[] {
    const visited = new Set<number>();
    // candidates: nearest on top (max by similarity, canonical tie-break)
    const candidates = new BinaryHeap<Candidate>((a, b) => isNearer(a, b));
    // results: farthest on top (min by similarity) so we can evict the worst
    const results = new BinaryHeap<Candidate>((a, b) => isNearer(b, a));

    for (const ep of entryPoints) {
      const c: Candidate = { id: ep, sim: simTo(ep) };
      visited.add(ep);
      candidates.push(c);
      results.push(c);
    }

    while (candidates.size > 0) {
      const c = candidates.pop(); // closest candidate
      const farthest = results.peek(); // farthest accepted result
      // If the closest candidate is already worse than our worst result, stop.
      if (compareCandidates(c, farthest) > 0) break;

      for (const e of this.neighbors(c.id, layer)) {
        if (visited.has(e)) continue;
        visited.add(e);
        const cand: Candidate = { id: e, sim: simTo(e) };
        const worst = results.peek();
        if (results.size < ef || compareCandidates(cand, worst) < 0) {
          candidates.push(cand);
          results.push(cand);
          if (results.size > ef) results.pop(); // drop the farthest
        }
      }
    }

    return results.toArray();
  }

  /**
   * SELECT-NEIGHBORS-HEURISTIC (Algorithm 4). Diversifying selection: walk the
   * candidates nearest-first and keep one only if it is closer to the base node
   * than to every already-selected neighbour. This spreads links across
   * directions instead of clustering them toward one dense region — the naive
   * "keep the M closest" choice produces a poorly connected graph and tanks
   * recall, which is exactly why this heuristic is required.
   *
   * `extendCandidates` is left at its default (false). `keepPrunedConnections`
   * is exposed: false when first choosing a new node's neighbours (strict
   * diversification), true when re-pruning an existing node's over-full list so
   * we keep its degree up and preserve connectivity (we then drop only the least
   * diverse links). `base` is the node the candidates are scored against; their
   * `sim` field already holds similarity-to-base.
   */
  private selectNeighbors(
    candidates: Candidate[],
    m: number,
    keepPrunedConnections: boolean,
  ): Candidate[] {
    const working = candidates.slice().sort(compareCandidates); // nearest first
    const selected: Candidate[] = [];
    const discarded: Candidate[] = [];

    for (const e of working) {
      if (selected.length >= m) break;
      let keep = true;
      for (const r of selected) {
        // similarity(e, r): node-to-node, counts as an evaluation
        const simToSelected = this.metric.between(e.id, r.id);
        // e is closer to an already-selected r than to the base -> not diverse
        if (simToSelected >= e.sim) {
          keep = false;
          break;
        }
      }
      if (keep) selected.push(e);
      else discarded.push(e);
    }

    if (keepPrunedConnections) {
      // Backfill from the most-similar discarded candidates up to the cap.
      discarded.sort(compareCandidates);
      let i = 0;
      while (selected.length < m && i < discarded.length) {
        selected.push(discarded[i++]);
      }
    }

    return selected;
  }

  /** Add a symmetric (bidirectional) edge between `a` and `b` at `layer`. */
  private connect(a: number, b: number, layer: number): void {
    this.links[a][layer].push(b);
    this.links[b][layer].push(a);
  }

  /**
   * Re-prune node `n`'s neighbour list at `layer` down to `cap`, keeping it
   * symmetric: any neighbour dropped from n's list also drops n from its own
   * list, so the bidirectional invariant survives pruning.
   */
  private prune(n: number, layer: number, cap: number): void {
    const current = this.links[n][layer];
    if (current.length <= cap) return;
    const cands: Candidate[] = current.map((id) => ({
      id,
      sim: this.metric.between(n, id),
    }));
    const keptList = this.selectNeighbors(cands, cap, true);
    const kept = new Set(keptList.map((c) => c.id));
    for (const m of current) {
      if (!kept.has(m)) {
        // remove the reverse edge n -> kept on m's side
        const mList = this.links[m][layer];
        const idx = mList.indexOf(n);
        if (idx !== -1) mList.splice(idx, 1);
      }
    }
    this.links[n][layer] = keptList.map((c) => c.id);
  }

  private nearestOf(candidates: Candidate[]): number {
    let best = candidates[0];
    for (let i = 1; i < candidates.length; i++) {
      if (compareCandidates(candidates[i], best) < 0) best = candidates[i];
    }
    return best.id;
  }

  /**
   * INSERT (Algorithm 1). The dataset vector for the new node must already be
   * appended to `metric.vectors` at index `id`. Inserts in fixed corpus order,
   * so a fixed seed yields a byte-identical graph.
   */
  insert(id: number): void {
    if (id !== this.levels.length) {
      throw new Error(
        `HNSW.insert expects ids in order; got ${id}, expected ${this.levels.length}`,
      );
    }
    const level = this.randomLevel();
    this.levels[id] = level;
    this.links[id] = Array.from({ length: level + 1 }, () => []);

    // First node becomes the entry point.
    if (this.entryPoint === -1) {
      this.entryPoint = id;
      this.maxLevel = level;
      return;
    }

    const simTo = (other: number): number => this.metric.between(id, other);

    let ep = this.entryPoint;
    const topLevel = this.maxLevel;

    // Phase 1: greedily descend the layers above the new node's level (ef = 1).
    for (let lc = topLevel; lc > level; lc--) {
      const w = this.searchLayer(simTo, [ep], 1, lc);
      ep = this.nearestOf(w);
    }

    // Phase 2: from min(topLevel, level) down to 0, link the new node in.
    let entryPoints = [ep];
    for (let lc = Math.min(topLevel, level); lc >= 0; lc--) {
      const w = this.searchLayer(simTo, entryPoints, this.efConstruction, lc);
      const cap = lc === 0 ? this.Mmax0 : this.Mmax;
      const chosen = this.selectNeighbors(w, this.M, false);

      for (const nb of chosen) {
        this.connect(id, nb.id, lc);
      }
      // Re-prune any neighbour that now exceeds the degree cap (symmetrically).
      for (const nb of chosen) {
        this.prune(nb.id, lc, cap);
      }
      // Also keep the new node itself within the cap.
      this.prune(id, lc, cap);

      // The whole result set seeds the search one layer down.
      entryPoints = w.map((c) => c.id);
    }

    // If the new node reached a higher layer than any before, it is the new entry.
    if (level > topLevel) {
      this.entryPoint = id;
      this.maxLevel = level;
    }
  }

  /** Build the index over every vector currently in the metric, in order. */
  build(onProgress?: (done: number, total: number) => void): void {
    const n = this.metric.vectors.length;
    for (let id = this.size; id < n; id++) {
      this.insert(id);
      if (onProgress && (id % 64 === 0 || id === n - 1)) onProgress(id + 1, n);
    }
  }

  /**
   * K-NN-SEARCH (Algorithm 2). Greedy-descend the upper layers with ef = 1, then
   * run the ef-search beam at layer 0, and return the top-k under the canonical
   * comparator. `efSearch` is the exposed recall/speed knob; it is clamped up to
   * k since the beam must be at least k wide to return k results.
   */
  search(query: Vector, k: number, efSearch: number): SearchResult {
    const before = this.metric.count;
    if (this.entryPoint === -1) return { results: [], evals: 0 };

    const simTo = (id: number): number => this.metric.toQuery(query, id);
    const ef = Math.max(efSearch, k);

    let ep = this.entryPoint;
    for (let lc = this.maxLevel; lc >= 1; lc--) {
      const w = this.searchLayer(simTo, [ep], 1, lc);
      ep = this.nearestOf(w);
    }
    const w = this.searchLayer(simTo, [ep], ef, 0);
    w.sort(compareCandidates);

    const kk = Math.min(k, w.length);
    return { results: w.slice(0, kk), evals: this.metric.count - before };
  }
}
