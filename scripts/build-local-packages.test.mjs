import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, beforeEach, test } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
	breakGlassActiveLock,
	formatPipelineError,
	renameWithWindowsRetry,
	resolveContained,
	runPipeline,
	writeAtomic,
	validateGenerationAt
} from "./build-local-packages.mjs";

process.env.STARK_LOCAL_PACKAGE_TEST_MODE = "1";
const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, "..");
const testRoot = fs.mkdtempSync(path.join(os.tmpdir(), "stark-local-package-state-"));
const nodeVersion = fs.readFileSync(path.join(projectRoot, ".nvmrc"), "utf8").trim();

function run(command, arguments_, cwd) {
	const result = spawnSync(command, arguments_, { cwd, encoding: "utf8" });
	if (result.status !== 0) throw new Error(`${command} ${arguments_.join(" ")} failed: ${result.stderr}`);
}

function createFixture(name = "fixture", options = {}) {
	const workspaceRoot = path.join(testRoot, `${name}-${Date.now()}-${Math.random().toString(16).slice(2)}`);
	const repositoryDirectory = path.join(workspaceRoot, "fixture-repository");
	const producerSentinel = options.producerSentinel === true ? 'fs.writeFileSync("producer-ran.txt", "ran\\n");\n' : "";
	fs.mkdirSync(repositoryDirectory, { recursive: true });
	fs.writeFileSync(path.join(repositoryDirectory, ".nvmrc"), `${nodeVersion}\n`);
	fs.writeFileSync(path.join(repositoryDirectory, "package.json"), JSON.stringify({ name: "@fixture/package", version: "1.0.0" }, null, 2) + "\n");
	fs.writeFileSync(
		path.join(repositoryDirectory, "build.mjs"),
		`import fs from "node:fs";\nconst mode = fs.existsSync("mode.txt") ? fs.readFileSync("mode.txt", "utf8").trim() : "success";\n${producerSentinel}if (mode === "mutate-fail") { fs.appendFileSync("package.json", " "); process.exit(17); }\nif (mode === "fail") process.exit(19);\nfs.mkdirSync("dist", { recursive: true });\nfs.writeFileSync("dist/fixture-package-1.0.0.tgz", Buffer.from("fixture-" + Date.now()));\n`
	);
	fs.writeFileSync(path.join(repositoryDirectory, "mode.txt"), "success\n");
	run("git", ["init", "--quiet"], repositoryDirectory);
	run("git", ["config", "user.name", "fixture"], repositoryDirectory);
	run("git", ["config", "user.email", "fixture@example.test"], repositoryDirectory);
	run("git", ["add", ".nvmrc", "package.json", "build.mjs"], repositoryDirectory);
	run("git", ["commit", "--quiet", "-m", "fixture"], repositoryDirectory);
	const plan = {
		workspaceRoot,
		stateRoot: "tmp/local-package-state",
		repositories: [
			{
				id: "fixture",
				directory: "fixture-repository",
				node: { versionFile: ".nvmrc", required: true, requirement: nodeVersion },
				commands: [{ phase: "build-and-pack", cwd: ".", argv: ["node", "build.mjs"] }],
				packages: [
					{
						name: "@fixture/package",
						manifest: "package.json",
						dependencies: [],
						buildOrder: 0,
						artifact: {
							directory: "dist",
							pattern: "fixture-package-*.tgz",
							expectedName: "fixture-package-{packageVersion}.tgz"
						}
					}
				]
			}
		]
	};
	return { workspaceRoot, repositoryDirectory, plan, stateRoot: path.join(workspaceRoot, "tmp", "local-package-state") };
}

function generationDirectories(fixture) {
	const root = path.join(fixture.stateRoot, "generations");
	return fs.existsSync(root) ? fs.readdirSync(root).map((name) => path.join(root, name)) : [];
}

function stateEntries(fixture, relativePath) {
	const directory = path.join(fixture.stateRoot, relativePath);
	return fs.existsSync(directory) ? fs.readdirSync(directory) : [];
}

function publishedGenerationPaths(fixture) {
	return generationDirectories(fixture).filter((directory) => directory.endsWith(".complete"));
}

function snapshotTree(directory) {
	const files = new Map();
	const visit = (current, relativeDirectory = "") => {
		for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
			const absolutePath = path.join(current, entry.name);
			const relativePath = relativeDirectory ? `${relativeDirectory}/${entry.name}` : entry.name;
			if (entry.isDirectory()) visit(absolutePath, relativePath);
			else files.set(relativePath, fs.readFileSync(absolutePath).toString("base64"));
		}
	};
	visit(directory);
	return [...files.entries()].sort(([left], [right]) => left.localeCompare(right));
}

function assertTreeSnapshot(directory, expected) {
	assert.deepEqual(snapshotTree(directory), expected);
}

function lockEvidenceEntries(fixture, kind) {
	return stateEntries(fixture, `locks/${kind}`).filter((name) => name.endsWith(".complete")).sort();
}

function assertLockEvidenceIsSelfIdentifying(fixture) {
	for (const name of lockEvidenceEntries(fixture, "release-receipts")) {
		const lockId = name.slice(0, -".complete".length);
		const receipt = JSON.parse(fs.readFileSync(path.join(fixture.stateRoot, "locks", "release-receipts", name), "utf8"));
		assert.equal(receipt.lockId, lockId, `${name}: release receipt lock identity`);
	}
	for (const name of lockEvidenceEntries(fixture, "released")) {
		const lockId = name.slice(0, -".complete".length);
		const descriptor = JSON.parse(fs.readFileSync(path.join(fixture.stateRoot, "locks", "released", name, "descriptor.json"), "utf8"));
		assert.equal(descriptor.lockId, lockId, `${name}: released lock identity`);
	}
}

function captureFault(fixture, failAt) {
	const operations = Array.isArray(failAt) ? failAt : [failAt];
	let error;
	assert.throws(
		() => runPipeline({ plan: fixture.plan, faultPlan: { failAt } }),
		(caught) => {
			error = caught;
			return true;
		},
		`fault plan unexpectedly completed: ${operations.join(", ")}`
	);
	const formatted = formatPipelineError(error);
	return { error, formatted };
}

function producerMarker(fixture) {
	return path.join(fixture.repositoryDirectory, "producer-ran.txt");
}

function childIdentityFiles(childrenRoot) {
	const names = fs.readdirSync(childrenRoot);
	return {
		record: path.join(childrenRoot, names.find((name) => /^[a-f0-9]{32}\.complete$/u.test(name))),
		proof: path.join(childrenRoot, names.find((name) => /^[a-f0-9]{32}\.proof\.complete$/u.test(name)))
	};
}

function runWithGenerationPublicationMutation(fixture, mutate) {
	const originalRenameSync = fs.renameSync;
	const generationsRoot = path.join(fixture.stateRoot, "generations");
	let mutationApplied = false;
	fs.renameSync = (source, destination) => {
		const result = originalRenameSync(source, destination);
		if (!mutationApplied && path.dirname(source) === generationsRoot && source.endsWith(".incomplete") && destination.endsWith(".complete")) {
			mutationApplied = true;
			mutate(path.join(fixture.stateRoot, "locks", "active", "children"));
		}
		return result;
	};
	try {
		return runPipeline(fixture.plan);
	} finally {
		fs.renameSync = originalRenameSync;
		assert.equal(mutationApplied, true, "generation publication mutation was not reached");
	}
}

function runChild(planFile, environment = {}) {
	const script = `import fs from "node:fs"; import { runPipeline } from ${JSON.stringify(pathToFileURL(path.join(scriptDirectory, "build-local-packages.mjs")).href)}; runPipeline(JSON.parse(fs.readFileSync(process.argv[1], "utf8")));`;
	return spawn("bash", [path.join(projectRoot, "scripts", "with-project-node.sh"), "--repo", projectRoot, "--", "node", "-e", script, planFile], {
		cwd: projectRoot,
		stdio: ["ignore", "pipe", "pipe"],
		env: { ...process.env, ...environment }
	});
}

function waitForChildMarker(child, marker) {
	return new Promise((resolve, reject) => {
		let output = "";
		const cleanup = () => {
			child.stdout.off("data", onData);
			child.off("close", onClose);
			child.off("error", onError);
		};
		const onData = (chunk) => {
			output += chunk.toString("utf8");
			if (output.includes(marker)) {
				cleanup();
				resolve(output);
			}
		};
		const onClose = (status) => {
			cleanup();
			reject(new Error(`child exited before emitting ${marker} (status ${status}): ${output}`));
		};
		const onError = (error) => {
			cleanup();
			reject(error);
		};
		child.stdout.on("data", onData);
		child.once("close", onClose);
		child.once("error", onError);
	});
}

function collectChildResult(child) {
	let stderr = "";
	child.stderr.on("data", (chunk) => { stderr += chunk.toString("utf8"); });
	return new Promise((resolve, reject) => {
		child.once("error", reject);
		child.once("close", (status) => resolve({ status, stderr }));
	});
}

test("process identity wrapper records a stable wrapper and command boundary", () => {
	const result = spawnSync(process.execPath, [path.join(scriptDirectory, "run-with-process-identity.mjs"), "--identity-fd", "3", "--cwd", projectRoot, "--", process.execPath, "-e", "process.stdout.write('identity-ok\\n')"], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe", "pipe"] });
	assert.equal(result.status, 0, result.stderr);
	const identityLines = result.output[3].toString("utf8").trim().split(/\r?\n/u).filter(Boolean);
	const identity = JSON.parse(identityLines.at(-1));
	assert.equal(identity.schemaVersion, 1);
	assert.ok(Number.isSafeInteger(identity.wrapper.pid) && identity.wrapper.pid > 0);
	assert.ok(typeof identity.wrapper.processStartToken === "string" && identity.wrapper.processStartToken.length > 0);
	assert.ok(Number.isSafeInteger(identity.child.pid) && identity.child.pid > 0);
	assert.ok(typeof identity.child.processStartToken === "string" && identity.child.processStartToken.length > 0);
});

test("Windows rename retries validate immediately before every attempt", () => {
	const events = [];
	const fileSystem = {
		renameSync() {
			events.push("rename");
			if (events.filter((event) => event === "rename").length < 3) {
				const error = new Error("transient contention");
				error.code = "EBUSY";
				throw error;
			}
		}
	};
	const attempts = renameWithWindowsRetry("source", "destination", fileSystem, {
		platform: "win32",
		maximumAttempts: 3,
		retryDelay: 0,
		beforeAttempt: ({ attempt }) => events.push(`validate-${attempt}`),
		wait: () => events.push("wait")
	});

	assert.equal(attempts, 3);
	assert.deepEqual(events, ["validate-1", "rename", "wait", "validate-2", "rename", "wait", "validate-3", "rename"]);
});

beforeEach(() => {
	// Each test receives a unique fixture; this hook intentionally keeps the root only for cleanup.
});

after(() => {
	fs.rmSync(testRoot, { recursive: true, force: true });
});

test("publishes one immutable generation with checksums and exact returned path", () => {
	const fixture = createFixture("success");
	const descriptor = runPipeline(fixture.plan);
	assert.equal(Object.isFrozen(descriptor), true);
	assert.equal(Object.isFrozen(descriptor.workspace), true);
	assert.throws(() => { descriptor.generationPath = "tampered"; }, TypeError);
	assert.match(descriptor.generationPath, /generations[\\/][a-f0-9]{32}\.complete$/u);
	assert.equal(descriptor.artifacts.length, 1);
	assert.equal(descriptor.artifacts[0].path, "artifacts/fixture-package-1.0.0.tgz");
	const proof = validateGenerationAt(descriptor.generationPath, { generationId: descriptor.generationId });
	assert.equal(proof.treeSha256, descriptor.treeSha256);
	assert.equal(fs.existsSync(path.join(fixture.stateRoot, "current")), false);
	assert.equal(fs.existsSync(path.join(fixture.stateRoot, "local-packages")), false);
});

test("records a verifiable producer identity in the released lock evidence", () => {
	const fixture = createFixture("child-identity");
	runPipeline(fixture.plan);
	const releasedRoot = path.join(fixture.stateRoot, "locks", "released");
	const releasedPath = fs.readdirSync(releasedRoot).find((name) => name.endsWith(".complete"));
	assert.ok(releasedPath);
	const childrenRoot = path.join(releasedRoot, releasedPath, "children");
	const childPath = path.join(childrenRoot, fs.readdirSync(childrenRoot).find((name) => name.endsWith(".complete") && !name.endsWith(".proof.complete")));
	const child = JSON.parse(fs.readFileSync(childPath, "utf8"));
	assert.equal(child.schemaVersion, 1);
	assert.ok(Number.isSafeInteger(child.child.pid) && child.child.pid > 0);
	assert.ok(typeof child.child.processStartToken === "string" && child.child.processStartToken.length > 0);
});

test("release refuses a child identity whose proof is missing", () => {
	const fixture = createFixture("release-missing-child-proof");
	assert.throws(
		() => runWithGenerationPublicationMutation(fixture, (childrenRoot) => {
			fs.unlinkSync(childIdentityFiles(childrenRoot).proof);
		}),
		/missing child identity proof/u
	);
	assert.equal(fs.existsSync(path.join(fixture.stateRoot, "locks", "active")), true);
	assert.deepEqual(fs.readdirSync(path.join(fixture.stateRoot, "locks", "release-receipts")), []);
});

test("release refuses a pending child identity before writing its receipt", () => {
	const fixture = createFixture("release-pending-child");
	assert.throws(
		() => runWithGenerationPublicationMutation(fixture, (childrenRoot) => {
			const complete = JSON.parse(fs.readFileSync(childIdentityFiles(childrenRoot).record, "utf8"));
			fs.writeFileSync(path.join(childrenRoot, "ffffffffffffffffffffffffffffffff.incomplete"), JSON.stringify({ ...complete, state: "PENDING" }));
		}),
		/pending child identity records remain/u
	);
	assert.equal(fs.existsSync(path.join(fixture.stateRoot, "locks", "active")), true);
	assert.deepEqual(fs.readdirSync(path.join(fixture.stateRoot, "locks", "release-receipts")), []);
});

test("does not treat an incomplete generation as published authority", () => {
	const fixture = createFixture("staging-proof");
	const descriptor = runPipeline(fixture.plan);
	const stagingPath = descriptor.generationPath.replace(/\.complete$/u, ".incomplete");
	fs.cpSync(descriptor.generationPath, stagingPath, { recursive: true });
	assert.throws(() => validateGenerationAt(stagingPath, { generationId: descriptor.generationId }), /staging generation is not publish authority/u);
});

test("quarantines a complete generation whose directory identity does not match its contents", () => {
	const fixture = createFixture("generation-identity");
	const descriptor = runPipeline(fixture.plan);
	const wrongId = `${descriptor.generationId[0] === "0" ? "1" : "0"}${descriptor.generationId.slice(1)}`;
	const copiedPath = path.join(fixture.stateRoot, "generations", `${wrongId}.complete`);
	fs.cpSync(descriptor.generationPath, copiedPath, { recursive: true });

	const next = runPipeline(fixture.plan);
	assert.equal(fs.existsSync(copiedPath), false);
	assert.ok(fs.readdirSync(path.join(fixture.stateRoot, "quarantine")).some((name) => name.includes("invalid-complete-generation")));
	assert.equal(fs.existsSync(next.generationPath), true);
});

test("cross-checks result and provenance before accepting a generation", () => {
	const fixture = createFixture("provenance-proof");
	const descriptor = runPipeline(fixture.plan);
	const resultPath = path.join(descriptor.generationPath, "result.json");
	const result = JSON.parse(fs.readFileSync(resultPath, "utf8"));
	result.generationId = "00000000000000000000000000000000";
	fs.writeFileSync(resultPath, JSON.stringify(result, null, 2) + "\n");
	assert.throws(() => validateGenerationAt(descriptor.generationPath, { generationId: descriptor.generationId }), /generation identity mismatch|metadata digest mismatch/u);
});

test("rejects a source artifact changed immediately after the copy", () => {
	const fixture = createFixture("copy-source-race");
	const originalCopyFileSync = fs.copyFileSync;
	fs.copyFileSync = (source, destination, flags) => {
		originalCopyFileSync(source, destination, flags);
		fs.appendFileSync(source, "post-copy mutation");
	};
	try {
		assert.throws(() => runPipeline(fixture.plan), /source artifact changed after copy/u);
	} finally {
		fs.copyFileSync = originalCopyFileSync;
	}
	assert.equal(generationDirectories(fixture).some((directory) => directory.endsWith(".incomplete")), false);
});

test("keeps a previous complete generation byte-for-byte unchanged after a failed build", () => {
	const fixture = createFixture("rollback");
	const first = runPipeline(fixture.plan);
	const before = fs.readFileSync(path.join(first.generationPath, "artifacts", "fixture-package-1.0.0.tgz"));
	fs.writeFileSync(path.join(fixture.repositoryDirectory, "mode.txt"), "fail\n");
	assert.throws(() => runPipeline(fixture.plan), /command failed \(19\)/u);
	assert.deepEqual(fs.readFileSync(path.join(first.generationPath, "artifacts", "fixture-package-1.0.0.tgz")), before);
	assert.equal(fs.existsSync(first.generationPath), true);
	assert.ok(generationDirectories(fixture).some((directory) => directory.includes(".complete")));
});

test("composes command failure with tracked-file invariant failure", () => {
	const fixture = createFixture("dirty");
	fs.writeFileSync(path.join(fixture.repositoryDirectory, "mode.txt"), "mutate-fail\n");
	assert.throws(
		() => runPipeline(fixture.plan),
		(error) => {
			const formatted = formatPipelineError(error);
			return /command failed \(17\)/u.test(formatted) && /Secondary failure/u.test(formatted) && /invariants changed/u.test(formatted);
		}
	);
});

test("a failed partial run releases only the child identities named by its terminal marker", () => {
	const fixture = createFixture("terminal-partial-run");
	const sentinel = path.join(fixture.repositoryDirectory, "second-command-ran.txt");
	fixture.plan.repositories[0].commands = [
		{ phase: "fail-first", cwd: ".", argv: ["node", "-e", "process.exit(23)"] },
		{ phase: "must-not-run", cwd: ".", argv: ["node", "-e", `require('node:fs').writeFileSync(${JSON.stringify(sentinel)}, 'unexpected')`] }
	];
	assert.throws(() => runPipeline(fixture.plan), /command failed \(23\)/u);
	assert.equal(fs.existsSync(sentinel), false);
	assert.equal(fs.existsSync(path.join(fixture.stateRoot, "locks", "active")), false);
	const releasedRoot = path.join(fixture.stateRoot, "locks", "released");
	const releasedPath = path.join(releasedRoot, fs.readdirSync(releasedRoot).find((name) => name.endsWith(".complete")));
	const childrenRoot = path.join(releasedPath, "children");
	const terminal = JSON.parse(fs.readFileSync(path.join(childrenRoot, "terminal.failed.complete"), "utf8"));
	assert.deepEqual(terminal.started, [{ repository: "fixture", phase: "fail-first" }]);
	assert.equal(fs.readdirSync(childrenRoot).filter((name) => /^[a-f0-9]{32}\.complete$/u.test(name)).length, 1);
	assert.equal(fs.readdirSync(childrenRoot).filter((name) => /^[a-f0-9]{32}\.proof\.complete$/u.test(name)).length, 1);
});

test("a terminal marker collision remains secondary to the command failure", () => {
	const fixture = createFixture("terminal-marker-collision");
	const collisionScript = [
		"const fs = require('node:fs');",
		"const path = require('node:path');",
		"const active = path.resolve(process.cwd(), '..', 'tmp', 'local-package-state', 'locks', 'active');",
		"const descriptor = JSON.parse(fs.readFileSync(path.join(active, 'descriptor.json'), 'utf8'));",
		"fs.writeFileSync(path.join(active, 'children', 'terminal.failed.complete'), JSON.stringify({ schemaVersion: 1, state: 'FAILED', lockId: descriptor.lockId, workspace: descriptor.workspace, started: [{ repository: 'fixture', phase: 'collide-terminal' }] }));",
		"process.exit(29);"
	].join(" ");
	fixture.plan.repositories[0].commands = [{ phase: "collide-terminal", cwd: ".", argv: ["node", "-e", collisionScript] }];
	assert.throws(
		() => runPipeline(fixture.plan),
		(error) => {
			const formatted = formatPipelineError(error);
			const primary = formatted.indexOf("command failed (29)");
			const secondary = formatted.indexOf("Secondary failure (persist child terminal marker)");
			const collision = formatted.indexOf("atomic destination already exists");
			return primary === 0 && secondary > primary && collision > secondary;
		}
	);
	assert.equal(fs.existsSync(path.join(fixture.stateRoot, "locks", "active")), false);
});

test("quarantines abandoned candidates before any producer command", () => {
	const fixture = createFixture("recovery");
	const abandoned = path.join(fixture.stateRoot, "generations", "0123456789abcdef0123456789abcdef.incomplete");
	fs.mkdirSync(abandoned, { recursive: true });
	fs.writeFileSync(path.join(abandoned, "descriptor.json"), "abandoned\n");
	const descriptor = runPipeline(fixture.plan);
	assert.equal(fs.existsSync(abandoned), false);
	const quarantine = path.join(fixture.stateRoot, "quarantine");
	assert.ok(fs.readdirSync(quarantine).some((name) => name.includes("abandoned-generation")));
	assert.equal(fs.existsSync(descriptor.generationPath), true);
});

test("rejects traversal, absolute, ADS, and reserved-name paths", () => {
	for (const candidate of ["../outside", "C:\\outside", "\\\\server\\share", "folder:file", "CON.txt"]) {
		assert.throws(() => resolveContained(testRoot, candidate, "test path"), /relative|absolute|traversal|colon|reserved|UNC|escapes/u);
	}
});

test("publishes immutable state files without overwriting a collision", () => {
	const filePath = path.join(testRoot, `immutable-${Date.now()}-${Math.random().toString(16).slice(2)}.complete`);
	writeAtomic(filePath, "first\n", { noReplace: true });
	assert.throws(() => writeAtomic(filePath, "replacement\n", { noReplace: true }), /atomic destination already exists/u);
	assert.equal(fs.readFileSync(filePath, "utf8"), "first\n");
});

test("two real child producers contend on one atomic workspace lock", async () => {
	const fixture = createFixture("contention");
	const readyPath = path.join(fixture.workspaceRoot, "contention.ready");
	const releasePath = path.join(fixture.workspaceRoot, "contention.release");
	fs.writeFileSync(
		path.join(fixture.repositoryDirectory, "build.mjs"),
		`import fs from "node:fs"; import path from "node:path";
const readyPath = process.env.STARK_CONTENTION_READY;
const releasePath = process.env.STARK_CONTENTION_RELEASE;
if (readyPath) {
	fs.writeFileSync(readyPath, "ready\\n");
	process.stdout.write("CONTENTION_READY\\n");
}
if (releasePath) {
	if (!fs.existsSync(releasePath)) await new Promise((resolve, reject) => {
		const watcher = fs.watch(path.dirname(releasePath), (_event, filename) => {
			if (filename !== null && String(filename) === path.basename(releasePath) && fs.existsSync(releasePath)) {
				watcher.close();
				resolve();
			}
		});
		watcher.on("error", (error) => {
			watcher.close();
			reject(error);
		});
	});
}
fs.mkdirSync("dist", { recursive: true });
fs.writeFileSync("dist/fixture-package-1.0.0.tgz", "contention");\n`
	);
	run("git", ["add", "build.mjs"], fixture.repositoryDirectory);
	run("git", ["commit", "--quiet", "-m", "slow-build"], fixture.repositoryDirectory);
	const planFile = path.join(fixture.workspaceRoot, "plan.json");
	fs.writeFileSync(planFile, JSON.stringify({ plan: fixture.plan }));
	const owner = runChild(planFile, { STARK_CONTENTION_READY: readyPath, STARK_CONTENTION_RELEASE: releasePath });
	const ownerResult = collectChildResult(owner);
	let contender;
	try {
		await waitForChildMarker(owner, "CONTENTION_READY");
		contender = runChild(planFile);
		const contenderResult = collectChildResult(contender);
		const contenderOutcome = await contenderResult;
		fs.writeFileSync(releasePath, "release\\n");
		const results = await Promise.all([ownerResult, Promise.resolve(contenderOutcome)]);
		assert.equal(results.filter((result) => result.status === 0).length, 1);
		assert.equal(results.filter((result) => result.status !== 0).length, 1);
		assert.match(results.find((result) => result.status !== 0).stderr, /locked|lock/u);
	} finally {
		if (!fs.existsSync(releasePath)) fs.writeFileSync(releasePath, "release\\n");
		if (contender?.exitCode === null) contender.kill();
		if (owner.exitCode === null) owner.kill();
	}
});

test("does not permit automatic break-glass recovery while the owner is alive", () => {
	const fixture = createFixture("break-glass");
	fs.mkdirSync(path.join(fixture.stateRoot, "locks", "active"), { recursive: true });
	fs.writeFileSync(path.join(fixture.stateRoot, "locks", "active", "descriptor.json"), JSON.stringify({
		schemaVersion: 1,
		lockId: "active",
		workspace: { realPath: fs.realpathSync(fixture.workspaceRoot), volumeId: "0", directoryId: "0" },
		owner: { pid: process.pid, processStartToken: "wrong" }
	}));
	assert.throws(() => breakGlassActiveLock(fixture.stateRoot), /PID was reused|canonical workspace|alive|identity/u);
});

function workspaceRecord(directory) {
	const realPath = fs.realpathSync(directory);
	const stat = fs.statSync(realPath);
	return { realPath, volumeId: String(stat.dev), directoryId: `${stat.dev}:${stat.ino}` };
}

function writeBreakGlassDescriptor(fixture, owner, extra = {}) {
	fs.mkdirSync(path.join(fixture.stateRoot, "locks", "active"), { recursive: true });
	fs.writeFileSync(path.join(fixture.stateRoot, "locks", "active", "descriptor.json"), JSON.stringify({
		schemaVersion: 1,
		lockId: "stale-lock",
		workspace: workspaceRecord(fixture.workspaceRoot),
		stateRoot: workspaceRecord(fixture.stateRoot),
		owner: { plannedChildren: [], ...owner },
		...extra
	}));
}

function writeBreakGlassChildIdentity(fixture, ownerPid, options = {}) {
	writeBreakGlassDescriptor(fixture, {
		pid: ownerPid,
		processStartToken: "stale-owner",
		plannedChildren: [{ repository: "fixture", phase: "build-and-pack" }]
	});
	const childId = "0123456789abcdef0123456789abcdef";
	const childrenRoot = path.join(fixture.stateRoot, "locks", "active", "children");
	fs.mkdirSync(childrenRoot, { recursive: true });
	const record = {
		schemaVersion: 1,
		state: "COMPLETE",
		lockId: "stale-lock",
		workspace: workspaceRecord(fixture.workspaceRoot),
		repository: "fixture",
		phase: "build-and-pack",
		command: { cwd: ".", argv: ["node", "build.mjs"] },
		wrapper: { pid: ownerPid, parentPid: 1, processStartToken: "wrapper", platform: "linux" },
		child: {
			pid: ownerPid + 1,
			parentPid: ownerPid,
			processStartToken: "child",
			platform: "linux",
			kind: "direct",
			...(options.omitBoundary ? {} : { boundary: { kind: "process-group", id: ownerPid + 1 } })
		}
	};
	const recordPath = path.join(childrenRoot, `${childId}.complete`);
	const recordJson = JSON.stringify(record);
	fs.writeFileSync(recordPath, recordJson);
	fs.writeFileSync(path.join(childrenRoot, `${childId}.proof.complete`), JSON.stringify({
		schemaVersion: 1,
		state: "PROOF",
		childId,
		recordSha256: options.forgedProof ? "0".repeat(64) : createHash("sha256").update(recordJson).digest("hex")
	}));
	return { childPid: record.child.pid };
}

test("break-glass quarantines an owner that is absent with no live descendants", () => {
	const fixture = createFixture("break-glass-stale");
	writeBreakGlassDescriptor(fixture, { pid: 2147483647, processStartToken: "stale-owner" });
	const destination = breakGlassActiveLock(fixture.stateRoot, { processEnumerator: () => [] });
	assert.equal(fs.existsSync(path.join(fixture.stateRoot, "locks", "active")), false);
	assert.equal(JSON.parse(fs.readFileSync(path.join(destination, "break-glass-evidence.json"), "utf8")).lockId, "stale-lock");
});

test("break-glass rename faults preserve the active lock and its recovery evidence", () => {
	const fixture = createFixture("break-glass-rename-fault");
	writeBreakGlassDescriptor(fixture, { pid: 2147483647, processStartToken: "stale-owner" });
	const activePath = path.join(fixture.stateRoot, "locks", "active");

	assert.throws(
		() => breakGlassActiveLock(fixture.stateRoot, {
			processEnumerator: () => [],
			faultPlan: { failAt: "break-glass.rename" }
		}),
		(error) => error.message === "declarative fault requested at break-glass.rename"
	);
	assert.equal(fs.existsSync(activePath), true);
	assert.equal(JSON.parse(fs.readFileSync(path.join(activePath, "break-glass-evidence.json"), "utf8")).lockId, "stale-lock");
	assert.deepEqual(stateEntries(fixture, "quarantine"), []);
});

test("break-glass refuses an active-directory replacement before writing evidence", () => {
	const fixture = createFixture("break-glass-active-replacement");
	writeBreakGlassDescriptor(fixture, { pid: 2147483647, processStartToken: "stale-owner" });
	const activePath = path.join(fixture.stateRoot, "locks", "active");
	const displacedPath = path.join(fixture.stateRoot, "locks", "displaced-active");

	assert.throws(
		() => breakGlassActiveLock(fixture.stateRoot, {
			processEnumerator: () => {
				fs.renameSync(activePath, displacedPath);
				fs.cpSync(displacedPath, activePath, { recursive: true });
				return [];
			}
		}),
		/active lock identity changed/u
	);
	assert.equal(fs.existsSync(path.join(activePath, "break-glass-evidence.json")), false);
	assert.equal(fs.existsSync(path.join(displacedPath, "break-glass-evidence.json")), false);
});

test("break-glass refuses descriptor tampering before writing evidence", () => {
	const fixture = createFixture("break-glass-descriptor-tamper");
	writeBreakGlassDescriptor(fixture, { pid: 2147483647, processStartToken: "stale-owner" });
	const activePath = path.join(fixture.stateRoot, "locks", "active");
	const descriptorPath = path.join(activePath, "descriptor.json");

	assert.throws(
		() => breakGlassActiveLock(fixture.stateRoot, {
			processEnumerator: () => {
				const changed = JSON.parse(fs.readFileSync(descriptorPath, "utf8"));
				changed.lockId = "replacement-lock";
				fs.writeFileSync(descriptorPath, JSON.stringify(changed));
				return [];
			}
		}),
		/active lock descriptor changed/u
	);
	assert.equal(fs.existsSync(path.join(activePath, "break-glass-evidence.json")), false);
});

test("break-glass retry preserves the first valid evidence byte-for-byte", () => {
	const fixture = createFixture("break-glass-retry-evidence");
	writeBreakGlassDescriptor(fixture, { pid: 2147483647, processStartToken: "stale-owner" });
	const activePath = path.join(fixture.stateRoot, "locks", "active");
	const evidencePath = path.join(activePath, "break-glass-evidence.json");

	assert.throws(
		() => breakGlassActiveLock(fixture.stateRoot, {
			processEnumerator: () => [],
			faultPlan: { failAt: "break-glass.rename" }
		}),
		(error) => error.message === "declarative fault requested at break-glass.rename"
	);
	const firstEvidence = fs.readFileSync(evidencePath);
	const destination = breakGlassActiveLock(fixture.stateRoot, {
		processEnumerator: () => [{ pid: 2147483646, parentPid: 0, startToken: "unrelated" }]
	});
	assert.deepEqual(fs.readFileSync(path.join(destination, "break-glass-evidence.json")), firstEvidence);
});

function windowsRenameRetry(mutate) {
	let attempts = 0;
	return {
		fileSystem: {
			renameSync(source, destination) {
				attempts += 1;
				if (attempts === 1) {
					const error = new Error("transient rename contention");
					error.code = "EBUSY";
					throw error;
				}
				fs.renameSync(source, destination);
			}
		},
		options: { platform: "win32", maximumAttempts: 2, retryDelay: 0, wait: mutate },
		attempts: () => attempts
	};
}

const breakGlassRetryMutations = [
	{
		name: "active directory replacement",
		expected: /active lock identity changed/u,
		mutate(fixture) {
			const activePath = path.join(fixture.stateRoot, "locks", "active");
			const displacedPath = path.join(fixture.stateRoot, "locks", "displaced-active");
			fs.renameSync(activePath, displacedPath);
			fs.cpSync(displacedPath, activePath, { recursive: true });
		}
	},
	{
		name: "state-root replacement",
		expected: /canonical state-root identity changed/u,
		mutate(fixture) {
			const displacedPath = `${fixture.stateRoot}-displaced`;
			fs.renameSync(fixture.stateRoot, displacedPath);
			fs.cpSync(displacedPath, fixture.stateRoot, { recursive: true });
		}
	},
	{
		name: "descriptor tampering",
		expected: /active lock descriptor changed/u,
		mutate(fixture) {
			const descriptorPath = path.join(fixture.stateRoot, "locks", "active", "descriptor.json");
			const changed = JSON.parse(fs.readFileSync(descriptorPath, "utf8"));
			changed.lockId = "retry-replacement-lock";
			fs.writeFileSync(descriptorPath, JSON.stringify(changed));
		}
	},
	{
		name: "evidence tampering",
		expected: /break-glass evidence changed/u,
		mutate(fixture) {
			fs.appendFileSync(path.join(fixture.stateRoot, "locks", "active", "break-glass-evidence.json"), "tampered");
		}
	}
];

for (const { name, expected, mutate } of breakGlassRetryMutations) {
	test(`break-glass Windows retry rejects ${name} before a second rename`, () => {
		const fixture = createFixture(`break-glass-retry-${name.replaceAll(" ", "-")}`);
		writeBreakGlassDescriptor(fixture, { pid: 2147483647, processStartToken: "stale-owner" });
		const retry = windowsRenameRetry(() => mutate(fixture));

		assert.throws(
			() => breakGlassActiveLock(fixture.stateRoot, {
				processEnumerator: () => [],
				renameFileSystem: retry.fileSystem,
				renameOptions: retry.options
			}),
			expected
		);
		assert.equal(retry.attempts(), 1);
		assert.equal(fs.existsSync(path.join(fixture.stateRoot, "locks", "active")), true);
		assert.deepEqual(stateEntries(fixture, "quarantine"), []);
	});
}

test("break-glass Windows retry preserves exact evidence during normal contention", () => {
	const fixture = createFixture("break-glass-retry-normal");
	writeBreakGlassDescriptor(fixture, { pid: 2147483647, processStartToken: "stale-owner" });
	const evidencePath = path.join(fixture.stateRoot, "locks", "active", "break-glass-evidence.json");
	let firstEvidence;
	const retry = windowsRenameRetry(() => { firstEvidence = fs.readFileSync(evidencePath); });
	const destination = breakGlassActiveLock(fixture.stateRoot, {
		processEnumerator: () => [],
		renameFileSystem: retry.fileSystem,
		renameOptions: retry.options
	});

	assert.equal(retry.attempts(), 2);
	assert.deepEqual(fs.readFileSync(path.join(destination, "break-glass-evidence.json")), firstEvidence);
});

test("break-glass refuses an unverifiable process enumeration", () => {
	const fixture = createFixture("break-glass-enumeration");
	writeBreakGlassDescriptor(fixture, { pid: 2147483647, processStartToken: "stale-owner" });
	assert.throws(
		() => breakGlassActiveLock(fixture.stateRoot, { processEnumerator: () => { throw new Error("enumeration denied"); } }),
		/enumeration denied/u
	);
	assert.equal(fs.existsSync(path.join(fixture.stateRoot, "locks", "active")), true);
});

test("break-glass refuses a live descendant of an absent owner", () => {
	const fixture = createFixture("break-glass-descendant");
	const ownerPid = 2147483647;
	writeBreakGlassDescriptor(fixture, { pid: ownerPid, processStartToken: "stale-owner" });
	assert.throws(
		() => breakGlassActiveLock(fixture.stateRoot, {
			processEnumerator: () => [{ pid: ownerPid + 1, parentPid: ownerPid, startToken: "child" }]
		}),
		/owner or a recorded descendant is still alive/u
	);
	assert.equal(fs.existsSync(path.join(fixture.stateRoot, "locks", "active")), true);
});

test("break-glass refuses a live recorded child identity", () => {
	const fixture = createFixture("break-glass-recorded-child");
	const ownerPid = 2147483647;
	const { childPid } = writeBreakGlassChildIdentity(fixture, ownerPid);
	assert.throws(
		() => breakGlassActiveLock(fixture.stateRoot, {
			processEnumerator: () => [{ pid: childPid, parentPid: ownerPid, startToken: "child" }]
		}),
		/owner or a recorded descendant is still alive/u
	);
	assert.equal(fs.existsSync(path.join(fixture.stateRoot, "locks", "active")), true);
});

test("break-glass refuses a forged child identity proof", () => {
	const fixture = createFixture("break-glass-forged-child-proof");
	writeBreakGlassChildIdentity(fixture, 2147483647, { forgedProof: true });
	assert.throws(
		() => breakGlassActiveLock(fixture.stateRoot, { processEnumerator: () => [] }),
		/child identity record digest mismatch/u
	);
	assert.equal(fs.existsSync(path.join(fixture.stateRoot, "locks", "active")), true);
});

test("break-glass reports an invalid child boundary before accepting its proof", () => {
	const fixture = createFixture("break-glass-missing-child-boundary");
	writeBreakGlassChildIdentity(fixture, 2147483647, { omitBoundary: true });
	assert.throws(
		() => breakGlassActiveLock(fixture.stateRoot, { processEnumerator: () => [] }),
		/child identity boundary is not verifiable/u
	);
	assert.equal(fs.existsSync(path.join(fixture.stateRoot, "locks", "active")), true);
});

test("break-glass refuses a pending child identity", () => {
	const fixture = createFixture("break-glass-pending-child");
	const ownerPid = 2147483647;
	writeBreakGlassDescriptor(fixture, { pid: ownerPid, processStartToken: "stale-owner", plannedChildren: [{ repository: "fixture", phase: "build-and-pack" }] });
	const childrenRoot = path.join(fixture.stateRoot, "locks", "active", "children");
	fs.mkdirSync(childrenRoot, { recursive: true });
	fs.writeFileSync(path.join(childrenRoot, "fedcba9876543210fedcba9876543210.incomplete"), JSON.stringify({
		schemaVersion: 1,
		state: "PENDING",
		lockId: "stale-lock",
		workspace: workspaceRecord(fixture.workspaceRoot),
		repository: "fixture",
		phase: "build-and-pack",
		command: { cwd: ".", argv: ["node", "build.mjs"] }
	}));
	assert.throws(
		() => breakGlassActiveLock(fixture.stateRoot, { processEnumerator: () => [] }),
		/pending child identity records remain/u
	);
	assert.equal(fs.existsSync(path.join(fixture.stateRoot, "locks", "active")), true);
});

const faultMatrix = [
	{ operation: "source.cleanup.before", producerRan: false, lockReleased: true, candidate: "failed-generation", preservePriorGeneration: true, sourceMustSurvive: true },
	{ operation: "source.cleanup.remove", producerRan: false, lockReleased: true, candidate: "failed-generation", preservePriorGeneration: true, sourceMustSurvive: true },
	{ operation: "recovery.quarantine", producerRan: false, lockReleased: true, candidate: "abandoned-generation" },
	{ operation: "lock.candidate.write", producerRan: false, lockReleased: false, candidate: "lock-candidate" },
	{ operation: "lock.publish.rename", producerRan: false, lockReleased: false, candidate: "lock-candidate" },
	{ operation: "generation.create", producerRan: false, lockReleased: true, candidate: "none" },
	{ operation: "descriptor.write", producerRan: false, lockReleased: true, candidate: "failed-generation" },
	{ operation: "repository[fixture].command[build-and-pack].before", producerRan: false, lockReleased: true, candidate: "failed-generation" },
	{ operation: "repository[fixture].post-command-snapshot", producerRan: true, lockReleased: true, candidate: "failed-generation" },
	{ operation: "artifact.copy", producerRan: true, lockReleased: true, candidate: "failed-generation" },
	{ operation: "result.write", producerRan: true, lockReleased: true, candidate: "failed-generation" },
	{ operation: "checksums.write", producerRan: true, lockReleased: true, candidate: "failed-generation" },
	{ operation: "provenance.write", producerRan: true, lockReleased: true, candidate: "failed-generation" },
	{ operation: "marker.write", producerRan: true, lockReleased: true, candidate: "failed-generation" },
	{ operation: "publish.rename", producerRan: true, lockReleased: true, candidate: "failed-generation" },
	{ operation: "publish.post-rename-validation", producerRan: true, lockReleased: true, candidate: "invalid-complete-generation" }
];

for (const { operation, producerRan, lockReleased, candidate, preservePriorGeneration, sourceMustSurvive } of faultMatrix) {
	test(`faultPlan matrix: ${operation}`, () => {
		const fixture = createFixture(`fault-matrix-${operation.replace(/[^a-z0-9]+/giu, "-")}`, { producerSentinel: true });
		const baseline = preservePriorGeneration ? runPipeline(fixture.plan) : undefined;
		const baselineSnapshot = baseline ? snapshotTree(baseline.generationPath) : undefined;
		if (baseline) fs.rmSync(producerMarker(fixture), { force: true });
		if (operation === "recovery.quarantine") {
			fs.mkdirSync(path.join(fixture.stateRoot, "generations", "0123456789abcdef0123456789abcdef.incomplete"), { recursive: true });
		}
		const sourceArtifact = path.join(fixture.repositoryDirectory, "dist", "fixture-package-1.0.0.tgz");
		if (sourceMustSurvive && !fs.existsSync(sourceArtifact)) {
			fs.mkdirSync(path.dirname(sourceArtifact), { recursive: true });
			fs.writeFileSync(sourceArtifact, "pre-existing-source-artifact\n");
		}
		const sourceBefore = sourceMustSurvive ? fs.readFileSync(sourceArtifact) : undefined;
		const { error, formatted } = captureFault(fixture, operation);

		assert.equal(error.message, `declarative fault requested at ${operation}`);
		assert.equal(error.phase, operation);
		assert.equal(formatted.split("\n", 1)[0], `declarative fault requested at ${operation}`);
		assert.equal(fs.existsSync(producerMarker(fixture)), producerRan, `${operation}: producer execution evidence`);
		if (sourceMustSurvive) assert.deepEqual(fs.readFileSync(sourceArtifact), sourceBefore, `${operation}: source artifact was removed`);
		assert.equal(publishedGenerationPaths(fixture).length, baseline ? 1 : 0, `${operation}: unexpected published generation`);
		if (baseline) assertTreeSnapshot(baseline.generationPath, baselineSnapshot);
		assert.equal(fs.existsSync(path.join(fixture.stateRoot, "locks", "active")), false, `${operation}: active lock evidence`);
		assert.equal(
			stateEntries(fixture, "locks/released").filter((name) => name.endsWith(".complete")).length,
			(baseline ? 1 : 0) + (lockReleased ? 1 : 0),
			`${operation}: released lock evidence`
		);

		if (candidate === "lock-candidate") {
			assert.ok(stateEntries(fixture, "locks/candidates").some((name) => name.endsWith(".incomplete")), `${operation}: lock candidate evidence`);
		} else if (candidate === "none") {
			assert.equal(stateEntries(fixture, "generations").some((name) => name.endsWith(".incomplete")), false, `${operation}: unexpected generation candidate`);
		} else if (candidate === "abandoned-generation") {
			assert.ok(stateEntries(fixture, "generations").includes("0123456789abcdef0123456789abcdef.incomplete"), `${operation}: abandoned candidate was removed`);
		} else {
			assert.equal(stateEntries(fixture, "generations").some((name) => name.endsWith(".incomplete")), false, `${operation}: failed candidate was not quarantined`);
			const expectedQuarantineLabel = candidate === "invalid-complete-generation" ? "invalid-complete-generation" : "failed-generation";
			assert.ok(stateEntries(fixture, "quarantine").some((name) => name.includes(expectedQuarantineLabel)), `${operation}: preserved quarantine evidence`);
		}
	});
}

test("faultPlan preserves primary errors and orders secondary quarantine/invariant failures", () => {
	{
		const fixture = createFixture("fault-secondary-descriptor", { producerSentinel: true });
		const baseline = runPipeline(fixture.plan);
		const baselineSnapshot = snapshotTree(baseline.generationPath);
		fs.rmSync(producerMarker(fixture), { force: true });
		const { error, formatted } = captureFault(fixture, ["descriptor.write", "failure.quarantine"]);
		const secondary = formatted.indexOf("Secondary failure");
		assert.equal(error.message, "declarative fault requested at descriptor.write");
		assert.equal(formatted.split("\n", 1)[0], "declarative fault requested at descriptor.write");
		assert.ok(secondary > 0 && formatted.indexOf("failure.quarantine") > secondary);
		assert.equal(fs.existsSync(producerMarker(fixture)), false);
		assertTreeSnapshot(baseline.generationPath, baselineSnapshot);
		assert.ok(stateEntries(fixture, "generations").some((name) => name.endsWith(".incomplete")));
		assert.equal(fs.existsSync(path.join(fixture.stateRoot, "locks", "active")), false);
	}

	{
		const fixture = createFixture("fault-secondary-command", { producerSentinel: true });
		const baseline = runPipeline(fixture.plan);
		const baselineSnapshot = snapshotTree(baseline.generationPath);
		fs.rmSync(producerMarker(fixture), { force: true });
		fs.writeFileSync(path.join(fixture.repositoryDirectory, "mode.txt"), "mutate-fail\n");
		const operation = "repository[fixture].post-command-snapshot";
		const { error, formatted } = captureFault(fixture, operation);
		const secondary = formatted.indexOf("Secondary failure");
		assert.match(error.message, /^command failed \(17\): /u);
		assert.equal(formatted.split("\n", 1)[0], error.message);
		assert.ok(secondary > 0 && formatted.indexOf(operation) > secondary);
		assert.equal(fs.existsSync(producerMarker(fixture)), true);
		assertTreeSnapshot(baseline.generationPath, baselineSnapshot);
		assert.ok(stateEntries(fixture, "quarantine").some((name) => name.includes("failed-generation")));
	}

	{
		const fixture = createFixture("fault-secondary-publication", { producerSentinel: true });
		const baseline = runPipeline(fixture.plan);
		const baselineSnapshot = snapshotTree(baseline.generationPath);
		fs.rmSync(producerMarker(fixture), { force: true });
		const { error, formatted } = captureFault(fixture, ["publish.rename", "failure.quarantine"]);
		const secondary = formatted.indexOf("Secondary failure");
		assert.equal(error.message, "declarative fault requested at publish.rename");
		assert.equal(formatted.split("\n", 1)[0], "declarative fault requested at publish.rename");
		assert.ok(secondary > 0 && formatted.indexOf("failure.quarantine") > secondary);
		assert.equal(fs.existsSync(producerMarker(fixture)), true);
		assertTreeSnapshot(baseline.generationPath, baselineSnapshot);
		assert.ok(stateEntries(fixture, "generations").some((name) => name.endsWith(".incomplete")));
	}
});

test("faultPlan orders release failure after preserved quarantine evidence", () => {
	const fixture = createFixture("fault-secondary-release", { producerSentinel: true });
	const baseline = runPipeline(fixture.plan);
	const baselineSnapshot = snapshotTree(baseline.generationPath);
	fs.rmSync(producerMarker(fixture), { force: true });
	const { error, formatted } = captureFault(fixture, ["result.write", "failure.quarantine", "lock.release.receipt"]);
	const quarantine = formatted.indexOf("failure.quarantine");
	const release = formatted.indexOf("lock.release.receipt");
	assert.equal(error.message, "declarative fault requested at result.write");
	assert.equal(formatted.split("\n", 1)[0], "declarative fault requested at result.write");
	assert.ok(quarantine > 0 && release > quarantine);
	assert.equal(fs.existsSync(producerMarker(fixture)), true);
	assertTreeSnapshot(baseline.generationPath, baselineSnapshot);
	assert.ok(stateEntries(fixture, "generations").some((name) => name.endsWith(".incomplete")));
	assert.equal(fs.existsSync(path.join(fixture.stateRoot, "locks", "active")), true);
	assert.equal(lockEvidenceEntries(fixture, "release-receipts").length, 1);
	assert.equal(lockEvidenceEntries(fixture, "released").length, 1);
	assertLockEvidenceIsSelfIdentifying(fixture);
});

for (const operation of ["lock.release.receipt", "lock.release.rename"]) {
	test(`faultPlan ${operation} preserves published authority and active evidence`, () => {
		const fixture = createFixture(`fault-${operation}`, { producerSentinel: true });
		const baseline = runPipeline(fixture.plan);
		const baselineSnapshot = snapshotTree(baseline.generationPath);
		const baselineReleasedName = lockEvidenceEntries(fixture, "released")[0];
		const baselineReleasedPath = path.join(fixture.stateRoot, "locks", "released", baselineReleasedName);
		const baselineReleasedSnapshot = snapshotTree(baselineReleasedPath);
		const baselineReceiptName = lockEvidenceEntries(fixture, "release-receipts")[0];
		const baselineReceiptPath = path.join(fixture.stateRoot, "locks", "release-receipts", baselineReceiptName);
		const baselineReceipt = fs.readFileSync(baselineReceiptPath);
		fs.rmSync(producerMarker(fixture), { force: true });
		const { error, formatted } = captureFault(fixture, operation);

		assert.equal(error.message, `declarative fault requested at ${operation}`);
		assert.equal(error.phase, operation);
		assert.equal(formatted.split("\n", 1)[0], `declarative fault requested at ${operation}`);
		assert.equal(fs.existsSync(producerMarker(fixture)), true);
		const published = publishedGenerationPaths(fixture);
		assert.equal(published.length, 2, `${operation}: published generation was revoked`);
		assertTreeSnapshot(baseline.generationPath, baselineSnapshot);
		assertTreeSnapshot(baselineReleasedPath, baselineReleasedSnapshot);
		assert.deepEqual(fs.readFileSync(baselineReceiptPath), baselineReceipt);

		const currentGeneration = published.find((generationPath) => generationPath !== baseline.generationPath);
		const generationId = path.basename(currentGeneration, ".complete");
		validateGenerationAt(currentGeneration, {
			generationId,
			stateRoot: fixture.stateRoot,
			workspace: workspaceRecord(fixture.workspaceRoot)
		});

		const activePath = path.join(fixture.stateRoot, "locks", "active");
		assert.equal(fs.existsSync(activePath), true, `${operation}: active evidence was removed`);
		const activeDescriptor = JSON.parse(fs.readFileSync(path.join(activePath, "descriptor.json"), "utf8"));
		const activeEvidenceName = `${activeDescriptor.lockId}.complete`;
		assert.equal(lockEvidenceEntries(fixture, "released").includes(activeEvidenceName), false);
		assert.equal(lockEvidenceEntries(fixture, "release-receipts").includes(activeEvidenceName), operation === "lock.release.rename");
		assert.equal(lockEvidenceEntries(fixture, "released").length, 1);
		assert.equal(lockEvidenceEntries(fixture, "release-receipts").length, operation === "lock.release.rename" ? 2 : 1);
		assertLockEvidenceIsSelfIdentifying(fixture);
	});
}
