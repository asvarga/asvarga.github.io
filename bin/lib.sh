#!/usr/bin/env bash
#
# bin/lib.sh — shared bootstrap for the repo's ProperDocs scripts.
#
# Sourced (not executed) by bin/main and bin/deploy. It resolves the repo root,
# ensures a local .venv with the pinned packages from requirements.txt, and
# promotes the nix imaging-lib path so social-card rendering works. On return,
# the cwd is the repo root and "$venv" points at the virtualenv, so the caller
# can just `exec "$venv/bin/properdocs" <command> …`.
#
# The site is built with ProperDocs (github.com/ProperDocs/properdocs), the
# maintained continuation of MkDocs 1.x. It reads properdocs.yml and remains
# compatible with the mkdocs-material theme and the mkdocs-* plugins pinned in
# requirements.txt (which still bring in mkdocs itself as a dependency).
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
root="$(cd "$here/.." && pwd)"
cd "$root"

venv="$root/.venv"
stamp="$venv/.requirements.sha"
req="$root/requirements.txt"

# Recreate the venv on request, or if it is missing/incomplete.
if [ "${REBUILD:-}" = "1" ] || [ ! -x "$venv/bin/properdocs" ]; then
  [ "${REBUILD:-}" = "1" ] && rm -rf "$venv"
  echo "bin: creating virtualenv at .venv …" >&2
  python3 -m venv "$venv"
fi

# (Re)install deps when requirements.txt changes (tracked by a checksum stamp),
# so a fresh pull with new plugins doesn't silently run against stale packages.
want="$(shasum "$req" | awk '{print $1}')"
if [ ! -f "$stamp" ] || [ "$(cat "$stamp")" != "$want" ]; then
  echo "bin: installing dependencies from requirements.txt …" >&2
  "$venv/bin/pip" install --quiet --upgrade pip
  "$venv/bin/pip" install --quiet -r "$req"
  echo "$want" > "$stamp"
fi

# macOS SIP strips DYLD_* env vars across the `#!/usr/bin/env bash` shebangs of
# the calling scripts, so the nix dev shell hands us the native imaging-lib path
# under a non-DYLD name (see nix/flake.nix). Promote it back here, just before
# the caller's exec: the next exec target is the nix python, which preserves it,
# so cairosvg (the mkdocs-material social-card plugin) can dlopen libcairo.
# No-op off the nix shell / on Linux, where LD_LIBRARY_PATH already handles this.
if [ -n "${MKDOCS_IMAGING_LIB_PATH:-}" ]; then
  export DYLD_FALLBACK_LIBRARY_PATH="${MKDOCS_IMAGING_LIB_PATH}${DYLD_FALLBACK_LIBRARY_PATH:+:${DYLD_FALLBACK_LIBRARY_PATH}}"
fi
