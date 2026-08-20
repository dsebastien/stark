import { spawnSync } from "node:child_process";

const mode = process.argv[2];
if (!new Set(["resume", "precompact"]).has(mode)) {
	console.error("usage: codex-session-hook.mjs <resume|precompact>");
	process.exitCode = 2;
} else {
	const handoffArgs = mode === "resume"
		? ["scripts/session-handoff.mjs", "--resume"]
		: [
			"scripts/session-handoff.mjs",
			"--hook",
			"precompact",
			"--require-active",
			"--evidence",
			"Codex PreCompact checkpoint; latest evidence supplied by orchestrator",
			"--dirty-note",
			"Codex PreCompact observed worktree classification"
		];
	const result = spawnSync(process.execPath, handoffArgs, {
		cwd: process.cwd(),
		encoding: "utf8",
		stdio: "inherit",
		windowsHide: true
	});
	if (result.error) {
		console.error(`session hook failed: ${result.error.message}`);
		process.exitCode = mode === "precompact" ? 2 : 1;
	} else {
		process.exitCode = mode === "precompact" && result.status !== 0 ? 2 : (result.status ?? 1);
	}
}
