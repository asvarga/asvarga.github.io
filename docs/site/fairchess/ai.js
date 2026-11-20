// Phibber, the computer player. A round of Fair Chess is a simultaneous game:
// neither player sees the other's request, so there is no best move, only a
// best mix of moves. Phibber scores every pair of requests (its move against
// each of yours) by the position they lead to, and finds a mix by fictitious
// play: each side keeps answering the other's mix so far, and the counts settle
// toward a Nash equilibrium of the round. Then it draws a move from its mix.
// It chooses before you do, from the position alone.

import { VALUE, hasKing, moves, other, pieceMoves, resolve } from "./rules.js";

// The lowest-valued piece of `color` that attacks each square (Infinity if none),
// counting squares held by either side, so it says what defends too.
export function attackers(state, color) {
  const low = Array(64).fill(Infinity);
  const { board } = state;
  const mark = (sq, piece) => (low[sq] = Math.min(low[sq], piece === "K" ? 50 : VALUE[piece]));
  for (let sq = 0; sq < 64; sq++) {
    const p = board[sq];
    if (p?.[0] !== color) continue;
    const piece = p[1];
    if (piece === "P") {
      const r = Math.floor(sq / 8) + (color === "w" ? 1 : -1);
      const f = sq % 8;
      if (r >= 0 && r < 8) for (const df of [-1, 1]) if (f + df >= 0 && f + df < 8) mark(r * 8 + f + df, piece);
      continue;
    }
    // Pretend every square is an enemy, so the moves show what's covered.
    const copy = { board: board.map((q, i) => (q && i !== sq ? `${other(color)}${q[1]}` : q)), castle: "" };
    if (piece === "N" || piece === "K") {
      for (const m of pieceMoves(copy, sq)) if (!m.castle) mark(m.to, piece);
    } else {
      for (const m of pieceMoves(copy, sq)) mark(m.to, piece);
    }
  }
  return low;
}

// The most `color` stands to lose next round: its piece the other side
// attacks for the most gain.
function exposure(state, color, theirs, ours) {
  let worst = 0;
  for (let sq = 0; sq < 64; sq++) {
    const p = state.board[sq];
    if (p?.[0] !== color || theirs[sq] === Infinity) continue;
    let loss;
    if (p[1] === "K") {
      // Moving the king holds any capture, so a king is lost only if it can't move.
      const runs = pieceMoves(state, sq).length;
      loss = runs ? 2 : 40;
    } else loss = ours[sq] === Infinity ? VALUE[p[1]] : Math.max(0, VALUE[p[1]] - theirs[sq]);
    worst = Math.max(worst, loss);
  }
  return worst;
}

// How good a position is for `me`.
export function score(state, me) {
  const you = other(me);
  const mine = hasKing(state, me);
  const yours = hasKing(state, you);
  if (!mine || !yours) return mine === yours ? 0 : mine ? 1000 : -1000;
  let s = 0;
  for (let sq = 0; sq < 64; sq++) {
    const p = state.board[sq];
    if (!p) continue;
    const sign = p[0] === me ? 1 : -1;
    let v = VALUE[p[1]];
    const rank = Math.floor(sq / 8);
    const ahead = p[0] === "w" ? rank : 7 - rank;
    const centre = 3.5 - Math.max(Math.abs((sq % 8) - 3.5), Math.abs(rank - 3.5));
    if (p[1] === "P") v += 0.04 * ahead * ahead * 0.25 + (centre > 2 ? 0.1 : 0);
    else if (p[1] !== "K") v += 0.05 * centre + (ahead > 0 ? 0.12 : 0);
    s += sign * v;
  }
  const atMe = attackers(state, you);
  const atYou = attackers(state, me);
  s -= 0.6 * exposure(state, me, atMe, atYou);
  s += 0.3 * exposure(state, you, atYou, atMe);
  s += 0.02 * (moves(state, me).length - moves(state, you).length);
  return s;
}

// The round as a matrix: rows are my moves, columns yours, each cell how good
// the merged position is for me.
export function matrix(state, me) {
  const mine = moves(state, me);
  const yours = moves(state, other(me));
  const rows = mine.map((m) =>
    yours.length
      ? yours.map((y) => score(resolve(state, me === "w" ? [m, y] : [y, m]).state, me))
      : [score(resolve(state, me === "w" ? [m, null] : [null, m]).state, me)],
  );
  return { mine, yours, rows };
}

// Fictitious play on a matrix game: how often each row and column was the best
// answer to the other side's mix so far.
export function equilibrium(rows, rounds = 400) {
  const n = rows.length;
  const k = rows[0].length;
  const rowCount = Array(n).fill(0);
  const colCount = Array(k).fill(0);
  const rowSum = Array(n).fill(0); // each row's payoff against the columns played so far
  const colSum = Array(k).fill(0); // each column's payoff against the rows played so far
  let r = 0;
  for (let t = 0; t < rounds; t++) {
    rowCount[r]++;
    for (let j = 0; j < k; j++) colSum[j] += rows[r][j];
    let c = 0;
    for (let j = 1; j < k; j++) if (colSum[j] < colSum[c]) c = j;
    colCount[c]++;
    for (let i = 0; i < n; i++) rowSum[i] += rows[i][c];
    r = 0;
    for (let i = 1; i < n; i++) if (rowSum[i] > rowSum[r]) r = i;
  }
  return { rows: rowCount.map((x) => x / rounds), cols: colCount.map((x) => x / rounds) };
}

// Phibber's request, or null if it has no move. `level` is "easy" or "normal".
export function choose(state, me, level = "normal", random = Math.random) {
  if (!moves(state, me).length) return null;
  const { mine, rows } = matrix(state, me);
  let weights;
  if (level === "easy") {
    // Easy plays as if you'd move at random, and not always its best.
    const mean = rows.map((row) => row.reduce((a, b) => a + b, 0) / row.length);
    const top = Math.max(...mean);
    weights = mean.map((v) => Math.exp((v - top) / 1.2));
  } else {
    // The mix, without the moves it barely plays.
    const mix = equilibrium(rows).rows;
    const most = Math.max(...mix);
    weights = mix.map((p) => (p >= most / 4 ? p : 0));
  }
  const total = weights.reduce((a, b) => a + b, 0);
  let pick = random() * total;
  for (let i = 0; i < mine.length; i++) {
    pick -= weights[i];
    if (pick < 0 && weights[i] > 0) return mine[i];
  }
  return mine[weights.indexOf(Math.max(...weights))];
}
