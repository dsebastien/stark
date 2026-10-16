"use strict";

const fs = require("node:fs");
const path = require("node:path");

const HtmlHeadElements = require("./html-head-elements");

const PLACEHOLDER_REGEX = /(?:<|&lt;)%=\s+starkOptions\.(starkAppMetadata|starkAppConfig|metadata)\.(\w+)\s+%(?:>|&gt;)/g;
const DEFAULT_METADATA = Object.freeze({
	TITLE: "Stark Application by @NationalBankBelgium"
});

function readTextFile(filePath, description) {
	try {
		return fs.readFileSync(filePath, "utf8");
	} catch (error) {
		throw new Error(`Unable to read ${description} "${filePath}": ${error.message}`, { cause: error });
	}
}

function readJson(filePath) {
	const content = readTextFile(filePath, "JSON file");

	try {
		return JSON.parse(content);
	} catch (error) {
		throw new Error(`Unable to parse JSON file "${filePath}": ${error.message}`, { cause: error });
	}
}

function resolveWorkspacePath(workspaceRoot, requestedPath, description) {
	const resolvedPath = path.resolve(workspaceRoot, requestedPath);
	const relativePath = path.relative(workspaceRoot, resolvedPath);

	if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
		throw new Error(`${description} must stay inside the Angular workspace: ${requestedPath}`);
	}

	return resolvedPath;
}

function splitConfiguration(configuration) {
	if (!configuration) {
		return [];
	}

	if (Array.isArray(configuration)) {
		return configuration.flatMap((entry) => splitConfiguration(entry));
	}

	return String(configuration)
		.split(",")
		.map((entry) => entry.trim())
		.filter(Boolean);
}

function mergeAngularBuildOptions(buildTargetConfig, configuration) {
	const mergedOptions = {
		...(buildTargetConfig?.options ?? {})
	};

	for (const configName of splitConfiguration(configuration)) {
		const configOptions = buildTargetConfig?.configurations?.[configName];
		if (!configOptions) {
			throw new Error(`Unknown Angular build configuration "${configName}".`);
		}

		Object.assign(mergedOptions, configOptions);
	}

	return mergedOptions;
}

function resolveAngularBuildOptions({ workspaceRoot, angularConfigPath = "angular.json", projectName, configuration }) {
	if (!projectName) {
		throw new Error('Missing required option "projectName".');
	}

	const angularWorkspacePath = resolveWorkspacePath(workspaceRoot, angularConfigPath, "Angular workspace configuration");
	const angularWorkspace = readJson(angularWorkspacePath);
	const project = angularWorkspace.projects?.[projectName];

	if (!project) {
		throw new Error(`Unable to find Angular project "${projectName}" in ${angularConfigPath}.`);
	}

	const buildTargetConfig = project.architect?.build ?? project.targets?.build;

	if (!buildTargetConfig) {
		throw new Error(`Unable to find the build target for Angular project "${projectName}".`);
	}

	return mergeAngularBuildOptions(buildTargetConfig, configuration);
}

function resolveConfiguredFile(workspaceRoot, sourcePath, buildOptions) {
	const resolvedSourcePath = resolveWorkspacePath(workspaceRoot, sourcePath, "Stark application data file");
	const replacement = (buildOptions.fileReplacements ?? []).find((entry) => {
		if (!entry?.replace || !entry?.with) {
			throw new Error(`Invalid Angular file replacement: ${JSON.stringify(entry)}`);
		}

		return resolveWorkspacePath(workspaceRoot, entry.replace, "Angular file replacement source") === resolvedSourcePath;
	});

	return replacement ? resolveWorkspacePath(workspaceRoot, replacement.with, "Angular file replacement target") : resolvedSourcePath;
}

function resolveStarkTemplateData({ workspaceRoot, angularConfigPath = "angular.json", projectName, configuration }) {
	const buildOptions = resolveAngularBuildOptions({ workspaceRoot, angularConfigPath, projectName, configuration });

	return {
		metadata: {
			...DEFAULT_METADATA,
			BASE_URL: buildOptions.baseHref ?? "/"
		},
		starkAppConfig: readJson(resolveConfiguredFile(workspaceRoot, "src/stark-app-config.json", buildOptions)),
		starkAppMetadata: readJson(resolveConfiguredFile(workspaceRoot, "src/stark-app-metadata.json", buildOptions))
	};
}

function loadHeadConfig(headConfigPath) {
	const resolvedHeadConfigPath = path.resolve(headConfigPath);
	delete require.cache[resolvedHeadConfigPath];

	return require(resolvedHeadConfigPath);
}

function escapeHtml(value) {
	return String(value)
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;")
		.replaceAll("'", "&#39;");
}

function replacePlaceholdersByValues(indexHtml, templateData) {
	return indexHtml.replaceAll(PLACEHOLDER_REGEX, (placeholder, configName, property) => {
		const value = templateData?.[configName]?.[property];

		if (value === undefined || value === null || value === "") {
			return placeholder;
		}

		return escapeHtml(value);
	});
}

function indentText(content, indent) {
	return content
		.split("\n")
		.map((line) => `${indent}${line}`)
		.join("\n");
}

function injectHeadTags(indexHtml, workspaceRoot, baseUrl) {
	const headConfigPath = path.resolve(workspaceRoot, "config/index-head-config.js");

	if (!fs.existsSync(headConfigPath)) {
		return indexHtml;
	}

	const headClosingTagIndex = indexHtml.indexOf("</head>");
	if (headClosingTagIndex === -1) {
		throw new Error('Unable to inject head tags because the template does not contain a closing "</head>" tag.');
	}

	const headTags = HtmlHeadElements.getHtmlElementString(loadHeadConfig(headConfigPath), baseUrl);
	const formattedHeadTags = indentText(headTags, "\t\t");

	return `${indexHtml.slice(0, headClosingTagIndex)}${formattedHeadTags ? `\n${formattedHeadTags}\n\t` : ""}${indexHtml.slice(headClosingTagIndex)}`;
}

function generateIndexHtml({
	workspaceRoot = process.cwd(),
	angularConfigPath = "angular.json",
	projectName,
	configuration,
	inputPath,
	outputPath
}) {
	if (!inputPath) {
		throw new Error('Missing required option "inputPath".');
	}

	if (!outputPath) {
		throw new Error('Missing required option "outputPath".');
	}

	const resolvedWorkspaceRoot = path.resolve(workspaceRoot);
	const templatePath = resolveWorkspacePath(resolvedWorkspaceRoot, inputPath, "Index template");
	const generatedIndexPath = resolveWorkspacePath(resolvedWorkspaceRoot, outputPath, "Generated index output");
	const templateData = resolveStarkTemplateData({
		workspaceRoot: resolvedWorkspaceRoot,
		angularConfigPath,
		projectName,
		configuration
	});

	let generatedIndexHtml = readTextFile(templatePath, "index template");
	generatedIndexHtml = injectHeadTags(generatedIndexHtml, resolvedWorkspaceRoot, templateData.metadata.BASE_URL);
	generatedIndexHtml = replacePlaceholdersByValues(generatedIndexHtml, templateData);

	fs.mkdirSync(path.dirname(generatedIndexPath), { recursive: true });
	fs.writeFileSync(generatedIndexPath, generatedIndexHtml);

	return generatedIndexHtml;
}

function parseCliArgs(argv) {
	const parsedArgs = {};

	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i];

		if (arg === "--help" || arg === "-h") {
			parsedArgs.help = true;
			continue;
		}

		if (!arg.startsWith("--")) {
			throw new Error(`Unexpected argument "${arg}".`);
		}

		const equalsIndex = arg.indexOf("=");
		if (equalsIndex > -1) {
			const key = arg.slice(2, equalsIndex);
			parsedArgs[key] = arg.slice(equalsIndex + 1);
			continue;
		}

		const key = arg.slice(2);
		const nextArg = argv[i + 1];

		if (!nextArg || nextArg.startsWith("--")) {
			parsedArgs[key] = true;
			continue;
		}

		parsedArgs[key] = nextArg;
		i += 1;
	}

	return parsedArgs;
}

function printCliHelp() {
	process.stdout.write(
		[
			"Usage: node ./node_modules/@nationalbankbelgium/stark-build/config/index-html.generator.js \\",
			"  --project <angular-project> \\",
			"  --input <template-path> \\",
			"  --output <generated-index-path> \\",
			"  [--configuration <name[,name]>] \\",
			"  [--angular-config <workspace-config-path>] \\",
			"  [--workspace-root <workspace-root>]",
			""
		].join("\n")
	);
}

function runCli(argv) {
	const cliArgs = parseCliArgs(argv);
	if (cliArgs.help) {
		printCliHelp();
		return;
	}

	generateIndexHtml({
		workspaceRoot: cliArgs["workspace-root"],
		angularConfigPath: cliArgs["angular-config"],
		projectName: cliArgs.project,
		configuration: cliArgs.configuration,
		inputPath: cliArgs.input,
		outputPath: cliArgs.output
	});
}

if (require.main === module) {
	try {
		runCli(process.argv.slice(2));
	} catch (error) {
		process.stderr.write(`${error.message}\n`);
		process.exitCode = 1;
	}
}

module.exports = {
	generateIndexHtml,
	replacePlaceholdersByValues,
	resolveAngularBuildOptions,
	resolveStarkTemplateData
};
