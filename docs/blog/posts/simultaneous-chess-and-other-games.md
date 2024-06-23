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
  <figcaption>Both players request Bh6; what happens?</figcaption>
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
  <figcaption>Both players request the center square; what happens?</figcaption>
</figure>