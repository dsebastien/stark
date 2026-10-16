import { defineConfig } from "vitest/config";
import { createVitestReportingConfig } from "../stark-testing/vitest-reporting.mjs";

const reporting = createVitestReportingConfig("packages/stark-core");

export default defineConfig({
	test: {
		coverage: reporting.coverage,
		fileParallelism: false,
		hookTimeout: 10000,
		maxWorkers: 2,
		pool: "forks",
		reporters: reporting.reporters,
		testTimeout: 10000
	}
});
