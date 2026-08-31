import type { Page } from "@playwright/test";
import { expect, stabilizeVisualPage, test as base } from "./visual-test";
import { openRouteFromShowcaseShell } from "../support/navigation";
import type { VisualComparison } from "../support/visual-manifest";

type VisualFixtures = {
	compareToLegacy: (comparison: VisualComparison) => Promise<void>;
};

async function assertShellContentDoesNotOverlapNavigation(page: Page): Promise<void> {
	const navigation = page.locator("mat-sidenav.stark-app-sidenav-left");
	const content = page.locator("main.stark-main-container");
	await expect(navigation).toBeVisible();
	await expect(content).toBeVisible();

	const [navigationBox, contentBox] = await Promise.all([navigation.boundingBox(), content.boundingBox()]);
	expect(navigationBox, "the open navigation must have measurable geometry").not.toBeNull();
	expect(contentBox, "the Showcase content must have measurable geometry").not.toBeNull();
	if (!navigationBox || !contentBox) {
		throw new Error("The visible Showcase shell must have measurable navigation and content geometry.");
	}
	expect(contentBox.x, "the Showcase content left edge must start at or beyond the open navigation right edge").toBeGreaterThanOrEqual(
		navigationBox.x + navigationBox.width
	);
}

export const test = base.extend<VisualFixtures>({
	compareToLegacy: async ({ page }, use) => {
		await use(async (comparison) => {
			await openRouteFromShowcaseShell(page, comparison.route);
			await expect(page.locator("ui-view h1").first()).toBeVisible();
			await stabilizeVisualPage(page);

			const screenshotOptions = {
				animations: "disabled",
				caret: "hide",
				mask: comparison.maskSelectors.map((selector) => page.locator(selector)),
				maxDiffPixels: 0,
				threshold: 0
			} as const;

			if (comparison.capture.scope === "page") {
				await assertShellContentDoesNotOverlapNavigation(page);
				await expect(page).toHaveScreenshot(comparison.snapshotName, { ...screenshotOptions, fullPage: true });
				return;
			}

			const component = page.locator(comparison.capture.selector);
			await expect(component, `${comparison.scenarioId} capture selector must resolve exactly once`).toHaveCount(1);
			await expect(component).toBeVisible();
			await expect(component).toHaveScreenshot(comparison.snapshotName, screenshotOptions);
		});
	}
});
