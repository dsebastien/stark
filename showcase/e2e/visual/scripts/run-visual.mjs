import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const [mode, ...selectors] = process.argv.slice(2);

if (mode !== "legacy-update") {
	console.error("Usage: node e2e/visual/scripts/run-visual.mjs legacy-update [test selector/options]");
	process.exit(2);
}

if (selectors.some((argument) => argument === "--update-snapshots" || argument.startsWith("--update-snapshots="))) {
	console.error("The legacy update command adds --update-snapshots itself; do not provide it twice.");
	process.exit(2);
}

const result = spawnSync(
	process.execPath,
	[require.resolve("@playwright/test/cli"), "test", "--config=e2e/visual/playwright.config.ts", "--update-snapshots=all", ...selectors],
	{
		env: {
			...process.env,
			STARK_VISUAL_BASELINE_UPDATE: "1",
			STARK_VISUAL_TARGET: "legacy"
		},
		stdio: "inherit"
	}
);

if (result.error) {
	console.error(result.error);
	process.exit(1);
}

process.exit(result.status ?? 1);
