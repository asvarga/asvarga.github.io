// Efficient transfinite lists: a port of the post's Racket
// (github.com/asvarga/tf-lists, main.rkt). A list is a pair (l . r) or NIL,
// and an ordinal's path is its balanced parentheses (1 is (), ω is (())).
// get(n) follows n's path from the head, ( to the left of a pair and ) to the
// right. put(ω^a) builds a new path for ω^a while following the same path
// through the old list, and where it goes right it copies the old path's left
// edge, so the new peaks can skip ahead.
//
// Pairs are interned, so equal structures are the same object (as the
// Racket's memoized drawing treats them), and === compares them.

import { add, bpNaive, cmp, sub, term, ZERO } from "./ordinals.js";

/** The empty list, and the end of every list. */
export const NIL = Object.freeze({ id: 0, l: null, r: null });

const interned = new Map();

export function pair(l, r) {
  const key = `${l.id},${r.id}`;
  let p = interned.get(key);
  if (!p) {
    p = Object.freeze({ id: interned.size + 1, l, r });
    interned.set(key, p);
  }
  return p;
}

/** The Racket's l and r: NIL past the end. */
export const left = (p) => (p === NIL ? NIL : p.l);
export const right = (p) => (p === NIL ? NIL : p.r);

/** An ordinal's path: ω+1 is (())(). */
export const path = (x) => bpNaive(x);

/** x as the powers it adds, highest first: ω²·2+1 is ω², ω², 1. */
export function powers(x) {
  return x.terms.flatMap(([e, n]) => Array(n).fill(term(e)));
}

/**
 * The edge a step takes, or null where there's none. A pair's left is an
 * edge when it isn't NIL; its right is one when it isn't NIL, and to the end
 * from a peak (NIL . NIL). The drawing has the same edges.
 */
export function step(p, c) {
  if (p === NIL) return null;
  if (c === "(") return p.l === NIL ? null : p.l;
  if (p.r !== NIL) return p.r;
  return p.l === NIL ? NIL : null;
}

/**
 * put(ω^a, L), as the Racket's put, with what each step did: the path's
 * character, the node it built, the node it followed (NIL off the old list),
 * and whether it copied a left edge.
 */
export function putPower(power, L) {
  if (power.terms.length !== 1 || power.terms[0][1] !== 1) throw new Error("put one power at a time");
  const ps = path(power);
  const steps = [];
  const go = (i, M) => {
    if (i === ps.length) return L;
    const c = ps[i];
    const s = { c, follow: M };
    steps.push(s);
    s.node = c === "(" ? pair(go(i + 1, left(M)), NIL) : pair(left(M), go(i + 1, right(M)));
    s.copied = c === ")" && left(M) !== NIL;
    return s.node;
  };
  const list = go(0, L);
  return { power, path: ps, list, steps };
}

/** put(x, L) for any x: its powers, last first, since put(α+β) = put(α)∘put(β). */
export function put(x, L) {
  const rounds = [];
  for (const p of powers(x).reverse()) {
    rounds.push(putPower(p, L));
    L = rounds.at(-1).list;
  }
  return { list: L, rounds };
}

/**
 * get(x, L): follow x's path. visited is every node stood on, from L; list is
 * where it ends, or null if a step had no edge (x isn't a place in L), and
 * then fell is how many steps went well.
 */
export function get(x, L) {
  const ps = path(x);
  const visited = [L];
  let p = L;
  for (let i = 0; i < ps.length; i++) {
    const q = step(p, ps[i]);
    if (q === null) return { path: ps, visited, list: null, fell: i };
    visited.push((p = q));
  }
  return { path: ps, visited, list: p, fell: -1 };
}

/** Read balanced parentheses back as an ordinal: (())() is ω+1. */
export function unpath(s) {
  let i = 0;
  const read = () => {
    let x = ZERO;
    while (s[i] === "(") {
      i++;
      const e = read();
      if (s[i++] !== ")") throw new SyntaxError("unbalanced");
      x = add(x, term(e));
    }
    return x;
  };
  const x = read();
  if (i !== s.length) throw new SyntaxError("unbalanced");
  return x;
}

/**
 * The list's own path: from the head, down a right edge where there is one,
 * else up the left, cutting it where it comes back to the ground. Each cut is
 * one difference, and its nodes are the ground's hollow ones. Copied left
 * edges are never taken, so this walks every node the puts built.
 */
export function spine(L) {
  const diffs = [];
  const hollow = [L];
  let p = L;
  let s = "";
  let h = 0;
  while (p !== NIL) {
    if (p.r !== NIL || p.l === NIL) {
      s += ")";
      p = p.r;
      h--;
    } else {
      s += "(";
      p = p.l;
      h++;
    }
    if (h === 0) {
      diffs.push(unpath(s));
      hollow.push(p);
      s = "";
    }
  }
  return { diffs, hollow };
}

/** Where each hollow node is: 0, then the differences added up. */
export function places(diffs) {
  const out = [ZERO];
  for (const d of diffs) out.push(add(out.at(-1), d));
  return out;
}

/**
 * The Racket's len: always climb where you can. It walks only as many steps
 * as the answer has parentheses, and ends at the last place.
 */
export function len(L) {
  let s = "";
  let p = L;
  while (p !== NIL) {
    if (p.l !== NIL) (s += "("), (p = p.l);
    else (s += ")"), (p = p.r);
  }
  return { path: s, length: unpath(s) };
}

/**
 * Where to draw each node, as the Racket does: NIL at (0, 0), x counting
 * steps back from the end and y the height. A pair sits one step before its
 * right child and one up, or, with no right, one before its left and one down.
 * Edges are { from, to, side, copied }: a copied left edge reaches ahead.
 */
export function layout(L) {
  const at = new Map();
  const edges = [];
  const place = (p) => {
    if (at.has(p.id)) return at.get(p.id);
    let pos;
    if (p === NIL) pos = { x: 0, y: 0 };
    else if (p.r !== NIL) {
      const r = place(p.r);
      pos = { x: r.x + 1, y: r.y + 1 };
      edges.push({ from: p, to: p.r, side: ")" });
      if (p.l !== NIL) place(p.l), edges.push({ from: p, to: p.l, side: "(", copied: true });
    } else if (p.l !== NIL) {
      const l = place(p.l);
      pos = { x: l.x + 1, y: l.y - 1 };
      edges.push({ from: p, to: p.l, side: "(" });
    } else {
      pos = { x: 1, y: 1 };
      place(NIL);
      edges.push({ from: p, to: NIL, side: ")" });
    }
    at.set(p.id, { ...pos, node: p });
    return at.get(p.id);
  };
  place(L);
  return { at, edges };
}

// ---- The post's naive list: the differences themselves ----

/** put on the differences: the powers go on the front. */
export const naivePut = (x, diffs) => [...powers(x), ...diffs];

/**
 * The post's naive get: take differences off the front with left subtraction
 * until x is used up. Fails (list null) where 0 < x < the next difference, or
 * the list runs out (past). steps counts the differences it looked at.
 */
export function naiveGet(x, diffs) {
  let i = 0;
  while (x !== ZERO) {
    if (i === diffs.length) return { list: null, steps: i, past: true };
    if (cmp(diffs[i], x) > 0) return { list: null, steps: i + 1, past: false };
    x = sub(x, diffs[i++]);
  }
  return { list: diffs.slice(i), steps: i };
}

/** The structure for some differences, built by putting them on, last first. */
export function fromDiffs(diffs) {
  let L = NIL;
  for (const d of [...diffs].reverse()) L = putPower(d, L).list;
  return L;
}
