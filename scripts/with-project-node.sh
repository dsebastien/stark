#!/usr/bin/env bash
set -euo pipefail

usage() {
	printf 'Usage: %s [--repo /path/to/repository] [--node-version X.Y.Z] -- command [args...]\n' "$0" >&2
}

fail() {
	printf 'with-project-node: %s\n' "$1" >&2
	exit 1
}

canonical_command() {
	local name="$1"
	local executable
	executable="$(command -v "$name")" || return 1
	[[ "$executable" == */* ]] || return 1
	realpath "$executable"
}

native_path() {
	if command -v cygpath >/dev/null 2>&1; then
		cygpath -w "$1"
	else
		printf '%s\n' "$1"
	fi
}

paths_equal() {
	local left="$1"
	local right="$2"
	local platform="${MSYSTEM:-} ${OSTYPE:-}"
	case "$platform" in
		*MINGW*|*MSYS*|*CYGWIN*|*msys*|*cygwin*)
			left="${left,,}"
			right="${right,,}"
			;;
	esac
	[[ "$left" == "$right" ]]
}

version_at_least() {
	local actual_major actual_minor actual_patch minimum_major minimum_minor minimum_patch
	IFS=. read -r actual_major actual_minor actual_patch <<< "$1"
	IFS=. read -r minimum_major minimum_minor minimum_patch <<< "$2"
	if (( 10#$actual_major != 10#$minimum_major )); then
		(( 10#$actual_major > 10#$minimum_major ))
		return
	fi
	if (( 10#$actual_minor != 10#$minimum_minor )); then
		(( 10#$actual_minor > 10#$minimum_minor ))
		return
	fi
	(( 10#$actual_patch >= 10#$minimum_patch ))
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

[[ -n "${FNM_MULTISHELL_PATH:-}" ]] || fail "fnm env did not provide FNM_MULTISHELL_PATH"
fnm_selected_path="$FNM_MULTISHELL_PATH"
if command -v cygpath >/dev/null 2>&1; then
	fnm_selected_path="$(cygpath -u "$fnm_selected_path")"
fi
fnm_installation="$(realpath "$fnm_selected_path")" || fail "could not resolve the fnm-selected installation"

node_executable="$(canonical_command node)" || fail "node is required in the fnm-selected installation"
node_parent="${node_executable%/*}"
paths_equal "$node_parent" "$fnm_installation" || fail "node is not from the fnm-selected installation"
if ! actual="$("$node_executable" --version)"; then
	fail "node --version failed"
fi
actual="${actual%$'\r'}"
[[ "$actual" =~ ^v[0-9]+\.[0-9]+\.[0-9]+([+-][0-9A-Za-z.-]+)?$ ]] || fail "invalid Node version: $actual"
node_version="${actual#v}"

if ! current="$(fnm current)"; then
	fail "fnm current failed"
fi
current="${current%$'\r'}"
[[ "$current" =~ ^v?[0-9]+\.[0-9]+\.[0-9]+([+-][0-9A-Za-z.-]+)?$ ]] || fail "invalid fnm current version: $current"
current_version="${current#v}"
[[ "$current_version" == "$node_version" ]] || fail "fnm current reported $current, but node --version reported $actual"

expected_version="${expected#v}"
[[ "$expected_version" =~ ^[0-9]+(\.[0-9]+){0,2}$ ]] || fail "invalid Node version requirement: $expected"
[[ "$node_version" == "$expected_version" || "$node_version" == "$expected_version."* ]] || fail "expected Node v$expected_version, got $actual"

npm_executable="$(canonical_command npm)" || fail "npm is required in the fnm-selected installation"
npm_parent="${npm_executable%/*}"
paths_equal "$npm_parent" "$fnm_installation" && paths_equal "$npm_parent" "$node_parent" || fail "npm is not from the fnm-selected Node installation"
if ! npm_version="$("$npm_executable" --version)"; then
	fail "npm --version failed"
fi
npm_version="${npm_version%$'\r'}"
npm_version_pattern='^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$'
[[ "$npm_version" =~ $npm_version_pattern ]] || fail "invalid npm version: $npm_version"

if ! npm_requirement="$("$node_executable" -e '
	const fs = require("node:fs");
	const manifest = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
	const requirement = manifest.engines?.npm;
	if (requirement === undefined) process.exit(0);
	if (typeof requirement !== "string") process.exit(2);
	process.stdout.write(requirement);
' "$repo_dir/package.json")"; then
	fail "could not read package.json engines.npm"
fi
if [[ -n "$npm_requirement" ]]; then
	npm_minimum_pattern='^>=(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$'
	[[ "$npm_requirement" =~ $npm_minimum_pattern ]] || fail "unsupported package.json engines.npm range: $npm_requirement"
	minimum_npm_version="${BASH_REMATCH[1]}.${BASH_REMATCH[2]}.${BASH_REMATCH[3]}"
	version_at_least "$npm_version" "$minimum_npm_version" || fail "npm $npm_version does not satisfy package.json engines.npm $npm_requirement"
fi

STARK_PROJECT_NODE_EXECUTABLE="$(native_path "$node_executable")"
STARK_PROJECT_NODE_VERSION="$node_version"
STARK_PROJECT_NPM_EXECUTABLE="$(native_path "$npm_executable")"
STARK_PROJECT_NPM_VERSION="$npm_version"
export STARK_PROJECT_NODE_EXECUTABLE STARK_PROJECT_NODE_VERSION STARK_PROJECT_NPM_EXECUTABLE STARK_PROJECT_NPM_VERSION

exec "$@"
