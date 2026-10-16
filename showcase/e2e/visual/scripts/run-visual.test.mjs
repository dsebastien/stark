import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { createLegacyOraclePreflight, createVisualRun, executeVisualRun } from "./run-visual.mjs";

const showcaseDirectory = fileURLToPath(new URL("../../../", import.meta.url));
const showcasePackage = JSON.parse(readFileSync(new URL("../../../package.json", import.meta.url), "utf8"));

function npmCliPath() {
	const npmExecutable = process.env.STARK_PROJECT_NPM_EXECUTABLE;
	assert.ok(npmExecutable, "run this test through scripts/with-project-node.sh");
	return path.join(path.dirname(npmExecutable), "node_modules", "npm", "bin", "npm-cli.js");
}

describe("createVisualRun", () => {
	it("forces candidate comparisons to remain read-only", () => {
		const run = createVisualRun("candidate", ["e2e/visual/specs/pilot.spec.ts"], {
			STARK_VISUAL_BASELINE_UPDATE: "1",
			STARK_VISUAL_TARGET: "legacy",
			sTaRk_ViSuAl_BaSeLiNe_UpDaTe: "1",
			sTaRk_ViSuAl_TaRgEt: "legacy"
		});

		assert.equal(run.environment.STARK_VISUAL_BASELINE_UPDATE, undefined);
		assert.equal(run.environment.STARK_VISUAL_TARGET, "candidate");
		assert.deepEqual(
			Object.keys(run.environment).filter((key) => key.toUpperCase() === "STARK_VISUAL_BASELINE_UPDATE"),
			[]
		);
		assert.deepEqual(
			Object.keys(run.environment).filter((key) => key.toUpperCase() === "STARK_VISUAL_TARGET"),
			["STARK_VISUAL_TARGET"]
		);
		assert.deepEqual(run.arguments, [
			"test",
			"--config=e2e/visual/playwright.config.ts",
			"e2e/visual/specs/pilot.spec.ts"
		]);
	});

	for (const updateArgument of ["-u", "-u=all", "--update-snapshots", "--update-snapshots=missing"]) {
		it(`rejects ${updateArgument} in candidate mode`, () => {
			assert.throws(
				() => createVisualRun("candidate", [updateArgument], {}),
				/snapshot update options are forbidden/i
			);
		});
	}

	it("grants snapshot writes only to the legacy update mode", () => {
		const run = createVisualRun("legacy-update", ["e2e/visual/specs/pilot.spec.ts"], {});

		assert.equal(run.environment.STARK_VISUAL_BASELINE_UPDATE, "1");
		assert.equal(run.environment.STARK_VISUAL_TARGET, "legacy");
		assert.deepEqual(run.arguments, [
			"test",
			"--config=e2e/visual/playwright.config.ts",
			"--update-snapshots=all",
			"e2e/visual/specs/pilot.spec.ts"
		]);
	});

	it("fails closed for an unknown mode", () => {
		assert.throws(() => createVisualRun("anything-else", [], {}), /unsupported visual mode/i);
	});
});

describe("executeVisualRun", () => {
	it("defines the pinned-oracle preflight as a separate read-only process", () => {
		const preflight = createLegacyOraclePreflight({
			STARK_VISUAL_BASELINE_UPDATE: "1",
			sTaRk_ViSuAl_BaSeLiNe_UpDaTe: "1",
			sTaRk_ViSuAl_TaRgEt: "candidate"
		});

		assert.equal(preflight.environment.STARK_VISUAL_BASELINE_UPDATE, undefined);
		assert.equal(preflight.environment.STARK_VISUAL_TARGET, "legacy");
		assert.deepEqual(
			Object.keys(preflight.environment).filter((key) => key.toUpperCase() === "STARK_VISUAL_BASELINE_UPDATE"),
			[]
		);
		assert.deepEqual(
			Object.keys(preflight.environment).filter((key) => key.toUpperCase() === "STARK_VISUAL_TARGET"),
			["STARK_VISUAL_TARGET"]
		);
		assert.deepEqual(preflight.arguments, [
			"test",
			"--config=e2e/visual/playwright.config.ts",
			"e2e/visual/specs/oracle.spec.ts"
		]);
	});

	it("does not spawn the mutating phase after a failed oracle preflight", () => {
		const calls = [];
		const execution = executeVisualRun("legacy-update", ["e2e/visual/specs/pilot.spec.ts"], {}, {
			playwrightCli: "playwright-cli.js",
			spawn: (...parameters) => {
				calls.push(parameters);
				return { status: 1 };
			}
		});

		assert.equal(execution.status, 1);
		assert.equal(calls.length, 1);
		assert.deepEqual(calls[0][1], [
			"playwright-cli.js",
			"test",
			"--config=e2e/visual/playwright.config.ts",
			"e2e/visual/specs/oracle.spec.ts"
		]);
		assert.equal(calls[0][2].env.STARK_VISUAL_BASELINE_UPDATE, undefined);
	});

	it("spawns the mutating legacy phase only after a successful oracle preflight", () => {
		const calls = [];
		const execution = executeVisualRun("legacy-update", ["e2e/visual/specs/pilot.spec.ts"], {}, {
			playwrightCli: "playwright-cli.js",
			spawn: (...parameters) => {
				calls.push(parameters);
				return { status: 0 };
			}
		});

		assert.equal(execution.status, 0);
		assert.equal(calls.length, 2);
		assert.ok(!calls[0][1].some((argument) => argument.startsWith("--update-snapshots")));
		assert.ok(calls[1][1].includes("--update-snapshots=all"));
		assert.equal(calls[1][2].env.STARK_VISUAL_BASELINE_UPDATE, "1");
	});
});

describe("visual package scripts", () => {
	const expectedCandidateCommand = "node e2e/visual/scripts/run-visual.mjs candidate";

	it("routes every candidate alias through the read-only wrapper", () => {
		assert.equal(showcasePackage.scripts["test:visual"], expectedCandidateCommand);
		assert.equal(showcasePackage.scripts["test:visual:candidate"], expectedCandidateCommand);
		assert.equal(
			showcasePackage.scripts["test:visual:smoke"],
			`${expectedCandidateCommand} e2e/visual/specs/smoke.spec.ts`
		);
	});

	for (const packageScript of ["test:visual", "test:visual:candidate", "test:visual:smoke"]) {
		it(`blocks -u through the actual ${packageScript} package script despite hostile inherited privilege`, () => {
			const result = spawnSync(
				process.execPath,
				[npmCliPath(), "--prefix", showcaseDirectory, "run", packageScript, "--", "-u"],
				{
					encoding: "utf8",
					env: {
						...process.env,
						STARK_VISUAL_BASELINE_UPDATE: "1",
						STARK_VISUAL_TARGET: "legacy"
					}
				}
			);

			assert.equal(result.status, 2);
			assert.match(result.stdout + result.stderr, /Snapshot update options are forbidden/);
		});
	}

	it("sanitizes mixed-case hostile privilege in the actual candidate package script", () => {
		const environment = { ...process.env };
		for (const key of Object.keys(environment)) {
			if (key.toUpperCase() === "STARK_VISUAL_BASELINE_UPDATE" || key.toUpperCase() === "STARK_VISUAL_TARGET") {
				delete environment[key];
			}
		}
		environment.STaRk_ViSuAl_BaSeLiNe_UpDaTe = "1";
		environment.stArK_ViSuAl_TaRgEt = "legacy";
		environment.STARK_VISUAL_NO_SERVER = "1";

		const result = spawnSync(
			process.execPath,
			[
				npmCliPath(),
				"--prefix",
				showcaseDirectory,
				"run",
				"test:visual:candidate",
				"--",
				"e2e/visual/specs/workflow-guards.spec.ts",
				"--grep",
				"runs the candidate process without update privilege"
			],
			{ encoding: "utf8", env: environment }
		);

		assert.equal(result.status, 0, result.stdout + result.stderr);
		assert.match(result.stdout, /1 passed/);
	});
});
