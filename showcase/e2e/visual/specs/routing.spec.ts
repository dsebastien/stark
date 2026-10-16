import { expect, test } from "@playwright/test";
import { getVisualTarget } from "../support/oracle";

test("boots into the configured home state and follows a uiSref link", async ({ page }) => {
	await page.goto(".", { waitUntil: "domcontentloaded" });
	await expect(page.locator("stark-app-container").first()).toBeVisible();
	await expect(page).toHaveURL(/\/home(?:[?#]|$)/);
	await expect(page.locator(".custom-homepage-button").first()).toBeVisible();

	await page.locator('a[uiSref="welcome.getting-started"]').click();
	await expect(page).toHaveURL(/\/welcome\/getting-started(?:[?#]|$)/);
	await expect(page.locator("ui-view h1").first()).toBeVisible();
});

test("redirects an unknown candidate URL to the otherwise state", async ({ page }) => {
	test.skip(getVisualTarget() !== "candidate", "the legacy GitHub Pages host cannot serve deep links");

	await page.goto("not-a-known-showcase-state", { waitUntil: "domcontentloaded" });
	await expect(page).toHaveURL(/\/otherwise(?:[?#]|$)/);
	await expect(page.locator("ui-view h1")).toHaveText("404: page missing");
});
