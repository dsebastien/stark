import { defineConfig } from "vitest/config";
import { createVitestReportingConfig } from "../stark-testing/vitest-reporting.mjs";

const reporting = createVitestReportingConfig("packages/stark-core");

export default defineConfig({
	test: {
		coverage: reporting.coverage,
		hookTimeout: 10000,
		// Cap worker startup on Windows to avoid coverage-time fork crashes.
		maxWorkers: 4,
		pool: "forks",
		reporters: reporting.reporters,
		testTimeout: 10000
	}
});
