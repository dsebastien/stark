import { expect, stabilizeVisualPage, test } from "../fixtures/visual-test";
import { openRouteFromShowcaseShell, representativeRoutes } from "../support/navigation";

test("preserves the rectangular navigation hover surface", async ({ page }) => {
	await openRouteFromShowcaseShell(page, representativeRoutes[0]);
	await stabilizeVisualPage(page);
	const selected = page.locator("#menu-getting-started");
	await expect(selected).toHaveClass(/active/);
	await selected.hover();
	await expect(selected).toHaveCSS("border-radius", "0px");
});

test("preserves the Getting Started display font and tracking", async ({ page }) => {
	await openRouteFromShowcaseShell(page, representativeRoutes[0]);
	await stabilizeVisualPage(page);
	const title = page.locator(".getting-started-content > div:first-child");
	await expect(title).toHaveCSS("font-family", 'Roboto, "Helvetica Neue", sans-serif');
	await expect(title).toHaveCSS("letter-spacing", "-0.225px");
	await expect(title).toHaveCSS("font-size", "45px");
	await expect(title).toHaveCSS("line-height", "48px");
});
