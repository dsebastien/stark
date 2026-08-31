import { representativeRoutes, type ShowcaseNavigationTarget } from "./navigation";

type RepresentativeRouteId = (typeof representativeRoutes)[number]["id"];

export type VisualCapture = Readonly<{ scope: "page" }> | Readonly<{ scope: "component"; selector: string }>;

export type VisualComparison = Readonly<{
	capture: VisualCapture;
	maskSelectors: readonly string[];
	route: ShowcaseNavigationTarget;
	scenarioId: string;
	snapshotName: `${string}.png`;
}>;

type VisualComparisonDefinition = Readonly<{
	capture: VisualCapture;
	routeId: RepresentativeRouteId;
	scenarioId: string;
	snapshotName: `${string}.png`;
}>;

function comparison(definition: VisualComparisonDefinition): VisualComparison {
	const { capture, routeId, scenarioId, snapshotName } = definition;
	const route = representativeRoutes.find((candidate) => candidate.id === routeId);
	if (!route) {
		throw new Error(`The visual comparison route ${routeId} is missing from the navigation manifest.`);
	}

	return {
		capture,
		maskSelectors: [],
		route,
		scenarioId,
		snapshotName
	};
}

/**
 * The first visual-parity slice. Any future mask must be reviewed here and
 * explain which non-deterministic pixels it excludes; tests cannot add masks.
 */
export const pilotVisualComparisons = [
	comparison({
		capture: { scope: "page" },
		routeId: "getting-started",
		scenarioId: "shell-layout",
		snapshotName: "getting-started-default.png"
	}),
	comparison({
		capture: { scope: "component", selector: "example-viewer#classic-full" },
		routeId: "action-bar",
		scenarioId: "action-bar-classic-full",
		snapshotName: "action-bar-default.png"
	}),
	comparison({
		capture: { scope: "component", selector: "example-viewer#basic" },
		routeId: "styleguide-button",
		scenarioId: "styleguide-button-basic",
		snapshotName: "styleguide-button-default.png"
	})
] as const;
