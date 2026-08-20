import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("project Codex hooks cover resume and both compaction triggers", async () => {
	const config = JSON.parse(await readFile(new URL("../.codex/hooks.json", import.meta.url), "utf8"));
	assert.match(config.hooks.SessionStart[0].matcher, /startup/);
	assert.equal(config.hooks.PreCompact[0].matcher, "manual|auto");
	assert.match(config.hooks.PreCompact[0].hooks[0].command, /codex-session-hook\.mjs precompact/);
	assert.match(config.hooks.PreCompact[0].hooks[0].commandWindows, /bash\.exe/);
});

test("GitHub Copilot hooks use the same pinned handoff flow", async () => {
	const config = JSON.parse(await readFile(new URL("../.copilot-plugin/plugin.json", import.meta.url), "utf8"));
	const sessionCommand = config.hooks.SessionStart[0].hooks[0].command;
	const compactCommand = config.hooks.PreCompact[0].hooks[0].command;
	assert.match(sessionCommand, /with-project-node\.sh -- node scripts\/codex-session-hook\.mjs resume/);
	assert.match(compactCommand, /with-project-node\.sh -- node scripts\/codex-session-hook\.mjs precompact/);
	assert.match(compactCommand, /bd prime --memories-only/);
});
