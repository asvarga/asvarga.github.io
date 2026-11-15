{
  description = "asvarga.github.io — a plain HTML static site.";

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
      in
      {
        # Dev shell loaded by `.envrc` via direnv, which also puts the repo's
        # `bin/` on PATH. There is no build step: the site is docs/ as committed.
        devShells.default = pkgs.mkShellNoCC {
          packages = [
            # `main` previews docs/ with python's built-in http.server.
            pkgs.python3
            # `deploy` starts the Publish workflow.
            pkgs.gh
            # Manages asvarga.com DNS in Route 53 (custom domain for GitHub Pages).
            pkgs.awscli2
          ];
        };
      }
    );
}
