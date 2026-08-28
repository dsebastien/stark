import { representativeRoutes, type ShowcaseNavigationTarget } from "./navigation";

type RepresentativeRouteId = (typeof representativeRoutes)[number]["id"];

export type VisualComparison = Readonly<{
	maskSelectors: readonly string[];
	route: ShowcaseNavigationTarget;
	scenarioId: string;
	snapshotName: `${string}.png`;
}>;

function comparison(scenarioId: string, routeId: RepresentativeRouteId): VisualComparison {
	const route = representativeRoutes.find((candidate) => candidate.id === routeId);
	if (!route) {
		throw new Error(`The visual comparison route ${routeId} is missing from the navigation manifest.`);
	}

	return {
		maskSelectors: [],
		route,
		scenarioId,
		snapshotName: `${scenarioId}.png`
	};
}

/**
 * The first visual-parity slice. Any future mask must be reviewed here and
 * explain which non-deterministic pixels it excludes; tests cannot add masks.
 */
export const pilotVisualComparisons = [
	comparison("getting-started-default", "getting-started"),
	comparison("action-bar-default", "action-bar"),
	comparison("styleguide-button-default", "styleguide-button")
] as const;
