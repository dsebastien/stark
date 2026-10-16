import { expect, stabilizeVisualPage, test } from "../fixtures/visual-test";
import { openRouteFromShowcaseShell } from "../support/navigation";

const homeRoute = { id: "home", menuTrail: [], path: "/home" } as const;

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
		maxDiffPixels: 0,
		threshold: 0
	});
});

test("preserves the header language selector keyboard focus and dismissal", async ({ page }) => {
	await page.setViewportSize({ width: 1280, height: 720 });
	await openRouteFromShowcaseShell(page, homeRoute);
	await stabilizeVisualPage(page);
	const controls = page.locator(".stark-app-bar-content-right");
	const languageSelector = controls.locator("stark-language-selector");
	const language = languageSelector.getByRole("combobox");
	for (let press = 0; press < 20; press++) {
		await page.keyboard.press("Tab");
		if (await language.evaluate((element) => element === document.activeElement)) {
			break;
		}
	}
	await expect(language).toBeFocused();
	await stabilizeVisualPage(page);
	expect(await languageSelector.boundingBox()).toEqual({ x: 1079, y: 45, width: 100, height: 65 });
	await expect(languageSelector).toHaveScreenshot("header-controls-language-focus.png", {
		animations: "disabled",
		caret: "hide",
		mask: [],
		maxDiffPixels: 0,
		threshold: 0
	});
	await page.keyboard.press("Enter");
	await expect(page.getByRole("listbox")).toBeVisible();
	await page.keyboard.press("Escape");
	await expect(page.getByRole("listbox")).toBeHidden();
	await expect(language).toBeFocused();
	await page.keyboard.press("Tab");
	await expect(language).not.toBeFocused();
});
