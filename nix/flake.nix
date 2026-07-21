{
  description = "asvarga.github.io — an MkDocs (Material) static site.";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixpkgs-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs =
    {
      self,
      nixpkgs,
      flake-utils,
    }:
    flake-utils.lib.eachDefaultSystem (
      system:
      let
        pkgs = nixpkgs.legacyPackages.${system};

        # Native libraries mkdocs-material's "social"/imaging cards link against
        # at runtime (via cairosvg/Pillow). These mirror the apt packages the
        # deploy workflow installs (libcairo2/freetype/ffi/jpeg/png/z); nix
        # provides them here so `mkdocs serve` renders social cards locally.
        imagingLibs = with pkgs; [
          cairo
          pango
          freetype
          libffi
          libjpeg
          libpng
          zlib
        ];
      in
      {
        # A dev shell for the MkDocs site. `.envrc` loads it via direnv.
        # nix provides the Python interpreter + the native imaging libraries;
        # the actual mkdocs packages are pinned by requirements.txt and
        # installed into a local venv by `bin/main` (which then runs the site).
        # The repo's `bin/` is put on PATH by `.envrc` (PATH_add bin).
        devShells.default = pkgs.mkShellNoCC {
          packages = [
            # Interpreter only; mkdocs + plugins come from requirements.txt via
            # pip, matching the `pip install -r requirements.txt` deploy step.
            pkgs.python3
          ] ++ imagingLibs;

          # Help the pip-installed wheels (cairosvg/cairocffi) dlopen the
          # nix-provided native libs above.
          #
          # Linux: LD_LIBRARY_PATH is inherited normally, so set it directly.
          LD_LIBRARY_PATH = pkgs.lib.makeLibraryPath imagingLibs;
          # macOS: DYLD_FALLBACK_LIBRARY_PATH works for a Python exec'd straight
          # from this shell, but SIP strips every DYLD_* var the moment a process
          # execs a system binary — and bin/main's `#!/usr/bin/env bash` shebang
          # goes through the SIP-protected /usr/bin/env, wiping it before mkdocs
          # starts. So also stash the path under a name SIP leaves alone;
          # bin/main promotes it back to DYLD_FALLBACK_LIBRARY_PATH just before
          # exec'ing mkdocs (whose next exec is the nix python, which keeps it).
          DYLD_FALLBACK_LIBRARY_PATH = pkgs.lib.makeLibraryPath imagingLibs;
          MKDOCS_IMAGING_LIB_PATH = pkgs.lib.makeLibraryPath imagingLibs;
        };
      }
    );
}
