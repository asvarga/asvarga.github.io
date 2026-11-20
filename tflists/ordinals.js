// Ordinals below ε₀ and where to put them on a line: a port of the post's
// Python (github.com/asvarga/ordinals-python, ordinals.py). An ordinal is in
// Cantor normal form, a list of terms [e, n] meaning ω^e·n, exponents strictly
// decreasing; zero is the empty list. Ordinals are interned, so equal ones are
// the same object and === compares them.

const interned = new Map();

function make(terms) {
  const key = terms.map(([e, n]) => `${e.id}:${n}`).join(",");
  let x = interned.get(key);
  if (!x) {
    x = Object.freeze({ terms: Object.freeze(terms), id: interned.size });
    interned.set(key, x);
  }
  return x;
}

export const ZERO = make([]);
export const ONE = make([[ZERO, 1]]);
export const W = make([[ONE, 1]]);
/** ε₀, only ever a bound: bigger than every ordinal here. */
export const EPS = Object.freeze({ terms: null, id: -1 });

export function nat(n) {
  return n ? make([[ZERO, n]]) : ZERO;
}

/** ω^e·n. */
export function term(e, n = 1) {
  return n ? make([[e, n]]) : ZERO;
}

/** Everything after the first term. */
function rest(x) {
  return x.terms.length > 1 ? make(x.terms.slice(1)) : ZERO;
}

/** The first term's exponent: log_ω, rounded down. */
export function lead(x) {
  return x === EPS ? EPS : x.terms.length ? x.terms[0][0] : ZERO;
}

export function isNat(x) {
  return x.terms.length === 0 || x.terms[0][0] === ZERO;
}

export function isLimit(x) {
  return x.terms.length > 0 && x.terms.at(-1)[0] !== ZERO;
}

export function cmp(x, y) {
  if (x === y) return 0;
  if (x === EPS) return 1;
  if (y === EPS) return -1;
  const n = Math.min(x.terms.length, y.terms.length);
  for (let i = 0; i < n; i++) {
    const [xe, xn] = x.terms[i];
    const [ye, yn] = y.terms[i];
    const c = cmp(xe, ye);
    if (c) return c;
    if (xn !== yn) return xn < yn ? -1 : 1;
  }
  return Math.sign(x.terms.length - y.terms.length);
}

export function add(x, y) {
  if (x === ZERO) return y;
  if (y === ZERO) return x;
  const [ye, yn] = y.terms[0];
  const out = [];
  for (const [e, n] of x.terms) {
    const c = cmp(e, ye);
    if (c > 0) out.push([e, n]);
    else {
      if (c === 0) return make([...out, [e, n + yn], ...y.terms.slice(1)]);
      break;
    }
  }
  return make([...out, ...y.terms]);
}

/** Left subtraction: the δ with y + δ = x, or 0 when y > x. */
export function sub(x, y) {
  if (x === ZERO) return ZERO;
  if (y === ZERO) return x;
  const [xe, xn] = x.terms[0];
  const [ye, yn] = y.terms[0];
  const c = cmp(xe, ye);
  if (c < 0) return ZERO;
  if (c > 0) return x;
  if (xn < yn) return ZERO;
  if (xn > yn) return make([[xe, xn - yn], ...x.terms.slice(1)]);
  return sub(rest(x), rest(y));
}

export function mul(x, y) {
  if (x === ZERO || y === ZERO) return ZERO;
  const [xe, xn] = x.terms[0];
  const [ye, yn] = y.terms[0];
  if (ye === ZERO) return make([[xe, xn * yn], ...x.terms.slice(1)]);
  if (y.terms.length === 1) return term(add(xe, ye), yn);
  return add(mul(x, term(ye, yn)), mul(x, rest(y)));
}

/** x^y, case by case as the Python does it. */
export function pow(x, y) {
  if (y === ZERO) return ONE;
  if (x === ZERO) return ZERO;
  if (x === ONE) return ONE;
  if (x === W) return term(y);
  const [xe] = x.terms[0];
  const [ye, yn] = y.terms[0];
  if (ye === ZERO) {
    const half = pow(x, nat(Math.floor(yn / 2)));
    const sq = mul(half, half);
    return yn % 2 ? mul(x, sq) : sq;
  }
  // n^(ω^a) = ω^(ω^(a−1)), say 2^(ω^4) = ω^(ω^3).
  if (xe === ZERO && yn === 1 && y.terms.length === 1) return term(term(sub(ye, ONE)));
  // (ω^a·n + …)^y = ω^(a·y) when y is a limit… and anything bigger than ω here.
  if (xe !== ZERO) return term(mul(xe, y));
  if (y.terms.length === 1) return pow(pow(x, term(ye)), nat(yn));
  return mul(pow(x, term(ye, yn)), pow(x, rest(y)));
}

// ---- Writing ordinals down ----

/** As the Python prints them: ω^(ω+1)*2+3. */
export function show(x) {
  if (x === EPS) return "ε₀";
  if (x === ZERO) return "0";
  return x.terms
    .map(([e, n]) => {
      if (e === ZERO) return String(n);
      const coef = n === 1 ? "" : `*${n}`;
      if (e === ONE) return `ω${coef}`;
      const paren = !isNat(e) && (e.terms.length > 1 || e.terms[0][1] > 1);
      return `ω^${paren ? `(${show(e)})` : show(e)}${coef}`;
    })
    .join("+");
}

/**
 * For drawing: runs of text, each at a superscript level, with no brackets
 * needed (ω^(ω+1)·2 is ω, then "ω+1" raised, then ·2).
 */
export function runs(x, level = 0, out = []) {
  if (x === ZERO) {
    out.push({ text: "0", level });
    return out;
  }
  x.terms.forEach(([e, n], i) => {
    if (i) out.push({ text: "+", level });
    if (e === ZERO) return out.push({ text: String(n), level });
    out.push({ text: "ω", level });
    if (e !== ONE) runs(e, level + 1, out);
    if (n > 1) out.push({ text: `·${n}`, level });
  });
  return out;
}

/** The same as HTML, with <sup>. */
export function html(x) {
  let s = "";
  let at = 0;
  for (const { text, level } of runs(x)) {
    while (at < level) (s += "<sup>"), at++;
    while (at > level) (s += "</sup>"), at--;
    s += text;
  }
  return s + "</sup>".repeat(at);
}

/** Every term spelled out down to ω^0, as the post's ω^ω^0+ω^0+ω^0+ω^0. */
export function expanded(x) {
  if (x === ZERO) return "0";
  return x.terms
    .flatMap(([e, n]) => Array(n).fill(e === ZERO ? "ω^0" : `ω^${e.terms.length > 1 || e.terms[0][1] > 1 ? `(${expanded(e)})` : expanded(e)}`))
    .join("+");
}

/** Read ω+3, w^w*2, ω^(ω^2·3)+1, 2^ω … (^ binds tightest, to the right). */
export function parse(src) {
  const toks = src.match(/\d+|[ωwW]|ε₀?|[-+*·×^()]|\S/g) ?? [];
  let i = 0;
  const peek = () => toks[i];
  const fail = (why) => {
    throw new SyntaxError(why);
  };
  function atom() {
    const t = toks[i++];
    if (t === undefined) fail("ends too soon");
    if (/^\d+$/.test(t)) {
      const n = Number(t);
      if (n > 1e6) fail(`${t} is too big to draw`);
      return nat(n);
    }
    if (/^[ωwW]$/.test(t)) return W;
    if (t === "(") {
      const x = sum();
      if (toks[i++] !== ")") fail("a ( is never closed");
      return x;
    }
    if (t.startsWith("ε")) fail("ε₀ is past every ordinal here");
    fail(`didn't expect ${t}`);
  }
  function power() {
    const b = atom();
    if (peek() !== "^") return b;
    i++;
    const e = power();
    if (isNat(e) && !isNat(b) && e !== ZERO && e.terms[0][1] > 64) fail("that power is too big to draw");
    if (isNat(e) && isNat(b) && e !== ZERO && Math.log2(Math.max(2, b.terms[0]?.[1] ?? 0)) * e.terms[0][1] > 20) fail("that power is too big to draw");
    return pow(b, e);
  }
  function product() {
    let x = power();
    while (["*", "·", "×"].includes(peek())) {
      i++;
      x = mul(x, power());
    }
    return x;
  }
  function sum() {
    let x = product();
    while (peek() === "+") {
      i++;
      x = add(x, product());
    }
    return x;
  }
  if (!toks.length) fail("write an ordinal, like ω+3");
  const x = sum();
  if (i < toks.length) fail(`didn't expect ${toks[i]}`);
  return x;
}

// ---- Trees and parentheses ----

/** How many nodes the tree has, not counting the root: the ( in BP(x). */
export function size(x) {
  let s = 0;
  for (const [e, n] of x.terms) s += n * (1 + size(e));
  return s;
}

/**
 * The tree's nodes as parentheses, in order: each { c: "(" or ")", keep, node }.
 * Every ( is kept. A ) is dropped (keep false) where the post's UP drops it:
 * where an open paren in its place would only spell an ordinal out of normal
 * form. node numbers the tree's nodes in preorder, from 1 (0 is the root).
 */
export function parens(x) {
  const out = [];
  let next = 1;
  // h(x, bound) from the post: bound's first exponent is the largest x's may be.
  function h(x, bound) {
    if (x === ZERO) return;
    if (bound === ZERO) throw new Error("not in normal form");
    let ba = lead(bound);
    for (const [e, n] of x.terms) {
      for (let k = 0; k < n; k++) {
        const node = next++;
        out.push({ c: "(", keep: true, node });
        // The exponent is as big as it may be: no ( could follow it, so its ) says nothing.
        const tight = k > 0 || e === ba;
        h(e, tight ? e : ba);
        out.push({ c: ")", keep: !tight, node });
      }
      ba = e; // later terms are bounded by the one before
    }
  }
  h(x, EPS);
  return out;
}

/** The post's naive BP(x), every paren: (())()()() for ω+3. */
export function bpNaive(x) {
  return parens(x)
    .map((p) => p.c)
    .join("");
}

/** The post's UP(x), redundant ) left out: (())()(( for ω+3. */
export function up(x) {
  return parens(x)
    .filter((p) => p.keep)
    .map((p) => p.c)
    .join("");
}

/**
 * The parentheses as a real number in [0, 1): ( is a 1 and ) a 0, after "0.".
 * With r ≠ ½ each digit weighs what's left times r for a ( and 1 − r for a ),
 * as the Python's o2i does (it uses r = 0.618).
 */
export function real(ps, r = 0.5) {
  let bit = 1 - r;
  let x = 0;
  for (const p of ps) {
    if (p === "(") x += bit;
    bit *= p === "(" ? r : 1 - r;
  }
  return x;
}

/** s(x) = log_r(1 − x): the post's −log₂(1 − x) when r = ½. */
export function stretch(v, r = 0.5) {
  return Math.log(1 - v) / Math.log(r);
}

/**
 * Where x's tick goes: t(1) = 0, t(ω) = 1, t(ω^ω) = 2, …, t(0) = −1. That's
 * s − 1, the Python's slog. naive uses every paren, as the post's first try.
 */
export function tick(x, { r = 0.5, naive = false } = {}) {
  return stretch(real(naive ? bpNaive(x) : up(x), r), r) - 1;
}

/** x's fundamental sequence, x[1], x[2], … rising to x when x is a limit. */
export function fund(x, k) {
  if (!isLimit(x)) return null;
  const [e, n] = x.terms.at(-1);
  const base = make([...x.terms.slice(0, -1), ...(n > 1 ? [[e, n - 1]] : [])]);
  const p = isLimit(e) ? fund(e, k) : null;
  return add(base, p ? term(p) : term(pred(e), k));
}

/** The ordinal just before a successor. */
function pred(x) {
  const [e, n] = x.terms.at(-1);
  return make([...x.terms.slice(0, -1), ...(n > 1 ? [[e, n - 1]] : [])]);
}

/** Every ordinal of exactly n nodes, in order. */
export function ofSize(n, memo = new Map()) {
  return exact(n, EPS, memo);
}

function exact(n, maxExp, memo) {
  const key = `${n}/${maxExp.id}`;
  if (memo.has(key)) return memo.get(key);
  let out = [];
  if (n === 0) out = [ZERO];
  else {
    // ω^e·k + rest: k copies of a term of size 1 + |e|, then smaller exponents.
    for (let s = 0; s < n; s++) {
      for (const e of exact(s, EPS, memo)) {
        if (maxExp !== EPS && cmp(e, maxExp) > 0) continue;
        for (let k = 1; k * (s + 1) <= n; k++) {
          for (const r of exact(n - k * (s + 1), e, memo)) {
            if (r !== ZERO && lead(r) === e) continue;
            out.push(make([[e, k], ...r.terms]));
          }
        }
      }
    }
    out.sort(cmp);
  }
  memo.set(key, out);
  return out;
}

/** Every ordinal of at most n nodes, in order. */
export function upTo(n) {
  const memo = new Map();
  const all = [];
  for (let s = 0; s <= n; s++) all.push(...ofSize(s, memo));
  return all.sort(cmp);
}

/** The functions the page can plot, with how each reads. */
export const FUNCTIONS = {
  "x*x": { label: "x·x", f: (x) => mul(x, x) },
  "x+1": { label: "x+1", f: (x) => add(x, ONE) },
  "x*2": { label: "x·2", f: (x) => mul(x, nat(2)) },
  "w*x": { label: "ω·x", f: (x) => mul(W, x) },
  "x*w": { label: "x·ω", f: (x) => mul(x, W) },
  "2^x": { label: "2^x", f: (x) => pow(nat(2), x) },
  "w^x": { label: "ω^x", f: (x) => pow(W, x) },
};
