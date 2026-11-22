// The page: pick an ordinal x and follow it from Cantor normal form to its
// tick, step by step as the post does for ω+3; a ruler of every small ordinal
// to pan and zoom; x's fundamental sequence closing in on it (or not, with
// every paren); and a function plotted on the ruler on both axes.
import { add, cmp, expanded, FUNCTIONS, fund, html, isLimit, isNat, mul, nat, ONE, parens, parse, pow, real, runs, show, size, stretch, term, upTo, W, ZERO } from "./ordinals.js";

const $ = (id) => document.getElementById(id);
const MAX_NODES = 400; // past this the steps can't be drawn, and x refuses
const FIT = { a: -1.18, b: 3.22 }; // 0 to just past ω^ω^ω
const PRESETS = ["3", "w", "w+3", "w*2", "w^2", "w^w", "w^(w+1)+w*2", "w^w^w"];
const TOWER = [ONE];
for (let k = 1; k < 8; k++) TOWER.push(pow(W, TOWER[k - 1]));

const state = { x: parse("w+3"), naive: false, r: 0.5, f: "x*x" };
let view = { ...FIT };

// ---- where ticks go, with every ordinal's parens worked out once ----

const strings = new Map(); // id -> [up, naive]
function parenStrings(x) {
  let s = strings.get(x.id);
  if (!s) {
    const ps = parens(x);
    s = [ps.filter((p) => p.keep).map((p) => p.c).join(""), ps.map((p) => p.c).join("")];
    strings.set(x.id, s);
  }
  return s;
}
const tickWith = (x, { naive, r }) => stretch(real(parenStrings(x)[naive ? 1 : 0], r), r) - 1;

// Settings tween: when the parens or r change, every tick slides to its new place.
let from = { naive: state.naive, r: state.r };
let tween = null; // { t0, ms }
const ease = (u) => (u < 0.5 ? 2 * u * u : 1 - (-2 * u + 2) ** 2 / 2);
function mix() {
  if (!tween) return 1;
  const u = Math.min(1, (performance.now() - tween.t0) / tween.ms);
  if (u >= 1) tween = null;
  return ease(u);
}
let m = 1; // this frame's mix, from `from` to the state's settings
function at(x) {
  const to = tickWith(x, state);
  return m >= 1 ? to : tickWith(x, from) + (to - tickWith(x, from)) * m;
}

// Every ordinal of up to 12 nodes: 20,299 of them, in order.
const towerIds = new Set(TOWER.map((t) => t.id));
const POOL = upTo(12);
const RANK = POOL.map(rank);
const BY_RANK = POOL.map((_, i) => i).sort((i, j) => RANK[i] - RANK[j] || i - j);

/** How prominent x's tick is: towers first, then fewer nodes, limits before successors. */
function rank(x) {
  if (towerIds.has(x.id)) return 0;
  return x === ZERO ? 2 : size(x) + (isLimit(x) ? 0 : 1);
}

// ---- state <-> URL ----

function readHash() {
  const q = new URLSearchParams(location.hash.slice(1));
  try {
    // a hand-typed + arrives as a space, and a space between terms means nothing else
    if (q.get("x")) state.x = guard(parse(q.get("x").trim().replace(/\s+/g, "+")));
  } catch {
    /* keep x */
  }
  if (q.has("p")) state.naive = q.get("p") === "bp";
  const r = parseFloat(q.get("r"));
  if (r >= 0.5 && r <= 0.75) state.r = r;
  if (FUNCTIONS[q.get("f")]) state.f = q.get("f");
  const [a, b] = (q.get("v") ?? "").split(",").map(Number);
  if (a < b) view = clampView({ a, b: Math.min(b, a + 8) });
  from = { naive: state.naive, r: state.r };
}

function writeHash() {
  const q = new URLSearchParams({ x: show(state.x), p: state.naive ? "bp" : "up", r: String(state.r), f: state.f });
  if (view.a !== FIT.a || view.b !== FIT.b) q.set("v", `${+view.a.toPrecision(8)},${+view.b.toPrecision(8)}`);
  history.replaceState(null, "", `#${q}`);
}

function guard(x) {
  const n = size(x);
  if (n > MAX_NODES) throw new SyntaxError(`that's ${n} nodes; this page draws up to ${MAX_NODES}`);
  return x;
}

// ---- drawing helpers ----

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => `&${{ "&": "amp", "<": "lt", ">": "gt", '"': "quot" }[c]};`);
const SIZES = [1, 0.7, 0.58, 0.5, 0.5, 0.5];
const LIFT = [0, 0.42, 0.7, 0.9, 1.05, 1.2];

/** x as SVG text, raised exponents and all, centered on (px, py). */
function svgOrd(x, px, py, px0, cls = "", anchor = "middle") {
  let out = `<text x="${px.toFixed(1)}" y="${py.toFixed(1)}" text-anchor="${anchor}" class="${cls}" style="font-size:${px0}px">`;
  let level = 0;
  for (const run of runs(x)) {
    const dy = (LIFT[level] - LIFT[run.level]) * px0;
    out += `<tspan dy="${dy.toFixed(2)}" style="font-size:${(SIZES[run.level] * px0).toFixed(1)}px">${esc(run.text)}</tspan>`;
    level = run.level;
  }
  return `${out}</text>`;
}

function ordWidth(x, px0) {
  return runs(x).reduce((w, r) => w + r.text.length * SIZES[r.level] * px0 * 0.6, 0);
}

const fmt = (v, d = 5) => (Number.isFinite(v) ? v.toFixed(d) : "∞");

// ---- Phibber, the frog from Rainbow Lists, who hops to each new x ----

const FROG =
  '<ellipse cx="0" cy="-2" rx="9" ry="7" fill="#6fcf5b" stroke="#000" stroke-width="1.5"/>' +
  [-4.5, 4.5].map((ex) => `<circle cx="${ex}" cy="-9" r="3.2" fill="#fff" stroke="#000" stroke-width="1.2"/><circle cx="${ex}" cy="-9" r="1.4" fill="#000"/>`).join("");
const HOP = 320; // ms, a route's first hop; a fundamental sequence's hops quicken
let hop = null; // { legs: [{ to, label, ms }], from: t, t0 }

/**
 * Phibber's way to x: up its fundamental sequence x[1], x[2], … if it's a
 * limit, closing in until the hops are too small to see, then onto x; or, if
 * it's a successor λ+n, counting up from the limit λ below. If he's already
 * partway along (x was below it on the way), he goes on from there.
 */
function routeTo(x, from) {
  const stops = []; // [ordinal, label]
  if (isLimit(x)) {
    const close = (view.b - view.a) * 0.003;
    for (let k = 1; k <= 16; k++) {
      const y = fund(x, k);
      if (Math.abs(at(x) - at(y)) < close) break;
      stops.push([y, `<var>x</var>[${k}]`]);
    }
  } else if (x !== ZERO) {
    const n = x.terms.at(-1)[1];
    const lim = x.terms.slice(0, -1).reduce((sum, [e, k]) => add(sum, term(e, k)), ZERO);
    stops.push([lim, lim === ZERO ? "" : "the limit below"]);
    for (let j = Math.max(1, n - 8); j < n; j++) stops.push([add(lim, nat(j)), ""]);
  }
  const ahead = cmp(from, x) < 0 ? stops.filter(([y]) => cmp(y, from) > 0) : stops;
  const legs = [...ahead, [x, "<var>x</var>"]].map(([to, label], i) => ({ to, label, ms: isLimit(x) ? Math.max(110, HOP * 0.85 ** i) : HOP * 0.8 }));
  legs[0].ms = HOP * 1.3;
  return legs;
}

/** Where Phibber is along the ruler, in t, how far through this hop, and which hop. */
function frogAt() {
  if (!hop) return { t: at(state.x), u: 1, i: -1 };
  let ms = performance.now() - hop.t0;
  let from = hop.from;
  for (let i = 0; i < hop.legs.length; i++) {
    const leg = hop.legs[i];
    const to = at(leg.to);
    if (ms < leg.ms || i === hop.legs.length - 1) {
      const u = Math.min(1, Math.max(0, ms / leg.ms));
      return { t: from + (to - from) * ease(u), u, i, from, to };
    }
    ms -= leg.ms;
    from = to;
  }
}

function hopTo(x) {
  if (x === state.x || matchMedia("(prefers-reduced-motion: reduce)").matches) return (hop = null);
  hop = { legs: routeTo(x, state.x), from: frogAt().t, t0: performance.now() };
}

// ---- the ruler ----

const ruler = $("ruler");
let drawn = []; // [{ x, px }] ticks on screen, for picking
let hover = null;

function rulerSize() {
  const w = ruler.clientWidth || 800;
  return { w, h: w < 560 ? 150 : 170, pad: 14 };
}

function drawRuler() {
  const { w, h, pad } = rulerSize();
  ruler.setAttribute("viewBox", `0 0 ${w} ${h}`);
  ruler.setAttribute("height", h);
  const base = h - 46;
  const X = (t) => pad + ((t - view.a) / (view.b - view.a)) * (w - 2 * pad);
  const taken = new Uint8Array(Math.ceil(w / 2) + 2);
  const boxes = [];
  let ticks = "";
  let labels = "";
  drawn = [];
  const fontPx = w < 560 ? 12 : 13;
  for (const i of BY_RANK) {
    const x = POOL[i];
    const t = at(x);
    if (t < view.a - 0.01 * (view.b - view.a) || t > view.b) continue;
    const px = X(t);
    const col = Math.round(px / 2);
    if (taken[col] && RANK[i] > 0) continue;
    taken[col] = 1;
    const tall = RANK[i] === 0 ? 70 : Math.max(5, 56 * 0.8 ** RANK[i]);
    const hi = hover === x;
    ticks += `<line x1="${px.toFixed(1)}" x2="${px.toFixed(1)}" y1="${base}" y2="${(base - tall).toFixed(1)}" class="tk${RANK[i] === 0 ? " tower" : ""}${hi ? " hi" : ""}" style="opacity:${Math.max(0.35, 1 - RANK[i] * 0.07).toFixed(2)}"/>`;
    drawn.push({ x, px });
    if (drawn.length > 900) break;
    // a label, if it fits where nothing else is
    const lw = ordWidth(x, fontPx);
    const ly = base - tall - 6;
    const box = [px - lw / 2 - 3, ly - fontPx - 4, px + lw / 2 + 3, ly + 3];
    if (box[0] < 0 || box[2] > w) continue;
    if (boxes.some((b) => b[0] < box[2] && box[0] < b[2] && b[1] < box[3] && box[1] < b[3])) continue;
    boxes.push(box);
    labels += svgOrd(x, px, ly, fontPx, RANK[i] === 0 ? "lab tower" : "lab");
  }
  // x's fundamental sequence, as beads on the line
  let beads = "";
  if (isLimit(state.x)) {
    for (let k = 1; k <= 24; k++) {
      const px = X(at(fund(state.x, k)));
      if (px < 0 || px > w) continue;
      beads += `<circle cx="${px.toFixed(1)}" cy="${base}" r="${Math.max(1.6, 4.2 - k * 0.12).toFixed(1)}" class="bead"/>`;
    }
  }
  // x itself, always labeled, under the line
  const tx = at(state.x);
  const sx = X(tx);
  let mark = "";
  if (sx >= 0 && sx <= w) {
    mark = `<line x1="${sx}" x2="${sx}" y1="${base + 2}" y2="12" class="xline"/><path d="M${sx} ${base + 4} l-6 9 h12 z" class="xmark"/>`;
    const lw = ordWidth(state.x, 15);
    const lx = Math.min(w - lw / 2 - 4, Math.max(lw / 2 + 4, sx));
    mark += svgOrd(state.x, lx, base + 32, 15, "xlab");
  } else {
    const left = sx < 0;
    mark = `<text x="${left ? 6 : w - 6}" y="${base + 32}" text-anchor="${left ? "start" : "end"}" class="xlab">${left ? "◂ x" : "x ▸"}</text>`;
  }
  // Phibber, on x or on his way there
  let frog = "";
  const f = frogAt();
  const leg = hop?.legs[f.i];
  if (hop && f.u >= 1 && f.i === hop.legs.length - 1) hop = null;
  const fx = X(f.t);
  if (fx >= -10 && fx <= w + 10) {
    const span = f.i >= 0 ? Math.abs(X(f.to) - X(f.from)) : 0;
    const lift = Math.sin(f.u * Math.PI) * Math.min(base - 24, 12 + span * 0.3);
    frog = `<g class="frog" transform="translate(${fx.toFixed(1)},${(base - 5 - lift).toFixed(1)})">${FROG}</g>`;
  }
  ruler.innerHTML = `<line x1="0" x2="${w}" y1="${base}" y2="${base}" class="axis"/>${ticks}${beads}${labels}${mark}${frog}`;
  const span = view.b - view.a;
  const z = (FIT.b - FIT.a) / span;
  const d = span < 0.01 ? 6 : span < 0.5 ? 4 : 2;
  $("readout").innerHTML = hover
    ? `<b>${html(hover)}</b> at <var>t</var> = ${fmt(at(hover))} <span class="dim">· click to pick it</span>`
    : hop && leg && f.i < hop.legs.length - 1
      ? `Phibber hops to ${leg.label ? `${leg.label} = ` : ""}<b>${html(leg.to)}</b> at <var>t</var> = ${fmt(at(leg.to))} <span class="dim">· on his way to <var>x</var> = ${html(state.x)}${isLimit(state.x) ? ", up its fundamental sequence" : ", counting up"}</span>`
      : `<b class="acc">${html(state.x)}</b> at <var>t</var> = ${fmt(tx)} <span class="dim">· the ruler shows <var>t</var> from ${fmt(view.a, d)} to ${fmt(view.b, d)}${z > 1.05 ? `, zoomed ×${z < 10 ? z.toFixed(1) : Math.round(z)}` : ""}</span>`;
}

// pan and zoom: drag, wheel, pinch, buttons
const pointers = new Map();
let drag = null;
const tAtPx = (px) => {
  const { w, pad } = rulerSize();
  return view.a + ((px - pad) / (w - 2 * pad)) * (view.b - view.a);
};
const localX = (e) => e.clientX - ruler.getBoundingClientRect().left;

function zoomAround(t, k) {
  let span = (view.b - view.a) * k;
  span = Math.min(8, Math.max(1e-9, span));
  const u = (t - view.a) / (view.b - view.a);
  view = clampView({ a: t - u * span, b: t - u * span + span });
}

function clampView(v) {
  const span = v.b - v.a;
  const lo = FIT.a - 0.3;
  const hi = 9;
  if (v.a < lo) return { a: lo, b: lo + span };
  if (v.b > hi) return { a: hi - span, b: hi };
  return v;
}

let viewTween = null;
function goView(target, ms = 380) {
  viewTween = { from: { ...view }, to: clampView(target), t0: performance.now(), ms };
  kick();
}

ruler.addEventListener("pointerdown", (e) => {
  ruler.setPointerCapture(e.pointerId);
  pointers.set(e.pointerId, localX(e));
  drag = { moved: 0, x: localX(e) };
  viewTween = null;
});
ruler.addEventListener("pointermove", (e) => {
  const px = localX(e);
  if (pointers.has(e.pointerId)) {
    const old = pointers.get(e.pointerId);
    if (pointers.size === 2) {
      const [p, q] = [...pointers.values()];
      const other = old === p ? q : p;
      const before = Math.abs(old - other);
      const after = Math.abs(px - other);
      if (before > 8 && after > 8) zoomAround(tAtPx((px + other) / 2), before / after);
    } else {
      const { w, pad } = rulerSize();
      const dt = ((px - old) / (w - 2 * pad)) * (view.b - view.a);
      view = clampView({ a: view.a - dt, b: view.b - dt });
    }
    pointers.set(e.pointerId, px);
    if (drag) drag.moved += Math.abs(px - old);
    hover = null;
    kick();
    return;
  }
  const near = nearest(px);
  if (near !== hover) {
    hover = near;
    kick();
  }
});
function release(e) {
  if (!pointers.has(e.pointerId)) return;
  pointers.delete(e.pointerId);
  if (drag && drag.moved < 5 && pointers.size === 0 && e.type === "pointerup") {
    const near = nearest(localX(e), 16);
    if (near) pick(near);
  }
  if (pointers.size === 0) drag = null;
}
ruler.addEventListener("pointerup", release);
ruler.addEventListener("pointercancel", release);
ruler.addEventListener("pointerleave", () => {
  if (hover && !pointers.size) {
    hover = null;
    kick();
  }
});
ruler.addEventListener(
  "wheel",
  (e) => {
    e.preventDefault();
    const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
    if (Math.abs(e.deltaX) > Math.abs(dy)) {
      const { w } = rulerSize();
      const dt = (e.deltaX / w) * (view.b - view.a);
      view = clampView({ a: view.a + dt, b: view.b + dt });
    } else zoomAround(tAtPx(localX(e)), Math.exp(dy * 0.0016));
    kick();
  },
  { passive: false },
);
ruler.addEventListener("dblclick", (e) => {
  const t = tAtPx(localX(e));
  const span = (view.b - view.a) / 3;
  goView({ a: t - span / 2, b: t + span / 2 });
});

function nearest(px, within = 10) {
  let best = null;
  let d = within;
  for (const { x, px: q } of drawn) {
    if (Math.abs(q - px) < d) {
      d = Math.abs(q - px);
      best = x;
    }
  }
  return best;
}

function zoomIn() {
  const t = tickWith(state.x, state);
  const span = (view.b - view.a) / 3;
  const c = t >= view.a && t <= view.b ? t : (view.a + view.b) / 2;
  goView({ a: c - span / 2, b: c + span / 2 });
}
function zoomOut() {
  const c = (view.a + view.b) / 2;
  const span = Math.min(8, (view.b - view.a) * 3);
  goView({ a: c - span / 2, b: c + span / 2 });
}
$("zoom-in").onclick = zoomIn;
$("zoom-out").onclick = zoomOut;
$("zoom-fit").onclick = () => goView(FIT);

// ---- the steps ----

let hoverNode = null;

function drawSteps() {
  const x = state.x;
  const xs = html(x);
  $("steps-x").innerHTML = xs;
  $("cnf").innerHTML = `<var>x</var> = ${xs}`;
  const long = expanded(x);
  $("cnf-long").textContent = long.length > 160 ? `${long.slice(0, 160)}…` : long === "0" ? "0, the empty sum" : `= ${long}`;
  drawTree(x);
  const ps = parens(x);
  const shown = ps.slice(0, 260);
  const drop = ps.filter((p) => !p.keep).length;
  $("parens").innerHTML =
    shown
      .map((p, i) => {
        const gone = !p.keep && !state.naive;
        return `<span data-node="${p.node}" data-i="${i}" class="p${gone ? " gone" : ""}${!p.keep ? " redundant" : ""}">${p.c === "(" ? "\\" : "/"}</span>`;
      })
      .join("") + (ps.length > shown.length ? `<span class="dim"> … ${ps.length - shown.length} more</span>` : "") || `<span class="dim">nothing: 0 has no nodes</span>`;
  $("parens-note").innerHTML = state.naive
    ? `Each node is a \\ then the nodes on it then a /, as the post writes ( and ) “to protect our eyes”. This is BP(<var>x</var>), the post's first try.${drop ? ` ${drop} of these / are redundant: <button class="link" data-naive="0">leave them out</button>.` : ""}`
    : drop
      ? `UP(<var>x</var>): BP(<var>x</var>) with the ${drop} struck-out / left out. Each is redundant: a \\ in its place could only spell an ordinal out of normal form (like 1+ω), so the / says nothing.`
      : `UP(<var>x</var>): no / here is redundant, so it's the same as BP(<var>x</var>).`;
  const [us, bs] = parenStrings(x).map((p) => (p.length > 120 ? `${p.slice(0, 120)}…` : p).replace(/\(/g, "\\").replace(/\)/g, "/"));
  $("parens-strings").innerHTML = `BP(<var>x</var>) = <span class="${state.naive ? "acc" : ""}">${bs || "ε"}</span><br>UP(<var>x</var>) = <span class="${state.naive ? "" : "acc"}">${us || "ε"}</span>`;
  const s = parenStrings(x)[state.naive ? 1 : 0];
  const bits = [...s].map((c) => (c === "(" ? "1" : "0")).join("");
  $("bits").textContent = `0.${bits.length > 200 ? `${bits.slice(0, 200)}…` : bits || "0"}`;
  $("bits-note").innerHTML =
    state.r === 0.5
      ? "Each \\ is a 1 and each / a 0, after “0.”"
      : `Each \\ is a 1 and each / a 0, after “0.”, but a digit weighs what's left times <var>r</var> = ${state.r.toFixed(3)} after a 1 and 1 − <var>r</var> after a 0, rather than ½ each.`;
  const v = real(s, state.r);
  const digits = Math.min(15, Math.max(5, Math.ceil(-Math.log10(1 - v)) + 4));
  $("real").innerHTML = `≈ ${v.toFixed(digits)}`;
  const sv = stretch(v, state.r);
  const log = state.r === 0.5 ? "−log<sub>2</sub>" : `log<sub>${state.r.toFixed(3)}</sub>`;
  $("stretch").innerHTML = `<var>s</var> = ${log}(1 − ${v.toFixed(Math.min(digits, 7))}) ≈ ${fmt(sv)}<br><var>t</var> = <var>s</var> − 1 ≈ <b class="acc">${fmt(sv - 1)}</b>`;
  $("stretch-note").innerHTML =
    "Stretching [0, 1) to [0, ∞) puts 1 at <var>s</var> = 1, ω at 2, ω<sup>ω</sup> at 3, … (desideratum 3), and ε<sub>0</sub> at ∞. The ruler marks <var>t</var> = <var>s</var> − 1, as the post's Python does, so ω is at 1 and 0 at −1.";
}

function drawTree(x) {
  const svg = $("tree");
  const n = size(x);
  if (n > 160) {
    svg.setAttribute("viewBox", "0 0 300 40");
    svg.innerHTML = `<text x="150" y="25" text-anchor="middle" class="lab">${n} nodes: too many to draw</text>`;
    return;
  }
  // nodes in preorder (ids as parens() numbers them), each with its children
  const nodes = [{ id: 0, kids: [], depth: 0, e: x }];
  let next = 1;
  const grow = (parent, e) => {
    for (const [f, k] of e.terms) {
      for (let j = 0; j < k; j++) {
        const node = { id: next++, kids: [], depth: parent.depth + 1, e: f };
        nodes.push(node);
        parent.kids.push(node);
        grow(node, f);
      }
    }
  };
  grow(nodes[0], x);
  const leaves = (node) => (node.leaves = node.kids.length ? node.kids.reduce((s, k) => s + leaves(k), 0) : 1);
  leaves(nodes[0]);
  const depth = Math.max(...nodes.map((d) => d.depth));
  const w = Math.max(220, Math.min(560, nodes[0].leaves * 34));
  const step = Math.min(56, Math.max(30, 220 / Math.max(1, depth)));
  const h = depth * step + 34;
  const rad = Math.max(3.5, Math.min(10, (w / nodes[0].leaves) * 0.3));
  const place = (node, x0, x1) => {
    node.px = (x0 + x1) / 2;
    node.py = h - 17 - node.depth * step;
    let at = x0;
    for (const k of node.kids) {
      const span = ((x1 - x0) * k.leaves) / node.leaves;
      place(k, at, at + span);
      at += span;
    }
  };
  place(nodes[0], 6, w - 6);
  svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
  let lines = "";
  let dots = "";
  for (const node of nodes) {
    for (const k of node.kids) lines += `<line x1="${node.px.toFixed(1)}" y1="${node.py}" x2="${k.px.toFixed(1)}" y2="${k.py}" class="edge"/>`;
    const title = node.id === 0 ? `x = ${show(x)}` : `ω^${show(node.e)}${node.e.terms.length ? ` = ω^(${node.kids.length} node${node.kids.length === 1 ? "" : "s"} on it)` : " = 1"}`;
    dots += `<circle data-node="${node.id}" cx="${node.px.toFixed(1)}" cy="${node.py}" r="${node.id === 0 ? rad + 2 : rad}" class="node d${Math.min(node.depth, 5)}${hoverNode === node.id ? " hi" : ""}"><title>${esc(title)}</title></circle>`;
  }
  svg.innerHTML = lines + dots;
}

// paren <-> node highlight
function highlight(node) {
  hoverNode = node;
  for (const el of document.querySelectorAll("#parens .p, #tree .node")) el.classList.toggle("hi", node !== null && el.dataset.node === String(node));
}
for (const id of ["parens", "tree"]) {
  $(id).addEventListener("pointerover", (e) => {
    const el = e.target.closest("[data-node]");
    highlight(el ? Number(el.dataset.node) : null);
  });
  $(id).addEventListener("pointerleave", () => highlight(null));
}

// ---- the fundamental sequence ----

/** The limit at or just below x (x without its finite tail), or ω below ω. */
function limitOf(x) {
  if (isLimit(x)) return x;
  const terms = x.terms.slice(0, -1);
  return terms.length ? terms.reduce((sum, [e, n]) => add(sum, term(e, n)), ZERO) : W;
}

function drawSeq() {
  const x = limitOf(state.x);
  const svg = $("seq-ruler");
  const table = $("seq");
  $("seq-x").innerHTML = html(x);
  const why =
    x === state.x
      ? ""
      : `${html(state.x)} is ${state.x === ZERO ? "0" : "a successor"}, so nothing closes in on it; here is ${isNat(state.x) ? "the first limit," : "the limit just below it,"} <button class="link" data-x="${esc(show(x))}">${html(x)}</button>. `;
  $("seq-note").innerHTML =
    why +
    "A limit is where its fundamental sequence <var>x</var>[1] &lt; <var>x</var>[2] &lt; … goes. With every paren the ticks stall short of the limit's, leaving room for sums out of normal form like 1+ω; without the redundant ones they close in (desideratum 2).";
  const ks = [1, 2, 3, 4, 5, 6, 10, 20];
  const both = (y) => [tickWith(y, { naive: false, r: state.r }), tickWith(y, { naive: true, r: state.r })];
  const [ux, bx] = both(x);
  const row = (label, y) => {
    const [u, b] = both(y);
    return `<tr><td>${label}</td><td class="o">${html(y)}</td><td>${fmt(u, 4)}</td><td>${fmt(b, 4)}</td></tr>`;
  };
  table.innerHTML =
    `<thead><tr><th></th><th></th><th>Unbalanced</th><th>Balanced</th></tr></thead><tbody>` +
    ks.map((k) => row(`<var>x</var>[${k}]`, fund(x, k))).join("") +
    `<tr class="lim"><td><var>x</var></td><td class="o acc">${html(x)}</td><td>${fmt(ux, 4)}</td><td>${fmt(bx, 4)}</td></tr></tbody>`;
  // two little rulers, the sequence closing in (or not)
  const w = 520;
  const h = 96;
  const lo = Math.min(tickWith(fund(x, 1), { naive: true, r: state.r }), tickWith(fund(x, 1), state));
  const hi = Math.max(ux, bx);
  const pad = 22;
  const X = (t) => pad + ((t - lo) / (hi - lo || 1)) * (w - 2 * pad);
  let out = "";
  [
    ["Unbalanced", false, 30],
    ["Balanced", true, 74],
  ].forEach(([name, naive, y]) => {
    const tx = naive ? bx : ux;
    out += `<line x1="${pad}" x2="${w - pad}" y1="${y}" y2="${y}" class="axis"/><text x="${pad}" y="${y - 12}" class="lab small">${name}</text>`;
    let last = 0;
    for (let k = 1; k <= 60; k++) {
      const t = tickWith(fund(x, k), { naive, r: state.r });
      last = t;
      out += `<circle cx="${X(t).toFixed(1)}" cy="${y}" r="${Math.max(1.4, 4 - k * 0.12).toFixed(1)}" class="bead"/>`;
    }
    out += `<line x1="${X(tx)}" x2="${X(tx)}" y1="${y - 10}" y2="${y + 10}" class="xline solid"/>`;
    if (tx - last > (hi - lo) * 0.02) {
      out += `<path d="M${X(last) + 3} ${y + 9} h${X(tx) - X(last) - 6}" class="gap"/><text x="${(X(last) + X(tx)) / 2}" y="${y + 21}" text-anchor="middle" class="lab small gaplab">gap of ${fmt(tx - last, 3)}</text>`;
    }
  });
  svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
  svg.innerHTML = out;
}

// ---- the plot ----

const PLOT_X = POOL.filter((x) => size(x) <= 9 && cmp(x, TOWER[3]) <= 0);
const plotCache = new Map();
function plotPairs() {
  let pairs = plotCache.get(state.f);
  if (!pairs) {
    const { f } = FUNCTIONS[state.f];
    pairs = PLOT_X.map((x) => [x, f(x)]).filter(([, y]) => size(y) <= 4000);
    plotCache.set(state.f, pairs);
  }
  return pairs;
}
let plotHover = null;
let plotPts = [];
const plot = $("plot");

function drawPlot() {
  const pairs = plotPairs();
  const S = 520;
  const L = 52;
  const B = 40;
  const T = 12;
  const R = 12;
  const pts = pairs.map(([x, y]) => [x, y, at(x), at(y)]);
  const ymax = Math.max(3.15, ...pts.map((p) => p[3])) + 0.1;
  const X = (t) => L + ((t - FIT.a) / (3.15 - FIT.a)) * (S - L - R);
  const Y = (t) => S - B - ((t - FIT.a) / (ymax - FIT.a)) * (S - B - T);
  let out = "";
  for (let k = -1; k <= Math.floor(ymax); k++) {
    const tick = k < 0 ? ZERO : TOWER[k];
    const tx = k < 0 ? at(ZERO) : at(tick);
    if (k <= 3) out += `<line x1="${X(tx)}" x2="${X(tx)}" y1="${T}" y2="${S - B}" class="grid"/>` + svgOrd(tick, X(tx), S - B + 18, 13, "lab tower");
    out += `<line x1="${L}" x2="${S - R}" y1="${Y(tx)}" y2="${Y(tx)}" class="grid"/>` + svgOrd(tick, L - 8, Y(tx) + 4, 13, "lab tower", "end");
  }
  out += `<line x1="${X(FIT.a)}" y1="${Y(FIT.a)}" x2="${X(Math.min(3.15, ymax))}" y2="${Y(Math.min(3.15, ymax))}" class="diag"/>`;
  out += `<text x="${S - R}" y="${S - 6}" text-anchor="end" class="small"><tspan font-style="italic">x</tspan></text><text x="${L + 6}" y="${T + 10}" class="small"><tspan font-style="italic">f</tspan>(<tspan font-style="italic">x</tspan>)</text>`;
  plotPts = pts.map(([x, y, tx, ty]) => ({ x, y, px: X(tx), py: Y(ty) }));
  for (const p of plotPts) out += `<circle cx="${p.px.toFixed(1)}" cy="${p.py.toFixed(1)}" r="2.1" class="pt"/>`;
  const sel = plotPts.find((p) => p.x === state.x) ?? (cmp(state.x, TOWER[3]) <= 0 ? (() => {
    const y = FUNCTIONS[state.f].f(state.x);
    return size(y) <= 4000 ? { x: state.x, y, px: X(at(state.x)), py: Y(at(y)) } : null;
  })() : null);
  const mark = (p, cls) => `<path d="M${p.px} ${S - B} V${p.py} H${L}" class="${cls}"/><circle cx="${p.px}" cy="${p.py}" r="5" class="${cls}-dot"/>`;
  if (sel) out += mark(sel, "sel");
  if (plotHover && plotHover !== sel) out += mark(plotHover, "hov");
  plot.setAttribute("viewBox", `0 0 ${S} ${S}`);
  plot.innerHTML = out;
  const show2 = plotHover ?? sel;
  let fx = "";
  if (show2) {
    const plain = html(show2.x);
    const bare = show2.x.terms.length <= 1 && (show2.x.terms[0]?.[0] === ZERO || show2.x.terms[0]?.[1] === 1);
    const [body, sup] = FUNCTIONS[state.f].label.split("^");
    fx = body.replaceAll("x", bare ? plain : `(${plain})`) + (sup ? `<sup>${sup.replaceAll("x", plain)}</sup>` : "");
  }
  $("plot-readout").innerHTML = show2
    ? `<var>f</var>(${html(show2.x)}) = ${fx} = <b class="acc">${html(show2.y)}</b>`
    : `${pairs.length} ordinals <var>x</var> up to ω<sup>ω<sup>ω</sup></sup>, each at (<var>t</var>(<var>x</var>), <var>t</var>(<var>f</var>(<var>x</var>))). Hover a point; click to pick it.`;
}

function plotAt(e) {
  const r = plot.getBoundingClientRect();
  const k = 520 / r.width;
  const px = (e.clientX - r.left) * k;
  const py = (e.clientY - r.top) * k;
  let best = null;
  let d = 14;
  for (const p of plotPts) {
    const q = Math.hypot(p.px - px, p.py - py);
    if (q < d) [d, best] = [q, p];
  }
  return best;
}
plot.addEventListener("pointermove", (e) => {
  const p = plotAt(e);
  if (p !== plotHover) {
    plotHover = p;
    drawPlot();
  }
});
plot.addEventListener("pointerleave", () => {
  plotHover = null;
  drawPlot();
});
plot.addEventListener("click", (e) => {
  const p = plotAt(e);
  if (p) pick(p.x);
});

$("fns").innerHTML = Object.entries(FUNCTIONS)
  .map(([k, { label }]) => `<button data-f="${esc(k)}" title="f(x) = ${esc(label)}">${label.replace(/\^(.+)$/, "<sup>$1</sup>")}</button>`)
  .join("");
$("fns").addEventListener("click", (e) => {
  const b = e.target.closest("[data-f]");
  if (!b) return;
  state.f = b.dataset.f;
  plotHover = null;
  update();
});

// ---- picking x ----

function pick(x, { follow = true } = {}) {
  hopTo(x);
  state.x = x;
  $("ord").value = show(x).replace(/\*/g, "·");
  $("ord-error").textContent = "";
  if (follow) {
    const t = tickWith(x, state);
    const span = view.b - view.a;
    if (t < view.a + span * 0.04 || t > view.b - span * 0.04) goView({ a: t - span / 2, b: t + span / 2 });
  }
  update();
}

function stepAlong(dir) {
  // the next or previous ordinal of the ruler's, from x
  let lo = 0;
  let hi = POOL.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (cmp(POOL[mid], state.x) < 0) lo = mid + 1;
    else hi = mid;
  }
  const i = dir > 0 ? (POOL[lo] === state.x ? lo + 1 : lo) : lo - 1;
  if (i >= 0 && i < POOL.length) pick(POOL[i]);
}
$("prev").onclick = () => stepAlong(-1);
$("next").onclick = () => stepAlong(1);

$("pick").addEventListener("submit", (e) => {
  e.preventDefault();
  try {
    pick(guard(parse($("ord").value)));
  } catch (err) {
    $("ord-error").textContent = `Can't read that: ${err.message}.`;
  }
});

document.querySelector(".controls").addEventListener("click", (e) => {
  const b = e.target.closest("[data-op]");
  if (!b) return;
  const op = { succ: (x) => add(x, ONE), times: (x) => mul(x, W), power: (x) => pow(W, x) }[b.dataset.op];
  try {
    pick(guard(op(state.x)));
  } catch (err) {
    $("ord-error").textContent = err.message;
  }
});

$("presets").innerHTML = PRESETS.map((s) => {
  const x = parse(s);
  return `<button class="chip" data-x="${esc(show(x))}" title="x = ${esc(show(x))}">${html(x)}</button>`;
}).join("");
document.addEventListener("click", (e) => {
  const b = e.target.closest("button[data-x]");
  if (b) pick(parse(b.dataset.x));
  const n = e.target.closest("button[data-naive]");
  if (n) setNaive(n.dataset.naive === "1");
});

// ---- settings ----

function settle() {
  from = { naive: state.naive, r: state.r };
}
function setNaive(naive) {
  if (naive === state.naive) return;
  from = currentSettingsSnapshot();
  state.naive = naive;
  tween = { t0: performance.now(), ms: 650 };
  update();
}
// Mid-tween, a new change starts from where the ticks are; the simplest
// honest snapshot is the settings the tween was heading to.
function currentSettingsSnapshot() {
  return tween ? { naive: state.naive, r: state.r } : { ...from };
}

const weight = $("weight");
weight.addEventListener("input", () => {
  settle();
  state.r = Math.abs(+weight.value - 0.618) < 0.004 ? 0.618 : Math.abs(+weight.value - 0.5) < 0.004 ? 0.5 : +(+weight.value).toFixed(3);
  settle();
  update();
});

// ---- the loop ----

let raf = 0;
function kick() {
  if (!raf) raf = requestAnimationFrame(frame);
}
function frame() {
  raf = 0;
  if (viewTween) {
    const u = Math.min(1, (performance.now() - viewTween.t0) / viewTween.ms);
    const e = ease(u);
    view = { a: viewTween.from.a + (viewTween.to.a - viewTween.from.a) * e, b: viewTween.from.b + (viewTween.to.b - viewTween.from.b) * e };
    if (u >= 1) viewTween = null;
  }
  m = mix();
  drawRuler();
  if (tween) drawPlot();
  if (tween || viewTween || hop) kick();
  else if (m >= 1) settle();
  clearTimeout(frame.save);
  frame.save = setTimeout(writeHash, 400);
}

function update() {
  for (const b of document.querySelectorAll(".fig-head [data-naive]")) b.setAttribute("aria-pressed", String((b.dataset.naive === "1") === state.naive));
  for (const b of document.querySelectorAll("#fns [data-f]")) b.setAttribute("aria-pressed", String(b.dataset.f === state.f));
  weight.value = state.r;
  $("weight-out").textContent = state.r === 0.5 ? "½, the post's" : state.r === 0.618 ? "0.618, the repo's" : state.r.toFixed(3);
  writeHash();
  drawSteps();
  drawSeq();
  drawPlot();
  kick();
}

addEventListener("keydown", (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.target instanceof HTMLInputElement && e.target.type !== "range") return;
  const keys = {
    ArrowLeft: () => stepAlong(-1),
    ArrowRight: () => stepAlong(1),
    "+": zoomIn,
    "=": zoomIn,
    "-": zoomOut,
    0: () => goView(FIT),
    n: () => setNaive(!state.naive),
  };
  const go = keys[e.key.length === 1 ? e.key.toLowerCase() : e.key];
  if (!go) return;
  e.preventDefault();
  go();
});

addEventListener("resize", () => {
  drawRuler();
});

addEventListener("hashchange", () => {
  readHash();
  $("ord").value = show(state.x).replace(/\*/g, "·");
  update();
});

readHash();
$("ord").value = show(state.x).replace(/\*/g, "·");
update();
