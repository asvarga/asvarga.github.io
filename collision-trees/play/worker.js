// Grows forests off the page's thread, so neither a huge tree nor a tree
// regrown every frame (moving rules) ever stalls it. Each request is grown
// from scratch, in chunks; between chunks a newer request may arrive, and the
// older is dropped. Big growths send what they have every so often, so the
// page can start playing them back.

import { Forest, instantiate, parseRules } from "./rules.js";

let latest = 0;
let parsedText = null;
let parsed = null;

const yieldNow = () => new Promise((r) => setTimeout(r, 0));

// Lines are settled up to the frontier: nothing laid later can cut what was
// reached before it.
function snapshot(id, forest, done, until = Infinity) {
  const b = forest.bounds() ?? { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  // Positions go to the GPU as float32, relative to a whole-number origin.
  const ox = Math.round((b.minX + b.maxX) / 2);
  const oy = Math.round((b.minY + b.maxY) / 2);
  const data = forest.pack(ox, oy);
  return {
    id,
    data,
    n: forest.n,
    ox,
    oy,
    bounds: b,
    deepest: forest.deepest,
    cuts: forest.cuts,
    capped: forest.capped,
    done,
    frontier: done ? forest.end() : Math.min(forest.next, until),
    end: done ? forest.end() : null,
  };
}

self.onmessage = async ({ data: req }) => {
  latest = req.id;
  const started = performance.now();
  let forest;
  try {
    if (req.rules !== parsedText) {
      parsed = parseRules(req.rules);
      parsedText = req.rules;
    }
    const rules = instantiate(parsed, req.t, req.mods);
    forest = new Forest({ rules, depth: req.depth, seeds: req.seeds, maxPieces: req.maxPieces });
  } catch (e) {
    self.postMessage({ id: req.id, error: e.message });
    return;
  }
  const until = req.until ?? Infinity;
  let lastPost = started;
  for (;;) {
    const before = forest.n;
    while (!forest.done && forest.next <= until && forest.n - before < 20000) forest.step();
    if (forest.done || forest.next > until) break;
    if (performance.now() - lastPost > 150 && req.partial) {
      const s = snapshot(req.id, forest, false, until);
      self.postMessage(s, [s.data.buffer]);
      lastPost = performance.now();
    }
    await yieldNow();
    if (latest !== req.id) return; // a newer request came in
  }
  const s = snapshot(req.id, forest, forest.done, until);
  s.ms = performance.now() - started;
  s.until = until;
  self.postMessage(s, [s.data.buffer]);
};
