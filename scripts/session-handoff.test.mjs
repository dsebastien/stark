import assert from "node:assert/strict";
import test from "node:test";
import { buildHandoff, formatResume, isExpired, parseArgs, parseStatus } from "./session-handoff.mjs";

test("parses the precompact options", () => {
	assert.deepEqual(parseArgs(["--hook", "precompact", "--require-active", "--evidence", "tests green", "--dirty-note", "in progress"]), {
		hook: "precompact",
		resume: false,
		requireActive: true,
		evidence: "tests green",
		dirtyNote: "in progress",
		next: null
	});
});

test("captures status codes and paths", () => {
	assert.deepEqual(parseStatus(" M package.json\n?? scripts/new.mjs\n"), [
		{ code: " M", path: "package.json" },
		{ code: "??", path: "scripts/new.mjs" }
	]);
});

test("rejects expired active leases for required handoffs", () => {
	assert.throws(() => buildHandoff({
		git: { dirty_files: [], branch: "main", head: "abc" },
		beads: { active: [{ id: "stark-1", title: "work", status: "in_progress", lease_expires_at: "2020-01-01T00:00:00Z" }], ready: [] },
		options: { requireActive: true, evidence: "not run", dirtyNote: null },
		now: new Date("2026-08-20T00:00:00Z")
	}), /expired leases/);
	assert.equal(isExpired("2020-01-01T00:00:00Z", new Date("2026-08-20T00:00:00Z")), true);
});

test("builds a compact resumable handoff", () => {
	const handoff = buildHandoff({
		git: { dirty_files: [], branch: "migration/angular-22/05-agent-context", head: "abc" },
		beads: { active: [{ id: "stark-1", title: "work", status: "in_progress" }], ready: [{ id: "stark-2", title: "next", priority: 1 }] },
		options: { requireActive: true, evidence: "tests green", dirtyNote: null },
		now: new Date("2026-08-20T00:00:00Z"),
		sessionId: "session-1"
	});
	assert.equal(handoff.session_id, "session-1");
	assert.equal(handoff.next_action, "stark-2");
	assert.match(formatResume(handoff), /active: stark-1/);
});
