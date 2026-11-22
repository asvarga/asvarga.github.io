// The page: the post's figures as steps, the structure drawn after each one,
// what the house reaches from where it stands, and moves of your own.
import { apply, cells, EXPONENTS, FIGURES, moveText, OMEGA, path, posKey, power, prefixKey, reach, run, START, term } from "./zippers.js";

const $ = (id) => document.getElementById(id);
const SVG = "http://www.w3.org/2000/svg";

const UX = 31; // a unit across: \ and / each go one unit left or right
const DX = 78; // the least width
const DY = 62; // between ranks
const LEFT = 34;
const TOP = 30;
const BOTTOM = 34;
const TWEEN = 420; // ms

// ---- captions: the post's words for each figure, cut short ----

const CAPTIONS = {
  1: "A function was passed A, B, C, D in that order. The house holds D, the latest, and C, B, A sit at offsets 1, 2, 3: so far, a plain linked list.",
  2: "<code>move(1)</code>: the house holds C. D isn't lost, it hangs to the left. Two linked lists back to back: a zipper list.",
  3: "Another <code>move(1)</code>. From B, the offsets are {−2: D, −1: C, 0: B, 1: A}.",
  4: "<code>move(−ω)</code> jumps to a new machine, as a <code>[`ω]</code> quote does, and <code>set(E)</code> marks the spot. No number of <code>move(1)</code>s gets from A–D to E. <span class=\"dim\">(The post writes <code>move(ω)</code> here; it quotes with <code>−ω</code> in figure 7, and comes back with <code>move(ω)</code> in figure 6.)</span>",
  5: "A few <code>move(±1)</code>s in the new machine, leaving F in the house. G and E are F's siblings, A–D its first cousins, and A–D's list still has B chosen: B was in focus when we left.",
  6: "<code>move(ω)</code>, a <code>[,ω]</code> unquote, goes back: on B again, and now E–G's list keeps F chosen. A rose tree with zipper lists of children.",
  7: "<code>move(−1)</code> to C, then <code>move(−ω)</code> quotes again: F, with its siblings where they were. A transfinite list would have forgotten them.",
  8: "<code>move(−ω²)</code>, a <code>[`ω²]</code> big quote, leaves this tower of machines for another one. Lonely, so <code>set(H)</code>.",
  9: "<code>move(ω²)</code> back to F. The green vine up from F is a trie of each move's path in bounded parentheses, <code class=\"vine\">\\</code> up-left and <code class=\"vine\">/</code> up-right: <code class=\"vine\">\\/</code> to the 1-list, <code class=\"vine\">\\\\//</code> to ω's, and the longest, <code class=\"vine\">\\\\/\\//</code>, to ω²'s, where H is a second cousin.",
  10: "<code>move(−ω<sup>ω</sup>)</code> goes through ancestors beyond every finite generation at once. <code>set(I)</code>. Going up, each <code class=\"vine\">\\</code> left a blue circle holding the <code class=\"vine\">/</code> branch behind it: F's 1-list, and the trie to its ω- and ω²-lists.",
  11: "<code>move(ω<sup>ω</sup>)</code> back to F: going down, each blue's branch goes back on the right of a green. Each move's work is the size of its ordinal's path, not of the structure: what the blues kept in figure 10 is untouched.",
};

// ---- steps: the tour's figures, then any moves of your own ----

let steps = FIGURES.map((f) => ({ ...f }));
let at = 0;
let states = [];

function rebuild() {
  states = [];
  let s = run(START);
  for (const st of steps) states.push((s = run(st.ops, s)));
}

const tourLength = () => steps.findIndex((s) => !s.fig) === -1 ? steps.length : steps.findIndex((s) => !s.fig);

// ---- URL: #step=4, and any steps of your own as m1-1 (move ω·−1) or sJ ----

function encodeOp(op) {
  if (op.set !== undefined) return `s${op.set}`;
  return op.move.map(([e, n]) => `m${e === OMEGA ? "w" : e}${n}`).join("");
}

function decodeOps(text) {
  const ops = [];
  for (const m of text.matchAll(/m([0-9w])(-?\d+)|s([A-Za-z])/g)) {
    if (m[3]) ops.push({ set: m[3] });
    else ops.push({ move: [[m[1] === "w" ? OMEGA : +m[1], +m[2]]] });
  }
  return ops;
}

function readHash() {
  const q = new URLSearchParams(location.hash.slice(1));
  const from = Math.min(FIGURES.length, Math.max(1, parseInt(q.get("from"), 10) || FIGURES.length));
  const own = decodeOps(q.get("own") ?? "").filter((op) => !op.move || EXPONENTS.includes(op.move[0][0]));
  steps = [...FIGURES.slice(0, own.length ? from : FIGURES.length), ...own.map((op) => ({ ops: [op] }))];
  rebuild();
  at = Math.min(steps.length - 1, Math.max(0, (parseInt(q.get("step"), 10) || 1) - 1));
}

function writeHash() {
  const q = new URLSearchParams({ step: at + 1 });
  const n = tourLength();
  if (n < steps.length) {
    q.set("from", n);
    q.set("own", steps.slice(n).map((s) => s.ops.map(encodeOp).join("")).join("."));
  }
  history.replaceState(null, "", `#${q}`);
}

// ---- layout: the post's cells, scaled to the page ----

function layout(s) {
  const { nodes: cs, edges } = cells(s);
  const nodes = new Map();
  let maxRank = 1;
  let maxX = 0;
  for (const n of cs.values()) {
    maxRank = Math.max(maxRank, n.rank);
    maxX = Math.max(maxX, n.x);
  }
  const y = (r) => TOP + (maxRank - r) * DY + 4;
  for (const [key, n] of cs) {
    nodes.set(key, { ...n, x: LEFT + n.x * UX, y: y(n.rank) });
    // Each list on the house's vine says which move walks it.
    if (n.vine && n.kind === "chosen") nodes.set(`R${n.exp}`, { kind: "label", x: LEFT + n.x * UX + 28, y: y(n.rank) - 22, e: n.exp, text: power(n.exp) });
  }
  return { nodes, edges, box: [0, 0, LEFT * 2 + Math.max(maxX * UX, 3 * DX), y(0) + BOTTOM] };
}

// ---- drawing ----

const el = (name, attrs = {}, parent) => {
  const e = document.createElementNS(SVG, name);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (parent) parent.appendChild(e);
  return e;
};

function drawNode(g, n) {
  const { x, y } = n;
  switch (n.kind) {
    case "diamond":
    case "chosen":
      el("rect", { x: x - 13, y: y - 13, width: 26, height: 26, rx: 3, transform: `rotate(45 ${x} ${y})`, class: n.kind }, g);
      break;
    case "green":
      el("circle", { cx: x, cy: y, r: 13, class: "green" }, g);
      break;
    case "empty":
      el("rect", { x: x - 13, y: y - 13, width: 26, height: 26, rx: 3, transform: `rotate(45 ${x} ${y})`, class: "empty" }, g);
      break;
    case "blue":
      el("circle", { cx: x, cy: y, r: 13, class: "blue" }, g);
      el("path", { d: `M${x - 11} ${y - 6}h22M${x - 11} ${y + 6}h22`, class: "blue-lines" }, g);
      break;
    case "house":
      el("path", { d: `M${x - 25} ${y + 18}V${y - 4}L${x} ${y - 20}L${x + 25} ${y - 4}V${y + 18}Z`, class: "house" }, g);
      el("text", { x, y: y + 12, class: "value" }, g).textContent = n.value ?? "";
      break;
    case "bucket":
    case "blank": {
      const cls = n.kind === "blank" ? "blank" : "bucket";
      el("path", { d: `M${x - 24} ${y - 12}V${y + 12}A24 6 0 0 0 ${x + 24} ${y + 12}V${y - 12}`, class: cls }, g);
      el("ellipse", { cx: x, cy: y - 12, rx: 24, ry: 6, class: cls }, g);
      if (n.value) el("text", { x, y: y + 13, class: "value" }, g).textContent = n.value;
      break;
    }
    case "gap":
      el("text", { x, y: y + 6, class: "gap" }, g).textContent = n.n > 1 ? `⋯ ${n.n}` : "⋯";
      break;
    case "label": {
      const t = el("text", { x, y: y + 5, class: "row-label", "text-anchor": "start" }, g);
      if (n.e !== OMEGA) t.textContent = n.text;
      else {
        t.textContent = "ω";
        el("tspan", { dy: -8, "font-size": "12px" }, t).textContent = "ω";
      }
      break;
    }
  }
}

const RADIUS = { diamond: 19, chosen: 19, empty: 19, green: 13, blue: 13, house: 21, bucket: 19, blank: 19, gap: 12 };

function drawEdge(g, a, b, kind) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  if (len < 1) return;
  const ra = RADIUS[a.kind] ?? 12;
  const rb = RADIUS[b.kind] ?? 12;
  if (len <= ra + rb) return;
  const ux = dx / len;
  const uy = dy / len;
  el("line", { x1: a.x + ux * ra, y1: a.y + uy * ra, x2: b.x - ux * (rb + 2), y2: b.y - uy * (rb + 2), class: `edge ${kind}`, "marker-end": kind === "vine" ? "url(#arrow-vine)" : "url(#arrow)" }, g);
}

let shown = null; // { nodes: Map key -> {x, y, ...}, box }
let anim = null;

// ---- painting a picture ----

const FEET = { house: 17, chosen: 16, diamond: 16, empty: 16, green: 11, blue: 11, bucket: 15, blank: 15 };
const ease = (u) => (u < 0.5 ? 2 * u * u : 1 - 2 * (1 - u) * (1 - u));

/**
 * One frame: `nodes` (key -> node at x, y) drawn with any `alpha` and `scale`,
 * `fading` ({ key, n, a }) drawn on top, each layer of `edges` between the
 * places in `where`, and Phibber's feet at `frog`.
 */
function paint({ box, nodes, fading = [], edges, alpha = new Map(), scale = new Map(), frog }) {
  const svg = $("fig");
  svg.setAttribute("viewBox", box.join(" "));
  svg.style.setProperty("--units", box[2]);
  svg.replaceChildren();
  const defs = el("defs", {}, svg);
  const marker = el("marker", { id: "arrow", viewBox: "0 0 10 10", refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: "auto-start-reverse" }, defs);
  el("path", { d: "M0 0L10 5L0 10Z", class: "arrowhead" }, marker);
  const vineMarker = el("marker", { id: "arrow-vine", viewBox: "0 0 10 10", refX: 9, refY: 5, markerWidth: 5, markerHeight: 5, orient: "auto-start-reverse" }, defs);
  el("path", { d: "M0 0L10 5L0 10Z", class: "arrowhead vine" }, vineMarker);
  const where = new Map(nodes);
  for (const f of fading) if (!where.has(f.key)) where.set(f.key, f.n);
  for (const layer of edges) {
    if (layer.alpha <= 0.01) continue;
    const g = el("g", { class: "edges", opacity: Math.min(1, layer.alpha) }, svg);
    const ok = layer.edges.filter((e) => where.has(e.from) && where.has(e.to) && (!scale.has(e.from) || scale.get(e.from) > 0) && (!scale.has(e.to) || scale.get(e.to) > 0));
    for (const e of ok.filter((e) => e.kind !== "vine")) drawEdge(g, where.get(e.from), where.get(e.to), e.kind);
    for (const e of ok.filter((e) => e.kind === "vine")) drawEdge(g, where.get(e.from), where.get(e.to), e.kind);
  }
  const layer = el("g", {}, svg);
  for (const [key, n] of nodes) {
    const s = scale.get(key) ?? 1;
    if (s <= 0) continue;
    const g = el("g", { "data-key": key, class: `node ${n.kind}${n.value ? " has-value" : ""}` }, layer);
    if (alpha.has(key)) g.setAttribute("opacity", alpha.get(key).toFixed(2));
    if (s !== 1) g.setAttribute("transform", `translate(${n.x} ${n.y}) scale(${s.toFixed(3)}) translate(${-n.x} ${-n.y})`);
    drawNode(g, n);
  }
  for (const { n, a } of fading) if (a > 0.01) drawNode(el("g", { opacity: a.toFixed(2), class: `node ${n.kind}` }, layer), n);
  if (!frog) return;
  // Phibber, the frog from Rainbow Lists
  const y = Math.max(box[1] + 20, frog[1]);
  const g = el("g", { class: "frog", transform: `translate(${frog[0].toFixed(1)},${(y - 5).toFixed(1)})` }, svg);
  el("ellipse", { cx: 0, cy: -2, rx: 9, ry: 7, fill: "#6fcf5b", stroke: "#000", "stroke-width": 1.5 }, g);
  for (const ex of [-4.5, 4.5]) {
    el("circle", { cx: ex, cy: -9, r: 3.2, fill: "#fff", stroke: "#000", "stroke-width": 1.2 }, g);
    el("circle", { cx: ex, cy: -9, r: 1.4, fill: "#000" }, g);
  }
}

const perch = (n) => [n.x, n.y - (FEET[n.kind] ?? 12)];

/** Phibber u of the way through a hop from p to q, feet first. */
function hopAt(p, q, u) {
  const d = Math.hypot(q[0] - p[0], q[1] - p[1]);
  const h = d < 1 ? 0 : Math.min(DY * 1.6, 14 + d * 0.25);
  const e = ease(u);
  return [p[0] + (q[0] - p[0]) * e, p[1] + (q[1] - p[1]) * e - Math.sin(u * Math.PI) * h];
}

/** Along a route of places, u of the way: one hop per leg. */
function hopAlong(places, u) {
  if (places.length < 2) return places[0];
  const s = Math.min(places.length - 1, Math.max(0, u * (places.length - 1)));
  const i = Math.min(places.length - 2, Math.floor(s));
  return hopAt(places[i], places[i + 1], s - i);
}

// A node Phibber has just built pops up, a little past its size and back.
const POP = 200;
function pop(dt) {
  if (dt < 0) return 0;
  if (dt >= POP) return 1;
  const x = dt / POP - 1;
  return 0.2 + 0.8 * (1 + 2.70158 * x ** 3 + 1.70158 * x ** 2);
}

const asLeaf = (n) => ({ ...n, kind: n.value ? "bucket" : "blank" });
const houseOf = (l) => [...l.nodes.values()].find((n) => n.kind === "house");

/** A picture partway from a to b: what stays slides, what's new fades in, what goes fades out. */
function between(a, b, k, { hide = new Set(), leaf = null } = {}) {
  const nodes = new Map();
  const alpha = new Map();
  for (const [key, n] of b.nodes) {
    if (hide.has(key)) continue;
    const o = a.nodes.get(key);
    let m = o ? { ...n, x: o.x + (n.x - o.x) * k, y: o.y + (n.y - o.y) * k } : n;
    if (key === leaf) m = asLeaf(m);
    nodes.set(key, m);
    if (!o) alpha.set(key, k);
  }
  const fading = [...a.nodes].filter(([key]) => !nodes.has(key)).map(([key, n]) => ({ key, n, a: 1 - k }));
  const box = b.box.map((v, i) => a.box[i] + (v - a.box[i]) * k);
  const keep = b.edges.filter((e) => !hide.has(e.from) && !hide.has(e.to));
  return { box, nodes, alpha, fading, edges: [{ edges: a.edges, alpha: 1 - k }, { edges: keep, alpha: k }] };
}

// ---- what Phibber does: a timeline of segments, each { ms, at(u) } ----

const HOP = 230; // ms a hop

/** Straight from one picture to another: Phibber hops house to house. */
function jumpSeg(a, b) {
  return {
    ms: TWEEN,
    at(u) {
      const k = 1 - (1 - u) ** 3;
      const f = between(a, b, k);
      const was = houseOf(a);
      const now = f.nodes.get(houseOf(b).key);
      const from = f.nodes.get(was.key) ?? was;
      paint({ ...f, frog: hopAt(perch({ ...from, kind: "house" }), perch(now), u) });
    },
  };
}

/** set(v): a new value in the house, and a little hop on the spot. */
function setSeg(t) {
  const b = layout(t);
  return { ms: 320, at: (u) => paint({ box: b.box, nodes: b.nodes, edges: [{ edges: b.edges, alpha: 1 }], frog: hopAt(perch(houseOf(b)), perch(houseOf(b)), u) }) };
}

// The picture grown to hold what's in it, with room above for Phibber.
function fit(l) {
  const xs = [...l.nodes.values()].map((n) => n.x);
  const ys = [...l.nodes.values()].map((n) => n.y);
  const [x0, y0] = [Math.min(l.box[0], Math.min(...xs) - LEFT), Math.min(l.box[1], Math.min(...ys) - TOP - 10)];
  const [x1, y1] = [Math.max(l.box[0] + l.box[2], Math.max(...xs) + LEFT), Math.max(l.box[1] + l.box[3], Math.max(...ys) + BOTTOM)];
  l.box = [x0, y0, x1 - x0, y1 - y0];
}

/**
 * move(n·ω^e), as the structure does it: Phibber climbs e's path up the vine
 * to the e-list (building any of it that isn't there yet), hops n along it
 * while the old vine is packed away into blues, and climbs back down, the new
 * vine unpacking where he lands, until the value he lands on is the house.
 */
function moveSegs(s, t, e, n) {
  const A = layout(s);
  const B = layout(t);
  const p = path(e);
  const greens = Array.from({ length: p.length - 1 }, (_, i) => `gv|${p.slice(0, i + 1)}`);
  const dark = (q) => `D${e}|${prefixKey(q, e)}`;
  const home = `L${posKey(t.focus)}`;
  const target = dark(t.focus);
  if (!B.nodes.has(target)) return [jumpSeg(A, B)];
  const up = [`L${posKey(s.focus)}`, ...greens, dark(s.focus)];
  const twin = [home, ...greens, target]; // the same places in the new picture

  // 1. Up the old picture, building what it lacks where the new one has it.
  const a = { box: [...A.box], nodes: new Map(A.nodes), edges: [...A.edges] };
  const builtAt = new Map(); // key -> ms Phibber lands there
  const route = [up[0]];
  for (let i = 1; i < up.length; i++) {
    if (!a.nodes.has(up[i])) {
      const prev = a.nodes.get(route.at(-1));
      const pb = B.nodes.get(twin[up.indexOf(route.at(-1))]);
      const nb = B.nodes.get(twin[i]);
      if (!prev || !pb || !nb) continue;
      a.nodes.set(up[i], { ...nb, key: up[i], x: prev.x + nb.x - pb.x, y: prev.y + nb.y - pb.y });
      a.edges.push({ from: route.at(-1), to: up[i], kind: "vine" });
      builtAt.set(up[i], route.length * HOP);
    }
    route.push(up[i]);
  }
  fit(a);
  const climbMs = (route.length - 1) * HOP + (builtAt.size ? POP : 0);
  const climb = {
    ms: climbMs,
    at(u) {
      const ms = u * climbMs;
      const scale = new Map([...builtAt].map(([k, t0]) => [k, pop(ms - t0)]));
      const places = route.map((k) => perch(a.nodes.get(k)));
      paint({ box: a.box, nodes: a.nodes, edges: [{ edges: a.edges, alpha: 1 }], scale, frog: hopAlong(places, Math.min(1, ms / ((route.length - 1) * HOP || 1))) });
    },
  };

  // 2. Along the e-list while the picture changes. The new vine below the
  // list stays hidden: it's what he builds on the way down.
  const top = B.nodes.get(target).rank;
  const hide = new Set([...B.nodes].filter(([k, nd]) => (nd.vine || nd.kind === "house") && nd.rank < top && k !== home).map(([k]) => k));
  const base = Object.fromEntries(Object.entries(s.focus).filter(([x]) => +x > e));
  const c0 = s.focus[e] ?? 0;
  let along = [];
  for (let j = 0; j <= Math.abs(n); j++) {
    const c = c0 + Math.sign(n) * j;
    const q = { ...base };
    if (c) q[e] = c;
    along.push(dark(q));
  }
  along = along.filter((k, j) => j === 0 || j === along.length - 1 || B.nodes.has(k));
  if (along.length > 7) along = along.filter((_, j) => j === along.length - 1 || j % Math.ceil(along.length / 6) === 0);
  const stepMs = Math.max(TWEEN * 1.4, (along.length - 1) * HOP * 1.2);
  const step = {
    ms: stepMs,
    at(u) {
      const k = ease(u);
      const f = between(a, B, k, { hide, leaf: home });
      const place = (key) => f.nodes.get(key) ?? f.fading.find((x) => x.key === key)?.n;
      const places = along.map(place).filter(Boolean).map(perch);
      paint({ ...f, frog: hopAlong(places, u) });
    },
  };

  // 3. Down the new vine: each node at or above where he lands is built.
  const down = [...twin].reverse().filter((k) => B.nodes.has(k));
  const landAt = down.map((_, i) => i * HOP);
  const revealAt = (rank) => {
    for (let i = 0; i < down.length; i++) if (B.nodes.get(down[i]).rank <= rank) return landAt[i];
    return Infinity;
  };
  const descendMs = (down.length - 1) * HOP + POP;
  const descend = {
    ms: descendMs,
    at(u) {
      const ms = u * descendMs;
      const scale = new Map();
      for (const k of hide) scale.set(k, pop(ms - revealAt(B.nodes.get(k).rank)));
      const landed = ms >= landAt.at(-1);
      const nodes = new Map(B.nodes);
      if (!landed) nodes.set(home, asLeaf(B.nodes.get(home)));
      else scale.set(home, pop(ms - landAt.at(-1)));
      const places = down.map((k) => perch(nodes.get(k)));
      paint({ box: B.box, nodes, edges: [{ edges: B.edges, alpha: 1 }], scale, frog: hopAlong(places, Math.min(1, ms / ((down.length - 1) * HOP || 1))) });
    },
  };
  return [climb, step, descend];
}

/** A step's ops from state s, one move term at a time. */
function stepSegs(s, ops) {
  const segs = [];
  for (const op of ops) {
    if (op.set !== undefined) {
      s = apply(s, op);
      segs.push(setSeg(s));
      continue;
    }
    for (const [e, n] of op.move) {
      if (!n) continue;
      const t = apply(s, { move: [[e, n]] });
      segs.push(...moveSegs(s, t, e, n));
      s = t;
    }
  }
  return segs;
}

function still(l) {
  paint({ box: l.box, nodes: l.nodes, edges: [{ edges: l.edges, alpha: 1 }], frog: perch(houseOf(l)) });
}

function play(segs, end) {
  const total = segs.reduce((t, s) => t + s.ms, 0);
  const t0 = performance.now();
  const tick = (now) => {
    let t = Math.max(0, now - t0);
    if (t >= total) return still(end);
    for (const s of segs) {
      if (t < s.ms) {
        s.at(t / s.ms);
        break;
      }
      t -= s.ms;
    }
    anim = requestAnimationFrame(tick);
  };
  tick(t0);
}

// On a narrow screen the picture scrolls sideways: keep the house in view.
function follow(l) {
  const sc = $("scroller");
  if (sc.scrollWidth <= sc.clientWidth + 1) return;
  const house = houseOf(l);
  const x = ((house.x - l.box[0]) / l.box[2]) * sc.scrollWidth;
  sc.scrollTo({ left: x - sc.clientWidth / 2, behavior: shown ? "smooth" : "auto" });
}

// mode: "play" acts out this step's ops from the step before, "jump" goes
// straight there, and anything else just draws it.
function draw(mode) {
  const next = layout(states[at]);
  requestAnimationFrame(() => follow(next));
  const from = shown;
  shown = next;
  cancelAnimationFrame(anim);
  if (!mode || !from || matchMedia("(prefers-reduced-motion: reduce)").matches) return still(next);
  const segs = mode === "play" && at > 0 ? stepSegs(states[at - 1], steps[at].ops) : [jumpSeg(from, next)];
  if (!segs.length) return still(next);
  play(segs, next);
}

// ---- the rest of the page ----

function opText(op) {
  if (op.set !== undefined) return `set(${op.set})`;
  return `move(${moveText(op.move, true)})`;
}

function nextValue() {
  const used = new Set([...states[at].values.values()]);
  for (const c of "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz") if (!used.has(c)) return c;
  return "Z";
}

function render(mode = "jump") {
  const step = steps[at];
  const s = states[at];
  const n = tourLength();
  $("where").textContent = step.fig ? `Figure ${step.fig} of ${FIGURES.length}` : `Your step ${at - n + 1} of ${steps.length - n}`;
  $("prev").disabled = at === 0;
  $("next").disabled = at === steps.length - 1;
  $("dots").replaceChildren(
    ...steps.map((st, i) => {
      const li = document.createElement("li");
      const b = document.createElement("button");
      b.className = `${st.fig ? "fig" : "own"}${i === at ? " now" : ""}`;
      b.title = st.fig ? `Figure ${st.fig}` : st.ops.map((o) => opText(o).replace(/<\/?sup>/g, "")).join(" · ");
      b.setAttribute("aria-label", b.title);
      b.onclick = () => go(i);
      li.append(b);
      return li;
    }),
  );
  $("ops").innerHTML = step.ops.length ? step.ops.map((o) => `<code>${opText(o)}</code>`).join(" ") : "<code>the start</code>";
  if (step.fig) $("caption").innerHTML = CAPTIONS[step.fig];
  else {
    const moves = step.ops.filter((o) => o.move).flatMap((o) => o.move);
    const v = s.values.get(posKey(s.focus));
    const lines = moves.map(([e, k]) => `<code>${term(e, k, true)}</code> climbs <code class="vine">${path(e)}</code> up the vine, steps ${Math.abs(k)} ${k < 0 ? "left" : "right"} along the ${power(e, true)}-list, and comes back down, unpacking the blues there.`);
    $("caption").innerHTML = (lines.join(" ") || "A new value in the house.") + (v ? ` The house holds ${v}.` : " The house is empty here: <code>set</code> puts a value in it.");
  }
  $("tap").hidden = at === steps.length - 1 && !matchMedia("(hover: none)").matches;
  $("tap").textContent = at === steps.length - 1 ? "That's the last step. Tap a value to go to it, or make a move of your own." : "Tap the picture for the next step, or a value to go to it.";

  const reachList = reach(s);
  $("reach").replaceChildren(
    ...reachList.map((r) => {
      const li = document.createElement("li");
      const b = document.createElement("button");
      b.className = r.terms.length ? "" : "here";
      b.innerHTML = `<b>${r.value}</b> <code>${r.terms.length ? moveText(r.terms, true) : "0"}</code>`;
      b.title = r.terms.length ? `move(${moveText(r.terms)})` : "In the house";
      b.disabled = !r.terms.length;
      b.onclick = () => perform({ move: r.terms });
      li.append(b);
      return li;
    }),
  );
  $("next-value").textContent = nextValue();
  $("original").hidden = !step.fig;
  if (step.fig) {
    $("original-n").textContent = step.fig;
    $("original-img").src = `figs/fig${step.fig}.png`;
  }
  draw(mode);
  writeHash();
}

function go(i) {
  if (i < 0 || i >= steps.length || i === at) return;
  const next = i === at + 1;
  at = i;
  render(next ? "play" : "jump");
}

function perform(op) {
  if (op.move && !op.move.length) return;
  steps = [...steps.slice(0, at + 1), { ops: [op] }];
  const t = apply(states[at], op);
  states = [...states.slice(0, at + 1), t];
  at++;
  render("play");
}

function buildMoves() {
  const box = $("moves");
  for (const e of EXPONENTS) {
    const g = document.createElement("div");
    g.className = "move";
    const minus = document.createElement("button");
    const plus = document.createElement("button");
    minus.innerHTML = `−${power(e, true)}`;
    plus.innerHTML = `+${power(e, true)}`;
    minus.title = `move(${term(e, -1)}): up ${path(e)}, one left, back down`;
    plus.title = `move(${term(e, 1)}): up ${path(e)}, one right, back down`;
    minus.onclick = () => perform({ move: [[e, -1]] });
    plus.onclick = () => perform({ move: [[e, 1]] });
    const p = document.createElement("code");
    p.className = "vine";
    p.textContent = path(e);
    p.title = `The path for ${power(e)} in bounded parentheses`;
    g.append(minus, p, plus);
    box.append(g);
  }
}

$("prev").onclick = () => go(at - 1);
$("next").onclick = () => go(at + 1);
$("set").onclick = () => perform({ set: nextValue() });
$("tour").onclick = () => {
  steps = FIGURES.map((f) => ({ ...f }));
  rebuild();
  at = 0;
  render();
};
$("fig").addEventListener("click", (ev) => {
  const g = ev.target.closest("[data-key]");
  const key = g?.dataset.key;
  if (key?.startsWith("L")) {
    const s = states[at];
    const r = reach(s).find((x) => `L${x.key}` === key);
    if (r?.terms.length) return perform({ move: r.terms });
    if (r) return;
  }
  go(at + 1);
});
addEventListener("keydown", (ev) => {
  if (ev.metaKey || ev.ctrlKey || ev.altKey || ev.target.closest?.("input, textarea, select")) return;
  const act = {
    ArrowLeft: () => go(at - 1),
    ArrowRight: () => go(at + 1),
    " ": () => go(at + 1),
    Home: () => $("tour").click(),
    s: () => $("set").click(),
    S: () => $("set").click(),
  }[ev.key];
  if (!act) return;
  ev.preventDefault();
  act();
});

buildMoves();
readHash();
render(false);
