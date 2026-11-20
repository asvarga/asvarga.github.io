// The post's figures, to load and resolve step by step. Each is a position
// (ranks 8 to 1, as fromRows takes them) and the requests drawn on it, as
// from-to squares. In the figures with many rooks every piece is its own player.

import { CHESS, CHESS_WITH_CHECK, fromRows, pieceMoves, square, start, apply } from "./rules.js";

export const FIGURES = [
  {
    fig: 1,
    name: "Both request Bh6",
    rows: null, // the start, after 1. d4 g6
    opening: [["d2", "d4"], ["g7", "g6"]],
    requests: [["c1", "h6"], ["f8", "h6"]],
    text: "Both players request Bh6; what happens? Whichever went first would make the other's move a capture, a different move. So neither is made.",
  },
  {
    fig: 4,
    name: "No premoves",
    rows: ["........", "........", "..r..R..", "........", "........", ".....R..", "........", "........"],
    requests: [["c6", "f6"]],
    text: "White would like to premove Rxf6, taking back on f6 if Black captures there. But capturing one's own piece isn't a move in chess, so it can't be requested (Rule 1). White has nothing to request with that rook here, and Black's Rxf6 is made.",
  },
  {
    fig: 5,
    name: "Pawn collision",
    rows: ["........", "........", "....p...", "........", "....P...", "........", "........", "........"],
    requests: [["e4", "e5"], ["e6", "e5"]],
    text: "Both try e5. If White goes first, Black is blocked; if Black goes first, White is. Neither move is legal in both orders, so neither is made.",
  },
  {
    fig: 6,
    name: "Rook collision",
    rows: ["........", "........", "..r.....", "........", "........", ".....R..", "........", "........"],
    requests: [["f3", "f6"], ["c6", "f6"]],
    text: "Both try Rf6. They aren't Rxf6 captures, so it's the pawn collision again: both are blocked.",
  },
  {
    fig: 7,
    name: "Rook block",
    rows: ["........", "........", "..r.....", "........", "........", ".....R..", "........", "........"],
    requests: [["f3", "f8"], ["c6", "f6"]],
    text: "White plays Rf8, Black Rf6. White first, both are legal; Black first, White is blocked. So Black's move is made, and then White's isn't legal.",
  },
  {
    fig: 8,
    name: "Rook escape",
    rows: ["........", "........", "..r..R..", "........", "........", "........", "........", "........"],
    requests: [["f6", "f3"], ["c6", "f6"]],
    text: "White plays Rf3, Black Rxf6. White first, Black's capture finds nothing; Black first, White's rook is gone. Black holds White in place, and neither move is made.",
  },
  {
    fig: 9,
    name: "Three rooks",
    rows: ["........", "........", "....r...", "..R.....", "...R....", "........", "........", "........"],
    requests: [["c5", "e5"], ["d4", "f4"], ["e6", "e4"]],
    text: "Every rook is its own player. Only c5's move is legal in every ordering at first. But once it's made, it blocks the black rook, and then nothing stops d4: the loop goes on until nothing more can be decided.",
  },
  {
    fig: 10,
    name: "Twelve rooks",
    rows: ["..r.....", "R..r....", ".R..r...", "..R..r..", "...R..r.", "....R..r", ".....R..", "........"],
    requests: [
      ["a7", "c7"], ["b6", "d6"], ["c5", "e5"], ["d4", "f4"], ["e3", "g3"], ["f2", "h2"],
      ["c8", "c6"], ["d7", "d5"], ["e6", "e4"], ["f5", "f3"], ["g4", "g2"], ["h3", "h1"],
    ],
    text: "A white rook is made, which blocks a black rook, which frees the next white rook, and so on down the board: twelve players, and every white rook moves.",
  },
  {
    fig: 11,
    name: "Pairwise isn't enough",
    rows: ["k.......", "........", "......K.", "........", "........", "b...p...", "........", "........"],
    requests: [["a3", "c1"], ["e3", "e2"], ["g6", "g5"]],
    check: true,
    text: "Mateen Kasim's counterexample, with check: each pair of these moves is legal in both orders, but bishop to c1 and the pawn out of the way leave g5 attacked, so the king can't go there. Checking pairs alone would make all three. (The pawn steps to e2 here, since black pawns go down.) Turn check off and all three are made.",
  },
];

// A figure's position, its requests as moves, and the game it's played in.
export function load(figure, check = figure.check ?? false) {
  let state = figure.rows ? fromRows(figure.rows) : start();
  for (const [from, to] of figure.opening ?? []) state = apply(state, find(state, from, to));
  const requests = figure.requests.map(([from, to]) => find(state, from, to));
  return { state, requests, game: check ? CHESS_WITH_CHECK : CHESS };
}

function find(state, from, to) {
  const move = pieceMoves(state, square(from)).find((m) => m.to === square(to) && (m.promo ?? "Q") === "Q");
  if (!move) throw new Error(`${from}-${to} isn't a move`);
  return move;
}
