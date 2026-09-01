import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { checkCanonicalDependenciesForTest } from "./manage-workspace-dependencies.mjs";

process.env.STARK_LOCAL_PACKAGE_TEST_MODE = "1";

const remotePackage = "@example/remote";
const localPackage = "@example/local";
const remoteReference = "https://codeload.github.com/example/remote/tar.gz/0123456789abcdef0123456789abcdef01234567";
const localReference = "file:dist/example-local-1.0.0.tgz";
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function json(value) {
	return `${JSON.stringify(value, null, 2)}\n`;
}

function createFixture(name) {
	const workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), `stark-deps-check-${name}-`));
	const repositoryRoot = path.join(workspaceRoot, "stark");
	fs.mkdirSync(repositoryRoot);
	const packages = {
		[remotePackage]: {
			version: "1.0.0",
			resolved: remoteReference,
			integrity: "sha512-cmVtb3Rl"
		},
		[localPackage]: {
			version: "1.0.0",
			resolved: localReference,
			integrity: "sha512-bG9jYWw="
		}
	};
	const manifest = {
		name: "stark-check-fixture",
		dependencies: {
			[remotePackage]: remoteReference,
			[localPackage]: localReference
		}
	};
	const lock = {
		name: manifest.name,
		lockfileVersion: 3,
		packages: {
			"": { dependencies: { ...manifest.dependencies } },
			[`node_modules/${remotePackage}`]: { ...packages[remotePackage] },
			[`node_modules/${localPackage}`]: { ...packages[localPackage] }
		}
	};
	fs.writeFileSync(path.join(repositoryRoot, "package.json"), json(manifest));
	fs.writeFileSync(path.join(repositoryRoot, "package-lock.json"), json(lock));
	const unmappedManifestPath = path.join(repositoryRoot, "packages", "unmapped", "package.json");
	fs.mkdirSync(path.dirname(unmappedManifestPath), { recursive: true });
	fs.writeFileSync(unmappedManifestPath, json({ name: "@example/unmapped-manifest", dependencies: {} }));

	const consumers = [remotePackage, localPackage].map((packageName) => ({
		repository: "stark",
		manifest: "package.json",
		section: "dependencies",
		field: packageName,
		package: packageName,
		reference: `file:../producer/${packageName.split("/").at(-1)}-{packageVersion}.tgz`,
		canonicalReference: manifest.dependencies[packageName]
	}));
	const map = {
		schemaVersion: 2,
		repositories: [{ id: "stark", directory: "stark", packages: [] }],
		consumers,
		canonicalCheck: { repository: "stark", packages }
	};
	return {
		workspaceRoot,
		repositoryRoot,
		map,
		manifestPath: path.join(repositoryRoot, "package.json"),
		unmappedManifestPath,
		lockfilePath: path.join(repositoryRoot, "package-lock.json"),
		statePath: path.join(workspaceRoot, "tmp", "local-dependency-mode", "state.json"),
		transactionPath: path.join(workspaceRoot, "tmp", "local-dependency-mode", "transaction.json")
	};
}

function options(fixture, overrides = {}) {
	return {
		workspaceRoot: fixture.workspaceRoot,
		repositoryRoot: fixture.repositoryRoot,
		map: fixture.map,
		...overrides
	};
}

function mutateJson(filePath, mutate) {
	const value = JSON.parse(fs.readFileSync(filePath, "utf8"));
	mutate(value);
	fs.writeFileSync(filePath, json(value));
}

function captureError(callback) {
	try {
		callback();
	} catch (error) {
		return error;
	}
	assert.fail("expected dependency check to fail");
}

test("canonical check passes without sibling repositories or canonical file artifacts", () => {
	const fixture = createFixture("canonical");
	const before = [fixture.manifestPath, fixture.lockfilePath].map((filePath) => fs.readFileSync(filePath));

	const result = checkCanonicalDependenciesForTest(options(fixture));

	assert.deepEqual(result, { mode: "canonical", checkedConsumers: 2, checkedFiles: 3 });
	assert.deepEqual(
		[fixture.manifestPath, fixture.lockfilePath].map((filePath) => fs.readFileSync(filePath)),
		before
	);
	assert.equal(fs.existsSync(path.join(fixture.repositoryRoot, "dist", "example-local-1.0.0.tgz")), false);
});

test("repository scripts and CI run the check before package, consumer, and publication gates", () => {
	const manifest = JSON.parse(fs.readFileSync(path.join(projectRoot, "package.json"), "utf8"));
	const workflow = fs.readFileSync(path.join(projectRoot, ".github", "workflows", "build.yml"), "utf8");
	const release = fs.readFileSync(path.join(projectRoot, "release-publish.sh"), "utf8");
	const migrationGuide = fs.readFileSync(path.join(projectRoot, "MIGRATION_BRANCH_STRUCTURE.md"), "utf8");

	assert.equal(manifest.scripts["deps:check"], "node ./scripts/manage-workspace-dependencies.mjs check");
	assert.match(manifest.scripts["test:local-packages"], /manage-workspace-dependencies\.check\.test\.mjs/u);
	assert.ok(workflow.indexOf("run: npm run deps:check") < workflow.indexOf("check:packages-dependencies"));
	assert.ok(workflow.indexOf("run: npm run deps:check") < workflow.indexOf("working-directory: starter"));
	const releaseJob = workflow.slice(workflow.indexOf("  release:"));
	assert.ok(releaseJob.indexOf("run: npm run deps:check") < releaseJob.indexOf("name: Set npm token"));
	assert.ok(release.indexOf("npm run deps:check") < release.indexOf("npm publish"));
	assert.match(migrationGuide, /Run the dependency preflight before rewriting the stack as well as after restacking/u);
});

test("canonical check aggregates absolute, sibling, local tarball, link, state, and transaction violations", () => {
	const fixture = createFixture("aggregate");
	mutateJson(fixture.manifestPath, (manifest) => {
		manifest.dependencies[remotePackage] = "file:C:/workspace/remote-1.0.0.tgz";
		manifest.dependencies[localPackage] = "file:../../producer/local-1.0.0.tgz";
	});
	mutateJson(fixture.lockfilePath, (lock) => {
		lock.packages[""].dependencies[remotePackage] = "link:../../remote";
		lock.packages[`node_modules/${remotePackage}`].resolved = "file:../../remote/remote-1.0.0.tgz";
		lock.packages[`node_modules/${remotePackage}`].integrity = "sha512-stale";
		lock.packages[`node_modules/${remotePackage}`].link = true;
	});
	fs.mkdirSync(path.dirname(fixture.statePath), { recursive: true });
	fs.writeFileSync(fixture.statePath, "{}\n");
	fs.writeFileSync(fixture.transactionPath, "{}\n");

	const error = captureError(() => checkCanonicalDependenciesForTest(options(fixture)));

	assert.match(error.message, /Dependency check found 8 violations/u);
	assert.match(error.message, /file=package\.json package=@example\/remote field=manifest\.dependencies/u);
	assert.match(error.message, /actual="file:C:\/workspace\/remote-1\.0\.0\.tgz"/u);
	assert.match(error.message, /file=package\.json package=@example\/local field=manifest\.dependencies/u);
	assert.match(error.message, /actual="file:\.\.\/\.\.\/producer\/local-1\.0\.0\.tgz"/u);
	assert.match(error.message, /field=lock\.packages\[""\]\.dependencies/u);
	assert.match(error.message, /field=lock\.packages\["node_modules\/@example\/remote"\]\.resolved/u);
	assert.match(error.message, /field=lock\.packages\["node_modules\/@example\/remote"\]\.integrity/u);
	assert.match(error.message, /field=lock\.packages\["node_modules\/@example\/remote"\]\.link/u);
	assert.match(error.message, /file=tmp\/local-dependency-mode\/state\.json package=<workspace>/u);
	assert.match(error.message, /file=tmp\/local-dependency-mode\/transaction\.json package=<workspace>/u);
});

test("unmapped local references cannot evade the canonical guard", () => {
	const fixture = createFixture("unmapped-local");
	const packageName = "@example/unmapped";
	mutateJson(fixture.unmappedManifestPath, (manifest) => {
		manifest.dependencies[packageName] = "../sibling-package";
	});
	mutateJson(fixture.lockfilePath, (lock) => {
		lock.packages[""].dependencies[packageName] = "workspace:*";
		lock.packages[`node_modules/${packageName}`] = {
			version: "1.0.0",
			resolved: "file:C:/workspace/unmapped-1.0.0.tgz",
			link: true
		};
		lock.packages[`node_modules/parent/node_modules/${remotePackage}`] = {
			name: remotePackage,
			version: "1.0.0",
			resolved: "file:../../../remote-1.0.0.tgz",
			link: true
		};
	});

	const error = captureError(() => checkCanonicalDependenciesForTest(options(fixture)));

	assert.match(error.message, /Dependency check found 6 violations/u);
	assert.match(error.message, /file=packages\/unmapped\/package\.json package=@example\/unmapped field=manifest\.dependencies/u);
	assert.match(error.message, /actual="\.\.\/sibling-package"/u);
	assert.match(error.message, /package=@example\/unmapped field=lock\.packages\[""\]\.dependencies/u);
	assert.match(error.message, /actual="workspace:\*"/u);
	assert.match(error.message, /package=@example\/unmapped field=lock\.packages\["node_modules\/@example\/unmapped"\]\.resolved/u);
	assert.match(error.message, /package=@example\/unmapped field=lock\.packages\["node_modules\/@example\/unmapped"\]\.link/u);
	assert.match(error.message, /lock\.packages\["node_modules\/parent\/node_modules\/@example\/remote"\]\.resolved/u);
	assert.match(error.message, /lock\.packages\["node_modules\/parent\/node_modules\/@example\/remote"\]\.link/u);
});

test("canonical check rejects stale source hashes, aliases, mismatched lock declarations, and stale integrity", () => {
	const fixture = createFixture("stale");
	mutateJson(fixture.manifestPath, (manifest) => {
		manifest.dependencies[remotePackage] = "https://codeload.github.com/example/remote/tar.gz/ffffffffffffffffffffffffffffffffffffffff";
		manifest.dependencies[localPackage] = "npm:@example/local@1.0.0";
	});
	mutateJson(fixture.lockfilePath, (lock) => {
		lock.packages[""].dependencies[remotePackage] = "^9.0.0";
		lock.packages[`node_modules/${localPackage}`].integrity = "sha512-old-local-build";
	});

	const error = captureError(() => checkCanonicalDependenciesForTest(options(fixture)));

	assert.match(error.message, /Dependency check found 4 violations/u);
	assert.match(error.message, new RegExp(`package=${remotePackage} field=manifest\\.dependencies.*ffffffff`, "u"));
	assert.match(error.message, new RegExp(`package=${localPackage} field=manifest\\.dependencies.*npm:`, "u"));
	assert.match(error.message, new RegExp(`package=${remotePackage} field=lock\\.packages.*actual="\\^9\\.0\\.0"`, "u"));
	assert.match(error.message, new RegExp(`package=${localPackage} field=lock\\.packages.*integrity.*sha512-old-local-build`, "u"));
});

test("canonical check reports a missing installed lock record once with expected and actual values", () => {
	const fixture = createFixture("missing-lock-record");
	mutateJson(fixture.lockfilePath, (lock) => {
		delete lock.packages[`node_modules/${remotePackage}`];
	});

	const error = captureError(() => checkCanonicalDependenciesForTest(options(fixture)));

	assert.match(error.message, /Dependency check found 1 violation/u);
	assert.match(error.message, /file=package-lock\.json package=@example\/remote/u);
	assert.match(error.message, /expected=\{"version":"1\.0\.0"/u);
	assert.match(error.message, /actual=<missing>/u);
});

test("canonical check revalidates every managed file after inspection", () => {
	const fixture = createFixture("proof");

	assert.throws(
		() =>
			checkCanonicalDependenciesForTest(
				options(fixture, {
					afterInspectForTest: () => fs.appendFileSync(fixture.manifestPath, " \n")
				})
			),
		/identity or contents changed/u
	);
});
