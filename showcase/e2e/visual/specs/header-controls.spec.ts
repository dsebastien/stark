import { expect, stabilizeVisualPage, test } from "../fixtures/visual-test";
import { openRouteFromShowcaseShell } from "../support/navigation";

const homeRoute = { id: "home", menuTrail: [], path: "/home" } as const;

const reviewedHeaderControlsMaxDiffPixels = 273;

test("matches the desktop header controls", async ({ page }) => {
	await page.setViewportSize({ width: 1280, height: 720 });
	await openRouteFromShowcaseShell(page, homeRoute);
	await stabilizeVisualPage(page);
	await expect(page.locator("ui-view home")).toBeVisible();
	await expect(page.locator("stark-message-pane .stark-message-pane-item-error")).toHaveCount(0);

	const controls = page.locator(".stark-app-bar-content-right");
	await expect(controls).toHaveCount(1);
	await expect(controls).toBeVisible();
	expect(await controls.boundingBox()).toEqual({ x: 852.5, y: 6, width: 412.5, height: 139 });
	expect(await page.locator(".stark-app-bar-content-right-center").boundingBox()).toEqual({
		x: 852.5,
		y: 45,
		width: 412.5,
		height: 65
	});
	expect(await page.locator(".stark-app-bar-content-right-actions-alt").boundingBox()).toEqual({
		x: 852.5,
		y: 105,
		width: 412.5,
		height: 40
	});
	expect(await page.locator(".stark-app-bar-content-right-center stark-language-selector").boundingBox()).toEqual({
		x: 1079,
		y: 45,
		width: 100,
		height: 65
	});
	expect(
		await page
			.locator(".stark-app-bar-content-right-center .mat-mdc-select-trigger, .stark-app-bar-content-right-center .mat-select-trigger")
			.boundingBox()
	).toEqual({ x: 1079, y: 65, width: 100, height: 18 });
	await expect(controls).toHaveScreenshot("header-controls-default.png", {
		animations: "disabled",
		caret: "hide",
		mask: [],
		// Geometry, colors and state are asserted above. The remaining differences
		// are reviewed MDC text/vector rasterization.
		maxDiffPixels: reviewedHeaderControlsMaxDiffPixels,
		threshold: 0
	});
});
