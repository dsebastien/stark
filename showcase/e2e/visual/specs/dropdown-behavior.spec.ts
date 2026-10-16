import { expect, stabilizeVisualPage, test } from "../fixtures/visual-test";
import { openRouteFromShowcaseShell } from "../support/navigation";

const dropdownRoute = {
	id: "dropdown",
	menuTrail: ["menu-stark-ui-components", "menu-stark-ui-components-dropdown"],
	path: "/demo-ui/dropdown"
} as const;

const languageSelectorRoute = {
	id: "language-selector",
	menuTrail: ["menu-stark-ui-components", "menu-stark-ui-components-language-selector"],
	path: "/demo-ui/language-selector"
} as const;

test("dropdown closes when the user clicks outside it", async ({ page }) => {
	await openRouteFromShowcaseShell(page, dropdownRoute);
	await expect(page.locator("ui-view h1").first()).toBeVisible();
	await stabilizeVisualPage(page);

	const trigger = page.locator("#reactive-form #reactiveFormDropdown");
	await expect(trigger).toBeVisible();
	await trigger.click();

	const panel = page.locator('[role="listbox"]');
	await expect(panel).toBeVisible();
	await expect(trigger).toHaveAttribute("aria-expanded", "true");

	const backdrop = page.locator(".cdk-overlay-backdrop");
	await expect(backdrop).toBeVisible();
	await backdrop.click({ position: { x: 2, y: 2 } });

	await expect(panel).toHaveCount(0);
	await expect(trigger).toHaveAttribute("aria-expanded", "false");
});

test("language selector keeps its configured panel bounds", async ({ page }) => {
	await openRouteFromShowcaseShell(page, languageSelectorRoute);
	await stabilizeVisualPage(page);

	await page.locator("#dropdown [role=combobox]").click();
	const panel = page.locator('[role="listbox"]');
	await expect(panel).toBeVisible();
	await expect(panel).toHaveClass(/stark-dropdown-fixed-panel-width/);
	expect(await panel.boundingBox()).toEqual(expect.objectContaining({ width: 212, height: 127 }));
});
