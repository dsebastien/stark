import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";

import { PipelineError, formatPipelineError, runPipeline, validateGenerationAt } from "./build-local-packages.mjs";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, "..");
const launcherPath = path.join(scriptDirectory, "with-project-node.sh");
const nodeVersion = process.env.STARK_PROJECT_NODE_VERSION;
const testRoot = fs.mkdtempSync(path.join(os.tmpdir(), "stark-local-output-errors-"));
const previousTestMode = process.env.STARK_LOCAL_PACKAGE_TEST_MODE;

let fixture;
let baseline;
let baselineSnapshot;

function run(command, arguments_, cwd) {
	const result = spawnSync(command, arguments_, { cwd, encoding: "utf8" });
	if (result.status !== 0) throw new Error(`${command} ${arguments_.join(" ")} failed: ${result.stderr}`);
	return result;
}

function currentRuntimeEvidence() {
	const evidence = {
		nodeVersion,
		npmVersion: process.env.STARK_PROJECT_NPM_VERSION,
		nodeExecutable: process.env.STARK_PROJECT_NODE_EXECUTABLE,
		npmExecutable: process.env.STARK_PROJECT_NPM_EXECUTABLE
	};
	for (const [field, value] of Object.entries(evidence)) assert.ok(value, `test process is missing ${field}`);
	return evidence;
}

function createFixture() {
	const workspaceRoot = path.join(testRoot, "workspace");
	const repositoryDirectory = path.join(workspaceRoot, "fixture-repository");
	fs.mkdirSync(repositoryDirectory, { recursive: true });
	fs.writeFileSync(path.join(repositoryDirectory, ".nvmrc"), `${nodeVersion}\n`);
	fs.writeFileSync(path.join(repositoryDirectory, "package.json"), `${JSON.stringify({ name: "@fixture/package", version: "1.0.0" }, null, 2)}\n`);
	fs.writeFileSync(
		path.join(repositoryDirectory, "build.mjs"),
		'import fs from "node:fs";\nconst mode = fs.readFileSync("mode.txt", "utf8").trim();\nif (mode === "fail") process.exit(19);\nfs.mkdirSync("dist", { recursive: true });\nfs.writeFileSync("dist/fixture-package-1.0.0.tgz", `fixture-${Date.now()}`);\n'
	);
	fs.writeFileSync(path.join(repositoryDirectory, "mode.txt"), "success\n");
	run("git", ["init", "--quiet"], repositoryDirectory);
	run("git", ["config", "user.name", "fixture"], repositoryDirectory);
	run("git", ["config", "user.email", "fixture@example.test"], repositoryDirectory);
	run("git", ["add", ".nvmrc", "package.json", "build.mjs"], repositoryDirectory);
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

function runFixture(input = fixture.plan) {
	return runPipeline(input, { runtimeProbe: currentRuntimeEvidence });
}

function stableJson(value) {
	return `${JSON.stringify(value, null, 2)}\n`;
}

function hash(contents, algorithm = "sha256") {
	return createHash(algorithm).update(contents).digest("hex");
}

function snapshotTree(directory) {
	const files = [];
	const visit = (current, relativeDirectory = "") => {
		for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
			const absolutePath = path.join(current, entry.name);
			const relativePath = relativeDirectory ? `${relativeDirectory}/${entry.name}` : entry.name;
			if (entry.isDirectory()) visit(absolutePath, relativePath);
			else files.push([relativePath, fs.readFileSync(absolutePath).toString("base64")]);
		}
	};
	visit(directory);
	return files.sort(([left], [right]) => left.localeCompare(right));
}

function generationEntries(generationPath) {
	const entries = [];
	const visit = (current, relativeDirectory = "") => {
		for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
			const absolutePath = path.join(current, entry.name);
			const relativePath = relativeDirectory ? `${relativeDirectory}/${entry.name}` : entry.name;
			if (entry.isDirectory()) visit(absolutePath, relativePath);
			else if (!["tree.manifest.json", "complete.marker.json"].includes(relativePath)) {
				const stat = fs.lstatSync(absolutePath);
				entries.push({
					path: relativePath,
					identity: `${stat.dev}:${stat.ino}`,
					mode: stat.mode & 0o777,
					size: stat.size,
					sha256: hash(fs.readFileSync(absolutePath))
				});
			}
		}
	};
	visit(generationPath);
	return entries.sort((left, right) => left.path.localeCompare(right.path));
}

function resealGeneration(generationPath, options = {}) {
	if (options.refreshArtifactIdentities !== false) {
		for (const fileName of ["result.json", "provenance.json"]) {
			const filePath = path.join(generationPath, fileName);
			const document = JSON.parse(fs.readFileSync(filePath, "utf8"));
			for (const artifact of document.artifacts) {
				const stat = fs.lstatSync(path.join(generationPath, ...artifact.artifact.split("/")));
				artifact.outputIdentity = `${stat.dev}:${stat.ino}`;
			}
			fs.writeFileSync(filePath, stableJson(document));
		}
	}
	const entries = generationEntries(generationPath);
	const manifest = JSON.parse(fs.readFileSync(path.join(generationPath, "tree.manifest.json"), "utf8"));
	manifest.entries = entries;
	manifest.treeSha256 = hash(stableJson({ schemaVersion: manifest.schemaVersion, entries }));
	fs.writeFileSync(path.join(generationPath, "tree.manifest.json"), stableJson(manifest));
	const markerPath = path.join(generationPath, "complete.marker.json");
	const marker = JSON.parse(fs.readFileSync(markerPath, "utf8"));
	marker.treeSha256 = manifest.treeSha256;
	marker.descriptorSha256 = hash(fs.readFileSync(path.join(generationPath, "descriptor.json")));
	if (options.refreshResultDigest !== false) marker.resultSha256 = hash(fs.readFileSync(path.join(generationPath, "result.json")));
	fs.writeFileSync(markerPath, stableJson(marker));
}

function cloneBaseline(name) {
	const parent = path.join(testRoot, "cases", name);
	const destination = path.join(parent, path.basename(baseline.generationPath));
	fs.mkdirSync(parent, { recursive: true });
	fs.cpSync(baseline.generationPath, destination, { recursive: true, errorOnExist: true });
	resealGeneration(destination);
	validateGenerationAt(destination);
	return destination;
}

function assertBaselineUnchanged() {
	assert.deepEqual(snapshotTree(baseline.generationPath), baselineSnapshot);
	validateGenerationAt(baseline.generationPath, { stateRoot: fixture.stateRoot });
}

function assertRejected(name, mutate, expectedMessage) {
	const generationPath = cloneBaseline(name);
	mutate(generationPath);
	assert.throws(() => validateGenerationAt(generationPath), expectedMessage);
	assertBaselineUnchanged();
}

function artifactPath(generationPath) {
	return path.join(generationPath, "artifacts", "fixture-package-1.0.0.tgz");
}

function withSemanticArtifactLstatFailure(generationPath, code, assertion) {
	const target = path.resolve(artifactPath(generationPath));
	const injected = Object.assign(new Error(`injected ${code} at semantic artifact lstat`), { code });
	const originalLstatSync = fs.lstatSync;
	let targetCalls = 0;
	fs.lstatSync = (filePath, ...arguments_) => {
		if (path.resolve(String(filePath)) === target) {
			targetCalls += 1;
			// Tree traversal and its regular-file record account for the first two
			// observations; containment accounts for the third. Inject only when
			// validation inspects the semantic artifact record.
			if (targetCalls === 4) throw injected;
		}
		return originalLstatSync(filePath, ...arguments_);
	};
	try {
		assertion(injected);
	} finally {
		fs.lstatSync = originalLstatSync;
	}
	assert.equal(targetCalls, 4, "semantic artifact lstat fault was not reached exactly once");
}

function publishedGenerations() {
	return fs.readdirSync(path.join(fixture.stateRoot, "generations")).filter((name) => name.endsWith(".complete"));
}

function quarantineEntries() {
	return fs.readdirSync(path.join(fixture.stateRoot, "quarantine"));
}

before(() => {
	process.env.STARK_LOCAL_PACKAGE_TEST_MODE = "1";
	fixture = createFixture();
	baseline = runFixture();
	baselineSnapshot = snapshotTree(baseline.generationPath);
}, { timeout: 240_000 });

after(() => {
	if (previousTestMode === undefined) delete process.env.STARK_LOCAL_PACKAGE_TEST_MODE;
	else process.env.STARK_LOCAL_PACKAGE_TEST_MODE = previousTestMode;
	fs.rmSync(testRoot, { recursive: true, force: true });
});

test("missing completion marker is never publication authority", () => {
	assertRejected("marker-missing", (generationPath) => fs.rmSync(path.join(generationPath, "complete.marker.json")), /unexpected generation output set/u);
});

test("malformed completion marker is never publication authority", () => {
	assertRejected("marker-malformed", (generationPath) => fs.writeFileSync(path.join(generationPath, "complete.marker.json"), "{not-json\n"), /invalid completion marker/u);
});

test("stale completion marker is never publication authority", () => {
	assertRejected("marker-stale", (generationPath) => {
		const resultPath = path.join(generationPath, "result.json");
		const result = JSON.parse(fs.readFileSync(resultPath, "utf8"));
		result.warnings.push({ phase: "test", message: "changed after marker" });
		fs.writeFileSync(resultPath, stableJson(result));
		resealGeneration(generationPath, { refreshArtifactIdentities: false, refreshResultDigest: false });
	}, /generation metadata digest mismatch/u);
});

test("mismatched completion marker is never publication authority", () => {
	assertRejected("marker-mismatched", (generationPath) => {
		const markerPath = path.join(generationPath, "complete.marker.json");
		const marker = JSON.parse(fs.readFileSync(markerPath, "utf8"));
		marker.generationId = "ffffffffffffffffffffffffffffffff";
		fs.writeFileSync(markerPath, stableJson(marker));
	}, /generation identity mismatch/u);
});

test("checksum corruption is never publication authority", () => {
	assertRejected("checksum-corrupt", (generationPath) => {
		fs.writeFileSync(path.join(generationPath, "checksums.sha256"), `${"0".repeat(64)}  artifacts/fixture-package-1.0.0.tgz\n`);
		resealGeneration(generationPath, { refreshArtifactIdentities: false });
	}, /generated checksums do not match provenance/u);
});

test("provenance corruption is never publication authority", () => {
	assertRejected("provenance-corrupt", (generationPath) => {
		const provenancePath = path.join(generationPath, "provenance.json");
		const provenance = JSON.parse(fs.readFileSync(provenancePath, "utf8"));
		provenance.repositories[0].commit = "0".repeat(40);
		fs.writeFileSync(provenancePath, stableJson(provenance));
		resealGeneration(generationPath, { refreshArtifactIdentities: false });
	}, /generation result and provenance differ/u);
});

test("tree-digest corruption is never publication authority", () => {
	assertRejected("tree-digest-corrupt", (generationPath) => {
		const markerPath = path.join(generationPath, "complete.marker.json");
		const marker = JSON.parse(fs.readFileSync(markerPath, "utf8"));
		marker.treeSha256 = "0".repeat(64);
		fs.writeFileSync(markerPath, stableJson(marker));
	}, /generation tree digest mismatch/u);
});

test("missing artifact is never publication authority", () => {
	assertRejected("artifact-missing", (generationPath) => {
		fs.rmSync(artifactPath(generationPath));
		resealGeneration(generationPath, { refreshArtifactIdentities: false });
	}, (error) => error instanceof PipelineError && error.phase === "output.validation" && /missing generated artifact/u.test(error.message));
});

test("ENOENT at semantic artifact lstat is classified as a structured missing-artifact race", () => {
	const generationPath = cloneBaseline("artifact-lstat-race");
	withSemanticArtifactLstatFailure(generationPath, "ENOENT", (injected) => {
		assert.throws(
			() => validateGenerationAt(generationPath),
			(error) => error instanceof PipelineError
				&& error.phase === "output.validation"
				&& error.message === "missing generated artifact: artifacts/fixture-package-1.0.0.tgz"
				&& error.cause === injected
		);
	});
	assertBaselineUnchanged();
});

test("non-ENOENT artifact lstat failure is preserved as an inspection error", () => {
	const generationPath = cloneBaseline("artifact-lstat-access");
	withSemanticArtifactLstatFailure(generationPath, "EACCES", (injected) => {
		assert.throws(
			() => validateGenerationAt(generationPath),
			(error) => error instanceof PipelineError
				&& error.phase === "output.validation"
				&& error.message === "could not inspect generated artifact artifacts/fixture-package-1.0.0.tgz: injected EACCES at semantic artifact lstat"
				&& error.cause === injected
		);
	});
	assertBaselineUnchanged();
});

test("extra artifact is never publication authority", () => {
	assertRejected("artifact-extra", (generationPath) => {
		fs.writeFileSync(path.join(generationPath, "artifacts", "extra.tgz"), "extra\n");
		resealGeneration(generationPath, { refreshArtifactIdentities: false });
	}, /generated artifact set does not match provenance/u);
});

test("corrupt artifact bytes are never publication authority", () => {
	assertRejected("artifact-corrupt", (generationPath) => {
		fs.appendFileSync(artifactPath(generationPath), "corrupt\n");
		resealGeneration(generationPath, { refreshArtifactIdentities: false });
	}, /artifact checksum mismatch/u);
});

test("duplicate-identity artifacts are never publication authority", () => {
	assertRejected("artifact-duplicate-identity", (generationPath) => {
		fs.linkSync(artifactPath(generationPath), path.join(generationPath, "artifacts", "duplicate.tgz"));
	}, /generated output must be a unique regular file/u);
});

test("real post-rename corruption is quarantined and cannot replace prior authority", { timeout: 240_000 }, () => {
	const originalRenameSync = fs.renameSync;
	const generationsRoot = path.join(fixture.stateRoot, "generations");
	let corruptedPath;
	fs.renameSync = (source, destination) => {
		const result = originalRenameSync(source, destination);
		if (!corruptedPath && path.dirname(source) === generationsRoot && source.endsWith(".incomplete") && destination.endsWith(".complete")) {
			corruptedPath = destination;
			fs.appendFileSync(path.join(destination, "complete.marker.json"), "corrupt-after-real-rename\n");
		}
		return result;
	};
	try {
		assert.throws(() => runFixture(), /invalid completion marker/u);
	} finally {
		fs.renameSync = originalRenameSync;
	}
	assert.ok(corruptedPath, "the real publication rename was not observed");
	assert.equal(fs.existsSync(corruptedPath), false);
	assert.deepEqual(publishedGenerations(), [path.basename(baseline.generationPath)]);
	assert.ok(quarantineEntries().some((name) => name.includes("invalid-complete-generation")));
	assertBaselineUnchanged();
});

test("command failure stays primary when failed-generation quarantine also fails", { timeout: 240_000 }, () => {
	fs.writeFileSync(path.join(fixture.repositoryDirectory, "mode.txt"), "fail\n");
	let error;
	assert.throws(
		() => runFixture({ plan: fixture.plan, faultPlan: { failAt: "failure.quarantine" } }),
		(caught) => {
			error = caught;
			return true;
		}
	);
	const formatted = formatPipelineError(error);
	const primary = formatted.indexOf("command failed (19)");
	const secondary = formatted.indexOf("Secondary failure");
	const quarantine = formatted.indexOf("failure.quarantine");
	assert.equal(primary, 0);
	assert.ok(secondary > primary && quarantine > secondary, formatted);
	assert.equal(publishedGenerations().length, 1);
	assert.ok(fs.readdirSync(path.join(fixture.stateRoot, "generations")).some((name) => name.endsWith(".incomplete")));
	assertBaselineUnchanged();
	fs.writeFileSync(path.join(fixture.repositoryDirectory, "mode.txt"), "success\n");
});

test("successful publication returns no fabricated post-publication cleanup warning", () => {
	assert.deepEqual(baseline.warnings, []);
	assertBaselineUnchanged();
});

test("CLI exits nonzero and emits its structured error on stderr", { timeout: 120_000 }, () => {
	const result = spawnSync("bash", [launcherPath, "--", "node", path.join(scriptDirectory, "build-local-packages.mjs"), "--invalid-output-error-test"], {
		cwd: projectRoot,
		encoding: "utf8",
		env: process.env
	});
	assert.equal(result.status, 1, result.stderr);
	assert.equal(result.stdout, "");
	assert.equal(result.stderr, "Error: unknown or incomplete argument: --invalid-output-error-test\n");
});
