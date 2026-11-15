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
document.querySelectorAll('a[href^="javascript:"][href*="divJumper.js"]').forEach((a) =>
  a.addEventListener("click", (e) => {
    e.preventDefault();
    if (document.ranDivJumper) return; // already playing
    const s = document.createElement("script");
    s.id = "divJumper";
    s.src = "/site/div-jumper/divJumper.js";
    document.body.append(s);
  }),
);

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
