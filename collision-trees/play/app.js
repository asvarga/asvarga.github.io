// Collision Trees, to play with: pick or write rules, plant seeds, and watch
// them race. Growing is rules.js's, in a worker (worker.js); drawing is
// render.js's, on the GPU. This is the panel, the two clocks, planting,
// panning, and the link that keeps it all (the URL's #).
//
// Two clocks: `now` is how far the trees have grown (Infinity: all the way),
// and `ptime` is the t that moving rules and swinging sliders see. While
// anything moves, the forest is grown afresh at each new t, as fast as the
// worker can, and only as far as `now`.

import { PRESETS } from "./presets.js";
import { PAPERS, Renderer } from "./render.js";
import { parseRules } from "./rules.js";

const $ = (id) => document.getElementById(id);
const canvas = $("view");
const overlay = $("overlay");
const octx = overlay.getContext("2d");

const MAX_PIECES = 400000;
const SHAPE = ["depth", "spread", "twist", "shrink"];
const LIMITS = { depth: [1, 200], spread: [0, 2], twist: [-45, 45], shrink: [0.8, 1.05] };
const DEFAULTS = { spread: 1, twist: 0, shrink: 1 };

// What the link holds.
const state = {
  preset: PRESETS[0].name,
  rules: PRESETS[0].rules,
  depth: PRESETS[0].depth,
  seeds: PRESETS[0].seeds.map((s) => ({ start: 0, ...s })),
  spread: 1,
  twist: 0,
  shrink: 1,
  swing: { depth: false, spread: false, twist: false, shrink: false },
  cycle: 12,
  color: "depth",
  paper: "night",
  effect: "neon",
  palette: "aurora",
  width: 1.3,
  glow: 1,
  sparks: true,
  tips: true,
  speed: 1,
  rate: 0.45,
  view: null, // [x, y, width]: a close-up the camera keeps to, or null to fit everything
};

let parsed = null; // the rules, parsed, if they parse
let shown = null; // the latest growth from the worker
let now = 0; // growth on show (Infinity: fully grown)
let ptime = 0; // the time moving things see
let playing = true;
let dirty = true;
const cam = { x: 0, y: 0, zoom: 20, follow: true };
let aim = null; // a seed being planted, in screen pixels
let renderer = null;

// --- Swinging -----------------------------------------------------------------

/** A shape slider's value at time t. */
function shape(key, t = ptime) {
  const base = state[key];
  if (!state.swing[key]) return base;
  const w = Math.sin((2 * Math.PI * t) / state.cycle);
  if (key === "depth") return Math.max(1, Math.round(base * (0.65 + 0.35 * w)));
  const amp = { spread: 0.35, twist: 15, shrink: 0.03 }[key];
  const [lo, hi] = LIMITS[key];
  return Math.min(hi, Math.max(lo, base + amp * w));
}

function moving() {
  return !!parsed?.moves || SHAPE.some((k) => state.swing[k]);
}

// --- The worker ---------------------------------------------------------------

const worker = new Worker(new URL("./worker.js", import.meta.url), { type: "module" });
let sentId = 0;
let inFlight = false;

/** Ask for a growth of what the panel says now. */
function ask() {
  if (!parsed) return;
  const id = ++sentId;
  const live = moving();
  inFlight = true;
  worker.postMessage({
    id,
    rules: state.rules,
    t: ptime,
    mods: { spread: shape("spread"), twist: shape("twist"), shrink: shape("shrink") },
    depth: shape("depth"),
    seeds: state.seeds,
    maxPieces: MAX_PIECES,
    // Moving trees are grown afresh each frame, so only as far as we'll show.
    until: live && now !== Infinity ? now + 2 : null,
    partial: !live,
  });
}

worker.onmessage = ({ data: msg }) => {
  const last = msg.id === sentId && (msg.error || msg.until !== undefined);
  if (last) inFlight = false;
  if (msg.error) {
    if (msg.id === sentId) $("error").textContent = msg.error;
    return;
  }
  if (msg.id < (shown?.id ?? 0)) return;
  if (last) $("error").textContent = "";
  shown = msg;
  renderer?.setData(msg);
  dirty = true;
  // Moving: start the next tree at once, while this one is drawn.
  if (last && playing && moving()) ask();
};

/** The rules or seeds changed: parse, and grow again. */
function rebuild() {
  try {
    parsed = parseRules(state.rules);
  } catch (e) {
    $("error").textContent = e.message;
    return;
  }
  ask();
  save();
}

function regrow() {
  now = 0;
  playing = true;
  cam.follow = true;
  rebuild();
}

/** The latest growth time whose lines are all settled. */
function frontier() {
  return shown ? shown.frontier : 0;
}

/** The growth time on show. */
function shownTime() {
  return Math.min(now, frontier());
}

function grownAll() {
  return !!shown?.done && now >= shown.frontier;
}

// --- The view ------------------------------------------------------------------

let W = 0;
let H = 0;
let dpr = 1;

function resize() {
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  W = window.innerWidth;
  H = window.innerHeight;
  for (const c of [canvas, overlay]) {
    c.width = Math.round(W * dpr);
    c.height = Math.round(H * dpr);
  }
  dirty = true;
}

/** The part of the screen the panel leaves free. */
function room() {
  const panel = $("panel").getBoundingClientRect();
  if (W > 760 && !$("panel").classList.contains("folded")) {
    return { left: panel.right + 10, top: 0, width: W - panel.right - 10, height: H };
  }
  return { left: 0, top: 0, width: W, height: H };
}

const toScreen = (x, y) => [W / 2 + (x - cam.x) * cam.zoom, H / 2 - (y - cam.y) * cam.zoom];
const toWorld = (sx, sy) => [cam.x + (sx - W / 2) / cam.zoom, cam.y - (sy - H / 2) / cam.zoom];

/** Where the camera should be to show everything grown so far. */
function fitted() {
  const r = room();
  if (state.view) {
    const [vx, vy, vw] = state.view;
    const zoom = Math.min(r.width, r.height) / vw;
    return {
      x: vx - (r.left + r.width / 2 - W / 2) / zoom,
      y: vy + (r.top + r.height / 2 - H / 2) / zoom,
      zoom,
    };
  }
  let b = shown?.n ? { ...shown.bounds } : null;
  for (const s of state.seeds) {
    b ??= { minX: s.x, maxX: s.x, minY: s.y, maxY: s.y };
    b.minX = Math.min(b.minX, s.x);
    b.maxX = Math.max(b.maxX, s.x);
    b.minY = Math.min(b.minY, s.y);
    b.maxY = Math.max(b.maxY, s.y);
  }
  if (!b) return { x: 0, y: 0, zoom: 20 };
  const bw = Math.max(b.maxX - b.minX, 4);
  const bh = Math.max(b.maxY - b.minY, 4);
  const zoom = Math.min(60, Math.max(0.05, 0.86 * Math.min(r.width / bw, r.height / bh)));
  const x = (b.minX + b.maxX) / 2 - (r.left + r.width / 2 - W / 2) / zoom;
  const y = (b.minY + b.maxY) / 2 + (r.top + r.height / 2 - H / 2) / zoom;
  return { x, y, zoom };
}

function follow(dt) {
  if (!cam.follow) return;
  const t = fitted();
  const k = dt === Infinity ? 1 : 1 - Math.exp(-dt * 4);
  const z = Math.exp(Math.log(cam.zoom) + (Math.log(t.zoom) - Math.log(cam.zoom)) * k);
  const moved =
    Math.abs(z / cam.zoom - 1) > 1e-4 || Math.abs(t.x - cam.x) * z > 0.05 || Math.abs(t.y - cam.y) * z > 0.05;
  cam.zoom = z;
  cam.x += (t.x - cam.x) * k;
  cam.y += (t.y - cam.y) * k;
  if (moved) dirty = true;
}

function draw() {
  const t = shownTime();
  if (renderer) {
    renderer.render(cam, {
      now: t,
      dpr,
      deepest: shown?.deepest ?? 1,
      last: Math.max(1, shown?.frontier ?? 1),
      color: state.color,
      palette: state.palette,
      paper: state.paper,
      effect: state.effect,
      glow: state.glow,
      width: Math.min(state.width * 2, Math.max(state.width * 0.7, cam.zoom * 0.1 * state.width)),
      tips: state.tips,
      sparks: state.sparks && !grownAll() && now !== Infinity,
    });
  }
  // Seeds, and the one being planted.
  octx.setTransform(dpr, 0, 0, dpr, 0, 0);
  octx.clearRect(0, 0, W, H);
  const ink = PAPERS[state.paper].seed;
  octx.lineWidth = 1.5;
  octx.strokeStyle = ink;
  for (const s of state.seeds) {
    if (s.start > t) continue;
    const [x, y] = toScreen(s.x, s.y);
    octx.beginPath();
    octx.arc(x, y, 4, 0, Math.PI * 2);
    octx.stroke();
  }
  if (aim) arrow(aim.sx, aim.sy, aim.ex, aim.ey, ink);
}

function arrow(x1, y1, x2, y2, color) {
  const len = Math.hypot(x2 - x1, y2 - y1);
  const a = len < 8 ? -Math.PI / 2 : Math.atan2(y2 - y1, x2 - x1);
  const L = Math.max(len, 28);
  const tx = x1 + Math.cos(a) * L;
  const ty = y1 + Math.sin(a) * L;
  octx.strokeStyle = color;
  octx.lineWidth = 2;
  octx.beginPath();
  octx.arc(x1, y1, 5, 0, Math.PI * 2);
  octx.moveTo(x1, y1);
  octx.lineTo(tx, ty);
  octx.moveTo(tx + Math.cos(a + 2.6) * 9, ty + Math.sin(a + 2.6) * 9);
  octx.lineTo(tx, ty);
  octx.lineTo(tx + Math.cos(a - 2.6) * 9, ty + Math.sin(a - 2.6) * 9);
  octx.stroke();
}

/** How many pieces have set out by time t (they're in order of setting out). */
function laidBy(t) {
  if (!shown) return 0;
  const d = shown.data;
  let lo = 0;
  let hi = shown.n;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (d[mid * 8 + 4] <= t) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

let treesPerSecond = 0;
function stats() {
  if (!shown) return;
  const t = shownTime();
  const seeds = state.seeds.length;
  const parts = [
    `${laidBy(t).toLocaleString()} lines`,
    `${shown.cuts.toLocaleString()} cut`,
    `${seeds} seed${seeds === 1 ? "" : "s"}`,
    `growth ${t.toFixed(1)}`,
  ];
  if (moving()) parts.push(`t ${ptime.toFixed(1)}`, `${Math.round(treesPerSecond)} trees a second`);
  else if (shown.ms !== undefined) parts.push(`grown in ${Math.round(shown.ms)} ms`);
  if (grownAll()) parts.push(shown.capped ? "stopped at the line limit" : "fully grown");
  $("stats").textContent = parts.join(" · ");
  $("play").firstChild.textContent = playing && (!grownAll() || moving()) ? "Pause " : "Play ";
  if (moving()) outputs();
}

let lastFrame = performance.now();
let lastStats = 0;
let lastShownId = 0;
let trees = 0;
let treesSince = performance.now();
function frame(t) {
  const dt = Math.min(0.1, (t - lastFrame) / 1000);
  lastFrame = t;
  const live = moving();
  if (playing) {
    if (live) {
      ptime += dt;
      dirty = true;
    }
    // Growth runs on only through what's grown (when moving, a little past
    // it: the next tree is grown that far).
    if (now !== Infinity) {
      const limit = live && !shown?.done ? now + 2 : frontier();
      if (now < limit) {
        now = Math.min(now + dt * rate(), limit);
        dirty = true;
      }
      if (live && grownAll()) now = Infinity;
    }
  }
  if (live && !inFlight) ask();
  if (shown && shown.id !== lastShownId) {
    lastShownId = shown.id;
    trees++;
  }
  if (t - treesSince > 1000) {
    treesPerSecond = (trees * 1000) / (t - treesSince);
    trees = 0;
    treesSince = t;
  }
  follow(dt);
  if (dirty) {
    draw();
    dirty = false;
  }
  if (t - lastStats > 200) {
    stats();
    lastStats = t;
  }
  requestAnimationFrame(frame);
}

function rate() {
  return 0.5 * 2 ** (state.rate * 9); // growth per second: 0.5 to 256
}

// --- The link -----------------------------------------------------------------

const round = (v) => Math.round(v * 1000) / 1000;

let saveTimer = 0;
let grownLink = false; // the link opens the trees fully grown
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const s = {
      p: state.preset,
      r: state.rules,
      d: state.depth,
      s: state.seeds.map((x) => {
        const a = [round(x.x), round(x.y), round(x.heading), round(x.speed), round(x.start)];
        if (x.team !== undefined) return [...a, round(x.length ?? 1), x.team];
        return (x.length ?? 1) === 1 ? a : [...a, round(x.length)];
      }),
      vw: state.view ?? undefined,
      m: [round(state.spread), round(state.twist), round(state.shrink)],
      sw: SHAPE.filter((k) => state.swing[k]),
      cy: state.cycle,
      c: state.color,
      w: state.paper,
      fx: state.effect,
      pl: state.palette,
      lw: round(state.width),
      gl: round(state.glow),
      k: (state.sparks ? 1 : 0) + (state.tips ? 2 : 0),
      v: round(state.speed),
      g: round(state.rate),
      e: grownLink ? 1 : 0,
    };
    history.replaceState(null, "", `#${encodeURIComponent(JSON.stringify(s))}`);
  }, 250);
}

function load() {
  if (location.hash.length < 2) return;
  try {
    const s = JSON.parse(decodeURIComponent(location.hash.slice(1)));
    const num = (v, lo, hi, d) => (Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : d);
    if (typeof s.r === "string") state.rules = s.r;
    state.depth = Math.round(num(s.d, 1, 200, state.depth));
    if (Array.isArray(s.s)) {
      state.seeds = s.s
        .filter((a) => Array.isArray(a) && a.length >= 5 && a.every(Number.isFinite))
        .slice(0, 200)
        .map(([x, y, heading, speed, start, length, team]) => ({
          x,
          y,
          heading,
          speed: num(speed, 0.05, 20, 1),
          start: Math.max(0, start),
          length: num(length, 0.01, 100, 1),
          ...(Number.isInteger(team) && team >= 0 && team < 200 ? { team } : {}),
        }));
    }
    state.view =
      Array.isArray(s.vw) && s.vw.length === 3 && s.vw.every(Number.isFinite) && s.vw[2] > 0 ? s.vw : null;
    if (Array.isArray(s.m)) {
      state.spread = num(s.m[0], 0, 2, 1);
      state.twist = num(s.m[1], -45, 45, 0);
      state.shrink = num(s.m[2], 0.8, 1.05, 1);
    }
    if (Array.isArray(s.sw)) for (const k of SHAPE) state.swing[k] = s.sw.includes(k);
    state.cycle = num(s.cy, 2, 60, 12);
    state.preset = typeof s.p === "string" ? s.p : "";
    if (["depth", "seed", "time", "ink"].includes(s.c)) state.color = s.c;
    if (["night", "day"].includes(s.w)) state.paper = s.w;
    if (["neon", "glass", "contours", "skeleton", "none"].includes(s.fx)) state.effect = s.fx;
    if (["aurora", "ember", "ocean", "candy", "moss"].includes(s.pl)) state.palette = s.pl;
    state.width = num(s.lw, 0.5, 4, 1.3);
    state.glow = num(s.gl, 0, 2, 1);
    if (Number.isFinite(s.k)) {
      state.sparks = !!(s.k & 1);
      state.tips = !!(s.k & 2);
    }
    state.speed = num(s.v, 0.25, 4, 1);
    state.rate = num(s.g, 0, 1, 0.45);
    grownLink = !!s.e;
  } catch {
    say("That link's tree couldn't be read, so here's a fresh one.");
  }
}

// --- The panel ------------------------------------------------------------------

let sayTimer = 0;
function say(text, ms = 2600) {
  $("message").textContent = text;
  clearTimeout(sayTimer);
  if (ms) sayTimer = setTimeout(() => ($("message").textContent = ""), ms);
}

const FORMAT = {
  depth: (v) => String(v),
  spread: (v) => `×${v.toFixed(2)}`,
  twist: (v) => `${v > 0 ? "+" : ""}${v.toFixed(1)}°`,
  shrink: (v) => `×${v.toFixed(3)}`,
};

function showPanel() {
  $("preset").value = PRESETS.some((p) => p.name === state.preset) ? state.preset : "";
  $("rules").value = state.rules;
  for (const k of [...SHAPE, "cycle", "speed", "rate", "width", "glow"]) $(k).value = state[k];
  for (const k of ["color", "paper", "effect", "palette"]) $(k).value = state[k];
  $("sparks").checked = state.sparks;
  $("tips").checked = state.tips;
  for (const b of document.querySelectorAll("[data-swing]")) {
    b.setAttribute("aria-pressed", String(state.swing[b.dataset.swing]));
  }
  document.body.classList.toggle("day", state.paper === "day");
  outputs();
}

function outputs() {
  for (const k of SHAPE) {
    $(`${k}-out`).textContent = state.swing[k] ? `${FORMAT[k](shape(k))} ∿` : FORMAT[k](state[k]);
  }
  $("cycle-out").textContent = `${state.cycle} s`;
  $("speed-out").textContent = `×${state.speed.toFixed(2)}`;
  const r = rate();
  $("rate-out").textContent = `${r < 10 ? r.toFixed(1) : Math.round(r)} per second`;
  $("width-out").textContent = state.width.toFixed(1);
  $("glow-out").textContent = `×${state.glow.toFixed(2)}`;
}

function custom() {
  state.preset = "";
  $("preset").value = "";
}

function choose(name) {
  const p = PRESETS.find((x) => x.name === name);
  if (!p) return;
  Object.assign(state, {
    preset: p.name,
    rules: p.rules,
    depth: p.depth,
    seeds: p.seeds.map((s) => ({ start: 0, ...s })),
    color: p.color ?? "depth",
    effect: p.effect ?? "neon",
    palette: p.palette ?? "aurora",
    view: p.view ?? null,
    ...DEFAULTS,
  });
  for (const k of SHAPE) state.swing[k] = (p.swing ?? []).includes(k);
  ptime = 0;
  showPanel();
  regrow();
  if (p.grown) now = Infinity;
}

function wire() {
  const preset = $("preset");
  preset.append(new Option("Your own", ""));
  const still = document.createElement("optgroup");
  still.label = "Still";
  const live = document.createElement("optgroup");
  live.label = "In motion";
  const original = document.createElement("optgroup");
  original.label = "The original pictures";
  for (const p of PRESETS) (p.original ? original : p.grown ? live : still).append(new Option(p.name, p.name));
  preset.append(still, original, live);
  preset.addEventListener("change", () => choose(preset.value));

  let ruleTimer = 0;
  $("rules").addEventListener("input", () => {
    clearTimeout(ruleTimer);
    ruleTimer = setTimeout(() => {
      state.rules = $("rules").value;
      custom();
      if (now !== Infinity) now = 0;
      rebuild();
    }, 300);
  });
  for (const k of SHAPE) {
    $(k).addEventListener("input", () => {
      state[k] = Number($(k).value);
      custom();
      outputs();
      rebuild();
    });
  }
  for (const b of document.querySelectorAll("[data-swing]")) {
    b.addEventListener("click", () => {
      const k = b.dataset.swing;
      state.swing[k] = !state.swing[k];
      b.setAttribute("aria-pressed", String(state.swing[k]));
      custom();
      if (state.swing[k]) playing = true;
      outputs();
      rebuild();
    });
  }
  const plain = { cycle: false, speed: false, rate: false, width: true, glow: true };
  for (const [k, redraw] of Object.entries(plain)) {
    $(k).addEventListener("input", () => {
      state[k] = Number($(k).value);
      outputs();
      if (redraw) dirty = true;
      save();
    });
  }
  for (const k of ["color", "effect", "palette", "paper"]) {
    $(k).addEventListener("change", () => {
      state[k] = $(k).value;
      document.body.classList.toggle("day", state.paper === "day");
      dirty = true;
      save();
    });
  }
  for (const k of ["sparks", "tips"]) {
    $(k).addEventListener("change", () => {
      state[k] = $(k).checked;
      dirty = true;
      save();
    });
  }

  $("fold").addEventListener("click", fold);
  $("play").addEventListener("click", togglePlay);
  $("step").addEventListener("click", wait);
  $("end").addEventListener("click", toEnd);
  $("regrow").addEventListener("click", regrow);
  $("fit").addEventListener("click", fit);
  $("unplant").addEventListener("click", unplant);
  $("clear").addEventListener("click", () => {
    state.seeds = [];
    state.view = null;
    custom();
    now = 0;
    rebuild();
    say("Click anywhere to plant a seed.");
  });
  $("save").addEventListener("click", savePng);
  $("share").addEventListener("click", async () => {
    grownLink = now === Infinity || grownAll();
    save();
    await new Promise((r) => setTimeout(r, 300));
    try {
      await navigator.clipboard.writeText(location.href);
      say("Link copied: it opens this very tree.");
    } catch {
      say("Couldn't copy: the address bar has the link.");
    }
  });

  window.addEventListener("keydown", (e) => {
    const t = e.target;
    const typing =
      t instanceof HTMLTextAreaElement ||
      t instanceof HTMLSelectElement ||
      (t instanceof HTMLInputElement && t.type !== "checkbox" && t.type !== "range");
    if (typing) {
      if (e.key === "Escape") t.blur();
      return;
    }
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const act = { " ": togglePlay, w: wait, e: toEnd, r: regrow, f: fit, z: unplant, h: fold }[e.key.toLowerCase()];
    if (!act) return;
    e.preventDefault();
    act();
  });
}

function togglePlay() {
  if (grownAll() && !moving()) {
    now = 0;
    playing = true;
  } else {
    playing = !playing;
  }
  dirty = true;
}

/** One beat: as long as a unit line takes to grow, or a tenth of a second of motion. */
function wait() {
  playing = false;
  if (now !== Infinity && !grownAll()) now = Math.min(now + 1, frontier());
  else if (moving()) ptime += 0.1;
  dirty = true;
}

function toEnd() {
  now = Infinity;
  if (moving()) ask();
  dirty = true;
}

function fit() {
  cam.follow = true;
  dirty = true;
}

function fold() {
  const folded = $("panel").classList.toggle("folded");
  $("fold").textContent = folded ? "›" : "‹";
  $("fold").setAttribute("aria-expanded", String(!folded));
  dirty = true;
}

function unplant() {
  if (state.seeds.length === 0) return;
  state.seeds.pop();
  state.view = null;
  custom();
  rebuild();
}

function savePng() {
  draw();
  canvas.toBlob((blob) => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "collision-tree.png";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });
}

// --- Planting, panning and zooming -------------------------------------------

const pointers = new Map();
let pan = null;
let pinch = null;

function plant(a) {
  const dx = a.ex - a.sx;
  const dy = a.ey - a.sy;
  const heading = Math.hypot(dx, dy) < 8 ? 90 : (Math.atan2(-dy, dx) * 180) / Math.PI;
  const [x, y] = toWorld(a.sx, a.sy);
  const t = shownTime();
  const start = Number.isFinite(t) ? t : 0;
  state.seeds.push({ x: round(x), y: round(y), heading: round(heading), speed: state.speed, start: round(start) });
  state.view = null;
  custom();
  // A seed planted in a grown forest grows from now on, so let time run.
  if (now === Infinity) now = start;
  playing = true;
  rebuild();
}

canvas.addEventListener("contextmenu", (e) => e.preventDefault());

canvas.addEventListener("pointerdown", (e) => {
  canvas.setPointerCapture(e.pointerId);
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pointers.size === 2) {
    aim = null;
    pan = null;
    const [a, b] = [...pointers.values()];
    pinch = { dist: Math.hypot(a.x - b.x, a.y - b.y), mid: [(a.x + b.x) / 2, (a.y + b.y) / 2] };
    dirty = true;
    return;
  }
  if (pointers.size > 2) return;
  if (e.button !== 0 || e.shiftKey) {
    pan = { x: e.clientX, y: e.clientY };
    canvas.classList.add("panning");
    return;
  }
  aim = { sx: e.clientX, sy: e.clientY, ex: e.clientX, ey: e.clientY };
  dirty = true;
});

canvas.addEventListener("pointermove", (e) => {
  if (!pointers.has(e.pointerId)) return;
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pinch && pointers.size === 2) {
    const [a, b] = [...pointers.values()];
    const dist = Math.hypot(a.x - b.x, a.y - b.y);
    const mid = [(a.x + b.x) / 2, (a.y + b.y) / 2];
    zoomAt(mid[0], mid[1], dist / pinch.dist);
    cam.x -= (mid[0] - pinch.mid[0]) / cam.zoom;
    cam.y += (mid[1] - pinch.mid[1]) / cam.zoom;
    pinch = { dist, mid };
    return;
  }
  if (pan) {
    cam.x -= (e.clientX - pan.x) / cam.zoom;
    cam.y += (e.clientY - pan.y) / cam.zoom;
    pan = { x: e.clientX, y: e.clientY };
    cam.follow = false;
    dirty = true;
    return;
  }
  if (aim) {
    aim.ex = e.clientX;
    aim.ey = e.clientY;
    dirty = true;
  }
});

function release(e) {
  if (!pointers.has(e.pointerId)) return;
  pointers.delete(e.pointerId);
  if (pinch) {
    if (pointers.size < 2) pinch = null;
    return;
  }
  if (pan) {
    pan = null;
    canvas.classList.remove("panning");
    return;
  }
  if (aim && e.type === "pointerup") plant(aim);
  aim = null;
  dirty = true;
}
canvas.addEventListener("pointerup", release);
canvas.addEventListener("pointercancel", release);

function zoomAt(sx, sy, factor) {
  const [wx, wy] = toWorld(sx, sy);
  cam.zoom = Math.min(2000, Math.max(0.01, cam.zoom * factor));
  const [nx, ny] = toWorld(sx, sy);
  cam.x += wx - nx;
  cam.y += wy - ny;
  cam.follow = false;
  dirty = true;
}

canvas.addEventListener(
  "wheel",
  (e) => {
    e.preventDefault();
    zoomAt(e.clientX, e.clientY, Math.exp(-e.deltaY * (e.deltaMode === 1 ? 0.05 : 0.0015)));
  },
  { passive: false },
);

// --- Go -----------------------------------------------------------------------

window.addEventListener("resize", resize);
resize();
try {
  renderer = new Renderer(canvas);
  if (!renderer.flood) say("This browser can't draw the effects, so the lines come plain.", 5000);
} catch (e) {
  say(e.message, 0);
}
load();
wire();
showPanel();
rebuild();
if (grownLink) now = Infinity;
requestAnimationFrame(frame);
