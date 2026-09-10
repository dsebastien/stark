import { expect, type Page } from "@playwright/test";
import { legacyOracle } from "./oracle";

export const smokeRoute = {
	id: "action-bar",
	menuTrail: ["menu-stark-ui-components", "menu-stark-ui-components-action-bar"],
	path: "/demo-ui/action-bar"
} as const;

/**
 * A small cross-section used to prove that route journeys stay shell-driven.
 * The complete route inventory belongs to the route-manifest task.
 */
export const representativeRoutes = [
	{
		id: "getting-started",
		menuTrail: ["menu-getting-started"],
		path: "/welcome/getting-started"
	},
	smokeRoute,
	{
		id: "styleguide-button",
		menuTrail: ["menu-style-components-button"],
		path: "/styleguide/button"
	},
	{
		id: "route-search",
		menuTrail: ["menu-stark-ui-components", "menu-stark-ui-components-route-search"],
		path: "/demo-ui/route-search"
	},
	{
		id: "rbac-authorization",
		menuTrail: ["menu-stark-rbac-directives", "menu-stark-rbac-authorization"],
		path: "/demo-rbac/authorization-directives"
	}
] as const;

export type ShowcaseNavigationTarget = {
	id: string;
	menuTrail: readonly string[];
	path: string;
};

export type ShowcaseRouteTransition = {
	from: string;
	id: string;
	to: string;
};

function escapeRegExp(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function routePath(url: string): string {
	const parsedUrl = new URL(url);
	const oracleBasePath = new URL(legacyOracle.baseUrl).pathname.replace(/\/$/, "");
	const relativePath = parsedUrl.pathname.startsWith(oracleBasePath)
		? parsedUrl.pathname.slice(oracleBasePath.length) || "/"
		: parsedUrl.pathname;
	return relativePath + parsedUrl.search + parsedUrl.hash;
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
	await expect(page).toHaveURL(/\/home(?:[?#]|$)/);
	await expect(page.locator("ui-view home")).toBeVisible();
	await page.waitForLoadState("networkidle");
	await expect(page.locator("stark-message-pane .stark-message-pane-item-error")).toHaveCount(0);
	await navigateVisibleMenuRoute(page, target);
	await expect(page.locator("stark-message-pane .stark-message-pane-item-error")).toHaveCount(0);
}

async function navigateVisibleMenuRoute(page: Page, target: ShowcaseNavigationTarget): Promise<void> {
	const expectedUrl = new RegExp(`${escapeRegExp(target.path)}(?:[?#]|$)`);
	for (const [index, menuId] of target.menuTrail.entries()) {
		const menuItem = page.locator(`#${menuId}`);
		await expect(menuItem).toBeVisible();

		// Menu groups keep their expansion state while the active route changes. Do not
		// toggle an already-open group: doing so starts the Material expansion animation
		// and can make the next child click race the panel's pointer-event shield.
		const expansionPanel = page.locator(`#${menuId} + mat-expansion-panel`);
		if ((await expansionPanel.count()) > 0) {
			const classes = (await expansionPanel.getAttribute("class"))?.split(/\s+/) ?? [];
			if (!classes.includes("mat-expanded")) {
				await menuItem.click();
				await expect(expansionPanel).toHaveClass(/mat-expanded/);
			}
		} else {
			await menuItem.click();
			if (index === target.menuTrail.length - 1) {
				try {
					await page.waitForURL(expectedUrl, { timeout: 3_000 });
				} catch {
					// The legacy Material expansion panel can swallow the first click while
					// releasing its pointer-event shield. Retry only when no navigation began.
					if (!expectedUrl.test(page.url())) {
						await menuItem.click();
					}
					await page.waitForURL(expectedUrl);
				}
			}
		}
	}

	await expect(page).toHaveURL(expectedUrl);
}

/**
 * Navigates a representative sequence through the visible shell and returns
 * the observed browser URL transitions for attachment to the test report.
 * Direct deep links are intentionally not used: the legacy GitHub Pages host
 * returns its 404 shell for those requests.
 */
export async function recordShellRouteTransitions(
	page: Page,
	targets: readonly ShowcaseNavigationTarget[] = representativeRoutes
): Promise<ShowcaseRouteTransition[]> {
	await page.goto(".", { waitUntil: "domcontentloaded" });
	await expect(page.locator("stark-app-container").first()).toBeVisible();

	const transitions: ShowcaseRouteTransition[] = [];
	for (const target of targets) {
		const from = routePath(page.url());
		await navigateVisibleMenuRoute(page, target);
		transitions.push({
			from,
			id: target.id,
			to: routePath(page.url())
		});
	}

	return transitions;
}
