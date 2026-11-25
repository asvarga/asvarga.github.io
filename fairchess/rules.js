// Fair Chess: chess where both players move at once, as in "Fair Chess and
// Simultaneous Games" (asvarga.com/blog/2024/06/22/fair-chess-and-simultaneous-games/).
//
// The input game is chess with no turns in its state: from any position either
// colour may move. A king is won by capturing it, so there is no check, and
// every move a piece can make is legal (no en passant). Each round both players
// request a move, the requests are revealed together, and `resolve` merges them:
// a move is made only if it is legal whichever order the moves are tried in.
// The merging is simultaneous.js's, for any game; this is chess. Nothing here
// touches the page, so node's tests and the computer player share it.

import { resolve as merge } from "./simultaneous.js";

export const FILES = "abcdefgh";
export const VALUE = { P: 1, N: 3, B: 3.2, R: 5, Q: 9, K: 0 };
export const NAME = { P: "pawn", N: "knight", B: "bishop", R: "rook", Q: "queen", K: "king" };
export const other = (color) => (color === "w" ? "b" : "w");
export const square = (name) => FILES.indexOf(name[0]) + 8 * (Number(name[1]) - 1);
export const named = (sq) => FILES[sq % 8] + (Math.floor(sq / 8) + 1);
const fileOf = (sq) => sq % 8;
const rankOf = (sq) => Math.floor(sq / 8);

// A position: 64 squares, a1 = 0 … h8 = 63, each null or a piece like "wN";
// and which castlings are still possible.
export function start() {
  const board = Array(64).fill(null);
  const back = "RNBQKBNR";
  for (let f = 0; f < 8; f++) {
    board[f] = `w${back[f]}`;
    board[8 + f] = "wP";
    board[48 + f] = "bP";
    board[56 + f] = `b${back[f]}`;
  }
  return { board, castle: "KQkq" };
}

// A position from a picture: eight ranks from the 8th down, "." for empty,
// upper case white, lower case black, as in the blog's figures.
export function fromRows(rows, castle = "") {
  const board = Array(64).fill(null);
  rows.forEach((row, i) => {
    [...row.replace(/\s/g, "")].forEach((c, f) => {
      if (c !== ".") board[(7 - i) * 8 + f] = (c === c.toUpperCase() ? "w" : "b") + c.toUpperCase();
    });
  });
  return { board, castle };
}

export const keyOf = (state) => state.board.map((p) => p ?? "..").join("") + state.castle;

// A move is what a player writes down: which piece, from where to where,
// whether it captures (Rf6 and Rxf6 are different requests), and what a pawn
// becomes on the last rank. Two requests are the same move when their keys are.
export const moveKey = (m) => `${m.color}${m.piece}${named(m.from)}${m.capture ? "x" : "-"}${named(m.to)}${m.promo ?? ""}`;

// The move in algebraic notation, with its square of origin so it's never ambiguous.
export function san(m) {
  if (m.castle) return m.castle === "K" ? "O-O" : "O-O-O";
  const piece = m.piece === "P" ? (m.capture ? FILES[fileOf(m.from)] : "") : m.piece + named(m.from);
  return `${piece}${m.capture ? "x" : ""}${named(m.to)}${m.promo ? `=${m.promo}` : ""}`;
}

const KNIGHT = [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]];
const KING = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
const ROOK = [[1, 0], [0, 1], [-1, 0], [0, -1]];
const BISHOP = [[1, 1], [-1, 1], [-1, -1], [1, -1]];
const RAYS = { B: BISHOP, R: ROOK, Q: [...ROOK, ...BISHOP] };

function at(sq, df, dr) {
  const f = fileOf(sq) + df;
  const r = rankOf(sq) + dr;
  return f < 0 || f > 7 || r < 0 || r > 7 ? -1 : r * 8 + f;
}

// Every move the piece on `from` can make.
export function pieceMoves(state, from) {
  const { board } = state;
  const p = board[from];
  if (!p) return [];
  const color = p[0];
  const piece = p[1];
  const out = [];
  const add = (to, extra = {}) => out.push({ color, piece, from, to, capture: board[to] !== null, ...extra });
  const enemy = (sq) => board[sq] !== null && board[sq][0] !== color;
  if (piece === "P") {
    const dir = color === "w" ? 1 : -1;
    const last = color === "w" ? 7 : 0;
    const pawn = (to) => {
      if (rankOf(to) === last) for (const promo of "QRBN") add(to, { promo });
      else add(to);
    };
    const one = at(from, 0, dir);
    if (one >= 0 && board[one] === null) {
      pawn(one);
      const two = at(from, 0, 2 * dir);
      if (rankOf(from) === (color === "w" ? 1 : 6) && board[two] === null) add(two);
    }
    for (const df of [-1, 1]) {
      const to = at(from, df, dir);
      if (to >= 0 && enemy(to)) pawn(to);
    }
  } else if (piece === "N" || piece === "K") {
    for (const [df, dr] of piece === "N" ? KNIGHT : KING) {
      const to = at(from, df, dr);
      if (to >= 0 && (board[to] === null || enemy(to))) add(to);
    }
    if (piece === "K") castles(state, from, color, out);
  } else {
    for (const [df, dr] of RAYS[piece]) {
      for (let to = at(from, df, dr); to >= 0; to = at(to, df, dr)) {
        if (board[to] === null) add(to);
        else {
          if (enemy(to)) add(to);
          break;
        }
      }
    }
  }
  return out;
}

// Castling: the king and rook unmoved and nothing between them. With kings
// won by capture, castling through an attacked square is allowed.
function castles(state, from, color, out) {
  const home = color === "w" ? 0 : 56;
  if (from !== home + 4) return;
  const rights = color === "w" ? "KQ" : "kq";
  const sides = [
    [rights[0], 7, [5, 6], 6, "K"],
    [rights[1], 0, [1, 2, 3], 2, "Q"],
  ];
  for (const [right, rook, between, to, side] of sides) {
    if (!state.castle.includes(right)) continue;
    if (state.board[home + rook] !== `${color}R`) continue;
    if (between.some((f) => state.board[home + f] !== null)) continue;
    out.push({ color, piece: "K", from, to: home + to, capture: false, castle: side });
  }
}

// Every move one colour can make.
export function moves(state, color) {
  const out = [];
  for (let sq = 0; sq < 64; sq++) if (state.board[sq]?.[0] === color) out.push(...pieceMoves(state, sq));
  return out;
}

// Is this request a move in this position? (Rule 1: players may request only legal moves.)
export function legal(state, move) {
  if (state.board[move.from] !== move.color + move.piece) return false;
  const key = moveKey(move);
  return pieceMoves(state, move.from).some((m) => moveKey(m) === key);
}

// The position after a move, which must be legal.
export function apply(state, m) {
  const board = state.board.slice();
  board[m.from] = null;
  board[m.to] = m.color + (m.promo ?? m.piece);
  if (m.castle) {
    const home = m.color === "w" ? 0 : 56;
    const [rookFrom, rookTo] = m.castle === "K" ? [7, 5] : [0, 3];
    board[home + rookTo] = board[home + rookFrom];
    board[home + rookFrom] = null;
  }
  // A move to or from a king's or rook's first square ends the castlings it's part of.
  const gone = { 4: "KQ", 0: "Q", 7: "K", 60: "kq", 56: "q", 63: "k" };
  let castle = state.castle;
  for (const sq of [m.from, m.to]) for (const c of gone[sq] ?? "") castle = castle.replace(c, "");
  return { board, castle };
}

// Chess as an input game for simultaneous.js: the interface the post asks
// of a game, and nothing more. Its legal moves always commute.
export const CHESS = { legal, apply, key: keyOf, commutes: true, name: san };

// Is `color`'s king attacked? (By any piece of the other side, ignoring whose turn.)
export function inCheck(state, color) {
  const king = state.board.indexOf(`${color}K`);
  return king >= 0 && moves(state, other(color)).some((m) => m.to === king);
}

// Chess with check: a move may not leave its own side's king attacked. Fair
// Chess itself wins kings by capture, but the post's Fig. 11 needs check.
export const CHESS_WITH_CHECK = {
  legal: (state, m) => legal(state, m) && !inCheck(apply(state, m), m.color),
  apply,
  key: keyOf,
  name: san,
};

// Merges a round's requests, one per player (null for none), by the post's
// fixpoint (simultaneous.js). Each request is "made", "blocked" or "held";
// with two players a move is made only if it's legal in both orders.
export function resolve(state, requests, game = CHESS) {
  return merge(game, state, requests);
}

export const hasKing = (state, color) => state.board.includes(`${color}K`);

// A game: the position, every round so far, and how it ended. A king captured
// wins; both kings in one round, a position seen three times, or fifty rounds
// without a capture or a pawn moving is a draw.
export class Game {
  constructor(state = start()) {
    this.state = state;
    this.rounds = [];
    this.seen = new Map([[keyOf(state), 1]]);
    this.quiet = 0;
    this.over = null;
  }

  // Plays a round: `white` and `black` are requests (or null to pass).
  // Returns the round: both requests, what became of each, what was captured.
  play(white, black) {
    if (this.over) throw new Error("the game is over");
    for (const m of [white, black]) if (m && !legal(this.state, m)) throw new Error(`not a move: ${moveKey(m)}`);
    const before = this.state;
    const { state, result, steps } = resolve(before, [white, black]);
    // A capture made in both orders took a piece that didn't move away.
    const captured = [white, black].filter((m, i) => m?.capture && result[i] === "made").map((m) => before.board[m.to]);
    const round = { white, black, result, captured, before, steps };
    this.rounds.push(round);
    this.state = state;
    const pawnMoved = [white, black].some((m, i) => m && result[i] === "made" && m.piece === "P");
    this.quiet = captured.length || pawnMoved ? 0 : this.quiet + 1;
    const key = keyOf(state);
    this.seen.set(key, (this.seen.get(key) ?? 0) + 1);
    const w = hasKing(state, "w");
    const b = hasKing(state, "b");
    if (!w && !b) this.over = { winner: null, why: "Both kings fell at once" };
    else if (!b) this.over = { winner: "w", why: "White captured the black king" };
    else if (!w) this.over = { winner: "b", why: "Black captured the white king" };
    else if (this.seen.get(key) >= 3) this.over = { winner: null, why: "The same position, three times" };
    else if (this.quiet >= 50) this.over = { winner: null, why: "Fifty rounds without a capture or a pawn move" };
    return round;
  }
}

// Why a request came to what it did, in a sentence, for the round's report.
export function explain(round) {
  const { white, black, result } = round;
  const both = [white, black];
  if (white && black && result[0] === "held" && result[1] === "held") {
    return `${san(white)} and ${san(black)} each stop the other, so neither is made.`;
  }
  return both
    .map((m, i) => {
      const side = i ? "Black" : "White";
      if (!m) return `${side} passed.`;
      const them = both[1 - i];
      if (result[i] === "made") return `${side}'s ${san(m)} was made.`;
      return `${side}'s ${san(m)} was blocked by ${them ? san(them) : "nothing"}.`;
    })
    .join(" ");
}
