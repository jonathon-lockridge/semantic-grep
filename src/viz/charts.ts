/**
 * Hand-rolled SVG charts (no charting dependency). The headline is the
 * recall-vs-speed tradeoff curve: each point is one efSearch value plotted as
 * (speedup over brute force, recall@k). Sliding the ef knob moves the
 * highlighted point along the curve, making the tradeoff tangible.
 */
import type { EfPoint } from "../core/benchmark";

const NS = "http://www.w3.org/2000/svg";

function el(name: string, attrs: Record<string, string | number>, text?: string): SVGElement {
  const node = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  if (text !== undefined) node.textContent = text;
  return node;
}

export interface TradeoffOptions {
  /** The fixed sample points that form the curve. */
  points: EfPoint[];
  /** The live point for the current ef knob, highlighted separately. */
  active?: EfPoint;
  width?: number;
  height?: number;
}

/** Recall (Y, %) vs speedup over brute force (X, ×). */
export function renderTradeoff(container: HTMLElement, opts: TradeoffOptions): void {
  const W = opts.width ?? 640;
  const H = opts.height ?? 360;
  const m = { top: 24, right: 24, bottom: 48, left: 56 };
  const plotW = W - m.left - m.right;
  const plotH = H - m.top - m.bottom;

  const pts = [...opts.points].sort((a, b) => a.efSearch - b.efSearch);
  const active = opts.active;
  const maxSpeedup = Math.max(2, ...pts.map((p) => p.speedupEvals), active?.speedupEvals ?? 0);
  const xMax = Math.ceil(maxSpeedup * 1.1);
  const yMin = Math.min(0.5, ...pts.map((p) => p.recall)) - 0.05;
  const yLo = Math.max(0, Math.floor(yMin * 10) / 10);

  const x = (speedup: number): number => m.left + (speedup / xMax) * plotW;
  const y = (recall: number): number => m.top + (1 - (recall - yLo) / (1 - yLo)) * plotH;

  const svg = el("svg", {
    viewBox: `0 0 ${W} ${H}`,
    width: "100%",
    role: "img",
    "aria-label": "Recall versus speedup tradeoff curve",
    class: "chart",
  });

  // Y gridlines + labels (recall %)
  const ySteps = 5;
  for (let i = 0; i <= ySteps; i++) {
    const r = yLo + ((1 - yLo) * i) / ySteps;
    const yy = y(r);
    svg.appendChild(el("line", { x1: m.left, y1: yy, x2: m.left + plotW, y2: yy, class: "grid" }));
    svg.appendChild(
      el("text", { x: m.left - 10, y: yy + 4, "text-anchor": "end", class: "tick" }, `${Math.round(r * 100)}%`),
    );
  }
  // X gridlines + labels (speedup ×)
  const xSteps = Math.min(xMax, 6);
  for (let i = 0; i <= xSteps; i++) {
    const sp = (xMax * i) / xSteps;
    const xx = x(sp);
    svg.appendChild(el("line", { x1: xx, y1: m.top, x2: xx, y2: m.top + plotH, class: "grid" }));
    svg.appendChild(
      el("text", { x: xx, y: m.top + plotH + 22, "text-anchor": "middle", class: "tick" }, `${sp.toFixed(0)}x`),
    );
  }

  // Axis titles
  svg.appendChild(
    el(
      "text",
      { x: m.left + plotW / 2, y: H - 8, "text-anchor": "middle", class: "axis-title" },
      "speedup vs brute force (fewer distance evals)",
    ),
  );
  const yTitle = el(
    "text",
    { x: 16, y: m.top + plotH / 2, "text-anchor": "middle", class: "axis-title", transform: `rotate(-90 16 ${m.top + plotH / 2})` },
    "recall@10",
  );
  svg.appendChild(yTitle);

  // Curve
  const path = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${x(p.speedupEvals).toFixed(1)} ${y(p.recall).toFixed(1)}`).join(" ");
  svg.appendChild(el("path", { d: path, class: "curve" }));

  // Sample points
  for (const p of pts) {
    svg.appendChild(el("circle", { cx: x(p.speedupEvals), cy: y(p.recall), r: 4, class: "pt" }));
  }

  // Active (current-ef) point, highlighted
  if (active) {
    const cx = x(active.speedupEvals);
    const cy = y(active.recall);
    svg.appendChild(el("circle", { cx, cy, r: 7, class: "pt pt-active" }));
    const labelLeft = cx > m.left + plotW - 70;
    svg.appendChild(
      el(
        "text",
        { x: cx + (labelLeft ? -12 : 12), y: cy - 12, "text-anchor": labelLeft ? "end" : "start", class: "pt-label" },
        `ef=${active.efSearch}`,
      ),
    );
  }

  container.replaceChildren(svg);
}

/** Two horizontal bars: HNSW evals/query vs brute force N. */
export function renderWorkBars(
  container: HTMLElement,
  hnswEvals: number,
  bruteEvals: number,
): void {
  const W = 640;
  const H = 120;
  const left = 130;
  const barH = 30;
  const max = Math.max(hnswEvals, bruteEvals);
  const scale = (v: number): number => (v / max) * (W - left - 80);

  const svg = el("svg", { viewBox: `0 0 ${W} ${H}`, width: "100%", class: "chart", role: "img", "aria-label": "Distance evaluations per query" });
  const rows: [string, number, string][] = [
    ["brute force", bruteEvals, "bar-brute"],
    ["semantic-grep", hnswEvals, "bar-hnsw"],
  ];
  rows.forEach(([label, val, cls], i) => {
    const yy = 20 + i * (barH + 24);
    svg.appendChild(el("text", { x: left - 12, y: yy + barH / 2 + 4, "text-anchor": "end", class: "tick" }, label));
    svg.appendChild(el("rect", { x: left, y: yy, width: Math.max(2, scale(val)), height: barH, rx: 4, class: cls }));
    svg.appendChild(
      el("text", { x: left + scale(val) + 8, y: yy + barH / 2 + 4, class: "bar-val" }, `${Math.round(val)} evals`),
    );
  });
  container.replaceChildren(svg);
}
