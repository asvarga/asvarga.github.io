// The page: a list of pairs drawn as the post's figures are, put and get on
// it, and the post's examples to start from. The structure is tflists.js.

import { cmp, html, parse, runs, show } from "./ordinals.js";
import { get, layout, len, naiveGet, NIL, places, put, spine } from "./tflists.js";

const $ = (id) => document.getElementById(id);
const SVG = "http://www.w3.org/2000/svg";

const DX = 44; // a step along
const DY = 52; // a step up
const PAD = 34;
const TOP = 40;
const BOTTOM = 46;
const STEP = 300; // ms a get spends on each parenthesis
const POP = 170; // ms a hop of Phibber's while a put builds

const PUTS = ["1", "2", "ω", "ω+1", "ω·2", "ω^2", "ω^3", "ω^ω"];
const TRY = ["1", "2", "ω", "ω+1", "ω·2", "ω^2", "ω^2+1", "ω^ω"];

const ones = (n) => Array(n).fill("p1");
const EXAMPLES = [
  {
    name: "The post's first",
    ops: ["p1", "p1", "pω", "p1", "p1", "p1"],
    text: "The post's first list, <code>put</code> 1, 1, ω, 1, 1, 1: places 0, 1, 2, 3, then ω, ω+1, ω+2. From every hollow node before the ω, a gold shortcut climbs to the ω's peak.",
    next: "ω",
  },
  {
    name: "The post's second",
    ops: ["p1", "pω^ω", "p1", "pω^3", "p1", "pω^2", "p1", "pω", "p1"],
    text: "The post's second list: 0, 1, ω, ω+1, ω², ω²+1, ω³, ω³+1, ω^ω, ω^ω+1. The peak of the first 1 can follow the shortcuts all the way to the peak of the ω^ω, and the whole thing was built right to left without ever following more than a path's worth of edges.",
    next: "ω^2+1",
  },
  {
    name: "Twelve 1s before ω",
    ops: ["p1", "pω", ...ones(12)],
    text: "Twelve places, then ω. The naive list would walk past all twelve to <code>get(ω)</code>; the pairs take four steps, up a shortcut and down.",
    next: "ω",
  },
  { name: "Empty", ops: [], text: "Nothing yet: the head is the end. <code>put</code> something.", next: null },
];

// ---- State: every list so far, since nothing is changed in place ----

let hist = []; // { list, op } where op is "p<ordinal>" or "g<ordinal>"
let pending = null; // an animation that will commit

const now = () => hist.at(-1).list;

function load(ops) {
  hist = [{ list: NIL, op: null }];
  for (const op of ops) {
    const x = parse(op.slice(1));
    const list = op[0] === "p" ? put(x, now()).list : get(x, now()).list;
    if (!list) break;
    hist.push({ list, op: `${op[0]}${show(x)}` });
  }
}

function saveHash() {
  const ops = hist.slice(1).map((h) => encodeURIComponent(h.op));
  history.replaceState(null, "", ops.length ? `#${ops.join(".")}` : location.pathname + location.search);
}

function finish() {
  if (!pending) return;
  clearTimeout(pending.timer);
  cancelAnimationFrame(pending.frame);
  const p = pending;
  pending = null;
  p.commit();
}

// ---- Ordinals as SVG text, with superscripts ----

function ordText(x, cx, cy, cls) {
  const t = document.createElementNS(SVG, "text");
  t.setAttribute("x", cx);
  t.setAttribute("y", cy);
  t.setAttribute("class", cls);
  let at = 0;
  for (const { text, level } of runs(x)) {
    const s = document.createElementNS(SVG, "tspan");
    s.textContent = text;
    if (level !== at) s.setAttribute("dy", `${(at - level) * 0.42}em`);
    if (level) s.setAttribute("font-size", `${Math.pow(0.72, level) * 100}%`);
    at = level;
    t.append(s);
  }
  return t;
}

function el(name, attrs, parent) {
  const e = document.createElementNS(SVG, name);
  for (const [k, v] of Object.entries(attrs)) if (v !== undefined && v !== null) e.setAttribute(k, v);
  parent?.append(e);
  return e;
}

/** Phibber, the frog from Rainbow Lists, standing at (0, 0). */
function frog(parent) {
  const g = el("g", { class: "frog" }, parent);
  el("ellipse", { cx: 0, cy: -2, rx: 9, ry: 7, fill: "#6fcf5b", stroke: "#000", "stroke-width": 1.5 }, g);
  for (const ex of [-4.5, 4.5]) {
    el("circle", { cx: ex, cy: -9, r: 3.2, fill: "#fff", stroke: "#000", "stroke-width": 1.2 }, g);
    el("circle", { cx: ex, cy: -9, r: 1.4, fill: "#000" }, g);
  }
  return g;
}
const perch = (g, x, y) => g.setAttribute("transform", `translate(${x.toFixed(1)},${(y - 5).toFixed(1)})`);

/**
 * When things happen in a put, as Phibber does it: from the old head he hops
 * left, building each round's new pairs deepest first (the one next to the
 * old head first), one a hop, until he's on the new head. Each pair lights the
 * old node its path followed as it's built. built and follow: node id -> ms.
 * keys: his landings in order, { t, id }. at[r][j]: when round r's j-th pair
 * is built.
 */
function putSchedule(rounds, before, pop) {
  const built = new Map();
  const follow = new Map();
  const keys = [{ t: 0, id: before.id }];
  const at = [];
  let t = 0;
  for (const r of rounds) {
    const when = [];
    for (let j = r.steps.length - 1; j >= 0; j--) {
      const st = r.steps[j];
      when[j] = t += pop;
      built.set(st.node.id, t);
      if (st.follow !== NIL && !follow.has(st.follow.id)) follow.set(st.follow.id, t);
      keys.push({ t, id: st.node.id });
    }
    at.push(when);
  }
  return { built, follow, keys, at, end: t };
}

// ---- Drawing ----

/**
 * Draw list L. hl says what the last operation did:
 *  { kind: "put", rounds, before }  the pairs built, the path followed, the copies
 *  { kind: "walk", res, after }     a get's walk, still on the old list
 *  { kind: "got" }                  the head just reached
 */
function draw(L, hl = {}) {
  const svg = $("fig");
  svg.replaceChildren();
  const { at, edges } = layout(L);
  const maxX = at.get(L.id).x;
  let maxY = 1;
  for (const p of at.values()) maxY = Math.max(maxY, p.y);
  const sx = (x) => PAD + (maxX - x) * DX;
  const sy = (y) => TOP + (maxY - y) * DY;
  // Room on the right for a get that falls off the end.
  const W = PAD * 2 + maxX * DX + (hl.kind === "walk" && !hl.res.list ? DX : 0);
  const H = TOP + maxY * DY + BOTTOM;
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  const cw = $("scroller").clientWidth || W;
  // Fit the width where it can, but never so small that a place is hard to read.
  const k = Math.min(1.5, Math.max(0.6, cw / W));
  svg.style.width = `${W * k}px`;
  // Text keeps its size when the picture shrinks to fit.
  svg.style.setProperty("--k", k);
  svg.style.height = `${H * k}px`;

  const defs = el("defs", {}, svg);
  for (const [id, cls] of [
    ["arrow", "arrowhead"],
    ["arrow-copy", "arrowhead copy"],
    ["arrow-walk", "arrowhead walk"],
  ]) {
    const m = el("marker", { id, viewBox: "0 0 10 10", refX: 9, refY: 5, markerWidth: 9, markerHeight: 9, markerUnits: "userSpaceOnUse", orient: "auto-start-reverse" }, defs);
    el("path", { d: "M0 1 L10 5 L0 9 z", class: cls }, m);
  }

  // The ground, where the places are.
  el("line", { x1: sx(maxX) - 18, y1: sy(0) + 0.5, x2: sx(0) + 18, y2: sy(0) + 0.5, class: "ground" }, svg);

  const { diffs, hollow } = spine(L);
  const placeOf = new Map(hollow.map((h, i) => [h.id, places(diffs)[i]]));

  // What the highlight touches.
  const built = hl.kind === "put" ? hl.sched.built : new Map(); // node id -> ms built
  const follow = hl.kind === "put" ? hl.sched.follow : new Map(); // node id -> ms followed
  const copies = new Set(); // "from>to" of left edges a put just copied
  if (hl.kind === "put") for (const r of hl.rounds) for (const st of r.steps) if (st.copied) copies.add(`${st.node.id}>${st.node.l.id}`);
  const walked = new Map(); // "from>to" -> step
  const visited = new Map(); // node id -> step
  if (hl.kind === "walk") {
    const v = hl.res.visited;
    v.forEach((p, i) => visited.set(p.id, i));
    for (let i = 1; i < v.length; i++) walked.set(`${v[i - 1].id}>${v[i].id}`, i);
  }
  const kept = hl.after ? layout(hl.after).at : null;
  const doneAt = hl.kind === "walk" ? hl.res.visited.length * STEP : 0;

  const r = (p) => (p.y === 0 ? 12 : 7.5);
  const geom = (e) => {
    const a = at.get(e.from.id);
    const b = at.get(e.to.id);
    const [x1, y1, x2, y2] = [sx(a.x), sy(a.y), sx(b.x), sy(b.y)];
    if (!e.copied) {
      const len = Math.hypot(x2 - x1, y2 - y1);
      const ux = (x2 - x1) / len;
      const uy = (y2 - y1) / len;
      const [p1x, p1y, p2x, p2y] = [x1 + ux * r(a), y1 + uy * r(a), x2 - ux * (r(b) + 2), y2 - uy * (r(b) + 2)];
      return { d: `M${p1x} ${p1y} L${p2x} ${p2y}`, at: (t) => [x1 + (x2 - x1) * t, y1 + (y2 - y1) * t] };
    }
    // A shortcut arcs above what it skips.
    const lift = Math.min(DY * 1.1, 14 + (a.x - b.x) * 5);
    const cx = (x1 + x2) / 2;
    const cy = Math.min(y1, y2) - lift;
    const q = (t, p0, p1, p2) => (1 - t) * (1 - t) * p0 + 2 * (1 - t) * t * p1 + t * t * p2;
    // Start and end just off the nodes, along the curve.
    const back = (t0, rr, from, to) => {
      let t = t0;
      for (let i = 0; i < 12; i++) {
        const [px, py] = [q(t, x1, cx, x2), q(t, y1, cy, y2)];
        if (Math.hypot(px - from[0], py - from[1]) >= rr) break;
        t += to;
      }
      return t;
    };
    const t1 = back(0, r(a), [x1, y1], 0.01);
    const t2 = back(1, r(b) + 2, [x2, y2], -0.01);
    const pt = (t) => [q(t, x1, cx, x2), q(t, y1, cy, y2)];
    const [p1x, p1y] = pt(t1);
    const [p2x, p2y] = pt(t2);
    // The control point of the piece between t1 and t2.
    const w0 = (1 - t1) * (1 - t2);
    const w1 = t1 * (1 - t2) + t2 * (1 - t1);
    const w2 = t1 * t2;
    const kx = w0 * x1 + w1 * cx + w2 * x2;
    const ky = w0 * y1 + w1 * cy + w2 * y2;
    return { d: `M${p1x} ${p1y} Q${kx} ${ky} ${p2x} ${p2y}`, at: pt };
  };

  const edgeLayer = el("g", { class: "edges" }, svg);
  const geoms = new Map();
  // Copied edges under the rest.
  for (const e of [...edges].sort((a, b) => (b.copied ? 1 : 0) - (a.copied ? 1 : 0))) {
    const key = `${e.from.id}>${e.to.id}`;
    const g = geom(e);
    geoms.set(key, g);
    const cls = ["edge"];
    let marker = "arrow";
    let delay = null;
    if (e.copied) (cls.push("copy"), (marker = "arrow-copy"));
    if (built.has(e.from.id)) (cls.push("built"), (delay = built.get(e.from.id)));
    if (copies.has(key)) cls.push("copied-now");
    if (walked.has(key)) (cls.push("walked"), (marker = "arrow-walk"), (delay = walked.get(key) * STEP - STEP / 2));
    if (kept && !kept.has(e.from.id)) cls.push("drop");
    el("path", { d: g.d, class: cls.join(" "), "marker-end": `url(#${marker})`, style: `--d:${delay ?? 0}ms;--done:${doneAt}ms` }, edgeLayer);
  }

  const nodeLayer = el("g", { class: "nodes" }, svg);
  for (const p of at.values()) {
    const cx = sx(p.x);
    const cy = sy(p.y);
    const g = el("g", { class: "node" }, nodeLayer);
    const cls = [p.y === 0 ? "hollow" : "pair"];
    let delay = null;
    if (built.has(p.node.id)) (cls.push("built"), (delay = built.get(p.node.id)));
    if (follow.has(p.node.id)) cls.push("follow");
    if (visited.has(p.node.id)) (cls.push("visited"), (delay = visited.get(p.node.id) * STEP));
    if (kept && !kept.has(p.node.id)) cls.push("drop");
    if (p.node === L) cls.push("head");
    if (hl.kind === "got" && p.node === L) cls.push("arrived");
    g.setAttribute("class", `node ${cls.join(" ")}`);
    g.setAttribute("style", `--d:${delay ?? 0}ms;--f:${follow.get(p.node.id) ?? 0}ms;--done:${doneAt}ms`);
    if (p.node === L) el("circle", { cx, cy, r: 18, class: "head-ring" }, g);
    el("circle", { cx, cy, r: r(p), class: "dot" }, g);
    if (p.y === 0) {
      const place = placeOf.get(p.node.id);
      g.append(ordText(place, cx, cy + 34, "place"));
      if (place && p.node !== L) {
        g.classList.add("tap");
        g.addEventListener("click", () => doGet(place));
        const title = el("title", {}, g);
        title.textContent = `get(${show(place)})`;
      }
    }
  }
  if (at.has(L.id)) {
    const h = at.get(L.id);
    const t = el("text", { x: sx(h.x), y: sy(0) - 24, class: "head-label" }, svg);
    t.textContent = "L";
  }
  if (hl.kind === "put" && hl.before !== L && at.has(hl.before.id)) {
    const b = at.get(hl.before.id);
    const t = el("text", { x: sx(b.x), y: sy(0) - 24, class: "before-label" }, svg);
    t.textContent = "old L";
  }

  // A get that falls off: a red stub where the edge would be.
  if (hl.kind === "walk" && hl.res.list === null) {
    const p = at.get(hl.res.visited[hl.res.fell].id);
    const up = hl.res.path[hl.res.fell] === "(";
    const [x1, y1] = [sx(p.x), sy(p.y)];
    const [x2, y2] = [x1 + DX * 0.8, y1 + (up ? -DY : DY) * 0.8];
    const g = el("g", { class: "fall", style: `--d:${(hl.res.fell + 0.5) * STEP}ms` }, svg);
    el("line", { x1, y1, x2, y2 }, g);
    const t = el("text", { x: x2 + 4, y: y2 + 6 }, g);
    t.textContent = "✕";
  }

  // Phibber, the frog from Rainbow Lists: he sits on the head, and hops
  // along a get's walk, off the end of one that falls.
  const phib = frog(svg);
  if (hl.kind === "put") {
    // down the old list along the path, and back up building
    const keys = hl.sched.keys.filter((k) => at.has(k.id)).map((k) => ({ t: k.t, xy: [sx(at.get(k.id).x), sy(at.get(k.id).y)] }));
    const t0 = performance.now();
    const frame = (t) => {
      if (!phib.isConnected || !keys.length) return;
      const ms = Math.max(0, t - t0);
      const i = keys.findIndex((k) => k.t > ms);
      let xy = keys.at(-1).xy;
      let lift = 0;
      if (i > 0) {
        const [a, b] = [keys[i - 1], keys[i]];
        const f = (ms - a.t) / (b.t - a.t);
        const e = f < 0.5 ? 2 * f * f : 1 - 2 * (1 - f) * (1 - f);
        xy = [a.xy[0] + (b.xy[0] - a.xy[0]) * e, a.xy[1] + (b.xy[1] - a.xy[1]) * e];
        lift = Math.sin(f * Math.PI) * Math.min(DY, 10 + Math.hypot(b.xy[0] - a.xy[0], b.xy[1] - a.xy[1]) * 0.2);
      } else if (i === 0) xy = keys[0].xy;
      perch(phib, xy[0], xy[1] - lift);
      if (i !== -1) requestAnimationFrame(frame);
    };
    frame(t0);
  } else if (hl.kind !== "walk") {
    if (at.has(L.id)) perch(phib, sx(at.get(L.id).x), sy(0));
  } else {
    const v = hl.res.visited;
    const pos = (i) => [sx(at.get(v[i].id).x), sy(at.get(v[i].id).y)];
    const fell = hl.res.list === null;
    const last = pos(v.length - 1);
    const up = fell && hl.res.path[hl.res.fell] === "(";
    const stub = [last[0] + DX * 0.8, last[1] + (up ? -DY : DY) * 0.8];
    const end = v.length - 1 + (fell ? 2 : 0);
    const t0 = performance.now();
    const frame = (t) => {
      if (!phib.isConnected) return;
      // a frame's time can be a little before t0
      const s = Math.min(end, Math.max(0, (t - t0) / STEP));
      let xy = pos(0);
      let lift = 0;
      let opacity = 1;
      if (s < v.length - 1) {
        const i = Math.floor(s);
        const f = s - i;
        const e = f < 0.5 ? 2 * f * f : 1 - 2 * (1 - f) * (1 - f);
        const g = geoms.get(`${v[i].id}>${v[i + 1].id}`);
        xy = g ? g.at(e) : pos(i + 1);
        lift = Math.sin(f * Math.PI) * 12;
      } else if (!fell) xy = last;
      else if (s < v.length) {
        // off the end, where there's no edge, and gone
        const f = s - (v.length - 1);
        xy = [last[0] + (stub[0] - last[0]) * f, last[1] + (stub[1] - last[1]) * f];
        lift = Math.sin(f * Math.PI) * 12;
        opacity = 1 - f;
      } else opacity = s - v.length; // back on the head
      perch(phib, xy[0], xy[1] - lift);
      phib.setAttribute("opacity", opacity.toFixed(2));
      if (s < end) {
        const id = requestAnimationFrame(frame);
        if (pending) pending.frame = id;
      }
    };
    frame(t0);
  }

  // Keep the head in view on a narrow screen.
  $("scroller").scrollLeft = 0;
}

// ---- Words around the picture ----

const parenSpans = (ps, delay) =>
  [...ps].map((c, i) => `<span class="paren" style="--d:${delay(i)}ms">${c}</span>`).join("");

function readout() {
  const L = now();
  const { diffs } = spine(L);
  const ps = places(diffs);
  $("places").innerHTML = ps.map((p) => `<li>${html(p)}</li>`).join("");
  $("diffs").innerHTML = diffs.length ? `[${diffs.map(html).join(", ")}]` : "[ ] (empty)";
  const end = len(L);
  $("diffs").innerHTML += `<span class="dim small">The post's <code>len</code> finds the last place, ${html(end.length)}, in ${end.path.length} steps, by always climbing where it can${end.path ? `: <code>${end.path}</code>` : ""}.</span>`;

  $("get-chips").innerHTML = "";
  const chip = (x, cls) => {
    const b = document.createElement("button");
    b.innerHTML = html(x);
    if (cls) b.className = cls;
    b.title = `get(${show(x)})`;
    b.addEventListener("click", () => doGet(x));
    const li = document.createElement("li");
    li.append(b);
    $("get-chips").append(li);
  };
  ps.slice(1, 13).forEach((p) => chip(p));
  if (ps.length > 13) {
    const li = document.createElement("li");
    li.className = "dim";
    li.textContent = `… ${ps.length - 13} more`;
    $("get-chips").append(li);
  }
  const miss = TRY.map(parse).find((x) => !ps.includes(x) && cmp(x, ps.at(-1)) < 0) ?? TRY.map(parse).find((x) => !ps.includes(x));
  if (miss) chip(miss, "miss");

  $("undo").disabled = hist.length < 2;
  const ops = hist.slice(1).map((h) => `${h.op[0] === "p" ? "put" : "get"}(${h.op.slice(1)})`);
  $("history").textContent = ops.length ? ops.slice(-6).join(" · ") + (ops.length > 6 ? ` (and ${ops.length - 6} before)` : "") : "";
  saveHash();
}

function say(op, caption) {
  $("op").innerHTML = op;
  $("caption").innerHTML = caption;
}

// ---- What the buttons do ----

function doPut(x) {
  finish();
  const before = now();
  const res = put(x, before);
  if (!res.rounds.length) return say(`put(0)`, "Putting 0 moves nothing.");
  hist.push({ list: res.list, op: `p${show(x)}` });
  const builtN = res.rounds.reduce((n, r) => n + r.steps.length, 0);
  const copiedN = res.rounds.reduce((n, r) => n + r.steps.filter((s) => s.copied).length, 0);
  // A long put hops faster, so it's done in a few seconds.
  const sched = putSchedule(res.rounds, before, Math.min(POP, 3000 / builtN));
  draw(res.list, { kind: "put", rounds: res.rounds, before, sched });
  readout();
  // The rounds, with a run of the same power as one: put(1) () ×12.
  const groups = [];
  for (const r of res.rounds) {
    if (groups.at(-1)?.power === r.power) groups.at(-1).n++;
    else groups.push({ power: r.power, path: r.path, n: 1 });
  }
  let r = 0;
  const parts = groups.map((g) => {
    // Its parens light as the pairs of its last round pop in.
    const when = sched.at[r + g.n - 1];
    const d = (j) => when[j];
    r += g.n;
    return `<span class="round">put(${html(g.power)}) <code class="path">${parenSpans(g.path, d)}</code>${g.n > 1 ? ` ×${g.n}` : ""}</span>`;
  });
  const order =
    res.rounds.length > 1
      ? `<code>put(${html(x)})</code> puts its powers last first, since <code>put(α+β)</code> is <code>put(α)</code> after <code>put(β)</code>: ${groups
          .map((g) => `<code>put(${html(g.power)})</code>${g.n > 1 ? ` ${g.n} times` : ""}`)
          .join(", then ")}. `
      : "";
  const copied = copiedN
    ? `copied ${copiedN} left edge${copiedN > 1 ? "s" : ""} from the old list, in gold, so each new peak can skip ahead to the old one it matches.`
    : before === NIL
      ? "had nothing to copy: the list was empty."
      : "copied nothing, since the old list's path never had a left edge where this one goes right.";
  say(parts.join(" "), `${order}It built ${builtN} pairs, in orange, following the same path through the old list, in bold, and ${copied}`);
}

function doGet(x) {
  finish();
  const before = now();
  const res = get(x, before);
  const naive = naiveGet(x, spine(before).diffs);
  const n = res.path.length;
  const op = `get(${html(x)}) <code class="path">${parenSpans(res.path, (i) => (i + 1) * STEP - STEP / 2)}</code>`;
  if (x === undefined || n === 0) return say("get(0)", "Getting 0 leaves the list as it is.");
  if (!res.list) {
    const c = res.path[res.fell];
    say(
      op,
      `It falls off at step ${res.fell + 1}: there's no ${c === "(" ? "left" : "right"} edge to follow there, so ${html(x)} isn't a place in this list. The naive list agrees: ${html(x)} ${naive.past ? "runs past the last place" : "lands inside a gap between two places"}. Nothing changes.`,
    );
    pending = { commit: () => draw(now()), timer: 0, frame: 0 };
    draw(before, { kind: "walk", res });
    pending.timer = setTimeout(() => (pending = null), (res.fell + 2) * STEP);
    return;
  }
  say(
    op,
    `${n} steps through the pairs, one per parenthesis. The naive list would look at ${naive.steps} difference${naive.steps === 1 ? "" : "s"}. Everything before the new head is gone from this list, but not from the old one: <kbd>U</kbd> brings it back.`,
  );
  const commit = () => {
    hist.push({ list: res.list, op: `g${show(x)}` });
    draw(res.list, { kind: "got" });
    readout();
  };
  pending = { commit, timer: 0, frame: 0 };
  draw(before, { kind: "walk", res, after: res.list });
  pending.timer = setTimeout(finish, (res.visited.length + 1) * STEP + 150);
}

function undo() {
  finish();
  if (hist.length < 2) return;
  const gone = hist.pop();
  draw(now());
  readout();
  say("", `Back before <code>${gone.op[0] === "p" ? "put" : "get"}(${html(parse(gone.op.slice(1)))})</code>. Nothing was ever changed in place, so the old list was there all along.`);
}

function example(i) {
  finish();
  const ex = EXAMPLES[i];
  load(ex.ops);
  draw(now());
  readout();
  const next = ex.next ? ` <button class="try" data-get="${ex.next}">Try get(${html(parse(ex.next))})</button>` : "";
  say("", ex.text + next);
  document.querySelectorAll("#examples button").forEach((b, j) => b.classList.toggle("on", j === i));
}

// ---- Wiring ----

for (const s of PUTS) {
  const li = document.createElement("li");
  const b = document.createElement("button");
  const x = parse(s);
  b.innerHTML = html(x);
  b.title = `put(${show(x)})`;
  b.addEventListener("click", () => doPut(x));
  li.append(b);
  $("put-chips").append(li);
}

EXAMPLES.forEach((ex, i) => {
  const b = document.createElement("button");
  b.textContent = ex.name;
  b.addEventListener("click", () => example(i));
  $("examples").append(b);
});

function ask(form, input, then) {
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    try {
      then(parse(input.value));
      input.classList.remove("bad");
      input.title = "";
    } catch (err) {
      input.classList.add("bad");
      input.title = err.message;
      say("", `<span class="err">${err.message}</span>: write an ordinal like ω+1, w^2, or ω^ω·2.`);
    }
  });
}
ask($("put-form"), $("put-in"), doPut);
ask($("get-form"), $("get-in"), doGet);

$("caption").addEventListener("click", (e) => {
  const b = e.target.closest("button.try");
  if (b) doGet(parse(b.dataset.get));
});
$("undo").addEventListener("click", undo);
addEventListener("keydown", (e) => {
  if (e.target.closest("input") || e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.key === "u" || e.key === "U") undo();
});
let resizeTimer = 0;
addEventListener("resize", () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => !pending && draw(now()), 150);
});

// Start from the URL's steps, or the post's first list.
const fromHash = decodeURIComponent(location.hash.slice(1));
if (fromHash) {
  try {
    load(fromHash.split("."));
    draw(now());
    readout();
    say("", "Your list, from the URL. Pick a list below to start over.");
  } catch {
    example(0);
  }
} else example(0);
