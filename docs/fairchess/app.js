// Fair Chess's page: the board, requests, the reveal, who plays whom, and the
// post's figures. simultaneous.js merges requests for any game; rules.js is
// chess; ai.js is Phibber; figures.js has the post's examples.

import { $, blurButtons, onKey, progress, say, setSound, sound, SOUNDS, tellTown, tone } from "./art/arcade.js";
import { choose } from "./ai.js";
import { FIGURES, load } from "./figures.js";
import { CHESS, CHESS_WITH_CHECK, Game, explain, moves, named, pieceMoves, san } from "./rules.js";
import { orderings, resolve } from "./simultaneous.js";

const GLYPH = { K: "♚", Q: "♛", R: "♜", B: "♝", N: "♞", P: "♟" };
const SIDE = { w: "White", b: "Black" };
const record = await progress("fairchess");

const ui = {
  game: null,
  mode: null, // "easy" | "normal" | "two" | "figures"
  me: "w", // whose request is being chosen now
  flip: false,
  selected: null, // the square of the piece whose move is being chosen
  request: null, // my chosen move
  promo: "Q",
  requests: { w: null, b: null },
  locked: { w: false, b: false },
  phibber: null, // Phibber's request, chosen when the round starts
  thinking: false,
  busy: false, // revealing or resolving
  cursor: 12,
  shown: null, // the last round, drawn faintly
  els: new Map(), // square -> the piece drawn there
  arrows: [], // { m, cls, mark }
  // The figures: which, its position and requests (one per piece), and whether
  // it's been resolved.
  fig: 0,
  figState: null,
  figRequests: [],
  check: false,
  resolved: false,
};

// ---- the board ----

function xy(sq) {
  const f = sq % 8;
  const r = Math.floor(sq / 8);
  return ui.flip ? [7 - f, r] : [f, 7 - r];
}

function buildSquares() {
  const squares = [];
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const sq = ui.flip ? row * 8 + (7 - col) : (7 - row) * 8 + col;
      const el = document.createElement("div");
      el.className = `sq${((sq % 8) + Math.floor(sq / 8)) % 2 === 0 ? " dark" : ""}`;
      el.dataset.sq = sq;
      el.setAttribute("role", "gridcell");
      if (col === 0) el.insertAdjacentHTML("beforeend", `<span class="coord rank">${Math.floor(sq / 8) + 1}</span>`);
      if (row === 7) el.insertAdjacentHTML("beforeend", `<span class="coord file">${named(sq)[0]}</span>`);
      el.addEventListener("click", () => tap(sq));
      squares.push(el);
    }
  }
  $("squares").replaceChildren(...squares);
}

function place(el, sq) {
  const [x, y] = xy(sq);
  el.style.left = `${x * 12.5}%`;
  el.style.top = `${y * 12.5}%`;
}

function drawPieces(state) {
  ui.els = new Map();
  const els = [];
  state.board.forEach((p, sq) => {
    if (!p) return;
    const el = document.createElement("div");
    el.className = `piece ${p[0]}`;
    el.textContent = `${GLYPH[p[1]]}︎`;
    place(el, sq);
    ui.els.set(sq, el);
    els.push(el);
  });
  $("pieces").replaceChildren(...els);
  for (const el of $("squares").children) {
    const p = state.board[Number(el.dataset.sq)];
    el.setAttribute("aria-label", `${named(Number(el.dataset.sq))}${p ? `, ${SIDE[p[0]].toLowerCase()} ${p[1]}` : ""}`);
  }
}

// The position being looked at: the game's, or the figure's.
const position = () => (ui.mode === "figures" ? ui.figState : ui.game.state);
const figureGame = () => (ui.check ? CHESS_WITH_CHECK : CHESS);

// The moves the selected piece may be given.
function targets() {
  if (ui.selected === null) return [];
  if (ui.mode === "figures") return pieceMoves(ui.figState, ui.selected).filter((m) => figureGame().legal(ui.figState, m));
  return moves(ui.game.state, ui.me).filter((m) => m.from === ui.selected);
}

// Marks: the selected piece, where it may go, the keyboard cursor.
function drawMarks() {
  const list = targets();
  for (const el of $("squares").children) {
    const sq = Number(el.dataset.sq);
    el.classList.toggle("from", sq === ui.selected);
    const t = list.find((m) => m.to === sq);
    el.classList.toggle("target", !!t);
    el.classList.toggle("take", !!t?.capture);
    el.classList.toggle("cursor", sq === ui.cursor && keyboard);
  }
}

function arrowSvg({ m, cls, mark }) {
  const [x1, y1] = xy(m.from);
  const [x2, y2] = xy(m.to);
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  const end = (len - 0.32) / len;
  const head = cls.includes("stop") ? "stop" : cls.includes("held") ? "held" : m.color;
  let svg = `<line class="${m.color} ${cls}" x1="${x1 + 0.5}" y1="${y1 + 0.5}" x2="${x1 + 0.5 + dx * end}" y2="${y1 + 0.5 + dy * end}" marker-end="url(#head-${head})" />`;
  // The mark sits near the head, so a short arrow's marks don't cover each other.
  const k = len > 1.5 ? 0.62 : 0.5;
  if (mark) svg += `<text class="${cls}" x="${x1 + 0.5 + dx * k}" y="${y1 + 0.5 + dy * k}">${mark}</text>`;
  return svg;
}

function drawArrows(list = ui.arrows) {
  ui.arrows = list;
  $("lines").innerHTML = list.map(arrowSvg).join("");
}

// How a request ended, as an arrow.
const FATE = {
  made: { cls: "made", mark: "" },
  blocked: { cls: "stop", mark: "✕" },
  held: { cls: "held", mark: "=" },
};

// The board as it stands, with my request or the figure's, or the last round faintly.
function draw() {
  drawPieces(position());
  drawMarks();
  if (ui.mode === "figures") drawArrows(ui.figRequests.map((m) => ({ m, cls: "" })));
  else if (ui.request) drawArrows([{ m: ui.request, cls: "" }]);
  else if (ui.shown) {
    const r = ui.shown;
    drawArrows([r.white, r.black].flatMap((m, i) => (m ? [{ m, cls: `${FATE[r.result[i]].cls} old`, mark: FATE[r.result[i]].mark }] : [])));
  } else drawArrows([]);
  hud();
}

// ---- resolving, step by step ----

const wait = (ms) => new Promise((done) => setTimeout(done, ms));
const label = (m) => `${SIDE[m.color]} ${san(m)}`;
const list = (players, requests) => players.map((i) => label(requests[i])).join(", ");

function slide(m) {
  if (m.capture) {
    const taken = ui.els.get(m.to);
    if (taken) {
      taken.classList.add("gone");
      setTimeout(() => taken.remove(), 450);
    }
  }
  const el = ui.els.get(m.from);
  if (!el) return;
  ui.els.delete(m.from);
  ui.els.set(m.to, el);
  place(el, m.to);
  if (m.promo) setTimeout(() => (el.textContent = `${GLYPH[m.promo]}︎`), 300);
  if (m.castle) {
    const home = m.color === "w" ? 0 : 56;
    const [rf, rt] = m.castle === "K" ? [7, 5] : [0, 3];
    const rook = ui.els.get(home + rf);
    if (rook) {
      ui.els.delete(home + rf);
      ui.els.set(home + rt, rook);
      place(rook, home + rt);
    }
  }
}

function trace(title, text = "") {
  $("trace-title").textContent = title;
  $("trace-text").textContent = text;
  $("trace-steps").replaceChildren();
  $("trace").hidden = false;
}

const traceShown = () => getComputedStyle($("trace")).display !== "none";

function traceLine(html, cls = "") {
  const li = document.createElement("li");
  li.className = cls;
  li.innerHTML = html;
  $("trace-steps").append(li);
  li.scrollIntoView({ block: "nearest" });
}

// Plays a resolution on the board: every request's arrow, then each pass of
// the loop in turn (what's blocked shakes, what's made slides), then what's
// held. `beat` is the pause between steps.
async function animate(game, before, requests, { result, steps }, beat) {
  drawPieces(before);
  const arrows = requests.map((m) => (m ? { m, cls: "" } : null));
  const redraw = () => drawArrows(arrows.filter(Boolean));
  redraw();
  const players = requests.flatMap((m, i) => (m ? [i] : []));
  traceLine(`<b>Requests</b>: ${list(players, requests)}.`);
  if (players.length >= 2 && players.length <= 3) {
    // Few enough to list every ordering, and what each could make.
    const rows = orderings(game, before, requests, players).map(
      ({ order, legal }) => order.map((i, k) => `${san(requests[i])} ${legal[k] ? "✓" : "✗"}`).join(" → "),
    );
    traceLine(`<b>Every ordering</b>:<br>${rows.join("<br>")}`, "orders");
  }
  await wait(beat);
  for (const [k, step] of steps.entries()) {
    if (step.held) {
      for (const i of step.held) Object.assign(arrows[i], FATE.held);
      redraw();
      for (const i of step.held) ui.els.get(requests[i].from)?.classList.add("shake");
      traceLine(`<b>Held</b>: ${list(step.held, requests)}. Each is stopped in some ordering, and nothing more can be decided.`, "held");
      say(`Held: ${list(step.held, requests)}. Each stops another, so none is made.`);
      tone(150, 0.2, "sawtooth", 0, 110);
      await wait(beat);
      break;
    }
    const parts = [];
    if (step.blocked.length) {
      for (const i of step.blocked) {
        Object.assign(arrows[i], FATE.blocked);
        ui.els.get(requests[i].from)?.classList.add("shake");
      }
      parts.push(`blocked ${list(step.blocked, requests)}, no longer legal`);
      tone(150, 0.2, "sawtooth", 0, 110);
    }
    const waiting = Object.entries(step.stoppedBy).map(([i, by]) => [Number(i), by]);
    if (step.made.length) {
      for (const i of step.made) {
        Object.assign(arrows[i], FATE.made);
        slide(requests[i]);
      }
      parts.push(`made ${list(step.made, requests)}, legal in every ordering`);
      tone(requests[step.made[0]].capture ? 220 : 330, 0.14, "triangle", 0, 480);
    }
    redraw();
    let html = `<b>Step ${k + 1}</b>: ${parts.join("; ")}.`;
    if (step.made.length && waiting.length > 3) {
      html += ` Not yet: ${waiting.length} others, each stopped in some ordering.`;
    } else if (step.made.length && waiting.length) {
      html += ` Not yet: ${waiting.map(([i, by]) => `${san(requests[i])} (stopped if ${by.map((j) => san(requests[j])).join(", ")} goes first)`).join("; ")}.`;
    }
    traceLine(html, step.made.length ? "made" : "blocked");
    say(`Step ${k + 1}: ${parts.join("; ")}.`);
    await wait(beat);
  }
  // Clear the shakes, so they play again next time.
  for (const el of ui.els.values()) el.classList.remove("shake");
  const made = result.filter((r) => r === "made").length;
  traceLine(`<b>Done</b>: ${made} of ${players.length} made.`, "done");
}

// ---- requests ----

let keyboard = false;

function tap(sq) {
  if (ui.mode === "figures") return tapFigure(sq);
  if (!canPick()) return;
  const state = ui.game.state;
  const mine = moves(state, ui.me);
  const p = state.board[sq];
  if (ui.selected !== null) {
    const options = mine.filter((m) => m.from === ui.selected && m.to === sq);
    if (options.length) {
      ui.request = options.find((m) => (m.promo ?? "Q") === ui.promo) ?? options[0];
      ui.selected = null;
      tone(520, 0.06);
      draw();
      return;
    }
  }
  if (p?.[0] === ui.me && mine.some((m) => m.from === sq)) {
    ui.selected = ui.selected === sq ? null : sq;
  } else ui.selected = null;
  draw();
}

// In the figures every piece is a player: give any piece a request, or tap it
// twice to take its request back.
function tapFigure(sq) {
  if (ui.busy) return;
  if (ui.resolved) resetFigure();
  const choice = targets().find((m) => m.to === sq && (m.promo ?? "Q") === "Q");
  if (choice) {
    ui.figRequests = [...ui.figRequests.filter((m) => m.from !== ui.selected), choice];
    ui.selected = null;
    tone(520, 0.06);
  } else if (sq === ui.selected) {
    ui.figRequests = ui.figRequests.filter((m) => m.from !== sq);
    ui.selected = null;
  } else ui.selected = ui.figState.board[sq] ? sq : null;
  draw();
}

function canPick() {
  return ui.game && ui.mode !== "figures" && !ui.game.over && !ui.busy && !ui.locked[ui.me] && overlaysShut();
}

const overlaysShut = () => ["levels", "handoff", "help", "figures", "won"].every((id) => $(id).hidden);

function setPromo(piece) {
  ui.promo = piece;
  for (const b of $("promote").querySelectorAll("button")) b.setAttribute("aria-pressed", b.dataset.promo === piece);
  if (ui.request?.promo) {
    ui.request = moves(ui.game.state, ui.me).find((m) => m.from === ui.request.from && m.to === ui.request.to && m.promo === piece);
    draw();
  }
}

function hud() {
  const figures = ui.mode === "figures";
  for (const el of document.querySelectorAll(".play")) el.hidden = figures;
  for (const el of document.querySelectorAll(".fig")) el.hidden = !figures;
  if (figures) {
    $("stats").textContent = `Fig. ${FIGURES[ui.fig].fig} · ${ui.figRequests.length} request${ui.figRequests.length === 1 ? "" : "s"}`;
    $("check").setAttribute("aria-pressed", ui.check);
    $("resolve").disabled = ui.busy || !ui.figRequests.length;
    $("reset").disabled = ui.busy;
    $("prev").disabled = ui.busy || ui.fig === 0;
    $("next-fig").disabled = ui.busy || ui.fig === FIGURES.length - 1;
    $("promote").hidden = true;
    $("pass").hidden = true;
    return;
  }
  const g = ui.game;
  const pick = canPick();
  const none = pick && !moves(g.state, ui.me).length;
  $("lock").disabled = !pick || !ui.request;
  $("pass").hidden = !none;
  $("promote").hidden = !ui.request?.promo;
  let status = `Round ${g.rounds.length + 1}`;
  if (ui.mode !== "two") {
    status += ui.thinking ? " · Phibber is thinking…" : " · Phibber has chosen";
  } else if (!g.over) {
    status += ` · ${SIDE[ui.me]} to choose`;
  }
  $("stats").textContent = g.over ? `${g.rounds.length} rounds` : status;
}

async function lock(request) {
  if (!canPick()) return;
  if (ui.mode !== "two" && ui.thinking) {
    ui.busy = true;
    while (ui.thinking) await wait(20);
    ui.busy = false;
  }
  ui.requests[ui.me] = request;
  ui.locked[ui.me] = true;
  ui.selected = null;
  tone(400, 0.08, "square");
  if (ui.mode === "two") {
    if (ui.me === "w") {
      ui.request = null;
      handoff("Black's turn", "White has chosen. Pass the device to Black, and no peeking.", () => {
        ui.me = "b";
        ui.flip = true;
        buildSquares();
        draw();
        say("Black: choose your move. White's is locked in.");
      });
      ui.flip = false;
      draw();
    } else {
      ui.request = null;
      ui.flip = false;
      buildSquares();
      draw();
      handoff("Both have chosen", "Pass the device back, or gather round: the moves are revealed together.", reveal);
    }
    return;
  }
  ui.requests[other()] = ui.phibber;
  reveal();
}

const other = () => (ui.me === "w" ? "b" : "w");

function handoff(title, text, then) {
  $("handoff-title").textContent = title;
  $("handoff-text").textContent = text;
  $("handoff").hidden = false;
  // Hide the board while the device changes hands.
  $("board").style.visibility = "hidden";
  handoffThen = () => {
    $("handoff").hidden = true;
    $("board").style.visibility = "";
    then();
  };
}
let handoffThen = null;

// ---- the round ----

async function reveal() {
  ui.busy = true;
  ui.request = null;
  hud();
  const g = ui.game;
  const { w, b } = ui.requests;
  const before = g.state;
  const round = g.play(w, b);
  trace(`Round ${g.rounds.length}`);
  await animate(CHESS, before, [w, b], round, 800);
  say(explain(round));
  tellTown(`Fair Chess, round ${g.rounds.length}: ${explain(round)}`);
  ui.shown = round;
  ui.busy = false;
  if (g.over) return finish();
  nextRound();
}

function nextRound() {
  ui.requests = { w: null, b: null };
  ui.locked = { w: false, b: false };
  ui.selected = null;
  ui.request = null;
  if (ui.mode === "two") {
    ui.me = "w";
    ui.flip = false;
    buildSquares();
    draw();
    // Both just watched the reveal; Black looks away while White chooses.
    if (ui.shown) say(`${explain(ui.shown)} White chooses next; Black, look away.`);
    else say("White: choose your move, while Black looks away. Then Black chooses, without seeing it.");
    return;
  }
  draw();
  // Phibber chooses first, from the board alone, so it can't see yours.
  ui.phibber = null;
  ui.thinking = true;
  hud();
  setTimeout(() => {
    ui.phibber = choose(ui.game.state, other(), ui.mode);
    ui.thinking = false;
    hud();
  }, 30);
}

function finish() {
  const { winner, why } = ui.game.over;
  let title;
  if (ui.mode === "two") title = winner ? `${SIDE[winner]} wins!` : "A draw";
  else {
    title = winner === ui.me ? "You win!" : winner ? "Phibber wins" : "A draw";
    const tally = (record.data[ui.mode] ??= { won: 0, lost: 0, drawn: 0 });
    tally[winner === ui.me ? "won" : winner ? "lost" : "drawn"]++;
    record.save();
    marks();
  }
  if (winner === ui.me || (ui.mode === "two" && winner)) SOUNDS.won();
  $("over-title").textContent = title;
  $("score").textContent = `${why}, after ${ui.game.rounds.length} rounds.`;
  $("won").hidden = false;
  say(why);
  hud();
}

function newGame(mode) {
  ui.mode = mode;
  ui.game = new Game();
  ui.me = "w";
  ui.flip = false;
  ui.shown = null;
  ui.busy = false;
  $("levels").hidden = true;
  $("won").hidden = true;
  $("resume").hidden = false;
  $("trace").hidden = true;
  $("title").textContent = mode === "two" ? "Fair Chess · two players" : `Fair Chess · vs Phibber${mode === "easy" ? ", easy" : ""}`;
  buildSquares();
  nextRound();
  if (mode !== "two") say("You're White. Choose a move: Phibber is choosing too, and neither sees the other's.");
}

// ---- the figures ----

function showFigure(i) {
  const f = FIGURES[i];
  ui.mode = "figures";
  ui.fig = i;
  ui.check = f.check ?? false;
  ui.flip = false;
  ui.busy = false;
  ui.selected = null;
  ({ state: ui.figState, requests: ui.figRequests } = load(f, ui.check));
  ui.resolved = false;
  for (const id of ["levels", "figures", "won"]) $(id).hidden = true;
  $("resume").hidden = true;
  $("title").textContent = `Fair Chess · Fig. ${f.fig}: ${f.name}`;
  buildSquares();
  trace(`Fig. ${f.fig}: ${f.name}`, f.text);
  // The trace beside the board has the figure's story, where there's room for it.
  say(traceShown() ? "Click a piece, then a square, to change its request. Resolve when ready." : f.text);
  draw();
}

// Back to the figure's position, keeping its requests as they are now.
function resetFigure() {
  const f = FIGURES[ui.fig];
  const kept = ui.figRequests;
  ui.figState = load(f, ui.check).state;
  ui.figRequests = kept;
  ui.resolved = false;
  trace(`Fig. ${f.fig}: ${f.name}`, f.text);
}

async function resolveFigure() {
  if (ui.busy || !ui.figRequests.length) return;
  if (ui.resolved) resetFigure();
  ui.selected = null;
  ui.busy = true;
  drawMarks();
  hud();
  const game = figureGame();
  const before = ui.figState;
  const requests = ui.figRequests;
  const res = resolve(game, before, requests);
  await animate(game, before, requests, res, 1000);
  ui.figState = res.state;
  ui.resolved = true;
  ui.busy = false;
  hud();
}

function figureList() {
  $("figlist").replaceChildren(
    ...FIGURES.map((f, i) => {
      const li = document.createElement("li");
      const b = document.createElement("button");
      b.innerHTML = `<span>Fig. ${f.fig}. ${f.name}</span><small>${f.requests.length} request${f.requests.length === 1 ? "" : "s"}${f.check ? ", with check" : ""}</small>`;
      b.addEventListener("click", () => showFigure(i));
      li.append(b);
      return li;
    }),
  );
}

function marks() {
  for (const mode of ["easy", "normal"]) {
    const t = record.data[mode];
    $(`mark-${mode}`).textContent = t ? `${t.won} won · ${t.lost} lost · ${t.drawn} drawn` : "not played yet";
  }
}

// ---- controls ----

for (const b of document.querySelectorAll("[data-mode]")) b.addEventListener("click", () => newGame(b.dataset.mode));
for (const b of $("promote").querySelectorAll("button")) b.addEventListener("click", () => setPromo(b.dataset.promo));
$("open-figures").addEventListener("click", () => {
  $("levels").hidden = true;
  $("figures").hidden = false;
});
$("figures-back").addEventListener("click", () => {
  $("figures").hidden = true;
  $("levels").hidden = false;
});
$("menu").addEventListener("click", () => ($("levels").hidden = false));
$("resume").addEventListener("click", () => ($("levels").hidden = true));
$("lock").addEventListener("click", () => ui.request && lock(ui.request));
$("pass").addEventListener("click", () => lock(null));
$("rules").addEventListener("click", () => ($("help").hidden = false));
$("help-close").addEventListener("click", () => ($("help").hidden = true));
$("sound").addEventListener("click", () => setSound(!sound.on));
$("handoff-go").addEventListener("click", () => handoffThen?.());
$("again").addEventListener("click", () => {
  $("won").hidden = true;
  $("levels").hidden = false;
});
$("next").addEventListener("click", () => newGame(ui.mode));
$("look").addEventListener("click", () => ($("won").hidden = true));
$("resolve").addEventListener("click", resolveFigure);
$("reset").addEventListener("click", () => {
  if (ui.busy) return;
  resetFigure();
  draw();
});
$("prev").addEventListener("click", () => !ui.busy && ui.fig > 0 && showFigure(ui.fig - 1));
$("next-fig").addEventListener("click", () => !ui.busy && ui.fig < FIGURES.length - 1 && showFigure(ui.fig + 1));
$("check").addEventListener("click", () => {
  if (ui.busy) return;
  ui.check = !ui.check;
  resetFigure();
  // Requests the new rules don't allow are dropped.
  ui.figRequests = ui.figRequests.filter((m) => figureGame().legal(ui.figState, m));
  draw();
});
blurButtons();

const STEP = { ArrowUp: [0, 1], ArrowDown: [0, -1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };
onKey((key, event) => {
  const figures = ui.mode === "figures";
  if (key === "Escape") {
    for (const id of ["help", "won", "figures"]) if (!$(id).hidden) return ($(id).hidden = true);
    if (ui.game || figures) $("levels").hidden = !$("levels").hidden;
    return;
  }
  if (key === "n") return setSound(!sound.on);
  if (key === "?") return ($("help").hidden = !$("help").hidden);
  if (!overlaysShut() && key === "Enter") {
    if (!$("handoff").hidden) return handoffThen?.();
    if (!$("won").hidden) return newGame(ui.mode);
    return;
  }
  if (!overlaysShut()) return;
  if (figures) {
    if (key === "Enter") return resolveFigure();
    if (key === "r") return $("reset").click();
    if (key === "c") return $("check").click();
    if (key === ",") return $("prev").click();
    if (key === ".") return $("next-fig").click();
  } else if (key === "Enter") {
    if (ui.request) lock(ui.request);
    return;
  }
  const picking = figures ? !ui.busy : canPick();
  if (STEP[key] && picking) {
    event.preventDefault();
    keyboard = true;
    let [df, dr] = STEP[key];
    if (ui.flip) [df, dr] = [-df, -dr];
    const f = Math.min(7, Math.max(0, (ui.cursor % 8) + df));
    const r = Math.min(7, Math.max(0, Math.floor(ui.cursor / 8) + dr));
    ui.cursor = r * 8 + f;
    drawMarks();
    return;
  }
  if (key === " " && picking) {
    event.preventDefault();
    keyboard = true;
    tap(ui.cursor);
  }
});
window.addEventListener("pointerdown", () => {
  if (keyboard) {
    keyboard = false;
    if (ui.game || ui.mode === "figures") drawMarks();
  }
});

marks();
figureList();
newGame("normal");
$("levels").hidden = false;
$("resume").hidden = true;
