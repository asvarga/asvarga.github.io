// asvarga.com — the little bit of behaviour the plain HTML pages share.
// Every page works without it; it only adds niceties.

// Light/dark toggle. The system preference is the default; a click pins the
// other one (remembered per browser), and a click back to the system's choice
// un-pins it. The <head> of each page applies a pinned theme before paint.
(() => {
  const btn = document.querySelector(".theme-toggle");
  if (!btn) return;
  const root = document.documentElement;
  const media = matchMedia("(prefers-color-scheme: dark)");
  const current = () => root.dataset.theme || (media.matches ? "dark" : "light");
  btn.addEventListener("click", () => {
    const next = current() === "dark" ? "light" : "dark";
    const system = media.matches ? "dark" : "light";
    try {
      if (next === system) localStorage.removeItem("theme");
      else localStorage.setItem("theme", next);
    } catch {}
    if (next === system) delete root.dataset.theme;
    else root.dataset.theme = next;
  });
})();

// Div Jumper links (the footer's 🐧 and the button on its page) are bookmarklets
// that load the game from asvarga.com, so they work when dragged to the
// bookmarks bar on any site. Clicked here, load this site's own copy instead,
// so a local preview (or a fresh deploy) plays the version it's serving.
// The publish step versions site.js (?v=<commit>); pass that on to the game.
const assetVersion = document.currentScript ? new URL(document.currentScript.src).search : "";
document.querySelectorAll('a[href^="javascript:"][href*="divJumper.js"]').forEach((a) =>
  a.addEventListener("click", (e) => {
    e.preventDefault();
    // A second click takes the frog back off the page.
    if (document.divJumper) return document.divJumper.stop();
    const s = document.createElement("script");
    s.id = "divJumper";
    s.src = "/div-jumper/divJumper.js" + assetVersion;
    document.body.append(s);
  }),
);

// Lightbox: images inside any element with a data-lightbox attribute open large
// in a popup, with previous/next through that element's images. An image can
// name a bigger file to show with data-full; otherwise its own src is used.
(() => {
  const groups = document.querySelectorAll("[data-lightbox]");
  if (!groups.length) return;
  const dlg = document.createElement("dialog");
  dlg.className = "lightbox";
  dlg.setAttribute("aria-label", "Image viewer");
  dlg.innerHTML =
    '<img alt="">' +
    '<button type="button" class="lb-btn lb-close" aria-label="Close">&times;</button>' +
    '<button type="button" class="lb-btn lb-prev" aria-label="Previous image">&lsaquo;</button>' +
    '<button type="button" class="lb-btn lb-next" aria-label="Next image">&rsaquo;</button>' +
    '<p class="lb-count" aria-live="polite"></p>';
  document.body.append(dlg);
  const big = dlg.querySelector("img");
  const count = dlg.querySelector(".lb-count");
  let list = [];
  let at = 0;
  const show = (n) => {
    at = (n + list.length) % list.length;
    const img = list[at];
    big.src = img.dataset.full || img.currentSrc || img.src;
    big.alt = img.alt;
    count.textContent = list.length > 1 ? `${at + 1} / ${list.length}` : "";
    dlg.classList.toggle("single", list.length < 2);
  };
  groups.forEach((group) => {
    const imgs = [...group.querySelectorAll("img")];
    imgs.forEach((img, n) => {
      img.classList.add("zoomable");
      img.tabIndex = 0;
      img.setAttribute("role", "button");
      img.setAttribute("aria-label", (img.alt ? img.alt + ": " : "") + "view larger");
      const open = () => {
        // Page only through images the reader can see: nothing from a
        // collapsed <details> (e.g. a puzzle's hidden solution).
        list = imgs.filter((i) => i === img || !i.closest("details:not([open])"));
        show(list.indexOf(img));
        dlg.showModal();
      };
      img.addEventListener("click", open);
      img.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          open();
        }
      });
    });
  });
  dlg.querySelector(".lb-prev").addEventListener("click", () => show(at - 1));
  dlg.querySelector(".lb-next").addEventListener("click", () => show(at + 1));
  dlg.querySelector(".lb-close").addEventListener("click", () => dlg.close());
  // A click on the dark backdrop (not the image or a button) closes it.
  dlg.addEventListener("click", (e) => {
    if (e.target === dlg) dlg.close();
  });
  dlg.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft") show(at - 1);
    else if (e.key === "ArrowRight") show(at + 1);
  });
  // Don't hold on to a large image after closing.
  dlg.addEventListener("close", () => big.removeAttribute("src"));
})();

// Footer ⓘ: when and from which commit the site was published. The Publish
// workflow writes /build.json; it's fetched the first time the icon is hovered,
// focused or tapped, and the icon then links to that commit.
(() => {
  const icon = document.querySelector(".build-info");
  if (!icon) return;
  const tip = icon.querySelector(".build-tip");
  let loaded = false;
  const load = async () => {
    if (loaded) return;
    loaded = true;
    try {
      const r = await fetch("/build.json", { cache: "no-cache" });
      if (!r.ok) throw new Error(r.status);
      const { commit, time } = await r.json();
      const when = new Date(time).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
      tip.textContent = `Published ${when} · ${commit.slice(0, 7)}`;
      icon.href = `https://github.com/asvarga/asvarga.github.io/commit/${commit}`;
      icon.setAttribute("aria-label", tip.textContent);
    } catch {
      tip.textContent = "Local preview (not published)";
    }
  };
  ["pointerenter", "focus", "touchstart"].forEach((ev) => icon.addEventListener(ev, load, { passive: true }));
})();

// Hover anchors on headings in long-form text, so sections can be linked to.
document.querySelectorAll(".prose :is(h2, h3, h4)[id]").forEach((h) => {
  const a = document.createElement("a");
  a.className = "anchor";
  a.href = "#" + h.id;
  a.setAttribute("aria-label", "Link to this section");
  a.textContent = "#";
  h.append(a);
});

// Blog index: filter posts by tag. The choice lives in the URL (#tag=ordinal),
// so filtered views can be shared, and old /blog/category/<tag>/ links land here.
(() => {
  const filter = document.querySelector(".filter");
  if (!filter) return;
  const buttons = [...filter.querySelectorAll("button.tag")];
  const posts = [...document.querySelectorAll(".blog-list [data-tags]")];
  const years = [...document.querySelectorAll(".blog-list [data-year]")];
  const apply = () => {
    const m = location.hash.match(/^#tag=([\w-]+)$/);
    const tag = m ? m[1].toLowerCase() : "";
    buttons.forEach((b) => b.setAttribute("aria-pressed", String((b.dataset.tag || "") === tag)));
    posts.forEach((p) => (p.hidden = !!tag && !p.dataset.tags.split(" ").includes(tag)));
    years.forEach((y) => (y.hidden = !y.querySelector("[data-tags]:not([hidden])")));
  };
  buttons.forEach((b) =>
    b.addEventListener("click", () => {
      const tag = b.dataset.tag;
      history.replaceState(null, "", tag ? "#tag=" + tag : location.pathname);
      apply();
    }),
  );
  addEventListener("hashchange", apply);
  apply();
})();

// Project cards: a masonry layout. Each card spans as many 4px grid rows as its
// height plus the column gap, and re-spans whenever its height changes (images
// loading, text wrapping at a new width). Without this, they're an even grid.
(() => {
  const grid = document.querySelector(".project-grid");
  if (!grid || !("ResizeObserver" in window)) return;
  const ROW = 4;
  grid.classList.add("masonry");
  const span = (card) => {
    const gap = parseFloat(getComputedStyle(grid).columnGap) || 0;
    card.style.gridRowEnd = "span " + Math.ceil((card.getBoundingClientRect().height + gap) / ROW);
  };
  const seen = new ResizeObserver((entries) => entries.forEach((e) => span(e.target)));
  [...grid.children].forEach((card) => {
    span(card);
    seen.observe(card);
  });
})();
