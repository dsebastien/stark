import { readdirSync, readFileSync } from "node:fs";
import { relative, resolve, sep } from "node:path";
import { expect, test } from "@playwright/test";
import * as ts from "typescript";
import {
	visualStateAxes,
	visualSurfaceManifest,
	type SourceEvidence,
	type VisualSurface,
	type VisualSurfaceType
} from "../manifests/surfaces";
import {
	executableScenariosForRunner,
	executableVisualScenarios,
	reviewedCoverageBaseline,
	sourceBackedStates,
	stateAxisReviews,
	stateRequirements,
	validateVisualCoverage,
	type ExecutableVisualScenario,
	type StateAxisReview,
	type StateRequirement,
	type VisualScenarioRunnerId
} from "../manifests/scenarios";
import { visualRouteManifest } from "../manifests/routes";

type DiscoveredSurface = Pick<VisualSurface, "selector" | "sourcePath" | "symbol" | "type">;

function findTypeScriptFiles(directory: string): string[] {
	return readdirSync(directory, { withFileTypes: true })
		.flatMap((entry) => {
			const entryPath = resolve(directory, entry.name);
			if (entry.isDirectory()) {
				return findTypeScriptFiles(entryPath);
			}
			return entry.isFile() && entry.name.endsWith(".ts") && !entry.name.endsWith(".spec.ts") ? [entryPath] : [];
		})
		.sort();
}

function decoratorNamed(node: ts.ClassDeclaration, name: string): ts.Decorator | undefined {
	return ts
		.getDecorators(node)
		?.find(
			(decorator) =>
				ts.isCallExpression(decorator.expression) &&
				ts.isIdentifier(decorator.expression.expression) &&
				decorator.expression.expression.text === name
		);
}

function findVariableInitializer(sourceFile: ts.SourceFile, name: string): ts.Expression | undefined {
	for (const statement of sourceFile.statements) {
		if (!ts.isVariableStatement(statement)) {
			continue;
		}
		for (const declaration of statement.declarationList.declarations) {
			if (ts.isIdentifier(declaration.name) && declaration.name.text === name) {
				return declaration.initializer;
			}
		}
	}
	return undefined;
}

function readStaticString(expression: ts.Expression, sourceFile: ts.SourceFile): string {
	if (ts.isStringLiteralLike(expression)) {
		return expression.text;
	}
	if (ts.isIdentifier(expression)) {
		const initializer = findVariableInitializer(sourceFile, expression.text);
		if (initializer) {
			return readStaticString(initializer, sourceFile);
		}
	}
	throw new Error(`Expected a static string in ${sourceFile.fileName}: ${expression.getText(sourceFile)}`);
}

function readSelector(decorator: ts.Decorator, sourceFile: ts.SourceFile): string {
	if (!ts.isCallExpression(decorator.expression)) {
		throw new Error(`Expected a decorator call in ${sourceFile.fileName}`);
	}
	const metadata = decorator.expression.arguments[0];
	if (!metadata || !ts.isObjectLiteralExpression(metadata)) {
		throw new Error(`Expected decorator metadata in ${sourceFile.fileName}`);
	}
	const selector = metadata.properties.find(
		(property): property is ts.PropertyAssignment =>
			ts.isPropertyAssignment(property) && ts.isIdentifier(property.name) && property.name.text === "selector"
	);
	if (!selector) {
		throw new Error(`Expected a selector in ${sourceFile.fileName}`);
	}
	return readStaticString(selector.initializer, sourceFile);
}

function sourcePath(file: string): VisualSurface["sourcePath"] {
	const path = relative(resolve(".."), file).split(sep).join("/");
	if (!path.startsWith("packages/") || !path.endsWith(".ts")) {
		throw new Error(`Expected a package TypeScript source, received ${path}`);
	}
	return path as VisualSurface["sourcePath"];
}

function discoverSurfaces(directory: string, allowedTypes: readonly VisualSurfaceType[]): DiscoveredSurface[] {
	const surfaces: DiscoveredSurface[] = [];
	for (const file of findTypeScriptFiles(directory)) {
		const sourceFile = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
		for (const statement of sourceFile.statements) {
			if (
				!ts.isClassDeclaration(statement) ||
				!statement.name ||
				statement.modifiers?.some(({ kind }) => kind === ts.SyntaxKind.AbstractKeyword)
			) {
				continue;
			}

			const component = decoratorNamed(statement, "Component");
			const directive = decoratorNamed(statement, "Directive");
			const injectable = decoratorNamed(statement, "Injectable");
			const type: VisualSurfaceType | undefined = component
				? "component"
				: directive
					? "directive"
					: injectable && file.endsWith("service.ts")
						? "service"
						: undefined;
			if (!type || !allowedTypes.includes(type)) {
				continue;
			}

			const decorator = component ?? directive;
			surfaces.push({
				selector: decorator ? readSelector(decorator, sourceFile) : undefined,
				sourcePath: sourcePath(file),
				symbol: statement.name.text,
				type
			});
		}
	}
	return surfaces.sort((left, right) => left.sourcePath.localeCompare(right.sourcePath));
}

const discoveredSurfaces = [
	...discoverSurfaces(resolve("../packages/stark-ui/src/modules"), ["component", "directive", "service"]),
	...discoverSurfaces(resolve("../packages/stark-rbac/src/modules/authorization/services"), ["service"])
].sort((left, right) => left.sourcePath.localeCompare(right.sourcePath));

const evidenceCache = new Map<SourceEvidence["path"], string | undefined>();
const readEvidence = ({ path }: SourceEvidence): string | undefined => {
	if (!evidenceCache.has(path)) {
		try {
			evidenceCache.set(path, readFileSync(resolve("..", path), "utf8"));
		} catch {
			evidenceCache.set(path, undefined);
		}
	}
	return evidenceCache.get(path);
};

function validate(
	surfaces: readonly VisualSurface[] = visualSurfaceManifest,
	requirements: readonly StateRequirement[] = stateRequirements,
	reviews: readonly StateAxisReview[] = stateAxisReviews,
	executableScenarios: readonly ExecutableVisualScenario[] = executableVisualScenarios
): string[] {
	return validateVisualCoverage(surfaces, requirements, reviews, visualRouteManifest, readEvidence, executableScenarios);
}

test("accounts for exactly 36 components/pages, 10 directives, and 6 behavior services", () => {
	expect(visualSurfaceManifest).toHaveLength(52);
	expect(visualSurfaceManifest.filter(({ type }) => type === "component")).toHaveLength(36);
	expect(visualSurfaceManifest.filter(({ type }) => type === "directive")).toHaveLength(10);
	expect(visualSurfaceManifest.filter(({ type }) => type === "service")).toHaveLength(6);
});

test("matches the concrete decorated package sources", () => {
	const inventorySources = visualSurfaceManifest
		.map(({ selector, sourcePath: path, symbol, type }) => ({ selector, sourcePath: path, symbol, type }))
		.sort((left, right) => left.sourcePath.localeCompare(right.sourcePath));

	expect(inventorySources).toEqual(discoveredSurfaces);
});

test("reviews all nine axes for every surface and tracks only audited executable states", () => {
	expect(sourceBackedStates).toHaveLength(reviewedCoverageBaseline.stateRequirements);
	expect(reviewedCoverageBaseline.executableScenarios).toBe(10);
	for (const surface of visualSurfaceManifest) {
		const reviews = stateAxisReviews.filter(({ surfaceId }) => surfaceId === surface.id);
		expect(reviews.map(({ axis }) => axis).sort(), surface.id).toEqual([...visualStateAxes].sort());
	}
});

test("keeps source-backed states as owned requirements rather than pseudo-executable contracts", () => {
	expect(new Set(sourceBackedStates.map(({ id }) => id)).size).toBe(sourceBackedStates.length);
	for (const state of sourceBackedStates) {
		expect(state.ownerBead).toMatch(/^stark-4sp\.4\.(?:[2-9]|1[0-5])$/u);
		expect(state).not.toHaveProperty("routeId");
		expect(state).not.toHaveProperty("setup");
		expect(state).not.toHaveProperty("action");
		expect(state).not.toHaveProperty("assertion");
		expect(state).not.toHaveProperty("screenshot");
	}
});

test("pins the reviewed requirement counts and mounted/missing classification", () => {
	expect(stateRequirements).toHaveLength(reviewedCoverageBaseline.requirementGroups);
	expect(sourceBackedStates).toHaveLength(reviewedCoverageBaseline.stateRequirements);
	expect(
		visualSurfaceManifest
			.filter(({ showcase }) => showcase.kind === "mounted")
			.map(({ id }) => id)
			.sort()
	).toEqual(Object.keys(reviewedCoverageBaseline.mountedSurfaceRoutes).sort());
	for (const surface of visualSurfaceManifest) {
		if (surface.showcase.kind === "mounted") {
			expect(surface.showcase.routeId, surface.id).toBe(
				reviewedCoverageBaseline.mountedSurfaceRoutes[surface.id as keyof typeof reviewedCoverageBaseline.mountedSurfaceRoutes]
			);
		}
	}
	expect(
		Object.fromEntries(
			visualSurfaceManifest
				.filter(({ showcase }) => showcase.kind === "missing")
				.map(({ id, showcase }) => [id, showcase.kind === "missing" ? showcase.ownerBead : undefined])
		)
	).toEqual(reviewedCoverageBaseline.missingSurfaceOwners);
});

test("assigns requirements to their exact durable coverage bead scopes", () => {
	const ownerOf = (id: string): string | undefined => stateRequirements.find((requirement) => requirement.id === id)?.ownerBead;

	expect(ownerOf("app-logo-component.focus")).toBe("stark-4sp.4.2");
	expect(ownerOf("breadcrumb-component.content")).toBe("stark-4sp.4.2");
	expect(ownerOf("pagination-component.selection")).toBe("stark-4sp.4.2");
	expect(ownerOf("route-search-component.focus")).toBe("stark-4sp.4.3");
	expect(ownerOf("route-search-component.content")).toBe("stark-4sp.4.8");
	expect(ownerOf("table-component.availability")).toBe("stark-4sp.4.10");
	expect(ownerOf("table-component.disclosure")).toBe("stark-4sp.4.10");
	expect(ownerOf("table-component.overlay")).toBe("stark-4sp.4.10");
	expect(ownerOf("table-multisort-dialog-component.selection")).toBe("stark-4sp.4.10");
	expect(ownerOf("table-expand-detail-directive.disclosure")).toBe("stark-4sp.4.10");
});

test("grounds each table-column content state in its own semantic source evidence", () => {
	const content = stateRequirements.find(({ id }) => id === "table-column-component.content");
	expect(content?.states).toEqual([
		expect.objectContaining({
			id: "hidden",
			evidence: [expect.objectContaining({ needle: "if (!this.visible)" })]
		}),
		expect.objectContaining({
			id: "plain",
			evidence: [expect.objectContaining({ needle: "formattedValue = rawValue.toString();" })]
		}),
		expect.objectContaining({
			id: "formatted-footer",
			evidence: expect.arrayContaining([
				expect.objectContaining({ needle: "formattedValue = this.cellFormatter" }),
				expect.objectContaining({ needle: "footerValue!.toString() | translate" })
			])
		})
	]);
});

test("has a valid fail-closed manifest", () => {
	expect(validate()).toEqual([]);
});

test("runs every Action Bar disclosure requirement with enough scroll checkpoints to expose every action", () => {
	const actionBarScenarios = executableScenariosForRunner("action-bar-disclosure");
	const disclosure = stateRequirements.find(({ id }) => id === "action-bar-component.disclosure");
	expect(disclosure?.states.map(({ id }) => id)).toEqual(["collapsed", "expanded"]);
	expect(sourceBackedStates.filter(({ id }) => id.startsWith("action-bar-component.disclosure.")).map(({ id }) => id)).toEqual([
		"action-bar-component.disclosure.collapsed",
		"action-bar-component.disclosure.expanded"
	]);
	expect(actionBarScenarios).toHaveLength(5);
	expect(
		actionBarScenarios.map(
			({ capture, maskSelectors, maxDiffPixels, payload, routeId, runner, sourceStateId, snapshotName, threshold }) => ({
				capture,
				maskSelectors,
				maxDiffPixels,
				payload: {
					action: payload.action,
					expectedVisibleActionLabels: payload.expectedVisibleActionLabels,
					scroll: payload.scroll
				},
				routeId,
				runner,
				sourceStateId,
				snapshotName,
				threshold
			})
		)
	).toEqual([
		{
			capture: { scope: "component", selector: "example-viewer#classic-full" },
			maskSelectors: [],
			maxDiffPixels: 0,
			payload: { action: "initial", expectedVisibleActionLabels: [], scroll: { kind: "offset", top: 0 } },
			routeId: "action-bar",
			runner: "action-bar-disclosure",
			sourceStateId: "action-bar-component.disclosure.collapsed",
			snapshotName: "action-bar-disclosure-collapsed.png",
			threshold: 0
		},
		{
			capture: { scope: "component", selector: "example-viewer#classic-full" },
			maskSelectors: [],
			maxDiffPixels: 0,
			payload: { action: "toggle", expectedVisibleActionLabels: ["Approve"], scroll: { kind: "offset", top: 0 } },
			routeId: "action-bar",
			runner: "action-bar-disclosure",
			sourceStateId: "action-bar-component.disclosure.expanded",
			snapshotName: "action-bar-disclosure-expanded.png",
			threshold: 0
		},
		{
			capture: { scope: "component", selector: "example-viewer#classic-full" },
			maskSelectors: [],
			maxDiffPixels: 0,
			payload: { action: "toggle", expectedVisibleActionLabels: ["Save"], scroll: { kind: "offset", top: 40 } },
			routeId: "action-bar",
			runner: "action-bar-disclosure",
			sourceStateId: "action-bar-component.disclosure.expanded",
			snapshotName: "action-bar-disclosure-expanded-save.png",
			threshold: 0
		},
		{
			capture: { scope: "component", selector: "example-viewer#classic-full" },
			maskSelectors: [],
			maxDiffPixels: 0,
			payload: { action: "toggle", expectedVisibleActionLabels: ["Delete"], scroll: { kind: "offset", top: 80 } },
			routeId: "action-bar",
			runner: "action-bar-disclosure",
			sourceStateId: "action-bar-component.disclosure.expanded",
			snapshotName: "action-bar-disclosure-expanded-delete.png",
			threshold: 0
		},
		{
			capture: { scope: "component", selector: "example-viewer#classic-full" },
			maskSelectors: [],
			maxDiffPixels: 0,
			payload: { action: "toggle", expectedVisibleActionLabels: ["Close"], scroll: { kind: "end" } },
			routeId: "action-bar",
			runner: "action-bar-disclosure",
			sourceStateId: "action-bar-component.disclosure.expanded",
			snapshotName: "action-bar-disclosure-expanded-close.png",
			threshold: 0
		}
	]);
});

test("runs every Collapsible state that the pinned legacy fixture can honestly render", () => {
	const collapsibleScenarios = executableScenariosForRunner("collapsible-states");
	expect(
		collapsibleScenarios.map(({ capture, maskSelectors, maxDiffPixels, payload, sourceStateId, snapshotName, threshold }) => ({
			capture,
			maskSelectors,
			maxDiffPixels,
			payload: {
				action: payload.action,
				expectedContentVisible: payload.expectedContentVisible,
				expectedExpanded: payload.expectedExpanded,
				expectedKeyboardFocused: payload.expectedKeyboardFocused
			},
			sourceStateId,
			snapshotName,
			threshold
		}))
	).toEqual([
		{
			capture: { scope: "component", selector: "example-viewer#default" },
			maskSelectors: [],
			maxDiffPixels: 0,
			payload: {
				action: { kind: "initial" },
				expectedContentVisible: false,
				expectedExpanded: false,
				expectedKeyboardFocused: false
			},
			sourceStateId: "collapsible-component.disclosure.collapsed",
			snapshotName: "collapsible-disclosure-collapsed.png",
			threshold: 0
		},
		{
			capture: { scope: "component", selector: "example-viewer#default" },
			maskSelectors: [],
			maxDiffPixels: 0,
			payload: {
				action: { kind: "toggle-header" },
				expectedContentVisible: true,
				expectedExpanded: true,
				expectedKeyboardFocused: false
			},
			sourceStateId: "collapsible-component.disclosure.expanded",
			snapshotName: "collapsible-disclosure-expanded.png",
			threshold: 0
		},
		{
			capture: { scope: "component", selector: "example-viewer#custom" },
			maskSelectors: [],
			maxDiffPixels: 0,
			payload: {
				action: { kind: "initial" },
				expectedContentVisible: true,
				expectedExpanded: true,
				expectedKeyboardFocused: false
			},
			sourceStateId: "collapsible-component.content.populated",
			snapshotName: "collapsible-content-populated.png",
			threshold: 0
		},
		{
			capture: { scope: "component", selector: "example-viewer#default" },
			maskSelectors: [],
			maxDiffPixels: 0,
			payload: {
				action: { kind: "initial" },
				expectedContentVisible: false,
				expectedExpanded: false,
				expectedKeyboardFocused: false
			},
			sourceStateId: "collapsible-component.focus.rest",
			snapshotName: "collapsible-focus-rest.png",
			threshold: 0
		},
		{
			capture: { scope: "component", selector: "example-viewer#default" },
			maskSelectors: [],
			maxDiffPixels: 0,
			payload: {
				action: {
					kind: "keyboard-focus-header",
					nextFocusableSelector: "example-viewer#default button.collapsible-demo-button"
				},
				expectedContentVisible: false,
				expectedExpanded: false,
				expectedKeyboardFocused: true
			},
			sourceStateId: "collapsible-component.focus.keyboard",
			snapshotName: "collapsible-focus-keyboard.png",
			threshold: 0
		}
	]);
	expect(collapsibleScenarios.some(({ sourceStateId }) => sourceStateId === "collapsible-component.content.empty")).toBe(false);
});

test("fails closed when Collapsible coverage escapes its audited component selectors", () => {
	const weakened = executableVisualScenarios.map(
		(scenario): ExecutableVisualScenario =>
			scenario.id === "collapsible-disclosure-expanded"
				? { ...scenario, capture: { scope: "component", selector: "body" } }
				: scenario
	);

	expect(validate(undefined, undefined, undefined, weakened)).toContain(
		"collapsible-disclosure-expanded does not use audited Collapsible selectors"
	);
});

test("fails closed when the Collapsible runner loses exact ownership", () => {
	const unknownRunner = executableVisualScenarios.map(
		(scenario): ExecutableVisualScenario =>
			scenario.id === "collapsible-focus-keyboard" ? { ...scenario, runner: "unregistered" as VisualScenarioRunnerId } : scenario
	);

	const errors = validate(undefined, undefined, undefined, unknownRunner);
	expect(errors).toContain("collapsible-focus-keyboard declares unknown runner unregistered");
	expect(errors).toContain("collapsible-states runner owns 4 scenarios, expected 5");
});

test("fails closed when executable coverage weakens its component-only exact comparison", () => {
	const weakened = executableVisualScenarios.map(
		(scenario): ExecutableVisualScenario =>
			scenario.id === "action-bar-disclosure-expanded-approve"
				? {
						...scenario,
						capture: { scope: "component", selector: "body" },
						maxDiffPixels: 10 as unknown as 0
					}
				: scenario
	);

	const errors = validate(undefined, undefined, undefined, weakened);
	expect(errors).toContain("action-bar-disclosure-expanded-approve does not use audited Action Bar selectors");
	expect(errors).toContain("action-bar-disclosure-expanded-approve weakens exact unmasked visual comparison");
});

test("fails closed for an unknown runner and pins Action Bar runner ownership", () => {
	const unknownRunner = executableVisualScenarios.map(
		(scenario): ExecutableVisualScenario =>
			scenario.id === "action-bar-disclosure-expanded-close"
				? { ...scenario, runner: "unregistered" as VisualScenarioRunnerId }
				: scenario
	);

	const errors = validate(undefined, undefined, undefined, unknownRunner);
	expect(errors).toContain("action-bar-disclosure-expanded-close declares unknown runner unregistered");
	expect(errors).toContain("action-bar-disclosure runner owns 4 scenarios, expected 5");
});

test("fails when Action Bar integration is remapped to a convenient route", () => {
	const actionBar = visualSurfaceManifest.find(({ id }) => id === "action-bar-component");
	if (!actionBar || actionBar.showcase.kind !== "mounted") {
		throw new Error("Expected the Action Bar Showcase fixture to be mounted.");
	}
	const remappedActionBar: VisualSurface = {
		...actionBar,
		showcase: {
			...actionBar.showcase,
			routeId: "collapsible",
			routeEvidence: {
				path: "showcase/src/app/demo-ui/routes.ts",
				needle: 'name: "demo-ui.collapsible"'
			}
		}
	};
	const surfaces = visualSurfaceManifest.map((surface) => (surface.id === actionBar.id ? remappedActionBar : surface));

	const errors = validate(surfaces);
	expect(errors).toContain("action-bar-component Showcase route differs from the reviewed source-backed route action-bar");
});

test("fails when a reviewed requirement group such as date-picker validity is deleted", () => {
	const withoutDatePickerValidity = stateRequirements.filter(({ id }) => id !== "date-picker-component.validity");
	const errors = validate(undefined, withoutDatePickerValidity);
	expect(errors.some((error) => error.includes("reviewed baseline requires 176 requirement groups"))).toBe(true);
});

test("fails when one requirement is substituted at the same group and state counts", () => {
	const requirements = stateRequirements.map(
		(requirement): StateRequirement =>
			requirement.id === "date-picker-component.validity"
				? {
						...requirement,
						id: "date-picker-component.selection",
						axis: "selection",
						description: "Invented equal-count replacement"
					}
				: requirement
	);
	const errors = validate(undefined, requirements);
	expect(errors.some((error) => error.includes("requirements differ from the reviewed source-backed baseline"))).toBe(true);
});

test("fails when semantic evidence is replaced by an unrelated existing declaration", () => {
	const requirements = stateRequirements.map(
		(requirement): StateRequirement =>
			requirement.id === "date-picker-component.validity"
				? {
						...requirement,
						evidence: [
							{
								path: "packages/stark-ui/src/modules/date-picker/components/date-picker.component.ts",
								needle: "export class StarkDatePickerComponent"
							}
						]
					}
				: requirement
	);
	const errors = validate(undefined, requirements);
	expect(errors.some((error) => error.includes("requirements differ from the reviewed source-backed baseline"))).toBe(true);
});

test("fails when a reviewed mounted surface is reclassified as missing", () => {
	const actionBar = visualSurfaceManifest.find(({ id }) => id === "action-bar-component");
	if (!actionBar) {
		throw new Error("Expected Action Bar in the surface inventory.");
	}
	const reclassified: VisualSurface = {
		...actionBar,
		showcase: {
			kind: "missing",
			ownerBead: "stark-4sp.4.2",
			rationale: "Invalid regression fixture."
		}
	};
	const surfaces = visualSurfaceManifest.map((surface) => (surface.id === actionBar.id ? reclassified : surface));
	const errors = validate(surfaces);
	expect(errors).toContain("mounted/missing Showcase classification differs from the reviewed baseline");
});

test("fails when a requirement is assigned to the wrong implementation bead", () => {
	const datePickerValidity = stateRequirements.find(({ id }) => id === "date-picker-component.validity");
	if (!datePickerValidity) {
		throw new Error("Expected the date-picker validity requirement.");
	}
	const requirements = stateRequirements.map(
		(requirement): StateRequirement =>
			requirement.id === datePickerValidity.id ? { ...requirement, ownerBead: "stark-4sp.4.6" } : requirement
	);
	const errors = validate(undefined, requirements);
	expect(errors).toContain("date-picker-component.validity expected owner stark-4sp.4.4, received stark-4sp.4.6");
});

test("fails on empty or invented evidence", () => {
	const requirement = stateRequirements[0];
	const empty: StateRequirement = { ...requirement, evidence: [{ ...requirement.evidence[0], needle: "" }] };
	const invented: StateRequirement = {
		...requirement,
		evidence: [{ ...requirement.evidence[0], needle: "definitelyInventedSourceEvidence" }]
	};

	expect(validate(undefined, [empty, ...stateRequirements.slice(1)]).some((error) => error.includes("empty evidence"))).toBe(true);
	expect(validate(undefined, [invented, ...stateRequirements.slice(1)]).some((error) => error.includes("not found in source"))).toBe(
		true
	);
});

test("fails when a source-backed relevant axis is reviewed out", () => {
	const reviews = stateAxisReviews.map(
		(review): StateAxisReview =>
			review.surfaceId === "action-bar-component" && review.axis === "disclosure"
				? {
						surfaceId: review.surfaceId,
						axis: review.axis,
						status: "reviewed-out",
						rationale: "Incorrectly suppressed despite source-backed disclosure states.",
						evidence: review.evidence
					}
				: review
	);
	const errors = validate(undefined, undefined, reviews);
	expect(errors.some((error) => error.includes("source-backed axis action-bar-component.disclosure is reviewed out"))).toBe(true);
});

test("records absent Showcase fixtures instead of assigning a convenient route", () => {
	const svgViewBox = visualSurfaceManifest.find(({ id }) => id === "svg-view-box-directive");
	expect(svgViewBox?.showcase).toEqual(expect.objectContaining({ kind: "missing", ownerBead: "stark-4sp.4.6" }));
	expect(sourceBackedStates.filter(({ surfaceId }) => surfaceId === "svg-view-box-directive")).toEqual(
		expect.arrayContaining([expect.objectContaining({ ownerBead: "stark-4sp.4.6" })])
	);
	for (const surfaceId of [
		"session-card-component",
		"session-timeout-warning-dialog-component",
		"login-page-component",
		"preloading-page-component",
		"session-expired-page-component",
		"session-logout-page-component"
	]) {
		const surface = visualSurfaceManifest.find(({ id }) => id === surfaceId);
		expect(surface?.showcase, surfaceId).toEqual(expect.objectContaining({ kind: "missing", ownerBead: "stark-4sp.4.11" }));
	}
});
