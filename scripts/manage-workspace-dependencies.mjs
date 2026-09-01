import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
	assertExclusiveWorkspaceCommandWorker,
	assertRegularFileSet,
	captureRegularFileSet,
	publishExclusiveWorkspaceCommandResult,
	resolveContained,
	runExclusiveWorkspaceCommand,
	runPipeline,
	validateGenerationAt,
	writeAtomic
} from "./build-local-packages.mjs";
import { defaultWorkspaceRoot, validateMap as validateDependencyMap } from "./validate-local-dependency-map.mjs";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, "..");
const defaultMapPath = path.join(scriptDirectory, "local-dependency-map.json");
const dependencyStateDirectory = path.join("tmp", "local-dependency-mode");
const dependencyStateName = "state.json";
const transactionName = "transaction.json";

function fail(message, cause) {
	const error = new Error(message, cause ? { cause } : undefined);
	error.name = "DependencyModeError";
	throw error;
}

function readJson(filePath, label = filePath) {
	try {
		return JSON.parse(fs.readFileSync(filePath, "utf8"));
	} catch (error) {
		fail(`could not read ${label}: ${error.message}`, error);
	}
}

function stableJson(value) {
	return `${JSON.stringify(value, null, 2)}\n`;
}

function hash(contents) {
	return crypto.createHash("sha256").update(contents).digest("hex");
}

function normalizeRelative(relativePath) {
	return relativePath.split(path.sep).join("/");
}

function pathEntryExists(filePath) {
	try {
		fs.lstatSync(filePath);
		return true;
	} catch (error) {
		if (error?.code === "ENOENT") return false;
		throw error;
	}
}

function assertInside(base, candidate, label) {
	const relative = path.relative(path.resolve(base), path.resolve(candidate));
	if (!relative || relative === ".") return path.resolve(candidate);
	if (relative.startsWith("..") || path.isAbsolute(relative)) fail(`${label} is outside the workspace: ${candidate}`);
	return path.resolve(candidate);
}

function exactKeys(value, expected) {
	return (
		value &&
		typeof value === "object" &&
		!Array.isArray(value) &&
		JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...expected].sort())
	);
}

function ensureSafeDirectory(workspaceRoot, relativePath) {
	const segments = normalizeRelative(relativePath).split("/");
	let current = workspaceRoot;
	for (const segment of segments) {
		current = path.join(current, segment);
		if (!pathEntryExists(current)) fs.mkdirSync(current);
		const stat = fs.lstatSync(current);
		if (!stat.isDirectory() || stat.isSymbolicLink() || (stat.reparseTag !== undefined && stat.reparseTag !== 0)) {
			fail(`dependency state path is not a safe directory: ${current}`);
		}
	}
	return current;
}

function manifestContents(original, manifest) {
	const text = original.toString("utf8");
	const indentation = text.match(/\n([\t ]+)"/u)?.[1] ?? "  ";
	const newline = text.includes("\r\n") ? "\r\n" : "\n";
	const trailingNewline = text.endsWith("\n");
	const rendered = JSON.stringify(manifest, null, indentation).replaceAll("\n", newline);
	return Buffer.from(trailingNewline ? `${rendered}${newline}` : rendered);
}

function managedPaths(workspaceRoot, filePaths) {
	return [
		...new Set(
			filePaths.map((filePath) =>
				normalizeRelative(path.relative(workspaceRoot, assertInside(workspaceRoot, filePath, "managed file")))
			)
		)
	].sort();
}

function fileRecord(workspaceRoot, filePath, proof) {
	const absolutePath = assertInside(workspaceRoot, filePath, "managed file");
	const contents = fs.readFileSync(absolutePath);
	assertRegularFileSet(proof);
	return {
		path: normalizeRelative(path.relative(workspaceRoot, absolutePath)),
		sha256: hash(contents),
		contents: contents.toString("base64")
	};
}

function captureManagedFileSet(workspaceRoot, managedRelativePaths) {
	const present = [];
	const absent = [];
	for (const relativePath of managedRelativePaths) {
		const filePath = resolveContained(workspaceRoot, relativePath, "managed file");
		(pathEntryExists(filePath) ? present : absent).push(relativePath);
	}
	if (present.length === 0) fail("all managed files are missing; their identities cannot be validated");
	return { proof: captureRegularFileSet(workspaceRoot, present), absent };
}

function assertManagedFileSet(workspaceRoot, managedProof) {
	assertRegularFileSet(managedProof.proof);
	for (const relativePath of managedProof.absent) {
		const filePath = resolveContained(workspaceRoot, relativePath, "absent managed file");
		if (pathEntryExists(filePath)) fail(`absent managed file appeared before write: ${filePath}`);
	}
}

function decodeRecord(record) {
	if (record.exists === false) {
		if (!exactKeys(record, ["path", "exists"])) fail("absent backup record has unexpected fields");
		return undefined;
	}
	if (
		!exactKeys(record, ["path", "sha256", "contents"]) ||
		typeof record.contents !== "string" ||
		typeof record.sha256 !== "string" ||
		!/^[a-f0-9]{64}$/u.test(record.sha256)
	) {
		fail("backup record schema is malformed");
	}
	const contents = Buffer.from(record.contents, "base64");
	if (contents.toString("base64") !== record.contents || hash(contents) !== record.sha256)
		fail(`backup record has invalid base64 or digest: ${record.path}`);
	return contents;
}

function validateRecords(records, expectedPaths) {
	if (!Array.isArray(records)) fail("backup records must be an array");
	const paths = records.map((record) => record?.path);
	if (
		paths.some((entry) => typeof entry !== "string") ||
		new Set(paths).size !== paths.length ||
		JSON.stringify([...paths].sort()) !== JSON.stringify([...expectedPaths].sort())
	) {
		fail("backup records do not match the exact managed-file set");
	}
	for (const record of records) decodeRecord(record);
}

function writeManagedFile(workspaceRoot, managedRelativePaths, filePath, contents) {
	const relativePath = normalizeRelative(path.relative(workspaceRoot, filePath));
	if (!managedRelativePaths.includes(relativePath)) fail(`write target is not in the managed-file set: ${relativePath}`);
	const proof = captureManagedFileSet(workspaceRoot, managedRelativePaths);
	writeAtomic(filePath, contents, {
		noReplace: proof.absent.includes(relativePath),
		beforeMutation: () => assertManagedFileSet(workspaceRoot, proof)
	});
	return captureRegularFileSet(workspaceRoot, [relativePath]);
}

function writeGeneratedFile(workspaceRoot, managedRelativePaths, filePath, contents, options = {}) {
	const managedProof = captureRegularFileSet(workspaceRoot, managedRelativePaths);
	const relativePath = normalizeRelative(path.relative(workspaceRoot, filePath));
	assertInside(workspaceRoot, filePath, "generated state file");
	const parentRelative = normalizeRelative(path.dirname(relativePath));
	ensureSafeDirectory(workspaceRoot, parentRelative);
	let existingProof;
	if (pathEntryExists(filePath)) existingProof = captureRegularFileSet(workspaceRoot, [relativePath]);
	writeAtomic(filePath, contents, {
		noReplace: options.noReplace === true || !existingProof,
		beforeMutation: () => {
			assertRegularFileSet(managedProof);
			ensureSafeDirectory(workspaceRoot, parentRelative);
			if (existingProof) assertRegularFileSet(existingProof);
			else if (pathEntryExists(filePath)) fail(`generated state destination appeared before write: ${filePath}`);
		}
	});
	return captureRegularFileSet(workspaceRoot, [relativePath]);
}

function restoreRecords(workspaceRoot, records, expectedPaths, managedRelativePaths, options = {}) {
	validateRecords(records, expectedPaths);
	const ordered = [...records].sort(
		(left, right) => Number(managedRelativePaths.includes(right.path)) - Number(managedRelativePaths.includes(left.path))
	);
	const restoredProofs = [];
	const absentPaths = [];
	for (let index = 0; index < ordered.length; index += 1) {
		const record = ordered[index];
		const filePath = assertInside(workspaceRoot, path.join(workspaceRoot, record.path), "backup file");
		if (record.exists === false) {
			if (pathEntryExists(filePath)) {
				const proof = captureRegularFileSet(workspaceRoot, [record.path]);
				assertRegularFileSet(proof);
				fs.rmSync(filePath);
			}
			absentPaths.push(record.path);
		} else {
			const proof = managedRelativePaths.includes(record.path)
				? writeManagedFile(workspaceRoot, managedRelativePaths, filePath, decodeRecord(record))
				: writeGeneratedFile(workspaceRoot, managedRelativePaths, filePath, decodeRecord(record));
			restoredProofs.push(proof);
		}
		options.afterRecordForTest?.({ index, record });
	}
	if (restoredProofs.length > 0) {
		assertRegularFileSet({
			base: restoredProofs[0].base,
			files: restoredProofs.flatMap((proof) => proof.files)
		});
	}
	for (const relativePath of absentPaths) {
		const filePath = resolveContained(workspaceRoot, relativePath, "absent restored file");
		if (pathEntryExists(filePath)) fail(`absent restored file appeared before recovery completed: ${filePath}`);
	}
}

function readVerifiedState(workspaceRoot, statePath) {
	const relativePath = normalizeRelative(path.relative(workspaceRoot, statePath));
	const proof = captureRegularFileSet(workspaceRoot, [relativePath]);
	const state = readJson(statePath, "local dependency state");
	assertRegularFileSet(proof);
	return state;
}

function dependencyPaths(workspaceRoot) {
	const stateDirectory = path.join(workspaceRoot, dependencyStateDirectory);
	return {
		stateDirectory,
		statePath: path.join(stateDirectory, dependencyStateName),
		transactionPath: path.join(stateDirectory, transactionName)
	};
}

function recordMap(records) {
	return new Map(records.map((record) => [record.path, record]));
}

function validateCanonicalRecords(workspaceRoot, records, context) {
	const byPath = recordMap(records);
	for (const consumer of context.consumers) {
		const manifestPath = normalizeRelative(path.relative(workspaceRoot, consumer.manifestPath));
		const lockfilePath = normalizeRelative(path.relative(workspaceRoot, consumer.lockfilePath));
		const manifest = JSON.parse(decodeRecord(byPath.get(manifestPath)).toString("utf8"));
		const lock = JSON.parse(decodeRecord(byPath.get(lockfilePath)).toString("utf8"));
		if (manifest[consumer.section]?.[consumer.field] !== consumer.canonicalReference)
			fail(`canonical snapshot has an unapproved reference for ${consumer.field}`);
		if (lock.packages?.[""]?.[consumer.section]?.[consumer.field] !== consumer.canonicalReference)
			fail(`canonical snapshot lock has an unapproved reference for ${consumer.field}`);
	}
}

function validateStateSchema(workspaceRoot, state, managedRelativePaths, context) {
	if (
		!exactKeys(state, ["schemaVersion", "mode", "generationId", "generationPath", "canonicalFiles", "localFiles"]) ||
		state.schemaVersion !== 1 ||
		state.mode !== "local"
	) {
		fail("local dependency state schema is malformed");
	}
	if (
		!/^[a-f0-9]{32}$/u.test(state.generationId) ||
		state.generationPath !== `tmp/local-package-state/generations/${state.generationId}.complete`
	) {
		fail("local dependency state has an invalid generation identity");
	}
	validateRecords(state.canonicalFiles, managedRelativePaths);
	validateCanonicalRecords(workspaceRoot, state.canonicalFiles, context);
	if (!Array.isArray(state.localFiles)) fail("local dependency state localFiles must be an array");
	const localPaths = state.localFiles.map((record) => record?.path);
	if (
		new Set(localPaths).size !== localPaths.length ||
		JSON.stringify([...localPaths].sort()) !== JSON.stringify([...managedRelativePaths].sort()) ||
		state.localFiles.some((record) => !exactKeys(record, ["path", "sha256"]) || !/^[a-f0-9]{64}$/u.test(record.sha256 ?? ""))
	) {
		fail("local dependency state does not match the exact managed-file set");
	}
}

function validateTransaction(
	workspaceRoot,
	transaction,
	managedRelativePaths,
	stateRelativePath,
	context,
	validateGenerationImplementation
) {
	if (
		!exactKeys(transaction, ["schemaVersion", "sourceMode", "backups"]) ||
		transaction.schemaVersion !== 1 ||
		!["canonical", "local"].includes(transaction.sourceMode)
	) {
		fail("dependency transaction schema is malformed; no files were changed");
	}
	const expectedPaths = [...managedRelativePaths, stateRelativePath].sort();
	validateRecords(transaction.backups, expectedPaths);
	const byPath = recordMap(transaction.backups);
	const stateRecord = byPath.get(stateRelativePath);
	const managedRecords = transaction.backups.filter((record) => record.path !== stateRelativePath);
	if (transaction.sourceMode === "canonical") {
		if (stateRecord.exists !== false) fail("canonical transaction unexpectedly contains local dependency state");
		validateCanonicalRecords(workspaceRoot, managedRecords, context);
		return;
	}
	const state = JSON.parse(decodeRecord(stateRecord).toString("utf8"));
	validateStateSchema(workspaceRoot, state, managedRelativePaths, context);
	const generation = validateGeneration(
		path.resolve(workspaceRoot, state.generationPath),
		workspaceRoot,
		validateGenerationImplementation
	);
	const expected = localReferences(context.consumers, generation);
	const backedUp = recordMap(managedRecords);
	const localHashes = new Map(state.localFiles.map((record) => [record.path, record.sha256]));
	for (const record of managedRecords) {
		if (hash(decodeRecord(record)) !== localHashes.get(record.path))
			fail(`local transaction state digest does not match ${record.path}`);
	}
	for (let index = 0; index < context.consumers.length; index += 1) {
		const consumer = context.consumers[index];
		const manifestPath = normalizeRelative(path.relative(workspaceRoot, consumer.manifestPath));
		const lockfilePath = normalizeRelative(path.relative(workspaceRoot, consumer.lockfilePath));
		const manifest = JSON.parse(decodeRecord(backedUp.get(manifestPath)).toString("utf8"));
		const lock = JSON.parse(decodeRecord(backedUp.get(lockfilePath)).toString("utf8"));
		const installed = lock.packages?.[`node_modules/${consumer.field}`];
		if (
			manifest[consumer.section]?.[consumer.field] !== expected[index].reference ||
			lock.packages?.[""]?.[consumer.section]?.[consumer.field] !== expected[index].reference ||
			installed?.resolved !== expected[index].reference ||
			installed?.integrity !== expected[index].artifact.tarballIntegrity ||
			installed?.version !== expected[index].artifact.version
		) {
			fail(`local transaction has invalid generation semantics for ${consumer.field}`);
		}
	}
}

function recoverTransaction(
	workspaceRoot,
	transactionPath,
	managedRelativePaths,
	statePath,
	context,
	validateGenerationImplementation,
	options = {}
) {
	if (!pathEntryExists(transactionPath)) return;
	const transactionRelative = normalizeRelative(path.relative(workspaceRoot, transactionPath));
	const transactionProof = captureRegularFileSet(workspaceRoot, [transactionRelative]);
	const transaction = readJson(transactionPath, "dependency transaction");
	assertRegularFileSet(transactionProof);
	const stateRelativePath = normalizeRelative(path.relative(workspaceRoot, statePath));
	validateTransaction(workspaceRoot, transaction, managedRelativePaths, stateRelativePath, context, validateGenerationImplementation);
	restoreRecords(workspaceRoot, transaction.backups, [...managedRelativePaths, stateRelativePath], managedRelativePaths, {
		afterRecordForTest: options.afterRestoreRecordForTest
	});
	assertRegularFileSet(transactionProof);
	fs.rmSync(transactionPath);
}

function beginTransaction(workspaceRoot, touchedFiles, managedRelativePaths, statePath, transactionPath, sourceMode) {
	const proofPaths = pathEntryExists(statePath)
		? [...managedRelativePaths, normalizeRelative(path.relative(workspaceRoot, statePath))]
		: managedRelativePaths;
	const proof = captureRegularFileSet(workspaceRoot, proofPaths);
	const backups = [...new Set(touchedFiles.map((filePath) => path.resolve(filePath)))].map((filePath) =>
		fileRecord(workspaceRoot, filePath, proof)
	);
	backups.push(
		pathEntryExists(statePath)
			? fileRecord(workspaceRoot, statePath, proof)
			: { path: normalizeRelative(path.relative(workspaceRoot, statePath)), exists: false }
	);
	assertRegularFileSet(proof);
	writeGeneratedFile(workspaceRoot, proofPaths, transactionPath, stableJson({ schemaVersion: 1, sourceMode, backups }), {
		noReplace: true
	});
	return { backups, proof };
}

function assertPreparedTransaction(
	workspaceRoot,
	prepared,
	transactionPath,
	managedRelativePaths,
	statePath,
	context,
	validateGenerationImplementation
) {
	const transactionProof = captureRegularFileSet(workspaceRoot, [normalizeRelative(path.relative(workspaceRoot, transactionPath))]);
	const transaction = readJson(transactionPath, "prepared dependency transaction");
	if (JSON.stringify(transaction.backups) !== JSON.stringify(prepared.backups))
		fail("prepared dependency transaction changed before first mutation");
	validateTransaction(
		workspaceRoot,
		transaction,
		managedRelativePaths,
		normalizeRelative(path.relative(workspaceRoot, statePath)),
		context,
		validateGenerationImplementation
	);
	assertRegularFileSet(prepared.proof);
	assertRegularFileSet(transactionProof);
}

function finishTransaction(workspaceRoot, transactionPath) {
	const proof = captureRegularFileSet(workspaceRoot, [normalizeRelative(path.relative(workspaceRoot, transactionPath))]);
	assertRegularFileSet(proof);
	fs.rmSync(transactionPath);
}

function rollbackTransaction(
	workspaceRoot,
	transactionPath,
	managedRelativePaths,
	statePath,
	context,
	validateGenerationImplementation,
	primaryError
) {
	try {
		recoverTransaction(workspaceRoot, transactionPath, managedRelativePaths, statePath, context, validateGenerationImplementation);
	} catch (rollbackError) {
		fail(`${primaryError.message}; rollback also failed: ${rollbackError.message}`, primaryError);
	}
	throw primaryError;
}

function mapContext(map, workspaceRoot) {
	const repositories = new Map(map.repositories.map((repository) => [repository.id, repository]));
	const packages = new Map();
	for (const repository of map.repositories) {
		for (const packageEntry of repository.packages ?? []) packages.set(packageEntry.name, { packageEntry, repository });
	}
	const consumers = map.consumers.map((consumer) => {
		const repository = repositories.get(consumer.repository);
		const packageOwner = packages.get(consumer.package);
		if (!repository || !packageOwner)
			fail(`consumer ${consumer.repository}/${consumer.manifest}/${consumer.field} is not fully mapped`);
		if (
			typeof consumer.canonicalReference !== "string" ||
			consumer.canonicalReference.length === 0 ||
			(consumer.canonicalReference.startsWith("file:") && path.isAbsolute(consumer.canonicalReference.slice(5)))
		) {
			fail(`consumer ${consumer.repository}/${consumer.manifest}/${consumer.field} has no portable canonicalReference`);
		}
		const repositoryDirectory = assertInside(
			workspaceRoot,
			path.join(workspaceRoot, repository.directory),
			`${repository.id} repository`
		);
		const manifestPath = assertInside(repositoryDirectory, path.join(repositoryDirectory, consumer.manifest), "consumer manifest");
		const lockfilePath = path.join(path.dirname(manifestPath), "package-lock.json");
		return { ...consumer, repositoryEntry: repository, packageOwner, repositoryDirectory, manifestPath, lockfilePath };
	});
	return { consumers, packages, repositories };
}

function checkValue(value) {
	return value === undefined ? "<missing>" : JSON.stringify(value);
}

function checkFileLabel(filePath, repositoryRoot, workspaceRoot) {
	const repositoryRelative = path.relative(repositoryRoot, filePath);
	if (!repositoryRelative.startsWith("..") && !path.isAbsolute(repositoryRelative)) {
		return normalizeRelative(repositoryRelative);
	}
	return normalizeRelative(path.relative(workspaceRoot, filePath));
}

function isLocalDependencyReference(value) {
	if (typeof value !== "string") return false;
	const reference = value.trim();
	return (
		/^(?:file|link|portal|workspace):/iu.test(reference) ||
		reference.startsWith("./") ||
		reference.startsWith("../") ||
		path.posix.isAbsolute(reference) ||
		path.win32.isAbsolute(reference)
	);
}

function packageNameFromLockPath(lockPath, entry) {
	if (typeof entry?.name === "string" && entry.name.length > 0) return entry.name;
	const marker = "node_modules/";
	const markerIndex = lockPath.lastIndexOf(marker);
	return markerIndex === -1 ? lockPath : lockPath.slice(markerIndex + marker.length);
}

function canonicalManifestPaths(repositoryRoot) {
	const ignoredDirectories = new Set([".angular", ".git", "coverage", "dist", "node_modules", "reports", "tmp"]);
	const manifests = [];
	function visit(directory) {
		for (const entry of fs.readdirSync(directory, { withFileTypes: true }).sort((left, right) => left.name.localeCompare(right.name))) {
			if (entry.isDirectory() && ignoredDirectories.has(entry.name)) continue;
			const entryPath = path.join(directory, entry.name);
			if (entry.isDirectory()) visit(entryPath);
			else if (entry.name === "package.json") {
				if (!entry.isFile() || entry.isSymbolicLink()) fail(`dependency manifest is not a regular file: ${entryPath}`);
				manifests.push(entryPath);
			}
		}
	}
	visit(repositoryRoot);
	if (manifests.length === 0) fail(`checked repository has no dependency manifests: ${repositoryRoot}`);
	return manifests;
}

function canonicalCheckContext(map, workspaceRoot, repositoryRoot) {
	const configuration = map.canonicalCheck;
	if (
		!configuration ||
		typeof configuration.repository !== "string" ||
		!configuration.packages ||
		typeof configuration.packages !== "object" ||
		Array.isArray(configuration.packages)
	) {
		fail("dependency map must define canonicalCheck.repository and canonicalCheck.packages");
	}
	if (!map.repositories.some((repository) => repository.id === configuration.repository)) {
		fail(`canonical dependency check references unknown repository: ${configuration.repository}`);
	}
	assertInside(workspaceRoot, repositoryRoot, "checked repository");
	const consumers = map.consumers
		.filter((consumer) => consumer.repository === configuration.repository)
		.map((consumer) => {
			if (
				typeof consumer.manifest !== "string" ||
				!new Set(["dependencies", "devDependencies"]).has(consumer.section) ||
				consumer.field !== consumer.package ||
				typeof consumer.canonicalReference !== "string" ||
				consumer.canonicalReference.length === 0
			) {
				fail(`canonical dependency consumer is malformed: ${JSON.stringify(consumer)}`);
			}
			const expectedPackage = configuration.packages[consumer.package];
			if (
				!exactKeys(expectedPackage, ["version", "resolved", "integrity"]) ||
				![expectedPackage.version, expectedPackage.resolved].every((value) => typeof value === "string" && value.length > 0) ||
				!/^sha512-[A-Za-z0-9+/]+={0,2}$/u.test(expectedPackage.integrity ?? "")
			) {
				fail(`canonical lock evidence is missing or malformed for ${consumer.package}`);
			}
			if (
				consumer.canonicalReference.startsWith("file:") &&
				(path.posix.isAbsolute(consumer.canonicalReference.slice(5)) || path.win32.isAbsolute(consumer.canonicalReference.slice(5)))
			) {
				fail(`approved canonical reference is not portable for ${consumer.package}`);
			}
			if (
				(consumer.canonicalReference.startsWith("file:") ||
					consumer.canonicalReference.startsWith("https://codeload.github.com/")) &&
				expectedPackage.resolved !== consumer.canonicalReference
			) {
				fail(`canonical lock resolution does not match the approved reference for ${consumer.package}`);
			}
			const manifestPath = assertInside(repositoryRoot, path.join(repositoryRoot, consumer.manifest), "checked consumer manifest");
			return {
				...consumer,
				expectedPackage,
				manifestPath,
				lockfilePath: path.join(path.dirname(manifestPath), "package-lock.json")
			};
		});
	if (consumers.length === 0) fail(`canonical dependency check has no consumers for ${configuration.repository}`);
	return { consumers, manifestPaths: canonicalManifestPaths(repositoryRoot) };
}

function checkCanonicalDependenciesWorker(options = {}) {
	if (
		options.afterInspectForTest !== undefined &&
		(process.env.STARK_LOCAL_PACKAGE_TEST_MODE !== "1" || typeof options.afterInspectForTest !== "function")
	) {
		fail("after-inspection injection is test-only");
	}
	const map = options.map ?? readJson(defaultMapPath, "local dependency map");
	const workspaceRoot = path.resolve(options.workspaceRoot ?? defaultWorkspaceRoot(map));
	const repositoryRoot = path.resolve(options.repositoryRoot ?? projectRoot);
	const context = canonicalCheckContext(map, workspaceRoot, repositoryRoot);
	const checkedFiles = [
		...new Set([...context.manifestPaths, ...context.consumers.flatMap((consumer) => [consumer.manifestPath, consumer.lockfilePath])])
	].sort();
	const managedRelativePaths = managedPaths(workspaceRoot, checkedFiles);
	const proof = captureRegularFileSet(workspaceRoot, managedRelativePaths);
	const documents = new Map(checkedFiles.map((filePath) => [filePath, readJson(filePath, "canonical dependency input")]));
	const violations = [];
	const addViolation = (filePath, packageName, field, expected, actual) => {
		violations.push(
			`file=${checkFileLabel(filePath, repositoryRoot, workspaceRoot)} package=${packageName} field=${field} expected=${checkValue(expected)} actual=${checkValue(actual)}`
		);
	};

	for (const consumer of context.consumers) {
		const manifest = documents.get(consumer.manifestPath);
		const lock = documents.get(consumer.lockfilePath);
		const manifestReference = manifest[consumer.section]?.[consumer.field];
		if (manifestReference !== consumer.canonicalReference) {
			addViolation(
				consumer.manifestPath,
				consumer.package,
				`manifest.${consumer.section}`,
				consumer.canonicalReference,
				manifestReference
			);
		}
		const rootReference = lock.packages?.[""]?.[consumer.section]?.[consumer.field];
		if (rootReference !== consumer.canonicalReference) {
			addViolation(
				consumer.lockfilePath,
				consumer.package,
				`lock.packages[""].${consumer.section}`,
				consumer.canonicalReference,
				rootReference
			);
		}
		const installedField = `lock.packages["node_modules/${consumer.package}"]`;
		const installed = lock.packages?.[`node_modules/${consumer.package}`];
		if (!installed || typeof installed !== "object" || Array.isArray(installed)) {
			addViolation(consumer.lockfilePath, consumer.package, installedField, consumer.expectedPackage, installed);
			continue;
		}
		for (const field of ["version", "resolved", "integrity"]) {
			if (installed[field] !== consumer.expectedPackage[field]) {
				addViolation(
					consumer.lockfilePath,
					consumer.package,
					`${installedField}.${field}`,
					consumer.expectedPackage[field],
					installed[field]
				);
			}
		}
		if (installed.link !== undefined) {
			addViolation(consumer.lockfilePath, consumer.package, `${installedField}.link`, undefined, installed.link);
		}
	}

	const approvedManifestFields = new Set(
		context.consumers.map((consumer) => `${consumer.manifestPath}\0${consumer.section}\0${consumer.package}`)
	);
	const approvedLockFields = new Map();
	for (const consumer of context.consumers) {
		if (!approvedLockFields.has(consumer.lockfilePath)) {
			approvedLockFields.set(consumer.lockfilePath, { packageNames: new Set(), installedPaths: new Set() });
		}
		const approved = approvedLockFields.get(consumer.lockfilePath);
		approved.packageNames.add(consumer.package);
		approved.installedPaths.add(`node_modules/${consumer.package}`);
	}
	for (const manifestPath of context.manifestPaths) {
		const manifest = documents.get(manifestPath);
		for (const section of ["dependencies", "devDependencies", "optionalDependencies", "peerDependencies"]) {
			for (const [packageName, reference] of Object.entries(manifest[section] ?? {})) {
				if (approvedManifestFields.has(`${manifestPath}\0${section}\0${packageName}`)) continue;
				if (isLocalDependencyReference(reference)) {
					addViolation(manifestPath, packageName, `manifest.${section}`, "non-local dependency reference", reference);
				}
			}
		}
	}
	for (const [lockfilePath, approved] of approvedLockFields) {
		const lock = documents.get(lockfilePath);
		for (const section of ["dependencies", "devDependencies", "optionalDependencies", "peerDependencies"]) {
			for (const [packageName, reference] of Object.entries(lock.packages?.[""]?.[section] ?? {})) {
				if (approved.packageNames.has(packageName)) continue;
				if (isLocalDependencyReference(reference)) {
					addViolation(lockfilePath, packageName, `lock.packages[""].${section}`, "non-local dependency reference", reference);
				}
			}
		}
		for (const [lockPath, installed] of Object.entries(lock.packages ?? {})) {
			if (!lockPath || !installed || typeof installed !== "object" || Array.isArray(installed)) continue;
			const packageName = packageNameFromLockPath(lockPath, installed);
			if (approved.installedPaths.has(lockPath)) continue;
			const installedField = `lock.packages[${JSON.stringify(lockPath)}]`;
			if (isLocalDependencyReference(installed.resolved)) {
				addViolation(lockfilePath, packageName, `${installedField}.resolved`, "non-local dependency reference", installed.resolved);
			}
			if (installed.link === true) addViolation(lockfilePath, packageName, `${installedField}.link`, false, true);
		}
	}

	const dependencyFiles = dependencyPaths(workspaceRoot);
	const unexpectedFiles = [dependencyFiles.statePath, dependencyFiles.transactionPath];
	const reportedUnexpectedFiles = new Set();
	for (const filePath of unexpectedFiles) {
		if (!pathEntryExists(filePath)) continue;
		reportedUnexpectedFiles.add(filePath);
		addViolation(filePath, "<workspace>", path.basename(filePath, ".json"), "absent", "present");
	}
	options.afterInspectForTest?.();
	assertRegularFileSet(proof);
	for (const filePath of unexpectedFiles) {
		if (reportedUnexpectedFiles.has(filePath) || !pathEntryExists(filePath)) continue;
		addViolation(filePath, "<workspace>", path.basename(filePath, ".json"), "absent", "present");
	}
	if (violations.length > 0) {
		fail(`Dependency check found ${violations.length} violation${violations.length === 1 ? "" : "s"}:\n- ${violations.join("\n- ")}`);
	}
	return { mode: "canonical", checkedConsumers: context.consumers.length, checkedFiles: checkedFiles.length };
}

export function checkCanonicalDependencies(options = {}) {
	if (Object.keys(options).some((key) => key !== "workspaceRoot")) {
		fail("canonical dependency check accepts only workspaceRoot");
	}
	return checkCanonicalDependenciesWorker(options);
}

export function checkCanonicalDependenciesForTest(options = {}) {
	if (process.env.STARK_LOCAL_PACKAGE_TEST_MODE !== "1") fail("canonical dependency check injection is test-only");
	return checkCanonicalDependenciesWorker(options);
}

function currentReference(consumer) {
	const manifest = readJson(consumer.manifestPath, "consumer manifest");
	const reference = manifest[consumer.section]?.[consumer.field];
	if (typeof reference !== "string")
		fail(`consumer field is missing: ${consumer.repository}/${consumer.manifest}/${consumer.section}/${consumer.field}`);
	return reference;
}

function generationFromReferences(consumers, references) {
	let generationPath;
	for (let index = 0; index < consumers.length; index += 1) {
		const reference = references[index];
		if (!reference.startsWith("file:")) return undefined;
		const artifactPath = path.resolve(path.dirname(consumers[index].manifestPath), reference.slice("file:".length));
		const artifactDirectory = path.dirname(artifactPath);
		const candidate = path.dirname(artifactDirectory);
		if (path.basename(artifactDirectory) !== "artifacts" || !/^[a-f0-9]{32}\.complete$/u.test(path.basename(candidate)))
			return undefined;
		if (generationPath && path.resolve(generationPath) !== path.resolve(candidate)) return undefined;
		generationPath = candidate;
	}
	return generationPath;
}

function validateGeneration(generationPath, workspaceRoot, validateGenerationImplementation) {
	const stateRoot = path.join(workspaceRoot, "tmp", "local-package-state");
	assertInside(stateRoot, generationPath, "local package generation");
	const generationId = path.basename(generationPath, ".complete");
	const proof = validateGenerationImplementation(generationPath, { generationId, stateRoot });
	const artifacts = new Map();
	for (const artifact of proof.result?.artifacts ?? []) {
		if (typeof artifact.package !== "string" || typeof artifact.artifact !== "string" || typeof artifact.tarballIntegrity !== "string")
			fail("validated generation has incomplete artifact evidence");
		artifacts.set(artifact.package, {
			...artifact,
			absolutePath: assertInside(generationPath, path.join(generationPath, artifact.artifact), "generation artifact")
		});
	}
	return { generationId, generationPath: path.resolve(generationPath), proof, artifacts };
}

function validateReturnedDescriptor(descriptor, validatedGeneration) {
	if (
		!descriptor ||
		path.resolve(descriptor.generationPath ?? "") !== validatedGeneration.generationPath ||
		descriptor.generationId !== validatedGeneration.generationId
	) {
		fail("builder returned a descriptor that does not identify the validated generation");
	}
	const descriptorArtifacts = new Map((descriptor.artifacts ?? []).map((artifact) => [artifact.path, artifact]));
	for (const artifact of validatedGeneration.artifacts.values()) {
		const returned = descriptorArtifacts.get(artifact.artifact);
		if (!returned || returned.sha512 !== artifact.sha512) fail(`builder descriptor does not match ${artifact.artifact}`);
	}
}

function localReferences(consumers, generation) {
	return consumers.map((consumer) => {
		const artifact = generation.artifacts.get(consumer.package);
		if (!artifact) fail(`validated generation does not contain ${consumer.package}`);
		let relative = normalizeRelative(path.relative(path.dirname(consumer.manifestPath), artifact.absolutePath));
		if (!relative.startsWith(".")) relative = `./${relative}`;
		if (path.isAbsolute(relative)) fail(`local reference for ${consumer.package} is not relative`);
		return { reference: `file:${relative}`, artifact };
	});
}

function detectMode(context, workspaceRoot, validateGenerationImplementation) {
	const references = context.consumers.map(currentReference);
	if (references.every((reference, index) => reference === context.consumers[index].canonicalReference)) {
		return { mode: "canonical", references };
	}
	const generationPath = generationFromReferences(context.consumers, references);
	if (generationPath) {
		const generation = validateGeneration(generationPath, workspaceRoot, validateGenerationImplementation);
		const expected = localReferences(context.consumers, generation);
		if (references.every((reference, index) => reference === expected[index].reference))
			return { mode: "local", references, generation, expected };
	}
	fail(
		"workspace has a mixed or unknown dependency mode; restore every mapped reference to canonical or one validated generation before retrying"
	);
}

function groupedLocks(consumers, localArtifacts = []) {
	const groups = new Map();
	for (let index = 0; index < consumers.length; index += 1) {
		const consumer = consumers[index];
		const key = path.resolve(consumer.lockfilePath);
		if (!groups.has(key))
			groups.set(key, {
				lockfilePath: key,
				repository: consumer.repositoryEntry,
				repositoryDirectory: consumer.repositoryDirectory,
				consumers: []
			});
		groups.get(key).consumers.push({ ...consumer, artifact: localArtifacts[index]?.artifact });
	}
	return [...groups.values()].sort((left, right) => left.lockfilePath.localeCompare(right.lockfilePath));
}

export function dependencyInstallInvocationForTest({ repository, repositoryDirectory, lockfilePath }) {
	const launcher = path.join(projectRoot, "scripts", "with-project-node.sh");
	const arguments_ = [launcher, "--repo", repositoryDirectory];
	if (!fs.existsSync(path.join(repositoryDirectory, ".nvmrc"))) {
		const fallback = repository.node?.fallback?.version;
		if (!fallback) fail(`${repository.id} has no .nvmrc or exact configured Node fallback`);
		arguments_.push("--node-version", fallback);
	}
	arguments_.push("--", "npm");
	const lockDirectory = path.dirname(assertInside(repositoryDirectory, lockfilePath, "consumer lockfile"));
	const prefix = path.relative(repositoryDirectory, lockDirectory);
	if (prefix && prefix !== ".") arguments_.push("--prefix", normalizeRelative(prefix));
	arguments_.push("install", "--package-lock-only", "--ignore-scripts", "--no-audit", "--no-fund");
	return { command: "bash", arguments_, cwd: projectRoot };
}

function defaultRunInstall(context) {
	const invocation = dependencyInstallInvocationForTest(context);
	const result = spawnSync(invocation.command, invocation.arguments_, { cwd: invocation.cwd, env: process.env, stdio: "inherit" });
	if (result.error) fail(`could not launch npm for ${context.lockfilePath}: ${result.error.message}`, result.error);
	if (result.status !== 0) fail(`npm lock regeneration failed for ${context.lockfilePath} with status ${result.status}`);
}

function runManagedInstall(workspaceRoot, managedRelativePaths, group, runInstall) {
	const before = captureRegularFileSet(workspaceRoot, managedRelativePaths);
	runInstall(group);
	const after = captureRegularFileSet(workspaceRoot, managedRelativePaths);
	const allowedPath = normalizeRelative(path.relative(workspaceRoot, group.lockfilePath));
	const afterFiles = new Map(after.files.map((record) => [record.path, record]));
	for (const record of before.files) {
		if (record.path !== allowedPath && JSON.stringify(record) !== JSON.stringify(afterFiles.get(record.path))) {
			fail(`lock regeneration changed an unmanaged target: ${record.path}`);
		}
	}
}

function updateManifests(workspaceRoot, managedRelativePaths, consumers, references) {
	const byManifest = new Map();
	for (let index = 0; index < consumers.length; index += 1) {
		const consumer = consumers[index];
		if (!byManifest.has(consumer.manifestPath)) {
			const original = fs.readFileSync(consumer.manifestPath);
			byManifest.set(consumer.manifestPath, { original, manifest: JSON.parse(original.toString("utf8")) });
		}
		const entry = byManifest.get(consumer.manifestPath);
		entry.manifest[consumer.section][consumer.field] = references[index];
	}
	for (const [manifestPath, entry] of byManifest)
		writeManagedFile(workspaceRoot, managedRelativePaths, manifestPath, manifestContents(entry.original, entry.manifest));
}

function verifyLocalLocks(groups) {
	for (const group of groups) {
		const lock = readJson(group.lockfilePath, "regenerated package lock");
		for (const consumer of group.consumers) {
			const expectedReference = currentReference(consumer);
			const rootReference = lock.packages?.[""]?.[consumer.section]?.[consumer.field];
			const installed = lock.packages?.[`node_modules/${consumer.field}`];
			if (rootReference !== expectedReference || installed?.resolved !== expectedReference)
				fail(`${group.lockfilePath} does not resolve ${consumer.field} from its local reference`);
			if (installed.integrity !== consumer.artifact.tarballIntegrity)
				fail(`${group.lockfilePath} has the wrong integrity for ${consumer.field}`);
			if (installed.version !== consumer.artifact.version) fail(`${group.lockfilePath} has the wrong version for ${consumer.field}`);
		}
	}
}

function verifyLockDeclarations(groups) {
	for (const group of groups) {
		const lock = readJson(group.lockfilePath, "package lock");
		for (const consumer of group.consumers) {
			const expectedReference = currentReference(consumer);
			if (lock.packages?.[""]?.[consumer.section]?.[consumer.field] !== expectedReference) {
				fail(`${group.lockfilePath} is in a mixed dependency mode for ${consumer.field}`);
			}
		}
	}
}

function verifyRecords(workspaceRoot, records, managedRelativePaths, label) {
	validateRecords(records, managedRelativePaths);
	const proof = captureRegularFileSet(workspaceRoot, managedRelativePaths);
	for (const record of records) {
		const actual = fs.readFileSync(path.join(workspaceRoot, record.path));
		if (!actual.equals(Buffer.from(record.contents, "base64"))) fail(`${label} changed ${record.path}; transaction was not accepted`);
	}
	assertRegularFileSet(proof);
}

function localState(workspaceRoot, canonicalFiles, touchedFiles, managedRelativePaths, generation) {
	const proof = captureRegularFileSet(workspaceRoot, managedRelativePaths);
	const localFiles = [...new Set(touchedFiles.map((filePath) => path.resolve(filePath)))].map((filePath) => ({
		path: normalizeRelative(path.relative(workspaceRoot, filePath)),
		sha256: hash(fs.readFileSync(filePath))
	}));
	assertRegularFileSet(proof);
	return {
		schemaVersion: 1,
		mode: "local",
		generationId: generation.generationId,
		generationPath: normalizeRelative(path.relative(workspaceRoot, generation.generationPath)),
		canonicalFiles,
		localFiles
	};
}

function verifyLocalState(workspaceRoot, state, generation, managedRelativePaths, context) {
	validateStateSchema(workspaceRoot, state, managedRelativePaths, context);
	if (state.generationId !== generation.generationId || path.resolve(workspaceRoot, state.generationPath) !== generation.generationPath)
		fail("local dependency state does not match the referenced generation");
	const proof = captureRegularFileSet(workspaceRoot, managedRelativePaths);
	for (const record of state.localFiles) {
		const filePath = assertInside(workspaceRoot, path.join(workspaceRoot, record.path), "local state file");
		if (!pathEntryExists(filePath) || hash(fs.readFileSync(filePath)) !== record.sha256)
			fail(`${record.path} changed after local mode; refusing to discard edits`);
	}
	assertRegularFileSet(proof);
}

function switchDependencyModeWorker(mode, options = {}) {
	if (!new Set(["local", "canonical"]).has(mode)) fail(`unsupported dependency mode: ${mode}`);
	if (
		options.afterTransactionForTest !== undefined &&
		(process.env.STARK_LOCAL_PACKAGE_TEST_MODE !== "1" || typeof options.afterTransactionForTest !== "function")
	) {
		fail("after-transaction injection is test-only");
	}
	if (
		options.afterRestoreRecordForTest !== undefined &&
		(process.env.STARK_LOCAL_PACKAGE_TEST_MODE !== "1" || typeof options.afterRestoreRecordForTest !== "function")
	) {
		fail("after-restore-record injection is test-only");
	}
	const map = options.map ?? readJson(defaultMapPath, "local dependency map");
	const workspaceRoot = path.resolve(options.workspaceRoot ?? defaultWorkspaceRoot(map));
	const validateMapImplementation = options.validateMap ?? validateDependencyMap;
	const validateGenerationImplementation = options.validateGeneration ?? validateGenerationAt;
	const buildGeneration = options.buildGeneration ?? (() => runPipeline(workspaceRoot));
	const runInstall = options.runInstall ?? defaultRunInstall;
	validateMapImplementation(map, workspaceRoot);
	const context = mapContext(map, workspaceRoot);
	const paths = dependencyPaths(workspaceRoot);
	const manifests = context.consumers.map((consumer) => consumer.manifestPath);
	const lockGroups = groupedLocks(context.consumers);
	const touchedFiles = [...manifests, ...lockGroups.map((group) => group.lockfilePath)];
	const managedRelativePaths = managedPaths(workspaceRoot, touchedFiles);
	const initialProof = captureManagedFileSet(workspaceRoot, managedRelativePaths);
	if (initialProof.absent.length > 0 && !pathEntryExists(paths.transactionPath)) {
		fail(`managed files are missing without a recovery journal: ${initialProof.absent.join(", ")}`);
	}
	assertManagedFileSet(workspaceRoot, initialProof);
	ensureSafeDirectory(workspaceRoot, dependencyStateDirectory);
	recoverTransaction(
		workspaceRoot,
		paths.transactionPath,
		managedRelativePaths,
		paths.statePath,
		context,
		validateGenerationImplementation,
		options
	);
	captureRegularFileSet(workspaceRoot, managedRelativePaths);
	const current = detectMode(context, workspaceRoot, validateGenerationImplementation);
	if (current.mode === mode) {
		const currentGroups = groupedLocks(context.consumers, current.expected);
		verifyLockDeclarations(currentGroups);
		if (current.mode === "local") {
			verifyLocalLocks(currentGroups);
			verifyLocalState(
				workspaceRoot,
				readVerifiedState(workspaceRoot, paths.statePath),
				current.generation,
				managedRelativePaths,
				context
			);
		} else if (pathEntryExists(paths.statePath)) {
			fail("canonical manifests have an unexpected local dependency state; inspect the workspace before continuing");
		}
		return { mode, changed: false, generationPath: current.generation?.generationPath };
	}

	if (mode === "local") {
		const descriptor = buildGeneration();
		const generation = validateGeneration(descriptor.generationPath, workspaceRoot, validateGenerationImplementation);
		validateReturnedDescriptor(descriptor, generation);
		const desired = localReferences(context.consumers, generation);
		const groups = groupedLocks(context.consumers, desired);
		const transaction = beginTransaction(
			workspaceRoot,
			touchedFiles,
			managedRelativePaths,
			paths.statePath,
			paths.transactionPath,
			current.mode
		);
		const canonicalFiles = transaction.backups.filter((record) => managedRelativePaths.includes(record.path));
		try {
			options.afterTransactionForTest?.({ mode, transactionPath: paths.transactionPath });
			assertPreparedTransaction(
				workspaceRoot,
				transaction,
				paths.transactionPath,
				managedRelativePaths,
				paths.statePath,
				context,
				validateGenerationImplementation
			);
			updateManifests(
				workspaceRoot,
				managedRelativePaths,
				context.consumers,
				desired.map((entry) => entry.reference)
			);
			for (const group of groups) runManagedInstall(workspaceRoot, managedRelativePaths, group, runInstall);
			verifyLocalLocks(groups);
			writeGeneratedFile(
				workspaceRoot,
				managedRelativePaths,
				paths.statePath,
				stableJson(localState(workspaceRoot, canonicalFiles, touchedFiles, managedRelativePaths, generation))
			);
			finishTransaction(workspaceRoot, paths.transactionPath);
			return { mode, changed: true, generationPath: generation.generationPath };
		} catch (error) {
			rollbackTransaction(
				workspaceRoot,
				paths.transactionPath,
				managedRelativePaths,
				paths.statePath,
				context,
				validateGenerationImplementation,
				error
			);
		}
	}

	const state = readVerifiedState(workspaceRoot, paths.statePath);
	verifyLocalState(workspaceRoot, state, current.generation, managedRelativePaths, context);
	const transaction = beginTransaction(
		workspaceRoot,
		touchedFiles,
		managedRelativePaths,
		paths.statePath,
		paths.transactionPath,
		current.mode
	);
	try {
		options.afterTransactionForTest?.({ mode, transactionPath: paths.transactionPath });
		assertPreparedTransaction(
			workspaceRoot,
			transaction,
			paths.transactionPath,
			managedRelativePaths,
			paths.statePath,
			context,
			validateGenerationImplementation
		);
		restoreRecords(workspaceRoot, state.canonicalFiles, managedRelativePaths, managedRelativePaths);
		for (const group of lockGroups) runManagedInstall(workspaceRoot, managedRelativePaths, group, runInstall);
		verifyRecords(workspaceRoot, state.canonicalFiles, managedRelativePaths, "canonical lock regeneration");
		const stateProof = captureRegularFileSet(workspaceRoot, [normalizeRelative(path.relative(workspaceRoot, paths.statePath))]);
		assertRegularFileSet(stateProof);
		fs.rmSync(paths.statePath);
		finishTransaction(workspaceRoot, paths.transactionPath);
		return { mode, changed: true };
	} catch (error) {
		rollbackTransaction(
			workspaceRoot,
			paths.transactionPath,
			managedRelativePaths,
			paths.statePath,
			context,
			validateGenerationImplementation,
			error
		);
	}
}

export function switchDependencyModeWorkerForTest(mode, options = {}) {
	if (process.env.STARK_LOCAL_PACKAGE_TEST_MODE !== "1") fail("dependency-mode worker injection is test-only");
	return switchDependencyModeWorker(mode, options);
}

function dependencyModeOperation(mode, workspaceRoot, map) {
	const projectRelative = normalizeRelative(path.relative(workspaceRoot, projectRoot));
	const repository = map.repositories.find((entry) => entry.directory === projectRelative);
	if (!repository) fail(`dependency-mode script must run from a mapped direct-child repository: ${projectRoot}`);
	const phase = `dependency-mode-${mode}`;
	const workerArguments = ["scripts/manage-workspace-dependencies.mjs", "--worker", mode, "--workspace-root", workspaceRoot];
	return {
		workspaceRoot,
		stateRoot: path.join(workspaceRoot, "tmp", "local-dependency-operation-state"),
		repository,
		command: { phase, cwd: ".", argv: ["node", ...workerArguments] }
	};
}

export function switchDependencyMode(mode, options = {}) {
	if (Object.keys(options).some((key) => key !== "workspaceRoot")) fail("dependency-mode orchestration accepts only workspaceRoot");
	const map = readJson(defaultMapPath, "local dependency map");
	const workspaceRoot = path.resolve(options.workspaceRoot ?? defaultWorkspaceRoot(map));
	const operation = dependencyModeOperation(mode, workspaceRoot, map);
	return runExclusiveWorkspaceCommand(operation, { result: true });
}

function parseArguments(arguments_) {
	const worker = arguments_[0] === "--worker";
	const [modeArgument, ...rest] = worker ? arguments_.slice(1) : arguments_;
	const mode = modeArgument?.replace(/^--/u, "");
	let workspaceRoot;
	for (let index = 0; index < rest.length; index += 1) {
		if (rest[index] === "--workspace-root" && rest[index + 1]) {
			workspaceRoot = path.resolve(rest[index + 1]);
			index += 1;
		} else {
			fail(`unknown or incomplete argument: ${rest[index]}`);
		}
	}
	return { mode, workspaceRoot, worker };
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
	try {
		const arguments_ = parseArguments(process.argv.slice(2));
		let result;
		if (arguments_.worker) {
			const map = readJson(defaultMapPath, "local dependency map");
			const workspaceRoot = path.resolve(arguments_.workspaceRoot ?? defaultWorkspaceRoot(map));
			const operation = dependencyModeOperation(arguments_.mode, workspaceRoot, map);
			assertExclusiveWorkspaceCommandWorker({
				workspaceRoot,
				stateRoot: operation.stateRoot,
				repositoryId: operation.repository.id,
				phase: operation.command.phase
			});
			result = switchDependencyModeWorker(arguments_.mode, { workspaceRoot });
			publishExclusiveWorkspaceCommandResult(
				{
					workspaceRoot,
					stateRoot: operation.stateRoot,
					repositoryId: operation.repository.id,
					phase: operation.command.phase
				},
				result
			);
		} else if (arguments_.mode === "check") {
			result = checkCanonicalDependencies({ workspaceRoot: arguments_.workspaceRoot });
		} else result = switchDependencyMode(arguments_.mode, { workspaceRoot: arguments_.workspaceRoot });
		if (!arguments_.worker) {
			if (arguments_.mode === "check") {
				process.stdout.write(
					`Dependency check passed for ${result.checkedConsumers} canonical references across ${result.checkedFiles} files.\n`
				);
			} else {
				process.stdout.write(
					result.changed
						? `Dependency mode switched to ${result.mode}${result.generationPath ? ` using ${result.generationPath}` : ""}.\n`
						: `Dependency mode is already ${result.mode}.\n`
				);
			}
		}
	} catch (error) {
		process.stderr.write(`Error: ${error.message}\n`);
		process.exitCode = 1;
	}
}
