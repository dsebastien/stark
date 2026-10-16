import type { Locator, Page } from "@playwright/test";
import { executableScenariosForRunner, type TableRowIndexStateScenario } from "../manifests/scenarios";
import { expect, stabilizeVisualPage, test } from "../fixtures/visual-test";
import { openRouteFromShowcaseShell } from "../support/navigation";

const tableRoute = {
	id: "table",
	menuTrail: ["menu-stark-ui-components", "menu-stark-ui-components-table"],
	path: "/demo-ui/table"
} as const;
type RowIndexCheckpoint = TableRowIndexStateScenario["payload"]["checkpoints"][number];

async function expectRowIndexCheckpoint(page: Page, component: Locator, checkpoint: RowIndexCheckpoint): Promise<void> {
	const table = component.locator("stark-table");
	const rows = table.locator("tbody tr:not(.expandable-row)");
	await expect(component.getByRole("checkbox", { name: "Show row index", exact: true })).toHaveJSProperty(
		"checked",
		checkpoint.expectedIndexVisible
	);
	await expect(component.getByRole("checkbox", { name: "Enable selection", exact: true })).toHaveJSProperty(
		"checked",
		checkpoint.expectedSelectionEnabled
	);
	await expect(rows).toHaveCount(checkpoint.expectedIds.length);
	await expect(rows.locator("td.mat-column-id")).toHaveText([...checkpoint.expectedIds]);
	// DOM counts also reject stale helper cells or inputs that were merely hidden.
	await expect(rows.locator("td.mat-column-rowIndex")).toHaveText([...checkpoint.expectedIndices]);
	await expect(rows.locator("input[type=checkbox]")).toHaveCount(checkpoint.expectedSelectionEnabled ? checkpoint.expectedIds.length : 0);
	await expect(rows.filter({ has: page.locator("input:checked") }).locator("td.mat-column-id")).toHaveText([
		...checkpoint.expectedSelectedIds
	]);
	const columnClasses = checkpoint.expectedColumns.map((column) => new RegExp(`(?:^|\\s)mat-column-${column}(?:\\s|$)`, "u"));
	await expect(table.locator("thead th")).toHaveClass(columnClasses);
	for (const row of await rows.all()) {
		await expect(row.locator("td")).toHaveClass(columnClasses);
	}
	const headerCheckbox = table.locator("thead input[type=checkbox]");
	if (checkpoint.expectedHeaderSelection === null) {
		await expect(headerCheckbox).toHaveCount(0);
	} else {
		await expect(headerCheckbox).toHaveCount(1);
		await expect(headerCheckbox).toHaveJSProperty("checked", checkpoint.expectedHeaderSelection.checked);
		await expect(headerCheckbox).toHaveJSProperty("indeterminate", checkpoint.expectedHeaderSelection.indeterminate);
	}
	const idSortIcon = table.locator("th.mat-column-id .sort-header mat-icon");
	await expect(idSortIcon).toHaveAttribute("svgicon", "arrow-up");
	if (checkpoint.expectedIdSorted) {
		await expect(idSortIcon).not.toHaveClass(/(?:^|\s)order-tip(?:\s|$)/u);
	} else {
		await expect(idSortIcon).toHaveClass(/(?:^|\s)order-tip(?:\s|$)/u);
	}
	const pagination = table.locator("stark-pagination");
	await expect(pagination.locator("input")).toHaveValue(String(checkpoint.expectedPage));
	await expect(pagination.locator(".total-pages")).toHaveText("3");
	for (const [selector, disabled] of [
		[".first-page button", checkpoint.expectedPage === 1],
		[".previous button", checkpoint.expectedPage === 1],
		[".next button", checkpoint.expectedPage === 3],
		[".last-page button", checkpoint.expectedPage === 3]
	] as const) {
		const button = pagination.locator(selector);
		if (disabled) {
			await expect(button).toBeDisabled();
		} else {
			await expect(button).toBeEnabled();
		}
	}
}

async function keyboardToggleIndex(page: Page, table: Locator, indexInput: Locator): Promise<void> {
	await table.locator("header h1").click();
	for (let attempt = 0; attempt < 20; attempt++) {
		await page.keyboard.press("Shift+Tab");
		if (await indexInput.evaluate((element) => element === document.activeElement)) {
			break;
		}
	}
	await expect(indexInput).toBeFocused();
	await page.keyboard.press("Space");
	await expect(indexInput).toBeFocused();
}

for (const scenario of executableScenariosForRunner("table-row-index-states")) {
	test(`visual-${scenario.id}`, async ({ page }) => {
		await openRouteFromShowcaseShell(page, tableRoute);
		await page.setViewportSize(scenario.payload.viewport);
		await stabilizeVisualPage(page);
		const fixture = page.locator(scenario.payload.fixtureSelector);
		const component = fixture.locator("showcase-table-with-selection-and-row-index");
		const table = component.locator("stark-table");
		const configHosts = component.locator(":scope > div mat-checkbox");
		const indexHost = configHosts.filter({ hasText: "Show row index" });
		const selectionHost = configHosts.filter({ hasText: "Enable selection" });
		const indexInput = component.getByRole("checkbox", { name: "Show row index", exact: true });
		await expect(fixture).toHaveCount(1);
		await expect(component).toHaveCount(1);
		await expect(table).toHaveCount(1);
		await expect(configHosts).toHaveCount(2);
		await expect(indexHost).toHaveCount(1);
		await expect(selectionHost).toHaveCount(1);
		await fixture.scrollIntoViewIfNeeded();
		await expect(indexHost).toBeVisible();
		await expect(selectionHost).toBeVisible();
		const filterIconPaths = table.locator("thead .button-filter mat-icon svg path");
		await expect(filterIconPaths).toHaveCount(3);
		for (const path of await filterIconPaths.all()) {
			await expect(path).toBeVisible();
		}

		for (const checkpoint of scenario.payload.checkpoints) {
			switch (checkpoint.action) {
				case "next":
					await table.locator("stark-pagination .next button").click();
					break;
				case "first":
					await table.locator("stark-pagination .first-page button").click();
					break;
				case "select-ten":
					await table
						.locator("tbody tr")
						.filter({ has: page.locator("td.mat-column-id", { hasText: /^10$/u }) })
						.locator("mat-checkbox")
						.click();
					break;
				case "sort-id":
					await table.locator("th.mat-column-id .sort-header").click();
					break;
				case "toggle-index":
					await indexHost.click();
					break;
				case "toggle-selection":
					await selectionHost.click();
					break;
				case "keyboard-index":
					await keyboardToggleIndex(page, table, indexInput);
					break;
			}
			await expectRowIndexCheckpoint(page, component, checkpoint);
		}

		const capture = page.locator(scenario.capture.selector);
		await expect(capture).toHaveCount(1);
		await expect(capture).toBeVisible();
		await capture.scrollIntoViewIfNeeded();
		if (scenario.payload.viewport.width === 390) {
			await capture.evaluate((element) => element.scrollIntoView({ block: "center", inline: "nearest" }));
		}
		await page.mouse.move(0, 0);
		await stabilizeVisualPage(page);
		await expect(capture).toHaveScreenshot(scenario.snapshotName, {
			animations: "disabled",
			caret: "hide",
			mask: scenario.maskSelectors.map((selector) => page.locator(selector)),
			maxDiffPixels: scenario.maxDiffPixels,
			threshold: scenario.threshold
		});
	});
}
