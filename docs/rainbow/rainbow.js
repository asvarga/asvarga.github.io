// Rainbow lists, as in "Pure Lists with O(log(i)) Indexing" (asvarga.com, 2020):
// a linked list whose node i (counting from the tail, which is 1) also points
// back by 2^k/2 (red), 2^k (green), 2^(k+1) (blue), where 2^k is the largest
// power of two dividing i, and has a yellow pointer that only helps build the
// red ones in O(1). Pure functions over indices; app.js draws them.

/** The largest power of two dividing i: green's reach. */
export const dG = (i) => i & -i;
export const dR = (i) => dG(i) >> 1;
export const dB = (i) => dG(i) << 1;

/** Where each shortcut lands, as arithmetic on the index. */
export const R = (i) => i - dR(i);
export const G = (i) => i - dG(i);
export const B = (i) => i - dB(i);
export const Y = (i) => R(i + dG(i));

/** k, for green's 2^k: the node's height in the post's tree picture. */
export const height = (i) => 31 - Math.clz32(dG(i));

export const KINDS = ["n", "r", "g", "b", "y"];
export const NAMES = { n: "next", r: "red", g: "green", b: "blue", y: "yellow" };

/** Node i's pointers, each a node index or 0 for none. Red is none on odd
 *  nodes (its reach would be zero), yellow none where it would point home. */
export function pointers(i) {
  const fit = (t) => (t >= 1 && t < i ? t : 0);
  return { n: fit(i - 1), r: dR(i) ? fit(R(i)) : 0, g: fit(G(i)), b: fit(B(i)), y: Y(i) !== i ? fit(Y(i)) : 0 };
}

/** Every pointer of nodes 1..n whose kind is in kinds, as {from, to, kind}. */
export function arcs(n, kinds = KINDS) {
  const out = [];
  for (let i = 1; i <= n; i++) {
    const p = pointers(i);
    for (const k of kinds) if (p[k]) out.push({ from: i, to: p[k], kind: k });
  }
  return out;
}

/** The post's seek, from node i to node j (j <= i): prefer green, then blue,
 *  then red, then next, taking a shortcut only if it doesn't overshoot j and a
 *  green hop after it wouldn't overshoot j's own green hop. Each hop is
 *  {from, to, kind}; a red on an odd node is its next pointer. */
export function seek(i, j) {
  const path = [];
  const fits = (t) => t >= j && G(t) >= G(j);
  while (i > j) {
    let kind = "n";
    if (fits(G(i))) kind = "g";
    else if (fits(B(i))) kind = "b";
    else if (fits(R(i))) kind = dR(i) ? "r" : "n";
    const to = kind === "n" ? i - 1 : { g: G, b: B, r: R }[kind](i);
    path.push({ from: i, to, kind });
    i = to;
  }
  return path;
}

/** With green shortcuts alone the arcs never cross, so greedy works: take
 *  green unless it overshoots, else next. O(log(i)^2) hops. */
export function seekGreen(i, j) {
  const path = [];
  while (i > j) {
    const to = G(i) >= j ? G(i) : i - 1;
    path.push({ from: i, to, kind: G(i) >= j ? "g" : "n" });
    i = to;
  }
  return path;
}

/** Greedy, as the owner's later RainbowList package seeks (rainbowlist/main.py,
 *  2022): take the first of yellow, green, red that doesn't overshoot j, else
 *  next. No blue and no look-ahead, so each hop needs only its own pointers.
 *  Over every list up to 256 long, seeking from the head, it takes slightly
 *  fewer hops in all than the post's seek, and its worst is one less. */
export function seekGreedy(i, j) {
  const path = [];
  while (i > j) {
    let kind = "n";
    if (Y(i) < i && Y(i) >= j) kind = "y";
    else if (G(i) >= j) kind = "g";
    else if (dR(i) && R(i) >= j) kind = "r";
    const to = kind === "n" ? i - 1 : { y: Y, g: G, r: R }[kind](i);
    path.push({ from: i, to, kind });
    i = to;
  }
  return path;
}

/** A plain linked list: one hop per item. */
export function seekNext(i, j) {
  const path = [];
  for (; i > j; i--) path.push({ from: i, to: i - 1, kind: "n" });
  return path;
}

/** Ties between equally short paths go to the longest reach first. */
const PREFER = ["y", "g", "b", "r", "n"];

/** The shortest path on all five pointers, by brute force: every node from j
 *  up to i learns its distance to j from the nodes its pointers reach, then
 *  the path is read back from i. O(i − j) work, so it's no use as a real seek;
 *  it's the floor the others are measured against. */
export function seekOptimal(i, j) {
  const d = new Int32Array(i - j + 1); // d[x − j]: hops from x to j
  for (let x = j + 1; x <= i; x++) {
    const p = pointers(x);
    let best = Infinity;
    for (const k of PREFER) if (p[k] >= j) best = Math.min(best, d[p[k] - j] + 1);
    d[x - j] = best;
  }
  const path = [];
  while (i > j) {
    const p = pointers(i);
    const kind = PREFER.find((k) => p[k] >= j && d[p[k] - j] === d[i - j] - 1);
    path.push({ from: i, to: p[kind], kind });
    i = p[kind];
  }
  return path;
}

/** The trailing zeros of x: its height, as a number of bits. */
const tz = (x) => 31 - Math.clz32(x & -x);

/** Planned seek: the shortest path over a few candidate nodes, found by
 *  arithmetic before a single pointer is followed (agent 141's planner).
 *
 *  Candidates: at each bit level p, the multiples of 2^p within BAND steps of
 *  i's and of j's own prefix, ⌊i/2^p⌋·2^p and ⌊j/2^p⌋·2^p, that lie in j..i.
 *  Edges between them: the five real pointers; a run of blues, which keeps a
 *  node's height and steps 2^(h+1) at a time; and next-then-greens, which
 *  takes x to x − 1, x − 2, x − 4, …, x − 2^t (t + 1 hops), then a run of
 *  blues, tried only where at most RUN blues are left before j. Distances fill
 *  in from j upwards, and the shortcut steps expand back into real hops.
 *
 *  O(log d) candidates with O(1) edges each, so O(log d) work, and every path
 *  it returns is real pointers. On every pair tested it is as short as
 *  seekOptimal's, but that is measured, not proved. */
export function seekPlanned(i, j, BAND = 6, RUN = 4) {
  if (i <= j) return [];
  // Levels above 2^p > 2(i − j) hold at most one node in j..i, the highest,
  // which a lower level's band already has.
  const S = new Set([i, j]);
  for (let p = 0, P = 1; P <= 2 * (i - j); p++, P *= 2) {
    for (const base of [i, j]) {
      for (let c = -BAND; c <= BAND; c++) {
        const v = (Math.floor(base / P) + c) * P;
        if (v >= j && v <= i) S.add(v);
      }
    }
  }
  const nodes = [...S].sort((a, b) => a - b);
  const dist = new Map([[j, 0]]);
  const how = new Map(); // node -> its first step: { kind, to } or { drop, mid, to }
  const level = new Map(); // height -> candidates done
  // The best blue run from y (height h) down to a candidate already done.
  const blues = (y, h) => {
    let best = null;
    for (const q of level.get(h) ?? []) {
      const gap = y - q;
      if (gap >= 0 && gap % 2 ** (h + 1) === 0) {
        const cost = gap / 2 ** (h + 1) + dist.get(q);
        if (!best || cost < best.cost) best = { cost, to: q };
      }
    }
    return best;
  };
  for (const x of nodes) {
    if (x !== j) {
      let best = { cost: Infinity };
      const p = pointers(x);
      for (const k of PREFER) {
        if (p[k] >= j && dist.has(p[k]) && dist.get(p[k]) + 1 < best.cost) best = { cost: dist.get(p[k]) + 1, kind: k, to: p[k] };
      }
      const run = blues(x, tz(x));
      if (run && run.cost < best.cost) best = { cost: run.cost, drop: -1, mid: x, to: run.to };
      for (let t = 0; t < tz(x); t++) {
        const y = x - 2 ** t;
        if (y < j || (y - j) / 2 ** (t + 1) > RUN) continue;
        const r = blues(y, t);
        if (r && r.cost + t + 1 < best.cost) best = { cost: r.cost + t + 1, drop: t, mid: y, to: r.to };
      }
      dist.set(x, best.cost);
      how.set(x, best);
    }
    const h = tz(x);
    if (!level.has(h)) level.set(h, []);
    level.get(h).push(x);
  }
  // Expand each step into the pointers it stands for.
  const path = [];
  const hop = (from, kind) => {
    const to = pointers(from)[kind];
    path.push({ from, to, kind });
    return to;
  };
  for (let x = i; x !== j; ) {
    const step = how.get(x);
    if (step.kind) {
      x = hop(x, step.kind);
      continue;
    }
    if (step.drop >= 0) {
      x = hop(x, "n");
      while (x > step.mid) x = hop(x, "g");
    }
    while (x > step.to) x = hop(x, "b");
  }
  return path;
}

export const SEEKS = { next: seekNext, green: seekGreen, rainbow: seek, greedy: seekGreedy, planned: seekPlanned, optimal: seekOptimal };
export const MODE_KINDS = { next: ["n"], green: ["n", "g"], rainbow: KINDS, greedy: ["n", "r", "g", "y"], planned: KINDS, optimal: KINDS };

/** What each mode costs, as d = i − j grows: hops followed, and work done
 *  (arithmetic, including any planning). */
export const BOUNDS = {
  next: { hops: "d", work: "O(d)", basis: "One hop per item." },
  green: { hops: "O(log² d)", work: "O(log² d)", basis: "Green arcs nest, so greedy is exact for them; O(1) work a hop." },
  rainbow: { hops: "Θ(log d)", work: "Θ(log d)", basis: "The post's three phases; from the head of a 2ᴷ − 1 list the worst is 3K − 6. O(1) work a hop." },
  greedy: { hops: "Θ(log² d)", work: "Θ(log² d)", basis: "Shortest on its own pointers (no blue), and from the head of a 2ᴷ − 1 list the worst is (K/2)². O(1) work a hop." },
  planned: { hops: "Θ(log d)", work: "O(log d)", basis: "O(1) candidates a bit level, O(1) edges each. Shortest on every pair tested (about 2 hops a bit at worst): measured, not proved." },
  optimal: { hops: "Θ(log d), the least", work: "O(d)", basis: "Every node from j to i, five pointers each: exact by definition, so no use as a real seek." },
};

/** The post's three phases of a seek: maybe one next, a climb of greens and
 *  blues, then a descent of reds and blues, never two blues in a row. Returns
 *  each hop's phase ("first", "up", "down"), or null if the path breaks them. */
export function phases(path) {
  const s = path.map((h) => h.kind).join("");
  if (!/^n?[gb]*[rb]*$/.test(s) || s.includes("bb")) return null;
  const out = [];
  let up = true;
  path.forEach((h, k) => {
    if (h.kind === "r") up = false;
    out.push(k === 0 && h.kind === "n" ? "first" : up ? "up" : "down");
  });
  // A blue is in the climb until the first red turns the path down.
  return out;
}

/** Building node i in O(1), as the post's cons does: each pointer is a short
 *  walk along pointers older nodes already have (the yellow one is what makes
 *  red's walk short). Returns each field with the walk, as [{field, expr,
 *  chain, to}], where chain is the nodes visited, starting from i - 1. */
export function cons(i) {
  const at = (t, k) => (t ? pointers(t)[k] : 0);
  const n = i - 1;
  const rows = [{ field: "n", expr: "the old head", chain: [n], to: n }];
  let r = 0;
  let g;
  let b;
  if (i % 2) {
    rows.push({ field: "r", expr: "none on odd nodes", chain: [], to: 0 });
    g = n;
    rows.push({ field: "g", expr: "n", chain: [n], to: g });
    b = at(n, "n");
    rows.push({ field: "b", expr: "n.n", chain: [n, b], to: b });
  } else {
    const ny = at(n, "y");
    r = ny || n;
    rows.push(ny ? { field: "r", expr: "n.y", chain: [n, r], to: r } : { field: "r", expr: "n (n has no yellow)", chain: [n], to: r });
    g = at(r, "g");
    rows.push({ field: "g", expr: "r.g", chain: [n, r, g], to: g });
    const rb = at(r, "b");
    b = G(i) ? at(rb, "g") : 0;
    rows.push(G(i) ? { field: "b", expr: "r.b.g", chain: [n, r, rb, b], to: b } : { field: "b", expr: "none: i is a power of two", chain: [], to: 0 });
  }
  if (Y(i) !== i) {
    const gy = at(g, "y");
    const y = gy || g;
    rows.push({ field: "y", expr: gy ? "g.y" : "g (g has no yellow)", chain: gy ? [n, g, y] : [n, g], to: y });
  } else {
    rows.push({ field: "y", expr: "none: it would point home", chain: [], to: 0 });
  }
  // Where a pointer is n itself, the walk doesn't move.
  for (const row of rows) row.chain = row.chain.filter((t, k) => t && t !== row.chain[k - 1]);
  return rows;
}
