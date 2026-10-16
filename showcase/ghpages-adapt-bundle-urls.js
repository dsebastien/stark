let fs = require("fs");
let path = require("path");
let crypto = require("crypto");

const filesToChange = [/index.html/, /\.css$/, /\.js$/, /\.js\.map$/];

if (process.argv.length <= 2) {
	console.log("Usage: " + __filename + " deployDir oldDeployDir");
	process.exit(-1);
}

let deployDir = "/showcase/" + process.argv[2];

let baseHrefPlaceholder = "https://stark-dummy-base-href.invalid/";
let deployUrlPlaceholder = "https://stark-dummy-deploy-url.invalid/";

let urlWithTrailingSlash = deployDir.endsWith("/") ? deployDir : deployDir + "/";
let urlWithoutTrailingSlash = deployDir.endsWith("/") ? deployDir.substring(0, deployDir.length - 1) : deployDir;

let replacements = [
	{ searchValue: baseHrefPlaceholder, replaceValue: urlWithTrailingSlash },
	{ searchValue: deployUrlPlaceholder, replaceValue: urlWithTrailingSlash }, // these should also have a trailing slash, otherwise the URL of lazy loaded modules will be created incorrectly!
	{ searchValue: `url(/assets/`, replaceValue: `url(${urlWithTrailingSlash}assets/` }
];

// if the 3rd param is given (oldDeployDir) then it will be appended to the "showcase" folder and replaced by the new deployDir
if (process.argv[3]) {
	deployDir = "showcase/" + process.argv[2]; // no slashes at the beginning nor the end to cover all replacements at once
	let oldDeployDir = "showcase/" + process.argv[3]; // no slashes at the beginning nor the end cover all replacements at once

	replacements = [{ searchValue: oldDeployDir, replaceValue: deployDir }];
}

let outputDir = "showcase" + path.sep + "dist";

try {
	const items = fs.readdirSync(outputDir);

	let shasum384Replacements = [];

	for (const item of items) {
		for (const fileRegex of filesToChange) {
			if (item.match(fileRegex)) {
				const fullFilePath = outputDir + path.sep + item;
				const initialShasum384 = calculateShasum384(fullFilePath);

				replaceValuesInFile(fullFilePath, replacements);

				shasum384Replacements.push({
					searchValue: initialShasum384,
					replaceValue: calculateShasum384(fullFilePath),
					filePath: fullFilePath
				});

				break;
			}
		}
	}

	const runtimeFileName = items.find((item) => item.match(/runtime.*\.js/));
	if (runtimeFileName) {
		const runtimeFilePath = outputDir + path.sep + runtimeFileName;
		replaceValuesInFile(runtimeFilePath, shasum384Replacements);

		const runtimeReplacement = shasum384Replacements.find((replacement) => replacement.filePath === runtimeFilePath);
		if (runtimeReplacement) {
			runtimeReplacement.replaceValue = calculateShasum384(runtimeFilePath);
		}
	}

	replaceValuesInFile(outputDir + path.sep + "index.html", shasum384Replacements);
} catch (err) {
	console.log("Error while reading directory => " + err);
}

function replaceValuesInFile(fileName, valueReplacements) {
	try {
		let result = fs.readFileSync(fileName, "utf8");

		let replacementsDone = false;

		for (const replacement of valueReplacements) {
			const searchValueRegex = new RegExp(escapeStringRegexp(replacement.searchValue), "g");
			if (searchValueRegex.test(result)) {
				result = result.replace(searchValueRegex, replacement.replaceValue);
				replacementsDone = true;
			}
		}

		if (replacementsDone) {
			try {
				fs.writeFileSync(fileName, result, "utf8");
				return true;
			} catch (err) {
				return console.error(err);
			}
		} else {
			return console.log(`${fileName} remained unchanged`);
		}
	} catch (err) {
		console.log("Error while reading file => " + err);
	}
}

function calculateShasum384(filePath) {
	return `sha384-${crypto.createHash("sha384").update(fs.readFileSync(filePath)).digest("base64")}`;
}

function escapeStringRegexp(string) {
	if (typeof string !== "string") {
		throw new TypeError("Expected a string");
	}

	// Escape characters with special meaning either inside or outside character sets.
	// Use a simple backslash escape when it’s always valid, and a `\xnn` escape when the simpler form would be disallowed by Unicode patterns’ stricter grammar.
	return string.replace(/[|\\{}()[\]^$+*?.]/g, "\\$&").replace(/-/g, "\\x2d");
}
