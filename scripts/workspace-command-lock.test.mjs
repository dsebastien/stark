import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
	assertExclusiveWorkspaceCommandWorker,
	assertRegularFileSet,
	breakGlassActiveLock,
	captureRegularFileSet,
	runExclusiveWorkspaceCommand
} from "./build-local-packages.mjs";

process.env.STARK_LOCAL_PACKAGE_TEST_MODE = "1";

function fixture(name) {
	const workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), `stark-operation-lock-${name}-`));
	const repositoryDirectory = path.join(workspaceRoot, "repository");
	const stateRoot = path.join(workspaceRoot, "tmp", "operation-lock");
	fs.mkdirSync(repositoryDirectory);
	fs.writeFileSync(path.join(repositoryDirectory, ".nvmrc"), "22.22.3\n");
	fs.writeFileSync(
		path.join(repositoryDirectory, "package.json"),
		`${JSON.stringify({ name: "fixture", engines: { npm: ">=10.9.4" } }, null, 2)}\n`
	);
	fs.writeFileSync(
		path.join(repositoryDirectory, "worker.mjs"),
		[
			`import { assertExclusiveWorkspaceCommandWorker } from ${JSON.stringify(new URL("./build-local-packages.mjs", import.meta.url).href)};`,
			`assertExclusiveWorkspaceCommandWorker(${JSON.stringify({ workspaceRoot, stateRoot, repositoryId: "fixture", phase: "dependency-mode-worker" })});`,
			'process.stdout.write("worker-ok");',
			""
		].join("\n")
	);
	return {
		workspaceRoot,
		stateRoot,
		repository: {
			id: "fixture",
			directory: "repository",
			node: { versionFile: ".nvmrc", required: true, requirement: "22.22.3" }
		}
	};
}

function invocation(fixtureValue) {
	return {
		workspaceRoot: fixtureValue.workspaceRoot,
		stateRoot: fixtureValue.stateRoot,
		repository: fixtureValue.repository,
		command: { phase: "dependency-mode-worker", cwd: ".", argv: ["node", "worker.mjs"] }
	};
}

function wait(milliseconds) {
	return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function waitFor(predicate, message, timeout = 60_000) {
	const deadline = Date.now() + timeout;
	while (Date.now() < deadline) {
		if (predicate()) return;
		await wait(50);
	}
	throw new Error(message);
}

function processExists(pid) {
	try {
		process.kill(pid, 0);
		return true;
	} catch (error) {
		return error.code !== "ESRCH";
	}
}

function terminateRecordedBoundary(identity) {
	if (process.platform === "win32") {
		const script = `$roots=@(${identity.wrapper.pid},${identity.child.pid}); $all=Get-CimInstance Win32_Process; $targets=[System.Collections.Generic.HashSet[int]]::new(); foreach($root in $roots){[void]$targets.Add($root)}; do {$changed=$false; foreach($p in $all){if($targets.Contains([int]$p.ParentProcessId) -and $targets.Add([int]$p.ProcessId)){$changed=$true}}} while($changed); foreach($pidValue in $targets){Stop-Process -Id $pidValue -Force -ErrorAction SilentlyContinue}`;
		spawnSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script], { stdio: "ignore" });
		return;
	}
	if (identity.child.boundary?.kind === "process-group") {
		try {
			process.kill(-identity.child.boundary.id, "SIGKILL");
		} catch (error) {
			if (error.code !== "ESRCH") throw error;
		}
	}
	try {
		process.kill(identity.wrapper.pid, "SIGKILL");
	} catch (error) {
		if (error.code !== "ESRCH") throw error;
	}
}

test("exclusive workspace command records and releases one verified child boundary", () => {
	const current = fixture("success");
	const result = runExclusiveWorkspaceCommand(invocation(current), { capture: true });

	assert.equal(result, "worker-ok");
	assert.equal(fs.existsSync(path.join(current.stateRoot, "locks", "active")), false);
	assert.equal(fs.readdirSync(path.join(current.stateRoot, "locks", "released")).length, 1);
});

test("a crash after the first child-marker cleanup remains recoverable", () => {
	const current = fixture("partial-marker-cleanup");
	let injected = false;

	assert.throws(
		() =>
			runExclusiveWorkspaceCommand(invocation(current), {
				capture: true,
				afterFirstChildMarkerUnlinkForTest: () => {
					injected = true;
					throw new Error("simulated marker-cleanup crash");
				}
			}),
		/simulated marker-cleanup crash/u
	);

	assert.equal(injected, true);
	assert.equal(fs.existsSync(path.join(current.stateRoot, "locks", "active")), false);
	const released = path.join(
		current.stateRoot,
		"locks",
		"released",
		fs.readdirSync(path.join(current.stateRoot, "locks", "released"))[0]
	);
	const children = fs.readdirSync(path.join(released, "children"));
	assert.equal(
		children.some((entry) => entry.endsWith(".running")),
		true
	);
	assert.equal(
		children.some((entry) => entry.endsWith(".complete")),
		true
	);
	assert.equal(
		children.some((entry) => entry.endsWith(".proof.complete")),
		true
	);
});

test("a workspace worker cannot bypass the active operation lock", () => {
	const current = fixture("worker-bypass");
	fs.mkdirSync(current.stateRoot, { recursive: true });
	assert.throws(
		() =>
			assertExclusiveWorkspaceCommandWorker({
				workspaceRoot: current.workspaceRoot,
				stateRoot: current.stateRoot,
				repositoryId: "fixture",
				phase: "dependency-mode-worker"
			}),
		/no active operation lock/u
	);
});

test("a worker emitting more than one MiB returns through a bounded atomic result file", () => {
	const current = fixture("large-output-result");
	const workerProof = {
		workspaceRoot: current.workspaceRoot,
		stateRoot: current.stateRoot,
		repositoryId: "fixture",
		phase: "dependency-mode-worker"
	};
	fs.writeFileSync(
		path.join(current.workspaceRoot, "repository", "worker.mjs"),
		[
			`import { assertExclusiveWorkspaceCommandWorker, publishExclusiveWorkspaceCommandResult } from ${JSON.stringify(new URL("./build-local-packages.mjs", import.meta.url).href)};`,
			`const proof = ${JSON.stringify(workerProof)};`,
			"assertExclusiveWorkspaceCommandWorker(proof);",
			'process.stdout.write("x".repeat(1024 * 1024 + 1));',
			'publishExclusiveWorkspaceCommandResult(proof, { ok: true, channel: "atomic-file" });',
			""
		].join("\n")
	);

	const result = runExclusiveWorkspaceCommand(invocation(current), { result: true, suppressOutputForTest: true });
	assert.deepEqual(result, { ok: true, channel: "atomic-file" });
	assert.equal(fs.existsSync(path.join(current.stateRoot, "locks", "active")), false);
	const released = path.join(
		current.stateRoot,
		"locks",
		"released",
		fs.readdirSync(path.join(current.stateRoot, "locks", "released"))[0]
	);
	assert.equal(fs.existsSync(path.join(released, "result.json")), true);
});

test("termination after journal creation recovers only after the recorded worker boundary is quiescent", { timeout: 120_000 }, async () => {
	const current = fixture("terminated-after-journal");
	const workerProof = {
		workspaceRoot: current.workspaceRoot,
		stateRoot: current.stateRoot,
		repositoryId: "fixture",
		phase: "dependency-mode-worker"
	};
	const transactionPath = path.join(current.workspaceRoot, "tmp", "local-dependency-mode", "transaction.json");
	fs.writeFileSync(
		path.join(current.workspaceRoot, "repository", "worker.mjs"),
		[
			`import { assertExclusiveWorkspaceCommandWorker } from ${JSON.stringify(new URL("./build-local-packages.mjs", import.meta.url).href)};`,
			'import fs from "node:fs";',
			'import path from "node:path";',
			`assertExclusiveWorkspaceCommandWorker(${JSON.stringify(workerProof)});`,
			`const journal = ${JSON.stringify(transactionPath)};`,
			"fs.mkdirSync(path.dirname(journal), { recursive: true });",
			'fs.writeFileSync(journal, "journal-created\\n");',
			"setInterval(() => undefined, 1_000);",
			""
		].join("\n")
	);
	const controllerPath = path.join(current.workspaceRoot, "repository", "controller.mjs");
	fs.writeFileSync(
		controllerPath,
		[
			`import { runExclusiveWorkspaceCommand } from ${JSON.stringify(new URL("./build-local-packages.mjs", import.meta.url).href)};`,
			`runExclusiveWorkspaceCommand(${JSON.stringify(invocation(current))});`,
			""
		].join("\n")
	);
	const controller = spawn(process.execPath, [controllerPath], { cwd: path.dirname(controllerPath), stdio: "ignore" });
	let runningIdentity;
	try {
		await waitFor(() => fs.existsSync(transactionPath), "worker did not create its journal");
		const childrenDirectory = path.join(current.stateRoot, "locks", "active", "children");
		await waitFor(
			() => fs.existsSync(childrenDirectory) && fs.readdirSync(childrenDirectory).some((entry) => entry.endsWith(".running")),
			"worker did not persist its running identity"
		);
		const runningPath = path.join(
			childrenDirectory,
			fs.readdirSync(childrenDirectory).find((entry) => entry.endsWith(".running"))
		);
		const lines = fs.readFileSync(runningPath, "utf8").trim().split(/\r?\n/u);
		runningIdentity = JSON.parse(lines.at(-1));
		controller.kill();
		await waitFor(() => !processExists(controller.pid), "operation-lock owner did not terminate");

		assert.throws(() => breakGlassActiveLock(current.stateRoot), /owner or a recorded descendant is still alive/u);
		terminateRecordedBoundary(runningIdentity);
		let recovered;
		const deadline = Date.now() + 30_000;
		while (!recovered && Date.now() < deadline) {
			try {
				recovered = breakGlassActiveLock(current.stateRoot);
			} catch (error) {
				if (!/owner or a recorded descendant is still alive/u.test(error.message)) throw error;
				await wait(100);
			}
		}
		assert.ok(recovered, "recorded worker boundary did not become quiescent");
		assert.equal(fs.existsSync(recovered), true);
		assert.equal(fs.existsSync(transactionPath), true);
	} finally {
		if (controller.pid && processExists(controller.pid)) controller.kill();
		if (runningIdentity) terminateRecordedBoundary(runningIdentity);
	}
});

test("concurrent invocation refuses an active operation lock", () => {
	const current = fixture("concurrent");
	let owner;
	assert.throws(
		() =>
			runExclusiveWorkspaceCommand(invocation(current), {
				abandonAfterAcquireForTest: true,
				onLock: (lock) => {
					owner = lock.descriptor.owner;
				}
			}),
		/abandoned after acquire/u
	);
	assert.throws(
		() =>
			runExclusiveWorkspaceCommand(invocation(current), {
				capture: true,
				processEnumerator: () => [{ pid: owner.pid, parentPid: 0, startToken: owner.processStartToken }]
			}),
		/owner or a recorded descendant is still alive/u
	);
});

test("stale-lock recovery rejects PID reuse", () => {
	const current = fixture("pid-reuse");
	let owner;
	assert.throws(
		() =>
			runExclusiveWorkspaceCommand(invocation(current), {
				abandonAfterAcquireForTest: true,
				onLock: (lock) => {
					owner = lock.descriptor.owner;
				}
			}),
		/abandoned after acquire/u
	);

	assert.throws(
		() =>
			runExclusiveWorkspaceCommand(invocation(current), {
				capture: true,
				processEnumerator: () => [{ pid: owner.pid, parentPid: 0, startToken: `${owner.processStartToken}-reused` }]
			}),
		/PID was reused/u
	);
});

test("stale-lock recovery rejects a live descendant", () => {
	const current = fixture("descendant");
	let owner;
	assert.throws(
		() =>
			runExclusiveWorkspaceCommand(invocation(current), {
				abandonAfterAcquireForTest: true,
				onLock: (lock) => {
					owner = lock.descriptor.owner;
				}
			}),
		/abandoned after acquire/u
	);

	assert.throws(
		() =>
			runExclusiveWorkspaceCommand(invocation(current), {
				capture: true,
				processEnumerator: () => [{ pid: owner.pid + 100_000, parentPid: owner.pid, startToken: "descendant-start" }]
			}),
		/owner or a recorded descendant is still alive/u
	);
});

test("stale-lock recovery fails closed when process enumeration is unavailable", () => {
	const current = fixture("enumeration");
	assert.throws(
		() => runExclusiveWorkspaceCommand(invocation(current), { abandonAfterAcquireForTest: true }),
		/abandoned after acquire/u
	);

	assert.throws(
		() =>
			runExclusiveWorkspaceCommand(invocation(current), {
				capture: true,
				processEnumerator: () => {
					throw new Error("enumeration unavailable");
				}
			}),
		/enumeration unavailable/u
	);
});

test("a quiescent stale operation is recovered before the next worker starts", () => {
	const current = fixture("recover");
	assert.throws(
		() => runExclusiveWorkspaceCommand(invocation(current), { abandonAfterAcquireForTest: true }),
		/abandoned after acquire/u
	);

	const result = runExclusiveWorkspaceCommand(invocation(current), { capture: true, processEnumerator: () => [] });
	assert.equal(result, "worker-ok");
	assert.equal(fs.existsSync(path.join(current.stateRoot, "locks", "active")), false);
	assert.equal(fs.readdirSync(path.join(current.stateRoot, "quarantine")).length, 1);
});

test("managed-file proof revalidation detects replacement immediately before a write", () => {
	const current = fixture("file-revalidation");
	const filePath = path.join(current.workspaceRoot, current.repository.directory, "package.json");
	const proof = captureRegularFileSet(current.workspaceRoot, ["repository/package.json"]);
	fs.writeFileSync(filePath, "{}\n");

	assert.throws(() => assertRegularFileSet(proof), /identity or contents changed/u);
});

test("duplicate managed paths are rejected before capture", () => {
	const current = fixture("duplicate-path");

	assert.throws(
		() => captureRegularFileSet(current.workspaceRoot, ["repository/package.json", "repository/package.json"]),
		/duplicate managed file path/u
	);
});

test("duplicate managed file identities are rejected", () => {
	const current = fixture("duplicate-identity");
	fs.linkSync(
		path.join(current.workspaceRoot, "repository", "package.json"),
		path.join(current.workspaceRoot, "repository", "package-copy.json")
	);

	assert.throws(
		() => captureRegularFileSet(current.workspaceRoot, ["repository/package.json", "repository/package-copy.json"]),
		/duplicate managed file identity/u
	);
});
