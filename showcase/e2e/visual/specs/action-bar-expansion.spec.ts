import { expect, stabilizeVisualPage, test } from "../fixtures/visual-test";
import { openRouteFromShowcaseShell, smokeRoute } from "../support/navigation";

for (const viewport of [
	{ width: 1280, height: 720 },
	{ width: 375, height: 812 }
]) {
	test(`Action Bar expansion preserves its controls at ${viewport.width}px`, async ({ page }) => {
		await openRouteFromShowcaseShell(page, smokeRoute);
		await stabilizeVisualPage(page);
		const bar = page.locator("example-viewer#classic-full .stark-action-bar-full");
		const actions = bar.locator("button.stark-action-bar-action");
		const labels = actions.locator(".action-label");
		const toggle = bar.locator("button.extend-action-bar");
		await expect(actions).toHaveCount(4);
		await expect(labels).toHaveCount(0);
		await expect(bar.locator("#classic-full-actionDelete")).toBeDisabled();
		await toggle.click();
		await page.mouse.move(0, 0);
		// The legacy mobile toggle is covered by the header's floating actions.
		// Exercise expansion through the desktop control, then verify the resized layout.
		await page.setViewportSize(viewport);
		await stabilizeVisualPage(page);
		await expect(labels).toHaveCount(4);
		for (const label of await labels.all()) await expect(label).toBeVisible();
		await stabilizeVisualPage(page);
		const layouts = await actions.evaluateAll((buttons) =>
			buttons.map((button) => {
				const icon = button.querySelector("mat-icon svg");
				const label = button.querySelector(".action-label");
				if (!icon || !label) throw new Error("Expanded actions must retain their icon and caption.");
				const buttonBox = button.getBoundingClientRect();
				const iconBox = icon.getBoundingClientRect();
				const labelBox = label.getBoundingClientRect();
				return {
					buttonHeight: buttonBox.height,
					iconWidth: iconBox.width,
					iconHeight: iconBox.height,
					hasCaption: Boolean(label.textContent?.trim()),
					captionFitsButton:
						labelBox.left >= buttonBox.left &&
						labelBox.right <= buttonBox.right &&
						labelBox.top >= buttonBox.top &&
						labelBox.bottom <= buttonBox.bottom
				};
			})
		);
		for (const layout of layouts) {
			expect(layout).toEqual({ buttonHeight: 40, iconWidth: 18, iconHeight: 18, hasCaption: true, captionFitsButton: true });
		}
		await expect(bar.locator("#classic-full-actionDelete")).toBeDisabled();
		await toggle.focus();
		await page.keyboard.press("Space");
		await expect(labels).toHaveCount(0);
		await expect(toggle).toBeFocused();
		expect(
			await actions.evaluateAll((buttons) =>
				buttons.map((button) => {
					const box = button.getBoundingClientRect();
					return { width: box.width, height: box.height };
				})
			)
		).toEqual(Array.from({ length: 4 }, () => ({ width: 40, height: 40 })));
	});
}
