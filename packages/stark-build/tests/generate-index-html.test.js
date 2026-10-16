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

test("generateIndexHtml applies configured metadata and application config replacements", (t) => {
	const workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), "stark-index-generator-"));
	t.after(() => fs.rmSync(workspaceRoot, { force: true, recursive: true }));

	writeJson(path.join(workspaceRoot, "angular.json"), {
		projects: {
			"demo-app": {
				targets: {
					build: {
						options: { baseHref: "/" },
						configurations: {
							production: {
								baseHref: "/production/",
								fileReplacements: [
									{ replace: "src/stark-app-config.json", with: "src/stark-app-config.prod.json" },
									{ replace: "src/stark-app-metadata.json", with: "src/stark-app-metadata.prod.json" }
								]
							}
						}
					}
				}
			}
		}
	});
	writeJson(path.join(workspaceRoot, "src/stark-app-config.json"), { defaultLanguage: "en" });
	writeJson(path.join(workspaceRoot, "src/stark-app-config.prod.json"), { defaultLanguage: "nl" });
	writeJson(path.join(workspaceRoot, "src/stark-app-metadata.json"), { name: "Development" });
	writeJson(path.join(workspaceRoot, "src/stark-app-metadata.prod.json"), { name: "Production" });
	writeFile(
		path.join(workspaceRoot, "src/index.html"),
		'<html lang="<%= starkOptions.starkAppConfig.defaultLanguage %>"><head><title><%= starkOptions.starkAppMetadata.name %></title></head></html>'
	);

	const output = generateIndexHtml({
		workspaceRoot,
		projectName: "demo-app",
		configuration: "production",
		inputPath: "src/index.html",
		outputPath: ".stark/generated/index.html"
	});

	assert.match(output, /lang="nl"/);
	assert.match(output, /<title>Production<\/title>/);
});

test("generateIndexHtml escapes deployment metadata in template and generated head attributes", (t) => {
	const workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), "stark-index-generator-"));
	t.after(() => fs.rmSync(workspaceRoot, { force: true, recursive: true }));

	writeJson(path.join(workspaceRoot, "angular.json"), {
		projects: { demo: { architect: { build: { options: { baseHref: "/" } } } } }
	});
	writeJson(path.join(workspaceRoot, "src/stark-app-config.json"), { defaultLanguage: 'en" onload="alert(1)' });
	writeJson(path.join(workspaceRoot, "src/stark-app-metadata.json"), { name: '<script>alert("x")</script>' });
	writeFile(
		path.join(workspaceRoot, "src/index.html"),
		'<html lang="<%= starkOptions.starkAppConfig.defaultLanguage %>"><head><title><%= starkOptions.starkAppMetadata.name %></title></head></html>'
	);
	writeFile(
		path.join(workspaceRoot, "config/index-head-config.js"),
		'module.exports = { meta: [{ name: "application-name", content: "<%= starkOptions.starkAppMetadata.name %>" }] };'
	);

	const output = generateIndexHtml({
		workspaceRoot,
		projectName: "demo",
		inputPath: "src/index.html",
		outputPath: ".stark/generated/index.html"
	});

	assert.doesNotMatch(output, /<script>/);
	assert.doesNotMatch(output, /" onload="/);
	assert.match(output, /lang="en&quot; onload=&quot;alert\(1\)"/);
	assert.match(output, /&lt;script&gt;alert\(&quot;x&quot;\)&lt;\/script&gt;/);
});

test("generateIndexHtml reports unknown configurations and malformed data clearly", (t) => {
	const workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), "stark-index-generator-"));
	t.after(() => fs.rmSync(workspaceRoot, { force: true, recursive: true }));

	writeJson(path.join(workspaceRoot, "angular.json"), {
		projects: { demo: { architect: { build: { options: {} } } } }
	});
	writeFile(path.join(workspaceRoot, "src/stark-app-config.json"), "{");
	writeJson(path.join(workspaceRoot, "src/stark-app-metadata.json"), { name: "Demo" });
	writeFile(path.join(workspaceRoot, "src/index.html"), "<html><head></head></html>");

	assert.throws(
		() =>
			generateIndexHtml({
				workspaceRoot,
				projectName: "demo",
				configuration: "missing",
				inputPath: "src/index.html",
				outputPath: ".stark/generated/index.html"
			}),
		/Unknown Angular build configuration "missing"/
	);
	assert.throws(
		() =>
			generateIndexHtml({
				workspaceRoot,
				projectName: "demo",
				inputPath: "src/index.html",
				outputPath: ".stark/generated/index.html"
			}),
		/Unable to parse JSON file .*stark-app-config\.json/
	);
});

test("generateIndexHtml reports missing workspace and template files clearly", (t) => {
	const workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), "stark-index-generator-"));
	t.after(() => fs.rmSync(workspaceRoot, { force: true, recursive: true }));

	assert.throws(
		() =>
			generateIndexHtml({
				workspaceRoot,
				projectName: "demo",
				inputPath: "src/index.html",
				outputPath: ".stark/generated/index.html"
			}),
		/Unable to read JSON file .*angular\.json/
	);

	writeJson(path.join(workspaceRoot, "angular.json"), {
		projects: { demo: { architect: { build: { options: {} } } } }
	});
	writeJson(path.join(workspaceRoot, "src/stark-app-config.json"), { defaultLanguage: "en" });
	writeJson(path.join(workspaceRoot, "src/stark-app-metadata.json"), { name: "Demo" });

	assert.throws(
		() =>
			generateIndexHtml({
				workspaceRoot,
				projectName: "demo",
				inputPath: "src/index.html",
				outputPath: ".stark/generated/index.html"
			}),
		/Unable to read index template .*src[\\/]index\.html/
	);
});

test("generateIndexHtml refuses to read or write outside the workspace", (t) => {
	const workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), "stark-index-generator-"));
	t.after(() => fs.rmSync(workspaceRoot, { force: true, recursive: true }));

	assert.throws(
		() =>
			generateIndexHtml({
				workspaceRoot,
				projectName: "demo",
				inputPath: "../index.html",
				outputPath: ".stark/generated/index.html"
			}),
		/Index template must stay inside the Angular workspace/
	);
});
