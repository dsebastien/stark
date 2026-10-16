import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import { createVitestReportingConfig } from "../packages/stark-testing/vitest-reporting.mjs";

const reporting = createVitestReportingConfig("showcase");
const workspacePath = (relativePath) => fileURLToPath(new URL(relativePath, import.meta.url)).replaceAll("\\", "/");

export default defineConfig({
	resolve: {
		alias: [
			{
				find: /^@nationalbankbelgium\/stark-core\/testing$/,
				replacement: workspacePath("../packages/stark-core/testing/public_api.ts")
			},
			{
				find: /^@nationalbankbelgium\/stark-core$/,
				replacement: workspacePath("../packages/stark-core/public_api.ts")
			},
			{
				find: /^@nationalbankbelgium\/stark-rbac$/,
				replacement: workspacePath("../packages/stark-rbac/public_api.ts")
			},
			{
				find: /^@nationalbankbelgium\/stark-ui\/testing$/,
				replacement: workspacePath("../packages/stark-ui/testing/public_api.ts")
			},
			{
				find: /^@nationalbankbelgium\/stark-ui\/src\/(.*)$/,
				replacement: `${workspacePath("../packages/stark-ui/src/")}$1`
			},
			{
				find: /^@nationalbankbelgium\/stark-ui$/,
				replacement: workspacePath("../packages/stark-ui/public_api.ts")
			},
			{
				find: /^lodash-es\/(.*)$/,
				replacement: "lodash-es/$1.js"
			}
		]
	},
	test: {
		coverage: reporting.coverage,
		hookTimeout: 10000,
		// Keep the app suite on a single worker to avoid fork crashes under coverage on Windows.
		maxWorkers: 1,
		pool: "forks",
		reporters: reporting.reporters,
		server: {
			deps: {
				inline: [/^@nationalbankbelgium\/stark-(core|rbac|ui)(\/.*)?$/, /^lodash-es/]
			}
		},
		testTimeout: 10000
	}
});
