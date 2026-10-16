import type { Locator } from "@playwright/test";
import { executableScenariosForRunner, type TableFooterStateScenario } from "../manifests/scenarios";
import { expect, stabilizeVisualPage, test } from "../fixtures/visual-test";
import { openRouteFromShowcaseShell } from "../support/navigation";

const tableRoute = {
	id: "table",
	path: "/demo-ui/table",
	menuTrail: ["menu-stark-ui-components", "menu-stark-ui-components-table"]
} as const;
type FooterCheckpoint = TableFooterStateScenario["payload"]["checkpoints"][number];
type FooterContract = TableFooterStateScenario["payload"]["footer"];

async function expectFooter(table: Locator, contract: FooterContract): Promise<void> {
	const section = table.locator("tfoot");
	const row = section.locator("tr");
	await expect(section).toHaveCount(1);
	await expect(row).toHaveCount(1);
	await expect(section.getByRole("row")).toHaveCount(1);
	await expect(row.getByRole("cell")).toHaveCount(3);
	await expect(row.locator(":scope > td")).toHaveText(contract.cells);
	const expected = {
		rowHeight: contract.styles.rowHeight,
		headerColumns: contract.columns.map((column) => [column]),
		bodyColumns: contract.columns.map((column) => [column]),
		cells: contract.columns.map((column, index) => ({
			columns: [column],
			height: contract.styles.rowHeight,
			headerAligned: true,
			bodyAligned: true,
			style: {
				fontSize: contract.styles.fontSize,
				fontWeight: contract.styles.fontWeight,
				lineHeight: contract.styles.lineHeight,
				color: contract.styles.color,
				padding: contract.styles.padding[index]
			}
		}))
	};
	await expect
		.poll(() =>
			table.evaluate((host) => {
				const footerRow = host.querySelector("tfoot tr");
				const headers = [...host.querySelectorAll("thead th")];
				const body = [...host.querySelectorAll("tbody tr:first-child td")];
				const columnClasses = (element: Element) =>
					[...element.classList].filter((name) => name.startsWith("mat-column-")).map((name) => name.slice("mat-column-".length));
				const aligned = (rect: DOMRect, other: Element | undefined) => {
					const otherRect = other?.getBoundingClientRect();
					return otherRect !== undefined && rect.x === otherRect.x && rect.width === otherRect.width;
				};
				return {
					rowHeight: footerRow?.getBoundingClientRect().height,
					headerColumns: headers.map(columnClasses),
					bodyColumns: body.map(columnClasses),
					cells: [...(footerRow?.querySelectorAll("td") ?? [])].map((cell, index) => {
						const rect = cell.getBoundingClientRect();
						const style = getComputedStyle(cell);
						return {
							columns: columnClasses(cell),
							height: rect.height,
							headerAligned: aligned(rect, headers[index]),
							bodyAligned: aligned(rect, body[index]),
							style: {
								fontSize: style.fontSize,
								fontWeight: style.fontWeight,
								lineHeight: style.lineHeight,
								color: style.color,
								padding: style.padding
							}
						};
					})
				};
			})
		)
		.toEqual(expected);
}

async function expectCheckpoint(table: Locator, checkpoint: FooterCheckpoint, width: number): Promise<void> {
	const rows = table.locator("tbody tr:not(.expandable-row)");
	await expect(rows).toHaveCount(checkpoint.expectedRows.length);
	await expect(rows.locator("td")).toHaveText(checkpoint.expectedRows.flatMap((tuple) => tuple.map(String)));
	const pagination = table.locator("stark-pagination");
	const input = pagination.locator("input");
	await expect(input).toHaveValue(String(checkpoint.expectedPage));
	if (width === 390) {
		await expect(input).toBeHidden();
	} else {
		await expect(input).toBeVisible();
	}
	await expect(pagination.locator(".total-pages")).toHaveText("2");
	for (const [selector, disabled] of [
		[".first-page button", checkpoint.expectedPage === 1],
		[".previous button", checkpoint.expectedPage === 1],
		[".next button", checkpoint.expectedPage === 2],
		[".last-page button", checkpoint.expectedPage === 2]
	] as const) {
		if (disabled) {
			await expect(pagination.locator(selector)).toBeDisabled();
		} else {
			await expect(pagination.locator(selector)).toBeEnabled();
		}
	}
	for (const column of ["id", "cost", "description"]) {
		const active = column === "cost" && checkpoint.expectedSort !== "none";
		const icon = table.locator(`th.mat-column-${column} .sort-header mat-icon`);
		await expect(icon).toHaveAttribute("svgicon", active && checkpoint.expectedSort === "desc" ? "arrow-down" : "arrow-up");
		if (active) {
			await expect(icon).not.toHaveClass(/(?:^|\s)order-tip(?:\s|$)/u);
		} else {
			await expect(icon).toHaveClass(/(?:^|\s)order-tip(?:\s|$)/u);
		}
	}
}

for (const scenario of executableScenariosForRunner("table-footer-states")) {
	test(`visual-${scenario.id}`, async ({ page }) => {
		await openRouteFromShowcaseShell(page, tableRoute);
		await page.setViewportSize(scenario.payload.viewport);
		await stabilizeVisualPage(page);
		const fixture = page.locator(scenario.payload.fixtureSelector);
		const table = fixture.locator("stark-table");
		const rows = table.locator("tbody tr:not(.expandable-row)");
		const pagination = table.locator("stark-pagination");
		await expect(fixture).toHaveCount(1);
		await expect(table).toHaveCount(1);
		await table.scrollIntoViewIfNeeded();
		const regular = page.locator("example-viewer#regular stark-table");
		await expect(regular).toHaveCount(1);
		await expect(regular.locator("tfoot tr")).toHaveCount(0);
		const filterPaths = table.locator("thead .button-filter mat-icon svg path");
		await expect(filterPaths).toHaveCount(3);
		for (const path of await filterPaths.all()) {
			await expect(path).toBeVisible();
		}
		let previous: FooterCheckpoint | undefined;
		for (const checkpoint of scenario.payload.checkpoints) {
			switch (checkpoint.action) {
				case "next":
					await pagination.locator(".next button").click();
					break;
				case "first":
					await pagination.locator(".first-page button").click();
					break;
				case "sort-cost":
					await table.locator("th.mat-column-cost .sort-header").click();
					break;
				case "keyboard-page": {
					if (!previous) {
						throw new Error("The keyboard journey must establish its prior page.");
					}
					const input = pagination.locator("input");
					await input.fill(String(checkpoint.expectedPage));
					await expect(input).toBeFocused();
					await expect(rows.locator("td")).toHaveText(previous.expectedRows.flatMap((tuple) => tuple.map(String)));
					await expectFooter(table, scenario.payload.footer);
					await input.press("Enter");
					await expect(input).toBeFocused();
					break;
				}
			}
			await page.mouse.move(0, 0);
			await expectCheckpoint(table, checkpoint, scenario.payload.viewport.width);
			await expectFooter(table, scenario.payload.footer);
			previous = checkpoint;
		}
		const capture = page.locator(scenario.capture.selector);
		await expect(capture).toHaveCount(1);
		await capture.scrollIntoViewIfNeeded();
		// Center the complete table and footer clear of the fixed Showcase chrome at every width.
		await capture.evaluate((element) => element.scrollIntoView({ block: "center", inline: "nearest" }));
		await page.mouse.move(0, 0);
		await stabilizeVisualPage(page);
		await expect(capture).toBeInViewport({ ratio: 1 });
		await expect(table.locator("tbody tr:hover")).toHaveCount(0);
		await expectFooter(table, scenario.payload.footer);
		await expect(capture).toHaveScreenshot(scenario.snapshotName, {
			animations: "disabled",
			caret: "hide",
			mask: scenario.maskSelectors.map((selector) => page.locator(selector)),
			maxDiffPixels: scenario.maxDiffPixels,
			threshold: scenario.threshold
		});
	});
}
