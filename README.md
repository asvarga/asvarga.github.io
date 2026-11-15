# asvarga.com

View here: https://asvarga.com

The site is plain HTML, CSS and a little JS in `docs/`. There is no build step
and no framework: what's committed is what's served.

- Preview: `main` (serves `docs/` at http://127.0.0.1:8000)
- Publish: automatic on every push to `main` (the Publish workflow pushes
  `docs/` plus the latest SatSight demo to the `gh-pages` branch). `deploy`
  re-runs it on demand, e.g. to pick up a newer SatSight build.

## Layout

| Path | What |
| --- | --- |
| `docs/index.html` | Home page |
| `docs/blog/` | Blog index; posts live at `blog/YYYY/MM/DD/<slug>/index.html` |
| `docs/site/` | Projects page and each project's own folder |
| `docs/wiki/` | Notes |
| `docs/assets/style.css` | The one stylesheet (colour and font tokens, light and dark) |
| `docs/assets/site.js` | Theme toggle, heading anchors, blog tag filter |
| `docs/files/` | Images and other files linked from posts |
| `docs/404.html` | Not-found page; also forwards old MkDocs URLs |

## Writing a post

1. Copy an existing post's folder to `docs/blog/YYYY/MM/DD/<slug>/` and edit
   the title, `<meta>` description, date, tags and the `.prose` body.
2. Add it to the top of `docs/blog/index.html` (under its year) and to the
   "Recent writing" list on `docs/index.html` (keep five).
3. Give its blog-index entry a thumbnail: a ~640px-wide 3:2 image in
   `docs/files/thumbs/<slug>.jpg`.
4. Point the neighbouring posts' Older/Newer links at it.

Links that leave the site get `target="_blank" rel="noopener"`.

Div Jumper (the footer's 🐸) stands on divs up to 800px wide, images, buttons
and the footer. Add a `data-platform` attribute to make anything else a
platform, as the project cards do.

Fonts come from Google Fonts via the `<link>` in each page's `<head>`:
Bricolage Grotesque for the big headings (`--display`), Geist for text
(`--sans`) and Geist Mono for dates, tags and code (`--mono`).

Posts that use math load KaTeX in their `<head>` (see
`blog/2026/05/02/function-with-4-fold-symmetry/`) and write `\( … \)` or
`\[ … \]`. Tags link to `/blog/#tag=<tag>`, which the blog index filters on.
