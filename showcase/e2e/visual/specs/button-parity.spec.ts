import { expect, stabilizeVisualPage, test } from "../fixtures/visual-test";
import { openRouteFromShowcaseShell, representativeRoutes } from "../support/navigation";

const variants = ["basic", "primary", "accent", "warning", "success", "alert", "alternative", "neutral", "white-color", "disabled"];
const iconControls = [
	{ index: 3, buttonSize: 40, iconSize: 24 },
	{ index: 4, buttonSize: 56, iconSize: 24 },
	{ index: 5, buttonSize: 40, iconSize: 24 },
	{ index: 6, buttonSize: 40, iconSize: 18 },
	{ index: 7, buttonSize: 40, iconSize: 18 }
] as const;

for (const viewport of [
	{ width: 1280, height: 720 },
	{ width: 375, height: 812 }
]) {
	test(`keeps button and SVG geometry across variants at ${viewport.width}px`, async ({ page }) => {
		await openRouteFromShowcaseShell(page, representativeRoutes[2]);
		await page.setViewportSize(viewport);
		await stabilizeVisualPage(page);

		for (const variant of variants) {
			const buttons = page.locator(`example-viewer#${variant} .button-row button`);
			await expect(buttons).toHaveCount(8);
			for (const { index, buttonSize, iconSize } of iconControls) {
				const button = buttons.nth(index);
				await button.scrollIntoViewIfNeeded();
				const buttonBox = await button.boundingBox();
				const svgBox = await button.locator("mat-icon svg").boundingBox();
				expect(buttonBox, `${variant} button ${index}`).toMatchObject({ width: buttonSize, height: buttonSize });
				expect(svgBox, `${variant} SVG ${index}`).toMatchObject({ width: iconSize, height: iconSize });
				if (!buttonBox || !svgBox) throw new Error("Visible buttons and SVGs must have measurable bounds.");
				// The legacy inline wrapper and modern flex layout must paint on the same CSS-pixel grid.
				expect(Math.floor(svgBox.x)).toBe(Math.floor(buttonBox.x + (buttonSize - iconSize) / 2));
				expect(Math.floor(svgBox.y)).toBe(Math.floor(buttonBox.y + (buttonSize - iconSize) / 2));
			}
		}
	});
}

test("keeps keyboard traversal and disabled button behavior", async ({ page }) => {
	await openRouteFromShowcaseShell(page, representativeRoutes[2]);
	await stabilizeVisualPage(page);
	const buttons = page.locator("example-viewer#basic .button-row button");
	await buttons.first().focus();
	for (let index = 1; index < 8; index++) {
		await page.keyboard.press("Tab");
		await expect(buttons.nth(index)).toBeFocused();
	}
	await page.keyboard.press("Shift+Tab");
	await expect(buttons.nth(6)).toBeFocused();
	const disabledButtons = page.locator("example-viewer#disabled .button-row button");
	await expect(disabledButtons).toHaveCount(8);
	for (const disabled of await disabledButtons.all()) await expect(disabled).toBeDisabled();
	const lastEnabledButton = page.locator("example-viewer#white-color .button-row button").last();
	await lastEnabledButton.focus();
	await expect(lastEnabledButton).toBeFocused();
	await page.keyboard.press("Tab");
	await expect(page.locator("example-viewer#disabled button:focus")).toHaveCount(0);
});

test("keeps example anchors clickable and keyboard-activatable", async ({ page }) => {
	await openRouteFromShowcaseShell(page, representativeRoutes[2]);
	await stabilizeVisualPage(page);
	const anchor = page.locator("example-viewer#basic a.anchor-link");
	await anchor.click({ trial: true });
	await anchor.focus();
	await expect(anchor).toBeFocused();
	await page.keyboard.press("Enter");
	await expect(page).toHaveURL(/\/styleguide\/button#basic$/);
	await stabilizeVisualPage(page);
});
