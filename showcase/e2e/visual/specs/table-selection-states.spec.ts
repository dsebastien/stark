import type { Locator, Page } from "@playwright/test";
import { executableScenariosForRunner, type TableSelectionStateScenario } from "../manifests/scenarios";
import { expect, stabilizeVisualPage, test } from "../fixtures/visual-test";
import { openRouteFromShowcaseShell } from "../support/navigation";

const tableRoute = {
	id: "table",
	menuTrail: ["menu-stark-ui-components", "menu-stark-ui-components-table"],
	path: "/demo-ui/table"
} as const;
type SelectionCheckpoint = TableSelectionStateScenario["payload"]["checkpoints"][number];

async function expectSelection(page: Page, table: Locator, checkpoint: SelectionCheckpoint): Promise<void> {
	const rows = table.locator("tbody tr:not(.expandable-row)");
	await expect(rows).toHaveCount(checkpoint.expectedRowIds.length);
	await expect(rows.locator("td.mat-column-id")).toHaveText([...checkpoint.expectedRowIds]);
	await expect(rows.getByRole("checkbox")).toHaveCount(checkpoint.expectedRowIds.length);
	const selectedRows = rows.filter({ has: page.locator("input:checked") });
	await expect(selectedRows.locator("td.mat-column-id")).toHaveText([...checkpoint.expectedSelectedRowIds]);
	const header = table.locator("thead mat-checkbox").getByRole("checkbox");
	await expect(header).toHaveCount(1);
	await expect(header).toHaveJSProperty("checked", checkpoint.expectedHeaderChecked);
	await expect(header).toHaveJSProperty("indeterminate", checkpoint.expectedHeaderIndeterminate);
	for (const [index, id] of checkpoint.expectedRowIds.entries()) {
		const checkbox = rows.nth(index).getByRole("checkbox");
		await expect(checkbox).toBeEnabled();
		await expect(checkbox).toHaveJSProperty("checked", checkpoint.expectedSelectedRowIds.includes(id));
		await expect(checkbox).toHaveJSProperty("indeterminate", false);
	}
}

async function tabToRowCheckbox(page: Page, fixture: Locator, checkbox: Locator): Promise<void> {
	// A real pointer click establishes the local sequential-focus starting point.
	// The checkbox itself is reached only through native Tab navigation.
	const heading = fixture.locator("stark-table header h1");
	await expect(heading).toHaveCount(1);
	await heading.click();
	for (let attempt = 0; attempt < 60; attempt++) {
		await page.keyboard.press("Tab");
		if (await checkbox.evaluate((element) => element === document.activeElement)) {
			break;
		}
	}
	await expect(checkbox).toBeFocused();
}

for (const scenario of executableScenariosForRunner("table-selection-states")) {
	test(`visual-${scenario.id}`, async ({ page }) => {
		await openRouteFromShowcaseShell(page, tableRoute);
		await page.setViewportSize(scenario.payload.viewport);
		await stabilizeVisualPage(page);
		const fixture = page.locator(scenario.payload.fixtureSelector);
		const table = fixture.locator("table");
		const rows = table.locator("tbody tr:not(.expandable-row)");
		const header = table.locator("thead mat-checkbox");
		const next = fixture.locator("stark-pagination .next button");
		const first = fixture.locator("stark-pagination .first-page button");
		await expect(fixture).toHaveCount(1);
		await fixture.scrollIntoViewIfNeeded();
		await expect(table).toHaveCount(1);
		await expect(table).toBeVisible();

		for (const checkpoint of scenario.payload.checkpoints) {
			const { action } = checkpoint;
			switch (action.kind) {
				case "row-checkbox":
				case "row-space": {
					const row = rows.filter({ has: page.locator("td.mat-column-id", { hasText: new RegExp(`^${action.rowId}$`, "u") }) });
					await expect(row).toHaveCount(1);
					const checkbox = row.getByRole("checkbox");
					if (action.kind === "row-space") {
						await tabToRowCheckbox(page, fixture, checkbox);
						await page.keyboard.press("Space");
						await expect(checkbox).toBeFocused();
					} else {
						await row.locator("mat-checkbox").click();
					}
					break;
				}
				case "header-checkbox":
					await expect(header.getByRole("checkbox")).toBeEnabled();
					await header.click();
					break;
				case "next-page":
					await expect(next).toBeEnabled();
					await next.click();
					break;
				case "first-page":
					await expect(first).toBeEnabled();
					await first.click();
					break;
			}
			await expectSelection(page, table, checkpoint);
			if (checkpoint.page === 3) {
				await expect(next).toBeDisabled();
			} else {
				await expect(next).toBeEnabled();
			}
			if (checkpoint.page === 1) {
				await expect(first).toBeDisabled();
			} else {
				await expect(first).toBeEnabled();
			}
		}

		const capture = page.locator(scenario.capture.selector);
		await expect(capture).toHaveCount(1);
		await expect(capture).toBeVisible();
		await capture.scrollIntoViewIfNeeded();
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
