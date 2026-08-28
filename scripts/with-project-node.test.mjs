import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const launcherPath = path.join(scriptDirectory, "with-project-node.sh");
const bashExecutable = findBash();
const hostTools = new Map(["realpath", "tr", ...(process.platform === "win32" ? ["cygpath"] : [])].map((name) => [name, findHostTool(name)]));

function findBash() {
	const shell = process.env.SHELL;
	assert.ok(shell, "SHELL must identify the approved Bash executable");
	if (process.platform === "win32") {
		assert.match(shell, /[\\/]Git[\\/]usr[\\/]bin[\\/]bash\.exe$/iu, `SHELL is not the approved Git Bash executable: ${shell}`);
	}
	const result = spawnSync(shell, ["--noprofile", "--norc", "--version"], { encoding: "utf8" });
	assert.equal(result.status, 0, `unable to execute the approved Bash: ${result.stderr}`);
	assert.match(result.stdout, /GNU bash/u);
	return shell;
}

function findHostTool(name) {
	const result = spawnSync(bashExecutable, ["--noprofile", "--norc", "-c", 'command -v "$1"', "find-host-tool", name], { encoding: "utf8" });
	assert.equal(result.status, 0, `unable to locate approved host tool ${name}: ${result.stderr}`);
	const executable = result.stdout.trim();
	assert.ok(executable, `approved host tool ${name} resolved to an empty path`);
	return executable;
}

function bashPath(value) {
	if (process.platform !== "win32") return value;
	return value.replace(/^([A-Za-z]):[\\/]/u, (_, drive) => `/${drive.toLowerCase()}/`).replaceAll("\\", "/");
}

function writeExecutable(filePath, contents) {
	fs.writeFileSync(filePath, `#!/usr/bin/bash\nset -eu\n${contents}`, "utf8");
	fs.chmodSync(filePath, 0o755);
}

function shellQuote(value) {
	return `'${value.replaceAll("'", `'"'"'`)}'`;
}

function createFixture({
	nvmrc = "22.22.3",
	nodeVersion = "v22.22.3",
	currentVersion = nodeVersion,
	npmVersion = "10.9.8",
	npmExit = 0,
	includeNpm = true,
	ambientNpm = false,
	ephemeralMultishell = false,
	npmEngine = ">=10.9.4",
	npmInDescendantDirectory = false,
	mixedCaseReportedInstallation = false
} = {}) {
	const root = fs.mkdtempSync(path.join(os.tmpdir(), "stark-project-node-"));
	const repository = path.join(root, "repository");
	const controlBin = path.join(root, "control-bin");
	const installation = path.join(root, "fnm", "node-versions", nodeVersion.replace(/^v/u, "v"), "installation");
	const ambientBin = path.join(root, "ambient-bin");
	const captureOutput = path.join(root, "capture.bin");
	const fnmLog = path.join(root, "fnm.log");
	for (const directory of [repository, controlBin, installation, ambientBin]) fs.mkdirSync(directory, { recursive: true });
	if (nvmrc !== null) fs.writeFileSync(path.join(repository, ".nvmrc"), `${nvmrc}\n`, "utf8");
	const manifest = { name: "launcher-fixture", private: true };
	if (npmEngine !== null) manifest.engines = { npm: npmEngine };
	fs.writeFileSync(path.join(repository, "package.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

	writeExecutable(path.join(installation, "node"), `
if [[ "\${1:-}" == "--version" ]]; then
	printf '%s\\n' "\${FAKE_NODE_VERSION}"
	exit "\${FAKE_NODE_EXIT:-0}"
fi
exec "\${HOST_NODE_EXECUTABLE}" "$@"
`);
	const npmDirectory = npmInDescendantDirectory ? path.join(installation, "bin") : installation;
	fs.mkdirSync(npmDirectory, { recursive: true });
	if (includeNpm) {
		writeExecutable(path.join(npmDirectory, "npm"), `
if [[ "\${1:-}" == "--version" ]]; then
	printf '%s\\n' "\${FAKE_NPM_VERSION}"
	exit "\${FAKE_NPM_EXIT:-0}"
fi
printf 'unexpected fake npm invocation\\n' >&2
exit 71
`);
	}
	if (ambientNpm) {
		writeExecutable(path.join(ambientBin, "npm"), `
if [[ "\${1:-}" == "--version" ]]; then printf '99.0.0\\n'; exit 0; fi
exit 72
`);
	}

	let selectedBin = installation;
	if (ephemeralMultishell) {
		selectedBin = path.join(root, "fnm-multishell", "selected");
		fs.mkdirSync(path.dirname(selectedBin), { recursive: true });
		fs.symlinkSync(installation, selectedBin, process.platform === "win32" ? "junction" : "dir");
	}
	const selectedPath = [bashPath(selectedBin), ...(npmInDescendantDirectory ? [bashPath(npmDirectory)] : [])].join(":");
	const reportedInstallation = mixedCaseReportedInstallation
		? bashPath(selectedBin).replace(/^\/[a-z]\//u, (prefix) => prefix.toLowerCase()).replace(/(?<=^\/[a-z]\/).*/u, (rest) => rest.toUpperCase())
		: bashPath(selectedBin);

	writeExecutable(path.join(controlBin, "fnm"), `
printf '%s\\0' "$@" >> "\${FAKE_FNM_LOG}"
case "\${1:-}" in
	env)
		printf 'export FNM_MULTISHELL_PATH=%q\\n' "\${FAKE_FNM_REPORTED_BIN}"
		printf 'export PATH=%q:$PATH\\n' "\${FAKE_FNM_SELECTED_PATH}"
		;;
	use)
		exit 0
		;;
	current)
		printf '%s\\n' "\${FAKE_FNM_CURRENT_VERSION}"
		exit "\${FAKE_FNM_CURRENT_EXIT:-0}"
		;;
	*)
		printf 'unexpected fake fnm invocation: %s\\n' "\${1:-}" >&2
		exit 73
		;;
esac
`);
	for (const [name, executable] of hostTools) {
		writeExecutable(path.join(controlBin, name), `exec ${shellQuote(executable)} "$@"\n`);
	}
	const captureCommand = path.join(root, "capture-command");
	writeExecutable(captureCommand, `
{
	printf '%s\\0' \
		"\${STARK_PROJECT_NODE_EXECUTABLE:-}" \
		"\${STARK_PROJECT_NODE_VERSION:-}" \
		"\${STARK_PROJECT_NPM_EXECUTABLE:-}" \
		"\${STARK_PROJECT_NPM_VERSION:-}"
	for argument in "$@"; do printf '%s\\0' "$argument"; done
} > "\${CAPTURE_OUTPUT}"
printf 'child stdout\\n'
exit "\${CAPTURE_EXIT:-0}"
`);

	const minimalPath = [bashPath(controlBin), ...(ambientNpm ? [bashPath(ambientBin)] : [])].join(":");
	const environment = {
		...process.env,
		PATH: minimalPath,
		FAKE_FNM_SELECTED_PATH: selectedPath,
		FAKE_FNM_REPORTED_BIN: reportedInstallation,
		FAKE_FNM_CURRENT_VERSION: currentVersion,
		FAKE_FNM_CURRENT_EXIT: "0",
		FAKE_FNM_LOG: bashPath(fnmLog),
		FAKE_NODE_VERSION: nodeVersion,
		FAKE_NODE_EXIT: "0",
		HOST_NODE_EXECUTABLE: bashPath(process.execPath),
		FAKE_NPM_VERSION: npmVersion,
		FAKE_NPM_EXIT: String(npmExit),
		CAPTURE_OUTPUT: bashPath(captureOutput),
		CAPTURE_EXIT: "0"
	};

	return {
		root,
		repository,
		installation,
		captureOutput,
		captureCommand,
		fnmLog,
		environment,
		cleanup() {
			fs.rmSync(root, { recursive: true, force: true });
		}
	};
}

function runLauncher(fixture, launcherArguments = [], commandArguments = [fixture.captureCommand]) {
	return spawnSync(
		bashExecutable,
		[launcherPath, "--repo", fixture.repository, ...launcherArguments, "--", ...commandArguments],
		{ encoding: "utf8", env: fixture.environment }
	);
}

function readCapture(fixture) {
	const fields = fs.readFileSync(fixture.captureOutput).toString("utf8").split("\0");
	assert.equal(fields.pop(), "");
	return fields;
}

function assertSamePath(actual, expected) {
	const normalize = (value) => process.platform === "win32" ? path.normalize(value).toLowerCase() : value;
	assert.equal(normalize(actual), normalize(expected));
}

test("exports canonical node and compatible npm provenance from an ephemeral fnm multishell without changing stdout", (context) => {
	const fixture = createFixture({ ephemeralMultishell: true });
	context.after(() => fixture.cleanup());

	const result = runLauncher(fixture);

	assert.equal(result.status, 0, result.stderr);
	assert.equal(result.stdout, "child stdout\n");
	const [nodeExecutable, nodeVersion, npmExecutable, npmVersion] = readCapture(fixture);
	assertSamePath(nodeExecutable, fs.realpathSync(path.join(fixture.installation, "node")));
	assert.equal(nodeVersion, "22.22.3");
	assertSamePath(npmExecutable, fs.realpathSync(path.join(fixture.installation, "npm")));
	assert.equal(npmVersion, "10.9.8");
});

test("preserves command arguments including spaces, empty values, and a double dash", (context) => {
	const fixture = createFixture();
	context.after(() => fixture.cleanup());
	const forwarded = ["plain", "two words", "", "--", "after"];

	const result = runLauncher(fixture, [], [fixture.captureCommand, ...forwarded]);

	assert.equal(result.status, 0, result.stderr);
	assert.deepEqual(readCapture(fixture).slice(4), forwarded);
});

test("returns the child command exit status", (context) => {
	const fixture = createFixture();
	context.after(() => fixture.cleanup());
	fixture.environment.CAPTURE_EXIT = "37";

	const result = runLauncher(fixture);

	assert.equal(result.status, 37);
});

test("rejects a missing npm before running the child command", (context) => {
	const fixture = createFixture({ includeNpm: false });
	context.after(() => fixture.cleanup());

	const result = runLauncher(fixture);

	assert.equal(result.status, 1);
	assert.match(result.stderr, /npm is required in the fnm-selected installation/u);
	assert.equal(fs.existsSync(fixture.captureOutput), false);
});

test("rejects ambient npm outside the fnm-selected installation", (context) => {
	const fixture = createFixture({ includeNpm: false, ambientNpm: true });
	context.after(() => fixture.cleanup());

	const result = runLauncher(fixture);

	assert.equal(result.status, 1);
	assert.match(result.stderr, /npm is not from the fnm-selected Node installation/u);
	assert.equal(fs.existsSync(fixture.captureOutput), false);
});

test("rejects npm whose canonical parent is below the fnm installation", (context) => {
	const fixture = createFixture({ npmInDescendantDirectory: true });
	context.after(() => fixture.cleanup());

	const result = runLauncher(fixture);

	assert.equal(result.status, 1);
	assert.match(result.stderr, /npm is not from the fnm-selected Node installation/u);
	assert.equal(fs.existsSync(fixture.captureOutput), false);
});

test("rejects npm --version failures before running the child command", (context) => {
	const fixture = createFixture({ npmExit: 19 });
	context.after(() => fixture.cleanup());

	const result = runLauncher(fixture);

	assert.equal(result.status, 1);
	assert.match(result.stderr, /npm --version failed/u);
	assert.equal(fs.existsSync(fixture.captureOutput), false);
});

test("rejects malformed npm versions before running the child command", (context) => {
	const fixture = createFixture({ npmVersion: "latest" });
	context.after(() => fixture.cleanup());

	const result = runLauncher(fixture);

	assert.equal(result.status, 1);
	assert.match(result.stderr, /invalid npm version: latest/u);
	assert.equal(fs.existsSync(fixture.captureOutput), false);
});

test("does not normalize whitespace inside a malformed npm version", (context) => {
	const fixture = createFixture({ npmVersion: "10. 9.8" });
	context.after(() => fixture.cleanup());

	const result = runLauncher(fixture);

	assert.equal(result.status, 1);
	assert.match(result.stderr, /invalid npm version: 10\. 9\.8/u);
	assert.equal(fs.existsSync(fixture.captureOutput), false);
});

test("rejects a valid selected npm version below package.json engines.npm", (context) => {
	const fixture = createFixture({ npmEngine: ">=10.9.9" });
	context.after(() => fixture.cleanup());

	const result = runLauncher(fixture);

	assert.equal(result.status, 1);
	assert.match(result.stderr, /npm 10\.9\.8 does not satisfy package\.json engines\.npm >=10\.9\.9/u);
	assert.equal(fs.existsSync(fixture.captureOutput), false);
});

test("rejects unsupported nonempty package.json engines.npm ranges", (context) => {
	const fixture = createFixture({ npmEngine: "^10.9.4" });
	context.after(() => fixture.cleanup());

	const result = runLauncher(fixture);

	assert.equal(result.status, 1);
	assert.match(result.stderr, /unsupported package\.json engines\.npm range: \^10\.9\.4/u);
	assert.equal(fs.existsSync(fixture.captureOutput), false);
});

test("allows repositories that omit package.json engines.npm", (context) => {
	const fixture = createFixture({ npmEngine: null });
	context.after(() => fixture.cleanup());

	const result = runLauncher(fixture);

	assert.equal(result.status, 0, result.stderr);
});

test("requires fnm current and node --version to identify the same selected version", (context) => {
	const fixture = createFixture({ currentVersion: "v22.22.2" });
	context.after(() => fixture.cleanup());

	const result = runLauncher(fixture);

	assert.equal(result.status, 1);
	assert.match(result.stderr, /fnm current reported v22\.22\.2, but node --version reported v22\.22\.3/u);
	assert.equal(fs.existsSync(fixture.captureOutput), false);
});

test("supports a partial .nvmrc when fnm resolves it to a matching full version", (context) => {
	const fixture = createFixture({ nvmrc: "22.22", nodeVersion: "v22.22.9" });
	context.after(() => fixture.cleanup());

	const result = runLauncher(fixture);

	assert.equal(result.status, 0, result.stderr);
	assert.equal(readCapture(fixture)[1], "22.22.9");
});

test("case-folds installation comparisons under Git Bash while preserving executable path case", { skip: process.platform !== "win32" }, (context) => {
	const fixture = createFixture({ mixedCaseReportedInstallation: true });
	context.after(() => fixture.cleanup());

	const result = runLauncher(fixture);

	assert.equal(result.status, 0, result.stderr);
	const [nodeExecutable, , npmExecutable] = readCapture(fixture);
	assertSamePath(nodeExecutable, fs.realpathSync(path.join(fixture.installation, "node")));
	assertSamePath(npmExecutable, fs.realpathSync(path.join(fixture.installation, "npm")));
});

test("uses an exact fallback when the repository has no .nvmrc", (context) => {
	const fixture = createFixture({ nvmrc: null, nodeVersion: "v20.11.1" });
	context.after(() => fixture.cleanup());

	const result = runLauncher(fixture, ["--node-version", "20.11.1"]);

	assert.equal(result.status, 0, result.stderr);
	assert.equal(readCapture(fixture)[1], "20.11.1");
	const fnmCalls = fs.readFileSync(fixture.fnmLog).toString("utf8").split("\0").filter(Boolean);
	assert.deepEqual(fnmCalls.slice(3, 6), ["use", "--install-if-missing", "20.11.1"]);
});
