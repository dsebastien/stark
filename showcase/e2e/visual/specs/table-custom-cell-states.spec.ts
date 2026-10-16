import type { Locator } from "@playwright/test";
import { executableScenariosForRunner, type TableCustomCellStateScenario } from "../manifests/scenarios";
import { expect, stabilizeVisualPage, test } from "../fixtures/visual-test";
import { openRouteFromShowcaseShell } from "../support/navigation";

const tableRoute = {
	id: "table",
	path: "/demo-ui/table",
	menuTrail: ["menu-stark-ui-components", "menu-stark-ui-components-table"]
} as const;
const columns = ["id", "cost", "description"] as const;
type CustomCellCheckpoint = TableCustomCellStateScenario["payload"]["checkpoints"][number];
type CustomCellStyles = TableCustomCellStateScenario["payload"]["styles"];

async function expectProjectedCells(table: Locator, checkpoint: CustomCellCheckpoint, styles: CustomCellStyles): Promise<void> {
	const expected = checkpoint.expectedRows.map((row) =>
		columns.map((column, index) => {
			const branch = row.branches[index];
			const tone = column === "cost" ? row.costClass : null;
			const hostStyle = {
				color: tone ? styles[tone] : styles.bodyColor,
				fontSize: styles.fontSize,
				fontStyle: "normal",
				lineHeight: styles.lineHeight
			};
			const childTag = branch === "plain" ? null : branch === "italic" ? "I" : branch === "thumb-up" ? "MAT-ICON" : "SPAN";
			return {
				column,
				text: String(row.tuple[index]),
				classes: tone ? [tone] : [],
				children: ["DIV"],
				style: hostStyle,
				projected: {
					style: hostStyle,
					children: childTag ? [childTag] : [],
					childStyle: childTag
						? {
								...hostStyle,
								color: branch === "blue-span" ? styles.blue : branch === "red-span" ? styles.red : hostStyle.color,
								fontStyle: branch === "italic" ? "italic" : "normal"
							}
						: null,
					icon:
						branch === "thumb-up"
							? { name: "thumb-up", mirrored: true, width: styles.iconSize, height: styles.iconSize, svgs: 1, paths: 1 }
							: null
				}
			};
		})
	);
	await expect
		.poll(() =>
			table.evaluate((host) => {
				const readStyle = (element: Element) => {
					const style = getComputedStyle(element);
					return { color: style.color, fontSize: style.fontSize, fontStyle: style.fontStyle, lineHeight: style.lineHeight };
				};
				return [...host.querySelectorAll("tbody tr:not(.expandable-row)")].map((row) =>
					[...row.querySelectorAll("td")].map((cell) => {
						const projected = cell.querySelector(":scope > div");
						const child = projected?.firstElementChild;
						const icon = projected?.querySelector("mat-icon");
						return {
							column: ["id", "cost", "description"].find((name) => cell.classList.contains(`mat-column-${name}`)),
							text: cell.textContent?.trim(),
							classes: ["danger", "warning", "success"].filter((name) => cell.classList.contains(name)),
							children: [...cell.children].map((element) => element.tagName),
							style: readStyle(cell),
							projected: projected
								? {
										style: readStyle(projected),
										children: [...projected.children].map((element) => element.tagName),
										childStyle: child ? readStyle(child) : null,
										icon: icon
											? {
													name: icon.getAttribute("svgicon"),
													mirrored: icon.classList.contains("mat-icon-rtl-mirror"),
													width: getComputedStyle(icon).width,
													height: getComputedStyle(icon).height,
													svgs: icon.querySelectorAll("svg").length,
													paths: icon.querySelectorAll("svg path").length
												}
											: null
									}
								: null
						};
					})
				);
			})
		)
		.toEqual(expected);
}

async function expectCheckpoint(table: Locator, checkpoint: CustomCellCheckpoint, width: number): Promise<void> {
	const rows = table.locator("tbody tr:not(.expandable-row)");
	await expect(rows).toHaveCount(checkpoint.expectedRows.length);
	await expect(rows.locator("td")).toHaveText(checkpoint.expectedRows.flatMap(({ tuple }) => tuple.map(String)));
	const iconCount = checkpoint.expectedRows.filter(({ branches }) => branches.includes("thumb-up")).length;
	await expect(rows.locator('mat-icon[svgicon="thumb-up"]')).toHaveCount(iconCount);
	const iconPaths = rows.locator('mat-icon[svgicon="thumb-up"] svg path');
	await expect(iconPaths).toHaveCount(iconCount);
	for (const path of await iconPaths.all()) {
		await expect(path).toBeVisible();
	}
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
	for (const column of columns) {
		const active = checkpoint.expectedSort.column === column;
		const icon = table.locator(`th.mat-column-${column} .sort-header mat-icon`);
		await expect(icon).toHaveAttribute("svgicon", active && checkpoint.expectedSort.direction === "desc" ? "arrow-down" : "arrow-up");
		if (active) {
			await expect(icon).not.toHaveClass(/(?:^|\s)order-tip(?:\s|$)/u);
		} else {
			await expect(icon).toHaveClass(/(?:^|\s)order-tip(?:\s|$)/u);
		}
	}
}

for (const scenario of executableScenariosForRunner("table-custom-cell-states")) {
	test(`visual-${scenario.id}`, async ({ page }) => {
		await openRouteFromShowcaseShell(page, tableRoute);
		await page.setViewportSize(scenario.payload.viewport);
		await stabilizeVisualPage(page);
		const fixture = page.locator(scenario.payload.fixtureSelector);
		const table = fixture.locator("showcase-table-with-custom-cell-rendering stark-table");
		const rows = table.locator("tbody tr:not(.expandable-row)");
		const pagination = table.locator("stark-pagination");
		await expect(fixture).toHaveCount(1);
		await expect(table).toHaveCount(1);
		await table.scrollIntoViewIfNeeded();
		const filterPaths = table.locator("thead .button-filter mat-icon svg path");
		await expect(filterPaths).toHaveCount(3);
		for (const path of await filterPaths.all()) {
			await expect(path).toBeVisible();
		}
		let previous: CustomCellCheckpoint | undefined;
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
					await expect(rows.locator("td")).toHaveText(previous.expectedRows.flatMap(({ tuple }) => tuple.map(String)));
					await input.press("Enter");
					await expect(input).toBeFocused();
					break;
				}
			}
			await page.mouse.move(0, 0);
			await expectCheckpoint(table, checkpoint, scenario.payload.viewport.width);
			await expectProjectedCells(table, checkpoint, scenario.payload.styles);
			previous = checkpoint;
		}
		const capture = page.locator(scenario.capture.selector);
		await expect(capture).toHaveCount(1);
		await capture.scrollIntoViewIfNeeded();
		if (scenario.payload.viewport.width === 390) {
			// Center the narrow table clear of the fixed Showcase footer.
			await capture.evaluate((element) => element.scrollIntoView({ block: "center", inline: "nearest" }));
		}
		await page.mouse.move(0, 0);
		await stabilizeVisualPage(page);
		await expect(table.locator("tbody tr:hover")).toHaveCount(0);
		await expect(capture).toHaveScreenshot(scenario.snapshotName, {
			animations: "disabled",
			caret: "hide",
			mask: scenario.maskSelectors.map((selector) => page.locator(selector)),
			maxDiffPixels: scenario.maxDiffPixels,
			threshold: scenario.threshold
		});
	});
}
