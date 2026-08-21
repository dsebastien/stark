#!/usr/bin/env bash
set -euo pipefail

usage() {
	printf 'Usage: %s [--repo /path/to/repository] [--node-version X.Y.Z] -- command [args...]\n' "$0" >&2
}

repo_dir="$PWD"
explicit_node_version=""
if [[ "${1:-}" == "--repo" ]]; then
	[[ $# -ge 3 ]] || { usage; exit 2; }
	repo_dir="$2"
	shift 2
fi
if [[ "${1:-}" == "--node-version" ]]; then
	[[ $# -ge 3 ]] || { usage; exit 2; }
	explicit_node_version="$2"
	shift 2
fi
[[ "${1:-}" == "--" ]] || { usage; exit 2; }
shift
[[ $# -gt 0 ]] || { usage; exit 2; }

repo_dir="$(cd "$repo_dir" && pwd -P)"
if [[ -f "$repo_dir/.nvmrc" ]]; then
	[[ -z "$explicit_node_version" ]] || { printf 'with-project-node: --node-version cannot be used when .nvmrc exists\n' >&2; exit 2; }
	expected="$(tr -d '\r\n[:space:]' < "$repo_dir/.nvmrc")"
else
	[[ "$explicit_node_version" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || { printf 'with-project-node: missing .nvmrc and no exact fallback was provided\n' >&2; exit 1; }
	expected="$explicit_node_version"
fi
command -v fnm >/dev/null 2>&1 || { printf 'with-project-node: fnm is required\n' >&2; exit 1; }

cd "$repo_dir"
eval "$(fnm env --shell bash)"
if [[ -n "$explicit_node_version" ]]; then
	fnm use --install-if-missing "$explicit_node_version" >/dev/null
else
	fnm use --install-if-missing >/dev/null
fi

actual="$(node --version)"
[[ "$actual" == "v$expected" || ( "$expected" =~ ^[0-9]+(\.[0-9]+)?$ && "$actual" == "v$expected."* ) ]] || {
	printf 'with-project-node: expected Node v%s, got %s\n' "$expected" "$actual" >&2
	exit 1
}

exec "$@"
