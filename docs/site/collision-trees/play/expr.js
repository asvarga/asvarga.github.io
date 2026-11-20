// Little arithmetic for rules that move: `45 + 15*sin(t)`. Parsed once into a
// tree of closures (no eval), then run every frame with the time t, in seconds.
//
//   numbers, t, pi, + - * / ^ (power), parentheses, and
//   sin cos tan abs sqrt exp log floor round min max clamp mix
//   tri(x): a triangle wave, -1 to 1 with period 2π, like sin but straight
//   pulse(x): 0 to 1, a smooth bump once per 2π
//
// Identifiers start lowercase; rule symbols (A, B, …) start uppercase, so
// `45 A` reads as the number 45 then the symbol A.

const FUNCS = {
  sin: [1, Math.sin],
  cos: [1, Math.cos],
  tan: [1, Math.tan],
  abs: [1, Math.abs],
  sqrt: [1, Math.sqrt],
  exp: [1, Math.exp],
  log: [1, Math.log],
  floor: [1, Math.floor],
  round: [1, Math.round],
  min: [2, Math.min],
  max: [2, Math.max],
  clamp: [3, (x, lo, hi) => Math.min(hi, Math.max(lo, x))],
  mix: [3, (a, b, f) => a + (b - a) * f],
  tri: [1, (x) => (2 / Math.PI) * Math.asin(Math.sin(x))],
  pulse: [1, (x) => 0.5 - 0.5 * Math.cos(x)],
};

/** Split `text` into tokens: { kind: "num" | "id" | "sym" | "op", value, at }. */
export function tokenize(text) {
  const tokens = [];
  const re = /\s*(?:(\d*\.?\d+(?:e[+-]?\d+)?)|([a-z]\w*)|([A-Z]\w*)|(\S))/gy;
  let m;
  while (re.lastIndex < text.length && (m = re.exec(text))) {
    if (m[0].trim() === "") break;
    const at = m.index + m[0].length - m[0].trimStart().length;
    if (m[1] !== undefined) tokens.push({ kind: "num", value: Number(m[1]), at });
    else if (m[2] !== undefined) tokens.push({ kind: "id", value: m[2], at });
    else if (m[3] !== undefined) tokens.push({ kind: "sym", value: m[3], at });
    else tokens.push({ kind: "op", value: m[4] === "°" ? "°" : m[4], at });
  }
  return tokens;
}

/**
 * Parse an expression from `tokens` starting at `pos.i`, leaving pos.i after
 * it. Returns { f: (t) => number, moves: uses t, text }.
 */
export function parseExpr(tokens, pos) {
  const peek = () => tokens[pos.i];
  const isOp = (v) => peek()?.kind === "op" && peek().value === v;
  const fail = (what) => {
    const tok = peek();
    throw new Error(tok ? `Expected ${what}, found "${tok.value}"` : `Expected ${what}`);
  };
  let moves = false;

  function sum() {
    let f = product();
    while (isOp("+") || isOp("-")) {
      const op = tokens[pos.i++].value;
      const a = f;
      const b = product();
      f = op === "+" ? (t) => a(t) + b(t) : (t) => a(t) - b(t);
    }
    return f;
  }
  function product() {
    let f = unary();
    while (isOp("*") || isOp("/")) {
      const op = tokens[pos.i++].value;
      const a = f;
      const b = unary();
      f = op === "*" ? (t) => a(t) * b(t) : (t) => a(t) / b(t);
    }
    return f;
  }
  function unary() {
    if (isOp("-")) {
      pos.i++;
      const a = unary();
      return (t) => -a(t);
    }
    if (isOp("+")) {
      pos.i++;
      return unary();
    }
    return power();
  }
  function power() {
    const a = atom();
    if (isOp("^")) {
      pos.i++;
      const b = unary();
      return (t) => a(t) ** b(t);
    }
    return a;
  }
  function atom() {
    const tok = peek();
    if (!tok) fail("a number");
    if (tok.kind === "num") {
      pos.i++;
      const v = tok.value;
      if (isOp("°")) pos.i++;
      return () => v;
    }
    if (tok.kind === "op" && tok.value === "(") {
      pos.i++;
      const f = sum();
      if (!isOp(")")) fail('")"');
      pos.i++;
      return f;
    }
    if (tok.kind === "id") {
      pos.i++;
      if (tok.value === "t") {
        moves = true;
        return (t) => t;
      }
      if (tok.value === "pi") return () => Math.PI;
      const fn = FUNCS[tok.value];
      if (!fn) throw new Error(`Unknown name "${tok.value}": try t, pi, sin, cos, tri, pulse, …`);
      if (!isOp("(")) fail(`"(" after ${tok.value}`);
      pos.i++;
      const args = [sum()];
      while (isOp(",")) {
        pos.i++;
        args.push(sum());
      }
      if (!isOp(")")) fail('")"');
      pos.i++;
      if (args.length !== fn[0]) {
        throw new Error(`${tok.value} takes ${fn[0]} number${fn[0] === 1 ? "" : "s"}`);
      }
      const [n, g] = fn;
      if (n === 1) {
        const [a] = args;
        return (t) => g(a(t));
      }
      if (n === 2) {
        const [a, b] = args;
        return (t) => g(a(t), b(t));
      }
      const [a, b, c] = args;
      return (t) => g(a(t), b(t), c(t));
    }
    fail("a number");
  }

  const start = pos.i;
  const f = sum();
  const text = tokens
    .slice(start, pos.i)
    .map((k) => k.value)
    .join(" ");
  return { f, moves, text };
}

/** Parse a whole expression, like a slider's. */
export function expr(text) {
  const tokens = tokenize(text);
  const pos = { i: 0 };
  const e = parseExpr(tokens, pos);
  if (pos.i < tokens.length) throw new Error(`Unexpected "${tokens[pos.i].value}"`);
  return e;
}
