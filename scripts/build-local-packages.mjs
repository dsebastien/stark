import { spawnSync } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { defaultWorkspaceRoot, validateMap } from "./validate-local-dependency-map.mjs";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, "..");
const defaultMapPath = path.join(scriptDirectory, "local-dependency-map.json");
const launcherPath = path.join(scriptDirectory, "with-project-node.sh");
const stateDirectoryName = "local-package-state";
const stateSchemaVersion = 2;
const lockSchemaVersion = 1;
const completionMarkerName = "complete.marker.json";
const treeManifestName = "tree.manifest.json";
const descriptorName = "descriptor.json";
const resultName = "result.json";
const generatedFiles = new Set(["artifacts", "checksums.sha256", "checksums.sha512", "provenance.json"]);
const windowsRenameCodes = new Set(["EBUSY", "EPERM"]);
const waitSignal = new Int32Array(new SharedArrayBuffer(4));
const secondaryFailures = new WeakMap();
const renameAttempts = new WeakMap();
let captureSequence = 0;

export class PipelineError extends Error {
	constructor(message, phase = "pipeline", details = {}) {
		super(message);
		this.name = "PipelineError";
		this.phase = phase;
		Object.assign(this, details);
	}
}

function fail(message, phase = "validation", details = {}) {
	throw new PipelineError(message, phase, details);
}

function asError(error, phase = "pipeline") {
	return error instanceof Error ? error : new PipelineError(String(error), phase);
}

function attachSecondaryFailure(primary, context, error) {
	const primaryError = asError(primary);
	const list = secondaryFailures.get(primaryError) ?? [];
	list.push({ context, error: asError(error) });
	secondaryFailures.set(primaryError, list);
	return primaryError;
}

function getSecondaryFailures(error) {
	return error && typeof error === "object" ? secondaryFailures.get(error) ?? [] : [];
}

function formatError(error) {
	const message = error instanceof Error ? error.message : String(error);
	const attempts = error && typeof error === "object" ? renameAttempts.get(error) : undefined;
	return attempts && attempts > 1 ? `${message} (after ${attempts} attempts)` : message;
}

export function formatPipelineError(error) {
	const lines = [formatError(error)];
	const append = (current, indent = "") => {
		for (const secondary of getSecondaryFailures(current)) {
			lines.push(`${indent}Secondary failure (${secondary.context}): ${formatError(secondary.error)}`);
			append(secondary.error, `${indent}  `);
		}
	};
	append(error);
	return lines.join("\n");
}

function hashBuffer(value, algorithm = "sha256", encoding = "hex") {
	return createHash(algorithm).update(value).digest(encoding);
}

function hashFile(filePath, algorithm = "sha256", encoding = "hex") {
	return hashBuffer(fs.readFileSync(filePath), algorithm, encoding);
}

function stableJson(value) {
	return `${JSON.stringify(value, null, 2)}\n`;
}

function writeAtomic(filePath, contents, options = {}) {
	const parent = path.dirname(filePath);
	const beforeMutation = options.beforeMutation;
	beforeMutation?.();
	fs.mkdirSync(parent, { recursive: true });
	const suffix = `${process.pid}-${randomToken(8)}`;
	const temporaryPath = path.join(parent, `.${path.basename(filePath)}.${suffix}.incomplete`);
	try {
		beforeMutation?.();
		fs.writeFileSync(temporaryPath, contents, { encoding: "utf8", flag: "wx" });
		if (options.mode !== undefined) {
			beforeMutation?.();
			fs.chmodSync(temporaryPath, options.mode);
		}
		beforeMutation?.();
		fs.renameSync(temporaryPath, filePath);
	} catch (error) {
		try {
			if (fs.existsSync(temporaryPath)) fs.unlinkSync(temporaryPath);
		} catch (cleanupError) {
			attachSecondaryFailure(error, `remove temporary file ${temporaryPath}`, cleanupError);
		}
		throw error;
	}
}

function randomToken(bytes = 16) {
	return randomBytes(bytes).toString("hex");
}

function normalizedSegments(value) {
	return value.replaceAll("\\", "/").split("/");
}

const reservedWindowsNames = /^(?:con|prn|aux|nul|clock\$|com[1-9]|lpt[1-9])(?:\..*)?$/iu;

function invalidPathReason(value, allowDot = false) {
	if (typeof value !== "string" || value.length === 0) return "must be a non-empty relative path";
	if (value.includes("\0") || [...value].some((character) => character.codePointAt(0) < 0x20 || character.codePointAt(0) === 0x7f)) {
		return "contains a NUL or control character";
	}
	if (path.posix.isAbsolute(value) || path.win32.isAbsolute(value) || /^[A-Za-z]:/u.test(value) || value.startsWith("//")) {
		return "must not be absolute, drive-relative, or UNC rooted";
	}
	const segments = normalizedSegments(value);
	if (!allowDot && segments.some((segment) => segment === "." || segment.length === 0)) return "contains an empty or dot segment";
	if (allowDot && segments.length === 1 && segments[0] === ".") return undefined;
	if (segments.some((segment) => segment === "..")) return "contains a parent traversal";
	if (segments.some((segment) => segment.includes(":"))) return "contains an alternate data stream or colon";
	if (segments.some((segment) => /[. ]$/u.test(segment))) return "contains a trailing dot or space";
	if (segments.some((segment) => reservedWindowsNames.test(segment))) return "contains a reserved Windows device name";
	return undefined;
}

function isPathInside(base, candidate, platform = process.platform) {
	// Windows paths are case-insensitive even when the host happens to expose a
	// case-preserving spelling. Fold both operands before relative() so a
	// case-only alias cannot evade the containment proof.
	const foldedBase = platform === "win32" ? path.resolve(base).toLowerCase() : path.resolve(base);
	const foldedCandidate = platform === "win32" ? path.resolve(candidate).toLowerCase() : path.resolve(candidate);
	const relation = path.relative(foldedBase, foldedCandidate);
	return relation === "" || (relation !== ".." && !relation.startsWith(`..${path.sep}`) && !path.isAbsolute(relation));
}

function samePath(left, right) {
	return process.platform === "win32" ? left.toLowerCase() === right.toLowerCase() : left === right;
}

function statIdentity(stat, filePath, label) {
	if (!Number.isInteger(stat.dev) || !Number.isInteger(stat.ino) || stat.dev < 0 || stat.ino < 0) {
		fail(`${label} has no reliable filesystem identity: ${filePath}`, "containment");
	}
	return `${stat.dev}:${stat.ino}`;
}

function isReparsePoint(stat) {
	return stat.isSymbolicLink() || (stat.reparseTag !== undefined && stat.reparseTag !== 0);
}

function canonicalExistingPath(filePath, label) {
	let current = path.resolve(filePath);
	const missing = [];
	while (!fs.existsSync(current)) {
		const parent = path.dirname(current);
		if (parent === current) fail(`${label} has a missing root ancestor: ${filePath}`, "containment");
		missing.push(path.basename(current));
		current = parent;
	}
	while (missing.length > 0) {
		const component = missing.pop();
		current = path.join(current, component);
	}
	let existing = path.resolve(filePath);
	while (!fs.existsSync(existing)) existing = path.dirname(existing);
	let cursor = existing;
	while (true) {
		const stat = fs.lstatSync(cursor);
		if (isReparsePoint(stat)) fail(`${label} has a symbolic link or reparse ancestor: ${cursor}`, "containment");
		if (cursor === path.dirname(cursor)) break;
		cursor = path.dirname(cursor);
		if (cursor === path.parse(cursor).root) {
			const rootStat = fs.lstatSync(cursor);
			if (isReparsePoint(rootStat)) fail(`${label} has a reparse root: ${cursor}`, "containment");
			break;
		}
	}
	return fs.realpathSync(filePath);
}

export function resolveContained(baseDirectory, relativePath, label, options = {}) {
	const reason = invalidPathReason(relativePath, options.allowDot === true);
	if (reason) fail(`${label} ${reason}: ${JSON.stringify(relativePath)}`, "containment");
	const base = path.resolve(baseDirectory);
	const normalized = normalizedSegments(relativePath).join(path.sep);
	const candidate = path.resolve(base, normalized);
	if (!isPathInside(base, candidate, options.platform)) fail(`${label} escapes ${base}: ${relativePath}`, "containment");
	const baseReal = canonicalExistingPath(base, `${label} base`);
	let candidateReal = candidate;
	if (fs.existsSync(candidate)) {
		candidateReal = canonicalExistingPath(candidate, label);
	} else {
		let existing = candidate;
		while (!fs.existsSync(existing)) {
			const parent = path.dirname(existing);
			if (parent === existing) fail(`${label} has no canonical ancestor: ${candidate}`, "containment");
			existing = parent;
		}
		const existingReal = canonicalExistingPath(existing, `${label} ancestor`);
		if (!isPathInside(baseReal, existingReal, options.platform)) fail(`${label} resolves outside ${baseReal}: ${candidate}`, "containment");
	}
	if (!isPathInside(baseReal, candidateReal, options.platform)) fail(`${label} resolves outside ${baseReal}: ${candidate}`, "containment");
	return candidate;
}

function assertDirectChild(workspaceRoot, repositoryDirectory, label) {
	const absolute = path.resolve(repositoryDirectory);
	if (!samePath(path.dirname(absolute), path.resolve(workspaceRoot))) fail(`${label} must be a direct workspace child`, "containment");
	const real = canonicalExistingPath(absolute, label);
	const workspaceReal = canonicalExistingPath(workspaceRoot, "workspace");
	if (path.dirname(real) !== workspaceReal && !samePath(path.dirname(real), workspaceReal)) {
		fail(`${label} canonical parent is not the workspace`, "containment");
	}
	return real;
}

function ensureDirectory(directory, label) {
	if (fs.existsSync(directory)) {
		const stat = fs.lstatSync(directory);
		if (!stat.isDirectory() || isReparsePoint(stat)) fail(`${label} must be a non-reparse directory: ${directory}`, "containment");
		return;
	}
	const parent = path.dirname(directory);
	if (parent !== directory) ensureDirectory(parent, `${label} parent`);
	fs.mkdirSync(directory);
	const stat = fs.lstatSync(directory);
	if (!stat.isDirectory() || isReparsePoint(stat)) fail(`${label} was not created as a safe directory`, "containment");
}

function workspaceIdentity(workspaceRoot) {
	const realPath = canonicalExistingPath(workspaceRoot, "workspace");
	const stat = fs.lstatSync(realPath);
	if (!stat.isDirectory() || isReparsePoint(stat)) fail(`workspace is not a safe directory: ${workspaceRoot}`, "containment");
	return { realPath, volumeId: String(stat.dev), directoryId: statIdentity(stat, realPath, "workspace") };
}

function assertWorkspaceIdentity(expected, workspaceRoot) {
	const actual = workspaceIdentity(workspaceRoot);
	if (
		!samePath(actual.realPath, expected.realPath) ||
		actual.volumeId !== expected.volumeId ||
		actual.directoryId !== expected.directoryId
	) {
		fail("canonical workspace identity changed", "containment", { expected, actual });
	}
}

function assertStateRootIdentity(stateRoot, expectedWorkspace) {
	const stateReal = canonicalExistingPath(stateRoot, "state root");
	if (!isPathInside(expectedWorkspace.realPath, stateReal)) fail(`state root resolves outside workspace: ${stateRoot}`, "containment");
	const stat = fs.lstatSync(stateReal);
	if (!stat.isDirectory() || isReparsePoint(stat)) fail(`state root is not a safe directory: ${stateRoot}`, "containment");
	return { realPath: stateReal, volumeId: String(stat.dev), directoryId: statIdentity(stat, stateReal, "state root") };
}

function assertPipelineIdentity(plan) {
	assertWorkspaceIdentity(plan.workspace, plan.workspaceRoot);
	const actual = assertStateRootIdentity(plan.stateRoot, plan.workspace);
	if (!sameRecords(actual, plan.stateRootIdentity)) fail("canonical state-root identity changed", "containment", { expected: plan.stateRootIdentity, actual });
}

function faultIfRequested(faultPlan, operation) {
	const requested = faultPlan?.failAt ?? faultPlan?.fail ?? [];
	const values = Array.isArray(requested) ? requested : [requested];
	if (values.includes(operation)) {
		fail(`declarative fault requested at ${operation}`, operation, { operation });
	}
}

function wait(milliseconds) {
	Atomics.wait(waitSignal, 0, 0, milliseconds);
}

export function renameWithWindowsRetry(source, destination, fileSystem = fs, options = {}) {
	const platform = options.platform ?? process.platform;
	const maximumAttempts = options.maximumAttempts ?? 5;
	const retryDelay = options.retryDelay ?? 20;
	const waitFunction = options.wait ?? wait;
	for (let attempt = 1; attempt <= maximumAttempts; attempt += 1) {
		try {
			fileSystem.renameSync(source, destination);
			return attempt;
		} catch (error) {
			const transient = platform === "win32" && windowsRenameCodes.has(error?.code);
			if (!transient || attempt === maximumAttempts) {
				if (attempt > 1 && error && typeof error === "object") renameAttempts.set(error, attempt);
				throw error;
			}
			waitFunction(retryDelay);
		}
	}
}

function runCommand(command, arguments_, options = {}) {
	const result = spawnSync(command, arguments_, {
		cwd: options.cwd,
		encoding: "utf8",
		stdio: options.capture ? ["ignore", "pipe", "pipe"] : "inherit",
		env: options.env
	});
	if (result.error) fail(`could not execute ${command}: ${result.error.message}`, options.phase ?? "command");
	if (result.status !== 0) {
		const diagnostics = options.capture ? [result.stdout, result.stderr].filter(Boolean).join("\n").trim() : "";
		const suffix = diagnostics ? `\n${diagnostics}` : "";
		throw new PipelineError(`command failed (${result.status}): ${command} ${arguments_.join(" ")}${suffix}`, options.phase ?? "command", {
			status: result.status,
			command,
			arguments: arguments_
		});
	}
	return options.capture ? result.stdout : "";
}

export function extractCommandOutput(output, marker) {
	const markerIndex = output.indexOf(marker);
	if (markerIndex < 0) fail(`verified launcher output did not contain capture marker ${marker}`, "command");
	return output.slice(markerIndex + marker.length).replace(/^\r?\n/u, "").trim();
}

function launcherArguments(repositoryDirectory, repository) {
	const arguments_ = ["--repo", repositoryDirectory];
	if (!repository.node?.required) {
		const fallback = repository.node?.fallback?.version;
		if (!/^\d+\.\d+\.\d+$/u.test(fallback ?? "")) fail(`${repository.id} requires an exact Node fallback`, "plan");
		arguments_.push("--node-version", fallback);
	}
	return arguments_;
}

export function buildInvocation(launcher, repositoryDirectory, repository, command) {
	const cwd = resolveContained(repositoryDirectory, command.cwd, "command cwd", { allowDot: true });
	if (!Array.isArray(command.argv) || command.argv.length === 0 || command.argv.some((value) => typeof value !== "string")) {
		fail("mapped command argv must be a non-empty string array", "plan");
	}
	return {
		command: "bash",
		arguments: [
			launcher,
			...launcherArguments(repositoryDirectory, repository),
			"--",
			"bash",
			"-c",
			'cd -- "$1" && shift && exec "$@"',
			"mapped-command",
			cwd,
			...command.argv
		]
	};
}

function runInRepository(repositoryDirectory, repository, command, arguments_, options = {}) {
	const launcher = [launcherPath, ...launcherArguments(repositoryDirectory, repository), "--"];
	if (!options.capture) return runCommand("bash", [...launcher, command, ...arguments_], { cwd: projectRoot, phase: options.phase });
	captureSequence += 1;
	const marker = `__stark-local-package-output-${process.pid}-${captureSequence}__`;
	const output = runCommand(
		"bash",
		[...launcher, "bash", "-c", 'printf "%s\\n" "$1"; shift && exec "$@"', "captured-command", marker, command, ...arguments_],
		{ cwd: projectRoot, capture: true, phase: options.phase }
	);
	return extractCommandOutput(output, marker);
}

function runGit(repositoryDirectory, repository, ...arguments_) {
	return runInRepository(repositoryDirectory, repository, "git", arguments_, { capture: true, phase: "repository.snapshot" });
}

function fileIdentity(stat, filePath, label = "file") {
	return statIdentity(stat, filePath, label);
}

function trackedEntries(repositoryDirectory, repository) {
	const raw = runGit(repositoryDirectory, repository, "ls-files", "--stage", "-z");
	const entries = [];
	for (const record of raw.split("\0").filter(Boolean)) {
		const separator = record.indexOf("\t");
		if (separator < 0) fail(`malformed git ls-files entry: ${record}`, "repository.snapshot");
		const metadata = record.slice(0, separator).split(" ");
		const trackedPath = record.slice(separator + 1);
		if (metadata.length !== 3 || !/^\d+$/u.test(metadata[0]) || !/^[0-9a-f]+$/u.test(metadata[1])) {
			fail(`malformed git tracked entry: ${record}`, "repository.snapshot");
		}
		const reason = invalidPathReason(trackedPath);
		if (reason) fail(`tracked path ${trackedPath} ${reason}`, "repository.snapshot");
		entries.push({ path: trackedPath, mode: metadata[0], object: metadata[1], stage: metadata[2] });
	}
	return entries.sort((left, right) => left.path.localeCompare(right.path));
}

function snapshotTrackedFiles(repositoryDirectory, repository, entries = trackedEntries(repositoryDirectory, repository)) {
	const identities = new Map();
	return entries.map((entry) => {
		const filePath = resolveContained(repositoryDirectory, entry.path, "tracked path");
		if (!fs.existsSync(filePath)) fail(`tracked path is missing: ${filePath}`, "repository.snapshot");
		const stat = fs.lstatSync(filePath);
		if (!stat.isFile() || isReparsePoint(stat)) fail(`tracked path is not a regular file: ${filePath}`, "repository.snapshot");
		if (stat.nlink > 1) fail(`tracked path is hard-linked and cannot be authenticated: ${filePath}`, "repository.snapshot");
		const identity = fileIdentity(stat, filePath, "tracked file");
		if (identities.has(identity)) fail(`duplicate tracked file identity for ${filePath} and ${identities.get(identity)}`, "repository.snapshot");
		identities.set(identity, entry.path);
		return {
			path: entry.path,
			mode: entry.mode,
			type: "file",
			identity,
			size: stat.size,
			sha256: hashFile(filePath)
		};
	});
}

function inspectRepository(repositoryDirectory, repository) {
	const topLevel = canonicalExistingPath(runGit(repositoryDirectory, repository, "rev-parse", "--show-toplevel").trim(), "git top level");
	const expected = canonicalExistingPath(repositoryDirectory, "repository");
	if (!samePath(topLevel, expected)) fail(`mapped repository is not the expected Git worktree: ${repositoryDirectory}`, "repository.snapshot");
	const branch = runGit(repositoryDirectory, repository, "symbolic-ref", "--quiet", "--short", "HEAD").trim();
	if (!branch) fail(`mapped repository must be on a named branch: ${repositoryDirectory}`, "repository.snapshot");
	const entries = trackedEntries(repositoryDirectory, repository);
	return {
		realPath: expected,
		directoryIdentity: statIdentity(fs.lstatSync(expected), expected, "repository"),
		branch,
		commit: runGit(repositoryDirectory, repository, "rev-parse", "HEAD").trim(),
		trackedStatus: runGit(repositoryDirectory, repository, "status", "--porcelain=v1", "--untracked-files=no"),
		trackedPaths: entries.map((entry) => entry.path),
		trackedFiles: snapshotTrackedFiles(repositoryDirectory, repository, entries),
		trackedFilesSha256: hashBuffer(stableJson(snapshotTrackedFiles(repositoryDirectory, repository, entries)))
	};
}

function sameRecords(left, right) {
	return JSON.stringify(left) === JSON.stringify(right);
}

function compareRepositorySnapshot(repositoryDirectory, repository, before, context) {
	const currentReal = canonicalExistingPath(repositoryDirectory, "repository");
	if (!samePath(currentReal, before.realPath)) fail(`${context}: repository canonical identity changed: ${repositoryDirectory}`, "repository.invariant");
	const currentDirectoryIdentity = statIdentity(fs.lstatSync(currentReal), currentReal, "repository");
	if (currentDirectoryIdentity !== before.directoryIdentity) fail(`${context}: repository directory identity changed: ${repositoryDirectory}`, "repository.invariant");
	const after = inspectRepository(repositoryDirectory, repository);
	const differences = [];
	for (const field of ["branch", "commit", "trackedStatus", "trackedPaths", "trackedFiles"]) {
		if (!sameRecords(after[field], before[field])) differences.push(field);
	}
	if (differences.length > 0) {
		fail(`${context}: sibling repository invariants changed (${differences.join(", ")}): ${repositoryDirectory}`, "repository.invariant", {
			differences,
			before,
			after
		});
	}
	return after;
}

function artifactMatcher(pattern) {
	if (typeof pattern !== "string" || path.basename(pattern) !== pattern || pattern.split("*").length !== 2) {
		fail(`artifact pattern must be one basename wildcard: ${JSON.stringify(pattern)}`, "plan");
	}
	const [prefix, suffix] = pattern.split("*");
	return (fileName) => fileName.startsWith(prefix) && fileName.endsWith(suffix);
}

function expectedArtifactName(artifact, packageVersion) {
	if (typeof artifact?.expectedName !== "string" || !artifact.expectedName.includes("{packageVersion}")) {
		fail(`invalid expected artifact name: ${JSON.stringify(artifact?.expectedName)}`, "plan");
	}
	const name = artifact.expectedName.replaceAll("{packageVersion}", packageVersion);
	if (path.basename(name) !== name || !name.endsWith(".tgz")) fail(`invalid expected artifact basename: ${name}`, "plan");
	return name;
}

function artifactDirectory(repositoryDirectory, artifact) {
	return resolveContained(repositoryDirectory, artifact.directory, "artifact directory", { allowDot: true });
}

function packageVersion(repositoryDirectory, packageEntry) {
	const manifestPath = resolveContained(repositoryDirectory, packageEntry.manifest, "package manifest");
	let manifest;
	try {
		manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
	} catch (error) {
		fail(`could not read package manifest ${manifestPath}: ${error.message}`, "repository.snapshot");
	}
	if (manifest.name !== packageEntry.name || typeof manifest.version !== "string" || manifest.version.length === 0) {
		fail(`package manifest has unexpected name or version: ${manifestPath}`, "repository.snapshot");
	}
	const rootManifestPath = resolveContained(repositoryDirectory, "package.json", "repository manifest");
	const rootVersion = JSON.parse(fs.readFileSync(rootManifestPath, "utf8")).version;
	if (typeof rootVersion !== "string" || rootVersion.length === 0) fail(`repository manifest has no version: ${rootManifestPath}`, "repository.snapshot");
	if (manifest.version !== rootVersion && manifest.version !== "0.0.0-PLACEHOLDER-VERSION") {
		fail(`${packageEntry.name} version does not match repository version: ${manifest.version} != ${rootVersion}`, "repository.snapshot");
	}
	return rootVersion;
}

export function validateSourceArtifact(repositoryDirectory, artifact, packageVersionValue, buildStartedAt) {
	const directory = artifactDirectory(repositoryDirectory, artifact);
	if (!fs.existsSync(directory) || !fs.lstatSync(directory).isDirectory()) fail(`missing expected artifact directory: ${directory}`, "artifact.validation");
	const entries = fs.readdirSync(directory, { withFileTypes: true });
	const matches = entries.filter((entry) => artifactMatcher(artifact.pattern)(entry.name));
	const expectedName = expectedArtifactName(artifact, packageVersionValue);
	if (matches.length === 0) fail(`missing expected artifact: ${path.join(directory, expectedName)}`, "artifact.validation");
	if (matches.length !== 1) fail(`expected exactly one artifact matching ${artifact.pattern}, found ${matches.length}`, "artifact.validation");
	if (matches[0].name !== expectedName) fail(`unexpected artifact ${matches[0].name}; expected ${expectedName}`, "artifact.validation");
	const unexpectedTarballs = entries.filter((entry) => entry.name.endsWith(".tgz") && entry.name !== expectedName);
	if (unexpectedTarballs.length > 0) fail(`unexpected tarball output in ${directory}: ${unexpectedTarballs.map((entry) => entry.name).join(", ")}`, "artifact.validation");
	const artifactPath = path.join(directory, expectedName);
	const stat = fs.lstatSync(artifactPath);
	if (!stat.isFile() || isReparsePoint(stat) || stat.nlink > 1) fail(`artifact must be a unique regular file: ${artifactPath}`, "artifact.validation");
	if (stat.mtimeMs < buildStartedAt - 2_000) fail(`stale artifact predates the build: ${artifactPath}`, "artifact.validation");
	return artifactPath;
}

function sourceArtifactProof(sourcePath) {
	const first = fs.lstatSync(sourcePath);
	if (!first.isFile() || isReparsePoint(first) || first.nlink > 1) fail(`artifact must be a unique regular file: ${sourcePath}`, "artifact.validation");
	const firstIdentity = fileIdentity(first, sourcePath, "source artifact");
	const contents = fs.readFileSync(sourcePath);
	const proof = {
		identity: firstIdentity,
		size: first.size,
		sha256: hashBuffer(contents),
		sha512: hashBuffer(contents, "sha512")
	};
	const second = fs.lstatSync(sourcePath);
	if (!second.isFile() || isReparsePoint(second) || second.nlink > 1 || fileIdentity(second, sourcePath, "source artifact") !== proof.identity || second.size !== proof.size || hashFile(sourcePath) !== proof.sha256 || hashFile(sourcePath, "sha512") !== proof.sha512) {
		fail(`source artifact changed during validation: ${sourcePath}`, "artifact.validation");
	}
	return proof;
}

function cleanMappedArtifacts(repositoryDirectory, packageEntries, faultPlan) {
	faultIfRequested(faultPlan, "source.cleanup.before");
	for (const packageEntry of packageEntries) {
		const directory = artifactDirectory(repositoryDirectory, packageEntry.artifact);
		if (!fs.existsSync(directory)) continue;
		const matcher = artifactMatcher(packageEntry.artifact.pattern);
		for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
			if (!matcher(entry.name)) continue;
			const filePath = path.join(directory, entry.name);
			const stat = fs.lstatSync(filePath);
			if (!stat.isFile() || isReparsePoint(stat) || stat.nlink > 1) fail(`refusing to remove unsafe mapped artifact: ${filePath}`, "source.cleanup");
			faultIfRequested(faultPlan, "source.cleanup.remove");
			fs.unlinkSync(filePath);
		}
	}
}

export function repositoryOrder(map) {
	const ownerByPackage = new Map();
	for (const repository of map.repositories ?? []) for (const packageEntry of repository.packages ?? []) ownerByPackage.set(packageEntry.name, repository.id);
	const dependencies = new Map(
		(map.repositories ?? []).map((repository) => [
			repository.id,
			new Set((repository.packages ?? []).flatMap((entry) => entry.dependencies ?? []).map((name) => ownerByPackage.get(name)).filter((id) => id && id !== repository.id))
		])
	);
	const remaining = [...(map.repositories ?? [])];
	const ordered = [];
	while (remaining.length > 0) {
		const index = remaining.findIndex((repository) => [...(dependencies.get(repository.id) ?? [])].every((dependency) => ordered.some((entry) => entry.id === dependency)));
		if (index < 0) fail("repository dependency graph contains a cycle", "plan");
		ordered.push(remaining.splice(index, 1)[0]);
	}
	return ordered;
}

function mapDigest(map) {
	return hashBuffer(stableJson(map));
}

function planFromMap(map, workspaceRoot, stateRoot) {
	return {
		workspaceRoot,
		stateRoot,
		repositories: repositoryOrder(map).map((repository) => ({
			id: repository.id,
			directory: repository.directory,
			node: repository.node,
			packages: repository.packages,
			commands: repository.commands
		})),
		mapDigest: mapDigest(map),
		map
	};
}

function validateDeclarativePlan(plan) {
	if (!plan || typeof plan !== "object") fail("pipeline plan must be an object", "plan");
	if (typeof plan.workspaceRoot !== "string" || typeof plan.stateRoot !== "string") fail("plan must define workspaceRoot and stateRoot", "plan");
	if (!Array.isArray(plan.repositories) || plan.repositories.length === 0) fail("plan must contain repositories", "plan");
	const ids = new Set();
	const packageNames = new Set();
	for (const repository of plan.repositories) {
		if (!repository?.id || ids.has(repository.id)) fail(`duplicate or missing repository id: ${repository?.id}`, "plan");
		ids.add(repository.id);
		if (invalidPathReason(repository.directory)) fail(`${repository.id} directory is unsafe`, "plan");
		if (!Array.isArray(repository.commands) || repository.commands.length === 0) fail(`${repository.id} has no commands`, "plan");
		for (const command of repository.commands) {
			if (invalidPathReason(command.cwd, true) || !Array.isArray(command.argv) || command.argv.length === 0 || command.argv.some((value) => typeof value !== "string")) fail(`${repository.id} has malformed command`, "plan");
		}
		for (const packageEntry of repository.packages ?? []) {
			if (!packageEntry?.name || packageNames.has(packageEntry.name)) fail(`duplicate or missing package name: ${packageEntry?.name}`, "plan");
			packageNames.add(packageEntry.name);
			if (invalidPathReason(packageEntry.manifest)) fail(`${packageEntry.name} manifest is unsafe`, "plan");
			if (!Array.isArray(packageEntry.dependencies) || !Number.isInteger(packageEntry.buildOrder)) fail(`${packageEntry.name} has malformed dependency metadata`, "plan");
			if (invalidPathReason(packageEntry.artifact?.directory, true) || typeof packageEntry.artifact?.pattern !== "string" || typeof packageEntry.artifact?.expectedName !== "string") fail(`${packageEntry.name} has malformed artifact metadata`, "plan");
		}
	}
	const ownerByPackage = new Map();
	for (const repository of plan.repositories) for (const packageEntry of repository.packages ?? []) ownerByPackage.set(packageEntry.name, repository.id);
	for (const repository of plan.repositories) for (const packageEntry of repository.packages ?? []) for (const dependency of packageEntry.dependencies) if (!ownerByPackage.has(dependency)) fail(`${packageEntry.name} references unmapped dependency ${dependency}`, "plan");
}

function readJson(filePath, label) {
	try {
		return JSON.parse(fs.readFileSync(filePath, "utf8"));
	} catch (error) {
		fail(`invalid ${label} ${filePath}: ${error.message}`, "recovery");
	}
}

function processStartToken(pid) {
	if (process.platform !== "linux") return null;
	try {
		const stat = fs.readFileSync(`/proc/${pid}/stat`, "utf8");
		const afterCommand = stat.slice(stat.lastIndexOf(")") + 2).trim().split(/\s+/u);
		return afterCommand[19] ?? null;
	} catch {
		return null;
	}
}

function processCommandLine(pid) {
	if (process.platform !== "linux") return null;
	try {
		return fs.readFileSync(`/proc/${pid}/cmdline`, "utf8").replaceAll("\0", " ").trim();
	} catch {
		return null;
	}
}

function lockOwner(plan) {
	return {
		pid: process.pid,
		processStartToken: processStartToken(process.pid),
		commandLine: processCommandLine(process.pid) ?? process.argv.join(" "),
		plannedChildren: plan.repositories.flatMap((repository) => repository.commands.map((command) => ({
			repository: repository.id,
			phase: command.phase,
			cwd: command.cwd,
			argv: command.argv
		})))
	};
}

function ensureStateLayout(stateRoot) {
	ensureDirectory(stateRoot, "state root");
	for (const relative of ["locks", "locks/candidates", "locks/release-receipts", "locks/released", "generations", "quarantine"]) {
		ensureDirectory(path.join(stateRoot, relative), `state ${relative}`);
	}
	const stateEntries = fs.readdirSync(stateRoot, { withFileTypes: true });
	for (const entry of stateEntries) {
		if (!entry.isDirectory() || isReparsePoint(fs.lstatSync(path.join(stateRoot, entry.name))) || !["locks", "generations", "quarantine"].includes(entry.name)) {
			fail(`unexpected or unsafe state-root entry: ${entry.name}`, "recovery");
		}
	}
}

function statePath(stateRoot, relativePath, label) {
	return resolveContained(stateRoot, relativePath, label, { allowDot: false });
}

function assertStateSource(stateRoot, sourcePath, label) {
	const stateReal = canonicalExistingPath(stateRoot, "state root");
	const sourceAbsolute = path.resolve(sourcePath);
	const sourceReal = canonicalExistingPath(sourceAbsolute, label);
	if (!isPathInside(stateReal, sourceReal)) fail(`${label} is outside state root: ${sourcePath}`, "containment");
	const stat = fs.lstatSync(sourceAbsolute);
	if (isReparsePoint(stat)) fail(`${label} is a reparse point: ${sourcePath}`, "containment");
	return { path: sourceAbsolute, realPath: sourceReal, identity: statIdentity(stat, sourceAbsolute, label) };
}

function assertRenamePaths(stateRoot, sourcePath, destinationPath, options = {}) {
	if (options.workspace) assertWorkspaceIdentity(options.workspace, options.workspaceRoot);
	if (options.stateRootIdentity) {
		const actualState = assertStateRootIdentity(stateRoot, options.workspace ?? workspaceIdentity(options.workspaceRoot));
		if (!sameRecords(actualState, options.stateRootIdentity)) fail("canonical state-root identity changed before rename", "containment", { expected: options.stateRootIdentity, actual: actualState });
	}
	const source = assertStateSource(stateRoot, sourcePath, "rename source");
	const destination = resolveContained(stateRoot, path.relative(stateRoot, destinationPath), "rename destination");
	const destinationParent = canonicalExistingPath(path.dirname(destination), "rename destination parent");
	if (!isPathInside(canonicalExistingPath(stateRoot, "state root"), destinationParent)) fail(`rename destination is outside state root: ${destination}`, "containment");
	if (options.sourceSuffix && !path.basename(source.path).endsWith(options.sourceSuffix)) fail(`rename source has unexpected state suffix: ${source.path}`, "containment");
	if (options.destinationSuffix && !path.basename(destination).endsWith(options.destinationSuffix)) fail(`rename destination has unexpected state suffix: ${destination}`, "containment");
	if (options.destinationAbsent !== false && fs.existsSync(destination)) fail(`rename destination already exists: ${destination}`, "containment");
	// Re-read source identity immediately before the atomic rename. This is the
	// last proof point against a replacement between discovery and publication.
	const current = fs.lstatSync(source.path);
	if (isReparsePoint(current) || statIdentity(current, source.path, "rename source") !== source.identity) fail(`rename source identity changed: ${source.path}`, "containment");
	if (options.stateRootIdentity) {
		const actualState = assertStateRootIdentity(stateRoot, options.workspace ?? workspaceIdentity(options.workspaceRoot));
		if (!sameRecords(actualState, options.stateRootIdentity)) fail("canonical state-root identity changed immediately before rename", "containment", { expected: options.stateRootIdentity, actual: actualState });
	}
	return { source: source.path, destination, sourceIdentity: source.identity };
}

function quarantinePath(stateRoot, sourcePath, stateLabel, faultPlan, operation = "recovery.quarantine", options = {}) {
	const destination = path.join(stateRoot, "quarantine", `${randomToken(16)}.${stateLabel}.${randomToken(8)}`);
	faultIfRequested(faultPlan, operation);
	try {
		const rename = assertRenamePaths(stateRoot, sourcePath, destination, { ...options, sourceSuffix: options.sourceSuffix });
		if (options.stateRootIdentity) {
			const actualState = assertStateRootIdentity(stateRoot, options.workspace ?? workspaceIdentity(options.workspaceRoot));
			if (!sameRecords(actualState, options.stateRootIdentity)) fail("canonical state-root identity changed immediately before quarantine", "containment", { expected: options.stateRootIdentity, actual: actualState });
		}
		renameWithWindowsRetry(rename.source, rename.destination);
	} catch (error) {
		throw new PipelineError(`could not quarantine ${sourcePath}: ${error.message}`, "recovery", { source: sourcePath, destination, cause: error });
	}
	return destination;
}

function directoryEntries(directory) {
	return fs.readdirSync(directory, { withFileTypes: true }).map((entry) => ({
		name: entry.name,
		path: path.join(directory, entry.name),
		stat: fs.lstatSync(path.join(directory, entry.name))
	}));
}

function validateLockShape(stateRoot, relative, expectedKind) {
	const lockPath = statePath(stateRoot, relative, `${expectedKind} lock`);
	const stat = fs.lstatSync(lockPath);
	if (!stat.isDirectory() || isReparsePoint(stat)) fail(`${expectedKind} lock is not a safe directory: ${lockPath}`, "recovery");
	return lockPath;
}

function acquireWorkspaceLock(stateRoot, plan, faultPlan) {
	const locksRoot = statePath(stateRoot, "locks", "locks root");
	const candidatesRoot = statePath(stateRoot, "locks/candidates", "lock candidates");
	const activePath = statePath(stateRoot, "locks/active", "active lock");
	if (fs.existsSync(activePath)) {
		const activeStat = fs.lstatSync(activePath);
		if (!activeStat.isDirectory() || isReparsePoint(activeStat)) fail(`active lock is unsafe: ${activePath}`, "lock");
		const activeDescriptorPath = path.join(activePath, "descriptor.json");
		const descriptor = fs.existsSync(activeDescriptorPath) ? readJson(activeDescriptorPath, "active lock descriptor") : { malformed: true };
		fail(`workspace is already locked by ${JSON.stringify(descriptor)}`, "lock", { activeDescriptor: descriptor });
	}
	const lockId = randomToken(16);
	const candidate = path.join(candidatesRoot, `${lockId}.incomplete`);
	if (fs.existsSync(candidate)) fail(`lock candidate collision: ${candidate}`, "lock");
	assertPipelineIdentity(plan);
	ensureDirectory(candidate, "lock candidate");
	const descriptor = {
		schemaVersion: lockSchemaVersion,
		lockId,
		state: "LOCK-CANDIDATE",
		workspace: workspaceIdentity(plan.workspaceRoot),
		stateRoot: plan.stateRootIdentity,
		ownerNonce: randomToken(24),
		owner: lockOwner(plan),
		createdAt: new Date().toISOString()
	};
	faultIfRequested(faultPlan, "lock.candidate.write");
	assertPipelineIdentity(plan);
	writeAtomic(path.join(candidate, "descriptor.json"), stableJson(descriptor));
	const candidateDescriptor = readJson(path.join(candidate, "descriptor.json"), "lock candidate descriptor");
	if (!sameRecords(candidateDescriptor, descriptor)) fail("lock candidate descriptor changed before publication", "lock");
	faultIfRequested(faultPlan, "lock.publish.rename");
	try {
		const rename = assertRenamePaths(stateRoot, candidate, activePath, {
			workspace: plan.workspace,
			workspaceRoot: plan.workspaceRoot,
			stateRootIdentity: plan.stateRootIdentity,
			sourceSuffix: ".incomplete",
			destinationAbsent: true
		});
		renameWithWindowsRetry(rename.source, rename.destination);
	} catch (error) {
		const activeDescriptor = fs.existsSync(activePath) && fs.existsSync(path.join(activePath, "descriptor.json"))
			? readJson(path.join(activePath, "descriptor.json"), "active lock descriptor")
			: undefined;
		throw new PipelineError(`could not acquire workspace lock; candidate preserved at ${candidate}: ${error.message}`, "lock", {
			candidate,
			activeDescriptor,
			cause: error
		});
	}
	const active = validateLockShape(stateRoot, "locks/active", "active");
	const activeRead = readJson(path.join(active, "descriptor.json"), "active lock descriptor");
	if (!sameRecords(activeRead, descriptor)) fail("active lock descriptor does not match candidate", "lock");
	return { lockId, descriptor, activePath: active, stateRoot };
}

function releaseWorkspaceLock(lock, faultPlan) {
	assertWorkspaceIdentity(lock.descriptor.workspace, lock.descriptor.workspace.realPath);
	const stateRootIdentity = assertStateRootIdentity(lock.stateRoot, lock.descriptor.workspace);
	if (!sameRecords(stateRootIdentity, lock.descriptor.stateRoot)) fail("canonical state-root identity changed before lock release", "containment", { expected: lock.descriptor.stateRoot, actual: stateRootIdentity });
	const receiptsRoot = statePath(lock.stateRoot, "locks/release-receipts", "release receipts");
	const releasedRoot = statePath(lock.stateRoot, "locks/released", "released locks");
	const receiptPath = path.join(receiptsRoot, `${lock.lockId}.complete`);
	const releasedPath = path.join(releasedRoot, `${lock.lockId}.complete`);
	const receipt = {
		schemaVersion: lockSchemaVersion,
		lockId: lock.lockId,
		ownerNonce: lock.descriptor.ownerNonce,
		workspace: lock.descriptor.workspace,
		releasedAt: new Date().toISOString(),
		state: "LOCK-RELEASED"
	};
	faultIfRequested(faultPlan, "lock.release.receipt");
	const receiptState = assertStateRootIdentity(lock.stateRoot, lock.descriptor.workspace);
	if (!sameRecords(receiptState, lock.descriptor.stateRoot)) fail("canonical state-root identity changed before release receipt", "containment", { expected: lock.descriptor.stateRoot, actual: receiptState });
	writeAtomic(receiptPath, stableJson(receipt));
	if (!fs.existsSync(lock.activePath)) fail(`active lock disappeared before release: ${lock.activePath}`, "lock.release");
	const activeDescriptor = readJson(path.join(lock.activePath, "descriptor.json"), "active lock descriptor");
	if (!sameRecords(activeDescriptor, lock.descriptor)) fail("active lock owner changed before release", "lock.release");
	if (fs.existsSync(releasedPath)) fail(`released lock destination collision: ${releasedPath}`, "lock.release");
	faultIfRequested(faultPlan, "lock.release.rename");
	const rename = assertRenamePaths(lock.stateRoot, lock.activePath, releasedPath, {
		workspace: lock.descriptor.workspace,
		workspaceRoot: lock.descriptor.workspace.realPath,
		stateRootIdentity: lock.descriptor.stateRoot,
		destinationSuffix: ".complete",
		destinationAbsent: true
	});
	renameWithWindowsRetry(rename.source, rename.destination);
	return { receiptPath, releasedPath };
}

function normalizePlan(plan) {
	validateDeclarativePlan(plan);
	const workspaceRoot = path.resolve(plan.workspaceRoot);
	const workspace = workspaceIdentity(workspaceRoot);
	let stateRelative;
	if (path.isAbsolute(plan.stateRoot) || path.win32.isAbsolute(plan.stateRoot)) {
		const absoluteState = path.resolve(plan.stateRoot);
		if (!isPathInside(workspace.realPath, absoluteState, process.platform)) fail("state root must be inside the workspace", "containment");
		stateRelative = path.relative(workspace.realPath, absoluteState);
	} else {
		stateRelative = plan.stateRoot;
	}
	const reason = invalidPathReason(stateRelative);
	if (reason) fail(`state root ${reason}`, "containment");
	const stateRoot = resolveContained(workspace.realPath, stateRelative, "state root");
	ensureDirectory(stateRoot, "state root");
	const stateRootIdentity = assertStateRootIdentity(stateRoot, workspace);
	const ordered = repositoryOrder({ repositories: plan.repositories });
	return {
		...plan,
		workspaceRoot: workspace.realPath,
		stateRoot,
		stateRootIdentity,
		repositories: ordered,
		workspace
	};
}

function repositoryPlanSnapshot(planRepository, repositoryDirectory, snapshot, packageVersions) {
	return {
		id: planRepository.id,
		realPath: canonicalExistingPath(repositoryDirectory, "repository"),
		branch: snapshot.branch,
		commit: snapshot.commit,
		trackedStatus: snapshot.trackedStatus,
		trackedFilesSha256: snapshot.trackedFilesSha256,
		trackedFiles: snapshot.trackedFiles,
		packages: packageVersions
	};
}

function expectedArtifactMetadata(repository, repositoryDirectory, packageVersions) {
	return repository.packages.map((packageEntry) => ({
		package: packageEntry.name,
		repository: repository.id,
		version: packageVersions.get(packageEntry.name),
		sourceDirectory: repository.directory,
		artifactDirectory: packageEntry.artifact.directory,
		expectedName: expectedArtifactName(packageEntry.artifact, packageVersions.get(packageEntry.name)),
		pattern: packageEntry.artifact.pattern,
		repositoryPath: canonicalExistingPath(repositoryDirectory, "repository"),
		sourcePath: path.join(canonicalExistingPath(repositoryDirectory, "repository"), packageEntry.artifact.directory, expectedArtifactName(packageEntry.artifact, packageVersions.get(packageEntry.name)))
	}));
}

function packageOrder(repository) {
	return [...repository.packages].sort((left, right) => left.buildOrder - right.buildOrder || left.name.localeCompare(right.name));
}

function initialRepositoryState(planRepository, plan, faultPlan) {
	const directory = assertDirectChild(plan.workspaceRoot, resolveContained(plan.workspaceRoot, planRepository.directory, `${planRepository.id} repository`), `${planRepository.id} repository`);
	const snapshot = inspectRepository(directory, planRepository);
	const packageVersions = new Map(packageOrder(planRepository).map((packageEntry) => [packageEntry.name, packageVersion(directory, packageEntry)]));
	return {
		repository: planRepository,
		directory,
		snapshot,
		packageVersions,
		state: repositoryPlanSnapshot(planRepository, directory, snapshot, Object.fromEntries(packageVersions)),
		expectedArtifacts: expectedArtifactMetadata(planRepository, directory, packageVersions),
		faultPlan
	};
}

function generationDescriptor(plan, generationId, initialStates) {
	return {
		schemaVersion: stateSchemaVersion,
		state: "PLANNED",
		generationId,
		workspace: plan.workspace,
		mapSha256: plan.mapDigest ?? hashBuffer(stableJson(plan.repositories)),
		plannedRepositories: initialStates.map((entry) => entry.state),
		expectedArtifacts: initialStates.flatMap((entry) => entry.expectedArtifacts),
		plan: {
			workspaceRoot: plan.workspaceRoot,
			stateRoot: plan.stateRoot,
			stateRootIdentity: plan.stateRootIdentity,
			repositories: plan.repositories.map((repository) => ({
				id: repository.id,
				directory: repository.directory,
				node: repository.node,
				packages: repository.packages,
				commands: repository.commands
			}))
		},
		createdAt: new Date().toISOString()
	};
}

function regularFileRecord(filePath, relativePath, identities) {
	const stat = fs.lstatSync(filePath);
	if (!stat.isFile() || isReparsePoint(stat) || stat.nlink > 1) fail(`generated output must be a unique regular file: ${filePath}`, "output.validation");
	const identity = fileIdentity(stat, filePath, "generated file");
	if (identities.has(identity)) fail(`duplicate generated file identity: ${filePath} and ${identities.get(identity)}`, "output.validation");
	identities.set(identity, relativePath);
	return {
		path: relativePath,
		identity,
		mode: stat.mode & 0o777,
		size: stat.size,
		sha256: hashFile(filePath)
	};
}

function collectTreeFiles(generationPath) {
	const entries = [];
	const identities = new Map();
	const visit = (directory, relativeDirectory = "") => {
		for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
			const absolutePath = path.join(directory, entry.name);
			const relativePath = relativeDirectory ? `${relativeDirectory}/${entry.name}` : entry.name;
			const stat = fs.lstatSync(absolutePath);
			if (isReparsePoint(stat)) fail(`generated tree contains a link or reparse point: ${relativePath}`, "output.validation");
			if (entry.isDirectory()) visit(absolutePath, relativePath);
			else if (relativePath !== treeManifestName && relativePath !== completionMarkerName) entries.push(regularFileRecord(absolutePath, relativePath, identities));
		}
	};
	visit(generationPath);
	return entries.sort((left, right) => left.path.localeCompare(right.path));
}

function treeManifestCore(entries) {
	return { schemaVersion: stateSchemaVersion, entries };
}

function computeTreeDigest(entries) {
	return hashBuffer(stableJson(treeManifestCore(entries)));
}

function validateExpectedGenerationFiles(generationPath) {
	const topEntries = fs.readdirSync(generationPath).sort();
	const expectedTop = [...generatedFiles, descriptorName, resultName, treeManifestName, completionMarkerName].sort();
	if (JSON.stringify(topEntries) !== JSON.stringify(expectedTop)) fail(`unexpected generation output set: ${topEntries.join(", ")}`, "output.validation");
	const artifactsPath = path.join(generationPath, "artifacts");
	const artifactsStat = fs.lstatSync(artifactsPath);
	if (!artifactsStat.isDirectory() || isReparsePoint(artifactsStat)) fail("artifact output directory is unsafe", "output.validation");
}

export function validateGenerationAt(generationPath, expected = {}) {
	if (!fs.existsSync(generationPath)) fail(`missing generation: ${generationPath}`, "output.validation");
	const basename = path.basename(generationPath);
	const staging = basename.endsWith(".incomplete");
	if (!staging && !basename.endsWith(".complete")) fail(`generation has an unclassifiable state suffix: ${generationPath}`, "output.validation");
	if (!/^[a-f0-9]{32}\.(?:incomplete|complete)$/u.test(basename)) fail(`generation has an invalid identity name: ${generationPath}`, "output.validation");
	if (expected.generationId !== undefined && basename.slice(0, 32) !== expected.generationId) fail(`generation path identity mismatch: ${generationPath}`, "output.validation");
	if (staging && expected.allowIncomplete !== true) fail(`staging generation is not publish authority: ${generationPath}`, "output.validation");
	const stat = fs.lstatSync(generationPath);
	if (!stat.isDirectory() || isReparsePoint(stat)) fail(`generation is not a safe directory: ${generationPath}`, "output.validation");
	if (expected.stateRoot) {
		const workspace = expected.workspace ?? workspaceIdentity(expected.stateRoot);
		const state = assertStateRootIdentity(expected.stateRoot, workspace);
		const generationReal = canonicalExistingPath(generationPath, "generation");
		if (!isPathInside(state.realPath, generationReal)) fail(`generation resolves outside state root: ${generationPath}`, "containment");
	}
	validateExpectedGenerationFiles(generationPath);
	const descriptor = readJson(path.join(generationPath, descriptorName), "generation descriptor");
	const result = readJson(path.join(generationPath, resultName), "generation result");
	const provenance = readJson(path.join(generationPath, "provenance.json"), "generation provenance");
	const marker = readJson(path.join(generationPath, completionMarkerName), "completion marker");
	const manifest = readJson(path.join(generationPath, treeManifestName), "tree manifest");
	if (descriptor.schemaVersion !== stateSchemaVersion || result.schemaVersion !== stateSchemaVersion || provenance.schemaVersion !== stateSchemaVersion || marker.schemaVersion !== stateSchemaVersion) fail("generation schema mismatch", "output.validation");
	const basenameGenerationId = basename.slice(0, 32);
	if (descriptor.generationId !== basenameGenerationId || marker.generationId !== basenameGenerationId || result.generationId !== basenameGenerationId || provenance.generationId !== basenameGenerationId || expected.generationId !== undefined && descriptor.generationId !== expected.generationId) fail("generation identity mismatch", "output.validation");
	if (!["PUBLISH-READY", "PUBLISHED"].includes(marker.state)) fail("generation completion marker is not publish-ready", "output.validation");
	if (!sameRecords(descriptor.workspace, result.workspace) || !sameRecords(descriptor.workspace, provenance.workspace) || !sameRecords(descriptor.workspace, marker.workspace)) fail("generation workspace identity mismatch", "output.validation");
	assertWorkspaceIdentity(descriptor.workspace, descriptor.workspace.realPath);
	if (expected.stateRoot) {
		const state = assertStateRootIdentity(expected.stateRoot, expected.workspace ?? descriptor.workspace);
		if (!sameRecords(descriptor.plan?.stateRootIdentity, state)) fail("generation state-root identity mismatch", "output.validation");
	}
	if (descriptor.mapSha256 !== result.mapSha256 || descriptor.mapSha256 !== provenance.mapSha256) fail("generation map identity mismatch", "output.validation");
	const entries = collectTreeFiles(generationPath);
	if (!sameRecords(entries, manifest.entries)) fail("generation tree manifest does not match its files", "output.validation");
	const treeSha256 = computeTreeDigest(entries);
	if (manifest.treeSha256 !== treeSha256 || marker.treeSha256 !== treeSha256) fail("generation tree digest mismatch", "output.validation");
	if (marker.descriptorSha256 !== hashFile(path.join(generationPath, descriptorName)) || marker.resultSha256 !== hashFile(path.join(generationPath, resultName))) fail("generation metadata digest mismatch", "output.validation");
	const artifactRecords = Array.isArray(result.artifacts) ? result.artifacts : [];
	if (!sameRecords(artifactRecords, provenance.artifacts) || !sameRecords(result.repositories, provenance.repositories)) fail("generation result and provenance differ", "output.validation");
	const plannedRepositories = Array.isArray(descriptor.plannedRepositories) ? descriptor.plannedRepositories : [];
	const resultRepositories = Array.isArray(result.repositories) ? result.repositories : [];
	if (plannedRepositories.length !== resultRepositories.length) fail("generation repository set mismatch", "output.validation");
	for (const planned of plannedRepositories) {
		const actual = resultRepositories.find((entry) => entry.repository === planned.id);
		if (!actual || !samePath(actual.realPath, planned.realPath) || actual.branch !== planned.branch || actual.commit !== planned.commit || actual.trackedStatus !== planned.trackedStatus || actual.trackedFilesSha256 !== planned.trackedFilesSha256) fail(`generation repository provenance mismatch: ${planned.id}`, "output.validation");
	}
	const artifactNames = new Set();
	for (const record of artifactRecords) {
		if (typeof record.artifact !== "string" || !record.artifact.startsWith("artifacts/") || artifactNames.has(record.artifact)) fail("invalid or duplicate artifact record", "output.validation");
		artifactNames.add(record.artifact);
		const artifactPath = resolveContained(generationPath, record.artifact, "generated artifact");
		const artifactStat = fs.lstatSync(artifactPath);
		if (!artifactStat.isFile() || isReparsePoint(artifactStat) || artifactStat.nlink > 1) fail(`generated artifact is not uniquely identified: ${record.artifact}`, "output.validation");
		const artifactPathIdentity = fileIdentity(artifactStat, artifactPath, "generated artifact");
		if (record.outputIdentity !== artifactPathIdentity) fail(`generated artifact identity mismatch: ${record.artifact}`, "output.validation");
		const actualSha256 = hashFile(artifactPath);
		const actualSha512 = hashFile(artifactPath, "sha512");
		if (record.sha256 !== actualSha256 || record.sha512 !== actualSha512 || record.tarballIntegrity !== `sha512-${hashFile(artifactPath, "sha512", "base64")}`) fail(`artifact checksum mismatch: ${record.artifact}`, "output.validation");
	}
	const expectedArtifacts = Array.isArray(descriptor.expectedArtifacts) ? descriptor.expectedArtifacts : [];
	const expectedByName = new Map(expectedArtifacts.map((entry) => [`artifacts/${entry.expectedName}`, entry]));
	if (expectedByName.size !== expectedArtifacts.length || expectedByName.size !== artifactRecords.length) fail("generation expected artifact set mismatch", "output.validation");
	for (const record of artifactRecords) {
		const expectedArtifact = expectedByName.get(record.artifact);
		const plannedRepository = plannedRepositories.find((entry) => entry.id === record.repository);
		const expectedSourcePath = expectedArtifact && path.resolve(expectedArtifact.repositoryPath, expectedArtifact.artifactDirectory, expectedArtifact.expectedName);
		if (
			!expectedArtifact ||
			!plannedRepository ||
			expectedArtifact.package !== record.package ||
			expectedArtifact.repository !== record.repository ||
			expectedArtifact.version !== record.version ||
			expectedArtifact.sourceDirectory !== record.sourceDirectory ||
			expectedArtifact.artifactDirectory !== record.artifactDirectory ||
			expectedArtifact.expectedName !== record.expectedName ||
			expectedArtifact.pattern !== record.pattern ||
			!samePath(expectedArtifact.repositoryPath, record.repositoryPath) ||
			!samePath(expectedSourcePath, record.sourcePath) ||
			!samePath(expectedArtifact.sourcePath, record.sourcePath) ||
			!samePath(record.repositoryPath, plannedRepository.realPath) ||
			record.branch !== plannedRepository.branch ||
			record.commit !== plannedRepository.commit ||
			typeof record.sourceIdentity !== "string" ||
			typeof record.sourceProof !== "object" ||
			record.sourceProof.identity !== record.sourceIdentity ||
			record.sourceProof.size !== record.sourceSize ||
			record.sourceProof.sha256 !== record.sourceSha256 ||
			record.sourceProof.sha512 !== record.sourceSha512 ||
			record.sourceProof.sha256 !== record.sha256 ||
			record.sourceProof.sha512 !== record.sha512
		) fail(`generation artifact provenance mismatch: ${record.artifact}`, "output.validation");
	}
	const actualArtifactFiles = fs.readdirSync(path.join(generationPath, "artifacts")).map((name) => `artifacts/${name}`).sort();
	if (!sameRecords(actualArtifactFiles, [...artifactNames].sort())) fail("generated artifact set does not match provenance", "output.validation");
	const checksumRecords = [...artifactRecords].sort((left, right) => left.artifact.localeCompare(right.artifact));
	const expectedSha256 = checksumRecords.map((record) => `${record.sha256}  ${record.artifact}\n`).join("");
	const expectedSha512 = checksumRecords.map((record) => `${record.sha512}  ${record.artifact}\n`).join("");
	if (fs.readFileSync(path.join(generationPath, "checksums.sha256"), "utf8") !== expectedSha256 || fs.readFileSync(path.join(generationPath, "checksums.sha512"), "utf8") !== expectedSha512) fail("generated checksums do not match provenance", "output.validation");
	return { descriptor, result, provenance, marker, manifest, treeSha256 };
}

function reconcileState(plan, faultPlan, lock) {
	const { stateRoot } = plan;
	assertWorkspaceIdentity(plan.workspace, plan.workspaceRoot);
	const locksRoot = statePath(stateRoot, "locks", "locks root");
	const generationsRoot = statePath(stateRoot, "generations", "generations root");
	const candidatesRoot = statePath(stateRoot, "locks/candidates", "lock candidates");
	const activePath = statePath(stateRoot, "locks/active", "active lock");
	if (!fs.existsSync(activePath)) fail(`workspace lock disappeared before reconciliation: ${activePath}`, "lock");
	const activeDescriptor = readJson(path.join(activePath, "descriptor.json"), "active lock descriptor");
	if (!lock || !sameRecords(activeDescriptor, lock.descriptor)) fail(`workspace has a non-owning active lock: ${activePath}`, "lock");
	const lockEntries = directoryEntries(locksRoot);
	for (const entry of lockEntries) {
		if (["candidates", "release-receipts", "released"].includes(entry.name)) continue;
		if (entry.name === "active") continue;
		fail(`unclassifiable lock state: ${entry.name}`, "recovery");
	}
	for (const entry of directoryEntries(candidatesRoot)) {
		if (!entry.name.endsWith(".incomplete") || !entry.stat.isDirectory() || isReparsePoint(entry.stat)) fail(`unclassifiable lock candidate: ${entry.name}`, "recovery");
			quarantinePath(stateRoot, entry.path, "abandoned-lock-candidate", faultPlan, "recovery.quarantine", { workspace: plan.workspace, workspaceRoot: plan.workspaceRoot, stateRootIdentity: plan.stateRootIdentity });
	}
	for (const entry of directoryEntries(generationsRoot)) {
		if (!/^[a-f0-9]{32}\.(?:incomplete|complete)$/u.test(entry.name) || !entry.stat.isDirectory() || isReparsePoint(entry.stat)) fail(`unclassifiable generation state: ${entry.name}`, "recovery");
		if (entry.name.endsWith(".incomplete")) {
			quarantinePath(stateRoot, entry.path, "abandoned-generation", faultPlan, "recovery.quarantine", { workspace: plan.workspace, workspaceRoot: plan.workspaceRoot, stateRootIdentity: plan.stateRootIdentity });
			continue;
		}
		try {
			validateGenerationAt(entry.path, { stateRoot, allowIncomplete: false });
		} catch (error) {
			let reported = error;
			try {
				quarantinePath(stateRoot, entry.path, "invalid-complete-generation", faultPlan, "recovery.quarantine", { workspace: plan.workspace, workspaceRoot: plan.workspaceRoot, stateRootIdentity: plan.stateRootIdentity });
			} catch (quarantineError) {
				reported = attachSecondaryFailure(reported, `quarantine invalid generation ${entry.path}`, quarantineError);
			}
			if (reported !== error || !fs.existsSync(entry.path)) {
				if (reported !== error) throw reported;
			}
		}
	}
}

function expectedNodeVersion(repository, repositoryDirectory) {
	const versionFile = repository.node?.versionFile;
	if (typeof versionFile === "string") {
		const versionPath = resolveContained(repositoryDirectory, versionFile, `${repository.id} Node version file`);
		if (fs.existsSync(versionPath)) return fs.readFileSync(versionPath, "utf8").trim();
	}
	return repository.node?.fallback?.version ?? null;
}

function sourceArtifactRecord(sourcePath, sourceProof, packageEntry, repositoryEntry, version, outputPath) {
	const outputStat = fs.lstatSync(outputPath);
	if (isReparsePoint(outputStat) || !outputStat.isFile()) fail(`artifact is not a regular file: ${sourcePath}`, "artifact.validation");
	const outputIdentity = fileIdentity(outputStat, outputPath, "generated artifact");
	return {
		package: packageEntry.name,
		version,
	repository: repositoryEntry.id,
	sourceDirectory: repositoryEntry.directory,
	artifactDirectory: packageEntry.artifact.directory,
	expectedName: expectedArtifactName(packageEntry.artifact, version),
	pattern: packageEntry.artifact.pattern,
	repositoryPath: repositoryEntry.snapshot.realPath,
	branch: repositoryEntry.snapshot.branch,
	commit: repositoryEntry.snapshot.commit,
	artifact: `artifacts/${path.basename(outputPath)}`,
	sourcePath: sourcePath,
	sourceIdentity: sourceProof.identity,
	sourceSize: sourceProof.size,
	sourceSha256: sourceProof.sha256,
	sourceSha512: sourceProof.sha512,
	sourceProof,
		outputIdentity,
		sha256: hashFile(outputPath),
		sha512: hashFile(outputPath, "sha512"),
		tarballIntegrity: `sha512-${hashFile(outputPath, "sha512", "base64")}`
	};
}

function buildGeneration(plan, generationPath, descriptor, initialStates, faultPlan) {
	const artifactOutput = path.join(generationPath, "artifacts");
	assertPipelineIdentity(plan);
	ensureDirectory(artifactOutput, "generation artifacts");
	const records = [];
	const repositoryRecords = [];
	const outputNames = new Set();
	const outputIdentities = new Set();
	for (const state of initialStates) {
		assertPipelineIdentity(plan);
		const repository = state.repository;
		const repositoryEntry = { ...state, ...repository, snapshot: state.snapshot };
		const packageEntries = packageOrder(repository);
		const buildStartedAt = Date.now();
		cleanMappedArtifacts(state.directory, packageEntries, faultPlan);
		state.buildStartedAt = buildStartedAt;
		let currentSnapshot = state.snapshot;
		let commandFailure;
		for (const command of repository.commands) {
			assertPipelineIdentity(plan);
			compareRepositorySnapshot(state.directory, repository, currentSnapshot, `before ${repository.id}/${command.phase}`);
			faultIfRequested(faultPlan, `repository[${repository.id}].command[${command.phase}].before`);
			const invocation = buildInvocation(launcherPath, state.directory, repository, command);
			process.stdout.write(`[local-packages] ${repository.id}: ${command.phase}\n`);
			try {
				runCommand(invocation.command, invocation.arguments, { cwd: projectRoot, phase: `repository[${repository.id}].command[${command.phase}]` });
			} catch (error) {
				commandFailure = error;
			}
			try {
				faultIfRequested(faultPlan, `repository[${repository.id}].post-command-snapshot`);
				assertPipelineIdentity(plan);
				currentSnapshot = compareRepositorySnapshot(state.directory, repository, currentSnapshot, `after ${repository.id}/${command.phase}`);
			} catch (invariantError) {
				if (commandFailure) attachSecondaryFailure(commandFailure, `repository invariant after ${repository.id}/${command.phase}`, invariantError);
				else commandFailure = invariantError;
			}
			if (commandFailure) throw commandFailure;
		}
		for (const packageEntry of packageEntries) {
			assertPipelineIdentity(plan);
			const version = state.packageVersions.get(packageEntry.name);
			const sourceArtifact = validateSourceArtifact(state.directory, packageEntry.artifact, version, state.buildStartedAt ?? 0);
			const name = path.basename(sourceArtifact);
			if (outputNames.has(name)) fail(`duplicate final artifact name: ${name}`, "artifact.validation");
			outputNames.add(name);
			// Revalidate identity and content immediately before copying. The proof is
			// retained in provenance and the copied bytes must match it exactly.
			const sourceProof = sourceArtifactProof(sourceArtifact);
			faultIfRequested(faultPlan, "artifact.copy");
			const outputPath = path.join(artifactOutput, name);
			fs.copyFileSync(sourceArtifact, outputPath, fs.constants.COPYFILE_EXCL);
			const outputStat = fs.lstatSync(outputPath);
			const outputIdentity = fileIdentity(outputStat, outputPath, "generated artifact");
			if (outputIdentities.has(outputIdentity)) fail(`duplicate generated artifact identity: ${outputPath}`, "artifact.validation");
			outputIdentities.add(outputIdentity);
			if (hashFile(outputPath) !== sourceProof.sha256 || hashFile(outputPath, "sha512") !== sourceProof.sha512 || outputStat.size !== sourceProof.size) fail(`source artifact content changed before copy: ${sourceArtifact}`, "artifact.validation");
			const afterCopySourceProof = sourceArtifactProof(sourceArtifact);
			if (!sameRecords(afterCopySourceProof, sourceProof)) fail(`source artifact changed after copy: ${sourceArtifact}`, "artifact.validation");
			records.push(sourceArtifactRecord(sourceArtifact, sourceProof, packageEntry, { ...repositoryEntry, snapshot: currentSnapshot }, version, outputPath));
		}
		const finalSnapshot = compareRepositorySnapshot(state.directory, repository, currentSnapshot, `final ${repository.id}`);
		assertPipelineIdentity(plan);
		repositoryRecords.push({
			repository: repository.id,
			realPath: state.directory,
			branch: finalSnapshot.branch,
			commit: finalSnapshot.commit,
			trackedStatus: finalSnapshot.trackedStatus,
			trackedFilesSha256: finalSnapshot.trackedFilesSha256,
			nodeVersion: expectedNodeVersion(repository, state.directory),
			commandSequence: repository.commands.map(({ phase, cwd, argv }) => ({ phase, cwd, argv }))
		});
	}
	const checksumRecords = [...records].sort((left, right) => left.artifact.localeCompare(right.artifact));
	const generatedAt = new Date().toISOString();
	const result = {
		schemaVersion: stateSchemaVersion,
		generationId: descriptor.generationId,
		workspace: descriptor.workspace,
		mapSha256: descriptor.mapSha256,
		generatedAt,
		repositories: repositoryRecords,
		artifacts: records,
		warnings: []
	};
	faultIfRequested(faultPlan, "result.write");
	assertPipelineIdentity(plan);
	writeAtomic(path.join(generationPath, resultName), stableJson(result));
	faultIfRequested(faultPlan, "checksums.write");
	assertPipelineIdentity(plan);
	writeAtomic(path.join(generationPath, "checksums.sha256"), checksumRecords.map((record) => `${record.sha256}  ${record.artifact}\n`).join(""));
	assertPipelineIdentity(plan);
	writeAtomic(path.join(generationPath, "checksums.sha512"), checksumRecords.map((record) => `${record.sha512}  ${record.artifact}\n`).join(""));
	faultIfRequested(faultPlan, "provenance.write");
	assertPipelineIdentity(plan);
	writeAtomic(path.join(generationPath, "provenance.json"), stableJson({
		schemaVersion: stateSchemaVersion,
		generationId: descriptor.generationId,
		workspace: descriptor.workspace,
		generatedAt,
		mapSha256: descriptor.mapSha256,
		repositories: repositoryRecords,
		artifacts: records
	}));
	const entries = collectTreeFiles(generationPath);
	const treeSha256 = computeTreeDigest(entries);
	faultIfRequested(faultPlan, "marker.write");
	assertPipelineIdentity(plan);
	writeAtomic(path.join(generationPath, treeManifestName), stableJson({ ...treeManifestCore(entries), treeSha256 }));
	assertPipelineIdentity(plan);
	writeAtomic(path.join(generationPath, completionMarkerName), stableJson({
		schemaVersion: stateSchemaVersion,
		generationId: descriptor.generationId,
		workspace: descriptor.workspace,
		state: "PUBLISH-READY",
		treeSha256,
		descriptorSha256: hashFile(path.join(generationPath, descriptorName)),
		resultSha256: hashFile(path.join(generationPath, resultName)),
		createdAt: new Date().toISOString()
	}));
	validateGenerationAt(generationPath, { generationId: descriptor.generationId, allowIncomplete: true });
	return { descriptor, result, treeSha256, records, repositoryRecords };
}

function normalizeReturnedDescriptor(plan, generationPath, built) {
	const descriptor = {
		schemaVersion: stateSchemaVersion,
		workspace: plan.workspace,
		generationId: built.descriptor.generationId,
		generationPath,
		treeSha256: built.treeSha256,
		artifacts: built.records.map((record) => ({ path: record.artifact, sha256: record.sha256, sha512: record.sha512 })),
		repositories: built.repositoryRecords.map((record) => ({
			id: record.repository,
			realPath: record.realPath,
			branch: record.branch,
			commit: record.commit,
			trackedStatus: record.trackedStatus,
			trackedFilesSha256: record.trackedFilesSha256
		})),
		warnings: built.result.warnings ?? []
	};
	return freezeDescriptor(descriptor);
}

function freezeDescriptor(value) {
	if (value && typeof value === "object" && !Object.isFrozen(value)) {
		for (const child of Object.values(value)) freezeDescriptor(child);
		Object.freeze(value);
	}
	return value;
}

function createGenerationCandidate(plan, initialStates, faultPlan) {
	const generationsRoot = statePath(plan.stateRoot, "generations", "generations root");
	const generationId = randomToken(16);
	const incompletePath = path.join(generationsRoot, `${generationId}.incomplete`);
	const completePath = path.join(generationsRoot, `${generationId}.complete`);
	if (fs.existsSync(incompletePath) || fs.existsSync(completePath)) fail(`generation id collision: ${generationId}`, "generation");
	faultIfRequested(faultPlan, "generation.create");
	ensureDirectory(incompletePath, "generation candidate");
	const descriptor = generationDescriptor(plan, generationId, initialStates);
	faultIfRequested(faultPlan, "descriptor.write");
	writeAtomic(path.join(incompletePath, descriptorName), stableJson(descriptor));
	const persisted = readJson(path.join(incompletePath, descriptorName), "generation descriptor");
	if (!sameRecords(persisted, descriptor)) fail("generation descriptor changed before production", "generation");
	return { generationId, incompletePath, completePath, descriptor };
}

function liveProcessPids() {
	if (process.platform !== "linux") fail("process-tree enumeration is unavailable on this platform; break-glass recovery is refused", "break-glass");
	const pids = [];
	for (const name of fs.readdirSync("/proc")) {
		if (!/^\d+$/u.test(name)) continue;
		try {
			const stat = fs.readFileSync(`/proc/${name}/stat`, "utf8");
			const after = stat.slice(stat.lastIndexOf(")") + 2).trim().split(/\s+/u);
			pids.push({ pid: Number(name), parentPid: Number(after[1]), startToken: after[19] ?? null });
		} catch {
			// A process can exit between enumeration and reading its stat; omit only that exited process.
		}
	}
	return pids;
}

export function breakGlassActiveLock(stateRoot) {
	const root = path.resolve(stateRoot);
	ensureStateLayout(root);
	const activePath = statePath(root, "locks/active", "active lock");
	if (!fs.existsSync(activePath)) fail(`no active lock exists: ${activePath}`, "break-glass");
	const descriptor = readJson(path.join(activePath, "descriptor.json"), "active lock descriptor");
	const expectedWorkspace = descriptor.workspace?.realPath;
	if (typeof expectedWorkspace !== "string") fail("active lock has no canonical workspace identity", "break-glass");
	assertWorkspaceIdentity(descriptor.workspace, expectedWorkspace);
	const processes = liveProcessPids();
	const owner = processes.find((entry) => entry.pid === descriptor.owner?.pid);
	if (owner && descriptor.owner.processStartToken !== owner.startToken) fail("active lock owner PID was reused; break-glass recovery is refused", "break-glass");
	const descendants = new Set([descriptor.owner?.pid]);
	let changed = true;
	while (changed) {
		changed = false;
		for (const entry of processes) if (descendants.has(entry.parentPid) && !descendants.has(entry.pid)) {
			descendants.add(entry.pid);
			changed = true;
		}
	}
	if (descendants.size > (owner ? 0 : 1)) fail("active lock owner or a recorded descendant is still alive; break-glass recovery is refused", "break-glass");
	const destination = quarantinePath(root, activePath, "break-glass-active-lock", undefined, "break-glass.rename", {
		workspace: descriptor.workspace,
		workspaceRoot: descriptor.workspace.realPath,
		stateRootIdentity: descriptor.stateRoot
	});
	writeAtomic(path.join(destination, "break-glass-evidence.json"), stableJson({
		schemaVersion: lockSchemaVersion,
		lockId: descriptor.lockId,
		workspace: descriptor.workspace,
		owner: descriptor.owner,
		enumeratedAt: new Date().toISOString(),
		processes
	}));
	return destination;
}

function runPipelineInternal(planInput, options = {}) {
	const plan = normalizePlan(planInput);
	assertWorkspaceIdentity(plan.workspace, plan.workspaceRoot);
	assertPipelineIdentity(plan);
	ensureStateLayout(plan.stateRoot);
	assertPipelineIdentity(plan);
	const faultPlan = options.faultPlan ?? plan.faultPlan;
	let lock;
	let candidate;
	let completePath;
	let result;
	let primaryError;
	try {
		lock = acquireWorkspaceLock(plan.stateRoot, plan, faultPlan);
		assertPipelineIdentity(plan);
		reconcileState(plan, faultPlan, lock);
		assertWorkspaceIdentity(plan.workspace, plan.workspaceRoot);
		const initialStates = plan.repositories.map((repository) => initialRepositoryState(repository, plan, faultPlan));
		candidate = createGenerationCandidate(plan, initialStates, faultPlan);
		const built = buildGeneration(plan, candidate.incompletePath, candidate.descriptor, initialStates, faultPlan);
		faultIfRequested(faultPlan, "publish.rename");
		const publishRename = assertRenamePaths(plan.stateRoot, candidate.incompletePath, candidate.completePath, {
			workspace: plan.workspace,
			workspaceRoot: plan.workspaceRoot,
			stateRootIdentity: plan.stateRootIdentity,
			sourceSuffix: ".incomplete",
			destinationSuffix: ".complete",
			destinationAbsent: true
		});
		renameWithWindowsRetry(publishRename.source, publishRename.destination);
		completePath = candidate.completePath;
		candidate = undefined;
		faultIfRequested(faultPlan, "publish.post-rename-validation");
		const validated = validateGenerationAt(completePath, { generationId: built.descriptor.generationId, stateRoot: plan.stateRoot, workspace: plan.workspace });
		assertPipelineIdentity(plan);
		result = normalizeReturnedDescriptor(plan, completePath, {
			...built,
			treeSha256: validated.treeSha256
		});
	} catch (error) {
		primaryError = asError(error);
		const pathsToQuarantine = [];
		if (candidate?.incompletePath && fs.existsSync(candidate.incompletePath)) pathsToQuarantine.push([candidate.incompletePath, "failed-generation"]);
		if (completePath && fs.existsSync(completePath)) pathsToQuarantine.push([completePath, "invalid-complete-generation"]);
		for (const [source, state] of pathsToQuarantine) {
			try {
				quarantinePath(plan.stateRoot, source, state, faultPlan, "failure.quarantine", {
					workspace: plan.workspace,
					workspaceRoot: plan.workspaceRoot,
					stateRootIdentity: plan.stateRootIdentity
				});
			} catch (quarantineError) {
				primaryError = attachSecondaryFailure(primaryError, `quarantine ${source}`, quarantineError);
			}
		}
	} finally {
		if (lock) {
			try {
				releaseWorkspaceLock(lock, faultPlan);
			} catch (releaseError) {
				if (primaryError) primaryError = attachSecondaryFailure(primaryError, "release workspace lock", releaseError);
				else primaryError = asError(releaseError, "lock.release");
			}
		}
	}
	if (primaryError) throw primaryError;
	return result;
}

export function runPipeline(input, options = {}) {
	if (typeof input === "string") {
		const workspaceRoot = path.resolve(input);
		const map = JSON.parse(fs.readFileSync(defaultMapPath, "utf8"));
		validateMap(map, workspaceRoot);
		return runPipelineInternal(planFromMap(map, workspaceRoot, path.join(workspaceRoot, "tmp", stateDirectoryName)), options);
	}
	if (input?.plan) return runPipelineInternal(input.plan, { ...options, faultPlan: input.faultPlan ?? options.faultPlan });
	return runPipelineInternal(input, options);
}

function parseArguments(arguments_, map) {
	const result = { workspaceRoot: defaultWorkspaceRoot(map), breakGlass: false };
	for (let index = 0; index < arguments_.length; index += 1) {
		const argument = arguments_[index];
		if (argument === "--break-glass") {
			result.breakGlass = true;
			continue;
		}
		if (argument === "--workspace-root" && arguments_[index + 1]) {
			result.workspaceRoot = path.resolve(arguments_[index + 1]);
			index += 1;
			continue;
		}
		fail(`unknown or incomplete argument: ${argument}`, "cli");
	}
	return result;
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
	try {
		const map = JSON.parse(fs.readFileSync(defaultMapPath, "utf8"));
		const arguments_ = parseArguments(process.argv.slice(2), map);
		if (arguments_.breakGlass) {
			const destination = breakGlassActiveLock(path.join(arguments_.workspaceRoot, "tmp", stateDirectoryName));
			process.stdout.write(`Quarantined active lock at ${destination}\n`);
		} else {
			const descriptor = runPipeline(arguments_.workspaceRoot);
			process.stdout.write(`Built ${descriptor.artifacts.length} local package tarballs in ${descriptor.generationPath}\n`);
		}
	} catch (error) {
		process.stderr.write(`Error: ${formatPipelineError(error)}\n`);
		process.exitCode = 1;
	}
}
