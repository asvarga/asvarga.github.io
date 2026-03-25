---
layout: post
title: "NanoBots"
date: 2026-03-24
tags: [Compilers, Game, ParallelProgramming]
categories: [Compilers, Game, ParallelProgramming]
authors: [me]
---

I made a [simulation](../../site/nanobots/index.html) where users program millions of nanobots that run in the GPU. Let me show you its features :)

<figure>
  <img src='/files/nanobots.png' width="100%" />
  <figcaption>Screenshot of simulation depicting multiple "states of matter"</figcaption>
</figure>

<!-- more -->

### Overview

The simulation can be found [here](../../site/nanobots/index.html). On the left you'll find the grid of cells in which the simulation takes place. Many "nanobots" live in the grid and are represented by pixels. To the right is a text editor where you can program the nanobots. When the program is edited, it is compiled to WebGL shader code and executed on the GPU. Execution is completely deterministic and divergence-free for all programs in spite of the massive parallelism.

The compiler itself is implemented in Rust and built for WASM, allowing a closed "development" loop right in the browser. Compiled GPU code is hot-swapped in without disruption and bot states are maintained when possible. The editor uses CodeMirror6 with custom syntax highlighting.

I designed it over the course of several years and then implemented it in a day with Claude Code.

### Compilation + Performance

It would be very unwieldy to represent bytecode in GPU buffers and interpret it in GPU threads. This somewhat necessitates compilation of user programs to GPU shader code itself, and was the motivation for this project in the first place. This enables crazy performance. It's ultimately able to simulate 2.7 million bots @ 200 rounds/sec on my M1 for a total of over *half a billion bot rounds/second* on my M1. This was in a 2040 x 2040 grid with the simple default program. There are certainly more optimizations to squeeze out on both the compiler and GPU fronts.

In particular, we compile via an IR with register machine with basic blocks. Click the "GPU" button on the bottom right to inspect the generated WGSL code.

### Gas

The programs uses an concept called "gas" or "fuel" to limit the execution time of each round and prevent divergence. Code is compiled to a register machine with basic blocks. Each operator in the the machine is assigned a gas quantity that approximates execution cost on standard hardware. Each block statically knows its total gas cost so we're able to generate code to decrement and check gas allotments at the top of each basic block and preempt the round. The identifier for the basic block is stored in the buffer to allow execution to resume in the next round.

For an extreme example of gas in action, try entering the following "infinite" loop and stepping execution.

```py
MOVE_CMD = 0 # start heading north
while true: 
    MOVE_CMD = (MOVE_CMD + 1) % 4 # turn right
```

Each bot tries to turn indefinitely each round but is preempted after some consistent quantity of gas is utilized. Whatever `MOVE_CMD` was last set is what is committed to the game. This pattern is actually very useful for programming games. Bots can continually search for optimal moves and write them to the output register whenever they find a new best. They don't need to worry about running out of gas before finishing their work.

I used a very simple model of gas here where the gas operations themselves (decrement + check) have no cost themselves, and programs don't have an ability to query gas allotments. It also isn't optimized at all; a reachability analysis could show which basic blocks are actual potential preemption points. This would allow gas checks to be elided and fewer queues to be required of a hypothetical GPU scheduler. Such a scheduler would improve warp divergence.

### Determinism

The simulation is kept deterministic with rules similar to those in my [Simultaneous Chess](./fair-chess-and-simultaneous-games.md) post. It would technically be possible to combine these projects into a gigantic chess board with simultaneous moves. Each round is split into 2 phases:

1. All bots propose a move. Those that are impossible even if no other bot moves are rejected immediately, i.e. moves to occupied cells or out of bounds.
2. Moves are de-conflicted, i.e. if multiple bots try to move to the same cell, they get blocked.

This is implemented by:

1. Bots atomically increment a counter in the cell to which they wish to move in phase 1. 
2. Bots verify that this counter is set to exactly one in phase 2.

This ruleset allows moves to be resolved on O(1) time per bot by avoiding unbounded chains of conflicts.

<figure>
  <img src='/files/sleepy-hexes.png' width="100%" />
  <figcaption>We leave you this morning with some emergent hexagonal structure</figcaption>
</figure>
