import { expect, test } from "@playwright/test";
import { getVisualTarget, isBaselineUpdateRequested } from "../support/oracle";
import { pilotVisualComparisons } from "../support/visual-manifest";

test("separates unchanged shell regions from migrated guide copy and component captures", () => {
	expect(
		pilotVisualComparisons.map(({ capture, maskSelectors, route, scenarioId, snapshotName }) => ({
			capture,
			maskSelectors,
			routeId: route.id,
			scenarioId,
			snapshotName
		}))
	).toEqual([
		{
			capture: {
				scope: "shell",
				selector: "header.stark-app-header",
				bounds: { x: 0, y: 0, width: 1280, height: 128 },
				overflowBottom: 32
			},
			maskSelectors: [],
			routeId: "getting-started",
			scenarioId: "shell-header",
			snapshotName: "getting-started-shell-header.png"
		},
		{
			capture: {
				scope: "shell",
				selector: "mat-sidenav.stark-app-sidenav-left",
				bounds: { x: 0, y: 128, width: 280, height: 592 }
			},
			maskSelectors: [],
			routeId: "getting-started",
			scenarioId: "shell-navigation",
			snapshotName: "getting-started-shell-navigation.png"
		},
		{
			capture: {
				scope: "shell",
				selector: ".getting-started-content > div:first-child",
				bounds: { x: 315, y: 192, width: 730, height: 48 }
			},
			maskSelectors: [],
			routeId: "getting-started",
			scenarioId: "shell-page-title",
			snapshotName: "getting-started-shell-page-title.png"
		},
		{
			capture: { scope: "component", selector: "example-viewer#classic-full" },
			maskSelectors: [],
			routeId: "action-bar",
			scenarioId: "action-bar-classic-full",
			snapshotName: "action-bar-default.png"
		},
		{
			capture: { scope: "component", selector: "example-viewer#basic" },
			maskSelectors: [],
			routeId: "styleguide-button",
			scenarioId: "styleguide-button-basic",
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
