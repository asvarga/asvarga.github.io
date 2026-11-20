// Simultaneous games from turn-based ones, for any game, as in "Fair Chess and
// Simultaneous Games" (asvarga.com/blog/2024/06/22/fair-chess-and-simultaneous-games/).
//
// An input game is opaque: all we may do is ask it whether a move can be made
// in a state, make it, and tell states apart. Whose turn it is isn't part of
// the state; it's in the moves, so any player may move out of any state.
//
//   interface Game<State, Move> {
//     legal(state, move): boolean   // is the move a transition out of this state?
//     apply(state, move): State     // the state after a legal move
//     key(state): string            // equal keys for equal states
//     commutes?: boolean            // legal moves always commute (chess): skip line 5
//     name?(move): string           // how to write a move, for traces
//   }
//
// Each round every player requests one move (Rule 1: only legal moves, or null
// for none), and `resolve` merges them by the post's fixpoint:
//
//   1 start with all moves unresolved
//   2 while not at fixpoint:
//   3   resolve all illegal moves without merging them
//   4   M := the set of moves legal in all orderings of unresolved moves
//   5   if all possible orderings of M lead to the same game state:
//   6     merge all moves in M and resolve them
//
// With two players this is Rule 2: (a) only moves legal in both orders are
// merged, and (b) not if the two orders end in different states.

// In an ordering, a move that can't be made when its turn comes is skipped. So
// the states an ordering can reach before move `i` are those reached by making
// other moves one after another, each legal when made: the rest of the
// ordering comes after `i`. Move `i` is legal in all orderings exactly when it
// is legal in every such state. This walks them, sharing states reached by
// several orderings, so it's far less than n! (2^(n-1) states at most when
// moves commute), and stops at the first state where `i` can't be made.
// Returns null if it's always legal, or the moves of an ordering that stops it.
export function stopper(game, state, moves, i) {
  const seen = new Set();
  const stack = [{ made: [], s: state }];
  while (stack.length) {
    const { made, s } = stack.pop();
    const id = visit(game, made, s);
    if (seen.has(id)) continue;
    seen.add(id);
    if (!game.legal(s, moves[i])) return made;
    for (let j = 0; j < moves.length; j++) {
      if (j === i || made.includes(j) || !game.legal(s, moves[j])) continue;
      stack.push({ made: [...made, j], s: game.apply(s, moves[j]) });
    }
  }
  return null;
}

// Where a walk is: which moves are made (enough when moves commute) and the state.
function visit(game, made, s) {
  const set = [...made].sort((a, b) => a - b).join(",");
  return game.commutes ? set : `${set}|${game.key(s)}`;
}

// The states every ordering of `moves` ends in (each legal in all orderings).
function ends(game, state, moves) {
  if (game.commutes) return [moves.reduce((s, m) => game.apply(s, m), state)];
  const out = new Map();
  const seen = new Set();
  const stack = [{ made: [], s: state }];
  while (stack.length) {
    const { made, s } = stack.pop();
    const id = visit(game, made, s);
    if (seen.has(id)) continue;
    seen.add(id);
    if (made.length === moves.length) out.set(game.key(s), s);
    for (let j = 0; j < moves.length; j++) {
      if (!made.includes(j)) stack.push({ made: [...made, j], s: game.apply(s, moves[j]) });
    }
  }
  return [...out.values()];
}

// Merges one round's requests (one per player, null for none). Returns the new
// state; each request's fate: "made", "blocked" (illegal once the moves made
// before it were) or "held" (undecided at the fixpoint: each stops another);
// and the steps, one per pass of the loop that decided something:
//   { blocked: [players], made: [players], stoppedBy: {player: [players]}, state }
// where stoppedBy says, for each move left out of M, an ordering of the others
// that stops it.
export function resolve(game, state, requests) {
  const result = requests.map((m) => (m ? null : undefined));
  const steps = [];
  let s = state;
  for (;;) {
    const step = { blocked: [], made: [], stoppedBy: {}, state: s };
    let open = result.flatMap((r, i) => (r === null ? [i] : []));
    for (const i of open) {
      if (!game.legal(s, requests[i])) {
        result[i] = "blocked";
        step.blocked.push(i);
      }
    }
    open = open.filter((i) => result[i] === null);
    const moves = open.map((i) => requests[i]);
    const M = [];
    open.forEach((player, k) => {
      const stop = stopper(game, s, moves, k);
      if (stop) step.stoppedBy[player] = stop.map((j) => open[j]);
      else M.push(player);
    });
    if (M.length) {
      const out = ends(game, s, M.map((i) => requests[i]));
      if (out.length === 1) {
        s = out[0];
        for (const i of M) result[i] = "made";
        step.made = M;
      }
    }
    step.state = s;
    if (!step.blocked.length && !step.made.length) {
      for (const i of open) result[i] = "held";
      if (open.length) steps.push({ ...step, held: open });
      break;
    }
    steps.push(step);
  }
  return { state: s, result: result.map((r) => r ?? null), steps };
}

// Every ordering of a few moves, and which of them can be made in it: for
// showing why, when there are few enough to list (n! of them).
export function orderings(game, state, requests, players) {
  const out = [];
  const walk = (order) => {
    if (order.length === players.length) {
      let s = state;
      const legal = order.map((i) => {
        const ok = game.legal(s, requests[i]);
        if (ok) s = game.apply(s, requests[i]);
        return ok;
      });
      out.push({ order, legal });
      return;
    }
    for (const i of players) if (!order.includes(i)) walk([...order, i]);
  };
  walk([]);
  return out;
}
