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
	missingVisualFixtureStates,
	reviewedCoverageBaseline,
	reviewedVisualDiffBudgets,
	sourceBackedStates,
	stateAxisReviews,
	stateRequirements,
	validateVisualCoverage,
	type ExecutableVisualScenario,
	type GenericSearchStateScenario,
	type MissingVisualFixtureState,
	type RouteSearchStateScenario,
	type StateAxisReview,
	type StateRequirement,
	type TableRegularStateScenario,
	type TablePageSizeStateScenario,
	type TableRowIndexStateScenario,
	type TableStylingStateScenario,
	type TableCustomCellStateScenario,
	type TableFooterStateScenario,
	type TableSelectionStateScenario,
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
	executableScenarios: readonly ExecutableVisualScenario[] = executableVisualScenarios,
	missingFixtures: readonly MissingVisualFixtureState[] = missingVisualFixtureStates
): string[] {
	return validateVisualCoverage(surfaces, requirements, reviews, visualRouteManifest, readEvidence, executableScenarios, missingFixtures);
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
	expect(reviewedCoverageBaseline.executableScenarios).toBe(376);
	expect(missingVisualFixtureStates).toHaveLength(reviewedCoverageBaseline.missingVisualFixtures);
	for (const surface of visualSurfaceManifest) {
		const reviews = stateAxisReviews.filter(({ surfaceId }) => surfaceId === surface.id);
		expect(reviews.map(({ axis }) => axis).sort(), surface.id).toEqual([...visualStateAxes].sort());
	}
});

test("gives every Dropdown, Slider, and input-directive state one explicit fixture disposition", () => {
	const ownedStateIds = sourceBackedStates
		.filter(({ ownerBead }) => ownerBead === "stark-4sp.4.5")
		.map(({ id }) => id)
		.sort();
	const executableStateIds = executableScenariosForRunner("input-family-states")
		.map(({ sourceStateId }) => sourceStateId)
		.sort();
	const missingStateIds = missingVisualFixtureStates
		.filter(({ ownerBead }) => ownerBead === "stark-4sp.4.5")
		.map(({ sourceStateId }) => sourceStateId)
		.sort();

	expect(ownedStateIds).toHaveLength(71);
	expect(executableStateIds).toHaveLength(66);
	expect(missingStateIds).toHaveLength(5);
	expect([...executableStateIds, ...missingStateIds].sort()).toEqual(ownedStateIds);
});

test("gives every navigation and application-control state one explicit fixture disposition", () => {
	const ownedStateIds = sourceBackedStates
		.filter(({ ownerBead }) => ownerBead === "stark-4sp.4.3")
		.map(({ id }) => id)
		.sort();
	const executableStateIds = executableScenariosForRunner("navigation-control-states")
		.map(({ sourceStateId }) => sourceStateId)
		.sort();
	const executableOwnedStateIds = executableStateIds.filter((sourceStateId) => ownedStateIds.includes(sourceStateId));
	const missingStateIds = missingVisualFixtureStates
		.filter(({ ownerBead }) => ownerBead === "stark-4sp.4.3")
		.map(({ sourceStateId }) => sourceStateId)
		.sort();

	expect(ownedStateIds).toHaveLength(38);
	expect(executableOwnedStateIds).toHaveLength(36);
	expect(missingStateIds).toEqual(["app-menu-component.content.empty", "app-menu-item-component.focus.keyboard"]);
	expect([...executableOwnedStateIds, ...missingStateIds].sort()).toEqual(ownedStateIds);
});

test("covers all nine Route Search states without claiming Generic Search, focus, or responsive ownership", () => {
	const ownedStates = sourceBackedStates.filter(
		({ surfaceId, ownerBead }) => surfaceId === "route-search-component" && ownerBead === "stark-4sp.4.8"
	);
	const scenarios = executableVisualScenarios.filter(
		({ surfaceId, ownerBead }) => surfaceId === "route-search-component" && ownerBead === "stark-4sp.4.8"
	);

	expect(ownedStates).toHaveLength(9);
	expect(scenarios).toHaveLength(16);
	expect([...new Set(scenarios.map(({ sourceStateId }) => sourceStateId))].sort()).toEqual(ownedStates.map(({ id }) => id).sort());
	expect(scenarios.every(({ runner }) => runner === "route-search-states")).toBe(true);
	expect(missingVisualFixtureStates.filter(({ sourceStateId }) => ownedStates.some(({ id }) => id === sourceStateId))).toEqual([]);
	expect(
		executableScenariosForRunner("navigation-control-states").filter(({ surfaceId }) => surfaceId === "route-search-component")
	).toHaveLength(2);
});

test("covers reachable Generic Search states and explicitly records the absent disabled fixture", () => {
	const ownedStates = sourceBackedStates.filter(
		({ surfaceId, ownerBead }) => surfaceId === "generic-search-component" && ownerBead === "stark-4sp.4.8"
	);
	const scenarios = executableScenariosForRunner("generic-search-states");
	const missing = missingVisualFixtureStates.filter(({ sourceStateId }) => sourceStateId.startsWith("generic-search-component."));
	expect(ownedStates).toHaveLength(6);
	expect(scenarios).toHaveLength(13);
	expect(
		[...new Set(scenarios.map(({ sourceStateId }) => sourceStateId)), ...missing.map(({ sourceStateId }) => sourceStateId)].sort()
	).toEqual(ownedStates.map(({ id }) => id).sort());
	expect(missing.map(({ sourceStateId }) => sourceStateId)).toEqual(["generic-search-component.availability.disabled"]);
	expect(
		sourceBackedStates
			.filter(({ surfaceId, axis }) => surfaceId === "generic-search-component" && axis === "responsive")
			.every(({ ownerBead }) => ownerBead === "stark-4sp.4.14")
	).toBe(true);
});

test("covers exactly the three core Table selection states without claiming other table axes", () => {
	const scenarios = executableScenariosForRunner("table-selection-states");
	const owned = sourceBackedStates.filter(({ surfaceId, axis }) => surfaceId === "table-component" && axis === "selection");
	expect(owned).toHaveLength(3);
	expect(scenarios).toHaveLength(9);
	expect([...new Set(scenarios.map(({ sourceStateId }) => sourceStateId))].sort()).toEqual(owned.map(({ id }) => id).sort());
	expect(
		scenarios.every(
			({ ownerBead, axis, surfaceId }) => ownerBead === "stark-4sp.4.9" && axis === "selection" && surfaceId === "table-component"
		)
	).toBe(true);
	expect(missingVisualFixtureStates.filter(({ sourceStateId }) => sourceStateId.startsWith("table-component.selection."))).toEqual([]);
});

test("maps regular Table journeys only to the populated content state", () => {
	const scenarios = executableScenariosForRunner("table-regular-states");
	expect(scenarios).toHaveLength(12);
	expect([...new Set(scenarios.map(({ sourceStateId }) => sourceStateId))]).toEqual(["table-component.content.populated"]);
	expect(scenarios.every(({ ownerBead }) => ownerBead === "stark-4sp.4.9")).toBe(true);
});

test("maps exactly eleven Table page-size journeys to populated content without changing regular coverage", () => {
	const scenarios = executableScenariosForRunner("table-page-size-states");
	expect(scenarios).toHaveLength(11);
	expect([...new Set(scenarios.map(({ sourceStateId }) => sourceStateId))]).toEqual(["table-component.content.populated"]);
	expect(scenarios.every(({ ownerBead }) => ownerBead === "stark-4sp.4.9")).toBe(true);
	expect(executableScenariosForRunner("table-regular-states")).toHaveLength(12);
});

test("maps fourteen row-index configuration journeys only to populated Table content", () => {
	const scenarios = executableScenariosForRunner("table-row-index-states");
	expect(scenarios).toHaveLength(14);
	expect([...new Set(scenarios.map(({ sourceStateId }) => sourceStateId))]).toEqual(["table-component.content.populated"]);
	expect(scenarios.every(({ ownerBead }) => ownerBead === "stark-4sp.4.9")).toBe(true);
	expect(executableScenariosForRunner("table-regular-states")).toHaveLength(12);
	expect(executableScenariosForRunner("table-page-size-states")).toHaveLength(11);
});

test("maps thirteen custom-styling journeys only to populated Table content", () => {
	const scenarios = executableScenariosForRunner("table-styling-states");
	expect(scenarios).toHaveLength(13);
	expect([...new Set(scenarios.map(({ sourceStateId }) => sourceStateId))]).toEqual(["table-component.content.populated"]);
	expect(scenarios.every(({ ownerBead }) => ownerBead === "stark-4sp.4.9")).toBe(true);
});

test("maps thirteen custom-cell journeys only to populated Table content", () => {
	const scenarios = executableScenariosForRunner("table-custom-cell-states");
	expect(scenarios).toHaveLength(13);
	expect([...new Set(scenarios.map(({ sourceStateId }) => sourceStateId))]).toEqual(["table-component.content.populated"]);
	expect(scenarios.every(({ ownerBead }) => ownerBead === "stark-4sp.4.9")).toBe(true);
});

test("maps thirteen footer journeys to the dedicated Table footer state", () => {
	const scenarios = executableScenariosForRunner("table-footer-states");
	expect(scenarios).toHaveLength(13);
	expect([...new Set(scenarios.map(({ sourceStateId }) => sourceStateId))]).toEqual(["table-component.content.footer"]);
	expect(scenarios.every(({ ownerBead }) => ownerBead === "stark-4sp.4.9")).toBe(true);
});

test("pins Table footer totals, semantic column order, styles and complete captures", () => {
	const scenarios = executableScenariosForRunner("table-footer-states");
	const last = (id: string) => scenarios.find((scenario) => scenario.id === id)!.payload.checkpoints.at(-1)!;
	expect(
		scenarios.every(
			({ capture, maskSelectors, threshold, maxDiffPixels }) =>
				capture.scope === "component" &&
				capture.selector === "example-viewer#footer stark-table" &&
				maskSelectors.length === 0 &&
				threshold === 0 &&
				maxDiffPixels === 0
		)
	).toBe(true);
	expect(scenarios[0].payload.footer).toEqual({
		columns: ["id", "cost", "description"],
		cells: ["Total", "233", ""],
		styles: {
			fontSize: "14px",
			fontWeight: "700",
			lineHeight: "26px",
			color: "rgba(0, 0, 0, 0.87)",
			rowHeight: 48,
			padding: ["0px 0px 0px 24px", "0px", "0px 24px 0px 0px"]
		}
	});
	expect(last("table-footer-next").expectedRows).toEqual([
		[86, 21, "eleventh description"],
		[44, 6, "the twelfth description"]
	]);
	expect(last("table-footer-asc-next").expectedRows).toEqual([
		[154, 35, "the ninth description"],
		[23, 54, "fifth description"]
	]);
	expect(last("table-footer-desc-next").expectedRows).toEqual([
		[12, 5, "the third description"],
		[222, 3, "the sixth description"]
	]);
	expect(last("table-footer-desc-next").action).toBe("sort-cost");
	expect(last("table-footer-desc-next").expectedPage).toBe(2);
	expect(last("table-footer-desc-next").expectedSort).toBe("desc");
	expect(last("table-footer-cleared").expectedRows).toEqual(last("table-footer-initial").expectedRows);
	expect(last("table-footer-cleared").expectedSort).toBe("none");
	expect(last("table-footer-keyboard-last").action).toBe("keyboard-page");
	expect(last("table-footer-keyboard-first").action).toBe("keyboard-page");
	expect(
		scenarios.filter(({ payload }) => payload.viewport.width !== 1280).map(({ payload }) => [payload.viewport, payload.journey])
	).toEqual([
		[{ width: 768, height: 900 }, "next"],
		[{ width: 390, height: 1200 }, "initial"],
		[{ width: 390, height: 1200 }, "next"]
	]);
});

function validateFooterChange(id: string, change: (scenario: TableFooterStateScenario) => ExecutableVisualScenario): string[] {
	return validate(
		visualSurfaceManifest,
		stateRequirements,
		stateAxisReviews,
		executableVisualScenarios.map((scenario) =>
			scenario.runner === "table-footer-states" && scenario.id === id ? change(scenario) : scenario
		)
	);
}

test("rejects assigning footer coverage to another Table runner", () => {
	const id = "table-footer-initial";
	expect(
		validateFooterChange(id, (scenario) => ({ ...scenario, runner: "table-custom-cell-states" }) as unknown as ExecutableVisualScenario)
	).toContain(`${id} must use the Table footer state runner`);
});

for (const [id, replacementId] of [
	["table-footer-cleared", "table-footer-initial"],
	["table-footer-first", "table-footer-next"],
	["table-footer-keyboard-first", "table-footer-first"]
]) {
	test(`rejects supported footer journey substitution for ${id}`, () => {
		const replacement = executableScenariosForRunner("table-footer-states").find((scenario) => scenario.id === replacementId)!;
		expect(
			validateFooterChange(id, (scenario) => ({
				...scenario,
				payload: { ...scenario.payload, journey: replacement.payload.journey, checkpoints: replacement.payload.checkpoints }
			}))
		).toContain(`${id} does not use the audited Table footer fixture and interaction flow`);
	});
}

const invalidFooterChanges: readonly {
	name: string;
	id: string;
	change: (scenario: TableFooterStateScenario) => ExecutableVisualScenario;
}[] = [
	{
		name: "a page-only total",
		id: "table-footer-next",
		change: (scenario) => ({
			...scenario,
			payload: { ...scenario.payload, footer: { ...scenario.payload.footer, cells: ["Total", "27", ""] } }
		})
	},
	{
		name: "content in the blank description footer cell",
		id: "table-footer-initial",
		change: (scenario) => ({
			...scenario,
			payload: { ...scenario.payload, footer: { ...scenario.payload.footer, cells: ["Total", "233", "0"] } }
		})
	},
	{
		name: "footer columns out of order",
		id: "table-footer-initial",
		change: (scenario) =>
			({
				...scenario,
				payload: { ...scenario.payload, footer: { ...scenario.payload.footer, columns: ["cost", "id", "description"] } }
			}) as unknown as ExecutableVisualScenario
	},
	{
		name: "weakened footer typography",
		id: "table-footer-initial",
		change: (scenario) => ({
			...scenario,
			payload: {
				...scenario.payload,
				footer: { ...scenario.payload.footer, styles: { ...scenario.payload.footer.styles, fontWeight: "400" } }
			}
		})
	},
	{
		name: "a sort that resets the current page",
		id: "table-footer-desc-next",
		change: (scenario) => ({
			...scenario,
			payload: {
				...scenario.payload,
				checkpoints: scenario.payload.checkpoints.map((checkpoint) => ({ ...checkpoint, expectedPage: 1 as const }))
			}
		})
	},
	{
		name: "incorrect row tuples",
		id: "table-footer-next",
		change: (scenario) => ({
			...scenario,
			payload: {
				...scenario.payload,
				checkpoints: scenario.payload.checkpoints.map((checkpoint) => ({
					...checkpoint,
					expectedRows: checkpoint.expectedRows.map((row): typeof row => [row[0], row[1] + 1, row[2]])
				}))
			}
		})
	},
	{
		name: "an unaudited short mobile viewport",
		id: "table-footer-mobile-initial",
		change: (scenario) => ({ ...scenario, payload: { ...scenario.payload, viewport: { width: 390, height: 900 } } })
	},
	{
		name: "a crop excluding the footer",
		id: "table-footer-initial",
		change: (scenario) => ({ ...scenario, capture: { scope: "component", selector: "example-viewer#footer tbody" } })
	},
	{
		name: "a populated-state mapping",
		id: "table-footer-initial",
		change: (scenario) =>
			({ ...scenario, sourceStateId: "table-component.content.populated", state: "populated" }) as unknown as ExecutableVisualScenario
	},
	{
		name: "weakened screenshot comparison",
		id: "table-footer-initial",
		change: (scenario) => ({ ...scenario, threshold: 0.1 }) as unknown as ExecutableVisualScenario
	}
];
for (const { name, id, change } of invalidFooterChanges) {
	test(`rejects Table footer coverage with ${name}`, () => {
		expect(validateFooterChange(id, change)).toContain(`${id} does not use the audited Table footer fixture and interaction flow`);
	});
}

test("requires a Table footer disposition without claiming empty or custom-cell states", () => {
	const scenarios = executableVisualScenarios.filter(({ sourceStateId }) => sourceStateId !== "table-component.content.footer");
	const errors = validate(visualSurfaceManifest, stateRequirements, stateAxisReviews, scenarios);
	expect(errors).toContain("table-component.content.footer must have exactly one executable or missing-fixture disposition");
	expect(errors.some((error) => /table-component\.content\.(empty|custom-cells).*disposition/u.test(error))).toBe(false);
	expect(errors).not.toContain("table-component.content.populated must have exactly one executable or missing-fixture disposition");
});

test("pins custom-cell tuples, projection branches, styles, and complete captures", () => {
	const scenarios = executableScenariosForRunner("table-custom-cell-states");
	const last = (id: string) => scenarios.find((scenario) => scenario.id === id)!.payload.checkpoints.at(-1)!;
	expect(
		scenarios.every(
			({ capture, maskSelectors, threshold, maxDiffPixels }) =>
				capture.scope === "component" &&
				capture.selector ===
					"example-viewer:has(showcase-table-with-custom-cell-rendering) showcase-table-with-custom-cell-rendering stark-table" &&
				maskSelectors.length === 0 &&
				threshold === 0 &&
				maxDiffPixels === 0
		)
	).toBe(true);
	expect(last("table-custom-cell-initial").expectedRows.slice(0, 3)).toEqual([
		{ tuple: [1, 12, "number one"], branches: ["blue-span", "blue-span", "blue-span"], costClass: null },
		{ tuple: [2, 23, "second description"], branches: ["red-span", "red-span", "red-span"], costClass: null },
		{ tuple: [3, 5, "the third description"], branches: ["italic", "italic", "italic"], costClass: "danger" }
	]);
	expect(last("table-custom-cell-id-desc").expectedRows).toEqual([
		{ tuple: [12, 6, "the twelfth description"], branches: ["plain", "plain", "plain"], costClass: null },
		{ tuple: [11, 21, "eleventh description"], branches: ["plain", "plain", "plain"], costClass: "warning" },
		{ tuple: [10, 10, "description number ten"], branches: ["plain", "plain", "plain"], costClass: null },
		{ tuple: [9, 24, "description number eight"], branches: ["plain", "thumb-up", "plain"], costClass: null },
		{ tuple: [9, 35, "the ninth description"], branches: ["plain", "thumb-up", "plain"], costClass: null }
	]);
	expect(last("table-custom-cell-asc-last").expectedRows.map(({ tuple }) => tuple)).toEqual([
		[9, 35, "the ninth description"],
		[5, 54, "fifth description"]
	]);
	expect(last("table-custom-cell-keyboard-desc-last").expectedRows.map(({ tuple }) => tuple)).toEqual([
		[3, 5, "the third description"],
		[6, 3, "the sixth description"]
	]);
	expect(last("table-custom-cell-cleared-last").expectedRows.map(({ tuple }) => tuple)).toEqual([
		[11, 21, "eleventh description"],
		[12, 6, "the twelfth description"]
	]);
	expect(last("table-custom-cell-cleared-last").expectedPage).toBe(3);
	expect(last("table-custom-cell-restored").expectedPage).toBe(1);
	expect(scenarios[0].payload.styles).toEqual({
		fontSize: "14px",
		lineHeight: "26px",
		bodyColor: "rgba(0, 0, 0, 0.87)",
		blue: "rgb(0, 0, 255)",
		red: "rgb(255, 0, 0)",
		danger: "rgb(124, 0, 44)",
		warning: "rgb(255, 152, 0)",
		iconSize: "24px"
	});
	expect(
		scenarios.filter(({ payload }) => payload.viewport.width !== 1280).map(({ payload }) => [payload.viewport, payload.journey])
	).toEqual([
		[{ width: 768, height: 900 }, "next"],
		[{ width: 390, height: 900 }, "asc-next"]
	]);
});

function validateCustomCellChange(id: string, change: (scenario: TableCustomCellStateScenario) => ExecutableVisualScenario): string[] {
	return validate(
		visualSurfaceManifest,
		stateRequirements,
		stateAxisReviews,
		executableVisualScenarios.map((scenario) =>
			scenario.runner === "table-custom-cell-states" && scenario.id === id ? change(scenario) : scenario
		)
	);
}

for (const [id, replacementId] of [
	["table-custom-cell-restored", "table-custom-cell-initial"],
	["table-custom-cell-cleared-last", "table-custom-cell-last"],
	["table-custom-cell-asc-next", "table-custom-cell-cost-asc"]
]) {
	test(`rejects supported custom-cell journey substitution for ${id}`, () => {
		const replacement = executableScenariosForRunner("table-custom-cell-states").find((scenario) => scenario.id === replacementId)!;
		expect(
			validateCustomCellChange(id, (scenario) => ({
				...scenario,
				payload: { ...scenario.payload, journey: replacement.payload.journey, checkpoints: replacement.payload.checkpoints }
			}))
		).toContain(`${id} does not use the audited custom Table cell fixture and interaction flow`);
	});
}

const invalidCustomCellChanges: readonly {
	name: string;
	id: string;
	change: (scenario: TableCustomCellStateScenario) => ExecutableVisualScenario;
}[] = [
	{
		name: "duplicate IDs collapsed to one tuple",
		id: "table-custom-cell-id-desc",
		change: (scenario) => ({
			...scenario,
			payload: {
				...scenario.payload,
				checkpoints: scenario.payload.checkpoints.map((checkpoint) => ({
					...checkpoint,
					expectedRows: checkpoint.expectedRows.map((row) =>
						row.tuple[1] === 35 ? { ...row, tuple: [9, 24, "description number eight"] as const } : row
					)
				}))
			}
		})
	},
	{
		name: "a thumb icon projected in the wrong column",
		id: "table-custom-cell-initial",
		change: (scenario) => ({
			...scenario,
			payload: {
				...scenario.payload,
				checkpoints: scenario.payload.checkpoints.map((checkpoint) => ({
					...checkpoint,
					expectedRows: checkpoint.expectedRows.map((row) =>
						row.tuple[0] === 4 ? { ...row, branches: ["thumb-up", "plain", "plain"] as const } : row
					)
				}))
			}
		})
	},
	{
		name: "an omitted thumb icon",
		id: "table-custom-cell-initial",
		change: (scenario) => ({
			...scenario,
			payload: {
				...scenario.payload,
				checkpoints: scenario.payload.checkpoints.map((checkpoint) => ({
					...checkpoint,
					expectedRows: checkpoint.expectedRows.map((row) =>
						row.tuple[0] === 4 ? { ...row, branches: ["plain", "plain", "plain"] as const } : row
					)
				}))
			}
		})
	},
	{
		name: "the wrong class on the italic cost cell",
		id: "table-custom-cell-initial",
		change: (scenario) => ({
			...scenario,
			payload: {
				...scenario.payload,
				checkpoints: scenario.payload.checkpoints.map((checkpoint) => ({
					...checkpoint,
					expectedRows: checkpoint.expectedRows.map((row) =>
						row.tuple[0] === 3 ? { ...row, costClass: "warning" as const } : row
					)
				}))
			}
		})
	},
	{
		name: "an incorrect projected color",
		id: "table-custom-cell-initial",
		change: (scenario) => ({
			...scenario,
			payload: { ...scenario.payload, styles: { ...scenario.payload.styles, blue: "rgb(255, 0, 0)" } }
		})
	},
	{
		name: "the duplicated collapse fixture ID",
		id: "table-custom-cell-initial",
		change: (scenario) =>
			({
				...scenario,
				payload: { ...scenario.payload, fixtureSelector: "example-viewer#collapse" }
			}) as unknown as ExecutableVisualScenario
	},
	{
		name: "a supported viewport under the wrong ID",
		id: "table-custom-cell-asc-next",
		change: (scenario) => ({ ...scenario, payload: { ...scenario.payload, viewport: { width: 390, height: 900 } } })
	},
	{
		name: "a crop excluding pagination",
		id: "table-custom-cell-initial",
		change: (scenario) => ({ ...scenario, capture: { scope: "component", selector: `${scenario.capture.selector} tbody` } })
	},
	{
		name: "weakened screenshot comparison",
		id: "table-custom-cell-initial",
		change: (scenario) => ({ ...scenario, maxDiffPixels: 1 })
	},
	{
		name: "a mask over projected icons",
		id: "table-custom-cell-initial",
		change: (scenario) => ({ ...scenario, maskSelectors: ["mat-icon"] }) as unknown as ExecutableVisualScenario
	}
];
for (const { name, id, change } of invalidCustomCellChanges) {
	test(`rejects custom-cell coverage with ${name}`, () => {
		expect(validateCustomCellChange(id, change)).toContain(
			`${id} does not use the audited custom Table cell fixture and interaction flow`
		);
	});
}

test("rejects assigning a custom-cell ID to another populated-table runner", () => {
	const id = "table-custom-cell-initial";
	expect(
		validateCustomCellChange(id, (scenario) => ({ ...scenario, runner: "table-regular-states" }) as unknown as ExecutableVisualScenario)
	).toContain(`${id} does not use the audited regular Table fixture and interaction flow`);
});

test("pins custom Table class/data associations, local striping, CSS values, and hover targets", () => {
	const scenarios = executableScenariosForRunner("table-styling-states");
	const last = (id: string) => scenarios.find((scenario) => scenario.id === id)!.payload.checkpoints.at(-1)!;
	expect(
		scenarios.every(
			({ capture, maskSelectors, threshold, maxDiffPixels }) =>
				capture.scope === "component" &&
				capture.selector === "example-viewer#custom-styling showcase-table-with-custom-styling stark-table" &&
				maskSelectors.length === 0 &&
				threshold === 0 &&
				maxDiffPixels === 0
		)
	).toBe(true);
	expect(last("table-styling-next").expectedRows.map(({ rowClass }) => rowClass)).toEqual(["even", "odd", "even", "odd", "even"]);
	expect(last("table-styling-id-desc").expectedRows.map(({ id, titleClass }) => [id, titleClass])).toEqual([
		["232", "warning"],
		["222", "warning"],
		["154", "success"],
		["112", "warning"],
		["86", "success"]
	]);
	expect(last("table-styling-keyboard-last").expectedRows.map(({ id }) => id)).toEqual(["2", "1"]);
	expect(last("table-styling-sort-cleared-last").expectedRows.map(({ id }) => id)).toEqual(["86", "44"]);
	expect(last("table-styling-sort-cleared-last").expectedPage).toBe(3);
	expect(last("table-styling-restored").expectedPage).toBe(1);
	expect(scenarios[0].payload.styles).toEqual({
		lineHeight: "26px",
		idFontSize: "20px",
		idFontWeight: "700",
		bodyFontSize: "14px",
		bodyFontWeight: "400",
		bodyColor: "rgba(0, 0, 0, 0.87)",
		headerFontSize: "12px",
		headerFontWeight: "500",
		headerColor: "rgba(0, 0, 0, 0.54)",
		backgrounds: { even: "rgb(209, 225, 255)", odd: "rgb(255, 255, 255)", hover: "rgb(245, 245, 245)" },
		titleColors: { danger: "rgb(124, 0, 44)", warning: "rgb(255, 152, 0)", success: "rgb(60, 159, 64)" }
	});
	expect(scenarios.filter(({ payload }) => payload.hoverRowIndex !== null).map(({ id, payload }) => [id, payload.hoverRowIndex])).toEqual(
		[
			["table-styling-hover-even", 0],
			["table-styling-hover-odd", 1]
		]
	);
	expect(
		scenarios.filter(({ payload }) => payload.viewport.width !== 1280).map(({ payload }) => [payload.viewport.width, payload.journey])
	).toEqual([
		[768, "last"],
		[390, "sorted-next"]
	]);
});

function validateStylingChange(id: string, change: (scenario: TableStylingStateScenario) => ExecutableVisualScenario): string[] {
	return validate(
		visualSurfaceManifest,
		stateRequirements,
		stateAxisReviews,
		executableVisualScenarios.map((scenario) =>
			scenario.runner === "table-styling-states" && scenario.id === id ? change(scenario) : scenario
		)
	);
}

for (const [id, replacementId] of [
	["table-styling-restored", "table-styling-initial"],
	["table-styling-sort-cleared-last", "table-styling-last"]
]) {
	test(`rejects supported styling journey substitution for ${id}`, () => {
		const replacement = executableScenariosForRunner("table-styling-states").find((scenario) => scenario.id === replacementId)!;
		expect(
			validateStylingChange(id, (scenario) => ({
				...scenario,
				payload: { ...scenario.payload, journey: replacement.payload.journey, checkpoints: replacement.payload.checkpoints }
			}))
		).toContain(`${id} does not use the audited custom Table styling fixture and interaction flow`);
	});
}

const invalidStylingChanges: readonly {
	name: string;
	id: string;
	change: (scenario: TableStylingStateScenario) => ExecutableVisualScenario;
}[] = [
	{
		name: "weakened large font weight",
		id: "table-styling-initial",
		change: (scenario) => ({
			...scenario,
			payload: { ...scenario.payload, styles: { ...scenario.payload.styles, idFontWeight: "500" } }
		})
	},
	{
		name: "an incorrect authored color",
		id: "table-styling-initial",
		change: (scenario) => ({
			...scenario,
			payload: {
				...scenario.payload,
				styles: { ...scenario.payload.styles, titleColors: { ...scenario.payload.styles.titleColors, warning: "rgb(124, 0, 44)" } }
			}
		})
	},
	{
		name: "position-based color classes after sorting",
		id: "table-styling-id-desc",
		change: (scenario) => ({
			...scenario,
			payload: {
				...scenario.payload,
				checkpoints: scenario.payload.checkpoints.map((checkpoint) => ({
					...checkpoint,
					expectedRows: checkpoint.expectedRows.map((row) => ({ ...row, titleClass: "danger" }))
				}))
			}
		})
	},
	{
		name: "global instead of page-local stripe parity",
		id: "table-styling-next",
		change: (scenario) => ({
			...scenario,
			payload: {
				...scenario.payload,
				checkpoints: scenario.payload.checkpoints.map((checkpoint) => ({
					...checkpoint,
					expectedRows: checkpoint.expectedRows.map((row, index) => (index === 0 ? { ...row, rowClass: "odd" } : row))
				}))
			}
		})
	},
	{
		name: "a missing required hover",
		id: "table-styling-hover-even",
		change: (scenario) => ({ ...scenario, payload: { ...scenario.payload, hoverRowIndex: null } })
	},
	{
		name: "a supported viewport under the wrong ID",
		id: "table-styling-sorted-next",
		change: (scenario) => ({ ...scenario, payload: { ...scenario.payload, viewport: { width: 390, height: 900 } } })
	},
	{
		name: "a capture excluding the styled header",
		id: "table-styling-initial",
		change: (scenario) => ({ ...scenario, capture: { scope: "component", selector: "example-viewer#custom-styling tbody" } })
	}
];
for (const { name, id, change } of invalidStylingChanges) {
	test(`rejects Table styling coverage with ${name}`, () => {
		expect(validateStylingChange(id, change)).toContain(
			`${id} does not use the audited custom Table styling fixture and interaction flow`
		);
	});
}

test("rejects assigning a custom-styling ID to another populated-table runner", () => {
	const id = "table-styling-initial";
	expect(
		validateStylingChange(id, (scenario) => ({ ...scenario, runner: "table-regular-states" }) as unknown as ExecutableVisualScenario)
	).toContain(`${id} does not use the audited regular Table fixture and interaction flow`);
});

test("pins row-index numbering, helper-column order, selection lifetime, and complete configuration captures", () => {
	const scenarios = executableScenariosForRunner("table-row-index-states");
	const last = (id: string) => scenarios.find((scenario) => scenario.id === id)!.payload.checkpoints.at(-1)!;
	expect(
		scenarios.every(
			({ capture, maskSelectors, maxDiffPixels, threshold, payload }) =>
				capture.scope === "component" &&
				capture.selector === "example-viewer#selection_and_rowindex showcase-table-with-selection-and-row-index" &&
				maskSelectors.length === 0 &&
				maxDiffPixels === 0 &&
				threshold === 0 &&
				payload.viewport.height === 900
		)
	).toBe(true);
	expect(last("table-row-index-next").expectedIndices).toEqual(["6", "7", "8", "9", "10"]);
	expect(last("table-row-index-last").expectedIndices).toEqual(["11", "12"]);
	const sorted = last("table-row-index-sorted-selected");
	expect(sorted.expectedIds).toEqual(["1", "2", "10", "12", "23"]);
	expect(sorted.expectedIndices[sorted.expectedIds.indexOf("10")]).toBe("3");
	expect(sorted.expectedSelectedIds).toEqual(["10"]);
	expect(last("table-row-index-sorted-next")).toMatchObject({
		expectedIndices: ["6", "7", "8", "9", "10"],
		expectedSelectedIds: [],
		expectedHeaderSelection: { checked: false, indeterminate: true }
	});
	expect(last("table-row-index-index-hidden")).toMatchObject({
		expectedIndexVisible: false,
		expectedIndices: [],
		expectedSelectedIds: ["10"],
		expectedColumns: ["select", "id", "title", "description"]
	});
	expect(last("table-row-index-index-restored").expectedColumns).toEqual(["select", "rowIndex", "id", "title", "description"]);
	expect(last("table-row-index-selection-disabled")).toMatchObject({
		expectedSelectionEnabled: false,
		expectedHeaderSelection: null,
		expectedColumns: ["rowIndex", "id", "title", "description"]
	});
	expect(last("table-row-index-both-disabled").expectedColumns).toEqual(["id", "title", "description"]);
	expect(last("table-row-index-selection-restored")).toMatchObject({
		expectedSelectionEnabled: true,
		expectedSelectedIds: [],
		expectedHeaderSelection: { checked: false, indeterminate: false },
		expectedColumns: ["select", "id", "title", "description"]
	});
	expect(last("table-row-index-keyboard-index")).toMatchObject({ action: "keyboard-index", expectedIndexVisible: false });
	expect(
		scenarios.filter(({ payload }) => payload.viewport.width !== 1280).map(({ payload }) => [payload.viewport.width, payload.journey])
	).toEqual([
		[768, "last"],
		[390, "initial"],
		[390, "selection-disabled"]
	]);
});

function validateRowIndexChange(id: string, change: (scenario: TableRowIndexStateScenario) => ExecutableVisualScenario): string[] {
	return validate(
		visualSurfaceManifest,
		stateRequirements,
		stateAxisReviews,
		executableVisualScenarios.map((scenario) =>
			scenario.runner === "table-row-index-states" && scenario.id === id ? change(scenario) : scenario
		)
	);
}

function changeLastRowIndexCheckpoint(
	scenario: TableRowIndexStateScenario,
	change: Partial<TableRowIndexStateScenario["payload"]["checkpoints"][number]>
): TableRowIndexStateScenario {
	const checkpoints = scenario.payload.checkpoints;
	return {
		...scenario,
		payload: { ...scenario.payload, checkpoints: [...checkpoints.slice(0, -1), { ...checkpoints.at(-1)!, ...change }] }
	};
}

for (const [id, replacementId] of [
	["table-row-index-index-hidden", "table-row-index-initial"],
	["table-row-index-selection-restored", "table-row-index-index-hidden"]
] as const) {
	test(`rejects supported journey substitution for ${id}`, () => {
		const replacement = executableScenariosForRunner("table-row-index-states").find((scenario) => scenario.id === replacementId)!;
		expect(
			validateRowIndexChange(id, (scenario) => ({
				...scenario,
				payload: { ...scenario.payload, journey: replacement.payload.journey, checkpoints: replacement.payload.checkpoints }
			}))
		).toContain(`${id} does not use the audited Table row-index fixture and interaction flow`);
	});
}

const invalidRowIndexChanges: readonly {
	name: string;
	id: string;
	change: (scenario: TableRowIndexStateScenario) => ExecutableVisualScenario;
}[] = [
	{
		name: "page-local row numbers",
		id: "table-row-index-next",
		change: (scenario) => changeLastRowIndexCheckpoint(scenario, { expectedIndices: ["1", "2", "3", "4", "5"] })
	},
	{
		name: "incorrect restored helper-column order",
		id: "table-row-index-index-restored",
		change: (scenario) =>
			changeLastRowIndexCheckpoint(scenario, { expectedColumns: ["rowIndex", "select", "id", "title", "description"] })
	},
	{
		name: "a resurrected selection model",
		id: "table-row-index-selection-restored",
		change: (scenario) =>
			changeLastRowIndexCheckpoint(scenario, {
				expectedSelectedIds: ["10"],
				expectedHeaderSelection: { checked: false, indeterminate: true }
			})
	},
	{
		name: "lost off-page selection state",
		id: "table-row-index-sorted-next",
		change: (scenario) => changeLastRowIndexCheckpoint(scenario, { expectedHeaderSelection: { checked: false, indeterminate: false } })
	},
	{
		name: "a supported viewport under the wrong ID",
		id: "table-row-index-initial",
		change: (scenario) => ({ ...scenario, payload: { ...scenario.payload, viewport: { width: 390, height: 900 } } })
	},
	{
		name: "a capture that omits configuration checkboxes",
		id: "table-row-index-initial",
		change: (scenario) => ({
			...scenario,
			capture: { scope: "component", selector: "example-viewer#selection_and_rowindex stark-table" }
		})
	}
];

for (const { name, id, change } of invalidRowIndexChanges) {
	test(`rejects row-index coverage with ${name}`, () => {
		expect(validateRowIndexChange(id, change)).toContain(`${id} does not use the audited Table row-index fixture and interaction flow`);
	});
}

test("rejects assigning a row-index ID to another populated-table runner", () => {
	const id = "table-row-index-initial";
	expect(
		validateRowIndexChange(id, (scenario) => ({ ...scenario, runner: "table-regular-states" }) as unknown as ExecutableVisualScenario)
	).toContain(`${id} does not use the audited regular Table fixture and interaction flow`);
});

test("pins Table size changes, same-size retention, ordering, and full closed-selector captures", () => {
	const scenarios = executableScenariosForRunner("table-page-size-states");
	const last = (id: string) => scenarios.find((scenario) => scenario.id === id)!.payload.checkpoints.at(-1)!;
	expect(
		scenarios.every(
			({ capture, maskSelectors, threshold, maxDiffPixels, payload }) =>
				capture.scope === "component" &&
				capture.selector === "example-viewer#items-per-page-selection stark-table" &&
				maskSelectors.length === 0 &&
				threshold === 0 &&
				maxDiffPixels === 0 &&
				payload.viewport.height === 1200 &&
				payload.totalItems === 12 &&
				payload.counterText === "12 item(s)" &&
				JSON.stringify(payload.options) === "[5,10,15]"
		)
	).toBe(true);
	expect(last("table-page-size-five-reset")).toMatchObject({
		expectedSize: 5,
		expectedPage: 1,
		expectedTotalPages: 3,
		expectedRowIds: ["1", "10", "12", "2", "23"]
	});
	expect(last("table-page-size-five-last")).toMatchObject({
		expectedSize: 5,
		expectedPage: 3,
		expectedTotalPages: 3,
		expectedRowIds: ["86", "44"]
	});
	expect(last("table-page-size-same-ten")).toMatchObject({
		expectedSize: 10,
		expectedPage: 2,
		expectedTotalPages: 2,
		expectedRowIds: ["86", "44"]
	});
	expect(last("table-page-size-fifteen-reset")).toMatchObject({ expectedSize: 15, expectedPage: 1, expectedTotalPages: 1 });
	expect(last("table-page-size-fifteen-reset").expectedRowIds).toEqual([
		"1",
		"10",
		"12",
		"2",
		"23",
		"222",
		"112",
		"232",
		"154",
		"27",
		"86",
		"44"
	]);
	expect(last("table-page-size-ten-restored")).toMatchObject({ expectedSize: 10, expectedPage: 1, expectedTotalPages: 2 });
	expect(last("table-page-size-sorted-five").expectedRowIds).toEqual(["232", "222", "154", "112", "86"]);
	expect(last("table-page-size-sorted-five").expectedSort.id).toEqual({ direction: "desc", priority: 1 });
	expect(last("table-page-size-keyboard-five").action).toEqual({ kind: "keyboard-five" });
	expect(last("table-page-size-keyboard-five").expectedSize).toBe(5);
	expect(
		scenarios.filter(({ payload }) => payload.viewport.width !== 1280).map(({ payload }) => [payload.viewport.width, payload.journey])
	).toEqual([
		[768, "fifteen-reset"],
		[390, "five-reset"],
		[390, "fifteen-reset"]
	]);
});

test("requires thirteen Table page-size snapshots with closed-selector captures only on mobile", () => {
	const scenarios = executableScenariosForRunner("table-page-size-states");
	const secondary = scenarios.flatMap(({ payload }) =>
		typeof payload.selectorSnapshotName === "string" ? [payload.selectorSnapshotName] : []
	);
	expect(secondary).toEqual(["table-page-size-mobile-five-selector.png", "table-page-size-mobile-fifteen-selector.png"]);
	expect(
		scenarios.filter(({ payload }) => payload.viewport.width !== 390).every(({ payload }) => payload.selectorSnapshotName === null)
	).toBe(true);
	const snapshots = [...scenarios.map(({ snapshotName }) => snapshotName), ...secondary];
	expect(snapshots).toHaveLength(13);
	expect(new Set(snapshots).size).toBe(13);
});

function validatePageSizeChange(id: string, change: (scenario: TablePageSizeStateScenario) => ExecutableVisualScenario): string[] {
	const scenarios = executableVisualScenarios.map((scenario) =>
		scenario.runner === "table-page-size-states" && scenario.id === id ? change(scenario) : scenario
	);
	return validate(visualSurfaceManifest, stateRequirements, stateAxisReviews, scenarios);
}

for (const id of ["table-page-size-same-ten", "table-page-size-fifteen-reset"]) {
	test(`rejects a supported initial journey replacing ${id}`, () => {
		const initial = executableScenariosForRunner("table-page-size-states").find(
			(scenario) => scenario.id === "table-page-size-initial"
		)!;
		expect(
			validatePageSizeChange(id, (scenario) => ({
				...scenario,
				payload: { ...scenario.payload, journey: initial.payload.journey, checkpoints: initial.payload.checkpoints }
			}))
		).toContain(`${id} does not use the audited Table page-size fixture and interaction flow`);
	});
}

const invalidPageSizeChanges: readonly {
	name: string;
	id: string;
	change: (scenario: TablePageSizeStateScenario) => ExecutableVisualScenario;
}[] = [
	{
		name: "a missing mobile selector snapshot",
		id: "table-page-size-mobile-five",
		change: (scenario) => ({ ...scenario, payload: { ...scenario.payload, selectorSnapshotName: null } })
	},
	{
		name: "an incorrectly named mobile selector snapshot",
		id: "table-page-size-mobile-fifteen",
		change: (scenario) => ({ ...scenario, payload: { ...scenario.payload, selectorSnapshotName: "unbound-selector.png" } })
	},
	{
		name: "an unaudited desktop selector snapshot",
		id: "table-page-size-initial",
		change: (scenario) => ({
			...scenario,
			payload: { ...scenario.payload, selectorSnapshotName: "table-page-size-initial-selector.png" }
		})
	},
	{
		name: "a supported viewport under the wrong ID",
		id: "table-page-size-fifteen-reset",
		change: (scenario) => ({ ...scenario, payload: { ...scenario.payload, viewport: { width: 390, height: 1200 } } })
	},
	{
		name: "incorrect available sizes",
		id: "table-page-size-initial",
		change: (scenario) => ({ ...scenario, payload: { ...scenario.payload, options: [5, 10, 20] } })
	},
	{
		name: "resetting the page on an unchanged size",
		id: "table-page-size-same-ten",
		change: (scenario) => ({
			...scenario,
			payload: {
				...scenario.payload,
				checkpoints: scenario.payload.checkpoints.map((checkpoint) => ({ ...checkpoint, expectedPage: 1 }))
			}
		})
	},
	{
		name: "losing sort order after resizing",
		id: "table-page-size-sorted-five",
		change: (scenario) => ({
			...scenario,
			payload: {
				...scenario.payload,
				checkpoints: scenario.payload.checkpoints.map((checkpoint) => ({
					...checkpoint,
					expectedRowIds: ["1", "10", "12", "2", "23"]
				}))
			}
		})
	},
	{
		name: "an incorrect page count for all twelve rows",
		id: "table-page-size-fifteen-reset",
		change: (scenario) => ({
			...scenario,
			payload: {
				...scenario.payload,
				checkpoints: scenario.payload.checkpoints.map((checkpoint) => ({ ...checkpoint, expectedTotalPages: 2 }))
			}
		})
	},
	{
		name: "a capture omitting the selector and counter",
		id: "table-page-size-initial",
		change: (scenario) => ({
			...scenario,
			capture: { scope: "component", selector: "example-viewer#items-per-page-selection .table-container" }
		})
	}
];

for (const { name, id, change } of invalidPageSizeChanges) {
	test(`rejects Table page-size coverage with ${name}`, () => {
		expect(validatePageSizeChange(id, change)).toContain(`${id} does not use the audited Table page-size fixture and interaction flow`);
	});
}

test("rejects moving a Table page-size ID into the other populated-content runner", () => {
	const id = "table-page-size-initial";
	expect(
		validatePageSizeChange(id, (scenario) => ({ ...scenario, runner: "table-regular-states" }) as unknown as ExecutableVisualScenario)
	).toContain(`${id} does not use the audited regular Table fixture and interaction flow`);
});

test("pins regular Table ordering, page totals, complete capture, and viewport-specific journeys", () => {
	const scenarios = executableScenariosForRunner("table-regular-states");
	expect(
		scenarios.every(
			({ capture, maxDiffPixels, threshold, maskSelectors }) =>
				capture.scope === "component" &&
				capture.selector === "example-viewer#regular stark-table" &&
				maxDiffPixels === 0 &&
				threshold === 0 &&
				maskSelectors.length === 0
		)
	).toBe(true);
	expect(
		scenarios.every(({ payload }) => payload.totalItems === 12 && payload.totalPages === 2 && payload.counterText === "12 item(s)")
	).toBe(true);
	const initial = scenarios.find(({ id }) => id === "table-regular-initial")!.payload.checkpoints[0];
	expect(initial.expectedRowIds).toEqual(["1", "10", "12", "2", "23", "222", "112", "232", "154", "27"]);
	expect(initial.expectedSort).toEqual({
		id: { direction: "asc", priority: 3 },
		title: { direction: "asc", priority: 1 },
		description: { direction: "desc", priority: 2 }
	});
	const last = (id: string) => scenarios.find((scenario) => scenario.id === id)!.payload.checkpoints.at(-1)!;
	expect(last("table-regular-next").expectedRowIds).toEqual(["86", "44"]);
	expect(last("table-regular-sorted-next").expectedRowIds).toEqual(["222", "232"]);
	expect(last("table-regular-title-desc").expectedRowIds).toEqual(["44", "86", "27", "154", "232", "112", "222", "23", "2", "12"]);
	expect(last("table-regular-keyboard-first").action).toEqual({ kind: "page-input", page: 1 });
	expect(
		scenarios.filter(({ payload }) => payload.viewport.width !== 1280).map(({ payload }) => [payload.viewport.width, payload.journey])
	).toEqual([
		[768, "next"],
		[390, "initial"],
		[390, "sorted-next"]
	]);
	expect(
		scenarios
			.filter(({ payload }) => payload.viewport.width === 390)
			.every(({ payload }) => payload.checkpoints.every(({ action }) => action.kind !== "page-input"))
	).toBe(true);
});

const invalidRegularTableChanges: readonly {
	name: string;
	id: string;
	change: (scenario: TableRegularStateScenario) => ExecutableVisualScenario;
}[] = [
	{
		name: "a separate page-size fixture",
		id: "table-regular-initial",
		change: (scenario) =>
			({
				...scenario,
				payload: { ...scenario.payload, fixtureSelector: "example-viewer#items-per-page" }
			}) as unknown as TableRegularStateScenario
	},
	{
		name: "the wrong sorted row order",
		id: "table-regular-id-desc",
		change: (scenario) => ({
			...scenario,
			payload: {
				...scenario.payload,
				checkpoints: scenario.payload.checkpoints.map((checkpoint) => ({
					...checkpoint,
					expectedRowIds: [...checkpoint.expectedRowIds].reverse()
				}))
			}
		})
	},
	{
		name: "a contradictory page number",
		id: "table-regular-next",
		change: (scenario) => ({
			...scenario,
			payload: {
				...scenario.payload,
				checkpoints: scenario.payload.checkpoints.map((checkpoint) => ({ ...checkpoint, expectedPage: 1 }))
			}
		})
	},
	{
		name: "an incorrect total count",
		id: "table-regular-initial",
		change: (scenario) => ({ ...scenario, payload: { ...scenario.payload, totalItems: 10, counterText: "10 item(s)" } })
	},
	{
		name: "an incorrect sort indicator",
		id: "table-regular-id-desc",
		change: (scenario) => ({
			...scenario,
			payload: {
				...scenario.payload,
				checkpoints: scenario.payload.checkpoints.map((checkpoint) => ({
					...checkpoint,
					expectedSort: { ...checkpoint.expectedSort, id: { direction: "none", priority: null } }
				}))
			}
		})
	},
	{
		name: "missing sorted-page retention checks",
		id: "table-regular-sorted-next",
		change: (scenario) => ({ ...scenario, payload: { ...scenario.payload, checkpoints: scenario.payload.checkpoints.slice(0, 4) } })
	},
	{
		name: "a hidden mobile page-input journey",
		id: "table-regular-keyboard-first",
		change: (scenario) => ({ ...scenario, payload: { ...scenario.payload, viewport: { width: 390, height: 1000 } } })
	},
	{
		name: "an unsupported filter journey",
		id: "table-regular-initial",
		change: (scenario) => ({ ...scenario, payload: { ...scenario.payload, journey: "filter" } }) as unknown as TableRegularStateScenario
	},
	{
		name: "a capture that omits header controls and count",
		id: "table-regular-initial",
		change: (scenario) => ({ ...scenario, capture: { scope: "component", selector: "example-viewer#regular .table-container" } })
	}
];

for (const { name, id, change } of invalidRegularTableChanges) {
	test(`rejects regular Table coverage with ${name}`, () => {
		const scenarios = executableVisualScenarios.map((scenario) =>
			scenario.runner === "table-regular-states" && scenario.id === id ? change(scenario) : scenario
		);
		expect(validate(visualSurfaceManifest, stateRequirements, stateAxisReviews, scenarios)).toContain(
			`${id} does not use the audited regular Table fixture and interaction flow`
		);
	});
}

for (const id of ["table-regular-id-none", "table-regular-first"]) {
	test(`rejects a supported regular Table journey substituted for ${id}`, () => {
		const initial = executableScenariosForRunner("table-regular-states").find((scenario) => scenario.id === "table-regular-initial")!;
		const scenarios = executableVisualScenarios.map((scenario) =>
			scenario.runner === "table-regular-states" && scenario.id === id
				? {
						...scenario,
						payload: { ...scenario.payload, journey: initial.payload.journey, checkpoints: initial.payload.checkpoints }
					}
				: scenario
		);
		expect(validate(visualSurfaceManifest, stateRequirements, stateAxisReviews, scenarios)).toContain(
			`${id} does not use the audited regular Table fixture and interaction flow`
		);
	});
}

test("rejects a supported regular Table viewport assigned to a different scenario ID", () => {
	const scenarios = executableVisualScenarios.map((scenario) =>
		scenario.runner === "table-regular-states" && scenario.id === "table-regular-initial"
			? { ...scenario, payload: { ...scenario.payload, viewport: { width: 390, height: 1000 } } }
			: scenario
	);
	expect(validate(visualSurfaceManifest, stateRequirements, stateAxisReviews, scenarios)).toContain(
		"table-regular-initial does not use the audited regular Table fixture and interaction flow"
	);
});

test("requires populated Table coverage without claiming its remaining content states", () => {
	const withoutPopulated = executableVisualScenarios.filter(({ sourceStateId }) => sourceStateId !== "table-component.content.populated");
	const errors = validate(visualSurfaceManifest, stateRequirements, stateAxisReviews, withoutPopulated);
	expect(errors).toContain("table-component.content.populated must have exactly one executable or missing-fixture disposition");
	expect(errors.some((error) => /table-component\.content\.(empty|custom-cells).*disposition/u.test(error))).toBe(false);
	const changedRunner = executableVisualScenarios.map((scenario) =>
		scenario.id === "table-regular-initial"
			? ({ ...scenario, runner: "navigation-control-states" } as unknown as ExecutableVisualScenario)
			: scenario
	);
	expect(validate(visualSurfaceManifest, stateRequirements, stateAxisReviews, changedRunner)).toContain(
		"table-regular-initial must use an audited populated Table state runner"
	);
});

test("pins Table selection page identities, off-page checks, keyboard action, and narrow captures", () => {
	const scenarios = executableScenariosForRunner("table-selection-states");
	expect(
		scenarios.every(
			({ capture, maskSelectors, maxDiffPixels, threshold }) =>
				capture.scope === "component" &&
				capture.selector === "example-viewer#selection .table-container" &&
				maskSelectors.length === 0 &&
				maxDiffPixels === 0 &&
				threshold === 0
		)
	).toBe(true);
	const allFirst = scenarios.find(({ id }) => id === "table-selection-all-first-page")!;
	expect(allFirst.payload.checkpoints.slice(1).map(({ expectedRowIds }) => expectedRowIds)).toEqual([
		["1", "10", "12", "2", "23"],
		["222", "112", "232", "154", "27"],
		["86", "44"],
		["1", "10", "12", "2", "23"]
	]);
	expect(
		allFirst.payload.checkpoints
			.slice(1)
			.every(
				({ expectedRowIds, expectedSelectedRowIds, expectedHeaderChecked, expectedHeaderIndeterminate }) =>
					JSON.stringify(expectedRowIds) === JSON.stringify(expectedSelectedRowIds) &&
					expectedHeaderChecked &&
					!expectedHeaderIndeterminate
			)
	).toBe(true);
	const retained = scenarios.find(({ id }) => id === "table-selection-retained-one")!;
	expect(retained.payload.checkpoints.map(({ expectedSelectedRowIds }) => expectedSelectedRowIds)).toEqual([[], ["1"], [], [], ["1"]]);
	expect(
		retained.payload.checkpoints
			.slice(1)
			.every(({ expectedHeaderChecked, expectedHeaderIndeterminate }) => !expectedHeaderChecked && expectedHeaderIndeterminate)
	).toBe(true);
	const keyboard = scenarios.find(({ id }) => id === "table-selection-keyboard-one")!;
	expect(keyboard.payload.checkpoints[1].action).toEqual({ kind: "row-space", rowId: "1" });
	expect(keyboard.sourceStateId).toBe("table-component.selection.one-selected");
	expect(
		scenarios
			.filter(({ payload }) => payload.viewport.width === 390)
			.map(({ payload }) => ({ journey: payload.journey, height: payload.viewport.height }))
	).toEqual([
		{ journey: "pointer-one", height: 900 },
		{ journey: "clear", height: 900 }
	]);
	for (const axis of ["focus", "overlay", "disclosure"] as const) {
		expect(stateRequirements.find(({ id }) => id === `table-component.${axis}`)?.ownerBead).toBe("stark-4sp.4.10");
	}
});

const invalidTableSelectionChanges: readonly {
	name: string;
	id: string;
	change: (scenario: TableSelectionStateScenario) => ExecutableVisualScenario;
}[] = [
	{
		name: "an unaudited fixture",
		id: "table-selection-one",
		change: (scenario) =>
			({
				...scenario,
				payload: { ...scenario.payload, fixtureSelector: "example-viewer#regular" }
			}) as unknown as TableSelectionStateScenario
	},
	{
		name: "an unsupported journey",
		id: "table-selection-one",
		change: (scenario) =>
			({ ...scenario, payload: { ...scenario.payload, journey: "row-click" } }) as unknown as TableSelectionStateScenario
	},
	{
		name: "wrong visible row IDs",
		id: "table-selection-one",
		change: (scenario) => ({
			...scenario,
			payload: {
				...scenario.payload,
				checkpoints: scenario.payload.checkpoints.map((checkpoint) => ({ ...checkpoint, expectedRowIds: ["1"] }))
			}
		})
	},
	{
		name: "wrong selected row IDs",
		id: "table-selection-one",
		change: (scenario) => ({
			...scenario,
			payload: {
				...scenario.payload,
				checkpoints: scenario.payload.checkpoints.map((checkpoint) => ({ ...checkpoint, expectedSelectedRowIds: [] }))
			}
		})
	},
	{
		name: "a header that loses off-page indeterminate state",
		id: "table-selection-retained-one",
		change: (scenario) => ({
			...scenario,
			payload: {
				...scenario.payload,
				checkpoints: scenario.payload.checkpoints.map((checkpoint) =>
					checkpoint.page === 2 ? { ...checkpoint, expectedHeaderIndeterminate: false } : checkpoint
				)
			}
		})
	},
	{
		name: "a checked header before all rows are selected",
		id: "table-selection-one",
		change: (scenario) => ({
			...scenario,
			payload: {
				...scenario.payload,
				checkpoints: scenario.payload.checkpoints.map((checkpoint) => ({ ...checkpoint, expectedHeaderChecked: true }))
			}
		})
	},
	{
		name: "deleted off-page selection checks",
		id: "table-selection-all-first-page",
		change: (scenario) => ({ ...scenario, payload: { ...scenario.payload, checkpoints: scenario.payload.checkpoints.slice(0, 2) } })
	},
	{
		name: "pointer selection substituted for keyboard Space",
		id: "table-selection-keyboard-one",
		change: (scenario) => ({
			...scenario,
			payload: {
				...scenario.payload,
				checkpoints: scenario.payload.checkpoints.map((checkpoint) =>
					checkpoint.action.kind === "row-space" ? { ...checkpoint, action: { kind: "row-checkbox", rowId: "1" } } : checkpoint
				)
			}
		})
	},
	{
		name: "an incorrect source selection state",
		id: "table-selection-one",
		change: (scenario) => ({ ...scenario, state: "all-selected", sourceStateId: "table-component.selection.all-selected" })
	},
	{
		name: "an unreviewed narrow viewport",
		id: "table-selection-narrow-one",
		change: (scenario) => ({ ...scenario, payload: { ...scenario.payload, viewport: { width: 400, height: 900 } } })
	},
	{
		name: "a page capture",
		id: "table-selection-one",
		change: (scenario) => ({ ...scenario, capture: { scope: "page" } }) as unknown as TableSelectionStateScenario
	},
	{
		name: "a capture that drops the selection header",
		id: "table-selection-one",
		change: (scenario) => ({ ...scenario, capture: { scope: "component", selector: "example-viewer#selection tbody" } })
	},
	{
		name: "a masked screenshot",
		id: "table-selection-one",
		change: (scenario) => ({ ...scenario, maskSelectors: ["mat-checkbox"] }) as unknown as TableSelectionStateScenario
	},
	{
		name: "a pixel allowance",
		id: "table-selection-one",
		change: (scenario) => ({ ...scenario, maxDiffPixels: 1 })
	},
	{
		name: "a nonzero threshold",
		id: "table-selection-one",
		change: (scenario) => ({ ...scenario, threshold: 0.1 }) as unknown as TableSelectionStateScenario
	}
];

for (const { name, id, change } of invalidTableSelectionChanges) {
	test(`rejects Table selection coverage with ${name}`, () => {
		const scenarios = executableVisualScenarios.map((scenario) =>
			scenario.runner === "table-selection-states" && scenario.id === id ? change(scenario) : scenario
		);
		expect(validate(visualSurfaceManifest, stateRequirements, stateAxisReviews, scenarios)).toContain(
			`${id} does not use the audited Table selection fixture and interaction flow`
		);
	});
}

test("fails closed when a Table selection state is missing or assigned to a different runner", () => {
	const withoutAll = executableVisualScenarios.filter(({ sourceStateId }) => sourceStateId !== "table-component.selection.all-selected");
	const errors = validate(visualSurfaceManifest, stateRequirements, stateAxisReviews, withoutAll);
	expect(errors).toContain("table-component.selection.all-selected must have exactly one executable or missing-fixture disposition");
	expect(errors.some((error) => error.includes("table-component.content") && error.includes("disposition"))).toBe(false);
	const wrongRunner = executableVisualScenarios.map((scenario) =>
		scenario.id === "table-selection-one"
			? ({ ...scenario, runner: "navigation-control-states" } as unknown as ExecutableVisualScenario)
			: scenario
	);
	expect(validate(visualSurfaceManifest, stateRequirements, stateAxisReviews, wrongRunner)).toContain(
		"table-selection-one must use the Table selection state runner"
	);
});

test("pins Generic Search data, loading capture, and narrow journeys without taking responsive ownership", () => {
	const scenarios = executableScenariosForRunner("generic-search-states");
	expect(
		scenarios.every(
			({ capture, maskSelectors, maxDiffPixels, threshold }) =>
				capture.scope === "component" && maskSelectors.length === 0 && maxDiffPixels === 0 && threshold === 0
		)
	).toBe(true);
	const narrow = scenarios.filter(({ payload }) => payload.viewport.width === 390);
	expect(narrow.map(({ sourceStateId }) => sourceStateId)).toEqual([
		"generic-search-component.availability.enabled",
		"generic-search-component.disclosure.form-closed"
	]);
	expect(narrow.every(({ payload }) => payload.viewport.height === 844)).toBe(true);
	const heroSearch = scenarios.find(({ id }) => id === "generic-search-hero-matches")!;
	expect(heroSearch.payload.criteria).toEqual({ year: "", hero: "iRoN", movie: "" });
	expect(heroSearch.payload.expectedRows).toEqual([
		["Iron Man", "Iron Man", "2008"],
		["Iron Man", "Iron Man 2", "2010"],
		["Iron Man", "Iron Man 3", "2013"]
	]);
	expect(scenarios.find(({ id }) => id === "generic-search-keyboard-year-matches")?.payload.expectedRows).toEqual([
		["Iron Man", "Iron Man", "2008"],
		["Batman", "The Dark Knight", "2008"]
	]);
	expect(scenarios.find(({ id }) => id === "generic-search-all-results")?.payload.expectedRows).toHaveLength(8);
	for (const scenario of scenarios) {
		const expectedSelector =
			scenario.payload.journey === "close"
				? "example-viewer#generic-search-component mat-slide-toggle"
				: scenario.payload.journey === "loading"
					? "example-viewer#generic-search-component stark-progress-indicator"
					: "#demo-generic-search-form";
		expect(scenario.capture.selector).toBe(expectedSelector);
	}
});

const invalidGenericSearchChanges: readonly {
	name: string;
	id: string;
	change: (scenario: GenericSearchStateScenario) => ExecutableVisualScenario;
}[] = [
	{
		name: "an unaudited fixture",
		id: "generic-search-hero-matches",
		change: (scenario) =>
			({
				...scenario,
				payload: { ...scenario.payload, fixtureSelector: "example-viewer#unknown" }
			}) as unknown as GenericSearchStateScenario
	},
	{
		name: "an unsupported journey",
		id: "generic-search-hero-matches",
		change: (scenario) =>
			({ ...scenario, payload: { ...scenario.payload, journey: "sort-table" } }) as unknown as GenericSearchStateScenario
	},
	{
		name: "changed search criteria",
		id: "generic-search-hero-matches",
		change: (scenario) => ({ ...scenario, payload: { ...scenario.payload, criteria: { year: "", hero: "", movie: "" } } })
	},
	{
		name: "missing result cell assertions",
		id: "generic-search-hero-matches",
		change: (scenario) => ({ ...scenario, payload: { ...scenario.payload, expectedRows: [] } })
	},
	{
		name: "stale rows after no matches",
		id: "generic-search-no-matches",
		change: (scenario) => ({ ...scenario, payload: { ...scenario.payload, expectedRows: [["Iron Man", "Iron Man", "2008"]] } })
	},
	{
		name: "reset criteria that retain an old value",
		id: "generic-search-reset",
		change: (scenario) => ({ ...scenario, payload: { ...scenario.payload, expectedCriteria: scenario.payload.criteria } })
	},
	{
		name: "incorrect closed-form expectations",
		id: "generic-search-form-closed",
		change: (scenario) => ({ ...scenario, payload: { ...scenario.payload, expectedFormOpen: true } })
	},
	{
		name: "a keyboard journey that omits focus assertions",
		id: "generic-search-keyboard-year-matches",
		change: (scenario) => ({ ...scenario, payload: { ...scenario.payload, expectedKeyboardFocus: false } })
	},
	{
		name: "an unreviewed viewport",
		id: "generic-search-narrow-hero-matches",
		change: (scenario) => ({ ...scenario, payload: { ...scenario.payload, viewport: { width: 400, height: 844 } } })
	},
	{
		name: "the inline host as a form capture",
		id: "generic-search-form-open",
		change: (scenario) => ({
			...scenario,
			capture: { scope: "component", selector: "example-viewer#generic-search-component stark-generic-search" }
		})
	},
	{
		name: "a table capture in place of the loading indicator",
		id: "generic-search-loading",
		change: (scenario) => ({
			...scenario,
			capture: { scope: "component", selector: "example-viewer#generic-search-component stark-table" }
		})
	},
	{
		name: "a page capture",
		id: "generic-search-hero-matches",
		change: (scenario) => ({ ...scenario, capture: { scope: "page" } }) as unknown as GenericSearchStateScenario
	},
	{
		name: "a masked screenshot",
		id: "generic-search-hero-matches",
		change: (scenario) => ({ ...scenario, maskSelectors: ["input"] }) as unknown as GenericSearchStateScenario
	},
	{
		name: "a pixel allowance",
		id: "generic-search-hero-matches",
		change: (scenario) => ({ ...scenario, maxDiffPixels: 1 })
	},
	{
		name: "a nonzero threshold",
		id: "generic-search-hero-matches",
		change: (scenario) => ({ ...scenario, threshold: 0.1 }) as unknown as GenericSearchStateScenario
	}
];

for (const { name, id, change } of invalidGenericSearchChanges) {
	test(`rejects Generic Search coverage with ${name}`, () => {
		const scenarios = executableVisualScenarios.map((scenario) =>
			scenario.runner === "generic-search-states" && scenario.id === id ? change(scenario) : scenario
		);
		expect(validate(visualSurfaceManifest, stateRequirements, stateAxisReviews, scenarios)).toContain(
			`${id} does not use the audited Generic Search fixture and interaction flow`
		);
	});
}

test("fails closed when Generic Search loses a reachable state or the disabled-fixture disposition", () => {
	const withoutClosed = executableVisualScenarios.filter(
		({ sourceStateId }) => sourceStateId !== "generic-search-component.disclosure.form-closed"
	);
	expect(validate(visualSurfaceManifest, stateRequirements, stateAxisReviews, withoutClosed)).toContain(
		"generic-search-component.disclosure.form-closed must have exactly one executable or missing-fixture disposition"
	);
	const withoutDisabled = missingVisualFixtureStates.filter(
		({ sourceStateId }) => sourceStateId !== "generic-search-component.availability.disabled"
	);
	expect(validate(visualSurfaceManifest, stateRequirements, stateAxisReviews, executableVisualScenarios, withoutDisabled)).toContain(
		"generic-search-component.availability.disabled must have exactly one executable or missing-fixture disposition"
	);
});

test("rejects Generic Search coverage that claims disabled configuration or changes runner ownership", () => {
	const disabled = executableVisualScenarios.map((scenario) =>
		scenario.id === "generic-search-hero-matches"
			? { ...scenario, state: "disabled", sourceStateId: "generic-search-component.availability.disabled" }
			: scenario
	);
	expect(validate(visualSurfaceManifest, stateRequirements, stateAxisReviews, disabled)).toContain(
		"generic-search-hero-matches does not use the audited Generic Search fixture and interaction flow"
	);
	const changedRunner = executableVisualScenarios.map((scenario) =>
		scenario.id === "generic-search-hero-matches"
			? ({ ...scenario, runner: "navigation-control-states" } as unknown as ExecutableVisualScenario)
			: scenario
	);
	expect(validate(visualSurfaceManifest, stateRequirements, stateAxisReviews, changedRunner)).toContain(
		"generic-search-hero-matches must use the Generic Search state runner"
	);
});

test("pins Route Search variants, real navigation results, and strict capture boundaries", () => {
	const scenarios = executableScenariosForRunner("route-search-states");
	expect([...new Set(scenarios.map(({ payload }) => payload.fixtureSelector))].sort()).toEqual([
		"example-viewer#direction-left",
		"example-viewer#direction-right",
		"example-viewer#with-menu-config-and-custom-color"
	]);
	expect(
		scenarios.every(
			({ capture, maskSelectors, maxDiffPixels, threshold }) =>
				capture.scope === "component" && maskSelectors.length === 0 && maxDiffPixels === 0 && threshold === 0
		)
	).toBe(true);
	const selections = scenarios.filter(({ payload }) => payload.action.kind === "select");
	expect(selections.map(({ payload }) => payload.expected)).toEqual([
		{ kind: "destination", path: "/demo-ui/breadcrumb", heading: "Breadcrumb" },
		{ kind: "destination", path: "/demo-ui/breadcrumb", heading: "Breadcrumb" },
		{ kind: "destination", path: "/styleguide/typography", heading: "Typography" },
		{ kind: "destination", path: "/demo-ui/date-range-picker", heading: "Date range picker" }
	]);
	for (const scenario of scenarios) {
		if (scenario.payload.expected.kind === "destination") {
			expect(scenario.capture.selector).toBe(`ui-view h1:text-is("${scenario.payload.expected.heading}")`);
		} else if (
			scenario.axis === "disclosure" ||
			scenario.sourceStateId === "route-search-component.overlay.closed" ||
			scenario.state === "no-matches"
		) {
			expect(scenario.capture.selector).toBe(scenario.payload.fixtureSelector);
		} else {
			expect(scenario.capture.selector).toBe(".search-route-autocomplete[role=listbox]");
		}
	}
});

const invalidRouteSearchChanges: readonly {
	name: string;
	id: string;
	change: (scenario: RouteSearchStateScenario) => ExecutableVisualScenario;
}[] = [
	{
		name: "an unaudited fixture",
		id: "route-search-left-matches",
		change: (scenario) =>
			({
				...scenario,
				payload: { ...scenario.payload, fixtureSelector: "example-viewer#unknown" }
			}) as unknown as RouteSearchStateScenario
	},
	{
		name: "an unsupported action",
		id: "route-search-left-matches",
		change: (scenario) =>
			({ ...scenario, payload: { ...scenario.payload, action: { kind: "hover" } } }) as unknown as RouteSearchStateScenario
	},
	{
		name: "a lazy menu query in the router-only fixture",
		id: "route-search-left-matches",
		change: (scenario) => ({ ...scenario, payload: { ...scenario.payload, action: { kind: "filter", query: "typography" } } })
	},
	{
		name: "a selection action claiming an unselected state",
		id: "route-search-left-unselected",
		change: (scenario) => ({
			...scenario,
			payload: { ...scenario.payload, action: { kind: "select", query: "brEAd", via: "pointer" } }
		})
	},
	{
		name: "missing matching-result assertions",
		id: "route-search-left-matches",
		change: (scenario) => ({
			...scenario,
			payload: { ...scenario.payload, expected: { kind: "search", inputVisible: true, value: "brEAd", results: [] } }
		})
	},
	{
		name: "dismissal that incorrectly clears the query",
		id: "route-search-left-escape",
		change: (scenario) => ({
			...scenario,
			payload: { ...scenario.payload, expected: { kind: "search", inputVisible: true, value: "", results: null } }
		})
	},
	{
		name: "a keyboard selection with the wrong destination",
		id: "route-search-right-second-enter-selection",
		change: (scenario) => ({
			...scenario,
			payload: { ...scenario.payload, expected: { kind: "destination", path: "/demo-ui/date-picker", heading: "Date picker" } }
		})
	},
	{
		name: "an unrelated page capture",
		id: "route-search-left-matches",
		change: (scenario) => ({ ...scenario, capture: { scope: "page" } }) as unknown as RouteSearchStateScenario
	},
	{
		name: "a control capture that clips the overflowing field",
		id: "route-search-right-open",
		change: (scenario) => ({
			...scenario,
			capture: { scope: "component", selector: `${scenario.payload.fixtureSelector} stark-route-search` }
		})
	},
	{
		name: "a masked comparison",
		id: "route-search-left-matches",
		change: (scenario) => ({ ...scenario, maskSelectors: [".search-field-input"] }) as unknown as RouteSearchStateScenario
	},
	{
		name: "a pixel allowance",
		id: "route-search-left-matches",
		change: (scenario) => ({ ...scenario, maxDiffPixels: 1 })
	},
	{
		name: "a nonzero screenshot threshold",
		id: "route-search-left-matches",
		change: (scenario) => ({ ...scenario, threshold: 0.1 }) as unknown as RouteSearchStateScenario
	}
];

for (const { name, id, change } of invalidRouteSearchChanges) {
	test(`rejects Route Search coverage with ${name}`, () => {
		const scenarios = executableVisualScenarios.map((scenario) =>
			scenario.runner === "route-search-states" && scenario.id === id ? change(scenario) : scenario
		);
		expect(validate(visualSurfaceManifest, stateRequirements, stateAxisReviews, scenarios)).toContain(
			`${id} does not use the audited Route Search fixture and interaction flow`
		);
	});
}

test("fails closed when a Route Search state loses its executable disposition", () => {
	const scenarios = executableVisualScenarios.filter(
		({ sourceStateId }) => sourceStateId !== "route-search-component.selection.selected"
	);
	const errors = validate(visualSurfaceManifest, stateRequirements, stateAxisReviews, scenarios);
	expect(errors).toContain("route-search-component.selection.selected must have exactly one executable or missing-fixture disposition");
	expect(errors.some((error) => error.includes("generic-search") && error.includes("disposition"))).toBe(false);
});

test("rejects Route Search states assigned to another registered runner", () => {
	const scenarios = executableVisualScenarios.map((scenario) =>
		scenario.id === "route-search-left-matches"
			? ({ ...scenario, runner: "navigation-control-states" } as unknown as ExecutableVisualScenario)
			: scenario
	);
	expect(validate(visualSurfaceManifest, stateRequirements, stateAxisReviews, scenarios)).toContain(
		"route-search-left-matches must use the Route Search state runner"
	);
});

test("runs every date, date-range, and date-time state owned by the date-control bead", () => {
	const ownedStateIds = sourceBackedStates
		.filter(({ ownerBead }) => ownerBead === "stark-4sp.4.4")
		.map(({ id }) => id)
		.sort();
	const executableStateIds = executableScenariosForRunner("date-control-states")
		.map(({ sourceStateId }) => sourceStateId)
		.sort();
	const missingStateIds = missingVisualFixtureStates
		.filter(({ ownerBead }) => ownerBead === "stark-4sp.4.4")
		.map(({ sourceStateId }) => sourceStateId)
		.sort();

	expect(ownedStateIds).toHaveLength(31);
	expect(executableStateIds).toEqual(ownedStateIds);
	expect(missingStateIds).toEqual([]);
});

test("gives every dialog, message, progress, and toast state one explicit fixture disposition", () => {
	const ownedStateIds = sourceBackedStates
		.filter(({ ownerBead }) => ownerBead === "stark-4sp.4.7")
		.map(({ id }) => id)
		.sort();
	const executableStateIds = executableScenariosForRunner("feedback-states")
		.map(({ sourceStateId }) => sourceStateId)
		.sort();
	const missingStateIds = missingVisualFixtureStates
		.filter(({ ownerBead }) => ownerBead === "stark-4sp.4.7")
		.map(({ sourceStateId }) => sourceStateId)
		.sort();

	expect(ownedStateIds).toHaveLength(68);
	expect(executableStateIds).toHaveLength(66);
	expect(missingStateIds).toEqual(["progress-indicator-directive.content.fallback", "progress-indicator-service.selection.topic-b"]);
	expect([...executableStateIds, ...missingStateIds].sort()).toEqual(ownedStateIds);
});

test("runs both App Logo focus states through the exact audited shell component", () => {
	const appLogoScenarios = executableScenariosForRunner("app-logo-focus");
	expect(
		appLogoScenarios.map(
			({ capture, maskSelectors, maxDiffPixels, payload, routeId, runner, sourceStateId, snapshotName, threshold }) => ({
				capture,
				maskSelectors,
				maxDiffPixels,
				payload,
				routeId,
				runner,
				sourceStateId,
				snapshotName,
				threshold
			})
		)
	).toEqual([
		{
			capture: { scope: "component", selector: ".stark-app-header .app-logo > stark-app-logo" },
			maskSelectors: [],
			maxDiffPixels: 0,
			payload: {
				action: { kind: "initial" },
				capturePadding: 2,
				componentSelector: ".stark-app-header .app-logo > stark-app-logo",
				expectedFocusVisible: false,
				focusTargetSelector: '.stark-app-header .app-logo > stark-app-logo > a[href="#"]'
			},
			routeId: "app-shell",
			runner: "app-logo-focus",
			sourceStateId: "app-logo-component.focus.rest",
			snapshotName: "app-logo-focus-rest.png",
			threshold: 0
		},
		{
			capture: { scope: "component", selector: ".stark-app-header .app-logo > stark-app-logo" },
			maskSelectors: [],
			maxDiffPixels: 0,
			payload: {
				action: { kind: "keyboard-tab" },
				capturePadding: 2,
				componentSelector: ".stark-app-header .app-logo > stark-app-logo",
				expectedFocusVisible: true,
				focusTargetSelector: '.stark-app-header .app-logo > stark-app-logo > a[href="#"]'
			},
			routeId: "app-shell",
			runner: "app-logo-focus",
			sourceStateId: "app-logo-component.focus.keyboard",
			snapshotName: "app-logo-focus-keyboard.png",
			threshold: 0
		}
	]);
});

test("runs every reachable App Data mode, disclosure, and focus state", () => {
	const appDataScenarios = executableVisualScenarios.filter(({ surfaceId }) => surfaceId === "app-data-component");
	const appDataSourceStates = sourceBackedStates
		.filter(({ ownerBead, surfaceId }) => surfaceId === "app-data-component" && ownerBead === "stark-4sp.4.2")
		.map(({ id }) => id);

	expect(appDataSourceStates).toEqual([
		"app-data-component.content.dropdown",
		"app-data-component.content.menu",
		"app-data-component.disclosure.closed",
		"app-data-component.disclosure.open",
		"app-data-component.focus.rest",
		"app-data-component.focus.keyboard"
	]);
	expect(
		appDataScenarios.map(
			({ capture, maskSelectors, maxDiffPixels, payload, routeId, runner, sourceStateId, snapshotName, threshold }) => ({
				capture,
				maskSelectors,
				maxDiffPixels,
				payload: {
					action: payload.action,
					expectedFocusVisible: payload.expectedFocusVisible,
					expectedFocused: payload.expectedFocused,
					expectedMode: payload.expectedMode,
					expectedOpen: payload.expectedOpen
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
			capture: {
				scope: "component",
				selector: "example-viewer#dropdown stark-app-data.stark-app-data > div.stark-app-data.dropdown"
			},
			maskSelectors: [],
			maxDiffPixels: 0,
			payload: {
				action: { kind: "initial" },
				expectedFocusVisible: false,
				expectedFocused: false,
				expectedMode: "dropdown",
				expectedOpen: false
			},
			routeId: "app-data",
			runner: "app-data-states",
			sourceStateId: "app-data-component.content.dropdown",
			snapshotName: "app-data-content-dropdown.png",
			threshold: 0
		},
		{
			capture: {
				scope: "component",
				selector: "example-viewer#menu stark-app-data.stark-app-data > div.stark-app-data.menu"
			},
			maskSelectors: [],
			maxDiffPixels: 0,
			payload: {
				action: { kind: "initial" },
				expectedFocusVisible: false,
				expectedFocused: false,
				expectedMode: "menu",
				expectedOpen: false
			},
			routeId: "app-data",
			runner: "app-data-states",
			sourceStateId: "app-data-component.content.menu",
			snapshotName: "app-data-content-menu.png",
			threshold: 0
		},
		{
			capture: {
				scope: "component",
				selector: "example-viewer#dropdown stark-app-data.stark-app-data > div.stark-app-data.dropdown"
			},
			maskSelectors: [],
			maxDiffPixels: 0,
			payload: {
				action: { kind: "initial" },
				expectedFocusVisible: false,
				expectedFocused: false,
				expectedMode: "dropdown",
				expectedOpen: false
			},
			routeId: "app-data",
			runner: "app-data-states",
			sourceStateId: "app-data-component.disclosure.closed",
			snapshotName: "app-data-disclosure-closed.png",
			threshold: 0
		},
		{
			capture: { scope: "component", selector: ".cdk-overlay-pane .stark-app-data.dropdown-detail" },
			maskSelectors: [],
			maxDiffPixels: 575,
			payload: {
				action: { kind: "open-dropdown" },
				expectedFocusVisible: false,
				expectedFocused: true,
				expectedMode: "dropdown",
				expectedOpen: true
			},
			routeId: "app-data",
			runner: "app-data-states",
			sourceStateId: "app-data-component.disclosure.open",
			snapshotName: "app-data-disclosure-open.png",
			threshold: 0
		},
		{
			capture: {
				scope: "component",
				selector: "example-viewer#dropdown stark-app-data.stark-app-data > div.stark-app-data.dropdown"
			},
			maskSelectors: [],
			maxDiffPixels: 0,
			payload: {
				action: { kind: "initial" },
				expectedFocusVisible: false,
				expectedFocused: false,
				expectedMode: "dropdown",
				expectedOpen: false
			},
			routeId: "app-data",
			runner: "app-data-states",
			sourceStateId: "app-data-component.focus.rest",
			snapshotName: "app-data-focus-rest.png",
			threshold: 0
		},
		{
			capture: {
				scope: "component",
				selector: "example-viewer#dropdown stark-app-data.stark-app-data > div.stark-app-data.dropdown"
			},
			maskSelectors: [],
			maxDiffPixels: 25,
			payload: {
				action: { kind: "keyboard-tab" },
				expectedFocusVisible: true,
				expectedFocused: true,
				expectedMode: "dropdown",
				expectedOpen: false
			},
			routeId: "app-data",
			runner: "app-data-states",
			sourceStateId: "app-data-component.focus.keyboard",
			snapshotName: "app-data-focus-keyboard.png",
			threshold: 0
		}
	]);
});

test("runs every reachable Minimap content, selection, overlay, and focus state owned by this bead", () => {
	const minimapScenarios = executableVisualScenarios.filter(({ surfaceId }) => surfaceId === "minimap-component");
	const minimapSourceStates = sourceBackedStates
		.filter(({ ownerBead, surfaceId }) => surfaceId === "minimap-component" && ownerBead === "stark-4sp.4.2")
		.map(({ id }) => id);

	expect(minimapSourceStates).toEqual([
		"minimap-component.content.empty",
		"minimap-component.content.populated",
		"minimap-component.selection.all-visible",
		"minimap-component.selection.partially-hidden",
		"minimap-component.overlay.closed",
		"minimap-component.overlay.open",
		"minimap-component.focus.rest",
		"minimap-component.focus.keyboard"
	]);
	expect(
		minimapScenarios.map(
			({ capture, maskSelectors, maxDiffPixels, payload, routeId, runner, sourceStateId, snapshotName, threshold }) => ({
				capture,
				maskSelectors,
				maxDiffPixels,
				payload: {
					action: payload.action,
					expectedChecked: payload.expectedChecked,
					expectedFocusVisible: payload.expectedFocusVisible,
					expectedFocused: payload.expectedFocused,
					expectedMenuOpen: payload.expectedMenuOpen,
					expectedSelected: payload.expectedSelected
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
			capture: {
				scope: "component",
				selector: "example-viewer#full stark-minimap.stark-minimap:not(.stark-primary):not(.stark-accent)"
			},
			maskSelectors: [],
			maxDiffPixels: 0,
			payload: {
				action: { kind: "initial" },
				expectedChecked: [],
				expectedFocusVisible: false,
				expectedFocused: false,
				expectedMenuOpen: false,
				expectedSelected: [true, true, true, true]
			},
			routeId: "minimap",
			runner: "minimap-states",
			sourceStateId: "minimap-component.content.populated",
			snapshotName: "minimap-content-populated.png",
			threshold: 0
		},
		{
			capture: { scope: "component", selector: '.cdk-overlay-pane [role="menu"]:has(.stark-minimap-menu-item)' },
			maskSelectors: [],
			maxDiffPixels: 200,
			payload: {
				action: { kind: "open-menu" },
				expectedChecked: [true, true, true, true],
				expectedFocusVisible: false,
				expectedFocused: false,
				expectedMenuOpen: true,
				expectedSelected: [true, true, true, true]
			},
			routeId: "minimap",
			runner: "minimap-states",
			sourceStateId: "minimap-component.selection.all-visible",
			snapshotName: "minimap-selection-all-visible.png",
			threshold: 0
		},
		{
			capture: { scope: "component", selector: '.cdk-overlay-pane [role="menu"]:has(.stark-minimap-menu-item)' },
			maskSelectors: [],
			maxDiffPixels: 420,
			payload: {
				action: { index: 1, kind: "open-menu-toggle-item" },
				expectedChecked: [true, false, true, true],
				expectedFocusVisible: false,
				expectedFocused: false,
				expectedMenuOpen: true,
				expectedSelected: [true, false, true, true]
			},
			routeId: "minimap",
			runner: "minimap-states",
			sourceStateId: "minimap-component.selection.partially-hidden",
			snapshotName: "minimap-selection-partially-hidden.png",
			threshold: 0
		},
		{
			capture: {
				scope: "component",
				selector: "example-viewer#full stark-minimap.stark-minimap:not(.stark-primary):not(.stark-accent)"
			},
			maskSelectors: [],
			maxDiffPixels: 0,
			payload: {
				action: { kind: "initial" },
				expectedChecked: [],
				expectedFocusVisible: false,
				expectedFocused: false,
				expectedMenuOpen: false,
				expectedSelected: [true, true, true, true]
			},
			routeId: "minimap",
			runner: "minimap-states",
			sourceStateId: "minimap-component.overlay.closed",
			snapshotName: "minimap-overlay-closed.png",
			threshold: 0
		},
		{
			capture: { scope: "component", selector: '.cdk-overlay-pane [role="menu"]:has(.stark-minimap-menu-item)' },
			maskSelectors: [],
			maxDiffPixels: 200,
			payload: {
				action: { kind: "open-menu" },
				expectedChecked: [true, true, true, true],
				expectedFocusVisible: false,
				expectedFocused: false,
				expectedMenuOpen: true,
				expectedSelected: [true, true, true, true]
			},
			routeId: "minimap",
			runner: "minimap-states",
			sourceStateId: "minimap-component.overlay.open",
			snapshotName: "minimap-overlay-open.png",
			threshold: 0
		},
		{
			capture: {
				scope: "component",
				selector: "example-viewer#full stark-minimap.stark-minimap:not(.stark-primary):not(.stark-accent)"
			},
			maskSelectors: [],
			maxDiffPixels: 0,
			payload: {
				action: { kind: "initial" },
				expectedChecked: [],
				expectedFocusVisible: false,
				expectedFocused: false,
				expectedMenuOpen: false,
				expectedSelected: [true, true, true, true]
			},
			routeId: "minimap",
			runner: "minimap-states",
			sourceStateId: "minimap-component.focus.rest",
			snapshotName: "minimap-focus-rest.png",
			threshold: 0
		},
		{
			capture: {
				scope: "component",
				selector: "example-viewer#full stark-minimap.stark-minimap:not(.stark-primary):not(.stark-accent)"
			},
			maskSelectors: [],
			maxDiffPixels: 0,
			payload: {
				action: { kind: "keyboard-tab" },
				expectedChecked: [],
				expectedFocusVisible: true,
				expectedFocused: true,
				expectedMenuOpen: false,
				expectedSelected: [true, true, true, true]
			},
			routeId: "minimap",
			runner: "minimap-states",
			sourceStateId: "minimap-component.focus.keyboard",
			snapshotName: "minimap-focus-keyboard.png",
			threshold: 0
		}
	]);
	expect(minimapScenarios.map(({ sourceStateId }) => sourceStateId)).not.toContain("minimap-component.content.empty");
});

test("runs every Pagination state that the pinned legacy fixtures can honestly render", () => {
	const paginationScenarios = executableVisualScenarios.filter(({ surfaceId }) => surfaceId === "pagination-component");
	const paginationSourceStates = sourceBackedStates
		.filter(({ ownerBead, surfaceId }) => surfaceId === "pagination-component" && ownerBead === "stark-4sp.4.2")
		.map(({ id }) => id);

	expect(paginationSourceStates).toEqual([
		"pagination-component.content.empty",
		"pagination-component.content.populated",
		"pagination-component.availability.previous-disabled",
		"pagination-component.availability.next-enabled",
		"pagination-component.availability.next-disabled",
		"pagination-component.selection.first-page",
		"pagination-component.selection.middle-page",
		"pagination-component.selection.page-size",
		"pagination-component.focus.rest",
		"pagination-component.focus.keyboard"
	]);
	expect(paginationScenarios.map(({ sourceStateId }) => sourceStateId)).toEqual(paginationSourceStates.slice(1));
	expect(paginationScenarios).toHaveLength(9);
	expect(
		paginationScenarios.every(
			({ capture, id, maskSelectors, maxDiffPixels, ownerBead, routeId, threshold }) =>
				capture.scope === "component" &&
				capture.selector !== "body" &&
				maskSelectors.length === 0 &&
				maxDiffPixels === reviewedVisualDiffBudgets[id] &&
				ownerBead === "stark-4sp.4.2" &&
				routeId === "pagination" &&
				threshold === 0
		)
	).toBe(true);
	expect(paginationScenarios.map(({ sourceStateId }) => sourceStateId)).not.toContain("pagination-component.content.empty");
});

test("runs every Pretty Print component and service state that the pinned legacy fixtures can honestly render", () => {
	const componentSourceStates = sourceBackedStates
		.filter(({ ownerBead, surfaceId }) => surfaceId === "pretty-print-component" && ownerBead === "stark-4sp.4.2")
		.map(({ id }) => id);
	const serviceSourceStates = sourceBackedStates
		.filter(({ ownerBead, surfaceId }) => surfaceId === "pretty-print-service" && ownerBead === "stark-4sp.4.2")
		.map(({ id }) => id);
	const componentScenarios = executableVisualScenarios.filter(({ surfaceId }) => surfaceId === "pretty-print-component");
	const serviceScenarios = executableVisualScenarios.filter(({ surfaceId }) => surfaceId === "pretty-print-service");

	expect(componentSourceStates).toEqual([
		"pretty-print-component.content.empty",
		"pretty-print-component.content.plain",
		"pretty-print-component.content.highlighted",
		"pretty-print-component.content.typescript",
		"pretty-print-component.async.pending",
		"pretty-print-component.async.formatted",
		"pretty-print-component.async.error",
		"pretty-print-component.validity.supported-format",
		"pretty-print-component.validity.unsupported-format"
	]);
	expect(serviceSourceStates).toEqual([
		"pretty-print-service.content.empty",
		"pretty-print-service.content.json",
		"pretty-print-service.content.xml",
		"pretty-print-service.async.pending",
		"pretty-print-service.async.formatted",
		"pretty-print-service.async.error",
		"pretty-print-service.validity.valid",
		"pretty-print-service.validity.invalid"
	]);
	expect(componentScenarios.map(({ sourceStateId }) => sourceStateId)).toEqual([
		"pretty-print-component.content.empty",
		"pretty-print-component.content.plain",
		"pretty-print-component.content.highlighted",
		"pretty-print-component.content.typescript",
		"pretty-print-component.async.formatted",
		"pretty-print-component.async.error",
		"pretty-print-component.validity.supported-format"
	]);
	expect(serviceScenarios.map(({ sourceStateId }) => sourceStateId)).toEqual([
		"pretty-print-service.content.json",
		"pretty-print-service.content.xml",
		"pretty-print-service.async.formatted",
		"pretty-print-service.async.error",
		"pretty-print-service.validity.valid",
		"pretty-print-service.validity.invalid"
	]);
	expect([...componentScenarios, ...serviceScenarios]).toHaveLength(13);
	expect(
		[...componentScenarios, ...serviceScenarios].every(
			({ capture, maskSelectors, maxDiffPixels, ownerBead, routeId, threshold }) =>
				capture.scope === "component" &&
				capture.selector !== "body" &&
				maskSelectors.length === 0 &&
				maxDiffPixels === 0 &&
				ownerBead === "stark-4sp.4.2" &&
				routeId === "pretty-print" &&
				threshold === 0
		)
	).toBe(true);
});

test("runs every App Footer state that the pinned legacy fixture can honestly render", () => {
	const footerScenarios = executableScenariosForRunner("app-footer-states");
	const footerSourceStates = sourceBackedStates.filter(({ surfaceId }) => surfaceId === "app-footer-component").map(({ id }) => id);

	expect(footerSourceStates).toEqual([
		"app-footer-component.content.without-links",
		"app-footer-component.content.with-links",
		"app-footer-component.focus.rest",
		"app-footer-component.focus.keyboard"
	]);
	expect(
		footerScenarios.map(
			({ capture, maskSelectors, maxDiffPixels, payload, routeId, runner, sourceStateId, snapshotName, threshold }) => ({
				capture,
				maskSelectors,
				maxDiffPixels,
				payload: {
					action: payload.action,
					expectedFocusVisible: payload.expectedFocusVisible,
					expectedKeyboardFocused: payload.expectedKeyboardFocused
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
			capture: { scope: "component", selector: "mat-sidenav-content stark-app-footer.stark-app-footer" },
			maskSelectors: [],
			maxDiffPixels: 0,
			payload: {
				action: { kind: "initial" },
				expectedFocusVisible: false,
				expectedKeyboardFocused: false
			},
			routeId: "app-shell",
			runner: "app-footer-states",
			sourceStateId: "app-footer-component.content.with-links",
			snapshotName: "app-footer-content-with-links.png",
			threshold: 0
		},
		{
			capture: { scope: "component", selector: "mat-sidenav-content stark-app-footer.stark-app-footer" },
			maskSelectors: [],
			maxDiffPixels: 0,
			payload: {
				action: { kind: "initial" },
				expectedFocusVisible: false,
				expectedKeyboardFocused: false
			},
			routeId: "app-shell",
			runner: "app-footer-states",
			sourceStateId: "app-footer-component.focus.rest",
			snapshotName: "app-footer-focus-rest.png",
			threshold: 0
		},
		{
			capture: { scope: "component", selector: "mat-sidenav-content stark-app-footer.stark-app-footer" },
			maskSelectors: [],
			maxDiffPixels: 0,
			payload: {
				action: { kind: "keyboard-tab" },
				expectedFocusVisible: true,
				expectedKeyboardFocused: true
			},
			routeId: "app-shell",
			runner: "app-footer-states",
			sourceStateId: "app-footer-component.focus.keyboard",
			snapshotName: "app-footer-focus-keyboard.png",
			threshold: 0
		}
	]);
	expect(footerScenarios).not.toEqual(
		expect.arrayContaining([expect.objectContaining({ sourceStateId: "app-footer-component.content.without-links" })])
	);
	expect(missingVisualFixtureStates).toContainEqual({
		sourceStateId: "app-footer-component.content.without-links",
		ownerBead: "stark-4sp.4.2",
		status: "missing-fixture",
		rationale: "The pinned legacy shell always configures both footer links."
	});
});

test("runs every Breadcrumb state owned by this bead that the pinned legacy fixture can honestly render", () => {
	const breadcrumbScenarios = executableVisualScenarios.filter(({ surfaceId }) => surfaceId === "breadcrumb-component");
	const breadcrumbSourceStates = sourceBackedStates
		.filter(({ ownerBead, surfaceId }) => surfaceId === "breadcrumb-component" && ownerBead === "stark-4sp.4.2")
		.map(({ id }) => id);

	expect(breadcrumbSourceStates).toEqual([
		"breadcrumb-component.content.empty",
		"breadcrumb-component.content.single",
		"breadcrumb-component.content.nested",
		"breadcrumb-component.focus.rest",
		"breadcrumb-component.focus.keyboard"
	]);
	expect(
		breadcrumbScenarios.map(({ capture, maskSelectors, maxDiffPixels, routeId, runner, sourceStateId, snapshotName, threshold }) => ({
			capture,
			maskSelectors,
			maxDiffPixels,
			routeId,
			runner,
			sourceStateId,
			snapshotName,
			threshold
		}))
	).toEqual([
		{
			capture: { scope: "component", selector: "example-viewer#with-config-input stark-breadcrumb.stark-breadcrumb" },
			maskSelectors: [],
			maxDiffPixels: 0,
			routeId: "breadcrumb",
			runner: "breadcrumb-states",
			sourceStateId: "breadcrumb-component.content.nested",
			snapshotName: "breadcrumb-content-nested.png",
			threshold: 0
		},
		{
			capture: { scope: "component", selector: "example-viewer#with-config-input stark-breadcrumb.stark-breadcrumb" },
			maskSelectors: [],
			maxDiffPixels: 0,
			routeId: "breadcrumb",
			runner: "breadcrumb-states",
			sourceStateId: "breadcrumb-component.focus.rest",
			snapshotName: "breadcrumb-focus-rest.png",
			threshold: 0
		}
	]);
	expect(breadcrumbScenarios.map(({ sourceStateId }) => sourceStateId)).not.toEqual(
		expect.arrayContaining([
			"breadcrumb-component.content.empty",
			"breadcrumb-component.content.single",
			"breadcrumb-component.focus.keyboard"
		])
	);
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

test("fails closed when an owned state loses its explicit fixture disposition", () => {
	const withoutFooterDisposition = missingVisualFixtureStates.filter(
		({ sourceStateId }) => sourceStateId !== "app-footer-component.content.without-links"
	);

	const errors = validate(undefined, undefined, undefined, undefined, withoutFooterDisposition);
	expect(errors).toContain("reviewed baseline requires 22 missing visual fixtures, received 21");
	expect(errors).toContain("app-footer-component.content.without-links must have exactly one executable or missing-fixture disposition");
});

test("runs every Action Bar disclosure requirement with enough scroll checkpoints to expose every action", () => {
	const actionBarScenarios = executableScenariosForRunner("action-bar-disclosure").filter(({ axis }) => axis === "disclosure");
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
			maxDiffPixels: 380,
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
			maxDiffPixels: 260,
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
			maxDiffPixels: 190,
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
			maxDiffPixels: 300,
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
			maxDiffPixels: 225,
			payload: { action: "toggle", expectedVisibleActionLabels: ["Close"], scroll: { kind: "end" } },
			routeId: "action-bar",
			runner: "action-bar-disclosure",
			sourceStateId: "action-bar-component.disclosure.expanded",
			snapshotName: "action-bar-disclosure-expanded-close.png",
			threshold: 0
		}
	]);
});

test("runs every reachable Action Bar content, availability, overlay, and focus state", () => {
	const scenarios = executableScenariosForRunner("action-bar-states");
	expect(scenarios.map(({ sourceStateId }) => sourceStateId)).toEqual([
		"action-bar-component.content.primary-actions",
		"action-bar-component.content.alternative-actions",
		"action-bar-component.content.compact",
		"action-bar-component.availability.enabled",
		"action-bar-component.availability.disabled",
		"action-bar-component.overlay.closed",
		"action-bar-component.overlay.open",
		"action-bar-component.focus.rest",
		"action-bar-component.focus.keyboard"
	]);
	expect(
		scenarios.every(
			({ capture, id, maskSelectors, maxDiffPixels, ownerBead, routeId, threshold }) =>
				capture.scope === "component" &&
				capture.selector !== "body" &&
				maskSelectors.length === 0 &&
				maxDiffPixels === (reviewedVisualDiffBudgets[id] ?? 0) &&
				ownerBead === "stark-4sp.4.2" &&
				routeId === "action-bar" &&
				threshold === 0
		)
	).toBe(true);
	expect(missingVisualFixtureStates).toContainEqual(
		expect.objectContaining({ sourceStateId: "action-bar-component.content.empty", status: "missing-fixture" })
	);
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
			maxDiffPixels: 930,
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
			maxDiffPixels: 1750,
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
			maxDiffPixels: 1950,
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
			maxDiffPixels: 930,
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
			maxDiffPixels: 930,
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

test("fails closed when App Logo focus coverage escapes its audited component boundary", () => {
	const weakened = executableVisualScenarios.map(
		(scenario): ExecutableVisualScenario =>
			scenario.id === "app-logo-focus-keyboard"
				? {
						...scenario,
						payload: { ...scenario.payload, capturePadding: 0, focusTargetSelector: "body > a" }
					}
				: scenario
	);

	expect(validate(undefined, undefined, undefined, weakened)).toContain(
		"app-logo-focus-keyboard does not use the audited App Logo focus selectors and keyboard flow"
	);
});

test("fails closed when App Data coverage escapes its audited fixture", () => {
	const weakened = executableVisualScenarios.map(
		(scenario): ExecutableVisualScenario =>
			scenario.id === "app-data-disclosure-open" ? { ...scenario, capture: { scope: "component", selector: "body" } } : scenario
	);

	expect(validate(undefined, undefined, undefined, weakened)).toContain(
		"app-data-disclosure-open does not use the audited App Data fixture and interaction flow"
	);
});

test("fails closed when App Footer coverage escapes its audited shell component", () => {
	const weakened = executableVisualScenarios.map(
		(scenario): ExecutableVisualScenario =>
			scenario.id === "app-footer-focus-keyboard" ? { ...scenario, capture: { scope: "component", selector: "body" } } : scenario
	);

	expect(validate(undefined, undefined, undefined, weakened)).toContain(
		"app-footer-focus-keyboard does not use the audited App Footer selectors and keyboard flow"
	);
});

test("fails closed when Breadcrumb coverage escapes its audited fixture", () => {
	const weakened = executableVisualScenarios.map(
		(scenario): ExecutableVisualScenario =>
			scenario.id === "breadcrumb-content-nested" ? { ...scenario, capture: { scope: "component", selector: "body" } } : scenario
	);

	expect(validate(undefined, undefined, undefined, weakened)).toContain(
		"breadcrumb-content-nested does not use the audited Breadcrumb fixture"
	);
});

test("fails closed when Minimap coverage escapes its audited fixture", () => {
	const weakened = executableVisualScenarios.map(
		(scenario): ExecutableVisualScenario =>
			scenario.id === "minimap-selection-partially-hidden"
				? { ...scenario, capture: { scope: "component", selector: "body" } }
				: scenario
	);

	expect(validate(undefined, undefined, undefined, weakened)).toContain(
		"minimap-selection-partially-hidden does not use the audited Minimap fixture and interaction flow"
	);
});

test("fails closed when Pagination coverage escapes its audited fixture", () => {
	const weakened = executableVisualScenarios.map(
		(scenario): ExecutableVisualScenario =>
			scenario.id === "pagination-selection-page-size" ? { ...scenario, capture: { scope: "component", selector: "body" } } : scenario
	);

	expect(validate(undefined, undefined, undefined, weakened)).toContain(
		"pagination-selection-page-size does not use the audited Pagination fixture and interaction flow"
	);
});

test("fails closed when Pretty Print coverage escapes its audited fixture", () => {
	const weakened = executableVisualScenarios.map(
		(scenario): ExecutableVisualScenario =>
			scenario.id === "pretty-print-service-content-json"
				? { ...scenario, capture: { scope: "component", selector: "body" } }
				: scenario
	);

	expect(validate(undefined, undefined, undefined, weakened)).toContain(
		"pretty-print-service-content-json does not use the audited Pretty Print fixture and interaction flow"
	);
});

test("fails closed when the App Logo focus runner loses exact ownership", () => {
	const unknownRunner = executableVisualScenarios.map(
		(scenario): ExecutableVisualScenario =>
			scenario.id === "app-logo-focus-rest" ? { ...scenario, runner: "unregistered" as VisualScenarioRunnerId } : scenario
	);

	const errors = validate(undefined, undefined, undefined, unknownRunner);
	expect(errors).toContain("app-logo-focus-rest declares unknown runner unregistered");
	expect(errors).toContain("app-logo-focus runner owns 1 scenarios, expected 2");
});

test("fails closed when the App Data runner loses exact ownership", () => {
	const unknownRunner = executableVisualScenarios.map(
		(scenario): ExecutableVisualScenario =>
			scenario.id === "app-data-focus-rest" ? { ...scenario, runner: "unregistered" as VisualScenarioRunnerId } : scenario
	);

	const errors = validate(undefined, undefined, undefined, unknownRunner);
	expect(errors).toContain("app-data-focus-rest declares unknown runner unregistered");
	expect(errors).toContain("app-data-states runner owns 5 scenarios, expected 6");
});

test("fails closed when the App Footer runner loses exact ownership", () => {
	const unknownRunner = executableVisualScenarios.map(
		(scenario): ExecutableVisualScenario =>
			scenario.id === "app-footer-focus-rest" ? { ...scenario, runner: "unregistered" as VisualScenarioRunnerId } : scenario
	);

	const errors = validate(undefined, undefined, undefined, unknownRunner);
	expect(errors).toContain("app-footer-focus-rest declares unknown runner unregistered");
	expect(errors).toContain("app-footer-states runner owns 2 scenarios, expected 3");
});

test("fails closed when the Breadcrumb runner loses exact ownership", () => {
	const unknownRunner = executableVisualScenarios.map(
		(scenario): ExecutableVisualScenario =>
			scenario.id === "breadcrumb-focus-rest" ? { ...scenario, runner: "unregistered" as VisualScenarioRunnerId } : scenario
	);

	const errors = validate(undefined, undefined, undefined, unknownRunner);
	expect(errors).toContain("breadcrumb-focus-rest declares unknown runner unregistered");
	expect(errors).toContain("breadcrumb-states runner owns 1 scenarios, expected 2");
});

test("fails closed when the Minimap runner loses exact ownership", () => {
	const unknownRunner = executableVisualScenarios.map(
		(scenario): ExecutableVisualScenario =>
			scenario.id === "minimap-focus-rest" ? { ...scenario, runner: "unregistered" as VisualScenarioRunnerId } : scenario
	);

	const errors = validate(undefined, undefined, undefined, unknownRunner);
	expect(errors).toContain("minimap-focus-rest declares unknown runner unregistered");
	expect(errors).toContain("minimap-states runner owns 6 scenarios, expected 7");
});

test("fails closed when the Pagination runner loses exact ownership", () => {
	const unknownRunner = executableVisualScenarios.map(
		(scenario): ExecutableVisualScenario =>
			scenario.id === "pagination-focus-rest" ? { ...scenario, runner: "unregistered" as VisualScenarioRunnerId } : scenario
	);

	const errors = validate(undefined, undefined, undefined, unknownRunner);
	expect(errors).toContain("pagination-focus-rest declares unknown runner unregistered");
	expect(errors).toContain("pagination-states runner owns 8 scenarios, expected 9");
});

test("fails closed when the Pretty Print runner loses exact ownership", () => {
	const unknownRunner = executableVisualScenarios.map(
		(scenario): ExecutableVisualScenario =>
			scenario.id === "pretty-print-component-content-empty"
				? { ...scenario, runner: "unregistered" as VisualScenarioRunnerId }
				: scenario
	);

	const errors = validate(undefined, undefined, undefined, unknownRunner);
	expect(errors).toContain("pretty-print-component-content-empty declares unknown runner unregistered");
	expect(errors).toContain("pretty-print-states runner owns 12 scenarios, expected 13");
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

test("fails closed when executable coverage weakens its reviewed component-only comparison", () => {
	const weakened = executableVisualScenarios.map(
		(scenario): ExecutableVisualScenario =>
			scenario.id === "action-bar-disclosure-expanded-approve"
				? {
						...scenario,
						capture: { scope: "component", selector: "body" },
						maxDiffPixels: 10
					}
				: scenario
	);

	const errors = validate(undefined, undefined, undefined, weakened);
	expect(errors).toContain("action-bar-disclosure-expanded-approve does not use audited Action Bar selectors");
	expect(errors).toContain("action-bar-disclosure-expanded-approve weakens its reviewed unmasked visual comparison");
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
