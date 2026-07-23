import path from "node:path";

const workspaceRoot = process.cwd();

export function createVitestReportingConfig(packagePath) {
	if (typeof packagePath !== "string" || packagePath.trim() === "") {
		throw new TypeError("A non-empty relative package path is required for Vitest reporting.");
	}

	const coverageReportsDirectory = resolveReportPath("coverage", packagePath);
	const junitOutputFile = resolveReportPath("test-results", packagePath, "junit.xml");

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

function resolveReportPath(reportType, ...segments) {
	const reportRoot = path.join(workspaceRoot, "reports", reportType);
	const resolvedPath = path.resolve(reportRoot, ...segments);
	const relativePath = path.relative(reportRoot, resolvedPath);

	if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
		throw new Error(`Vitest report paths must stay inside the workspace reports directory: ${segments.join("/")}`);
	}

	return resolvedPath;
}
