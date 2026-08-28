import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, test } from "node:test";
import { fileURLToPath } from "node:url";

import {
	formatPipelineError,
	repositorySnapshotForTest,
	resolveContained,
	runPipeline,
	validateSourceArtifact
} from "./build-local-packages.mjs";

process.env.STARK_LOCAL_PACKAGE_TEST_MODE = "1";
const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, "..");
const testRoot = fs.mkdtempSync(path.join(os.tmpdir(), "stark-source-containment-"));
const nodeVersion = fs.readFileSync(path.join(projectRoot, ".nvmrc"), "utf8").trim();

after(() => fs.rmSync(testRoot, { recursive: true, force: true }));

function uniquePath(name) {
	return path.join(testRoot, `${name}-${Date.now()}-${Math.random().toString(16).slice(2)}`);
}

function run(command, arguments_, cwd) {
	const result = spawnSync(command, arguments_, { cwd, encoding: "utf8" });
	if (result.status !== 0) throw new Error(`${command} ${arguments_.join(" ")} failed: ${result.stderr}`);
	return result.stdout.trim();
}

function currentRuntimeEvidence() {
	return {
		nodeVersion: process.env.STARK_PROJECT_NODE_VERSION,
		npmVersion: process.env.STARK_PROJECT_NPM_VERSION,
		nodeExecutable: process.env.STARK_PROJECT_NODE_EXECUTABLE,
		npmExecutable: process.env.STARK_PROJECT_NPM_EXECUTABLE
	};
}

function repositoryFixture(name) {
	const workspaceRoot = uniquePath(name);
	const repositoryDirectory = path.join(workspaceRoot, "fixture-repository");
	fs.mkdirSync(repositoryDirectory, { recursive: true });
	fs.writeFileSync(path.join(repositoryDirectory, ".nvmrc"), `${nodeVersion}\n`);
	fs.writeFileSync(path.join(repositoryDirectory, "package.json"), `${JSON.stringify({ name: "@fixture/package", version: "1.0.0" }, null, 2)}\n`);
	fs.writeFileSync(path.join(repositoryDirectory, "tracked.txt"), "tracked baseline\n");
	fs.writeFileSync(path.join(repositoryDirectory, "tracked-link"), "tracked.txt");
	fs.writeFileSync(path.join(repositoryDirectory, "build.mjs"), [
		'import { execFileSync } from "node:child_process";',
		'import fs from "node:fs";',
		'const mode = fs.existsSync("mode.txt") ? fs.readFileSync("mode.txt", "utf8").trim() : "none";',
		'fs.writeFileSync("producer-ran.txt", "ran\\n");',
		'if (mode === "dirty-success" || mode === "status") fs.appendFileSync("tracked.txt", "mutation\\n");',
		'if (mode === "branch") execFileSync("git", ["checkout", "--quiet", "-b", "containment-mutated"]);',
		'if (mode === "head") { fs.appendFileSync("tracked.txt", "committed mutation\\n"); execFileSync("git", ["add", "tracked.txt"]); execFileSync("git", ["commit", "--quiet", "-m", "mutated head"]); }',
		'if (mode === "tracked-path") { fs.writeFileSync("new-tracked.txt", "new tracked path\\n"); execFileSync("git", ["add", "new-tracked.txt"]); }',
		'if (mode === "mode") execFileSync("git", ["update-index", "--chmod=+x", "tracked.txt"]);',
		'if (mode === "identity") { const contents = fs.readFileSync("tracked.txt"); fs.renameSync("tracked.txt", "identity-original.tmp"); fs.writeFileSync("tracked.txt", contents); }',
		'fs.mkdirSync("dist", { recursive: true });',
		'fs.writeFileSync("dist/fixture-package-1.0.0.tgz", "fixture artifact\\n");'
	].join("\n"));
	run("git", ["init", "--quiet"], repositoryDirectory);
	run("git", ["config", "user.name", "fixture"], repositoryDirectory);
	run("git", ["config", "user.email", "fixture@example.test"], repositoryDirectory);
	run("git", ["config", "core.autocrlf", "false"], repositoryDirectory);
	run("git", ["add", ".nvmrc", "package.json", "tracked.txt", "tracked-link", "build.mjs"], repositoryDirectory);
	run("git", ["commit", "--quiet", "-m", "fixture"], repositoryDirectory);
	return {
		workspaceRoot,
		repositoryDirectory,
		stateRoot: path.join(workspaceRoot, "tmp", "local-package-state"),
		plan: {
			workspaceRoot,
			stateRoot: "tmp/local-package-state",
			repositories: [{
				id: "fixture",
				directory: "fixture-repository",
				node: { versionFile: ".nvmrc", required: true, requirement: nodeVersion },
				commands: [{ phase: "build-and-pack", cwd: ".", argv: ["node", "build.mjs"] }],
				packages: [{
					name: "@fixture/package",
					manifest: "package.json",
					dependencies: [],
					buildOrder: 0,
					artifact: {
						directory: "dist",
						pattern: "fixture-package-*.tgz",
						expectedName: "fixture-package-{packageVersion}.tgz"
					}
				}]
			}]
		}
	};
}

function runFixture(fixture) {
	return runPipeline(fixture.plan, { runtimeProbe: currentRuntimeEvidence });
}

function capturePipelineFailure(fixture) {
	let error;
	assert.throws(() => runFixture(fixture), (caught) => {
		error = caught;
		return true;
	});
	return error;
}

function assertSuccessfulMutationRejected(fixture, expectedDifference) {
	const error = capturePipelineFailure(fixture);
	assert.equal(error.phase, "repository.invariant");
	assert.match(error.message, /after fixture\/build-and-pack: sibling repository invariants changed/u);
	assert.equal(error.differences.includes(expectedDifference), true, formatPipelineError(error));
	assert.equal(fs.existsSync(path.join(fixture.repositoryDirectory, "producer-ran.txt")), true);
	assert.equal(fs.existsSync(path.join(fixture.stateRoot, "locks", "active")), false);
	assert.equal(fs.readdirSync(path.join(fixture.stateRoot, "generations")).some((name) => name.endsWith(".complete")), false);
	assert.equal(fs.readdirSync(path.join(fixture.stateRoot, "quarantine")).some((name) => name.includes("failed-generation")), true);
}

function assertSnapshotMutationRejected(fixture, mode, expectedDifference) {
	const repository = fixture.plan.repositories[0];
	const before = repositorySnapshotForTest(fixture.repositoryDirectory, repository);
	fs.writeFileSync(path.join(fixture.repositoryDirectory, "mode.txt"), `${mode}\n`);
	const command = spawnSync(process.execPath, ["build.mjs"], { cwd: fixture.repositoryDirectory, encoding: "utf8" });
	assert.equal(command.status, 0, command.stderr);
	assert.throws(
		() => repositorySnapshotForTest(fixture.repositoryDirectory, repository, before, `after fixture/${mode}`),
		(error) => error.phase === "repository.invariant"
			&& error.differences.includes(expectedDifference)
			&& error.message.startsWith(`after fixture/${mode}: sibling repository invariants changed`)
	);
}

test("repository snapshot seam is unavailable outside explicit test mode", () => {
	const previous = process.env.STARK_LOCAL_PACKAGE_TEST_MODE;
	delete process.env.STARK_LOCAL_PACKAGE_TEST_MODE;
	try {
		assert.throws(() => repositorySnapshotForTest("unused", {}, undefined), /available only in test mode/u);
	} finally {
		if (previous === undefined) delete process.env.STARK_LOCAL_PACKAGE_TEST_MODE;
		else process.env.STARK_LOCAL_PACKAGE_TEST_MODE = previous;
	}
});

function artifactFixture(name) {
	const repositoryDirectory = uniquePath(name);
	const directory = path.join(repositoryDirectory, "dist");
	fs.mkdirSync(directory, { recursive: true });
	return {
		repositoryDirectory,
		directory,
		artifact: {
			directory: "dist",
			pattern: "fixture-package-*.tgz",
			expectedName: "fixture-package-{packageVersion}.tgz"
		},
		version: "1.2.3",
		buildStartedAt: Date.now()
	};
}

function validateArtifact(fixture) {
	return validateSourceArtifact(fixture.repositoryDirectory, fixture.artifact, fixture.version, fixture.buildStartedAt);
}

test("source artifact validation rejects a missing tarball", () => {
	const fixture = artifactFixture("artifact-missing");
	assert.throws(() => validateArtifact(fixture), /missing expected artifact/u);
});

test("source artifact validation rejects duplicate matching tarballs", () => {
	const fixture = artifactFixture("artifact-duplicate");
	fs.writeFileSync(path.join(fixture.directory, "fixture-package-1.2.3.tgz"), "expected");
	fs.writeFileSync(path.join(fixture.directory, "fixture-package-duplicate.tgz"), "duplicate");
	assert.throws(() => validateArtifact(fixture), /expected exactly one artifact.*found 2/u);
});

test("source artifact validation rejects a stale tarball", () => {
	const fixture = artifactFixture("artifact-stale");
	const artifactPath = path.join(fixture.directory, "fixture-package-1.2.3.tgz");
	fs.writeFileSync(artifactPath, "stale");
	const staleTime = new Date(fixture.buildStartedAt - 10_000);
	fs.utimesSync(artifactPath, staleTime, staleTime);
	assert.throws(() => validateArtifact(fixture), /stale artifact predates the build/u);
});

test("source artifact validation rejects an unexpected tarball", () => {
	const fixture = artifactFixture("artifact-unexpected");
	fs.writeFileSync(path.join(fixture.directory, "fixture-package-1.2.3.tgz"), "expected");
	fs.writeFileSync(path.join(fixture.directory, "unmapped-package-1.0.0.tgz"), "unexpected");
	assert.throws(() => validateArtifact(fixture), /unexpected tarball output/u);
});

test("source artifact validation rejects a wrong-version tarball", () => {
	const fixture = artifactFixture("artifact-wrong-version");
	fs.writeFileSync(path.join(fixture.directory, "fixture-package-9.9.9.tgz"), "wrong version");
	assert.throws(() => validateArtifact(fixture), /unexpected artifact.*expected fixture-package-1\.2\.3\.tgz/u);
});

test("source artifact validation rejects a symbolic-link or junction tarball", () => {
	const fixture = artifactFixture("artifact-symlink");
	const target = path.join(fixture.directory, "target.bin");
	fs.writeFileSync(target, "linked bytes");
	try {
		fs.symlinkSync(target, path.join(fixture.directory, "fixture-package-1.2.3.tgz"), "file");
	} catch (error) {
		if (process.platform === "win32" && ["EPERM", "EACCES"].includes(error?.code)) {
			fs.unlinkSync(target);
			fs.mkdirSync(target);
			fs.symlinkSync(target, path.join(fixture.directory, "fixture-package-1.2.3.tgz"), "junction");
		} else {
			throw error;
		}
	}
	assert.throws(() => validateArtifact(fixture), /artifact must be a unique regular file/u);
});

test("source artifact validation rejects a hard-linked tarball", () => {
	const fixture = artifactFixture("artifact-hard-link");
	const target = path.join(fixture.directory, "target.bin");
	fs.writeFileSync(target, "hard-linked bytes");
	fs.linkSync(target, path.join(fixture.directory, "fixture-package-1.2.3.tgz"));
	assert.throws(() => validateArtifact(fixture), /artifact must be a unique regular file/u);
});

test("source artifact validation rejects a junction or reparse artifact directory", () => {
	const fixture = artifactFixture("artifact-junction");
	const outside = uniquePath("artifact-junction-target");
	fs.mkdirSync(outside, { recursive: true });
	fs.rmSync(fixture.directory, { recursive: true });
	fs.symlinkSync(outside, fixture.directory, process.platform === "win32" ? "junction" : "dir");
	assert.throws(() => validateArtifact(fixture), /symbolic link|reparse/u);
});

test("path containment rejects an empty relative path", () => {
	const base = uniquePath("lexical-empty");
	fs.mkdirSync(base);
	assert.throws(() => resolveContained(base, "", "test path"), /non-empty relative path/u);
});

test("path containment rejects control characters", () => {
	const base = uniquePath("lexical-control");
	fs.mkdirSync(base);
	assert.throws(() => resolveContained(base, "safe/\u0001unsafe", "test path"), /control character/u);
});

test("path containment rejects trailing dots and spaces", () => {
	const base = uniquePath("lexical-trailing");
	fs.mkdirSync(base);
	assert.throws(() => resolveContained(base, "unsafe.", "test path"), /trailing dot or space/u);
	assert.throws(() => resolveContained(base, "unsafe ", "test path"), /trailing dot or space/u);
});

test("path containment rejects drive-relative paths", () => {
	const base = uniquePath("lexical-drive-relative");
	fs.mkdirSync(base);
	assert.throws(() => resolveContained(base, "C:relative\\artifact.tgz", "test path"), /drive-relative/u);
});

test("Windows case-folded contained paths remain inside their canonical base", { skip: process.platform !== "win32" }, () => {
	const base = uniquePath("CaseFoldedBase");
	fs.mkdirSync(path.join(base, "Child"), { recursive: true });
	const resolved = resolveContained(base.toUpperCase(), "child", "case-folded child", { platform: "win32" });
	assert.equal(fs.realpathSync(resolved).toLowerCase(), fs.realpathSync(path.join(base, "Child")).toLowerCase());
});

test("path containment rejects a filesystem alias used as its trusted base", () => {
	const realBase = uniquePath("alias-real-base");
	const aliasBase = uniquePath("alias-base");
	fs.mkdirSync(realBase, { recursive: true });
	fs.symlinkSync(realBase, aliasBase, process.platform === "win32" ? "junction" : "dir");
	assert.throws(() => resolveContained(aliasBase, ".", "aliased base", { allowDot: true }), /symbolic link|reparse/u);
});

test("an initially dirty tracked file changed by a successful command is rejected", () => {
	const fixture = repositoryFixture("dirty-success");
	fs.appendFileSync(path.join(fixture.repositoryDirectory, "tracked.txt"), "initial dirty bytes\n");
	fs.writeFileSync(path.join(fixture.repositoryDirectory, "mode.txt"), "dirty-success\n");
	assertSuccessfulMutationRejected(fixture, "trackedFiles");
});

test("a successful command that changes the repository branch is rejected", () => {
	const fixture = repositoryFixture("mutation-branch");
	assertSnapshotMutationRejected(fixture, "branch", "branch");
});

test("a successful command that changes HEAD is rejected", () => {
	const fixture = repositoryFixture("mutation-head");
	assertSnapshotMutationRejected(fixture, "head", "commit");
});

test("a successful command that changes tracked status is rejected", () => {
	const fixture = repositoryFixture("mutation-status");
	assertSnapshotMutationRejected(fixture, "status", "trackedStatus");
});

test("a successful command that changes the tracked path set is rejected", () => {
	const fixture = repositoryFixture("mutation-path-set");
	assertSnapshotMutationRejected(fixture, "tracked-path", "trackedPaths");
});

test("a successful command that changes a tracked mode is rejected", () => {
	const fixture = repositoryFixture("mutation-mode");
	assertSnapshotMutationRejected(fixture, "mode", "trackedFiles");
});

test("a successful command that replaces a tracked file identity is rejected", () => {
	const fixture = repositoryFixture("mutation-file-identity");
	assertSnapshotMutationRejected(fixture, "identity", "trackedFiles");
});

test("repository snapshot rejects hard-linked tracked files", () => {
	const fixture = repositoryFixture("tracked-duplicate-identity");
	fs.linkSync(path.join(fixture.repositoryDirectory, "tracked.txt"), path.join(fixture.repositoryDirectory, "duplicate.txt"));
	run("git", ["add", "duplicate.txt"], fixture.repositoryDirectory);
	run("git", ["commit", "--quiet", "-m", "hard-linked tracked entry"], fixture.repositoryDirectory);
	assert.throws(
		() => repositorySnapshotForTest(fixture.repositoryDirectory, fixture.plan.repositories[0]),
		/tracked path is hard-linked and cannot be authenticated/u
	);
	assert.equal(fs.existsSync(path.join(fixture.repositoryDirectory, "producer-ran.txt")), false);
});

test("repository snapshot rejects duplicate tracked file identities when link counts are unreliable", () => {
	const fixture = repositoryFixture("tracked-duplicate-reported-identity");
	const trackedPaths = new Set([
		path.resolve(fixture.repositoryDirectory, "tracked.txt"),
		path.resolve(fixture.repositoryDirectory, "tracked-link")
	]);
	const originalLstatSync = fs.lstatSync;
	fs.lstatSync = (filePath, ...arguments_) => {
		const stat = originalLstatSync(filePath, ...arguments_);
		if (trackedPaths.has(path.resolve(filePath))) {
			Object.defineProperties(stat, {
				dev: { value: 777, configurable: true },
				ino: { value: 888, configurable: true },
				nlink: { value: 1, configurable: true }
			});
		}
		return stat;
	};
	try {
		assert.throws(
			() => repositorySnapshotForTest(fixture.repositoryDirectory, fixture.plan.repositories[0]),
			/duplicate tracked file identity/u
		);
	} finally {
		fs.lstatSync = originalLstatSync;
	}
});

test("repository snapshot rejects a Git symlink entry even when the checkout exposes a regular file", () => {
	const fixture = repositoryFixture("tracked-symlink-mode");
	const object = run("git", ["hash-object", "-w", "tracked-link"], fixture.repositoryDirectory);
	run("git", ["update-index", "--add", "--cacheinfo", "120000", object, "tracked-link"], fixture.repositoryDirectory);
	run("git", ["commit", "--quiet", "-m", "tracked symbolic link"], fixture.repositoryDirectory);
	assert.throws(
		() => repositorySnapshotForTest(fixture.repositoryDirectory, fixture.plan.repositories[0]),
		/tracked path is not a regular file|tracked path has unsupported Git mode/u
	);
	assert.equal(fs.existsSync(path.join(fixture.repositoryDirectory, "producer-ran.txt")), false);
});

test("recovery refuses a replacement source before a Windows rename retry", { skip: process.platform !== "win32" }, () => {
	const fixture = repositoryFixture("recovery-source-replacement");
	// If vulnerable recovery proceeds, fail immediately instead of starting a producer.
	fixture.plan.repositories[0].directory = "missing-repository";
	const generationId = "0123456789abcdef0123456789abcdef";
	const abandoned = path.join(fixture.stateRoot, "generations", `${generationId}.incomplete`);
	const originalEvidence = path.join(fixture.stateRoot, "generations", `${generationId}.preserved-original`);
	fs.mkdirSync(abandoned, { recursive: true });
	fs.writeFileSync(path.join(abandoned, "descriptor.json"), "original abandoned evidence\n");
	const originalRenameSync = fs.renameSync;
	let replacementInjected = false;
	fs.renameSync = (source, destination) => {
		if (!replacementInjected && path.resolve(source) === path.resolve(abandoned)) {
			replacementInjected = true;
			originalRenameSync(source, originalEvidence);
			fs.mkdirSync(source);
			fs.writeFileSync(path.join(source, "attacker.txt"), "replacement\n");
			const error = new Error("transient recovery contention");
			error.code = "EBUSY";
			throw error;
		}
		return originalRenameSync(source, destination);
	};
	let error;
	try {
		error = capturePipelineFailure(fixture);
	} finally {
		fs.renameSync = originalRenameSync;
	}
	assert.equal(replacementInjected, true);
	assert.equal(error.phase, "recovery");
	assert.match(error.message, /could not quarantine.*rename source identity changed/u);
	assert.equal(fs.existsSync(path.join(fixture.repositoryDirectory, "producer-ran.txt")), false);
	assert.equal(fs.readFileSync(path.join(originalEvidence, "descriptor.json"), "utf8"), "original abandoned evidence\n");
	assert.equal(fs.readFileSync(path.join(abandoned, "attacker.txt"), "utf8"), "replacement\n");
});
