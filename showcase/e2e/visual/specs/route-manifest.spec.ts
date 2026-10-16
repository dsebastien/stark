import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { expect, test } from "@playwright/test";
import * as ts from "typescript";
import { visualRouteManifest, type VisualRouteScope } from "../manifests/routes";
import { representativeRoutes } from "../support/navigation";

type RouteSource = {
	routeArray: ts.ArrayLiteralExpression;
	scope: VisualRouteScope;
};

type SourceState = {
	abstract: boolean;
	lazy: boolean;
	parent?: string;
	pathSegment: string;
	scope: VisualRouteScope;
	state: string;
};

const sessionConstants = readStringConstants(resolve("../packages/stark-core/src/modules/session/constants/session-states.ts"));

function findTypeScriptFiles(directory: string): string[] {
	return readdirSync(directory, { withFileTypes: true })
		.flatMap((entry) => {
			const entryPath = join(directory, entry.name);
			if (entry.isDirectory()) {
				return findTypeScriptFiles(entryPath);
			}
			return entry.isFile() && entry.name.endsWith(".ts") && !entry.name.endsWith(".spec.ts") && !entry.name.endsWith(".d.ts")
				? [entryPath]
				: [];
		})
		.sort();
}

function parseSource(file: string): ts.SourceFile {
	return ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
}

function findVariableInitializer(sourceFile: ts.SourceFile, variableName: string): ts.Expression | undefined {
	for (const statement of sourceFile.statements) {
		if (!ts.isVariableStatement(statement)) {
			continue;
		}

		for (const declaration of statement.declarationList.declarations) {
			if (ts.isIdentifier(declaration.name) && declaration.name.text === variableName) {
				return declaration.initializer;
			}
		}
	}

	return undefined;
}

function resolveRelativeImport(importingFile: string, moduleSpecifier: string): string {
	if (!moduleSpecifier.startsWith(".")) {
		throw new Error(`Route arrays must be declared in workspace source, received import: ${moduleSpecifier}`);
	}

	const unresolvedPath = resolve(dirname(importingFile), moduleSpecifier);
	const candidates = [`${unresolvedPath}.ts`, join(unresolvedPath, "index.ts")];
	const resolvedPath = candidates.find(existsSync);
	if (!resolvedPath) {
		throw new Error(`Could not resolve route source ${moduleSpecifier} imported by ${importingFile}`);
	}
	return resolvedPath;
}

function findProperty(object: ts.ObjectLiteralExpression, propertyName: string): ts.PropertyAssignment | undefined {
	return object.properties.find(
		(property): property is ts.PropertyAssignment =>
			ts.isPropertyAssignment(property) &&
			((ts.isIdentifier(property.name) && property.name.text === propertyName) ||
				(ts.isStringLiteral(property.name) && property.name.text === propertyName))
	);
}

function findPropertyExpression(object: ts.ObjectLiteralExpression, propertyName: string): ts.Expression | undefined {
	for (const property of object.properties) {
		if (ts.isPropertyAssignment(property)) {
			const name = ts.isIdentifier(property.name) || ts.isStringLiteral(property.name) ? property.name.text : undefined;
			if (name === propertyName) {
				return property.initializer;
			}
		}

		if (ts.isShorthandPropertyAssignment(property) && property.name.text === propertyName) {
			return property.name;
		}
	}

	return undefined;
}

function unwrapExpression(expression: ts.Expression): ts.Expression {
	if (ts.isAsExpression(expression) || ts.isSatisfiesExpression(expression) || ts.isParenthesizedExpression(expression)) {
		return unwrapExpression(expression.expression);
	}
	return expression;
}

type ResolvedExpression = {
	expression: ts.Expression;
	sourceFile: ts.SourceFile;
};

function resolveStaticExpression(
	expression: ts.Expression,
	sourceFile: ts.SourceFile,
	resolving: readonly string[] = []
): ResolvedExpression {
	const unwrappedExpression = unwrapExpression(expression);
	if (!ts.isIdentifier(unwrappedExpression)) {
		return { expression: unwrappedExpression, sourceFile };
	}

	const resolutionKey = `${sourceFile.fileName}#${unwrappedExpression.text}`;
	if (resolving.includes(resolutionKey)) {
		throw new Error(`Circular static route reference: ${[...resolving, resolutionKey].join(" -> ")}`);
	}

	const localInitializer = findVariableInitializer(sourceFile, unwrappedExpression.text);
	if (localInitializer) {
		return resolveStaticExpression(localInitializer, sourceFile, [...resolving, resolutionKey]);
	}

	for (const statement of sourceFile.statements) {
		if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) {
			continue;
		}

		const namedBindings = statement.importClause?.namedBindings;
		if (!namedBindings || !ts.isNamedImports(namedBindings)) {
			continue;
		}

		const importedBinding = namedBindings.elements.find((element) => element.name.text === unwrappedExpression.text);
		if (!importedBinding) {
			continue;
		}

		const importedFile = parseSource(resolveRelativeImport(sourceFile.fileName, statement.moduleSpecifier.text));
		const importedName = importedBinding.propertyName?.text ?? importedBinding.name.text;
		const importedInitializer = findVariableInitializer(importedFile, importedName);
		if (!importedInitializer) {
			throw new Error(`Could not find imported route value ${importedName} in ${importedFile.fileName}`);
		}
		return resolveStaticExpression(importedInitializer, importedFile, [...resolving, resolutionKey]);
	}

	throw new Error(`Could not resolve static route value ${unwrappedExpression.text} in ${sourceFile.fileName}`);
}

function resolveRegisteredRouteArray(expression: ts.Expression, sourceFile: ts.SourceFile): ts.ArrayLiteralExpression {
	const resolved = resolveStaticExpression(expression, sourceFile);
	if (!ts.isArrayLiteralExpression(resolved.expression)) {
		throw new Error(`Expected a statically discoverable states array, received: ${resolved.expression.getText()}`);
	}
	return resolved.expression;
}

function resolveRouterConfig(
	expression: ts.Expression,
	sourceFile: ts.SourceFile
): { expression: ts.ObjectLiteralExpression; sourceFile: ts.SourceFile } {
	const resolved = resolveStaticExpression(expression, sourceFile);
	if (!ts.isObjectLiteralExpression(resolved.expression)) {
		throw new Error(`Expected a statically discoverable UI-Router config, received: ${resolved.expression.getText()}`);
	}
	return resolved;
}

function findRegisteredRouteSources(directory: string, scope: VisualRouteScope): RouteSource[] {
	const sources: RouteSource[] = [];
	const seenArrays = new Set<string>();

	for (const file of findTypeScriptFiles(directory)) {
		const sourceFile = parseSource(file);

		function visit(node: ts.Node): void {
			if (
				ts.isCallExpression(node) &&
				ts.isPropertyAccessExpression(node.expression) &&
				ts.isIdentifier(node.expression.expression) &&
				node.expression.expression.text === "UIRouterModule" &&
				(node.expression.name.text === "forRoot" || node.expression.name.text === "forChild")
			) {
				const options = node.arguments[0];
				if (options) {
					const resolvedConfig = resolveRouterConfig(options, sourceFile);
					const states = findPropertyExpression(resolvedConfig.expression, "states");
					if (states) {
						const routeArray = resolveRegisteredRouteArray(states, resolvedConfig.sourceFile);
						const routeArrayKey = `${routeArray.getSourceFile().fileName}#${routeArray.pos}`;
						if (!seenArrays.has(routeArrayKey)) {
							seenArrays.add(routeArrayKey);
							sources.push({ routeArray, scope });
						}
					}
				}
			}
			ts.forEachChild(node, visit);
		}

		visit(sourceFile);
	}

	return sources;
}

const routeSources: readonly RouteSource[] = [
	...findRegisteredRouteSources(resolve("src/app"), "showcase"),
	...findRegisteredRouteSources(resolve("../packages/stark-ui/src/modules/session-ui"), "session")
];

function readString(expression: ts.Expression, constants: ReadonlyMap<string, string>): string {
	if (ts.isStringLiteralLike(expression)) {
		return expression.text;
	}

	if (ts.isIdentifier(expression)) {
		const value = constants.get(expression.text);
		if (value !== undefined) {
			return value;
		}
	}

	if (ts.isBinaryExpression(expression) && expression.operatorToken.kind === ts.SyntaxKind.PlusToken) {
		return readString(expression.left, constants) + readString(expression.right, constants);
	}

	throw new Error(`Expected a statically discoverable route string, received: ${expression.getText()}`);
}

function readStringConstants(file: string): ReadonlyMap<string, string> {
	const sourceFile = parseSource(file);
	const constants = new Map<string, string>();

	for (const statement of sourceFile.statements) {
		if (!ts.isVariableStatement(statement)) {
			continue;
		}

		for (const declaration of statement.declarationList.declarations) {
			if (ts.isIdentifier(declaration.name) && declaration.initializer) {
				constants.set(declaration.name.text, readString(declaration.initializer, constants));
			}
		}
	}

	return constants;
}

function discoverStates(source: RouteSource): SourceState[] {
	const sourceFile = source.routeArray.getSourceFile();
	return source.routeArray.elements.map((element) => {
		if (!ts.isObjectLiteralExpression(element)) {
			throw new Error(`Expected route object in ${sourceFile.fileName}, received: ${element.getText()}`);
		}

		const name = findProperty(element, "name");
		const url = findProperty(element, "url");
		const parent = findProperty(element, "parent");
		if (!name || !url) {
			throw new Error(`Every visual route declaration must have a name and URL in ${sourceFile.fileName}`);
		}

		return {
			abstract: findProperty(element, "abstract")?.initializer.kind === ts.SyntaxKind.TrueKeyword,
			lazy: findProperty(element, "loadChildren") !== undefined,
			...(parent ? { parent: readString(parent.initializer, sessionConstants) } : {}),
			pathSegment: readString(url.initializer, sessionConstants),
			scope: source.scope,
			state: readString(name.initializer, sessionConstants)
		};
	});
}

function joinRoutePath(parentPath: string, childPath: string): string {
	const parent = parentPath === "/" ? "" : parentPath.replace(/\/$/, "");
	const child = childPath.replace(/^\//, "");
	return `${parent}/${child}` || "/";
}

function discoverConcreteRoutes(): { path: string; scope: VisualRouteScope; state: string }[] {
	const states = routeSources.flatMap(discoverStates);
	const statesByName = new Map(states.map((state) => [state.state, state]));
	const resolvedPaths = new Map<string, string>();

	function resolvePath(state: SourceState, ancestors: readonly string[] = []): string {
		const existingPath = resolvedPaths.get(state.state);
		if (existingPath) {
			return existingPath;
		}
		if (ancestors.includes(state.state)) {
			throw new Error(`Circular route parent chain: ${[...ancestors, state.state].join(" -> ")}`);
		}

		let path: string;
		if (state.pathSegment.startsWith("^")) {
			path = state.pathSegment.slice(1);
		} else {
			const inferredParent = state.state.includes(".") ? state.state.slice(0, state.state.lastIndexOf(".")) : undefined;
			const parent = statesByName.get(state.parent ?? inferredParent ?? "");
			path = parent ? joinRoutePath(resolvePath(parent, [...ancestors, state.state]), state.pathSegment) : state.pathSegment;
		}

		resolvedPaths.set(state.state, path);
		return path;
	}

	return states
		.filter((state) => !state.abstract && !state.lazy)
		.map((state) => ({ path: resolvePath(state), scope: state.scope, state: state.state }))
		.sort((left, right) => left.state.localeCompare(right.state));
}

function duplicates(values: readonly string[]): string[] {
	return [...new Set(values.filter((value, index) => values.indexOf(value) !== index))].sort();
}

test("enumerates exactly 44 Showcase routes and four session routes", () => {
	expect(visualRouteManifest).toHaveLength(48);
	expect(visualRouteManifest.filter(({ scope }) => scope === "showcase")).toHaveLength(44);
	expect(visualRouteManifest.filter(({ scope }) => scope === "session")).toHaveLength(4);
});

test("matches every concrete route declared by the Showcase and session UI sources", () => {
	const manifestRoutes = visualRouteManifest
		.map(({ path, scope, state }) => ({ path, scope, state }))
		.sort((left, right) => left.state.localeCompare(right.state));

	expect(manifestRoutes).toEqual(discoverConcreteRoutes());
});

test("uses unique artifact IDs, state names, and paths", () => {
	expect(duplicates(visualRouteManifest.map(({ id }) => id)), "duplicate route IDs").toEqual([]);
	expect(duplicates(visualRouteManifest.map(({ state }) => state)), "duplicate route states").toEqual([]);
	expect(duplicates(visualRouteManifest.map(({ path }) => path)), "duplicate route paths").toEqual([]);
});

test("keeps the established representative navigation targets in the complete manifest", () => {
	const routesById = new Map(visualRouteManifest.map((route) => [route.id, route]));
	for (const target of representativeRoutes) {
		expect(routesById.get(target.id)?.path, target.id).toBe(target.path);
	}
});

test("discovers registered route arrays independently of their filenames", ({}, testInfo) => {
	const fixtureRoot = testInfo.outputPath("nonstandard-route-source");
	mkdirSync(fixtureRoot, { recursive: true });
	writeFileSync(
		join(fixtureRoot, "feature.module.ts"),
		'import { FEATURE_STATES } from "./feature-state-data";\nUIRouterModule.forChild({ states: FEATURE_STATES });\n'
	);
	writeFileSync(
		join(fixtureRoot, "feature-state-data.ts"),
		'export const FEATURE_STATES = [{ name: "feature.example", url: "^/feature/example", component: ExampleComponent }];\n'
	);

	const discovered = findRegisteredRouteSources(fixtureRoot, "showcase").flatMap(discoverStates);
	expect(discovered.map(({ state }) => state)).toEqual(["feature.example"]);
});

test("discovers route registrations that use an identifier config", ({}, testInfo) => {
	const fixtureRoot = testInfo.outputPath("identifier-router-config");
	mkdirSync(fixtureRoot, { recursive: true });
	writeFileSync(
		join(fixtureRoot, "feature.module.ts"),
		'import { FEATURE_STATES } from "./feature-state-data";\nconst routerConfig = { states: FEATURE_STATES };\nUIRouterModule.forChild(routerConfig);\n'
	);
	writeFileSync(
		join(fixtureRoot, "feature-state-data.ts"),
		'export const FEATURE_STATES = [{ name: "feature.identifier-config", url: "^/feature/identifier-config" }];\n'
	);

	const discovered = findRegisteredRouteSources(fixtureRoot, "showcase").flatMap(discoverStates);
	expect(discovered.map(({ state }) => state)).toEqual(["feature.identifier-config"]);
});

test("discovers route registrations that use a shorthand states property", ({}, testInfo) => {
	const fixtureRoot = testInfo.outputPath("shorthand-states-property");
	mkdirSync(fixtureRoot, { recursive: true });
	writeFileSync(
		join(fixtureRoot, "feature.module.ts"),
		'const states = [{ name: "feature.shorthand", url: "^/feature/shorthand" }];\nUIRouterModule.forChild({ states });\n'
	);

	const discovered = findRegisteredRouteSources(fixtureRoot, "showcase").flatMap(discoverStates);
	expect(discovered.map(({ state }) => state)).toEqual(["feature.shorthand"]);
});
