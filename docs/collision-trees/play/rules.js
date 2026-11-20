// Collision Trees: grow branching lines, and wherever branches collide, cut
// off the ones that got there last. Pure: no DOM, so `node --test` runs it,
// and the page runs it in a worker (worker.js).
//
// A tree is grown by rules, one per symbol:
//
//   A: 45 A, -45 A          each A segment ends in two A's, turned ±45°
//   A: 30 A*0.9, -30 B      a child's length is its parent's times 0.9
//   B: 0 A                  B carries straight on as an A
//   A: (40 + 20*sin(t)) A, -40 A    an angle that moves with time t (expr.js)
//
// Angles are in degrees, positive turning left. A symbol with no rule is a
// leaf: it grows its segment and stops. "45, -45" alone is short for
// "A: 45 A, -45 A". The first rule's symbol is what a seed starts as.
//
// Time is distance from the seed over its speed, and growth is exact in it:
// pieces of line are laid in the order their tips set out, each at most
// PIECE long, so a piece that reaches a point later than another line did
// finds that line already there. Seeds may grow at different speeds and start
// at different times, so a line laid first can still reach a crossing last:
// then it is the one cut, and what it had started is stopped before it was
// ever laid (it would set out after the piece doing the cutting).
//
// Numbers. Collisions hinge on exact coincidences: two branches meeting head
// on at the same moment, a tip landing exactly on another's corner. So:
//   - Headings are kept in degrees, as each tip's sum of turns from its seed
//     (sign-symmetric: mirrored branches get exactly opposite sums), and
//     sincos() is exact where it can be (0, 30, 45, 60, 90°…) and has the
//     circle's symmetries exactly, so right-angle trees stay on the integers
//     and mirror images are bit-for-bit mirrors.
//   - Positions and times are summed in double-double, so a point reached by
//     two paths made of the same steps is the same double, however deep, and
//     nothing drifts.
//   - What's left (where a line crosses another's middle) is compared with
//     tolerances that scale with the coordinates: a hair (1e-9 of the scale)
//     counts as touching, and arrivals that close count as a tie, which cuts
//     both, so a symmetric tree stays symmetric.
//   - Growth stops a tip that leaves ±1e6 or whose segment is shorter than
//     1e-6, and rules whose numbers aren't finite are refused.

import { parseExpr, tokenize } from "./expr.js";

export const PIECE = 1;
const LEVELS = 5; // grid cells of 1, 1/4, 1/16, 1/64 and 1/256
const CELL = [1, 1 / 4, 1 / 16, 1 / 64, 1 / 256];
const WORLD = 1e6;
const MIN_SEG = 1e-6;
const REL = 1e-9; // tolerance, relative to the coordinates' scale

// --- Rules -------------------------------------------------------------------

/**
 * Parse rules text into { start, rules: Map(symbol -> [{ turn, symbol,
 * scale }]), moves } where turn and scale are expressions ({ f(t) }), and
 * moves says whether any of them use t.
 */
export function parseRules(text) {
  const rules = new Map();
  let start = null;
  let moves = false;
  const lines = text
    .split(/[\n;]/)
    .map((l) => l.replace(/#.*$/, "").trim())
    .filter(Boolean);
  if (lines.length === 0) throw new Error("No rules: try 45, -45");
  for (const [n, line] of lines.entries()) {
    let head = "A";
    let body = line;
    const m = line.match(/^([A-Z]\w*)\s*(?::|->|→)\s*(.*)$/);
    if (m) {
      head = m[1];
      body = m[2];
    } else if (n > 0 || lines.length > 1) {
      throw new Error(`Rule ${n + 1} needs a name, like "B: 0 A"`);
    }
    if (rules.has(head)) throw new Error(`${head} has two rules`);
    start ??= head;
    const children = [];
    const tokens = tokenize(body);
    const pos = { i: 0 };
    const at = (v) => tokens[pos.i]?.kind === "op" && tokens[pos.i].value === v;
    while (pos.i < tokens.length) {
      let turn;
      try {
        turn = parseExpr(tokens, pos);
      } catch (e) {
        throw new Error(`${head}: ${e.message}: write an angle, a symbol and maybe *scale`);
      }
      let symbol = head;
      if (tokens[pos.i]?.kind === "sym") symbol = tokens[pos.i++].value;
      let scale = { f: () => 1, moves: false, text: "1" };
      if (at("*")) {
        pos.i++;
        scale = parseExpr(tokens, pos);
      }
      if (pos.i < tokens.length && !at(",")) {
        throw new Error(`${head}: can't read "${tokens[pos.i].value}": write an angle, a symbol and maybe *scale`);
      }
      if (at(",")) pos.i++;
      moves ||= turn.moves || scale.moves;
      children.push({ turn, symbol, scale });
    }
    rules.set(head, children);
  }
  return { start, rules, moves };
}

/**
 * Rules as numbers at time t, ready to grow: every turn is spread * turn +
 * twist, every scale times shrink. Throws if a number isn't fit to grow with.
 */
export function instantiate(parsed, t = 0, { spread = 1, twist = 0, shrink = 1 } = {}) {
  const names = [...parsed.rules.keys()];
  for (const kids of parsed.rules.values()) for (const k of kids) if (!names.includes(k.symbol)) names.push(k.symbol);
  const index = new Map(names.map((s, i) => [s, i]));
  const count = names.length;
  const childStart = new Int32Array(count + 1);
  const turns = [];
  const syms = [];
  const scales = [];
  for (const [i, name] of names.entries()) {
    childStart[i] = turns.length;
    for (const k of parsed.rules.get(name) ?? []) {
      const turn = k.turn.f(t) * spread + twist;
      const scale = k.scale.f(t) * shrink;
      if (!Number.isFinite(turn)) throw new Error(`${name}'s angle ${k.turn.text} isn't a number at t = ${t.toFixed(2)}`);
      if (!(scale > 0) || scale > 10) {
        throw new Error(
          `${name}'s scale ${k.scale.text} is ${+scale.toFixed(4)} at t = ${t.toFixed(2)}: keep it above 0 and at most 10`,
        );
      }
      turns.push(turn);
      syms.push(index.get(k.symbol));
      scales.push(scale);
    }
  }
  childStart[count] = turns.length;
  return {
    start: index.get(parsed.start),
    names,
    childStart,
    turn: Float64Array.from(turns),
    symbol: Int32Array.from(syms),
    scale: Float64Array.from(scales),
  };
}

// --- Exact-where-it-can-be trigonometry and sums -----------------------------

const S30 = 0.5;
const C30 = Math.sqrt(3) / 2;
const S45 = Math.SQRT1_2;
const DEG = Math.PI / 180;
let SIN = 0;
let COS = 1;

/**
 * [sin, cos] of `d` degrees. Exact at multiples of 30° and 45°, and odd,
 * even and periodic exactly, so mirrored headings mirror exactly.
 */
export function sincos(d) {
  sc(d);
  return [SIN, COS];
}

function sc(d) {
  const m = Math.abs(d) % 360; // fmod is exact
  let a = m > 180 ? 360 - m : m; // [0, 180], and sin's sign flips if m > 180
  const neg = d < 0 !== m > 180;
  let flipCos = false;
  if (a > 90) {
    a = 180 - a; // exact (Sterbenz)
    flipCos = true;
  }
  let swap = false;
  if (a > 45) {
    a = 90 - a; // exact (Sterbenz)
    swap = true;
  }
  let s;
  let c;
  if (a === 0) {
    s = 0;
    c = 1;
  } else if (a === 30) {
    s = S30;
    c = C30;
  } else if (a === 45) {
    s = S45;
    c = S45;
  } else {
    s = Math.sin(a * DEG);
    c = Math.cos(a * DEG);
  }
  if (swap) [s, c] = [c, s];
  if (flipCos) c = -c;
  SIN = (neg ? -s : s) + 0; // no -0
  COS = c + 0; // no -0
}

/** Fold a sum of turns into [-180, 180], sign-symmetrically. */
export function fold(r) {
  r %= 360;
  if (r > 180) r -= 360;
  else if (r < -180) r += 360;
  return r;
}

// Double-double sums: (hi, lo) + v, into DH, DL.
let DH = 0;
let DL = 0;
function ddAdd(hi, lo, v) {
  const s = hi + v;
  const bb = s - hi;
  let e = hi - (s - bb) + (v - bb);
  e += lo;
  DH = s + e;
  DL = e - (DH - s);
}

// --- Growing -------------------------------------------------------------------

const grow = (a, n) => {
  if (n <= a.length) return a;
  const b = new a.constructor(Math.max(n, a.length * 2));
  b.set(a);
  return b;
};

const PIECE_COLS = ["x1", "y1", "x2", "y2", "dx", "dy", "len", "t1", "spd", "dep", "sd", "cut", "kid0", "kid1", "stamp"];
const TIP_COLS = ["txh", "txl", "tyh", "tyl", "trel", "tdx", "tdy", "tsym", "tdep", "tleft", "tseg", "tth", "ttl", "tspd", "tseed", "talive"];

/**
 * A growing forest. `seeds` are { x, y, heading (degrees, 90 is up), speed,
 * start, length, team (who it plays for: colored as one; its index unless
 * it says) }; each grows `rules` (text, parsed or instantiated; at time
 * `t` with `mods`) from its start symbol, at most `depth` segments from root
 * to tip. Stops at `maxPieces` pieces.
 *
 * Pieces are columns (x1, y1, x2, y2, dx, dy, len, t1, spd, dep, sd, cut) for
 * i < n. `pieces` gives them as objects, for tests; `pack` for the GPU.
 */
export class Forest {
  constructor({ rules, seeds = [], depth = 40, maxPieces = 300000, t = 0, mods } = {}) {
    if (typeof rules === "string") rules = parseRules(rules);
    this.rules = rules.childStart ? rules : instantiate(rules, t, mods);
    this.depth = depth;
    this.maxPieces = maxPieces;
    this.seeds = [];
    this.time = 0;
    this.cuts = 0;
    this.deepest = 0;
    this.capped = false;

    const P = 8192;
    this.n = 0;
    for (const k of ["x1", "y1", "x2", "y2", "dx", "dy", "len", "t1", "spd"]) this[k] = new Float64Array(P);
    for (const k of ["dep", "sd", "kid0", "kid1", "stamp"]) this[k] = new Int32Array(P);
    this.cut = new Uint8Array(P);
    this.stampNow = 0;

    this.m = 0;
    for (const k of ["txh", "txl", "tyh", "tyl", "trel", "tdx", "tdy", "tleft", "tseg", "tth", "ttl", "tspd"]) {
      this[k] = new Float64Array(P);
    }
    for (const k of ["tsym", "tdep", "tseed"]) this[k] = new Int32Array(P);
    this.talive = new Uint8Array(P);
    this.heap = new Int32Array(P);
    this.hk = new Float64Array(P);
    this.hn = 0;

    // The grid: open addressing over (level, cx, cy), each slot a list of pieces.
    this.cap = 1 << 12;
    this.used = 0;
    this.kx = new Int32Array(this.cap);
    this.ky = new Int32Array(this.cap);
    this.kl = new Int32Array(this.cap).fill(-1);
    this.head = new Int32Array(this.cap).fill(-1);
    this.entP = new Int32Array(P * 4);
    this.entNext = new Int32Array(P * 4);
    this.ents = 0;
    this.perLevel = new Int32Array(LEVELS);
    this.cx = new Int32Array(64);
    this.cy = new Int32Array(64);
    this.hitS = new Float64Array(16);
    this.hitW = new Float64Array(16);
    this.hitQ = new Int32Array(16);
    this.hitSign = new Int8Array(16);
    this.hitOrder = new Int32Array(16);

    for (const s of seeds) this.plant(s);
  }

  /** Add a seed; one planted in the past starts now. Returns its index. */
  plant({ x = 0, y = 0, heading = 90, speed = 1, start = this.time, length = 1, team }) {
    if (!(speed > 0) || !(length > 0) || ![x, y, heading, start].every(Number.isFinite)) {
      throw new Error("A seed needs a place, a heading, and a speed and length above 0");
    }
    const index = this.seeds.length;
    sc(heading);
    team = Number.isInteger(team) && team >= 0 ? team : index;
    const seed = { x, y, heading, speed, start: Math.max(start, this.time), length, team, ux: COS, uy: SIN };
    this.seeds.push(seed);
    const i = this.newTip();
    this.txh[i] = x;
    this.tyh[i] = y;
    this.trel[i] = 0;
    this.tdx[i] = seed.ux;
    this.tdy[i] = seed.uy;
    this.tsym[i] = this.rules.start;
    this.tdep[i] = 0;
    this.tleft[i] = length;
    this.tseg[i] = length;
    this.tth[i] = seed.start;
    this.tspd[i] = speed;
    this.tseed[i] = index;
    this.push(i);
    return index;
  }

  newTip() {
    const i = this.m++;
    if (i >= this.txh.length) for (const k of TIP_COLS) this[k] = grow(this[k], i + 1);
    this.txl[i] = 0;
    this.tyl[i] = 0;
    this.ttl[i] = 0;
    this.talive[i] = 1;
    return i;
  }

  // The heap of tips, by when they set out, then by birth.
  // Its keys sit beside it (hk), so sifting reads one array; ties in the
  // time's high part go to its low part, then to the elder tip.
  before(ka, a, kb, b) {
    if (ka !== kb) return ka < kb;
    const la = this.ttl[a];
    const lb = this.ttl[b];
    return la !== lb ? la < lb : a < b;
  }
  push(i) {
    if (this.hn >= this.heap.length) {
      this.heap = grow(this.heap, this.hn + 1);
      this.hk = grow(this.hk, this.hn + 1);
    }
    const h = this.heap;
    const hk = this.hk;
    const key = this.tth[i];
    let k = this.hn++;
    while (k > 0) {
      const p = (k - 1) >> 1;
      if (!this.before(key, i, hk[p], h[p])) break;
      h[k] = h[p];
      hk[k] = hk[p];
      k = p;
    }
    h[k] = i;
    hk[k] = key;
  }
  pop() {
    const h = this.heap;
    const hk = this.hk;
    const top = h[0];
    const n = --this.hn;
    if (n > 0) {
      const i = h[n];
      const key = hk[n];
      let k = 0;
      for (;;) {
        const l = 2 * k + 1;
        if (l >= n) break;
        let m = l;
        if (l + 1 < n && this.before(hk[l + 1], h[l + 1], hk[l], h[l])) m = l + 1;
        if (!this.before(hk[m], h[m], key, i)) break;
        h[k] = h[m];
        hk[k] = hk[m];
        k = m;
      }
      h[k] = i;
      hk[k] = key;
    }
    return top;
  }

  /** True when nothing is left to grow. */
  get done() {
    return this.capped || this.hn === 0;
  }

  /** When the next piece sets out, or Infinity. */
  get next() {
    return this.done ? Infinity : this.hk[0];
  }

  /** Grow everything that sets out by `time`. */
  advance(time) {
    while (!this.done && this.hk[0] <= time) this.step();
    this.time = Math.max(this.time, Math.min(time, this.next));
    if (this.done) this.time = Math.max(this.time, this.end());
  }

  /** Grow to the end, or until `budget` pieces have been laid. */
  finish(budget = Infinity) {
    for (let k = 0; k < budget && !this.done; k++) this.step();
    this.time = this.done ? Math.max(this.time, this.end()) : this.next;
  }

  /** When the last piece arrives. */
  end() {
    let t = 0;
    for (let i = 0; i < this.n; i++) t = Math.max(t, this.t1[i] + this.len[i] / this.spd[i]);
    return t;
  }

  /** Lay one tip's next piece. */
  step() {
    const i = this.pop();
    if (!this.talive[i]) return;
    const T = this.tth[i];
    if (T > this.time) this.time = T;
    const len = Math.min(this.tleft[i], PIECE);
    const dx = this.tdx[i];
    const dy = this.tdy[i];
    ddAdd(this.txh[i], this.txl[i], dx * len);
    const xh = DH;
    const xl = DL;
    ddAdd(this.tyh[i], this.tyl[i], dy * len);
    const yh = DH;
    const yl = DL;

    const p = this.n++;
    if (p >= this.x1.length) for (const k of PIECE_COLS) this[k] = grow(this[k], p + 1);
    this.x1[p] = this.txh[i];
    this.y1[p] = this.tyh[i];
    this.x2[p] = xh;
    this.y2[p] = yh;
    this.dx[p] = dx;
    this.dy[p] = dy;
    this.len[p] = len;
    this.t1[p] = T;
    this.spd[p] = this.tspd[i];
    this.dep[p] = this.tdep[i];
    this.sd[p] = this.tseed[i];
    this.cut[p] = 0;
    this.stamp[p] = 0;
    this.kid0[p] = this.m;
    this.kid1[p] = this.m;
    if (this.tdep[i] > this.deepest) this.deepest = this.tdep[i];

    const at = this.collide(p);
    this.file(p);
    if (this.n >= this.maxPieces) this.capped = true;
    if (at >= 0) {
      this.trim(p, at);
      return;
    }
    if (Math.abs(xh) > WORLD || Math.abs(yh) > WORLD) return;

    ddAdd(T, this.ttl[i], len / this.tspd[i]);
    const th = DH;
    const tl = DL;
    const left = this.tleft[i] - len;
    if (left > MIN_SEG) {
      // The same segment, on.
      const j = this.newTip();
      this.txh[j] = xh;
      this.txl[j] = xl;
      this.tyh[j] = yh;
      this.tyl[j] = yl;
      this.trel[j] = this.trel[i];
      this.tdx[j] = dx;
      this.tdy[j] = dy;
      this.tsym[j] = this.tsym[i];
      this.tdep[j] = this.tdep[i];
      this.tleft[j] = left;
      this.tseg[j] = this.tseg[i];
      this.tth[j] = th;
      this.ttl[j] = tl;
      this.tspd[j] = this.tspd[i];
      this.tseed[j] = this.tseed[i];
      this.push(j);
      this.kid1[p] = this.m;
      return;
    }
    if (this.tdep[i] + 1 >= this.depth) return;
    const R = this.rules;
    const sym = this.tsym[i];
    const seed = this.seeds[this.tseed[i]];
    for (let c = R.childStart[sym]; c < R.childStart[sym + 1]; c++) {
      const seg = this.tseg[i] * R.scale[c];
      if (seg < MIN_SEG) continue;
      const j = this.newTip();
      const rel = fold(this.trel[i] + R.turn[c]);
      sc(rel);
      this.txh[j] = xh;
      this.txl[j] = xl;
      this.tyh[j] = yh;
      this.tyl[j] = yl;
      this.trel[j] = rel;
      // The seed's heading turned by rel: exact when the seed's is a
      // multiple of 90°, since then one of ux, uy is 0 and the other ±1.
      this.tdx[j] = seed.ux * COS - seed.uy * SIN;
      this.tdy[j] = seed.ux * SIN + seed.uy * COS;
      this.tsym[j] = R.symbol[c];
      this.tdep[j] = this.tdep[i] + 1;
      this.tleft[j] = seg;
      this.tseg[j] = seg;
      this.tth[j] = th;
      this.ttl[j] = tl;
      this.tspd[j] = this.tspd[i];
      this.tseed[j] = this.tseed[i];
      this.push(j);
    }
    this.kid1[p] = this.m;
  }

  /** Cut piece q short at distance `at` from its start, and stop what it started. */
  trim(q, at) {
    if (at < this.len[q]) {
      const len = Math.max(0, at);
      this.len[q] = len;
      this.x2[q] = this.x1[q] + this.dx[q] * len;
      this.y2[q] = this.y1[q] + this.dy[q] * len;
    }
    if (!this.cut[q]) this.cuts++;
    this.cut[q] = 1;
    for (let k = this.kid0[q]; k < this.kid1[q]; k++) this.talive[k] = 0;
  }

  // --- The grid ---

  level(len) {
    let l = 0;
    while (l < LEVELS - 1 && len <= CELL[l + 1]) l++;
    return l;
  }

  /** The cells at `level` a segment passes through (within tol), into cx/cy. */
  cells(level, x1, y1, x2, y2, tol) {
    const c = CELL[level];
    const inv = 1 / c;
    const xa = Math.min(x1, x2) - tol;
    const xb = Math.max(x1, x2) + tol;
    const ylo = Math.min(y1, y2) - tol;
    const yhi = Math.max(y1, y2) + tol;
    const cx0 = Math.floor(xa * inv);
    const cx1 = Math.floor(xb * inv);
    if (cx0 === cx1) {
      // One column: every cell from bottom to top.
      const cy0 = Math.floor(ylo * inv);
      const cy1 = Math.floor(yhi * inv);
      if (cy1 - cy0 + 1 > this.cx.length) {
        this.cx = grow(this.cx, cy1 - cy0 + 1);
        this.cy = grow(this.cy, cy1 - cy0 + 1);
      }
      let k = 0;
      for (let cy = cy0; cy <= cy1; cy++, k++) {
        this.cx[k] = cx0;
        this.cy[k] = cy;
      }
      return k;
    }
    const ddx = x2 - x1;
    const slope = Math.abs(ddx) > 1e-12 ? (y2 - y1) / ddx : NaN;
    let k = 0;
    for (let cx = cx0; cx <= cx1; cx++) {
      let ya = ylo;
      let yb = yhi;
      if (cx1 > cx0 && slope === slope) {
        const lo = Math.max(cx * c, xa);
        const hi = Math.min((cx + 1) * c, xb);
        const y0 = y1 + (lo - x1) * slope;
        const y3 = y1 + (hi - x1) * slope;
        ya = Math.max(ylo, Math.min(y0, y3) - tol);
        yb = Math.min(yhi, Math.max(y0, y3) + tol);
      }
      const cy0 = Math.floor(ya * inv);
      const cy1 = Math.floor(yb * inv);
      const need = k + cy1 - cy0 + 1;
      if (need > this.cx.length) {
        this.cx = grow(this.cx, need);
        this.cy = grow(this.cy, need);
      }
      for (let cy = cy0; cy <= cy1; cy++) {
        this.cx[k] = cx;
        this.cy[k] = cy;
        k++;
      }
    }
    return k;
  }

  slot(l, cx, cy, make) {
    let h = Math.imul(cx, 0x9e3779b1) ^ Math.imul(cy, 0x85ebca77) ^ Math.imul(l + 1, 0xc2b2ae3d);
    h ^= h >>> 16;
    h = Math.imul(h, 0x7feb352d);
    h ^= h >>> 15;
    const mask = this.cap - 1;
    for (let s = h & mask; ; s = (s + 1) & mask) {
      const kl = this.kl[s];
      if (kl === -1) {
        if (!make) return -1;
        if ((this.used + 1) * 2 > this.cap) {
          this.rehash();
          return this.slot(l, cx, cy, true);
        }
        this.kl[s] = l;
        this.kx[s] = cx;
        this.ky[s] = cy;
        this.used++;
        return s;
      }
      if (kl === l && this.kx[s] === cx && this.ky[s] === cy) return s;
    }
  }

  rehash() {
    const { kx, ky, kl, head } = this;
    this.cap *= 2;
    this.kx = new Int32Array(this.cap);
    this.ky = new Int32Array(this.cap);
    this.kl = new Int32Array(this.cap).fill(-1);
    this.head = new Int32Array(this.cap).fill(-1);
    this.used = 0;
    for (let s = 0; s < kl.length; s++) {
      if (kl[s] === -1) continue;
      this.head[this.slot(kl[s], kx[s], ky[s], true)] = head[s];
    }
  }

  /** File piece p in every cell it passes through, at its level. */
  file(p) {
    const l = this.level(this.len[p]);
    this.perLevel[l]++;
    const tol = REL * (1 + Math.abs(this.x1[p]) + Math.abs(this.y1[p]));
    const k = this.cells(l, this.x1[p], this.y1[p], this.x2[p], this.y2[p], tol);
    for (let c = 0; c < k; c++) {
      const s = this.slot(l, this.cx[c], this.cy[c], true);
      const e = this.ents++;
      if (e >= this.entP.length) {
        this.entP = grow(this.entP, e + 1);
        this.entNext = grow(this.entNext, e + 1);
      }
      this.entP[e] = p;
      this.entNext[e] = this.head[s];
      this.head[s] = e;
    }
  }

  /**
   * Check new piece p against every line near it, in order along it. Lines it
   * reaches first are cut where it meets them; at the first line that got
   * there first (or at the same moment, which cuts both) it stops. Returns
   * the distance along p where it stops, or -1.
   */
  collide(p) {
    const stamp = ++this.stampNow;
    const px = this.x1[p];
    const py = this.y1[p];
    const pdx = this.dx[p];
    const pdy = this.dy[p];
    const plen = this.len[p];
    const E = REL * (1 + Math.abs(px) + Math.abs(py));
    let hits = 0;
    for (let l = 0; l < LEVELS; l++) {
      if (this.perLevel[l] === 0) continue;
      const k = this.cells(l, px, py, this.x2[p], this.y2[p], E);
      for (let c = 0; c < k; c++) {
        const s = this.slot(l, this.cx[c], this.cy[c], false);
        if (s < 0) continue;
        for (let e = this.head[s]; e >= 0; e = this.entNext[e]) {
          const q = this.entP[e];
          if (this.stamp[q] === stamp) continue;
          this.stamp[q] = stamp;
          const qlen = this.len[q];
          if (qlen <= 0 || plen <= 0) continue;
          const qdx = this.dx[q];
          const qdy = this.dy[q];
          const wx = this.x1[q] - px;
          const wy = this.y1[q] - py;
          const denom = pdx * qdy - pdy * qdx; // sine of the angle between them
          let hs;
          let sign = 0;
          let w = 0;
          if (Math.abs(denom) > 1e-12) {
            const s2 = (wx * qdy - wy * qdx) / denom;
            const u = (wx * pdy - wy * pdx) / denom;
            if (s2 <= E || s2 > plen + E || u < -E || u > qlen + E) continue;
            hs = s2 >= plen - E ? plen : s2; // a hair from p's end is its end
          } else {
            // Parallel: only lines along the same track touch.
            if (Math.abs(wx * pdy - wy * pdx) > E) continue;
            sign = pdx * qdx + pdy * qdy > 0 ? 1 : -1;
            w = wx * qdx + wy * qdy;
            const a = sign * w;
            const b = sign * (qlen + w);
            const lo = Math.max(Math.min(a, b), 0);
            const hi = Math.min(Math.max(a, b), plen);
            // Nothing shared, or only p's start.
            if (hi < lo - E || hi <= E) continue;
            hs = Math.min(lo, hi);
          }
          if (hits >= this.hitS.length) {
            for (const k2 of ["hitS", "hitW", "hitQ", "hitSign", "hitOrder"]) this[k2] = grow(this[k2], hits + 1);
          }
          this.hitS[hits] = hs;
          this.hitQ[hits] = q;
          this.hitW[hits] = w;
          this.hitSign[hits] = sign;
          this.hitOrder[hits] = hits;
          hits++;
        }
      }
    }
    if (hits === 0) return -1;
    // In order along p (few, so insertion sort).
    const order = this.hitOrder;
    const S = this.hitS;
    for (let a = 1; a < hits; a++) {
      const v = order[a];
      let b = a - 1;
      while (b >= 0 && S[order[b]] > S[v]) {
        order[b + 1] = order[b];
        b--;
      }
      order[b + 1] = v;
    }
    const t1 = this.t1[p];
    const vp = this.spd[p];
    const tol = REL * (1 + Math.abs(t1));
    for (let h = 0; h < hits; h++) {
      const k = order[h];
      const q = this.hitQ[k];
      const qlen = this.len[q];
      const vq = this.spd[q];
      const tq = this.t1[q];
      const s = S[k];
      const sign = this.hitSign[k];
      if (sign === 0) {
        const u = (px + pdx * s - this.x1[q]) * this.dx[q] + (py + pdy * s - this.y1[q]) * this.dy[q];
        if (u > qlen + E) continue; // cut short since
        // A hair from q's ends is its end, so corners stay exact.
        let at = u >= qlen - E ? qlen : u <= E ? 0 : u;
        const d = t1 + s / vp - (tq + at / vq);
        if (d < -tol) {
          this.trim(q, at);
          continue;
        }
        if (d > tol) return s;
        // A tie cuts both. Mirror images meet at the same distance along
        // each, which s and u only miss by rounding: split the difference, so
        // they're cut to the same length, bit for bit.
        let stop = s;
        if (Math.abs(at - s) <= E && at !== qlen && s !== plen) stop = at = (at + s) / 2;
        this.trim(q, at);
        return stop;
      }
      // Along the same track: q's distance at p's s is sign * s - w.
      const w = this.hitW[k];
      const a = sign * w;
      const b = sign * (qlen + w);
      const lo = Math.max(Math.min(a, b), 0);
      const hi = Math.min(Math.max(a, b), plen);
      if (hi < lo - E || hi <= E) continue; // cut short since
      if (sign > 0) {
        // Both going the same way: whoever is second to the start of the
        // shared stretch runs into the other's line there.
        const d = t1 + lo / vp - (tq + (lo - w) / vq);
        if (d < -tol) {
          this.trim(q, lo - w);
          continue;
        }
        if (d <= tol) this.trim(q, lo - w);
        return lo;
      }
      // Head on: they meet where they arrive together.
      const meet = (tq - w / vq - t1) / (1 / vp + 1 / vq);
      const sm = Math.min(Math.max(meet, lo), hi);
      if (meet >= lo - tol && sm > E) this.trim(q, -sm - w);
      if (meet <= hi + tol) return sm;
    }
    return -1;
  }

  /** Bounds of everything laid and every seed: { minX, minY, maxX, maxY }, or null. */
  bounds() {
    if (this.n === 0 && this.seeds.length === 0) return null;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const s of this.seeds) {
      minX = Math.min(minX, s.x);
      maxX = Math.max(maxX, s.x);
      minY = Math.min(minY, s.y);
      maxY = Math.max(maxY, s.y);
    }
    const { x1, y1, x2, y2 } = this;
    for (let i = 0; i < this.n; i++) {
      if (x1[i] < minX) minX = x1[i];
      if (x1[i] > maxX) maxX = x1[i];
      if (x2[i] < minX) minX = x2[i];
      if (x2[i] > maxX) maxX = x2[i];
      if (y1[i] < minY) minY = y1[i];
      if (y1[i] > maxY) maxY = y1[i];
      if (y2[i] < minY) minY = y2[i];
      if (y2[i] > maxY) maxY = y2[i];
    }
    return { minX, minY, maxX, maxY };
  }

  /** The pieces as objects (slow: for tests). */
  get pieces() {
    const out = [];
    for (let i = 0; i < this.n; i++) {
      out.push({
        x1: this.x1[i],
        y1: this.y1[i],
        x2: this.x2[i],
        y2: this.y2[i],
        dx: this.dx[i],
        dy: this.dy[i],
        len: this.len[i],
        t1: this.t1[i],
        speed: this.spd[i],
        depth: this.dep[i],
        seed: this.sd[i],
        cut: this.cut[i] === 1,
      });
    }
    return out;
  }

  /**
   * The pieces for the GPU, 8 floats each: x1, y1, x2, y2 (less ox, oy, so
   * float32 keeps them precise far from the origin), t1, speed, depth, and
   * the seed's team (its index unless it says) + (cut ? 0.5 : 0).
   */
  pack(ox = 0, oy = 0) {
    const out = new Float32Array(this.n * 8);
    const team = this.seeds.map((s) => s.team);
    for (let i = 0, k = 0; i < this.n; i++, k += 8) {
      out[k] = this.x1[i] - ox;
      out[k + 1] = this.y1[i] - oy;
      out[k + 2] = this.x2[i] - ox;
      out[k + 3] = this.y2[i] - oy;
      out[k + 4] = this.t1[i];
      out[k + 5] = this.spd[i];
      out[k + 6] = this.dep[i];
      out[k + 7] = team[this.sd[i]] + (this.cut[i] ? 0.5 : 0);
    }
    return out;
  }
}
