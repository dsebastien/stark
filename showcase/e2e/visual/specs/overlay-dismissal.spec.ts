import { expect, stabilizeVisualPage, test } from "../fixtures/visual-test";
import { openRouteFromShowcaseShell, type ShowcaseNavigationTarget } from "../support/navigation";

const componentMenu = "menu-stark-ui-components";

async function openRoute(page: import("@playwright/test").Page, id: string): Promise<void> {
	const route = {
		id,
		menuTrail: [componentMenu, `menu-stark-ui-components-${id}`],
		path: `/demo-ui/${id}`
	} satisfies ShowcaseNavigationTarget;
	await openRouteFromShowcaseShell(page, route);
	await expect(page.locator("ui-view h1").first()).toBeVisible();
	await stabilizeVisualPage(page);
}

for (const scenario of [
	{ routeId: "date-picker", fixture: "example-viewer#reactive-form" },
	{ routeId: "date-range-picker", fixture: "example-viewer#ng-model" },
	{ routeId: "date-time-picker", fixture: "example-viewer#reactive-form" }
] as const) {
	test(`${scenario.routeId} calendar closes when the user clicks outside it`, async ({ page }) => {
		await openRoute(page, scenario.routeId);
		const fixture = page.locator(scenario.fixture);
		const trigger = fixture.locator(".mat-datepicker-toggle button").first();
		await expect(trigger).toBeVisible();
		await trigger.click();

		const calendar = page.locator(".mat-datepicker-content");
		await expect(calendar).toBeVisible();
		const backdrop = page.locator(".cdk-overlay-backdrop");
		await expect(backdrop).toBeVisible();
		await backdrop.click({ position: { x: 2, y: 2 } });

		await expect(calendar).toHaveCount(0);
	});
}

test("app-data details close when the user clicks outside them", async ({ page }) => {
	await openRoute(page, "app-data");
	const trigger = page.locator('example-viewer#dropdown stark-app-data button[aria-label="Application Data"]');
	await trigger.click();
	const detail = page.locator(".cdk-overlay-pane .stark-app-data.dropdown-detail");
	await expect(detail).toBeVisible();
	await page.locator(".cdk-overlay-backdrop").click({ position: { x: 2, y: 2 } });
	await expect(detail).toHaveCount(0);
});

test("minimap menu closes when the user clicks outside it", async ({ page }) => {
	await openRoute(page, "minimap");
	const trigger = page.locator("example-viewer#full stark-minimap > button").first();
	await trigger.click();
	const menu = page.locator('.cdk-overlay-pane [role="menu"]:has(.stark-minimap-menu-item)');
	await expect(menu).toBeVisible();
	await page.locator(".cdk-overlay-backdrop").click({ position: { x: 2, y: 2 } });
	await expect(menu).toHaveCount(0);
});
