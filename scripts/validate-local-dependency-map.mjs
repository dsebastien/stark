import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const mapPath = path.join(scriptDirectory, "local-dependency-map.json");
const dependencySections = ["dependencies", "devDependencies"];
const ignoredDirectories = new Set([".angular", ".git", "coverage", "dist", "node_modules", "reports", "tmp"]);

function clone(value) {
	return JSON.parse(JSON.stringify(value));
}

function isRelativePath(value, allowParent = false) {
	if (typeof value !== "string" || value.length === 0 || path.posix.isAbsolute(value) || path.win32.isAbsolute(value)) {
		return false;
	}
	return allowParent || !value.split(/[\\/]/u).includes("..");
}

function readJson(filePath) {
	return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

export function defaultWorkspaceRoot(map) {
	const candidates = [
		path.resolve(process.cwd(), ".."),
		path.resolve(scriptDirectory, "..", ".."),
		path.resolve(scriptDirectory, "..", "..", "..")
	];
	return candidates.find((candidate) => (map?.repositories ?? []).every((repository) => (
		typeof repository?.directory === "string" && fs.existsSync(path.join(candidate, repository.directory))
	))) ?? candidates[0];
}

function readJsonSource(repositoryDirectory, source) {
	const [relativePath, propertyPath] = source.split("#");
	const filePath = path.join(repositoryDirectory, relativePath);
	if (!fs.existsSync(filePath) || !propertyPath) {
		return undefined;
	}
	return propertyPath.split(".").reduce((value, property) => value?.[property], readJson(filePath));
}

function listSourceManifests(repositoryDirectory) {
	const manifests = [];

	function visit(directory) {
		for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
			if (entry.isDirectory() && ignoredDirectories.has(entry.name)) {
				continue;
			}
			const entryPath = path.join(directory, entry.name);
			if (entry.isDirectory()) {
				visit(entryPath);
			} else if (entry.name === "package.json") {
				manifests.push(entryPath);
			}
		}
	}

	visit(repositoryDirectory);
	return manifests;
}

export function validateMap(map, workspaceRoot) {
	const errors = [];
	if (map?.schemaVersion !== 1) {
		errors.push(`schemaVersion must be 1, received ${JSON.stringify(map?.schemaVersion)}`);
	}
	if (!Array.isArray(map?.repositories) || !Array.isArray(map?.consumers)) {
		errors.push("repositories and consumers must be arrays");
		throw new Error(`Invalid local dependency map:\n- ${errors.join("\n- ")}`);
	}
	if (!map.runtimeEvidence?.sourceCommit || !map.runtimeEvidence?.tarballIntegrity) {
		errors.push("runtimeEvidence must define sourceCommit and tarballIntegrity");
	}

	const repositories = new Map();
	const packages = new Map();
	for (const repository of map.repositories) {
		if (!repository?.id || repositories.has(repository.id)) {
			errors.push(`duplicate or missing repository id: ${JSON.stringify(repository?.id)}`);
			continue;
		}
		repositories.set(repository.id, repository);
		if (
			!isRelativePath(repository.directory) ||
			repository.directory.includes("/") ||
			repository.directory.includes("\\")
		) {
			errors.push(`${repository.id} directory must be a workspace-relative directory name: ${repository.directory}`);
			continue;
		}

		const repositoryDirectory = path.join(workspaceRoot, repository.directory);
		if (!fs.existsSync(repositoryDirectory)) {
			errors.push(`${repository.id} repository directory does not exist: ${repository.directory}`);
			continue;
		}

		const versionFile = repository.node?.versionFile;
		if (!isRelativePath(versionFile)) {
			errors.push(`${repository.id} has an invalid Node version file path`);
		} else {
			const versionPath = path.join(repositoryDirectory, versionFile);
			if (repository.node.required) {
				if (!fs.existsSync(versionPath)) {
					errors.push(`${repository.id} requires missing ${versionFile}`);
				} else if (fs.readFileSync(versionPath, "utf8").trim() !== repository.node.requirement) {
					errors.push(`${repository.id} ${versionFile} does not match requirement ${repository.node.requirement}`);
				}
			} else {
				if (!/^\d+\.\d+\.\d+$/u.test(repository.node.fallback?.version ?? "")) {
					errors.push(`${repository.id} must define an exact major.minor.patch Node fallback version`);
				}
				if (!fs.existsSync(versionPath)) {
					const compatibilityConstraint = readJsonSource(
						repositoryDirectory,
						repository.node.fallback?.compatibilityConstraintSource ?? ""
					);
					if (!compatibilityConstraint) {
						errors.push(`${repository.id} needs an existing ${versionFile} or a valid fallback compatibility constraint`);
					}
				}
			}
		}

		const rootManifestPath = path.join(repositoryDirectory, "package.json");
		const rootManifest = fs.existsSync(rootManifestPath) ? readJson(rootManifestPath) : {};
		if (!Array.isArray(repository.commands) || repository.commands.length === 0) {
			errors.push(`${repository.id} must define at least one build/pack command`);
		}
		for (const command of repository.commands ?? []) {
			if (!isRelativePath(command.cwd) || !Array.isArray(command.argv) || command.argv.length === 0) {
				errors.push(`${repository.id} has a malformed command`);
				continue;
			}
			if (!fs.existsSync(path.join(repositoryDirectory, command.cwd))) {
				errors.push(`${repository.id} command cwd does not exist: ${command.cwd}`);
			}
			if (command.argv[0] === "npm" && command.argv[1] === "run" && !rootManifest.scripts?.[command.argv[2]]) {
				errors.push(`${repository.id} command references missing npm script: ${command.argv[2]}`);
			}
		}

		const implementation = repository.packaging?.implementation?.split(" + ")[0];
		if (!implementation) {
			errors.push(`${repository.id} must define packaging provenance`);
		} else if (implementation.includes("#")) {
			if (readJsonSource(repositoryDirectory, implementation) === undefined) {
				errors.push(`${repository.id} packaging implementation does not exist: ${implementation}`);
			}
		} else if (!fs.existsSync(path.join(repositoryDirectory, implementation))) {
			errors.push(`${repository.id} packaging implementation does not exist: ${implementation}`);
		}
		if (!isRelativePath(repository.packaging?.packCwd)) {
			errors.push(`${repository.id} has an invalid packaging cwd`);
		}

		for (const packageEntry of repository.packages ?? []) {
			if (!packageEntry?.name || packages.has(packageEntry.name)) {
				errors.push(`duplicate or missing package name: ${JSON.stringify(packageEntry?.name)}`);
				continue;
			}
			packages.set(packageEntry.name, { packageEntry, repository });
			if (!isRelativePath(packageEntry.manifest)) {
				errors.push(`${packageEntry.name} has an invalid manifest path`);
				continue;
			}
			const packageManifestPath = path.join(repositoryDirectory, packageEntry.manifest);
			if (!fs.existsSync(packageManifestPath)) {
				errors.push(`${packageEntry.name} manifest does not exist: ${packageEntry.manifest}`);
			} else if (readJson(packageManifestPath).name !== packageEntry.name) {
				errors.push(`${packageEntry.name} does not match the name in ${packageEntry.manifest}`);
			}
			if (!Array.isArray(packageEntry.dependencies) || !Number.isInteger(packageEntry.buildOrder)) {
				errors.push(`${packageEntry.name} must define dependencies and an integer buildOrder`);
			}
			const artifact = packageEntry.artifact;
			if (
				!isRelativePath(artifact?.directory) ||
				!artifact?.pattern?.endsWith(".tgz") ||
				!artifact?.expectedName?.includes("{packageVersion}") ||
				artifact.expectedName.replace("{packageVersion}", "*") !== artifact.pattern
			) {
				errors.push(`${packageEntry.name} has malformed artifact metadata`);
			}
		}
	}

	for (const { packageEntry } of packages.values()) {
		for (const dependency of packageEntry.dependencies ?? []) {
			const dependencyEntry = packages.get(dependency)?.packageEntry;
			if (!dependencyEntry) {
				errors.push(`${packageEntry.name} references unmapped dependency ${dependency}`);
			} else if (dependencyEntry.buildOrder >= packageEntry.buildOrder) {
				errors.push(`${packageEntry.name} buildOrder must follow ${dependency}`);
			}
		}
	}

	const visiting = new Set();
	const visited = new Set();
	function visitPackage(packageName) {
		if (visiting.has(packageName)) {
			errors.push(`dependency cycle includes ${packageName}`);
			return;
		}
		if (visited.has(packageName)) {
			return;
		}
		visiting.add(packageName);
		for (const dependency of packages.get(packageName)?.packageEntry.dependencies ?? []) {
			visitPackage(dependency);
		}
		visiting.delete(packageName);
		visited.add(packageName);
	}
	for (const packageName of packages.keys()) {
		visitPackage(packageName);
	}

	const mappedConsumers = new Set();
	const packagesWithConsumers = new Set();
	for (const consumer of map.consumers) {
		const repository = repositories.get(consumer.repository);
		const packageOwner = packages.get(consumer.package);
		const key = `${consumer.repository}|${consumer.manifest}|${consumer.section}|${consumer.field}`;
		if (mappedConsumers.has(key)) {
			errors.push(`duplicate consumer ${key}`);
			continue;
		}
		mappedConsumers.add(key);
		packagesWithConsumers.add(consumer.package);
		if (!repository || !packageOwner) {
			errors.push(`consumer ${key} references an unknown repository or package`);
			continue;
		}
		if (!dependencySections.includes(consumer.section) || consumer.field !== consumer.package) {
			errors.push(`consumer ${key} must map its package field in dependencies or devDependencies`);
		}
		if (!isRelativePath(consumer.manifest) || !consumer.reference?.startsWith("file:")) {
			errors.push(`consumer ${key} has an invalid manifest or reference`);
			continue;
		}
		const manifestPath = path.join(workspaceRoot, repository.directory, consumer.manifest);
		const referencePath = consumer.reference.slice("file:".length).replace("{packageVersion}", "0.0.0");
		if (!isRelativePath(referencePath, true)) {
			errors.push(`consumer ${key} reference must be relative`);
		}
		if (!consumer.reference.endsWith(packageOwner.packageEntry.artifact.expectedName)) {
			errors.push(`consumer ${key} reference does not target ${consumer.package}'s expected tarball`);
		}
		const expectedTarget = path.resolve(
			workspaceRoot,
			packageOwner.repository.directory,
			packageOwner.packageEntry.artifact.directory,
			packageOwner.packageEntry.artifact.expectedName.replace("{packageVersion}", "0.0.0")
		);
		if (path.resolve(path.dirname(manifestPath), referencePath) !== expectedTarget) {
			errors.push(`consumer ${key} reference does not resolve to ${consumer.package}'s artifact directory`);
		}
		if (!fs.existsSync(manifestPath)) {
			errors.push(`consumer manifest does not exist: ${consumer.repository}/${consumer.manifest}`);
		} else if (!Object.hasOwn(readJson(manifestPath)[consumer.section] ?? {}, consumer.field)) {
			errors.push(`consumer field does not exist: ${key}`);
		}
	}

	for (const packageName of packages.keys()) {
		if (!packagesWithConsumers.has(packageName)) {
			errors.push(`${packageName} has no mapped consumers`);
		}
	}

	for (const [repositoryId, repository] of repositories) {
		const repositoryDirectory = path.join(workspaceRoot, repository.directory);
		if (!fs.existsSync(repositoryDirectory)) {
			continue;
		}
		for (const manifestPath of listSourceManifests(repositoryDirectory)) {
			const manifest = readJson(manifestPath);
			const relativeManifest = path.relative(repositoryDirectory, manifestPath).split(path.sep).join("/");
			for (const section of dependencySections) {
				for (const dependency of Object.keys(manifest[section] ?? {})) {
					const owner = packages.get(dependency)?.repository.id;
					if (owner && owner !== repositoryId) {
						const key = `${repositoryId}|${relativeManifest}|${section}|${dependency}`;
						if (!mappedConsumers.has(key)) {
							errors.push(`unmapped current cross-project dependency: ${key}`);
						}
					}
				}
			}
		}
	}

	if (errors.length > 0) {
		throw new Error(`Invalid local dependency map:\n- ${[...new Set(errors)].join("\n- ")}`);
	}
	return { consumers: map.consumers.length, packages: packages.size, repositories: repositories.size };
}

function runSelfTests(map, workspaceRoot) {
	const validResult = validateMap(map, workspaceRoot);
	assert.equal(validResult.repositories, 5);

	const reachedCases = [];
	function expectInvalid(name, mutate, expectedError) {
		const invalidMap = clone(map);
		mutate(invalidMap);
		assert.throws(() => validateMap(invalidMap, workspaceRoot), expectedError);
		reachedCases.push(name);
		process.stdout.write(`Reached negative self-test: ${name}\n`);
	}

	expectInvalid("malformed-map", (invalidMap) => {
		invalidMap.schemaVersion = 2;
	}, /schemaVersion/u);
	expectInvalid("dependency-cycle", (invalidMap) => {
		invalidMap.repositories[0].packages[0].dependencies = ["@nationalbankbelgium/eslint-config"];
	}, /dependency cycle/u);
	expectInvalid("duplicate-package", (invalidMap) => {
		invalidMap.repositories[0].packages.push(clone(invalidMap.repositories[0].packages[0]));
	}, /duplicate or missing package/u);
	expectInvalid("absolute-path", (invalidMap) => {
		invalidMap.repositories[0].directory = "C:\\workspace\\code-style";
	}, /workspace-relative directory/u);
	expectInvalid("missing-consumer", (invalidMap) => {
		invalidMap.consumers[0].field = "@nationalbankbelgium/not-present";
	}, /consumer field does not exist/u);
	expectInvalid("unmapped-dependency", (invalidMap) => {
		invalidMap.consumers = invalidMap.consumers.filter(
			(consumer) => !(consumer.repository === "eslint-config" && consumer.package === "@nationalbankbelgium/code-style")
		);
	}, /unmapped current cross-project dependency/u);
	expectInvalid("non-exact-node-fallback", (invalidMap) => {
		invalidMap.repositories.find((repository) => repository.id === "ui-router-angular").node.fallback.version = ">=22";
	}, /exact major\.minor\.patch Node fallback/u);

	assert.deepEqual(reachedCases, [
		"malformed-map",
		"dependency-cycle",
		"duplicate-package",
		"absolute-path",
		"missing-consumer",
		"unmapped-dependency",
		"non-exact-node-fallback"
	]);
	process.stdout.write(`Local dependency map validator self-tests passed (${reachedCases.length}/${reachedCases.length} negative cases reached).\n`);
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
	const map = JSON.parse(fs.readFileSync(mapPath, "utf8"));
	const arguments_ = process.argv.slice(2);
	const workspaceArgument = arguments_.find((argument) => !argument.startsWith("-"));
	const workspaceRoot = path.resolve(workspaceArgument ?? defaultWorkspaceRoot(map));

	if (arguments_.includes("--self-test")) {
		runSelfTests(map, workspaceRoot);
	} else {
		const result = validateMap(map, workspaceRoot);
		process.stdout.write(
			`Validated local dependency map: ${result.repositories} repositories, ${result.packages} packages, ${result.consumers} consumers.\n`
		);
	}
}
