import { expect, stabilizeVisualPage, test } from "../fixtures/visual-test";
import { openRouteFromShowcaseShell, type ShowcaseNavigationTarget } from "../support/navigation";

const componentRoutes = [
	{ id: "home", path: "/home", menuTrail: ["menu-home"] },
	{ id: "styleguide-header", path: "/styleguide/app-header", menuTrail: ["menu-style-header"] },
	{ id: "styleguide-button", path: "/styleguide/button", menuTrail: ["menu-style-components-button"] },
	{ id: "styleguide-card", path: "/styleguide/card", menuTrail: ["menu-style-card"] },
	{ id: "styleguide-colors", path: "/styleguide/colors", menuTrail: ["menu-style-colors"] },
	{ id: "styleguide-layout", path: "/styleguide/layout", menuTrail: ["menu-style-layout"] },
	{ id: "styleguide-typography", path: "/styleguide/typography", menuTrail: ["menu-style-typography"] },
	{ id: "action-bar", path: "/demo-ui/action-bar", menuTrail: ["menu-stark-ui-components", "menu-stark-ui-components-action-bar"] },
	{ id: "app-data", path: "/demo-ui/app-data", menuTrail: ["menu-stark-ui-components", "menu-stark-ui-components-app-data"] },
	{ id: "app-footer", path: "/demo-ui/app-footer", menuTrail: ["menu-stark-ui-components", "menu-stark-ui-footer"] },
	{ id: "logout", path: "/demo-ui/logout", menuTrail: ["menu-stark-ui-components", "menu-stark-ui-components-logout"] },
	{ id: "menu", path: "/demo-ui/menu", menuTrail: ["menu-stark-ui-components", "menu-stark-ui-components-menu"] },
	{ id: "sidebar", path: "/demo-ui/sidebar", menuTrail: ["menu-stark-ui-components", "menu-stark-ui-components-sidebar"] },
	{ id: "breadcrumb", path: "/demo-ui/breadcrumb", menuTrail: ["menu-stark-ui-components", "menu-stark-ui-components-breadcrumb"] },
	{ id: "collapsible", path: "/demo-ui/collapsible", menuTrail: ["menu-stark-ui-components", "menu-stark-ui-components-collapsible"] },
	{ id: "date-picker", path: "/demo-ui/date-picker", menuTrail: ["menu-stark-ui-components", "menu-stark-ui-components-date-picker"] },
	{
		id: "date-range-picker",
		path: "/demo-ui/date-range-picker",
		menuTrail: ["menu-stark-ui-components", "menu-stark-ui-components-date-range-picker"]
	},
	{
		id: "date-time-picker",
		path: "/demo-ui/date-time-picker",
		menuTrail: ["menu-stark-ui-components", "menu-stark-ui-components-date-time-picker"]
	},
	{ id: "dialogs", path: "/demo-ui/dialogs", menuTrail: ["menu-stark-ui-components", "menu-stark-ui-components-dialogs"] },
	{ id: "dropdown", path: "/demo-ui/dropdown", menuTrail: ["menu-stark-ui-components", "menu-stark-ui-components-dropdown"] },
	{ id: "generic-search", path: "/demo-ui/generic-search", menuTrail: ["menu-stark-ui-components", "menu-stark-ui-generic-search"] },
	{
		id: "language-selector",
		path: "/demo-ui/language-selector",
		menuTrail: ["menu-stark-ui-components", "menu-stark-ui-components-language-selector"]
	},
	{ id: "message-pane", path: "/demo-ui/message-pane", menuTrail: ["menu-stark-ui-components", "menu-stark-ui-components-message-pane"] },
	{ id: "minimap", path: "/demo-ui/minimap", menuTrail: ["menu-stark-ui-components", "menu-stark-ui-components-minimap"] },
	{ id: "pagination", path: "/demo-ui/pagination", menuTrail: ["menu-stark-ui-components", "menu-stark-ui-components-pagination"] },
	{ id: "pretty-print", path: "/demo-ui/pretty-print", menuTrail: ["menu-stark-ui-components", "menu-stark-ui-components-pretty-print"] },
	{ id: "slider", path: "/demo-ui/slider", menuTrail: ["menu-stark-ui-components", "menu-stark-ui-components-slider"] },
	{ id: "route-search", path: "/demo-ui/route-search", menuTrail: ["menu-stark-ui-components", "menu-stark-ui-components-route-search"] },
	{ id: "table", path: "/demo-ui/table", menuTrail: ["menu-stark-ui-components", "menu-stark-ui-components-table"] },
	{ id: "toast", path: "/demo-ui/toast", menuTrail: ["menu-stark-ui-components", "menu-stark-ui-components-toast"] },
	{
		id: "input-mask-directives",
		path: "/demo-ui/input-mask-directives",
		menuTrail: ["menu-stark-ui-directives", "menu-stark-ui-input-mask"]
	},
	{
		id: "restrict-input-directive",
		path: "/demo-ui/restrict-input-directive",
		menuTrail: ["menu-stark-ui-directives", "menu-stark-ui-restrict-input"]
	},
	{
		id: "transform-input-directive",
		path: "/demo-ui/transform-input-directive",
		menuTrail: ["menu-stark-ui-directives", "menu-stark-ui-transform-input"]
	},
	{
		id: "progress-indicator",
		path: "/demo-ui/progress-indicator",
		menuTrail: ["menu-stark-ui-directives", "menu-stark-ui-progress-indicator"]
	}
] as const satisfies readonly ShowcaseNavigationTarget[];

test.describe("default UI route states", () => {
	for (const route of componentRoutes) {
		test(`${route.id} matches the legacy viewport`, async ({ page }) => {
			await page.setViewportSize({ width: 1280, height: 720 });
			await openRouteFromShowcaseShell(page, route);
			await expect(page.locator("ui-view").first()).toBeVisible();
			await stabilizeVisualPage(page);

			await expect(page).toHaveScreenshot(`route-${route.id}-rest.png`, {
				animations: "disabled",
				caret: "hide",
				// Angular Flex Layout was intentionally removed. Its styleguide copy and
				// menu label differ, while the replacement flex/grid geometry remains
				// checked against the legacy viewport.
				maxDiffPixelRatio: route.id === "styleguide-layout" ? 0.05 : 0.03,
				threshold: 0.2
			});
		});
	}
});
