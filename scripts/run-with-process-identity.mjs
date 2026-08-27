import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

function fail(message) {
	process.stderr.write(`[process-identity] ${message}\n`);
	process.exitCode = 78;
}

function startToken(pid) {
	if (process.platform === "linux") {
		try {
			return linuxProcessRecord(pid)?.startToken ?? null;
		} catch {
			return null;
		}
	}
	if (process.platform === "win32") {
		const command = `(Get-Process -Id ${pid}).StartTime.ToUniversalTime().Ticks`;
		const result = spawnSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", command], { encoding: "utf8" });
		const token = result.status === 0 ? result.stdout.trim() : "";
		return /^\d+$/u.test(token) ? token : null;
	}
	return null;
}

function linuxProcessRecord(pid) {
	if (process.platform !== "linux") return null;
	const stat = fs.readFileSync(`/proc/${pid}/stat`, "utf8");
	const fields = stat.slice(stat.lastIndexOf(")") + 2).trim().split(/\s+/u);
	const parentPid = Number(fields[1]);
	const groupId = Number(fields[2]);
	const startToken = fields[19];
	if (!Number.isSafeInteger(parentPid) || parentPid < 0 || !Number.isSafeInteger(groupId) || groupId <= 0 || typeof startToken !== "string" || startToken.length === 0) return null;
	return { pid, parentPid, groupId, startToken };
}

function enumerateLinuxProcesses() {
	const records = [];
	for (const entry of fs.readdirSync("/proc")) {
		if (!/^\d+$/u.test(entry)) continue;
		try {
			const record = linuxProcessRecord(Number(entry));
			if (!record) throw new Error(`Linux process enumeration returned malformed identity for PID ${entry}`);
			records.push(record);
		} catch (error) {
			if (error?.code !== "ENOENT") throw error;
		}
	}
	return records;
}

function enumerateWindowsProcesses() {
	const command = "$ErrorActionPreference='Stop'; Get-CimInstance Win32_Process | Where-Object ProcessId -gt 0 | Select-Object ProcessId,ParentProcessId | ConvertTo-Json -Compress";
	const result = spawnSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", command], { encoding: "utf8" });
	if (result.status !== 0) throw new Error(result.stderr.trim() || "Windows process enumeration failed");
	const output = result.stdout.trim();
	if (output.length === 0) return [];
	const parsed = JSON.parse(output);
	const rows = Array.isArray(parsed) ? parsed : [parsed];
	return rows.map((row) => {
		const pid = Number(row.ProcessId);
		const parentPid = Number(row.ParentProcessId);
		if (!Number.isSafeInteger(pid) || pid <= 0 || !Number.isSafeInteger(parentPid) || parentPid < 0) throw new Error("Windows process enumeration returned malformed identity");
		return { pid, parentPid };
	});
}

function descendantProcesses(records, rootPid) {
	const descendants = new Set([rootPid]);
	let changed = true;
	while (changed) {
		changed = false;
		for (const record of records) if (descendants.has(record.parentPid) && !descendants.has(record.pid)) {
			descendants.add(record.pid);
			changed = true;
		}
	}
	return descendants;
}

function assertNoSurvivingDescendants(childPid, groupId) {
	if (process.platform === "linux") {
		const records = enumerateLinuxProcesses();
		const descendants = descendantProcesses(records, childPid);
		const survivors = records.filter((record) => (descendants.has(record.pid) && record.pid !== childPid) || (groupId !== null && record.groupId === groupId && record.pid !== childPid));
		if (survivors.length > 0) throw new Error(`producer left detached descendants alive: ${survivors.map((record) => record.pid).join(",")}`);
		return;
	}
	if (process.platform === "win32") {
		const records = enumerateWindowsProcesses();
		const descendants = descendantProcesses(records, childPid);
		const survivors = records.filter((record) => descendants.has(record.pid) && record.pid !== childPid);
		if (survivors.length > 0) throw new Error(`producer left detached descendants alive: ${survivors.map((record) => record.pid).join(",")}`);
		return;
	}
	throw new Error(`detached-descendant verification is unavailable on ${process.platform}`);
}

function parseArguments(arguments_) {
	let identityFd;
	let cwd = process.cwd();
	let capture = false;
	const separator = arguments_.indexOf("--");
	if (separator < 0) fail("missing command separator");
	for (let index = 0; index < separator; index += 1) {
		const argument = arguments_[index];
		if (argument === "--identity-fd" && arguments_[index + 1]) {
			identityFd = Number(arguments_[index + 1]);
			index += 1;
		} else if (argument === "--cwd" && arguments_[index + 1]) {
			cwd = path.resolve(arguments_[index + 1]);
			index += 1;
		} else if (argument === "--capture") {
			capture = true;
		} else {
			fail(`unknown or incomplete option: ${argument}`);
		}
	}
	const command = arguments_.slice(separator + 1);
	if (!Number.isSafeInteger(identityFd) || identityFd < 3 || command.length === 0) fail("identity fd and command are required");
	return { identityFd, cwd, capture, command };
}

function writeDescriptor(identityFd, identity) {
	fs.writeSync(identityFd, `${JSON.stringify(identity)}\n`, undefined, "utf8");
}

const options = parseArguments(process.argv.slice(2));
if (process.exitCode) process.exit();
const wrapperToken = startToken(process.pid);
if (!wrapperToken) fail(`cannot prove wrapper process start identity on ${process.platform}`);
const wrapper = {
	pid: process.pid,
	parentPid: process.ppid,
	processStartToken: wrapperToken,
	platform: process.platform,
	commandLine: options.command.join(" "),
	createdAt: new Date().toISOString()
};
try {
	writeDescriptor(options.identityFd, { schemaVersion: 1, wrapper });
} catch (error) {
	fail(`could not persist wrapper identity: ${error.message}`);
}
if (process.exitCode) process.exit();

const [command, ...arguments_] = options.command;
const child = spawn(command, arguments_, {
	cwd: options.cwd,
	detached: process.platform === "linux",
	stdio: options.capture ? ["ignore", "pipe", "pipe", "ignore"] : ["ignore", "inherit", "inherit", "ignore"]
});
if (options.capture) {
	child.stdout.on("data", (chunk) => process.stdout.write(chunk));
	child.stderr.on("data", (chunk) => process.stderr.write(chunk));
}
if (!Number.isSafeInteger(child.pid) || child.pid <= 0) {
	child.kill();
	fail(`could not prove child PID for ${command}`);
	process.exit();
}
const childToken = startToken(child.pid);
let childProcess = null;
if (process.platform === "linux") {
	try {
		childProcess = linuxProcessRecord(child.pid);
	} catch (error) {
		if (error?.code !== "ENOENT") throw error;
	}
}
const childIdentity = childToken
	? { pid: child.pid, parentPid: process.pid, processStartToken: childToken, platform: process.platform, commandLine: options.command.join(" "), kind: "direct", boundary: childProcess ? { kind: "process-group", id: childProcess.groupId } : { kind: "parent-tree" } }
	: { pid: process.pid, parentPid: process.ppid, processStartToken: wrapperToken, platform: process.platform, commandLine: options.command.join(" "), kind: "wrapper" };

const result = await new Promise((resolve) => {
	let settled = false;
	const finish = (value) => {
		if (!settled) {
			settled = true;
			resolve(value);
		}
	};
	child.once("error", (error) => finish({ error }));
	child.once("close", (status, signal) => finish({ status, signal }));
});
if (result.error) {
	fail(`could not execute ${command}: ${result.error.message}`);
	process.exit();
}
try {
	assertNoSurvivingDescendants(child.pid, childProcess?.groupId ?? null);
} catch (error) {
	fail(error.message);
	process.exit();
}
try {
	writeDescriptor(options.identityFd, {
		schemaVersion: 1,
		wrapper,
		child: { ...childIdentity, createdAt: new Date().toISOString() }
	});
} catch (error) {
	fail(`could not persist child identity: ${error.message}`);
	process.exit();
}
process.exitCode = result.status === null ? 1 : result.status;
