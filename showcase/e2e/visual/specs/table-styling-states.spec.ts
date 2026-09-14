import type { Locator } from "@playwright/test";
import { executableScenariosForRunner, type TableStylingStateScenario } from "../manifests/scenarios";
import { expect, stabilizeVisualPage, test } from "../fixtures/visual-test";
import { openRouteFromShowcaseShell } from "../support/navigation";

const tableRoute = {
	id: "table",
	path: "/demo-ui/table",
	menuTrail: ["menu-stark-ui-components", "menu-stark-ui-components-table"]
} as const;
const columns = ["id", "title", "description"] as const;
type StylingCheckpoint = TableStylingStateScenario["payload"]["checkpoints"][number];
type StylingStyles = TableStylingStateScenario["payload"]["styles"];

async function expectStyles(
	table: Locator,
	checkpoint: StylingCheckpoint,
	styles: StylingStyles,
	hoverRowIndex: number | null
): Promise<void> {
	const expected = {
		headers: columns.map((column) => ({
			column,
			classes: column === "id" ? ["large"] : [],
			style: {
				fontSize: column === "id" ? styles.idFontSize : styles.headerFontSize,
				fontWeight: column === "id" ? styles.idFontWeight : styles.headerFontWeight,
				lineHeight: styles.lineHeight,
				color: styles.headerColor,
				backgroundColor: styles.backgrounds.odd
			}
		})),
		rows: checkpoint.expectedRows.map((row, index) => ({
			classes: [row.rowClass],
			cells: columns.map((column) => ({
				column,
				text: row[column],
				classes: column === "id" ? ["large"] : column === "title" ? [row.titleClass] : [],
				style: {
					fontSize: column === "id" ? styles.idFontSize : styles.bodyFontSize,
					fontWeight: column === "id" ? styles.idFontWeight : styles.bodyFontWeight,
					lineHeight: styles.lineHeight,
					color: column === "title" ? styles.titleColors[row.titleClass] : styles.bodyColor,
					backgroundColor: index === hoverRowIndex ? styles.backgrounds.hover : styles.backgrounds[row.rowClass]
				}
			}))
		}))
	};
	await expect
		.poll(() =>
			table.evaluate((host, hoveredIndex) => {
				const columnNames = ["id", "title", "description"];
				const authoredClasses = ["large", "danger", "warning", "success"];
				const readStyle = (element: Element, resolveDefaultBackground: boolean) => {
					const style = getComputedStyle(element);
					let backgroundColor = style.backgroundColor;
					// Legacy default cells are transparent over white; MDC paints white directly.
					// Only normalize that default. Authored even/hover fills remain direct CSS checks.
					if (resolveDefaultBackground && backgroundColor === "rgba(0, 0, 0, 0)") {
						for (let ancestor = element.parentElement; ancestor; ancestor = ancestor.parentElement) {
							const color = getComputedStyle(ancestor).backgroundColor;
							if (color !== "rgba(0, 0, 0, 0)") {
								backgroundColor = color;
								break;
							}
						}
					}
					return {
						fontSize: style.fontSize,
						fontWeight: style.fontWeight,
						lineHeight: style.lineHeight,
						color: style.color,
						backgroundColor
					};
				};
				const columnName = (element: Element) => columnNames.find((name) => element.classList.contains(`mat-column-${name}`));
				return {
					headers: [...host.querySelectorAll("thead th")].map((header) => ({
						column: columnName(header),
						classes: authoredClasses.filter((name) => header.classList.contains(name)),
						style: readStyle(header, true)
					})),
					rows: [...host.querySelectorAll("tbody tr:not(.expandable-row)")].map((row, index) => ({
						classes: ["even", "odd"].filter((name) => row.classList.contains(name)),
						cells: [...row.querySelectorAll("td")].map((cell) => ({
							column: columnName(cell),
							text: cell.textContent?.trim(),
							classes: authoredClasses.filter((name) => cell.classList.contains(name)),
							style: readStyle(cell, index % 2 === 1 && index !== hoveredIndex)
						}))
					}))
				};
			}, hoverRowIndex)
		)
		.toEqual(expected);
}

async function expectCheckpoint(table: Locator, checkpoint: StylingCheckpoint, width: number): Promise<void> {
	const rows = table.locator("tbody tr:not(.expandable-row)");
	await expect(rows).toHaveCount(checkpoint.expectedRows.length);
	await expect(rows.locator("td.mat-column-id")).toHaveText(checkpoint.expectedRows.map(({ id }) => id));
	const pagination = table.locator("stark-pagination");
	const pageInput = pagination.locator("input");
	await expect(pageInput).toHaveValue(String(checkpoint.expectedPage));
	if (width === 390) {
		await expect(pageInput).toBeHidden();
	} else {
		await expect(pageInput).toBeVisible();
	}
	await expect(pagination.locator(".total-pages")).toHaveText("3");
	for (const [selector, disabled] of [
		[".first-page button", checkpoint.expectedPage === 1],
		[".previous button", checkpoint.expectedPage === 1],
		[".next button", checkpoint.expectedPage === 3],
		[".last-page button", checkpoint.expectedPage === 3]
	] as const) {
		if (disabled) {
			await expect(pagination.locator(selector)).toBeDisabled();
		} else {
			await expect(pagination.locator(selector)).toBeEnabled();
		}
	}
	const sortIcon = table.locator("th.mat-column-id .sort-header mat-icon");
	await expect(sortIcon).toHaveAttribute("svgicon", checkpoint.expectedSort === "desc" ? "arrow-down" : "arrow-up");
	if (checkpoint.expectedSort === "none") {
		await expect(sortIcon).toHaveClass(/(?:^|\s)order-tip(?:\s|$)/u);
	} else {
		await expect(sortIcon).not.toHaveClass(/(?:^|\s)order-tip(?:\s|$)/u);
	}
}

for (const scenario of executableScenariosForRunner("table-styling-states")) {
	test(`visual-${scenario.id}`, async ({ page }) => {
		await openRouteFromShowcaseShell(page, tableRoute);
		await page.setViewportSize(scenario.payload.viewport);
		await stabilizeVisualPage(page);
		const fixture = page.locator(scenario.payload.fixtureSelector);
		const table = fixture.locator("showcase-table-with-custom-styling stark-table");
		const rows = table.locator("tbody tr:not(.expandable-row)");
		const pagination = table.locator("stark-pagination");
		await expect(fixture).toHaveCount(1);
		await expect(table).toHaveCount(1);
		await fixture.scrollIntoViewIfNeeded();
		const filterPaths = table.locator("thead .button-filter mat-icon svg path");
		await expect(filterPaths).toHaveCount(3);
		for (const path of await filterPaths.all()) {
			await expect(path).toBeVisible();
		}
		let previous: StylingCheckpoint | undefined;
		for (const checkpoint of scenario.payload.checkpoints) {
			switch (checkpoint.action) {
				case "next":
					await pagination.locator(".next button").click();
					break;
				case "first":
					await pagination.locator(".first-page button").click();
					break;
				case "sort-id":
					await table.locator("th.mat-column-id .sort-header").click();
					break;
				case "keyboard-last": {
					if (!previous) {
						throw new Error("The keyboard journey must establish its prior page.");
					}
					const input = pagination.locator("input");
					await input.fill(String(checkpoint.expectedPage));
					await expect(input).toBeFocused();
					await expect(rows.locator("td.mat-column-id")).toHaveText(previous.expectedRows.map(({ id }) => id));
					await input.press("Enter");
					await expect(input).toBeFocused();
					break;
				}
			}
			await page.mouse.move(0, 0);
			await expectCheckpoint(table, checkpoint, scenario.payload.viewport.width);
			await expectStyles(table, checkpoint, scenario.payload.styles, null);
			previous = checkpoint;
		}
		const finalCheckpoint = scenario.payload.checkpoints.at(-1)!;
		const capture = page.locator(scenario.capture.selector);
		await expect(capture).toHaveCount(1);
		await capture.scrollIntoViewIfNeeded();
		if (scenario.payload.viewport.width === 390) {
			await capture.evaluate((element) => element.scrollIntoView({ block: "center", inline: "nearest" }));
		}
		await page.mouse.move(0, 0);
		if (scenario.payload.hoverRowIndex !== null) {
			await rows.nth(scenario.payload.hoverRowIndex).hover();
		}
		await stabilizeVisualPage(page);
		const hoveredRows = table.locator("tbody tr:not(.expandable-row):hover");
		await expect(hoveredRows).toHaveCount(scenario.payload.hoverRowIndex === null ? 0 : 1);
		if (scenario.payload.hoverRowIndex !== null) {
			await expect(hoveredRows.locator("td.mat-column-id")).toHaveText(
				finalCheckpoint.expectedRows[scenario.payload.hoverRowIndex].id
			);
		}
		await expectStyles(table, finalCheckpoint, scenario.payload.styles, scenario.payload.hoverRowIndex);
		await expect(capture).toHaveScreenshot(scenario.snapshotName, {
			animations: "disabled",
			caret: "hide",
			mask: scenario.maskSelectors.map((selector) => page.locator(selector)),
			maxDiffPixels: scenario.maxDiffPixels,
			threshold: scenario.threshold
		});
	});
}
