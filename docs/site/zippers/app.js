// The page: the post's figures as steps, the structure drawn after each one,
// what the house reaches from where it stands, and moves of your own.
import { apply, cells, EXPONENTS, FIGURES, moveText, OMEGA, path, posKey, power, reach, run, START, term } from "./zippers.js";

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

function frame(from, to, t) {
  const svg = $("fig");
  const k = t < 1 ? 1 - (1 - t) ** 3 : 1;
  const lerp = (a, b) => a + (b - a) * k;
  const box = to.box.map((v, i) => lerp(from?.box[i] ?? v, v));
  svg.setAttribute("viewBox", box.join(" "));
  svg.style.setProperty("--units", box[2]);
  svg.replaceChildren();
  const defs = el("defs", {}, svg);
  const marker = el("marker", { id: "arrow", viewBox: "0 0 10 10", refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: "auto-start-reverse" }, defs);
  el("path", { d: "M0 0L10 5L0 10Z", class: "arrowhead" }, marker);
  const vineMarker = el("marker", { id: "arrow-vine", viewBox: "0 0 10 10", refX: 9, refY: 5, markerWidth: 5, markerHeight: 5, orient: "auto-start-reverse" }, defs);
  el("path", { d: "M0 0L10 5L0 10Z", class: "arrowhead vine" }, vineMarker);
  const now = new Map();
  for (const [key, n] of to.nodes) {
    const old = from?.nodes.get(key);
    now.set(key, old ? { ...n, x: lerp(old.x, n.x), y: lerp(old.y, n.y) } : n);
  }
  const edges = el("g", { class: "edges", opacity: from ? Math.min(1, 0.25 + k) : 1 }, svg);
  for (const e of to.edges.filter((e) => e.kind !== "vine")) drawEdge(edges, now.get(e.from), now.get(e.to), e.kind);
  for (const e of to.edges.filter((e) => e.kind === "vine")) drawEdge(edges, now.get(e.from), now.get(e.to), e.kind);
  const nodes = el("g", {}, svg);
  for (const [key, n] of now) {
    const fresh = from && !from.nodes.has(key);
    const g = el("g", { "data-key": key, class: `node ${n.kind}${n.value ? " has-value" : ""}` }, nodes);
    if (fresh) g.setAttribute("opacity", k);
    drawNode(g, n);
  }
  // What's leaving fades where it was.
  if (from && k < 1) {
    for (const [key, n] of from.nodes) {
      if (to.nodes.has(key)) continue;
      const g = el("g", { opacity: 1 - k, class: `node ${n.kind}` }, nodes);
      drawNode(g, n);
    }
  }
}

// On a narrow screen the picture scrolls sideways: keep the house in view.
function follow(l) {
  const sc = $("scroller");
  if (sc.scrollWidth <= sc.clientWidth + 1) return;
  const house = [...l.nodes.values()].find((n) => n.kind === "house");
  const x = (house.x / l.box[2]) * sc.scrollWidth;
  sc.scrollTo({ left: x - sc.clientWidth / 2, behavior: shown ? "smooth" : "auto" });
}

function draw(animate) {
  const next = layout(states[at]);
  requestAnimationFrame(() => follow(next));
  const from = animate ? shown : null;
  shown = next;
  cancelAnimationFrame(anim);
  if (!from || matchMedia("(prefers-reduced-motion: reduce)").matches) return frame(null, next, 1);
  const t0 = performance.now();
  const tick = (now) => {
    const t = Math.min(1, (now - t0) / TWEEN);
    frame(from, next, t);
    if (t < 1) anim = requestAnimationFrame(tick);
  };
  anim = requestAnimationFrame(tick);
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

function render(animate = true) {
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
  draw(animate);
  writeHash();
}

function go(i) {
  if (i < 0 || i >= steps.length || i === at) return;
  at = i;
  render();
}

function perform(op) {
  if (op.move && !op.move.length) return;
  steps = [...steps.slice(0, at + 1), { ops: [op] }];
  const t = apply(states[at], op);
  states = [...states.slice(0, at + 1), t];
  at++;
  render();
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
