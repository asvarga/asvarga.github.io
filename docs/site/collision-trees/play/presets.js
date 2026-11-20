// Trees to start from. Each is rules, a depth and seeds (see rules.js), and
// maybe how to show it: color, effect, palette, and the shape sliders
// (spread, twist, shrink, depth) with `swing` naming those that swing in
// time. `grown` ones start fully grown, since they move. `view` is a close-up
// the camera keeps to, [x, y, width], for pictures that were crops.
//
// `original` ones redraw the pictures on the original page
// (https://asvarga.com/site/collision-trees/), in its order, in plain ink.

const UP = { x: 0, y: 0, heading: 90, speed: 1 };
// The originals' races start each tree as four, one each way, so each seed
// is a cross; `team` colors the four as one.
const cross = (x, y, speed, team, length = 1) =>
  [90, 180, 270, 0].map((heading) => ({ x, y, heading, speed, team, length }));
const FIB = "# Grown-up L and R fork, young M and S carry on, then grow up.\nT: 22.5 L, -22.5 R\nL: 22.5 L, -22.5 M\nM: 0 L\nR: -22.5 R, 22.5 S\nS: 0 R";
const ORIGINAL = { original: true, color: "ink", effect: "none" };

export const PRESETS = [
  { name: "Fork 45°", rules: "A: 45 A, -45 A", depth: 80, seeds: [UP] },
  { name: "Right angles", rules: "A: 90 A, -90 A", depth: 80, seeds: [UP], effect: "glass", palette: "ocean" },
  { name: "Fork 30°", rules: "A: 30 A, -30 A", depth: 80, seeds: [UP], effect: "contours" },
  { name: "Fork 60°", rules: "A: 60 A, -60 A", depth: 80, seeds: [UP], effect: "glass", palette: "candy" },
  { name: "Pentagon", rules: "A: 72 A, -72 A", depth: 80, seeds: [UP], palette: "ember" },
  { name: "Trident", rules: "A: 60 A, 0 A, -60 A", depth: 60, seeds: [UP], effect: "skeleton" },
  { name: "Crow's foot", rules: "A: 90 A, 0 A, -90 A", depth: 60, seeds: [UP], effect: "glass", palette: "moss" },
  { name: "Lopsided", rules: "A: 20 A, -70 A", depth: 80, seeds: [UP] },
  { name: "Swirl", rules: "A: 72 A, -36 A", depth: 80, seeds: [UP], palette: "ember" },
  { name: "Snail", rules: "A: 15 A, -15 A, 75 B\nB: 0 B", depth: 80, seeds: [UP], effect: "contours", palette: "ocean" },
  { name: "Two kinds", rules: "A: 45 A, -45 B\nB: 90 A, -90 A", depth: 80, seeds: [UP], effect: "glass" },
  { name: "Fading", rules: "A: 40 A*0.93, -40 A*0.93", depth: 40, seeds: [UP], palette: "candy" },
  {
    name: "Fibonacci",
    rules: "# A is grown up: it forks. B is young: it carries on.\nA: 25 A, -25 B\nB: 0 A",
    depth: 40,
    seeds: [UP],
    palette: "moss",
  },
  {
    name: "Race",
    rules: "A: 45 A, -45 A",
    depth: 120,
    color: "seed",
    effect: "glass",
    seeds: [
      { x: -14, y: -8, heading: 90, speed: 1 },
      { x: 14, y: -8, heading: 90, speed: 1.25 },
      { x: 0, y: 16, heading: -90, speed: 1.6 },
    ],
  },
  {
    name: "Face off",
    rules: "A: 90 A, -90 A",
    depth: 120,
    color: "seed",
    seeds: [
      { x: -10, y: 0, heading: 0, speed: 1 },
      { x: 10, y: 0, heading: 180, speed: 1.1 },
    ],
  },
  {
    name: "Ring",
    rules: "A: 50 A, -50 A",
    depth: 60,
    color: "seed",
    effect: "glass",
    seeds: Array.from({ length: 6 }, (_, i) => {
      const a = (i * 60 * Math.PI) / 180;
      return { x: 12 * Math.cos(a), y: 12 * Math.sin(a), heading: (i * 60 + 180) % 360, speed: 1 };
    }),
  },
  // The original pictures.
  { name: "Octagons", rules: "45, -45", depth: 20, seeds: [UP], ...ORIGINAL },
  { name: "Four coils", rules: "-90, -20, -15", depth: 60, seeds: [UP], ...ORIGINAL },
  {
    name: "Feathers",
    rules: "# The right-hand branches wait a step.\nT: 12 L, -12 R\nL: 12 L, -12 R\nR: -12 R, 12 M\nM: 0 L",
    depth: 30,
    seeds: [UP],
    view: [0, 2.5, 40],
    ...ORIGINAL,
  },
  { name: "Petals", rules: "30, -30", depth: 25, seeds: [UP], ...ORIGINAL },
  { name: "Yin and yang", rules: "8, -160", depth: 60, seeds: [UP], ...ORIGINAL },
  { name: "Figure eight", rules: "160, -170", depth: 80, seeds: [UP], ...ORIGINAL },
  { name: "Squares and pentagons", rules: "90, -126", depth: 60, seeds: [UP], view: [0, 6, 18], ...ORIGINAL },
  { name: "Snowflake", rules: "60, -60", depth: 120, seeds: [UP], ...ORIGINAL },
  { name: "Bubbles", rules: "36, -108", depth: 50, seeds: [UP], ...ORIGINAL },
  { name: "Vortex", rules: "-18, 12", depth: 60, seeds: [UP], view: [1, 0, 28], ...ORIGINAL },
  { name: "Sawteeth", rules: "-9, 162", depth: 40, seeds: [UP], view: [0, 0.8, 9], ...ORIGINAL },
  { name: "Ripples", rules: "5, -5", depth: 80, seeds: [UP], ...ORIGINAL },
  { name: "Tree rings", rules: "5.5, -5.7", depth: 80, seeds: [UP], view: [0.2, 7, 131], ...ORIGINAL },
  { name: "Turning squares", rules: "-90, -45, -60", depth: 12, seeds: [UP], view: [0.5, 0.5, 4], ...ORIGINAL },
  { name: "Currents", rules: "5, -175", depth: 60, seeds: [UP], view: [0, 0, 22], ...ORIGINAL },
  { name: "Tangle", rules: "-150, -15, -10", depth: 80, seeds: [UP], ...ORIGINAL },
  {
    name: "Nautilus",
    rules: "# Every branch 0.95 as long as its parent.\nA: 9.5 A*0.95, -18 A*0.95",
    depth: 50,
    seeds: [UP],
    view: [0, 0, 40],
    ...ORIGINAL,
  },
  { name: "Fibonacci, mirrored", rules: FIB, depth: 20, seeds: [UP], view: [0, 3.3, 45.5], ...ORIGINAL },
  { name: "Fibonacci thicket", rules: FIB, depth: 40, seeds: [UP], view: [0, 0, 45.5], ...ORIGINAL },
  {
    name: "Heart",
    rules: "25, -25",
    depth: 140,
    seeds: [...cross(0, 18.75, 1, 0), ...cross(-8.75, 0, 0.45, 1), ...cross(8.75, 0, 0.45, 1)],
    view: [0, -18, 100],
    ...ORIGINAL,
    color: "seed",
  },
  {
    name: "Island",
    rules: "30, -30",
    depth: 100,
    seeds: [...cross(-12, 0, 1, 0), ...cross(40, 0, 1, 0), ...cross(-6.4, 0.4, 0.6, 1, 0.5)],
    view: [0, 0, 32],
    ...ORIGINAL,
    color: "seed",
  },
  // More to try: both branches turning the same way coil up like rope.
  { name: "Rope", rules: "-20, -10", depth: 60, seeds: [UP], effect: "contours", palette: "ember" },
  { name: "Trefoil", rules: "-120, -10", depth: 80, seeds: [UP], effect: "glass", palette: "candy" },
  { name: "Triskelion", rules: "-100, -15, -10", depth: 60, seeds: [UP], effect: "glass", palette: "moss" },
  { name: "Rosette", rules: "-45, -10", depth: 80, seeds: [UP], palette: "ember" },
  { name: "Whirlpool", rules: "-18, -6", depth: 70, seeds: [UP], effect: "contours", palette: "ocean" },
  {
    name: "Two whirlpools",
    rules: "-18, -6",
    depth: 70,
    color: "seed",
    effect: "glass",
    seeds: [
      { x: -14, y: 0, heading: 90, speed: 1 },
      { x: 14, y: 0, heading: -90, speed: 1 },
    ],
  },
  { name: "Square rose", rules: "90, 67.5, 45", depth: 30, seeds: [UP], effect: "glass", palette: "ocean" },
  { name: "Decagons", rules: "36, -36, 108, -108", depth: 60, seeds: [UP], effect: "skeleton", palette: "moss" },
  { name: "Sierpiński", rules: "120, 0, -120", depth: 64, seeds: [UP], effect: "glass", palette: "ember" },
  { name: "Seed head", rules: "5, -175", depth: 80, seeds: [UP], palette: "candy" },
  {
    name: "Stairs",
    rules: "# A tightens as it goes, and B steps out square.\nA: 15 A*0.98, -45 B\nB: 90 A",
    depth: 60,
    seeds: [UP],
    effect: "contours",
    palette: "aurora",
  },
  // In motion: the rules or the sliders move with time t, and the tree is
  // grown afresh every frame.
  {
    name: "Breathing",
    rules: "A: (45 + 20*sin(t)) A, -(45 + 20*sin(t)) A",
    depth: 40,
    seeds: [UP],
    grown: true,
  },
  {
    name: "Wind",
    rules: "A: 30 A, -30 A",
    depth: 40,
    seeds: [UP],
    swing: ["twist"],
    effect: "contours",
    palette: "ocean",
    grown: true,
  },
  {
    name: "Unfolding",
    rules: "A: 45 A, -45 A",
    depth: 36,
    seeds: [UP],
    swing: ["spread"],
    effect: "glass",
    palette: "candy",
    grown: true,
  },
  {
    name: "Tide",
    rules: "A: (25 + 50*pulse(t/2)) A*0.95, -40 B\nB: 0 A",
    depth: 34,
    seeds: [UP],
    effect: "skeleton",
    palette: "ember",
    grown: true,
  },
  {
    name: "Dance",
    rules: "A: (60 + 30*tri(t)) A, -(60 + 30*tri(t*1.3)) A",
    depth: 30,
    color: "seed",
    effect: "glass",
    seeds: [
      { x: -8, y: 0, heading: 0, speed: 1 },
      { x: 8, y: 0, heading: 180, speed: 1 },
    ],
    grown: true,
  },
  {
    name: "Coiling",
    rules: "A: -(20 + 12*sin(t)) A, -10 A",
    depth: 60,
    seeds: [UP],
    effect: "contours",
    palette: "ember",
    grown: true,
  },
];
