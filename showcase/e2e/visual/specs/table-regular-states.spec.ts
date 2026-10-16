import type { Locator } from "@playwright/test";
import { executableScenariosForRunner, type TableRegularStateScenario } from "../manifests/scenarios";
import { expect, stabilizeVisualPage, test } from "../fixtures/visual-test";
import { openRouteFromShowcaseShell } from "../support/navigation";

const tableRoute = {
	id: "table",
	menuTrail: ["menu-stark-ui-components", "menu-stark-ui-components-table"],
	path: "/demo-ui/table"
} as const;
type RegularCheckpoint = TableRegularStateScenario["payload"]["checkpoints"][number];

async function expectSortIndicators(component: Locator, expected: RegularCheckpoint["expectedSort"]): Promise<void> {
	for (const column of ["id", "title", "description"] as const) {
		const header = component.locator(`th.mat-column-${column} .sort-header`);
		const icon = header.locator("mat-icon");
		const priority = header.locator(".priority");
		await expect(header).toHaveCount(1);
		await expect(icon).toHaveCount(1);
		await expect(icon).toHaveAttribute("svgicon", expected[column].direction === "desc" ? "arrow-down" : "arrow-up");
		if (expected[column].direction === "none") {
			await expect(icon).toHaveClass(/(?:^|\s)order-tip(?:\s|$)/u);
		} else {
			await expect(icon).not.toHaveClass(/(?:^|\s)order-tip(?:\s|$)/u);
		}
		if (expected[column].priority === null) {
			await expect(priority).toHaveCount(0);
		} else {
			await expect(priority).toHaveCount(1);
			await expect(priority).toHaveText(String(expected[column].priority));
		}
	}
}

async function expectRegularCheckpoint(
	component: Locator,
	payload: TableRegularStateScenario["payload"],
	checkpoint: RegularCheckpoint
): Promise<void> {
	const rows = component.locator("tbody tr:not(.expandable-row)");
	await expect(rows).toHaveCount(checkpoint.expectedRowIds.length);
	await expect(rows.locator("td.mat-column-id")).toHaveText([...checkpoint.expectedRowIds]);
	const counter = component.locator(".stark-table-rows-counter");
	await expect(counter).toHaveCount(1);
	await expect(counter).toHaveText(payload.counterText);
	await expect(counter.locator("span").first()).toHaveText(String(payload.totalItems));
	const pagination = component.locator("stark-pagination");
	await expect(pagination).toHaveCount(1);
	const pageInput = pagination.locator("input");
	await expect(pageInput).toHaveValue(String(checkpoint.expectedPage));
	if (payload.viewport.width === 390) {
		await expect(pageInput).toBeHidden();
	} else {
		await expect(pageInput).toBeVisible();
	}
	await expect(pagination.locator(".total-pages")).toHaveText(String(payload.totalPages));
	for (const [selector, disabled] of [
		[".first-page button", checkpoint.expectedPage === 1],
		[".previous button", checkpoint.expectedPage === 1],
		[".next button", checkpoint.expectedPage === payload.totalPages],
		[".last-page button", checkpoint.expectedPage === payload.totalPages]
	] as const) {
		const button = pagination.locator(selector);
		await expect(button).toHaveCount(1);
		if (disabled) {
			await expect(button).toBeDisabled();
		} else {
			await expect(button).toBeEnabled();
		}
	}
	await expectSortIndicators(component, checkpoint.expectedSort);
}

for (const scenario of executableScenariosForRunner("table-regular-states")) {
	test(`visual-${scenario.id}`, async ({ page }) => {
		await openRouteFromShowcaseShell(page, tableRoute);
		await page.setViewportSize(scenario.payload.viewport);
		await stabilizeVisualPage(page);
		const fixture = page.locator(scenario.payload.fixtureSelector);
		const component = fixture.locator("stark-table");
		const pagination = component.locator("stark-pagination");
		const pageInput = pagination.locator("input");
		await expect(fixture).toHaveCount(1);
		await expect(component).toHaveCount(1);
		await fixture.scrollIntoViewIfNeeded();
		// MatIcon fetches this toolbar asset asynchronously after the table is created.
		await expect(component.locator('.header mat-icon[svgicon="sort"] svg path')).toBeVisible();
		let previousCheckpoint: RegularCheckpoint | undefined;
		for (const checkpoint of scenario.payload.checkpoints) {
			const { action } = checkpoint;
			switch (action.kind) {
				case "next":
					await pagination.locator(".next button").click();
					break;
				case "first":
					await pagination.locator(".first-page button").click();
					break;
				case "sort-id":
					await component.locator("th.mat-column-id .sort-header").click();
					break;
				case "sort-title":
					await component.locator("th.mat-column-title .sort-header").click();
					break;
				case "page-input":
					await pageInput.fill(String(action.page));
					await expect(pageInput).toBeFocused();
					if (!previousCheckpoint) {
						throw new Error("The page-input journey must establish its prior page first.");
					}
					await expect(component.locator("tbody td.mat-column-id")).toHaveText([...previousCheckpoint.expectedRowIds]);
					await pageInput.press("Enter");
					await expect(pageInput).toBeFocused();
					break;
			}
			await expectRegularCheckpoint(component, scenario.payload, checkpoint);
			previousCheckpoint = checkpoint;
		}

		const capture = page.locator(scenario.capture.selector);
		await expect(capture).toHaveCount(1);
		await expect(capture).toBeVisible();
		await capture.scrollIntoViewIfNeeded();
		if (scenario.payload.viewport.width === 390) {
			// Center the tall narrow table clear of the Showcase's fixed footer toolbar.
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
