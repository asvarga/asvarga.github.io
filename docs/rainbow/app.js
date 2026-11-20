// The page: the post's two pictures of a rainbow list (arcs over the list, and
// the same pointers with each node raised to its green height), the path a
// seek takes, how push built the head, and hops for every item.
import { arcs, BOUNDS, cons, height, MODE_KINDS, NAMES, phases, pointers, SEEKS } from "./rainbow.js";

const $ = (id) => document.getElementById(id);
const SVG = "http://www.w3.org/2000/svg";
const COLOR = Object.fromEntries(["n", "r", "g", "b", "y"].map((k) => [k, getComputedStyle(document.documentElement).getPropertyValue(`--k-${k}`).trim()]));

const W = 1000;
const PAD = { left: 18, right: 18, top: 14, bottom: 30 };
const ARC_MAX = 330; // tallest arc, in viewBox units; wider spans are flattened
const MAX_N = 256;

const state = { n: 63, i: 60, mode: "rainbow", view: "arcs", yellow: false };
let hover = null; // { node } or { row }
let flash = 0; // until when the head's pointers glow after a push
let anim = null; // { path, k, t0, per }
let geo = null;

// ---- state <-> URL ----

function readHash() {
  const q = new URLSearchParams(location.hash.slice(1));
  const num = (k, lo, hi, d) => {
    const v = parseInt(q.get(k), 10);
    return Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d;
  };
  state.n = num("n", 2, MAX_N, state.n);
  state.i = num("i", 0, state.n - 1, Math.min(state.i, state.n - 1));
  if (SEEKS[q.get("mode")]) state.mode = q.get("mode");
  if (q.get("view") === "tree" || q.get("view") === "arcs") state.view = q.get("view");
  state.yellow = q.get("y") === "1";
}

function writeHash() {
  const q = new URLSearchParams({ n: state.n, i: state.i, mode: state.mode, view: state.view });
  if (state.yellow) q.set("y", "1");
  history.replaceState(null, "", `#${q}`);
}

// ---- geometry ----

const target = () => state.n - state.i;
// Yellow is optional where it only helps push; the other seeks ride it.
const RIDES_YELLOW = ["greedy", "planned", "optimal"];
const kinds = () => MODE_KINDS[state.mode].filter((k) => k !== "y" || state.yellow || RIDES_YELLOW.includes(state.mode));
const WORD = { next: "plain list", green: "green alone", rainbow: "rainbow", greedy: "greedy", planned: "planned", optimal: "optimal" };
const LABEL = { next: "Next only", green: "+ Green", rainbow: "Rainbow (the post's seek)", greedy: "Greedy (2022 package)", planned: "Planned", optimal: "Optimal (search)" };

function layout(list) {
  const n = state.n;
  const sx = (W - PAD.left - PAD.right) / n;
  const x = (i) => PAD.left + i * sx;
  if (state.view === "arcs") {
    const widest = Math.max(1, ...list.map((a) => a.from - a.to)) * sx * 0.5;
    const squash = Math.min(1, ARC_MAX / widest);
    const base = PAD.top + widest * squash;
    const y = () => base;
    const at = (a, b, t) => {
      // t from 0 (at a) to 1 (at b), over the top of the arc
      const cx = (x(a) + x(b)) / 2;
      const rx = (x(a) - x(b)) / 2;
      const th = t * Math.PI;
      return [cx + rx * Math.cos(th), base - rx * squash * Math.sin(th)];
    };
    const d = (a, b) => {
      const rx = (x(a) - x(b)) / 2;
      return `M${x(a).toFixed(1)},${base} A${rx.toFixed(1)},${(rx * squash).toFixed(1)} 0 0 0 ${x(b).toFixed(1)},${base}`;
    };
    return { x, y, at, d, base, h: base + PAD.bottom };
  }
  const top = Math.max(1, ...Array.from({ length: n }, (_, k) => height(k + 1)));
  const step = Math.min(56, 300 / top);
  const base = PAD.top + 10 + top * step;
  const y = (i) => base - height(i) * step;
  const at = (a, b, t) => [x(a) + (x(b) - x(a)) * t, y(a) + (y(b) - y(a)) * t - Math.sin(t * Math.PI) * 14];
  const d = (a, b) => `M${x(a).toFixed(1)},${y(a).toFixed(1)} L${x(b).toFixed(1)},${y(b).toFixed(1)}`;
  return { x, y, at, d, base, h: base + PAD.bottom };
}

// ---- drawing ----

function el(tag, attrs = {}, parent) {
  const e = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  parent?.append(e);
  return e;
}

function ticks(n) {
  let step = 1;
  while (n / step > 9) step *= 2;
  const out = [];
  for (let t = 0; t <= n; t += step) out.push(t);
  if (out.at(-1) !== n) out.push(n);
  if (out.length > 2 && n - out.at(-2) < step / 2) out.splice(-2, 1);
  return out;
}

function drawFigure() {
  const svg = $("fig");
  const list = arcs(state.n, kinds());
  geo = layout(list);
  const { x, y, d, base, h } = geo;
  svg.setAttribute("viewBox", `0 0 ${W} ${h}`);
  svg.replaceChildren();
  const thin = state.n > 128 ? 1 : state.n > 64 ? 1.4 : 2;
  const path = SEEKS[state.mode](state.n, target());
  const focus = hover || Date.now() < flash;

  // every pointer, faint while something is in focus
  const all = el("g", { fill: "none", "stroke-width": thin, opacity: focus ? 0.25 : path.length ? 0.55 : 0.8 }, svg);
  for (const k of ["y", "n", "b", "r", "g"]) {
    const ds = list.filter((a) => a.kind === k).map((a) => d(a.from, a.to));
    if (ds.length) el("path", { d: ds.join(" "), stroke: COLOR[k] }, all);
  }

  // the seek's path, outlined as in the post
  const lit = el("g", { fill: "none", "stroke-linecap": "round", opacity: focus ? 0.35 : 1 }, svg);
  for (const hop of path) el("path", { d: d(hop.from, hop.to), stroke: "#000", "stroke-width": thin * 2 + 5 }, lit);
  for (const hop of path) el("path", { d: d(hop.from, hop.to), stroke: COLOR[hop.kind], "stroke-width": thin * 2 + 1.5 }, lit);

  // what's in focus: a node's pointers, a push's walk, or the new head
  const hi = el("g", { fill: "none", "stroke-linecap": "round" }, svg);
  const glow = (a, b, k, dash) => {
    el("path", { d: d(a, b), stroke: "#000", "stroke-width": 7 }, hi);
    el("path", { d: d(a, b), stroke: COLOR[k], "stroke-width": 4, ...(dash ? { "stroke-dasharray": "6 5" } : {}) }, hi);
  };
  const ptrs = (i) => {
    const p = pointers(i);
    for (const k of ["y", "n", "b", "r", "g"]) if (p[k] && MODE_KINDS[state.mode].includes(k)) glow(i, p[k], k);
  };
  if (hover?.node) ptrs(hover.node);
  else if (hover?.row) {
    const row = hover.row;
    if (row.to) glow(state.n, row.to, row.field);
    let from = state.n;
    for (const t of row.chain) {
      const k = walkKind(from, t);
      if (k && from !== state.n) glow(from, t, k, true);
      from = t;
    }
  } else if (focus) ptrs(state.n);

  // nodes and the axis
  const dots = el("g", {}, svg);
  const r = state.n > 128 ? 1.6 : state.n > 64 ? 2.2 : 3;
  for (let i = 1; i <= state.n; i++) el("circle", { cx: x(i), cy: y(i), r, fill: "#f4f1e4", opacity: 0.85 }, dots);
  el("line", { x1: x(0), x2: x(state.n), y1: base + 6, y2: base + 6, stroke: "rgb(244 241 228 / 30%)" }, svg);
  for (const t of ticks(state.n)) {
    el("line", { x1: x(t), x2: x(t), y1: base + 6, y2: base + 10, stroke: "rgb(244 241 228 / 40%)" }, svg);
    el("text", { x: x(t), y: base + 24, "text-anchor": "middle" }, svg).textContent = t;
  }

  // the head and the target
  const j = target();
  el("circle", { cx: x(state.n), cy: y(state.n), r: r + 4, fill: "none", stroke: "#f4f1e4", "stroke-width": 2 }, svg);
  el("circle", { cx: x(j), cy: y(j), r: r + 5, fill: "none", stroke: "var(--accent)", "stroke-width": 2.5 }, svg);
  if (hover?.node) el("circle", { cx: x(hover.node), cy: y(hover.node), r: r + 4, fill: "none", stroke: "#fff", "stroke-dasharray": "3 3" }, svg);

  // Phibber, if he's hopping
  const frog = el("g", { id: "frog" }, svg);
  el("ellipse", { cx: 0, cy: -2, rx: 9, ry: 7, fill: "#6fcf5b", stroke: "#000", "stroke-width": 1.5 }, frog);
  for (const ex of [-4.5, 4.5]) {
    el("circle", { cx: ex, cy: -9, r: 3.2, fill: "#fff", stroke: "#000", "stroke-width": 1.2 }, frog);
    el("circle", { cx: ex, cy: -9, r: 1.4, fill: "#000" }, frog);
  }
  placeFrog(frog);
}

// Which pointer of node a leads to b (for drawing push's walks).
function walkKind(a, b) {
  const p = pointers(a);
  return ["y", "g", "b", "r", "n"].find((k) => p[k] === b);
}

function placeFrog(frog = $("frog")) {
  if (!frog || !geo) return;
  let pos;
  if (anim) {
    const hop = anim.path[anim.k];
    pos = hop ? geo.at(hop.from, hop.to, anim.t) : geo.at(target(), target(), 0);
  } else {
    pos = [geo.x(state.n), geo.y(state.n)];
  }
  frog.setAttribute("transform", `translate(${pos[0].toFixed(1)},${(pos[1] - 5).toFixed(1)})`);
}

// ---- the text around the picture ----

const chip = (hop, cls = "") => `<li class="k-${hop.kind} ${cls}" title="${NAMES[hop.kind]}: ${hop.from} → ${hop.to}">${hop.kind.toUpperCase()} ${hop.to}</li>`;

function drawText() {
  const j = target();
  const path = SEEKS[state.mode](state.n, j);
  const count = Object.fromEntries(Object.keys(SEEKS).map((m) => [m, SEEKS[m](state.n, j).length]));
  $("length-out").textContent = state.n;
  $("index-out").textContent = `${state.i} (node ${j})`;

  if (hover?.node) {
    const p = pointers(hover.node);
    const parts = ["n", "r", "g", "b", "y"].map((k) => `<b class="k-${k}">${NAMES[k]}</b> ${p[k] || "—"}`);
    $("readout").innerHTML = `Node ${hover.node} (item ${state.n - hover.node}), height ${height(hover.node)}: ${parts.join(" · ")}`;
  } else {
    const word = (m) => WORD[m];
    const others = Object.keys(SEEKS)
      .filter((m) => m !== state.mode)
      .map((m) => `${word(m)} ${count[m]}`)
      .join(" · ");
    $("readout").innerHTML = `Item <b>${state.i}</b> is node <b>${j}</b>: <b>${count[state.mode]}</b> hop${count[state.mode] === 1 ? "" : "s"} (${word(state.mode)}) · ${others} · log<sub>2</sub>(${state.i + 1}) ≈ ${Math.log2(state.i + 1).toFixed(1)}`;
  }

  const ph = state.mode === "rainbow" ? phases(path) : null;
  const shown = path.slice(0, 60);
  $("hops").innerHTML = shown.map((h, k) => chip(h, `${ph ? ph[k] : ""} ${anim && anim.k === k ? "now" : ""}`)).join("") + (path.length > shown.length ? `<li class="k-n">… ${path.length - shown.length} more</li>` : "") || `<li class="k-n">Already there: item 0 is the head.</li>`;

  let say = "";
  if (state.mode === "next") say = "A plain linked list: one hop per item, so item i takes i hops.";
  else if (state.mode === "green") say = "Green arcs never cross, so greedy works: green unless it overshoots, else next. But that's runs of greens, about log²(i) hops.";
  else if (state.mode === "greedy") say = "Greedy: at each node take yellow, else green, else red, the first that doesn't overshoot, else next. No blue and no look-ahead, so each hop needs only the node's own pointers. It wins some items and loses others, but over every list up to 256 long it takes fewer hops in all than the post's seek, and its worst case is one hop shorter.";
  else if (state.mode === "planned") say = "Planned: before following a single pointer, search for the shortest path over a few candidate nodes, the multiples of each power of two near i's and the target's own prefixes, by arithmetic alone. Besides the five pointers it knows two shortcuts: a run of blues along one height, and next then greens down to x − 2ᵗ. It finds the moves the post's seek never makes: yellow on the climb, overshooting to a round node and coming back from below, and blues in a row. It matched the shortest path on every pair tested, but that's measured, not proved.";
  else if (state.mode === "optimal") say = "Optimal: every node from the target up to the head learns its distance from the nodes its pointers reach, and the path is read back from the head. The shortest path there is, as a floor for the others, but it looks at every node in between, so it's no use as a real seek.";
  else if (ph) {
    const up = ph.filter((p) => p === "up").length;
    const down = ph.filter((p) => p === "down").length;
    say = `${ph[0] === "first" ? "One next, then a" : "A"} climb of ${up} (green and blue, solid) and a descent of ${down} (red and blue, dashed), never two blues in a row: the post's three phases, which fit only O(log i) hops. The seek prefers green, then blue, then red, then next, and takes a shortcut only if it neither overshoots nor lets a green after it overshoot the target's own green.`;
  }
  const bd = BOUNDS[state.mode];
  $("phases").textContent = `${say} Hops ${bd.hops}, work ${bd.work}.`;
  $("bounds").tBodies[0].innerHTML = Object.keys(SEEKS)
    .map((m) => `<tr data-pick="${m}" class="${m === state.mode ? "on" : ""}"><td>${LABEL[m]}</td><td>${BOUNDS[m].hops}</td><td>${BOUNDS[m].work}</td><td class="dim">${BOUNDS[m].basis}</td></tr>`)
    .join("");

  $("cons-title").textContent = `How push built the head, node ${state.n}`;
  $("cons").innerHTML = cons(state.n)
    .map((row, k) => `<tr data-row="${k}"><td><b class="k-${row.field}">${NAMES[row.field]}</b></td><td><code>${row.field} := ${row.expr}</code></td><td>${row.to ? `→ ${row.to}` : "—"}</td><td class="dim">${row.chain.length > 1 ? row.chain.join(" → ") : ""}</td></tr>`)
    .join("");

  for (const b of document.querySelectorAll("[data-mode]")) b.setAttribute("aria-pressed", b.dataset.mode === state.mode);
  for (const b of document.querySelectorAll("[data-view]")) b.setAttribute("aria-pressed", b.dataset.view === state.view);
  $("yellow").setAttribute("aria-pressed", state.yellow || RIDES_YELLOW.includes(state.mode));
  $("yellow").disabled = state.mode !== "rainbow";
  $("pop").disabled = state.n <= 2;
  $("push").disabled = state.n >= MAX_N;
}

function drawChart() {
  const svg = $("chart");
  const H = 240;
  const pad = { l: 40, r: 12, t: 12, b: 28 };
  const n = state.n;
  const series = Object.fromEntries(["rainbow", "greedy", "green", "planned", "optimal"].map((m) => [m, Array.from({ length: n }, (_, i) => SEEKS[m](n, n - i).length)]));
  const top = Math.max(4, ...series.green);
  const sx = (i) => pad.l + (i / Math.max(1, n - 1)) * (W - pad.l - pad.r);
  const sy = (v) => H - pad.b - (v / top) * (H - pad.t - pad.b);
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  svg.replaceChildren();
  el("clipPath", { id: "plot" }, el("defs", {}, svg)).append(el("rect", { x: pad.l, y: pad.t, width: W - pad.l - pad.r, height: H - pad.t - pad.b }));
  for (let v = 0; v <= top; v += top > 20 ? 5 : 2) {
    el("line", { x1: pad.l, x2: W - pad.r, y1: sy(v), y2: sy(v), stroke: "rgb(244 241 228 / 10%)" }, svg);
    el("text", { x: pad.l - 6, y: sy(v) + 4, "text-anchor": "end" }, svg).textContent = v;
  }
  for (const t of ticks(n - 1)) el("text", { x: sx(t), y: H - 8, "text-anchor": "middle" }, svg).textContent = t;
  const plot = el("g", { "clip-path": "url(#plot)", fill: "none" }, svg);
  const line = (vals, color, w, extra = {}) => el("path", { d: vals.map((v, i) => `${i ? "L" : "M"}${sx(i).toFixed(1)},${sy(v).toFixed(1)}`).join(""), stroke: color, "stroke-width": w, "stroke-linejoin": "round", ...extra }, plot);
  line(Array.from({ length: n }, (_, i) => i), COLOR.n, state.mode === "next" ? 3 : 1.5, { "stroke-dasharray": "4 4" });
  line(series.green, COLOR.g, state.mode === "green" ? 3 : 1.5);
  line(series.rainbow, "var(--accent)", state.mode === "rainbow" ? 3 : 1.5);
  line(series.greedy, "var(--greedy)", state.mode === "greedy" ? 3 : 1.5);
  line(series.planned, "var(--planned)", state.mode === "planned" ? 3 : 1.5);
  line(series.optimal, "var(--optimal)", state.mode === "optimal" ? 3 : 1.5, { "stroke-dasharray": "6 3" });
  line(Array.from({ length: n }, (_, i) => Math.log2(i + 1)), "rgb(244 241 228 / 45%)", 1, { "stroke-dasharray": "1 4" });
  el("line", { x1: sx(state.i), x2: sx(state.i), y1: pad.t, y2: H - pad.b, stroke: "var(--accent)", opacity: 0.6 }, svg);
  const v = SEEKS[state.mode](n, target()).length;
  el("circle", { cx: sx(state.i), cy: sy(Math.min(v, top)), r: 5, fill: "var(--accent)" }, svg);
  svg.onclick = (e) => {
    const p = toLocal(svg, e);
    setIndex(Math.round(((p.x - pad.l) / (W - pad.l - pad.r)) * (n - 1)));
  };
  const best = Math.max(...series.rainbow);
  const worstGreen = Math.max(...series.green);
  const mean = (vals) => (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1);
  $("legend").innerHTML = `<span style="color:var(--accent)">━ rainbow (worst ${best}, mean ${mean(series.rainbow)})</span><span style="color:var(--greedy)">━ greedy (worst ${Math.max(...series.greedy)}, mean ${mean(series.greedy)})</span><span style="color:var(--planned)">━ planned (worst ${Math.max(...series.planned)}, mean ${mean(series.planned)})</span><span style="color:var(--optimal)">╍ optimal (worst ${Math.max(...series.optimal)}, mean ${mean(series.optimal)})</span><span class="k-g">━ green alone (worst ${worstGreen})</span><span class="k-n">┅ plain list (i)</span><span class="dim">┈ log<sub>2</sub>(i + 1)</span>`;
}

function toLocal(svg, e) {
  const pt = svg.createSVGPoint();
  pt.x = e.clientX;
  pt.y = e.clientY;
  return pt.matrixTransform(svg.getScreenCTM().inverse());
}

function draw() {
  $("length").value = state.n;
  $("index").max = state.n - 1;
  $("index").value = state.i;
  drawFigure();
  drawText();
  drawChart();
  writeHash();
}

// ---- changes ----

function stop() {
  anim = null;
}

function setIndex(i) {
  stop();
  state.i = Math.min(state.n - 1, Math.max(0, i));
  draw();
}

function setLength(n, pushed = false) {
  stop();
  n = Math.min(MAX_N, Math.max(2, n));
  // keep the same node in view as the list grows or shrinks, while it exists
  const j = target();
  state.n = n;
  state.i = Math.min(n - 1, Math.max(0, n - j));
  flash = pushed ? Date.now() + 1400 : 0;
  draw();
  if (pushed) setTimeout(drawFigure, 1450);
}

function seekNow() {
  const path = SEEKS[state.mode](state.n, target());
  if (!path.length) return;
  const per = Math.min(450, Math.max(70, 3500 / path.length));
  anim = { path, k: 0, t: 0, t0: performance.now(), per };
  drawText();
  const frame = (now) => {
    if (!anim || anim.path !== path) return;
    const s = (now - anim.t0) / per;
    const k = Math.floor(s);
    if (k >= path.length) {
      anim = { path, k: path.length, t: 0, t0: anim.t0, per };
      placeFrog();
      setTimeout(() => {
        if (anim?.path === path) {
          anim = null;
          drawText();
          placeFrog();
        }
      }, 900);
      return;
    }
    const changed = k !== anim.k;
    anim.k = k;
    anim.t = s - k;
    placeFrog();
    if (changed) drawText();
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

// ---- input ----

$("length").oninput = (e) => setLength(+e.target.value);
$("index").oninput = (e) => setIndex(+e.target.value);
$("push").onclick = () => setLength(state.n + 1, true);
$("pop").onclick = () => setLength(state.n - 1);
$("left").onclick = () => setIndex(state.i + 1);
$("right").onclick = () => setIndex(state.i - 1);
$("hop").onclick = seekNow;
$("yellow").onclick = () => {
  state.yellow = !state.yellow;
  draw();
};
for (const b of document.querySelectorAll("[data-mode]")) {
  b.onclick = () => {
    stop();
    state.mode = b.dataset.mode;
    draw();
  };
}
$("bounds").onclick = (e) => {
  const tr = e.target.closest("tr[data-pick]");
  if (!tr) return;
  stop();
  state.mode = tr.dataset.pick;
  draw();
};
for (const b of document.querySelectorAll("[data-view]")) {
  b.onclick = () => {
    state.view = b.dataset.view;
    draw();
  };
}

const fig = $("fig");
const nearest = (e) => {
  const p = toLocal(fig, e);
  const sx = (W - PAD.left - PAD.right) / state.n;
  return Math.min(state.n, Math.max(1, Math.round((p.x - PAD.left) / sx)));
};
fig.onpointermove = (e) => {
  if (e.pointerType === "touch") return;
  const node = nearest(e);
  if (hover?.node === node) return;
  hover = { node };
  drawFigure();
  drawText();
};
fig.onpointerleave = () => {
  hover = null;
  drawFigure();
  drawText();
};
fig.onclick = (e) => setIndex(state.n - nearest(e));

$("cons").onpointerover = (e) => {
  const tr = e.target.closest("tr");
  if (!tr) return;
  hover = { row: cons(state.n)[+tr.dataset.row] };
  drawFigure();
};
$("cons").onpointerleave = () => {
  hover = null;
  drawFigure();
};

addEventListener("keydown", (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.target instanceof HTMLInputElement) {
    if (e.key === "Enter") e.target.blur();
    else return;
  }
  const keys = {
    ArrowLeft: () => setIndex(state.i + 1),
    ArrowRight: () => setIndex(state.i - 1),
    ArrowUp: () => setLength(state.n + 1, true),
    ArrowDown: () => setLength(state.n - 1),
    Enter: seekNow,
    1: () => document.querySelector('[data-mode="next"]').click(),
    2: () => document.querySelector('[data-mode="green"]').click(),
    3: () => document.querySelector('[data-mode="rainbow"]').click(),
    4: () => document.querySelector('[data-mode="greedy"]').click(),
    5: () => document.querySelector('[data-mode="planned"]').click(),
    6: () => document.querySelector('[data-mode="optimal"]').click(),
    t: () => document.querySelector(`[data-view="${state.view === "arcs" ? "tree" : "arcs"}"]`).click(),
    y: () => state.mode === "rainbow" && $("yellow").click(),
  };
  const go = keys[e.key.length === 1 ? e.key.toLowerCase() : e.key];
  if (!go) return;
  if (e.key === "Enter" && e.target instanceof HTMLButtonElement) return; // the button's own click
  e.preventDefault();
  go();
});

addEventListener("hashchange", () => {
  readHash();
  draw();
});

readHash();
draw();
