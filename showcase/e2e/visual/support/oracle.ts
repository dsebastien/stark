import { isSnapshotUpdateOption } from "./snapshot-update.mjs";

export const legacyOracle = {
	baseHref: "/showcase/latest/",
	baseUrl: "https://stark.nbb.be/showcase/latest/",
	build: {
		assets: {
			scripts: [
				{
					path: "/showcase/latest/runtime.ecaf2996de93d69a.js",
					integrity: "sha384-/aXZJJb9mMGj2IsgNS2Ya1fyzVpRXLol9fwXj+IxBfmJ43MEbMIObAm5A0mKX18t"
				},
				{
					path: "/showcase/latest/polyfills.d3667f72fbe4f36c.js",
					integrity: "sha384-7h8aO46lDRdAuT0G6Kffr4O13GLBsHlDIFGAkb8ENShaWD+pCbCxX2RVyZVscwq9"
				},
				{
					path: "/showcase/latest/main.f43ee0204d8e200c.js",
					integrity: "sha384-hnpOjVv3uk2ZDzOsWjIKJrwir2AdyLOqjq2WBNzcWEniPdd7/xhynIhkZNhISWhu"
				}
			] as const,
			stylesheets: [
				{
					path: "/showcase/latest/styles.css",
					integrity: "sha384-5XA12eYVtfuciXZCOZc0EklUuBUaTskB0s6a8w3GH/XOYp/NDRtSG3lx77h4OiUC"
				}
			] as const
		},
		etag: 'W/"69fc7b30-16de"',
		lastModified: "Thu, 07 May 2026 11:44:48 GMT"
	}
} as const;

export type VisualTarget = "candidate" | "legacy";

export function getVisualTarget(environment: NodeJS.ProcessEnv = process.env): VisualTarget {
	return environment.STARK_VISUAL_TARGET === "legacy" ? "legacy" : "candidate";
}

export function isBaselineUpdateRequested(
	argumentsList: readonly string[] = process.argv,
	environment: NodeJS.ProcessEnv = process.env
): boolean {
	const hasUpdateFlag = argumentsList.some(isSnapshotUpdateOption);
	const isPrivileged = environment.STARK_VISUAL_BASELINE_UPDATE === "1";

	if (isPrivileged && getVisualTarget(environment) !== "legacy") {
		throw new Error("STARK_VISUAL_BASELINE_UPDATE=1 is only valid with STARK_VISUAL_TARGET=legacy.");
	}

	if (hasUpdateFlag && !isPrivileged) {
		throw new Error(
			"Snapshot updates are disabled by default. Use the reviewed test:visual:legacy:update command against the legacy oracle."
		);
	}

	return isPrivileged;
}
