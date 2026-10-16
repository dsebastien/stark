import { expect, stabilizeVisualPage, test } from "../fixtures/visual-test";
import { openRouteFromShowcaseShell } from "../support/navigation";

const tableRoute = {
	id: "table",
	menuTrail: ["menu-stark-ui-components", "menu-stark-ui-components-table"],
	path: "/demo-ui/table"
} as const;

test("table multisort content stays within its dialog", async ({ page }) => {
	await openRouteFromShowcaseShell(page, tableRoute);
	await expect(page.locator("ui-view h1").first()).toBeVisible();
	await stabilizeVisualPage(page);

	const fixture = page.locator("example-viewer#regular");
	const openButton = fixture.locator('button:has(mat-icon[svgicon="sort"])');
	await expect(openButton).toBeVisible();
	await openButton.click();

	const dialog = page.locator(".stark-table-dialog-multisort-panel-class");
	const content = dialog.locator("stark-table-dialog-multisort");
	await expect(dialog).toBeVisible();
	await expect(content).toBeVisible();
	await stabilizeVisualPage(page);

	const dialogBox = await dialog.boundingBox();
	expect(dialogBox).not.toBeNull();
	if (!dialogBox) {
		throw new Error("Table multisort dialog must have measurable geometry.");
	}
	expect(dialogBox.width).toBe(500);
	expect(dialogBox.height).toBeLessThanOrEqual(340);

	for (const region of [content.locator(".header"), content.locator(".rules"), content.locator("[mat-dialog-actions]")]) {
		const regionBox = await region.boundingBox();
		expect(regionBox).not.toBeNull();
		if (!regionBox) {
			throw new Error("Every table multisort dialog region must have measurable geometry.");
		}
		expect(regionBox.x).toBeGreaterThanOrEqual(dialogBox.x);
		expect(regionBox.y).toBeGreaterThanOrEqual(dialogBox.y);
		expect(regionBox.x + regionBox.width).toBeLessThanOrEqual(dialogBox.x + dialogBox.width);
		expect(regionBox.y + regionBox.height).toBeLessThanOrEqual(dialogBox.y + dialogBox.height);
	}

	for (const control of await content.locator("button, mat-form-field").all()) {
		const controlBox = await control.boundingBox();
		expect(controlBox).not.toBeNull();
		if (!controlBox) {
			throw new Error("Every visible table multisort control must have measurable geometry.");
		}
		expect(controlBox.x).toBeGreaterThanOrEqual(dialogBox.x);
		expect(controlBox.y).toBeGreaterThanOrEqual(dialogBox.y);
		expect(controlBox.x + controlBox.width).toBeLessThanOrEqual(dialogBox.x + dialogBox.width);
		expect(controlBox.y + controlBox.height).toBeLessThanOrEqual(dialogBox.y + dialogBox.height);
	}

	await expect(dialog).toHaveScreenshot("table-multisort-dialog-open.png", {
		animations: "disabled",
		caret: "hide",
		// Bounds and containment are asserted above. Remaining differences are
		// reviewed MDC text, button, border and elevation rasterization.
		maxDiffPixels: 3640,
		threshold: 0
	});
});
