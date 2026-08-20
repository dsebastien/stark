import { defineConfig, devices } from "@playwright/test";

const legacyBaseUrl = "https://stark.nbb.be/showcase/latest/";
const candidateBaseUrl = process.env.STARK_VISUAL_BASE_URL ?? "http://127.0.0.1:4200/";
const targetKind = process.env.STARK_VISUAL_TARGET === "legacy" ? "legacy" : "candidate";
const targetBaseUrl = targetKind === "legacy" ? legacyBaseUrl : candidateBaseUrl;
const shouldStartCandidateServer =
	targetKind === "candidate" &&
	process.env.STARK_VISUAL_BASE_URL === undefined &&
	process.env.STARK_VISUAL_NO_SERVER !== "1";

export default defineConfig({
	forbidOnly: Boolean(process.env.CI),
	expect: {
		toHaveScreenshot: {
			animations: "disabled",
			caret: "hide",
			scale: "css"
		}
	},
	fullyParallel: false,
	outputDir: "../../test-results/visual",
	reporter: [
		["list"],
		["html", { open: "never", outputFolder: "../../playwright-report/visual" }]
	],
	retries: process.env.CI ? 2 : 0,
	snapshotPathTemplate: "{testDir}/../snapshots/{projectName}/{arg}{ext}",
	testDir: "./specs",
	timeout: 60_000,
	use: {
		...devices["Desktop Chrome"],
		baseURL: targetBaseUrl,
		colorScheme: "light",
		locale: "en-US",
		screenshot: "only-on-failure",
		serviceWorkers: "block",
		timezoneId: "UTC",
		trace: "retain-on-failure",
		video: "retain-on-failure"
	},
	workers: 1,
	projects: [
		{
			name: "chromium",
			use: {
				browserName: "chromium"
			}
		}
	],
	...(shouldStartCandidateServer
		? {
			webServer: {
				command: "npm run server:dev -- --host 127.0.0.1 --port 4200",
				reuseExistingServer: !process.env.CI,
				stderr: "pipe",
				stdout: "pipe",
				timeout: 120_000,
				url: candidateBaseUrl
			}
		}
		: {})
});
