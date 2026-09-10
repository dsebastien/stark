import { representativeRoutes, type ShowcaseNavigationTarget } from "./navigation";

type RepresentativeRouteId = (typeof representativeRoutes)[number]["id"];

export type ShellCapture = Readonly<{
	scope: "shell";
	selector: string;
	bounds: Readonly<{ x: number; y: number; width: number; height: number }>;
	overflowBottom?: number;
}>;

export type VisualCapture = Readonly<{ scope: "page" }> | Readonly<{ scope: "component"; selector: string }> | ShellCapture;

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
	// stark-4sp.3.7.1: the Angular 22 guide intentionally changes Node/npm,
	// dev-server, testing, polyfill, and troubleshooting copy (including its TOC).
	// Compare the unchanged shell and title separately, with the content-overlap
	// assertion on every shell capture. Do not rewrite or mask documentation text.
	comparison({
		capture: {
			scope: "shell",
			selector: "header.stark-app-header",
			bounds: { x: 0, y: 0, width: 1280, height: 128 },
			// Header actions and their shadows extend below the 128px header box.
			overflowBottom: 32
		},
		routeId: "getting-started",
		scenarioId: "shell-header",
		snapshotName: "getting-started-shell-header.png"
	}),
	comparison({
		capture: {
			scope: "shell",
			selector: "mat-sidenav.stark-app-sidenav-left",
			bounds: { x: 0, y: 128, width: 280, height: 592 }
		},
		routeId: "getting-started",
		scenarioId: "shell-navigation",
		snapshotName: "getting-started-shell-navigation.png"
	}),
	comparison({
		capture: {
			scope: "shell",
			selector: ".getting-started-content > div:first-child",
			bounds: { x: 315, y: 192, width: 730, height: 48 }
		},
		routeId: "getting-started",
		scenarioId: "shell-page-title",
		snapshotName: "getting-started-shell-page-title.png"
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
