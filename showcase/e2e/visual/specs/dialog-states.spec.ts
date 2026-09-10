import { expect, stabilizeVisualPage, test } from "../fixtures/visual-test";
import { openRouteFromShowcaseShell } from "../support/navigation";

const dialogsRoute = {
	id: "dialogs",
	menuTrail: ["menu-stark-ui-components", "menu-stark-ui-components-dialogs"],
	path: "/demo-ui/dialogs"
} as const;

test.beforeEach(async ({ page }) => {
	await openRouteFromShowcaseShell(page, dialogsRoute);
	await expect(page.locator("ui-view h1").first()).toBeVisible();
	await stabilizeVisualPage(page);
});

test("alert dialog matches the legacy bounds", async ({ page }) => {
	await page.locator("example-viewer#demo .dialog-demo-content button").first().click();
	const dialog = page.getByRole("dialog");
	await expect(dialog).toBeVisible();
	await stabilizeVisualPage(page);

	const dialogBox = await dialog.boundingBox();
	expect(dialogBox).not.toBeNull();
	if (!dialogBox) {
		throw new Error("Alert dialog must have measurable geometry.");
	}
	expect(dialogBox.x).toBeGreaterThanOrEqual(0);
	expect(dialogBox.y).toBeGreaterThanOrEqual(0);
	expect(dialogBox.x + dialogBox.width).toBeLessThanOrEqual(await page.evaluate(() => window.innerWidth));
	expect(dialogBox.y + dialogBox.height).toBeLessThanOrEqual(await page.evaluate(() => window.innerHeight));
	expect(dialogBox.width).toBeCloseTo(368.875, 2);
	expect(dialogBox.height).toBeCloseTo(170, 0);

	await expect(dialog).toHaveScreenshot("alert-dialog-open.png", {
		animations: "disabled",
		caret: "hide",
		maxDiffPixelRatio: 0.08,
		threshold: 0.2
	});
});

test("alert dialog closes when the user clicks its backdrop", async ({ page }) => {
	await page.locator("example-viewer#demo .dialog-demo-content button").first().click();
	const dialog = page.getByRole("dialog");
	await expect(dialog).toBeVisible();

	const backdrop = page.locator(".cdk-overlay-backdrop");
	await expect(backdrop).toBeVisible();
	await backdrop.click({ position: { x: 2, y: 2 } });

	await expect(dialog).toHaveCount(0);
});
