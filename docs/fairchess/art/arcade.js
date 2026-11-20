// What every pond arcade game does around its own rules: the HUD's message,
// sound, saved progress and wins, the level menu and won card, keys, swipes.
// lilyhop and frogofwar import it as ./art/arcade.js (their static/art
// link), with recipes/arcade.css, and keep only what's theirs.

export const $ = (id) => document.getElementById(id);

export function say(text) {
  $("message").textContent = text;
}

// Arrows move, in every game.
export const ARROWS = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
};

// A short synth note, unless sound is off: from `freq` sliding to `slide`.
let audio = null;
export const sound = { on: true };
export function tone(freq, seconds, type = "triangle", delay = 0, slide = freq) {
  if (!sound.on) return;
  audio ??= new AudioContext();
  const now = audio.currentTime + delay;
  const osc = audio.createOscillator();
  const gain = audio.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, now);
  osc.frequency.exponentialRampToValueAtTime(slide, now + seconds);
  gain.gain.setValueAtTime(0.09, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + seconds);
  osc.connect(gain).connect(audio.destination);
  osc.start(now);
  osc.stop(now + seconds);
}

// The sounds every game makes the same way; each adds its own.
export const SOUNDS = {
  hop: () => tone(330, 0.1, "triangle", 0, 620),
  fly: () => {
    tone(880, 0.08);
    tone(1320, 0.1, "triangle", 0.07);
  },
  won: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.2, "triangle", i * 0.1)),
};

// The sound button, and the key that toggles it.
export function setSound(on) {
  sound.on = on;
  $("sound").setAttribute("aria-pressed", on);
}

// A world's progress ({level index: {stars, ...}}), kept in the player's life with
// every world's save, and in this browser alone when there's no town. save()
// writes whatever data holds then, so a game may change it or replace it.
const phibber = null; // no town on asvarga.com: progress stays in this browser
export async function progress(world) {
  const key = `${world}.progress`;
  return {
    data: (await phibber?.load(world, key)) ?? local(key),
    save() {
      if (phibber) return phibber.store(world, key, this.data);
      try {
        localStorage.setItem(key, JSON.stringify(this.data));
      } catch {
        // Private windows can refuse storage; progress just lasts this visit.
      }
    },
  };
}

function local(key) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? {};
  } catch {
    return {};
  }
}

// Phibber: Worlds keeps one record of wins, at the town. Without one, nothing happens.
export const report = (world, score) => phibber?.won(world, score).catch(() => {});

// Framed in Pond Town, the game tells the town what's on screen, so Coach on
// Phibber's phone can help with it.
export function tellTown(text) {
  if (window.parent !== window) window.parent.postMessage({ type: "town-game", text }, location.origin);
}

export const stars = (n) => `${"★".repeat(n)}${"☆".repeat(3 - n)}`;

// The level menu (#levels, #grid) and the won card (#won, #stars, #score,
// #next), and the buttons that open them (#menu, #again, #next). `mark(i)` is
// what a level's button shows under its name; `current()` is the level being played.
export class Menu {
  constructor({ levels, progress, load, current, mark }) {
    Object.assign(this, { levels, progress, load, current, mark });
    $("menu").addEventListener("click", () => this.show());
    $("again").addEventListener("click", () => load(current()));
    $("next").addEventListener("click", () => load(current() + 1));
  }

  isOpen(id) {
    return !$(id).hidden;
  }

  get paused() {
    return this.isOpen("levels") || this.isOpen("won");
  }

  show() {
    $("grid").replaceChildren(
      ...this.levels.map((def, i) => {
        const item = document.createElement("li");
        const button = document.createElement("button");
        const name = document.createElement("span");
        const mark = document.createElement("small");
        name.textContent = `${i + 1}. ${def.name}`;
        mark.textContent = this.mark(i);
        button.append(name, mark);
        button.addEventListener("click", () => this.load(i));
        item.append(button);
        return item;
      }),
    );
    $("won").hidden = true;
    $("levels").hidden = false;
  }

  hide() {
    $("levels").hidden = true;
    $("won").hidden = true;
  }

  // The won card, with its stars line and score.
  won(starsText, score) {
    $("stars").textContent = starsText;
    $("score").textContent = score;
    $("next").hidden = this.current() + 1 >= this.levels.length;
    $("won").hidden = false;
    say("");
  }

  // Escape opens or closes the menu; Enter on the won card goes on. True if handled.
  key(key) {
    if (key === "Escape") {
      if (this.isOpen("levels")) $("levels").hidden = true;
      else this.show();
      return true;
    }
    if (key === "Enter" && this.isOpen("won")) {
      if ($("next").hidden) this.show();
      else this.load(this.current() + 1);
      return true;
    }
    return false;
  }

  // Open behind the menu, on the first level without three stars.
  start() {
    this.load(
      Math.max(
        this.levels.findIndex((_, i) => (this.progress[i]?.stars ?? 0) < 3),
        0,
      ),
    );
    this.show();
  }
}

// Keys without a modifier, letters lowercased.
export function onKey(handle) {
  window.addEventListener("keydown", (event) => {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    handle(event.key.length === 1 ? event.key.toLowerCase() : event.key, event);
  });
}

// A swipe on `el` moves the way it went; a press that doesn't travel is a tap.
// The right button is left alone, for whatever the game does with it.
export function onSwipe(el, move, tap = () => {}) {
  let from = null;
  el.addEventListener("pointerdown", (e) => (from = [e.clientX, e.clientY]));
  el.addEventListener("pointerup", (e) => {
    if (!from) return;
    const dx = e.clientX - from[0];
    const dy = e.clientY - from[1];
    from = null;
    if (e.button === 2) return;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return tap(e);
    if (Math.abs(dx) > Math.abs(dy)) move(dx > 0 ? "right" : "left");
    else move(dy > 0 ? "down" : "up");
  });
}

// Clicked buttons keep focus, and Space or Enter would press them again.
export function blurButtons() {
  document.querySelectorAll("button").forEach((button) => {
    button.addEventListener("click", () => button.blur());
  });
}
