import type { Locator, Page } from "@playwright/test";
import { executableScenariosForRunner, type TableEmptyStateScenario } from "../manifests/scenarios";
import { expect, stabilizeVisualPage, test } from "../fixtures/visual-test";
import { openRouteFromShowcaseShell } from "../support/navigation";

const tableRoute = {
	id: "table",
	menuTrail: ["menu-stark-ui-components", "menu-stark-ui-components-table"],
	path: "/demo-ui/table"
} as const;
const overlayContainerSelector = ".cdk-overlay-container";
const filteringClass = /(?:^|\s)filtering(?:\s|$)/u;
const filterEnabledClass = /(?:^|\s)filter-enabled(?:\s|$)/u;
type EmptyPayload = TableEmptyStateScenario["payload"];

async function expectPagination(component: Locator, payload: EmptyPayload, page: number, totalPages: number): Promise<void> {
	const pagination = component.locator("stark-pagination");
	await expect(pagination).toHaveCount(1);
	const pageInput = pagination.locator("input");
	await expect(pageInput).toHaveValue(String(page));
	if (payload.viewport.width === 390) {
		await expect(pageInput).toBeHidden();
	} else {
		await expect(pageInput).toBeVisible();
	}
	await expect(pagination.locator(".total-pages")).toHaveText(String(totalPages));
	for (const [selector, disabled] of [
		[".first-page button", page === 1],
		[".previous button", page === 1],
		[".next button", page === totalPages],
		[".last-page button", page === totalPages]
	] as const) {
		const button = pagination.locator(selector);
		await expect(button).toHaveCount(1);
		if (disabled) {
			await expect(button).toBeDisabled();
		} else {
			await expect(button).toBeEnabled();
		}
	}
}

async function expectCounter(component: Locator, text: string): Promise<void> {
	const counter = component.locator(".stark-table-rows-counter");
	await expect(counter).toHaveCount(1);
	await expect(counter).toHaveText(text);
}

async function expectPopulated(component: Locator, payload: EmptyPayload): Promise<void> {
	const { rowIds, counterText, totalPages } = payload.contract.populated;
	const rows = component.locator("tbody tr");
	await expect(rows).toHaveCount(rowIds.length);
	await expect(rows.locator("td.mat-column-id")).toHaveText([...rowIds]);
	await expectCounter(component, counterText);
	await expectPagination(component, payload, 1, totalPages);
	await expect(component.locator("thead th.filtering")).toHaveCount(0);
	await expect(component.locator(".button-global-filter")).not.toHaveClass(filterEnabledClass);
}

async function filterToNoRows(page: Page, component: Locator, payload: EmptyPayload): Promise<void> {
	const { filter } = payload;
	const filteredHeader = filter.kind === "column" ? component.locator(`thead th.mat-column-${filter.column}`) : undefined;
	if (filteredHeader) {
		await expect(filteredHeader).toHaveCount(1);
		await filteredHeader.locator(".button-filter").click();
	} else {
		await component.locator(".button-global-filter").click();
	}
	const input = page.locator(`${overlayContainerSelector} input[name="${filter.kind === "column" ? "filter" : "global-filter"}"]`);
	await expect(input).toHaveCount(1);
	await expect(input).toBeVisible();
	await input.fill(filter.value);
	await expect(input).toHaveValue(filter.value);
	// The legacy filter field stops keyboard propagation, so Escape cannot close the menu.
	await page.locator(`${overlayContainerSelector} .cdk-overlay-backdrop`).click({ position: { x: 5, y: 5 } });
	await expect(input).toHaveCount(0);
	await expect(page.locator(`${overlayContainerSelector} .cdk-overlay-backdrop`)).toHaveCount(0);

	const globalFilterButton = component.locator(".button-global-filter");
	if (filteredHeader) {
		await expect(filteredHeader).toHaveClass(filteringClass);
		await expect(component.locator("thead th.filtering")).toHaveCount(1);
		await expect(globalFilterButton).not.toHaveClass(filterEnabledClass);
	} else {
		await expect(globalFilterButton).toHaveClass(filterEnabledClass);
		await expect(component.locator("thead th.filtering")).toHaveCount(0);
	}
}

async function expectEmpty(component: Locator, payload: EmptyPayload): Promise<void> {
	const { counterText, page, totalPages } = payload.contract.empty;
	await expect(component.locator("tbody tr")).toHaveCount(0);
	await expect(component.locator("tbody")).toHaveText("");
	for (const column of ["id", "title", "description"] as const) {
		await expect(component.locator(`thead th.mat-column-${column}`)).toBeVisible();
	}
	await expectCounter(component, counterText);
	await expect(component.locator(".stark-table-rows-counter span").first()).toHaveText("0");
	await expectPagination(component, payload, page, totalPages);
}

for (const scenario of executableScenariosForRunner("table-empty-states")) {
	test(`visual-${scenario.id}`, async ({ page }) => {
		await openRouteFromShowcaseShell(page, tableRoute);
		await page.setViewportSize(scenario.payload.viewport);
		await stabilizeVisualPage(page);
		const fixture = page.locator(scenario.payload.fixtureSelector);
		const component = fixture.locator("stark-table");
		await expect(fixture).toHaveCount(1);
		await expect(component).toHaveCount(1);
		await fixture.scrollIntoViewIfNeeded();
		// MatIcon fetches this toolbar asset asynchronously after the table is created.
		await expect(component.locator('.header mat-icon[svgicon="sort"] svg path')).toBeVisible();
		await expectPopulated(component, scenario.payload);

		await filterToNoRows(page, component, scenario.payload);
		await expectEmpty(component, scenario.payload);

		const capture = page.locator(scenario.capture.selector);
		await expect(capture).toHaveCount(1);
		await expect(capture).toBeVisible();
		await capture.scrollIntoViewIfNeeded();
		if (scenario.payload.viewport.width === 390) {
			// Keep the narrow table clear of the Showcase's fixed footer toolbar.
			await capture.evaluate((element) => element.scrollIntoView({ block: "center", inline: "nearest" }));
		}
		await page.mouse.move(0, 0);
		await stabilizeVisualPage(page);
		await expectEmpty(component, scenario.payload);
		await expect(capture).toHaveScreenshot(scenario.snapshotName, {
			animations: "disabled",
			caret: "hide",
			mask: scenario.maskSelectors.map((selector) => page.locator(selector)),
			maxDiffPixels: scenario.maxDiffPixels,
			threshold: scenario.threshold
		});
	});
}
