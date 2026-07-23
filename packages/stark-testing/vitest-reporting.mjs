import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(fileURLToPath(new URL("../..", import.meta.url)));

export function createVitestReportingConfig(packagePath) {
	const coverageReportsDirectory = path.join(repoRoot, "reports", "coverage", packagePath);
	const junitOutputFile = path.join(repoRoot, "reports", "test-results", packagePath, "junit.xml");

	return {
		coverage: {
			reportsDirectory: coverageReportsDirectory,
			reporter: [
				["html", { subdir: "." }],
				["lcovonly", { file: "lcov.info" }],
				["text-summary"],
				["clover", { file: "clover.xml" }],
				["json", { file: "coverage-final.json" }]
			]
		},
		reporters: ["default", ["junit", { outputFile: junitOutputFile }]]
	};
}
