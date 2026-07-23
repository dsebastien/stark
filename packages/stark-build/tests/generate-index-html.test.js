"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { generateIndexHtml } = require("../config/index-html.generator");

function writeJson(filePath, content) {
	fs.mkdirSync(path.dirname(filePath), { recursive: true });
	fs.writeFileSync(filePath, JSON.stringify(content, null, 2));
}

function writeFile(filePath, content) {
	fs.mkdirSync(path.dirname(filePath), { recursive: true });
	fs.writeFileSync(filePath, content);
}

test("generateIndexHtml replaces placeholders and injects head tags using the configured base href", (t) => {
	const workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), "stark-index-generator-"));
	t.after(() => fs.rmSync(workspaceRoot, { force: true, recursive: true }));

	writeJson(path.join(workspaceRoot, "angular.json"), {
		projects: {
			"demo-app": {
				architect: {
					build: {
						options: {
							baseHref: "/"
						},
						configurations: {
							production: {
								optimization: true
							},
							ghpages: {
								baseHref: "https://demo.invalid/release/"
							}
						}
					}
				}
			}
		}
	});
	writeJson(path.join(workspaceRoot, "src/stark-app-metadata.json"), {
		name: "Demo App",
		description: "Demo application description"
	});
	writeJson(path.join(workspaceRoot, "src/stark-app-config.json"), {
		defaultLanguage: "en",
		baseUrl: "/"
	});
	writeFile(
		path.join(workspaceRoot, "src/index.html"),
		[
			"<!doctype html>",
			'<html lang="<%= starkOptions.starkAppConfig.defaultLanguage %>">',
			"\t<head>",
			'\t\t<meta charset="utf-8" />',
			"\t\t<title><%= starkOptions.starkAppMetadata.name %></title>",
			'\t\t<meta name="description" content="<%= starkOptions.starkAppMetadata.description %>" />',
			"\t</head>",
			"\t<body></body>",
			"</html>"
		].join("\n")
	);
	writeFile(
		path.join(workspaceRoot, "config/index-head-config.js"),
		[
			'"use strict";',
			"",
			"module.exports = {",
			'\tlink: [{ rel: "manifest", href: "manifest.json" }],',
			"\tmeta: [",
			'\t\t{ name: "application-name", content: "<%= starkOptions.starkAppMetadata.name %>" },',
			'\t\t{ name: "msapplication-TileImage", content: "assets/images/ms-tile.png", "=content": true }',
			"\t]",
			"};"
		].join("\n")
	);

	const outputPath = path.join(workspaceRoot, ".stark/generated/index.html");
	generateIndexHtml({
		workspaceRoot,
		projectName: "demo-app",
		configuration: "production,ghpages",
		inputPath: "src/index.html",
		outputPath: ".stark/generated/index.html"
	});

	const output = fs.readFileSync(outputPath, "utf8");
	assert.match(output, /<html lang="en">/);
	assert.match(output, /<title>Demo App<\/title>/);
	assert.match(output, /content="Demo application description"/);
	assert.match(output, /href="https:\/\/demo\.invalid\/release\/manifest\.json"/);
	assert.match(output, /name="application-name" content="Demo App"/);
	assert.match(output, /content="https:\/\/demo\.invalid\/release\/assets\/images\/ms-tile\.png"/);
	assert.doesNotMatch(output, /<%=\s+starkOptions\./);
});

test("generateIndexHtml keeps the template valid when no head config is present", (t) => {
	const workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), "stark-index-generator-"));
	t.after(() => fs.rmSync(workspaceRoot, { force: true, recursive: true }));

	writeJson(path.join(workspaceRoot, "angular.json"), {
		projects: {
			"demo-app": {
				architect: {
					build: {
						options: {
							baseHref: "/"
						}
					}
				}
			}
		}
	});
	writeJson(path.join(workspaceRoot, "src/stark-app-metadata.json"), {
		name: "Minimal App",
		description: "Minimal app description"
	});
	writeJson(path.join(workspaceRoot, "src/stark-app-config.json"), {
		defaultLanguage: "fr",
		baseUrl: "/"
	});
	writeFile(
		path.join(workspaceRoot, "src/index.html"),
		[
			"<!doctype html>",
			'<html lang="<%= starkOptions.starkAppConfig.defaultLanguage %>">',
			"\t<head>",
			"\t\t<title><%= starkOptions.starkAppMetadata.name %></title>",
			"\t</head>",
			"\t<body></body>",
			"</html>"
		].join("\n")
	);

	const outputPath = path.join(workspaceRoot, ".stark/generated/index.html");
	generateIndexHtml({
		workspaceRoot,
		projectName: "demo-app",
		inputPath: "src/index.html",
		outputPath: ".stark/generated/index.html"
	});

	const output = fs.readFileSync(outputPath, "utf8");
	assert.match(output, /<html lang="fr">/);
	assert.match(output, /<title>Minimal App<\/title>/);
	assert.doesNotMatch(output, /manifest\.json/);
	assert.doesNotMatch(output, /<%=\s+starkOptions\./);
});
