// Transfinite zippers, as the post "Transfinite Zippers" (asvarga.com, 2023)
// describes them: a rose tree of zipper lists, where every list remembers the
// child it last had in focus, and move(n·ω^e) climbs e generations, steps n
// along that ancestor's list, and comes back down through the chosen children.
//
// The state is kept by what it holds, and cells() works out from it the cells
// the post's figures draw (a trie of parentheses with kept branches). A position is the integer coordinate at each exponent e: c[0] along
// the bottom list, c[1] along the list of those (move(ω)), and so on, with
// ω^ω above every finite one. Exponents are numbers; OMEGA stands for ω.
// Nothing here mutates a state: apply() returns a new one.

export const OMEGA = 99;
export const EXPONENTS = [0, 1, 2, 3, OMEGA];

const SUP = "⁰¹²³⁴⁵⁶⁷⁸⁹";

// ω^e as text (`html` puts ω^ω's exponent in a <sup>).
export function power(e, html = false) {
  if (e === 0) return "1";
  if (e === 1) return "ω";
  if (e === OMEGA) return html ? "ω<sup>ω</sup>" : "ω^ω";
  return "ω" + [...String(e)].map((d) => SUP[d]).join("");
}

// n·ω^e as text, written the ordinal way (ω·2, not 2ω), with its sign.
export function term(e, n, html = false) {
  const sign = n < 0 ? "−" : "";
  const k = Math.abs(n);
  if (e === 0) return sign + k;
  return sign + power(e, html) + (k === 1 ? "" : `·${k}`);
}

// A move's terms, highest first, as one ordinal: "ω − 2", "−ω^ω".
export function moveText(terms, html = false) {
  if (!terms.length) return "0";
  return terms
    .map(([e, n], i) => {
      const t = term(e, n, html);
      if (i === 0) return t;
      return n < 0 ? ` − ${t.slice(1)}` : ` + ${t}`;
    })
    .join("");
}

// The bounded-parentheses path for ω^e (the post's vine): ω^a is ( path(a) ).
// With \ and / for ( and ): 1 is \/, ω is \\//, ω² is \\/\//.
export function path(e) {
  // ω^a·n + b is ( path(a) ) n times, then path(b); a finite k is ω^0·k.
  const of = (x) => (x === OMEGA ? "(" + of(1) + ")" : "()".repeat(x));
  return ("(" + of(e) + ")").replaceAll("(", "\\").replaceAll(")", "/");
}

// ---- positions ----

const at = (pos, e) => pos[e] ?? 0;

// The coordinates at exponents >= e, as a key: the node that many generations up.
export function prefixKey(pos, e) {
  return Object.keys(pos)
    .map(Number)
    .filter((x) => x >= e && pos[x] !== 0)
    .sort((a, b) => b - a)
    .map((x) => `${x}:${pos[x]}`)
    .join(",");
}

export const posKey = (pos) => prefixKey(pos, 0);

// The node at exponent e over pos: its generation and where it is.
const nodeKey = (pos, e) => `${e}|${prefixKey(pos, e)}`;

function below(pos, e) {
  const out = {};
  for (const x of Object.keys(pos).map(Number)) if (x < e && pos[x] !== 0) out[x] = pos[x];
  return out;
}

function above(pos, e) {
  const out = {};
  for (const x of Object.keys(pos).map(Number)) if (x > e && pos[x] !== 0) out[x] = pos[x];
  return out;
}

// ---- states ----

// focus: where we stand. used: exponents ever moved along (0 always), sorted.
// values: posKey -> value. visited: posKey -> pos, every place ever stood on.
// chosen: nodeKey(pos, e) -> the coordinates below e that node last had in focus.
export function empty() {
  return remember({ focus: {}, used: [0], values: new Map(), visited: new Map([["", {}]]), chosen: new Map() });
}

function remember(s) {
  for (const e of s.used) if (e > 0) s.chosen.set(nodeKey(s.focus, e), below(s.focus, e));
  return s;
}

function clone(s) {
  return { focus: s.focus, used: s.used, values: new Map(s.values), visited: new Map(s.visited), chosen: new Map(s.chosen) };
}

// One step: { set: "E" } puts a value at the focus; { move: [[e, n], ...] }
// moves by the ordinal n₁·ω^e₁ + n₂·ω^e₂ + …, one term at a time, highest first.
export function apply(s, op) {
  const t = clone(s);
  if (op.set !== undefined) {
    if (op.set === null) t.values.delete(posKey(t.focus));
    else t.values.set(posKey(t.focus), op.set);
    return t;
  }
  for (const [e, n] of op.move) {
    if (!n) continue;
    if (!t.used.includes(e)) remember(Object.assign(t, { used: [...t.used, e].sort((a, b) => a - b) }));
    const to = above(t.focus, e);
    if (at(t.focus, e) + n !== 0) to[e] = at(t.focus, e) + n;
    const focus = { ...to, ...(t.chosen.get(nodeKey(to, e)) ?? {}) };
    t.focus = focus;
    t.visited.set(posKey(focus), focus);
    remember(t);
  }
  return t;
}

export const run = (ops, s = empty()) => ops.reduce(apply, s);

export const valueAt = (s, pos) => s.values.get(posKey(pos));

// The move that takes the focus to pos: at each exponent, highest first, the
// step from where the previous terms land to pos's coordinate.
export function moveTo(s, pos) {
  const terms = [];
  let t = s;
  for (const e of [...t.used].reverse()) {
    const n = at(pos, e) - at(t.focus, e);
    if (n) {
      terms.push([e, n]);
      t = apply(t, { move: [[e, n]] });
    }
  }
  return terms;
}

// What the focus reaches: every value, with the move to it, nearest first.
export function reach(s) {
  const out = [];
  for (const [k, v] of s.values) {
    const terms = moveTo(s, s.visited.get(k));
    out.push({ value: v, key: k, pos: s.visited.get(k), terms });
  }
  const size = (terms) => terms.map(([e, n]) => [e, Math.abs(n)]);
  const cmp = (a, b) => {
    const x = size(a.terms);
    const y = size(b.terms);
    for (let i = 0; i < Math.max(x.length, y.length); i++) {
      const [ea, na] = x[i] ?? [-1, 0];
      const [eb, nb] = y[i] ?? [-1, 0];
      if (ea !== eb) return ea - eb;
      if (na !== nb) return na - nb;
    }
    return 0;
  };
  return out.sort(cmp);
}

// ---- the tree ----

// The structure as nested lists, for drawing. A list at row r (exponent
// used[r]) holds items by coordinate, from the least to the greatest visited,
// with any coordinates between as gaps. Each item is a list one row down, or a
// leaf at row 0. `chosen` is the coordinate the list remembers; `focused` says
// whether the focus is inside.
export function tree(s) {
  const rows = s.used;
  const all = [...s.visited.values()];
  const build = (r, pre) => {
    const e = rows[r];
    const inside = all.filter((p) => rows.every((x) => x <= e || at(p, x) === at(pre, x)));
    const cs = [...new Set(inside.map((p) => at(p, e)))].sort((a, b) => a - b);
    const focused = rows.every((x) => x <= e || at(s.focus, x) === at(pre, x));
    const chosen = focused ? at(s.focus, e) : r + 1 < rows.length ? at(s.chosen.get(nodeKey(pre, rows[r + 1])) ?? {}, e) : 0;
    const items = [];
    for (let c = cs[0]; c <= cs.at(-1); c++) {
      const pos = { ...above(pre, e) };
      if (c) pos[e] = c;
      if (!cs.includes(c)) {
        // A run of coordinates nobody stood on: one gap for the whole run.
        const next = cs.find((x) => x > c);
        items.push({ c, gap: next - c, pos });
        c = next - 1;
        continue;
      }
      const child = r === 0 ? { leaf: true, pos, value: valueAt(s, pos), focus: posKey(pos) === posKey(s.focus) } : build(r - 1, pos);
      items.push({ c, pos, child });
    }
    return { row: r, exp: e, pre, chosen, focused, items };
  };
  return build(rows.length - 1, {});
}

// ---- the post's cells ----

// The post draws its implementation: from the house, a vine of green trie
// nodes goes up, one edge per parenthesis of each move's path (\ up-left, /
// up-right), and ends each path(e) at the e-list's chosen diamond. Paths share
// their prefixes, so the vine is a trie. An element off the focus keeps its
// structure "inside out": going down its path, every \ after the first is a
// blue node holding the / branch left behind there (the lists below e, which
// may be none) and pointing on down, to the next blue or the value.
//
// cells(s) lays that out: every node has a rank (0 is the values' row) and an
// x in units, and edges are "vine" (the focus's own trie, pointing up), "up"
// (a kept trie), "list" (along a list, away from its chosen child) or "down".

const PATHS = Object.fromEntries(EXPONENTS.map((e) => [e, path(e)]));
const balance = (p) => [...p].reduce((b, c) => b + (c === "/" ? 1 : -1), 0);

// The coordinates at e of every visited place that agrees with q above e.
function coordsAt(s, q, e) {
  const xs = new Set();
  for (const p of s.visited.values()) if (s.used.every((x) => x <= e || at(p, x) === at(q, x))) xs.add(at(p, e));
  return [...xs].sort((a, b) => a - b);
}

// The lists above q that have more than one child: the ones the post draws.
const lists = (s, q) => s.used.filter((e) => coordsAt(s, q, e).length > 1);

// The place an element (its coordinates at e and above) last had in focus.
function inside(s, pos, e) {
  if (e === 0) return pos;
  const own = { ...above(pos, e) };
  if (at(pos, e)) own[e] = at(pos, e);
  return { ...own, ...(s.chosen.get(nodeKey(pos, e)) ?? {}) };
}

const LEAF_GAP = 2.5; // the least room between two values, in units
const NODE_GAP = 1.6; // the least room between two nodes in a rank

// Two nodes over one value, on one rank, too close together.
function clashes(nodes) {
  const seen = new Map();
  for (const n of nodes.values()) {
    const k = `${n.anchor}|${n.rank}`;
    for (const m of seen.get(k) ?? []) if (Math.abs(m.dx - n.dx) < NODE_GAP) return [m, n];
    seen.set(k, [...(seen.get(k) ?? []), n]);
  }
  return null;
}

export function cells(s) {
  const nodes = new Map(); // key -> { kind, anchor, dx, rank, ... }
  const edges = []; // { from, to, kind }
  const below = []; // [lo, hi]: lo's rank must be under hi's
  const rows = []; // keys that share a rank: one list's diamonds
  const zips = new Map(); // anchor -> [[e, dark key]]: lists over one value, lower first
  const add = (key, n) => (nodes.set(key, { key, rank: 0, dx: 0, ...n }), key);
  const edge = (from, to, kind) => {
    edges.push({ from, to, kind });
    if (kind === "down") below.push([to, from]);
    else if (kind !== "list") below.push([from, to]);
  };

  const leaf = (q) => {
    const k = posKey(q);
    const focus = k === posKey(s.focus);
    return add(`L${k}`, { kind: focus ? "house" : s.values.has(k) ? "bucket" : "blank", anchor: `L${k}`, value: s.values.get(k), pos: q });
  };

  // The trie of the paths to lists `es` over q, from prefix `base` (whose node
  // is `from`) on: greens for prefixes, a list for each whole path.
  const trie = (q, es, base, from, tag, kind) => {
    const anchor = `L${posKey(q)}`;
    const keyOf = (p) => (p === base ? from : `g${tag}|${p}`);
    for (const e of es) {
      const p = PATHS[e];
      for (let i = base.length + 1; i <= p.length; i++) {
        const pre = p.slice(0, i);
        const key = i === p.length ? list(q, e, kind) : `g${tag}|${pre}`;
        if (i < p.length && !nodes.has(key)) add(key, { kind: "green", anchor, dx: balance(pre), rank: i, vine: kind === "vine" });
        if (!edges.some((x) => x.from === keyOf(p.slice(0, i - 1)) && x.to === key)) edge(keyOf(p.slice(0, i - 1)), key, kind);
      }
    }
  };

  // The e-list over q: its chosen diamond (q's own element) and the rest,
  // each pointing down to what it keeps. Returns the chosen diamond's key.
  const list = (q, e, kind) => {
    const anchor = `L${posKey(q)}`;
    const own = at(q, e);
    const dark = add(`D${nodeKey(q, e)}`, { kind: "chosen", anchor, rank: PATHS[e].length, exp: e, vine: kind === "vine" });
    if (!zips.has(anchor)) zips.set(anchor, []);
    zips.get(anchor).push([e, dark]);
    const cs = coordsAt(s, q, e);
    const keys = [];
    for (let i = 0; i < cs.length; i++) {
      const c = cs[i];
      const pos = { ...above(q, e) };
      if (c) pos[e] = c;
      if (c === own) keys.push(dark);
      else {
        const top = element(pos, e);
        const key = add(`D${nodeKey(pos, e)}`, { kind: "diamond", anchor: nodes.get(top.leaf).anchor, exp: e });
        edge(key, top.key, "down");
        for (const k of top.inner) below.push([k, key]);
        keys.push(key);
      }
      if (i + 1 < cs.length && cs[i + 1] > c + 1) {
        // Places between that nobody stood on: one empty diamond for the run.
        const gpos = { ...above(q, e), [e]: c + 1 };
        const g = add(`G${e}|${posKey(gpos)}`, { kind: "gap", anchor: `G${e}|${posKey(gpos)}`, n: cs[i + 1] - c - 1 });
        const d = add(`D${e}|gap|${posKey(gpos)}`, { kind: "empty", anchor: g, exp: e });
        keys.push(d);
      }
    }
    rows.push(keys);
    const ci = keys.indexOf(dark);
    for (let i = ci - 1; i >= 0; i--) edge(keys[i + 1], keys[i], "list");
    for (let i = ci + 1; i < keys.length; i++) edge(keys[i - 1], keys[i], "list");
    return dark;
  };

  // A non-chosen element of an e-list: the chain of blues down to the value it
  // last had in focus. Returns its top, its value, and every key inside it.
  const element = (pos, e) => {
    const before = new Set(nodes.keys());
    const q = inside(s, pos, e);
    const value = leaf(q);
    let top = value;
    const p = PATHS[e];
    const es = lists(s, q).filter((x) => x < e);
    const tag = nodeKey(pos, e);
    for (let k = 1; k < p.length; k++) {
      if (p[k] !== "\\") continue;
      const pre = p.slice(0, k);
      const blue = add(`B${tag}|${k}`, { kind: "blue", anchor: value, dx: balance(pre), rank: k });
      edge(blue, top, "down");
      const kept = es.filter((x) => PATHS[x].startsWith(pre + "/"));
      if (kept.length) trie(q, kept, pre, blue, `${tag}|${k}`, "up");
      top = blue;
    }
    return { key: top, leaf: value, inner: [...nodes.keys()].filter((k) => !before.has(k)) };
  };

  const house = leaf(s.focus);
  trie(s.focus, lists(s, s.focus), "", house, "v", "vine");

  // Over one value, a higher list sits above a lower one.
  for (const zs of zips.values()) {
    zs.sort((a, b) => a[0] - b[0]);
    for (let i = 1; i < zs.length; i++) below.push([zs[i - 1][1], zs[i][1]]);
  }

  // Ranks: as low as the rules allow, each list on one rank, then each green
  // as high as it goes, just under what it leads to. Two nodes over one value
  // that meet on a rank are pulled apart (the green, or the deeper, goes up),
  // and the ranks are worked out again.
  for (const n of nodes.values()) n.depth = n.rank;
  const rank = (k) => nodes.get(k).rank;
  const set = (k, r) => (nodes.get(k).rank = r);
  for (let tries = 0; tries < 50; tries++) {
    for (const n of nodes.values()) n.rank = n.depth;
    for (let changed = true; changed; ) {
      changed = false;
      for (const [lo, hi] of below) if (rank(hi) <= rank(lo)) (set(hi, rank(lo) + 1), (changed = true));
      for (const row of rows) {
        const r = Math.max(...row.map(rank));
        for (const k of row) if (rank(k) !== r) (set(k, r), (changed = true));
      }
    }
    const ups = new Map();
    for (const [lo, hi] of below) ups.set(lo, [...(ups.get(lo) ?? []), hi]);
    for (let changed = true; changed; ) {
      changed = false;
      for (const [k, n] of nodes) {
        if (n.kind !== "green") continue;
        const r = Math.min(...ups.get(k).map(rank)) - 1;
        if (r > n.rank) (set(k, r), (changed = true));
      }
    }
    const clash = clashes(nodes);
    if (!clash) break;
    const [a, b] = clash;
    const up = a.kind === "green" && b.kind !== "green" ? a : b.kind === "green" && a.kind !== "green" ? b : a.depth >= b.depth ? a : b;
    below.push([(up === a ? b : a).key, up.key]);
  }

  // x: values left to right, each far enough from the last that nothing
  // anchored over it meets anything before it on the same rank.
  const slots = [];
  const walk = (t) => {
    for (const it of t.items) {
      if (it.gap) slots.push(`G${t.exp}|${posKey(it.pos)}`);
      else if (it.child.leaf) slots.push(`L${posKey(it.pos)}`);
      else walk(it.child);
    }
  };
  walk(tree(s));
  const byAnchor = new Map();
  for (const n of nodes.values()) byAnchor.set(n.anchor, [...(byAnchor.get(n.anchor) ?? []), n]);
  const right = new Map(); // rank -> the rightmost x so far
  let last = -Infinity;
  for (const a of slots) {
    const ns = byAnchor.get(a) ?? [];
    let x = last + LEAF_GAP;
    for (const n of ns) if (right.has(n.rank)) x = Math.max(x, right.get(n.rank) + NODE_GAP - n.dx);
    if (last === -Infinity) x = -Math.min(0, ...ns.map((n) => n.dx));
    for (const n of ns) {
      n.x = x + n.dx;
      right.set(n.rank, Math.max(right.get(n.rank) ?? -Infinity, n.x));
    }
    last = x;
  }
  return { nodes, edges };
}

// ---- the post's figures ----

const m = (e, n) => ({ move: [[e, n]] });
const set = (v) => ({ set: v });

// The values A, B, C, D bound in order, so D is in focus and C, B, A are 1, 2, 3 on.
export const START = [set("A"), m(0, -1), set("B"), m(0, -1), set("C"), m(0, -1), set("D")];

// Each figure of the post, as the steps that reach it from the one before.
export const FIGURES = [
  { fig: 1, ops: [] },
  { fig: 2, ops: [m(0, 1)] },
  { fig: 3, ops: [m(0, 1)] },
  { fig: 4, ops: [m(1, -1), set("E")] },
  { fig: 5, ops: [m(0, -1), set("F"), m(0, -1), set("G"), m(0, 1)] },
  { fig: 6, ops: [m(1, 1)] },
  { fig: 7, ops: [m(0, -1), m(1, -1)] },
  { fig: 8, ops: [m(2, -1), set("H")] },
  { fig: 9, ops: [m(2, 1)] },
  { fig: 10, ops: [m(OMEGA, -1), set("I")] },
  { fig: 11, ops: [m(OMEGA, 1)] },
];

// The leaves in order, left to right, as the figures draw them.
export function leaves(s) {
  const out = [];
  const walk = (node) => {
    for (const it of node.items) {
      if (it.gap) out.push(null);
      else if (it.child.leaf) out.push(it.child);
      else walk(it.child);
    }
  };
  walk(tree(s));
  return out;
}
