import { expect } from "@playwright/test";
import { assertShellContentDoesNotOverlapNavigation, test } from "../fixtures/visual";
import { openRouteFromShowcaseShell, smokeRoute } from "../support/navigation";

test("keeps desktop Showcase content beside the open navigation", async ({ page }) => {
	await page.setViewportSize({ width: 1280, height: 720 });
	await openRouteFromShowcaseShell(page, smokeRoute);

	await assertShellContentDoesNotOverlapNavigation(page);
});

test("keeps the Showcase navigation closed in overlay mode below the desktop breakpoint", async ({ page }) => {
	await page.setViewportSize({ width: 1279, height: 720 });
	await page.goto(".", { waitUntil: "domcontentloaded" });
	await expect(page.locator("stark-app-container").first()).toBeVisible();

	const navigation = page.locator("mat-sidenav.stark-app-sidenav-left");
	await expect(navigation).toHaveClass(/mat-drawer-over/);
	await expect(navigation).not.toHaveClass(/mat-drawer-opened/);
	await expect(navigation).not.toBeVisible();
	await expect(page.locator("mat-sidenav-content")).toHaveCSS("margin-left", "0px");
});
