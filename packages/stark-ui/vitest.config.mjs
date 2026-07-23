import { defineConfig, mergeConfig } from "vitest/config";
import baseConfig from "./vitest.base.config.mjs";

export default mergeConfig(baseConfig, defineConfig({
	test: {
		fileParallelism: false
	}
}));
