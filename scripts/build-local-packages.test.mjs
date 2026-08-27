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

function createFixture(name = "fixture") {
	const workspaceRoot = path.join(testRoot, `${name}-${Date.now()}-${Math.random().toString(16).slice(2)}`);
	const repositoryDirectory = path.join(workspaceRoot, "fixture-repository");
	fs.mkdirSync(repositoryDirectory, { recursive: true });
	fs.writeFileSync(path.join(repositoryDirectory, ".nvmrc"), `${nodeVersion}\n`);
	fs.writeFileSync(path.join(repositoryDirectory, "package.json"), JSON.stringify({ name: "@fixture/package", version: "1.0.0" }, null, 2) + "\n");
	fs.writeFileSync(
		path.join(repositoryDirectory, "build.mjs"),
		`import fs from "node:fs";\nconst mode = fs.existsSync("mode.txt") ? fs.readFileSync("mode.txt", "utf8").trim() : "success";\nif (mode === "mutate-fail") { fs.appendFileSync("package.json", " "); process.exit(17); }\nif (mode === "fail") process.exit(19);\nfs.mkdirSync("dist", { recursive: true });\nfs.writeFileSync("dist/fixture-package-1.0.0.tgz", Buffer.from("fixture-" + Date.now()));\n`
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

function runChild(planFile) {
	const script = `import fs from "node:fs"; import { runPipeline } from ${JSON.stringify(pathToFileURL(path.join(scriptDirectory, "build-local-packages.mjs")).href)}; runPipeline(JSON.parse(fs.readFileSync(process.argv[1], "utf8")));`;
	return spawn("bash", [path.join(projectRoot, "scripts", "with-project-node.sh"), "--repo", projectRoot, "--", "node", "-e", script, planFile], { cwd: projectRoot, stdio: ["ignore", "pipe", "pipe"] });
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
	fs.writeFileSync(
		path.join(fixture.repositoryDirectory, "build.mjs"),
		`import fs from "node:fs"; fs.mkdirSync("dist", { recursive: true }); await new Promise((resolve) => setTimeout(resolve, 500)); fs.writeFileSync("dist/fixture-package-1.0.0.tgz", "contention");\n`
	);
	run("git", ["add", "build.mjs"], fixture.repositoryDirectory);
	run("git", ["commit", "--quiet", "-m", "slow-build"], fixture.repositoryDirectory);
	const planFile = path.join(fixture.workspaceRoot, "plan.json");
	fs.writeFileSync(planFile, JSON.stringify({ plan: fixture.plan }));
	const children = [runChild(planFile), runChild(planFile)];
	const results = await Promise.all(children.map((child) => new Promise((resolve) => {
		let stderr = "";
		child.stderr.on("data", (chunk) => { stderr += chunk; });
		child.on("close", (status) => resolve({ status, stderr }));
	})));
	assert.equal(results.filter((result) => result.status === 0).length, 1);
	assert.equal(results.filter((result) => result.status !== 0).length, 1);
	assert.match(results.find((result) => result.status !== 0).stderr, /locked|lock/u);
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
		owner: { plannedChildren: [], ...owner },
		...extra
	}));
}

test("break-glass quarantines an owner that is absent with no live descendants", () => {
	const fixture = createFixture("break-glass-stale");
	writeBreakGlassDescriptor(fixture, { pid: 2147483647, processStartToken: "stale-owner" });
	const destination = breakGlassActiveLock(fixture.stateRoot, { processEnumerator: () => [] });
	assert.equal(fs.existsSync(path.join(fixture.stateRoot, "locks", "active")), false);
	assert.equal(JSON.parse(fs.readFileSync(path.join(destination, "break-glass-evidence.json"), "utf8")).lockId, "stale-lock");
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
	const childPid = ownerPid + 1;
	writeBreakGlassDescriptor(fixture, { pid: ownerPid, processStartToken: "stale-owner", plannedChildren: [{ repository: "fixture", phase: "build-and-pack" }] });
	const childrenRoot = path.join(fixture.stateRoot, "locks", "active", "children");
	fs.mkdirSync(childrenRoot, { recursive: true });
	const childRecordPath = path.join(childrenRoot, "0123456789abcdef0123456789abcdef.complete");
	const childRecord = JSON.stringify({
		schemaVersion: 1,
		state: "COMPLETE",
		lockId: "stale-lock",
		workspace: workspaceRecord(fixture.workspaceRoot),
		repository: "fixture",
		phase: "build-and-pack",
		command: { cwd: ".", argv: ["node", "build.mjs"] },
		wrapper: { pid: ownerPid, parentPid: 1, processStartToken: "wrapper", platform: "linux" },
		child: { pid: childPid, parentPid: ownerPid, processStartToken: "child", platform: "linux", kind: "direct", boundary: { kind: "process-group", id: childPid } }
	});
	fs.writeFileSync(childRecordPath, childRecord);
	fs.writeFileSync(path.join(childrenRoot, "0123456789abcdef0123456789abcdef.proof.complete"), JSON.stringify({ schemaVersion: 1, state: "PROOF", childId: "0123456789abcdef0123456789abcdef", recordSha256: createHash("sha256").update(childRecord).digest("hex") }));
	assert.throws(
		() => breakGlassActiveLock(fixture.stateRoot, {
			processEnumerator: () => [{ pid: childPid, parentPid: ownerPid, startToken: "child" }]
		}),
		/owner or a recorded descendant is still alive/u
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
