---
layout: post
title: "Simultaneous Chess and Other Games"
date: 2024-06-22
tags: [Game]
categories: [Game]
authors: [me]
---

The game of chess is famously flawed due to the [first-move advantage](https://en.wikipedia.org/wiki/First-move_advantage_in_chess), in which the player who moves first has a significant advantage over the other player, so let's fix it and make it fair.

<!-- more -->

### Simultaneous Chess

Perhaps the simplest way to get rid of a first-move advantage is to remove the first move: we'll consider chess variants where both players move simultaneously. This is a well-known concept in game theory, called a [simultaneous game](https://en.wikipedia.org/wiki/Simultaneous_game). We might have a setup where in each round of play:

1. Both players write down a move in [algebraic notation](https://en.wikipedia.org/wiki/Algebraic_notation_(chess)). I'll call this "requesting" a move.
2. Players reveal their moves simultaneously.
3. Their moves are both executed, possibly with some resolution of conflicts. I'll call this "merging" the moves.

<figure>
  <img src='/files/chess-1.png' width=400 />
  <figcaption>Fig. 1 - Both players request Bh6; what happens?</figcaption>
</figure>

The interesting part of designing such a simulataneous game is determining the rules for resolving merge conflicts in step 3. For example, what happens when both players move a piece to the same square? Some possibilities include:

- Both pieces are captured.
- Both pieces are kept their original squares.
- The [higher-valued](https://en.wikipedia.org/wiki/Chess_piece_relative_value) piece captures the lower-valued piece.
- Pieces are animated one square at a time towards their destination, and the piece to arrive last captures the piece already there.
- Players enter a boxing ring and fight for the square.

### Simultaneous Games in General

All of those conflict resolution rules are fair, but I'm interested in rules that apply to *all* games. The problem with the resolutions above is that they are specific to the rules of chess. For example, they won't transfer to a game like tic-tac-toe where pieces aren't *moved* but rather *placed*.

<figure>
  <img src='/files/tic-tac-toe-1.png' width=400 />
  <figcaption>Fig. 2 - Both players request the center square; what happens?</figcaption>
</figure>

In particular, I want a sort of function mapping turn-based games to simultaneous games. Without getting too formal, these input games could be defined via their [game trees](https://en.wikipedia.org/wiki/Game_tree) by providing:

- An initial game state
- Transitions between game states based on player moves
- Predicates for determining the end of the game

It's important to note that a game state must not encode whose turn it is, which would be a non-starter for us. An implementation of these games would keep track of whose turn it is outside of the game state, like separating the chess clock from the chess board. This means that we'll have transitions out of states for all players.

<figure>
  <img src='/files/game-tree-1.svg' width=400 />
  <figcaption>Fig. 3 - Part of a game tree with transitions for multiple players out of a single state.</figcaption>
</figure>

Given how opaque this general game interface is, there are really only so many things we can do with it to build a simulataneous game. Lets start with:

> **Rule 1:** Players may only submit moves that are legal in the input game.

This might seem like an obvious rule to avoid trivial output games, but certain simultaneous chess variants don't require this rule. Consider the following moves:

<figure>
  <img src='/files/chess-2.png' width=400 />
  <figcaption>Fig. 4 - White preemptively tries to capture their own piece on f6.</figcaption>
</figure>

White is assuming that Black will capture on `f6`, so White tries to "premove" to capture back on the same square. Such chess variants need to specify what happens when Black doesn't capture on `f6`. However, allowing moves like this is impossible in general simultaneous games because "capturing one's own piece" isn't a legal transition in the input game. It isn't in the game tree so it can't be described or requested through the opaque game interface.

Now we turn to the question of how to resolve conflicts in general. We'll stick to 2-player games for now, and generalize later. Again there are only so many things we can do, but I'll propose:

> **Rule 2:** a. Moves are tried in both orders, and only moves that are legal in both orders are merged. b. If both moves are legal in both orders but a different game state is reached in each order, neither move is merged.

This rule again uses none of the details of the input game and instead speaks opaquely about moves and states. It's important that the input games transitions be labelled by moves for this rule to work. I'll illustrate how this rule manifests in chess with a couple examples:

<figure>
  <img src='/files/chess-pawn-collision.png' width=400 />
  <figcaption>Fig. 5 - Pawn Collision</figcaption>
</figure>

In Fig. 5, both players try `e5`. If White goes first, Black is blocked. If Black goes first, White is blocked. Neither move is legal in both orders, so the moves are not merged.

<figure>
  <img src='/files/chess-rook-collision.png' width=400 />
  <figcaption>Fig. 6 - Rook Collision</figcaption>
</figure>

In Fig. 6, both players try `Rf6`. The situation is actually the same as in Fig. 5 because the moves are not `Rxf6` captures, so again both moves are blocked. We could alternatively omit the capture `x` from the definition of moves, but the result here would be the same.

<figure>
  <img src='/files/chess-rook-block.png' width=400 />
  <figcaption>Fig. 7 - Rook Block</figcaption>
</figure>

In Fig. 7, White plays `Rf8` and Black plays `Rf6`. If White moves first, both moves are legal. If Black moves first, White is blocked. So only Black moves and White is blocked.

<figure>
  <img src='/files/chess-rook-escape.png' width=400 />
  <figcaption>Fig. 8 - Rook Escape</figcaption>
</figure>

In Fig. 7, White plays `Rf3` and Black plays `Rxf6`. If White goes first, Black's move fails because it is a capture. If Black goes first, White is captured and unable to move. Ultimately Black holds White in place and neither move is merged.

All of these scenarios illustrate rule 2a. Rule 2b is in fact irrelevant for chess, because successful moves always commute.

### Generalizing to >2 Players

TODO:

### Links

- Images created using [chess.com/analysis](https://www.chess.com/analysis) and [playtictactoe.org](https://playtictactoe.org/) and [app.diagrams.net](https://app.diagrams.net/)