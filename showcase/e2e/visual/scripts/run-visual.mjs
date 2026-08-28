import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isSnapshotUpdateOption } from "../support/snapshot-update.mjs";

const require = createRequire(import.meta.url);
const controlledEnvironmentVariables = new Set(["STARK_VISUAL_BASELINE_UPDATE", "STARK_VISUAL_TARGET"]);

function sanitizedVisualEnvironment(sourceEnvironment) {
	return Object.fromEntries(
		Object.entries(sourceEnvironment).filter(([key]) => !controlledEnvironmentVariables.has(key.toUpperCase()))
	);
}

export function createVisualRun(mode, selectors, sourceEnvironment) {
	if (mode !== "candidate" && mode !== "legacy-update") {
		throw new Error(`Unsupported visual mode: ${mode ?? "<missing>"}.`);
	}

	if (selectors.some(isSnapshotUpdateOption)) {
		throw new Error("Snapshot update options are forbidden; only the legacy-update mode grants snapshot writes.");
	}

	const environment = sanitizedVisualEnvironment(sourceEnvironment);
	const argumentsList = ["test", "--config=e2e/visual/playwright.config.ts"];

	if (mode === "legacy-update") {
		environment.STARK_VISUAL_BASELINE_UPDATE = "1";
		environment.STARK_VISUAL_TARGET = "legacy";
		argumentsList.push("--update-snapshots=all");
	} else {
		delete environment.STARK_VISUAL_BASELINE_UPDATE;
		environment.STARK_VISUAL_TARGET = "candidate";
	}

	argumentsList.push(...selectors);
	return { arguments: argumentsList, environment };
}

export function createLegacyOraclePreflight(sourceEnvironment) {
	const environment = sanitizedVisualEnvironment(sourceEnvironment);
	environment.STARK_VISUAL_TARGET = "legacy";

	return {
		arguments: [
			"test",
			"--config=e2e/visual/playwright.config.ts",
			"e2e/visual/specs/oracle.spec.ts"
		],
		environment
	};
}

export function executeVisualRun(mode, selectors, sourceEnvironment, options = {}) {
	const visualRun = createVisualRun(mode, selectors, sourceEnvironment);
	const runs = mode === "legacy-update" ? [createLegacyOraclePreflight(sourceEnvironment), visualRun] : [visualRun];
	const playwrightCli = options.playwrightCli ?? require.resolve("@playwright/test/cli");
	const spawn = options.spawn ?? spawnSync;

	for (const run of runs) {
		const result = spawn(process.execPath, [playwrightCli, ...run.arguments], {
			env: run.environment,
			stdio: "inherit"
		});

		if (result.error) {
			return { error: result.error, status: 1 };
		}
		if (result.status !== 0) {
			return { status: result.status ?? 1 };
		}
	}

	return { status: 0 };
}

function main() {
	const [mode, ...selectors] = process.argv.slice(2);
	let execution;
	try {
		execution = executeVisualRun(mode, selectors, process.env);
	} catch (error) {
		console.error(error.message);
		console.error("Usage: node e2e/visual/scripts/run-visual.mjs candidate|legacy-update [test selector/options]");
		process.exitCode = 2;
		return;
	}

	if (execution.error) {
		console.error(execution.error);
	}

	process.exitCode = execution.status;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	main();
}
