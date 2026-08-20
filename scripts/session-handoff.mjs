import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const HANDOFF_KEY = "migration-session-handoff";

function commandName(name) {
	return process.platform === "win32" && name === "bd" ? "bd.cmd" : name;
}

export function runCommand(name, args, cwd) {
	const executable = process.platform === "win32" && name === "bd" ? process.execPath : commandName(name);
	const commandArgs = process.platform === "win32" && name === "bd"
		? [join(dirname(process.execPath), "node_modules", "@beads", "bd", "bin", "bd.js"), ...args]
		: args;
	const result = spawnSync(executable, commandArgs, {
		cwd,
		encoding: "utf8",
		maxBuffer: 16 * 1024 * 1024,
		windowsHide: true
	});
	if (result.error || result.status !== 0) {
		const detail = String(result.stderr || result.error?.message || `exit ${result.status}`).trim();
		throw new Error(`${name} ${args.join(" ")} failed: ${detail}`);
	}
	return String(result.stdout || "").trim();
}

export function parseArgs(argv) {
	const options = { hook: null, resume: false, requireActive: false, evidence: null, dirtyNote: null, next: null };
	for (let index = 0; index < argv.length; index += 1) {
		const arg = argv[index];
		if (arg === "--resume") options.resume = true;
		else if (arg === "--require-active") options.requireActive = true;
		else if (arg === "--hook") options.hook = argv[++index];
		else if (arg === "--evidence") options.evidence = argv[++index];
		else if (arg === "--dirty-note") options.dirtyNote = argv[++index];
		else if (arg === "--next") options.next = argv[++index];
		else throw new Error(`unknown option: ${arg}`);
	}
	return options;
}

export function parseStatus(output) {
	return output
		.split(/\r?\n/)
		.filter(Boolean)
		.map((line) => ({ code: line.slice(0, 2), path: line.slice(3) }));
}

export function isExpired(lease, now = new Date()) {
	return Boolean(lease) && Number.isFinite(Date.parse(lease)) && Date.parse(lease) <= now.getTime();
}

function parseJson(output, label) {
	const start = [...output].findIndex((character) => character === "[" || character === "{");
	if (start < 0) throw new Error(`${label} did not return JSON`);
	try {
		return JSON.parse(output.slice(start));
	} catch (error) {
		throw new Error(`${label} returned malformed JSON: ${error.message}`);
	}
}

function snapshotGit(cwd) {
	const status = parseStatus(runCommand("git", ["status", "--short"], cwd));
	return {
		repository: runCommand("git", ["rev-parse", "--show-toplevel"], cwd),
		branch: runCommand("git", ["branch", "--show-current"], cwd),
		head: runCommand("git", ["rev-parse", "HEAD"], cwd),
		dirty_files: status,
		diff_stat: runCommand("git", ["diff", "--stat"], cwd),
		worktrees: runCommand("git", ["worktree", "list", "--porcelain"], cwd)
	};
}

function snapshotBeads(cwd) {
	const active = parseJson(runCommand("bd", ["list", "--status=in_progress", "--brief", "--json", "--no-pager", "--max-rows", "200"], cwd), "active Beads");
	const ready = parseJson(runCommand("bd", ["ready", "--type", "task", "--json", "--max-rows", "200"], cwd), "ready Beads");
	return { active, ready };
}

export function buildHandoff({ git, beads, options, now = new Date(), sessionId = randomUUID() }) {
	const stale = beads.active.filter((issue) => isExpired(issue.lease_expires_at, now)).map((issue) => issue.id);
	if (options.requireActive && beads.active.length === 0) throw new Error("precompact handoff requires an in-progress Beads issue");
	if (options.requireActive && stale.length > 0) throw new Error(`active Beads have expired leases: ${stale.join(", ")}`);
	if (options.requireActive && git.dirty_files.length > 0 && !options.dirtyNote) throw new Error("dirty files require --dirty-note for a classified handoff");
	const evidence = options.evidence || process.env.MIGRATION_TEST_EVIDENCE || "checkpoint (test evidence not supplied)";
	return {
		format: 1,
		session_id: sessionId,
		recorded_at: now.toISOString(),
		git,
		active_beads: beads.active.map((issue) => ({ id: issue.id, title: issue.title, status: issue.status, assignee: issue.assignee, lease_expires_at: issue.lease_expires_at })),
		ready_beads: beads.ready.map((issue) => ({ id: issue.id, title: issue.title, priority: issue.priority })),
		dirty_classification: git.dirty_files.length === 0 ? "clean" : options.dirtyNote,
		test_evidence: [{ recorded_at: now.toISOString(), description: evidence }],
		blockers: stale.length === 0 ? [] : stale.map((id) => `expired lease: ${id}`),
		next_action: options.next || beads.ready[0]?.id || "orchestrator review required"
	};
}

export function formatResume(handoff) {
	const active = handoff.active_beads?.map((issue) => `${issue.id} (${issue.title})`).join(", ") || "none";
	const dirty = handoff.dirty_classification || "unknown";
	return [
		`handoff ${handoff.recorded_at || "unknown"} on ${handoff.git?.branch || "unknown"} at ${handoff.git?.head || "unknown"}`,
		`active: ${active}`,
		`dirty: ${dirty}`,
		`next: ${handoff.next_action || "orchestrator review required"}`,
		`evidence: ${handoff.test_evidence?.at(-1)?.description || "none"}`
	].join("\n");
}

function main() {
	const options = parseArgs(process.argv.slice(2));
	const cwd = process.cwd();
	if (options.resume) {
		const content = runCommand("bd", ["recall", HANDOFF_KEY], cwd);
		try {
			console.log(formatResume(JSON.parse(content)));
		} catch {
			console.log(content);
		}
		return;
	}
	const git = snapshotGit(cwd);
	const beads = snapshotBeads(cwd);
	const handoff = buildHandoff({ git, beads, options });
	runCommand("bd", ["remember", JSON.stringify(handoff), "--key", HANDOFF_KEY], cwd);
	console.log(formatResume(handoff));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
	try {
		main();
	} catch (error) {
		console.error(`session handoff failed: ${error.message}`);
		process.exitCode = 1;
	}
}
