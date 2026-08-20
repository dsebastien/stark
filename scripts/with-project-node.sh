#!/usr/bin/env bash
set -euo pipefail

usage() {
	printf 'Usage: %s [--repo /path/to/repository] -- command [args...]\n' "$0" >&2
}

repo_dir="$PWD"
if [[ "${1:-}" == "--repo" ]]; then
	[[ $# -ge 3 ]] || { usage; exit 2; }
	repo_dir="$2"
	shift 2
fi
[[ "${1:-}" == "--" ]] || { usage; exit 2; }
shift
[[ $# -gt 0 ]] || { usage; exit 2; }

repo_dir="$(cd "$repo_dir" && pwd -P)"
[[ -f "$repo_dir/.nvmrc" ]] || { printf 'with-project-node: missing .nvmrc in %s\n' "$repo_dir" >&2; exit 1; }
command -v fnm >/dev/null 2>&1 || { printf 'with-project-node: fnm is required\n' >&2; exit 1; }

cd "$repo_dir"
eval "$(fnm env --shell bash)"
fnm use --install-if-missing >/dev/null

expected="$(tr -d '\r\n[:space:]' < .nvmrc)"
actual="$(node --version)"
[[ "$actual" == "v$expected" ]] || {
	printf 'with-project-node: expected Node v%s, got %s\n' "$expected" "$actual" >&2
	exit 1
}

exec "$@"
