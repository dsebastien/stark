import { expect, test } from "@playwright/test";
import { getVisualTarget, isBaselineUpdateRequested } from "../support/oracle";
import { pilotVisualComparisons } from "../support/visual-manifest";

test("defines three unmasked pilot comparisons with stable snapshot names", () => {
	expect(
		pilotVisualComparisons.map(({ maskSelectors, route, scenarioId, snapshotName }) => ({
			maskSelectors,
			routeId: route.id,
			scenarioId,
			snapshotName
		}))
	).toEqual([
		{
			maskSelectors: [],
			routeId: "getting-started",
			scenarioId: "getting-started-default",
			snapshotName: "getting-started-default.png"
		},
		{
			maskSelectors: [],
			routeId: "action-bar",
			scenarioId: "action-bar-default",
			snapshotName: "action-bar-default.png"
		},
		{
			maskSelectors: [],
			routeId: "styleguide-button",
			scenarioId: "styleguide-button-default",
			snapshotName: "styleguide-button-default.png"
		}
	]);
});

test("defaults every unprivileged run to a read-only candidate comparison", () => {
	expect(getVisualTarget({})).toBe("candidate");
	expect(isBaselineUpdateRequested(["node", "playwright"], {})).toBe(false);
});

test("runs the candidate process without update privilege", () => {
	test.skip(getVisualTarget() !== "candidate", "the assertion applies only to the candidate command");
	expect(process.env.STARK_VISUAL_BASELINE_UPDATE).toBeUndefined();
	expect(isBaselineUpdateRequested()).toBe(false);
});

for (const updateArgument of ["-u", "-u=all", "--update-snapshots", "--update-snapshots=missing"]) {
	test(`rejects unprivileged snapshot update option ${updateArgument}`, () => {
		expect(() => isBaselineUpdateRequested(["node", "playwright", updateArgument], {})).toThrow(
			/Snapshot updates are disabled by default/
		);
	});
}

test("rejects baseline privilege unless the target is legacy", () => {
	expect(() =>
		isBaselineUpdateRequested(["node", "playwright"], {
			STARK_VISUAL_BASELINE_UPDATE: "1",
			STARK_VISUAL_TARGET: "candidate"
		})
	).toThrow(/only valid with STARK_VISUAL_TARGET=legacy/);
});
