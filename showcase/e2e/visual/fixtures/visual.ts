import { expect, test as base } from "@playwright/test";
import { openRouteFromShowcaseShell } from "../support/navigation";
import type { VisualComparison } from "../support/visual-manifest";

type VisualFixtures = {
	compareToLegacy: (comparison: VisualComparison) => Promise<void>;
};

export const test = base.extend<VisualFixtures>({
	compareToLegacy: async ({ page }, use) => {
		await use(async (comparison) => {
			await openRouteFromShowcaseShell(page, comparison.route);
			await expect(page.locator("ui-view h1").first()).toBeVisible();
			await page.evaluate(async () => {
				await document.fonts.ready;
			});

			await expect(page).toHaveScreenshot(comparison.snapshotName, {
				animations: "disabled",
				caret: "hide",
				fullPage: true,
				mask: comparison.maskSelectors.map((selector) => page.locator(selector)),
				maxDiffPixels: 0,
				threshold: 0
			});
		});
	}
});
