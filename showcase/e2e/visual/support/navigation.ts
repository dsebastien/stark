import { expect, type Page } from "@playwright/test";

export const smokeRoute = {
	menuTrail: ["menu-stark-ui-components", "menu-stark-ui-components-action-bar"],
	path: "/demo-ui/action-bar"
} as const;

export type ShowcaseNavigationTarget = {
	menuTrail: readonly string[];
	path: string;
};

function escapeRegExp(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Opens a Showcase state through the visible application shell.
 *
 * The legacy GitHub Pages deployment does not serve deep links directly, so
 * browser journeys must start at the shell and use the rendered menu. The
 * same path keeps candidate and legacy journeys behaviorally comparable.
 */
export async function openRouteFromShowcaseShell(page: Page, target: ShowcaseNavigationTarget): Promise<void> {
	await page.goto(".", { waitUntil: "domcontentloaded" });
	await expect(page.locator("stark-app-container").first()).toBeVisible();

	for (const menuId of target.menuTrail) {
		const menuItem = page.locator(`#${menuId}`);
		await expect(menuItem).toBeVisible();
		await menuItem.click();
	}

	await expect(page).toHaveURL(new RegExp(`${escapeRegExp(target.path)}(?:[?#]|$)`));
}
