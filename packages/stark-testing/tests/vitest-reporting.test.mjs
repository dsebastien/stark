import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import { createVitestReportingConfig } from "../vitest-reporting.mjs";

const workspaceRoot = process.cwd();

test("createVitestReportingConfig returns deterministic workspace-local paths", () => {
	const reporting = createVitestReportingConfig("packages/stark-core");

	assert.equal(reporting.coverage.reportsDirectory, path.join(workspaceRoot, "reports", "coverage", "packages", "stark-core"));
	assert.deepEqual(reporting.reporters, [
		"default",
		["junit", { outputFile: path.join(workspaceRoot, "reports", "test-results", "packages", "stark-core", "junit.xml") }]
	]);
});

test("createVitestReportingConfig rejects empty and escaping paths", () => {
	assert.throws(() => createVitestReportingConfig(""), /non-empty relative package path/);
	assert.throws(() => createVitestReportingConfig("../../outside"), /must stay inside the workspace reports directory/);
	assert.throws(() => createVitestReportingConfig(path.resolve(workspaceRoot, "outside")), /must stay inside the workspace reports directory/);
});
