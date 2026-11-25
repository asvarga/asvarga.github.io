// Tic-tac-toe as an input game for simultaneous.js, the post's Fig. 2: pieces
// are placed, not moved, so chess's own ways of settling a collision don't
// apply, and the general rule does. A state is nine cells ("X", "O" or "");
// a move is a player and a cell.

export const TICTACTOE = {
  legal: (state, m) => state[m.cell] === "",
  apply: (state, m) => state.map((c, i) => (i === m.cell ? m.player : c)),
  key: (state) => state.map((c) => c || ".").join(""),
  commutes: true,
  name: (m) => `${m.player}${m.cell}`,
};

export const empty = () => Array(9).fill("");

const LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];

// The players with three in a row (both, if a round completes two rows).
export const winners = (state) => [...new Set(LINES.filter(([a, b, c]) => state[a] && state[a] === state[b] && state[a] === state[c]).map(([a]) => state[a]))];
