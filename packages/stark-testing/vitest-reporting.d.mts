export type StarkVitestReporter = string | [name: string, options: Record<string, unknown>];

export interface StarkVitestReportingConfig {
	coverage: {
		reportsDirectory: string;
		reporter: StarkVitestReporter[];
	};
	reporters: StarkVitestReporter[];
}

/** Create deterministic, workspace-local coverage and JUnit paths for a test target. */
export declare function createVitestReportingConfig(packagePath: string): StarkVitestReportingConfig;
