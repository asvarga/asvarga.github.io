"""Keep old `.html` page URLs working after switching to directory URLs.

The site used to be built with `use_directory_urls: false` (forced by the
Material `offline` plugin), so pages lived at e.g. `wiki/Trace.html`. With
directory URLs the same page is `wiki/Trace/`. After the build, this hook
writes a small redirect page at each page's old `.html` path, unless a real
file already lives there, so existing links and bookmarks keep working.
"""

import html
import os

_urls: list[str] = []


def on_pre_build(config):
    _urls.clear()


def on_post_page(output, page, config):
    _urls.append(page.url)
    return output


def on_post_build(config):
    site_dir = config["site_dir"]
    for url in _urls:
        # Only directory-style URLs ("foo/bar/") had an old "foo/bar.html" form.
        # The home page ("") and pages built from foo/index.md keep the same
        # foo/index.html file they always had, so they need nothing.
        if not url.endswith("/"):
            continue
        old_path = os.path.join(site_dir, url.rstrip("/") + ".html")
        if os.path.exists(old_path):
            continue
        target = html.escape("/" + url, quote=True)
        os.makedirs(os.path.dirname(old_path), exist_ok=True)
        with open(old_path, "w", encoding="utf-8") as f:
            f.write(
                "<!doctype html>\n"
                '<html lang="en"><head><meta charset="utf-8">\n'
                f"<title>Redirecting…</title>\n"
                f'<link rel="canonical" href="{target}">\n'
                f'<meta http-equiv="refresh" content="0; url={target}">\n'
                f'<script>location.replace("{target}" + location.hash)</script>\n'
                "</head><body>\n"
                f'<p>This page has moved to <a href="{target}">{target}</a>.</p>\n'
                "</body></html>\n"
            )
