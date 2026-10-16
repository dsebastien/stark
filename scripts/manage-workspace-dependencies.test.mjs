import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { dependencyInstallInvocationForTest, switchDependencyModeWorkerForTest } from "./manage-workspace-dependencies.mjs";

process.env.STARK_LOCAL_PACKAGE_TEST_MODE = "1";

const packageName = "@example/package";
const canonicalReference = "^1.0.0";
const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, "..");
const launcherPath = path.join(scriptDirectory, "with-project-node.sh");

function json(value) {
	return `${JSON.stringify(value, null, 2)}\n`;
}

function sha512(buffer) {
	return crypto.createHash("sha512").update(buffer).digest("hex");
}

function sha256(buffer) {
	return crypto.createHash("sha256").update(buffer).digest("hex");
}

function runFixtureNpm(repositoryDirectory, arguments_) {
	const result = spawnSync("bash", [launcherPath, "--repo", repositoryDirectory, "--", "npm", ...arguments_], {
		cwd: projectRoot,
		encoding: "utf8"
	});
	assert.equal(result.error, undefined);
	assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
	return result.stdout.trim();
}

function createInstallableArtifact(fixture) {
	const producerDirectory = path.join(fixture.workspaceRoot, "producer");
	fs.writeFileSync(path.join(producerDirectory, ".nvmrc"), "22.22.3\n");
	fs.writeFileSync(
		path.join(producerDirectory, "package.json"),
		json({ name: packageName, version: "1.0.0", main: "index.js", files: ["index.js"] })
	);
	fs.writeFileSync(path.join(producerDirectory, "index.js"), 'module.exports = "local-package";\n');
	const artifactPath = path.join(fixture.generationDescriptor.generationPath, fixture.generationDescriptor.artifacts[0].path);
	fs.rmSync(artifactPath);
	runFixtureNpm(producerDirectory, ["pack", "--pack-destination", path.dirname(artifactPath), "--ignore-scripts"]);
	const artifactBytes = fs.readFileSync(artifactPath);
	const digest = sha512(artifactBytes);
	const integrity = `sha512-${crypto.createHash("sha512").update(artifactBytes).digest("base64")}`;
	fixture.generationDescriptor.artifacts[0].sha512 = digest;
	fixture.generationProof.result.artifacts[0].sha512 = digest;
	fixture.generationProof.result.artifacts[0].tarballIntegrity = integrity;
	return { artifactPath, integrity };
}

function backupRecord(workspaceRoot, filePath) {
	const contents = fs.readFileSync(filePath);
	return {
		path: path.relative(workspaceRoot, filePath).split(path.sep).join("/"),
		sha256: sha256(contents),
		contents: contents.toString("base64")
	};
}

function transactionPath(fixture) {
	return path.join(fixture.workspaceRoot, "tmp", "local-dependency-mode", "transaction.json");
}

function statePath(fixture) {
	return path.join(fixture.workspaceRoot, "tmp", "local-dependency-mode", "state.json");
}

function createDanglingStateLink(fixture) {
	const linkPath = statePath(fixture);
	const targetPath = path.join(fixture.workspaceRoot, "tmp", "dangling-state-target");
	fs.mkdirSync(path.dirname(linkPath), { recursive: true });
	fs.mkdirSync(targetPath, { recursive: true });
	fs.symlinkSync(targetPath, linkPath, process.platform === "win32" ? "junction" : "dir");
	fs.rmSync(targetPath, { recursive: true });
}

function canonicalTransaction(fixture) {
	const backups = [];
	for (let index = 0; index < fixture.map.consumers.length; index += 1) {
		backups.push(backupRecord(fixture.workspaceRoot, fixture.consumerPath(index, "package.json")));
		backups.push(backupRecord(fixture.workspaceRoot, fixture.consumerPath(index, "package-lock.json")));
	}
	backups.push({ path: "tmp/local-dependency-mode/state.json", exists: false });
	return { schemaVersion: 1, sourceMode: "canonical", backups };
}

function localTransaction(fixture) {
	const transaction = canonicalTransaction(fixture);
	transaction.sourceMode = "local";
	transaction.backups[transaction.backups.length - 1] = backupRecord(fixture.workspaceRoot, statePath(fixture));
	return transaction;
}

function writeTransaction(fixture, transaction) {
	fs.mkdirSync(path.dirname(transactionPath(fixture)), { recursive: true });
	fs.writeFileSync(transactionPath(fixture), json(transaction));
}

function createFixture(name, consumerCount = 1) {
	const workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), `stark-deps-${name}-`));
	const producerDirectory = path.join(workspaceRoot, "producer");
	const generationPath = path.join(
		workspaceRoot,
		"tmp",
		"local-package-state",
		"generations",
		"0123456789abcdef0123456789abcdef.complete"
	);
	const artifactDirectory = path.join(generationPath, "artifacts");
	const artifactName = "example-package-1.0.0.tgz";
	const artifactPath = path.join(artifactDirectory, artifactName);
	const artifactBytes = Buffer.from("immutable package bytes");
	fs.mkdirSync(producerDirectory, { recursive: true });
	fs.mkdirSync(artifactDirectory, { recursive: true });
	fs.writeFileSync(artifactPath, artifactBytes);

	const repositories = [
		{
			id: "producer",
			directory: "producer",
			packages: [
				{
					name: packageName,
					artifact: { expectedName: `example-package-{packageVersion}.tgz` }
				}
			]
		}
	];
	const consumers = [];
	for (let index = 0; index < consumerCount; index += 1) {
		const repository = `consumer-${index}`;
		const repositoryDirectory = path.join(workspaceRoot, repository);
		fs.mkdirSync(repositoryDirectory, { recursive: true });
		fs.writeFileSync(path.join(repositoryDirectory, ".nvmrc"), "22.22.3\n");
		fs.writeFileSync(
			path.join(repositoryDirectory, "package.json"),
			json({
				name: repository,
				dependencies: { [packageName]: canonicalReference }
			})
		);
		fs.writeFileSync(
			path.join(repositoryDirectory, "package-lock.json"),
			json({
				name: repository,
				lockfileVersion: 3,
				packages: { "": { dependencies: { [packageName]: canonicalReference } } }
			})
		);
		repositories.push({ id: repository, directory: repository, packages: [] });
		consumers.push({
			repository,
			manifest: "package.json",
			section: "dependencies",
			field: packageName,
			package: packageName,
			reference: "file:../producer/dist/example-package-{packageVersion}.tgz",
			canonicalReference
		});
	}

	const map = { schemaVersion: 2, repositories, consumers };
	const generationDescriptor = {
		generationId: "0123456789abcdef0123456789abcdef",
		generationPath,
		artifacts: [{ path: `artifacts/${artifactName}`, sha512: sha512(artifactBytes) }]
	};
	const generationProof = {
		result: {
			artifacts: [
				{
					artifact: `artifacts/${artifactName}`,
					package: packageName,
					version: "1.0.0",
					sha512: sha512(artifactBytes),
					tarballIntegrity: `sha512-${crypto.createHash("sha512").update(artifactBytes).digest("base64")}`
				}
			]
		}
	};
	const installCalls = [];
	const runInstall = ({ lockfilePath, consumers: lockConsumers }) => {
		installCalls.push(lockfilePath);
		const manifest = JSON.parse(fs.readFileSync(path.join(path.dirname(lockfilePath), "package.json"), "utf8"));
		const reference = manifest.dependencies[packageName];
		fs.writeFileSync(
			lockfilePath,
			json({
				name: manifest.name,
				lockfileVersion: 3,
				packages: {
					"": { dependencies: { [packageName]: reference } },
					[`node_modules/${packageName}`]: {
						version: "1.0.0",
						resolved: reference,
						integrity: lockConsumers[0].artifact.tarballIntegrity
					}
				}
			})
		);
	};
	return {
		workspaceRoot,
		map,
		generationDescriptor,
		generationProof,
		installCalls,
		runInstall,
		consumerPath(index, file) {
			return path.join(workspaceRoot, `consumer-${index}`, file);
		}
	};
}

function options(fixture, overrides = {}) {
	return {
		workspaceRoot: fixture.workspaceRoot,
		map: fixture.map,
		validateMap: () => undefined,
		buildGeneration: () => fixture.generationDescriptor,
		validateGeneration: () => fixture.generationProof,
		runInstall: fixture.runInstall,
		...overrides
	};
}

test("local mode consumes one validated immutable generation and is idempotent", () => {
	const fixture = createFixture("local-idempotent");
	let builds = 0;
	const result = switchDependencyModeWorkerForTest(
		"local",
		options(fixture, {
			buildGeneration: () => {
				builds += 1;
				return fixture.generationDescriptor;
			}
		})
	);
	const manifest = JSON.parse(fs.readFileSync(fixture.consumerPath(0, "package.json"), "utf8"));
	const reference = manifest.dependencies[packageName];

	assert.equal(result.changed, true);
	assert.equal(builds, 1);
	assert.equal(fixture.installCalls.length, 1);
	assert.match(
		reference,
		/^file:\.\.\/tmp\/local-package-state\/generations\/0123456789abcdef0123456789abcdef\.complete\/artifacts\/example-package-1\.0\.0\.tgz$/u
	);
	assert.equal(path.isAbsolute(reference.slice("file:".length)), false);

	const second = switchDependencyModeWorkerForTest(
		"local",
		options(fixture, {
			buildGeneration: () => {
				builds += 1;
				return fixture.generationDescriptor;
			}
		})
	);
	assert.equal(second.changed, false);
	assert.equal(builds, 1);
	assert.equal(fixture.installCalls.length, 1);
});

test("local mode supports a clean install from the generated tarball at its recorded integrity", () => {
	const fixture = createFixture("local-clean-install");
	const { integrity } = createInstallableArtifact(fixture);
	const consumerDirectory = path.dirname(fixture.consumerPath(0, "package.json"));

	const result = switchDependencyModeWorkerForTest("local", options(fixture, { runInstall: undefined }));
	assert.equal(result.changed, true);
	const lock = JSON.parse(fs.readFileSync(fixture.consumerPath(0, "package-lock.json"), "utf8"));
	assert.equal(lock.packages[`node_modules/${packageName}`].integrity, integrity);

	fs.rmSync(path.join(consumerDirectory, "node_modules"), { recursive: true, force: true });
	runFixtureNpm(consumerDirectory, ["ci", "--ignore-scripts", "--offline", "--no-audit", "--no-fund"]);
	const installed = JSON.parse(fs.readFileSync(path.join(consumerDirectory, "node_modules", packageName, "package.json"), "utf8"));
	assert.equal(installed.name, packageName);
	assert.equal(installed.version, "1.0.0");
});

test("canonical mode regenerates locks and restores canonical bytes exactly", () => {
	const fixture = createFixture("canonical-roundtrip");
	const manifestPath = fixture.consumerPath(0, "package.json");
	const lockfilePath = fixture.consumerPath(0, "package-lock.json");
	const canonicalManifest = fs.readFileSync(manifestPath);
	const canonicalLock = fs.readFileSync(lockfilePath);

	switchDependencyModeWorkerForTest("local", options(fixture));
	const installsAfterLocal = fixture.installCalls.length;
	const canonical = switchDependencyModeWorkerForTest(
		"canonical",
		options(fixture, {
			runInstall: ({ lockfilePath: currentLockfile }) => {
				fixture.installCalls.push(currentLockfile);
			}
		})
	);

	assert.equal(canonical.changed, true);
	assert.equal(fixture.installCalls.length, installsAfterLocal + 1);
	assert.deepEqual(fs.readFileSync(manifestPath), canonicalManifest);
	assert.deepEqual(fs.readFileSync(lockfilePath), canonicalLock);

	const second = switchDependencyModeWorkerForTest("canonical", options(fixture));
	assert.equal(second.changed, false);
	assert.equal(fixture.installCalls.length, installsAfterLocal + 1);
});

test("a failed lock regeneration rolls every manifest and lock back", () => {
	const fixture = createFixture("transaction", 2);
	const before = [0, 1].flatMap((index) =>
		["package.json", "package-lock.json"].map((file) => [
			fixture.consumerPath(index, file),
			fs.readFileSync(fixture.consumerPath(index, file))
		])
	);
	let calls = 0;

	assert.throws(
		() =>
			switchDependencyModeWorkerForTest(
				"local",
				options(fixture, {
					runInstall: (context) => {
						calls += 1;
						if (calls === 2) throw new Error("fixture install failed");
						fixture.runInstall(context);
					}
				})
			),
		/fixture install failed/u
	);

	for (const [filePath, contents] of before) assert.deepEqual(fs.readFileSync(filePath), contents);
	assert.equal(fs.existsSync(path.join(fixture.workspaceRoot, "tmp", "local-dependency-mode", "transaction.json")), false);
});

test("lock regeneration cannot change another managed manifest or lock", () => {
	const fixture = createFixture("installer-boundary", 2);
	const before = [0, 1].flatMap((index) =>
		["package.json", "package-lock.json"].map((file) => [
			fixture.consumerPath(index, file),
			fs.readFileSync(fixture.consumerPath(index, file))
		])
	);

	assert.throws(
		() =>
			switchDependencyModeWorkerForTest(
				"local",
				options(fixture, {
					runInstall: (context) => {
						fixture.runInstall(context);
						fs.appendFileSync(fixture.consumerPath(1, "package.json"), " \n");
					}
				})
			),
		/changed an unmanaged target/u
	);

	for (const [filePath, contents] of before) assert.deepEqual(fs.readFileSync(filePath), contents);
});

test("the authoritative transaction snapshot is revalidated immediately before first mutation", () => {
	const fixture = createFixture("transaction-boundary");
	const manifestPath = fixture.consumerPath(0, "package.json");
	const before = fs.readFileSync(manifestPath);

	assert.throws(
		() =>
			switchDependencyModeWorkerForTest(
				"local",
				options(fixture, {
					afterTransactionForTest: () => fs.appendFileSync(manifestPath, " \n")
				})
			),
		/identity or contents changed/u
	);

	assert.deepEqual(fs.readFileSync(manifestPath), before);
	assert.equal(fs.existsSync(transactionPath(fixture)), false);
});

test("a lockfile integrity mismatch fails closed and restores canonical mode", () => {
	const fixture = createFixture("integrity");
	const manifestPath = fixture.consumerPath(0, "package.json");
	const before = fs.readFileSync(manifestPath);

	assert.throws(
		() =>
			switchDependencyModeWorkerForTest(
				"local",
				options(fixture, {
					runInstall: (context) => {
						fixture.runInstall(context);
						const lock = JSON.parse(fs.readFileSync(context.lockfilePath));
						lock.packages[`node_modules/${packageName}`].integrity = "sha512-wrong";
						fs.writeFileSync(context.lockfilePath, json(lock));
					}
				})
			),
		/integrity/u
	);
	assert.deepEqual(fs.readFileSync(manifestPath), before);
});

test("mixed canonical and local references are rejected before mutation", () => {
	const fixture = createFixture("mixed", 2);
	const manifestPath = fixture.consumerPath(1, "package.json");
	const manifest = JSON.parse(fs.readFileSync(manifestPath));
	manifest.dependencies[packageName] = "file:../producer/dist/example-package-1.0.0.tgz";
	fs.writeFileSync(manifestPath, json(manifest));

	assert.throws(() => switchDependencyModeWorkerForTest("canonical", options(fixture)), /mixed or unknown dependency mode/u);
	assert.equal(fixture.installCalls.length, 0);
});

test("canonical mode refuses to discard files edited after local switching", () => {
	const fixture = createFixture("edited-local");
	switchDependencyModeWorkerForTest("local", options(fixture));
	const manifestPath = fixture.consumerPath(0, "package.json");
	const manifest = JSON.parse(fs.readFileSync(manifestPath));
	manifest.description = "unrelated local edit";
	fs.writeFileSync(manifestPath, json(manifest));

	assert.throws(() => switchDependencyModeWorkerForTest("canonical", options(fixture)), /changed after local mode/u);
	assert.equal(JSON.parse(fs.readFileSync(manifestPath)).description, "unrelated local edit");
});

test("an idempotent local invocation still rejects a changed lock integrity", () => {
	const fixture = createFixture("local-recheck");
	switchDependencyModeWorkerForTest("local", options(fixture));
	const lockfilePath = fixture.consumerPath(0, "package-lock.json");
	const lock = JSON.parse(fs.readFileSync(lockfilePath));
	lock.packages[`node_modules/${packageName}`].integrity = "sha512-changed";
	fs.writeFileSync(lockfilePath, json(lock));

	assert.throws(() => switchDependencyModeWorkerForTest("local", options(fixture)), /wrong integrity/u);
});

test("canonical manifests with a stale local lock are rejected as mixed", () => {
	const fixture = createFixture("canonical-lock");
	const lockfilePath = fixture.consumerPath(0, "package-lock.json");
	const lock = JSON.parse(fs.readFileSync(lockfilePath));
	lock.packages[""].dependencies[packageName] = "file:../old-package.tgz";
	fs.writeFileSync(lockfilePath, json(lock));

	assert.throws(() => switchDependencyModeWorkerForTest("canonical", options(fixture)), /mixed dependency mode/u);
});

test("a later operation restores a completely validated canonical journal before mode detection", () => {
	const fixture = createFixture("stale-transaction");
	const manifestPath = fixture.consumerPath(0, "package.json");
	const canonical = fs.readFileSync(manifestPath);
	const transaction = canonicalTransaction(fixture);
	const changed = JSON.parse(canonical);
	changed.dependencies[packageName] = "file:../partial-switch.tgz";
	fs.writeFileSync(manifestPath, json(changed));
	writeTransaction(fixture, transaction);

	const result = switchDependencyModeWorkerForTest("canonical", options(fixture));
	assert.equal(result.changed, false);
	assert.deepEqual(fs.readFileSync(manifestPath), canonical);
});

test("validated recovery safely recreates a lockfile removed by an interrupted installer", () => {
	const fixture = createFixture("missing-lock-recovery");
	const lockfilePath = fixture.consumerPath(0, "package-lock.json");
	const canonical = fs.readFileSync(lockfilePath);
	const transaction = canonicalTransaction(fixture);
	fs.rmSync(lockfilePath);
	writeTransaction(fixture, transaction);

	const result = switchDependencyModeWorkerForTest("canonical", options(fixture));
	assert.equal(result.changed, false);
	assert.deepEqual(fs.readFileSync(lockfilePath), canonical);
});

test("recovery rejects replacement of a file that it already restored", () => {
	const fixture = createFixture("recovery-replacement", 2);
	const transaction = canonicalTransaction(fixture);
	const firstRestoredPath = path.join(fixture.workspaceRoot, transaction.backups[0].path);
	writeTransaction(fixture, transaction);
	let replaced = false;

	assert.throws(
		() =>
			switchDependencyModeWorkerForTest(
				"canonical",
				options(fixture, {
					afterRestoreRecordForTest: ({ index }) => {
						if (index !== 1 || replaced) return;
						const replacementPath = `${firstRestoredPath}.replacement`;
						fs.writeFileSync(replacementPath, fs.readFileSync(firstRestoredPath));
						fs.renameSync(replacementPath, firstRestoredPath);
						replaced = true;
					}
				})
			),
		/identity or contents changed/u
	);

	assert.equal(replaced, true);
	assert.equal(fs.existsSync(transactionPath(fixture)), true);
});

test("recovery retains its journal when an expected-absent state path is a dangling link", (context) => {
	const fixture = createFixture("recovery-dangling-state");
	writeTransaction(fixture, canonicalTransaction(fixture));
	try {
		createDanglingStateLink(fixture);
	} catch (error) {
		if (["EPERM", "EACCES", "ENOTSUP"].includes(error.code)) {
			context.skip(`dangling-link fixture is unsupported: ${error.code}`);
			return;
		}
		throw error;
	}

	assert.throws(() => switchDependencyModeWorkerForTest("canonical", options(fixture)), /unique regular file|symbolic link or reparse/u);
	assert.equal(fs.existsSync(transactionPath(fixture)), true);
});

test("journal path tampering cannot overwrite a file outside the exact managed set", () => {
	const fixture = createFixture("journal-path-tampering");
	const outsidePath = path.join(fixture.workspaceRoot, "outside.txt");
	fs.writeFileSync(outsidePath, "keep me");
	const transaction = canonicalTransaction(fixture);
	transaction.backups[0] = backupRecord(fixture.workspaceRoot, outsidePath);
	writeTransaction(fixture, transaction);

	assert.throws(() => switchDependencyModeWorkerForTest("canonical", options(fixture)), /exact managed-file set/u);
	assert.equal(fs.readFileSync(outsidePath, "utf8"), "keep me");
});

test("journal content tampering is rejected before recovery mutates managed files", () => {
	const fixture = createFixture("journal-content-tampering");
	const manifestPath = fixture.consumerPath(0, "package.json");
	const before = fs.readFileSync(manifestPath);
	const transaction = canonicalTransaction(fixture);
	transaction.backups[0].contents = Buffer.from("tampered").toString("base64");
	writeTransaction(fixture, transaction);

	assert.throws(() => switchDependencyModeWorkerForTest("canonical", options(fixture)), /invalid base64 or digest/u);
	assert.deepEqual(fs.readFileSync(manifestPath), before);
});

test("a journal with non-canonical base64 is rejected even when its digest matches", () => {
	const fixture = createFixture("journal-base64-tampering");
	const transaction = canonicalTransaction(fixture);
	transaction.backups[0].contents = "YQ";
	transaction.backups[0].sha256 = sha256(Buffer.from("a"));
	writeTransaction(fixture, transaction);

	assert.throws(() => switchDependencyModeWorkerForTest("canonical", options(fixture)), /invalid base64 or digest/u);
});

test("a journal with unknown schema fields is rejected", () => {
	const fixture = createFixture("journal-schema-tampering");
	const transaction = { ...canonicalTransaction(fixture), ownerPid: process.pid };
	writeTransaction(fixture, transaction);

	assert.throws(() => switchDependencyModeWorkerForTest("canonical", options(fixture)), /transaction schema is malformed/u);
});

test("a journal with an omitted managed record is rejected", () => {
	const fixture = createFixture("journal-omitted-record");
	const transaction = canonicalTransaction(fixture);
	transaction.backups.splice(1, 1);
	writeTransaction(fixture, transaction);

	assert.throws(() => switchDependencyModeWorkerForTest("canonical", options(fixture)), /exact managed-file set/u);
});

test("a journal with a duplicate managed record is rejected", () => {
	const fixture = createFixture("journal-duplicate-record");
	const transaction = canonicalTransaction(fixture);
	transaction.backups[1] = { ...transaction.backups[0] };
	writeTransaction(fixture, transaction);

	assert.throws(() => switchDependencyModeWorkerForTest("canonical", options(fixture)), /exact managed-file set/u);
});

test("journal canonical-reference tampering is rejected before recovery", () => {
	const fixture = createFixture("journal-canonical-semantics");
	const transaction = canonicalTransaction(fixture);
	const manifestRecord = transaction.backups.find((record) => record.path.endsWith("/package.json"));
	const manifest = JSON.parse(Buffer.from(manifestRecord.contents, "base64").toString("utf8"));
	manifest.dependencies[packageName] = "^9.9.9";
	const contents = Buffer.from(json(manifest));
	manifestRecord.contents = contents.toString("base64");
	manifestRecord.sha256 = sha256(contents);
	writeTransaction(fixture, transaction);

	assert.throws(() => switchDependencyModeWorkerForTest("canonical", options(fixture)), /unapproved reference/u);
});

test("a local journal with forged matching hashes but invalid generation semantics is rejected", () => {
	const fixture = createFixture("journal-local-semantics");
	switchDependencyModeWorkerForTest("local", options(fixture));
	const transaction = localTransaction(fixture);
	const lockRecord = transaction.backups.find((record) => record.path.endsWith("/package-lock.json"));
	const lock = JSON.parse(Buffer.from(lockRecord.contents, "base64").toString("utf8"));
	lock.packages[`node_modules/${packageName}`].integrity = "sha512-forged";
	const lockContents = Buffer.from(json(lock));
	lockRecord.contents = lockContents.toString("base64");
	lockRecord.sha256 = sha256(lockContents);
	const stateRecord = transaction.backups.at(-1);
	const state = JSON.parse(Buffer.from(stateRecord.contents, "base64").toString("utf8"));
	state.localFiles.find((record) => record.path === lockRecord.path).sha256 = lockRecord.sha256;
	const stateContents = Buffer.from(json(state));
	stateRecord.contents = stateContents.toString("base64");
	stateRecord.sha256 = sha256(stateContents);
	writeTransaction(fixture, transaction);

	assert.throws(() => switchDependencyModeWorkerForTest("canonical", options(fixture)), /invalid generation semantics/u);
});

test("local state content tampering is rejected before canonical restoration", () => {
	const fixture = createFixture("state-content-tampering");
	switchDependencyModeWorkerForTest("local", options(fixture));
	const state = JSON.parse(fs.readFileSync(statePath(fixture), "utf8"));
	state.canonicalFiles[0].contents = Buffer.from("tampered").toString("base64");
	fs.writeFileSync(statePath(fixture), json(state));

	assert.throws(() => switchDependencyModeWorkerForTest("canonical", options(fixture)), /invalid base64 or digest/u);
});

test("local state with unknown schema fields is rejected", () => {
	const fixture = createFixture("state-schema-tampering");
	switchDependencyModeWorkerForTest("local", options(fixture));
	const state = JSON.parse(fs.readFileSync(statePath(fixture), "utf8"));
	state.ownerPid = process.pid;
	fs.writeFileSync(statePath(fixture), json(state));

	assert.throws(() => switchDependencyModeWorkerForTest("canonical", options(fixture)), /state schema is malformed/u);
});

test("local state with an omitted canonical record is rejected", () => {
	const fixture = createFixture("state-omitted-record");
	switchDependencyModeWorkerForTest("local", options(fixture));
	const state = JSON.parse(fs.readFileSync(statePath(fixture), "utf8"));
	state.canonicalFiles.pop();
	fs.writeFileSync(statePath(fixture), json(state));

	assert.throws(() => switchDependencyModeWorkerForTest("canonical", options(fixture)), /exact managed-file set/u);
});

test("local state with a duplicate local record is rejected", () => {
	const fixture = createFixture("state-duplicate-record");
	switchDependencyModeWorkerForTest("local", options(fixture));
	const state = JSON.parse(fs.readFileSync(statePath(fixture), "utf8"));
	state.localFiles[1] = { ...state.localFiles[0] };
	fs.writeFileSync(statePath(fixture), json(state));

	assert.throws(() => switchDependencyModeWorkerForTest("canonical", options(fixture)), /exact managed-file set/u);
});

test("local state canonical-reference tampering is rejected even with a matching digest", () => {
	const fixture = createFixture("state-canonical-semantics");
	switchDependencyModeWorkerForTest("local", options(fixture));
	const state = JSON.parse(fs.readFileSync(statePath(fixture), "utf8"));
	const manifestRecord = state.canonicalFiles.find((record) => record.path.endsWith("/package.json"));
	const manifest = JSON.parse(Buffer.from(manifestRecord.contents, "base64").toString("utf8"));
	manifest.dependencies[packageName] = "^9.9.9";
	const contents = Buffer.from(json(manifest));
	manifestRecord.contents = contents.toString("base64");
	manifestRecord.sha256 = sha256(contents);
	fs.writeFileSync(statePath(fixture), json(state));

	assert.throws(() => switchDependencyModeWorkerForTest("canonical", options(fixture)), /unapproved reference/u);
});

test("an idempotent local invocation rejects a hardlinked state file", () => {
	const fixture = createFixture("state-hardlink");
	switchDependencyModeWorkerForTest("local", options(fixture));
	fs.linkSync(statePath(fixture), `${statePath(fixture)}.alias`);

	assert.throws(() => switchDependencyModeWorkerForTest("local", options(fixture)), /unique regular file/u);
});

test("an idempotent local invocation rejects a symlinked state file", (context) => {
	const fixture = createFixture("state-symlink");
	switchDependencyModeWorkerForTest("local", options(fixture));
	const actualStatePath = `${statePath(fixture)}.actual`;
	fs.renameSync(statePath(fixture), actualStatePath);
	try {
		fs.symlinkSync(actualStatePath, statePath(fixture), "file");
	} catch (error) {
		if (["EPERM", "EACCES", "ENOTSUP"].includes(error.code)) {
			context.skip(`symlink fixture is unsupported: ${error.code}`);
			return;
		}
		throw error;
	}

	assert.throws(() => switchDependencyModeWorkerForTest("local", options(fixture)), /symbolic link or reparse|unique regular file/u);
});

test("an idempotent canonical invocation rejects a dangling state link", (context) => {
	const fixture = createFixture("canonical-dangling-state");
	try {
		createDanglingStateLink(fixture);
	} catch (error) {
		if (["EPERM", "EACCES", "ENOTSUP"].includes(error.code)) {
			context.skip(`dangling-link fixture is unsupported: ${error.code}`);
			return;
		}
		throw error;
	}

	assert.throws(() => switchDependencyModeWorkerForTest("canonical", options(fixture)), /unexpected local dependency state/u);
});

test("a symlink or junction ancestor in the managed set is rejected", (context) => {
	const fixture = createFixture("managed-reparse");
	const consumerDirectory = path.dirname(fixture.consumerPath(0, "package.json"));
	const actualDirectory = `${consumerDirectory}-actual`;
	fs.renameSync(consumerDirectory, actualDirectory);
	try {
		fs.symlinkSync(actualDirectory, consumerDirectory, process.platform === "win32" ? "junction" : "dir");
	} catch (error) {
		if (["EPERM", "EACCES", "ENOTSUP"].includes(error.code)) {
			context.skip(`reparse fixture is unsupported: ${error.code}`);
			return;
		}
		throw error;
	}

	assert.throws(() => switchDependencyModeWorkerForTest("canonical", options(fixture)), /symbolic link or reparse ancestor/u);
});

test("a hardlinked managed file is rejected", () => {
	const fixture = createFixture("managed-hardlink");
	const lockfilePath = fixture.consumerPath(0, "package-lock.json");
	const hardlinkPath = fixture.consumerPath(0, "package-lock-copy.json");
	fs.linkSync(lockfilePath, hardlinkPath);

	assert.throws(() => switchDependencyModeWorkerForTest("canonical", options(fixture)), /unique regular file/u);
});

test("nested lock regeneration uses npm --prefix through the verified launcher", () => {
	const fixture = createFixture("nested-prefix");
	const repositoryDirectory = path.join(fixture.workspaceRoot, "consumer-0");
	const lockfilePath = path.join(repositoryDirectory, "nested", "application", "package-lock.json");
	const invocation = dependencyInstallInvocationForTest({
		repository: fixture.map.repositories.find((entry) => entry.id === "consumer-0"),
		repositoryDirectory,
		lockfilePath
	});

	assert.equal(invocation.command, "bash");
	assert.equal(path.isAbsolute(invocation.arguments_[0]), true);
	assert.match(invocation.arguments_[0].split(path.sep).join("/"), /scripts\/with-project-node\.sh$/u);
	assert.deepEqual(invocation.arguments_.slice(1), [
		"--repo",
		repositoryDirectory,
		"--",
		"npm",
		"--prefix",
		"nested/application",
		"install",
		"--package-lock-only",
		"--ignore-scripts",
		"--no-audit",
		"--no-fund"
	]);
});
