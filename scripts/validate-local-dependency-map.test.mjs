import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { validateMap } from "./validate-local-dependency-map.mjs";

function createFixture() {
	const workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), "stark-dependency-map-"));
	const repositoryDirectory = path.join(workspaceRoot, "fixture-repository");
	fs.mkdirSync(path.join(repositoryDirectory, "consumer"), { recursive: true });
	fs.writeFileSync(path.join(repositoryDirectory, ".nvmrc"), "22.22.3\n");
	fs.writeFileSync(
		path.join(repositoryDirectory, "package.json"),
		JSON.stringify({ name: "@fixture/package", scripts: { build: "build-fixture" } })
	);
	fs.writeFileSync(
		path.join(repositoryDirectory, "consumer", "package.json"),
		JSON.stringify({ devDependencies: { "@fixture/package": "^1.0.0" } })
	);
	const stableRuntimeEvidence = (source) => ({
		source,
		recordAt: ["before-producer-sequence", "after-producer-sequence"],
		requireStable: true
	});
	return {
		workspaceRoot,
		map: {
			schemaVersion: 2,
			runtimeEvidence: {
				sourceCommit: { command: ["git", "rev-parse", "HEAD"], recordAt: "build" },
				tarballIntegrity: { algorithm: "sha512", recordAt: "pack" },
				nodeVersion: stableRuntimeEvidence("STARK_PROJECT_NODE_VERSION"),
				npmVersion: stableRuntimeEvidence("STARK_PROJECT_NPM_VERSION"),
				nodeExecutable: stableRuntimeEvidence("STARK_PROJECT_NODE_EXECUTABLE"),
				npmExecutable: stableRuntimeEvidence("STARK_PROJECT_NPM_EXECUTABLE")
			},
			repositories: [
				{
					id: "fixture",
					directory: "fixture-repository",
					node: { versionFile: ".nvmrc", required: true, requirement: "22.22.3" },
					commands: [
						{ phase: "build", cwd: ".", argv: ["npm", "run", "build"] },
						{ phase: "pack", cwd: "dist", argv: ["npm", "pack", ".", "--silent"] }
					],
					packaging: { implementation: "package.json#scripts.build + npm pack", packCwd: "dist" },
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
			],
			consumers: [
				{
					repository: "fixture",
					manifest: "consumer/package.json",
					section: "devDependencies",
					field: "@fixture/package",
					package: "@fixture/package",
					reference: "file:../dist/fixture-package-{packageVersion}.tgz",
					canonicalReference: "^1.0.0"
				}
			]
		}
	};
}

test("allows a later pack command to use the output directory created by an earlier build", (context) => {
	const fixture = createFixture();
	context.after(() => fs.rmSync(fixture.workspaceRoot, { recursive: true, force: true }));

	assert.deepEqual(validateMap(fixture.map, fixture.workspaceRoot), {
		consumers: 1,
		packages: 1,
		repositories: 1
	});
});

test("rejects a missing command directory that is not the declared generated pack directory", (context) => {
	const fixture = createFixture();
	context.after(() => fs.rmSync(fixture.workspaceRoot, { recursive: true, force: true }));
	fixture.map.repositories[0].commands[1].cwd = "misspelled-dist";

	assert.throws(() => validateMap(fixture.map, fixture.workspaceRoot), /command cwd does not exist: misspelled-dist/u);
});
