import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const angularPackages = new Set(["stark-core", "stark-rbac", "stark-ui"]);
const nodePackages = new Set(["stark-build", "stark-testing"]);
const allPackages = fs
	.readFileSync(path.join(rootDirectory, "modules.txt"), "utf8")
	.split(/\r?\n/u)
	.map((entry) => entry.trim())
	.filter(Boolean);

function parseBoolean(value, optionName) {
	if (value === "true") {
		return true;
	}
	if (value === "false") {
		return false;
	}
	throw new Error(`${optionName} expects true or false, received "${value}".`);
}

function parseArguments(argv) {
	const options = { compile: true, packages: allPackages, trace: false };

	for (const argument of argv) {
		if (argument === "--trace" || argument === "--verbose") {
			options.trace = true;
		} else if (argument.startsWith("--packages=")) {
			const requestedPackages = argument
				.slice("--packages=".length)
				.split(/[,;\s]+/u)
				.filter(Boolean);
			const unknownPackages = requestedPackages.filter((packageName) => !allPackages.includes(packageName));
			if (requestedPackages.length === 0 || unknownPackages.length > 0) {
				throw new Error(`Unknown or empty package selection: ${unknownPackages.join(", ") || argument}`);
			}
			options.packages = [...new Set(requestedPackages)];
		} else if (argument.startsWith("--compile=")) {
			options.compile = parseBoolean(argument.slice("--compile=".length), "--compile");
		} else if (argument.startsWith("--quick-bundle=")) {
			options.compile = false;
		} else if (argument.startsWith("--bundle=")) {
			parseBoolean(argument.slice("--bundle=".length), "--bundle");
		} else {
			throw new Error(`Unknown build option "${argument}".`);
		}
	}

	return options;
}

function log(message) {
	process.stdout.write(`${message}\n`);
}

function trace(enabled, message) {
	if (enabled) {
		log(`  ${message}`);
	}
}

function run(command, args, cwd = rootDirectory) {
	log(`> ${command} ${args.join(" ")}`);
	execFileSync(command, args, { cwd, env: process.env, stdio: "inherit" });
}

function runNpm(args, cwd) {
	const npmCli = process.env.npm_execpath ?? path.join(path.dirname(process.execPath), "node_modules", "npm", "bin", "npm-cli.js");
	run(process.execPath, [npmCli, ...args], cwd);
}

function copyDirectory(source, destination, filter) {
	fs.cpSync(source, destination, {
		filter: filter ? (sourcePath) => filter(path.relative(source, sourcePath).split(path.sep).join("/")) : undefined,
		force: true,
		recursive: true
	});
}

function copyNodePackage(source, destination) {
	copyDirectory(source, destination, (relativePath) => {
		const firstSegment = relativePath.split("/")[0];
		return ![".angular", "dist", "node_modules"].includes(firstSegment);
	});
}

function addLicenseBanner(packageDirectory) {
	const bannerPath = path.join(rootDirectory, "packages", "license-banner.txt");
	const banner = fs.readFileSync(bannerPath, "utf8");

	for (const outputFolder of ["fesm2020", "fesm2022", "bundles"]) {
		const directory = path.join(packageDirectory, outputFolder);
		if (!fs.existsSync(directory)) {
			continue;
		}

		for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
			if (!entry.isFile() || entry.name.endsWith(".map")) {
				continue;
			}

			const filePath = path.join(directory, entry.name);
			const content = fs.readFileSync(filePath, "utf8");
			if (!content.startsWith(banner)) {
				fs.writeFileSync(filePath, `${banner}${content}`);
			}
		}
	}
}

function replaceVersionPlaceholders(value, version) {
	if (typeof value === "string") {
		return value.replaceAll("0.0.0-PLACEHOLDER-VERSION", version);
	}
	if (Array.isArray(value)) {
		return value.map((entry) => replaceVersionPlaceholders(entry, version));
	}
	if (value && typeof value === "object") {
		return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, replaceVersionPlaceholders(entry, version)]));
	}
	return value;
}

function preparePackageManifest(packageDirectory, version) {
	const packageJsonPath = path.join(packageDirectory, "package.json");
	const manifest = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
	const preparedManifest = replaceVersionPlaceholders(manifest, version);
	fs.writeFileSync(packageJsonPath, `${JSON.stringify(preparedManifest, null, 2)}\n`);
}

function packageTarball(packageName, packageDirectory, version) {
	const expectedTarball = `nationalbankbelgium-${packageName}-${version}.tgz`;
	runNpm(["pack", ".", "--silent"], packageDirectory);
	const tarballPath = path.join(packageDirectory, expectedTarball);
	if (!fs.existsSync(tarballPath)) {
		throw new Error(`npm pack did not create the expected archive: ${tarballPath}`);
	}
	return tarballPath;
}

function verifyConsumerReference(consumerName, packageName, version) {
	const consumerDirectory = path.join(rootDirectory, consumerName);
	const manifest = JSON.parse(fs.readFileSync(path.join(consumerDirectory, "package.json"), "utf8"));
	const dependency =
		manifest.dependencies?.[`@nationalbankbelgium/${packageName}`] ?? manifest.devDependencies?.[`@nationalbankbelgium/${packageName}`];
	if (!dependency) {
		return;
	}

	const expectedReference = `file:../dist/packages-dist/${packageName}/nationalbankbelgium-${packageName}-${version}.tgz`;
	if (dependency !== expectedReference) {
		throw new Error(`${consumerName} must reference ${packageName} as "${expectedReference}", received "${dependency}".`);
	}
}

function verifyTarballIntegrity(tarballPath) {
	const content = fs.readFileSync(tarballPath);
	const integrity = createHash("sha512").update(content).digest("base64");
	trace(true, `sha512-${integrity}`);
}

function buildPackage(packageName, options, version) {
	const sourceDirectory = path.join(rootDirectory, "packages", packageName);
	const compiledDirectory = path.join(rootDirectory, "dist", "packages", packageName);
	const packageDirectory = path.join(rootDirectory, "dist", "packages-dist", packageName);

	log(`\n=== Building ${packageName} ===`);
	fs.rmSync(packageDirectory, { force: true, recursive: true });
	fs.mkdirSync(path.dirname(packageDirectory), { recursive: true });

	if (angularPackages.has(packageName)) {
		if (options.compile) {
			run(process.execPath, [path.join(rootDirectory, "node_modules", "@angular", "cli", "bin", "ng.js"), "build", packageName]);
		} else if (!fs.existsSync(compiledDirectory)) {
			throw new Error(`Cannot skip compilation because ${compiledDirectory} does not exist.`);
		}

		const typingsDirectory = path.join(sourceDirectory, "typings");
		if (fs.existsSync(typingsDirectory)) {
			copyDirectory(typingsDirectory, path.join(compiledDirectory, "typings"));
		}
		addLicenseBanner(compiledDirectory);
		copyDirectory(compiledDirectory, packageDirectory);
	} else if (nodePackages.has(packageName)) {
		fs.rmSync(compiledDirectory, { force: true, recursive: true });
		copyNodePackage(sourceDirectory, compiledDirectory);
		copyNodePackage(compiledDirectory, packageDirectory);
	} else {
		throw new Error(`Package "${packageName}" has no configured build strategy.`);
	}

	fs.copyFileSync(path.join(rootDirectory, "packages", "README.md"), path.join(packageDirectory, "README.md"));
	preparePackageManifest(packageDirectory, version);
	fs.copyFileSync(path.join(rootDirectory, ".gitignore"), path.join(packageDirectory, ".npmignore"));
	const tarballPath = packageTarball(packageName, packageDirectory, version);
	verifyTarballIntegrity(tarballPath);
	verifyConsumerReference("starter", packageName, version);
	verifyConsumerReference("showcase", packageName, version);
	trace(options.trace, `Package archive: ${tarballPath}`);
}

function main() {
	const options = parseArguments(process.argv.slice(2));
	const rootManifest = JSON.parse(fs.readFileSync(path.join(rootDirectory, "package.json"), "utf8"));
	const version = rootManifest.version;

	if (options.packages.length === allPackages.length) {
		fs.rmSync(path.join(rootDirectory, "dist", "packages"), { force: true, recursive: true });
		fs.rmSync(path.join(rootDirectory, "dist", "packages-dist"), { force: true, recursive: true });
	}

	log(`Building Stark ${version}: ${options.packages.join(", ")}`);
	for (const packageName of options.packages) {
		buildPackage(packageName, options, version);
	}
}

try {
	main();
} catch (error) {
	process.stderr.write(`${error.stack ?? error.message}\n`);
	process.exitCode = 1;
}
