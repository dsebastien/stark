export type VisualRouteScope = "session" | "showcase";

export type VisualRouteManifestEntry = {
	readonly id: string;
	readonly path: `/${string}`;
	readonly scope: VisualRouteScope;
	readonly state: string;
};

/**
 * Every concrete UI-Router state rendered by the Showcase application.
 * Abstract parent states and lazy-load placeholders are intentionally omitted.
 */
export const visualRouteManifest = [
	{ id: "app-shell", path: "/", scope: "showcase", state: "app" },
	{ id: "home", path: "/home", scope: "showcase", state: "home" },
	{ id: "otherwise", path: "/otherwise", scope: "showcase", state: "otherwise" },
	{ id: "getting-started", path: "/welcome/getting-started", scope: "showcase", state: "welcome.getting-started" },
	{ id: "news", path: "/welcome/news", scope: "showcase", state: "welcome.news" },
	{
		id: "reactive-form-errors",
		path: "/welcome/reactive-form-errors",
		scope: "showcase",
		state: "welcome.reactive-form-errors"
	},
	{ id: "styleguide-button", path: "/styleguide/button", scope: "showcase", state: "styleguide.button" },
	{ id: "styleguide-card", path: "/styleguide/card", scope: "showcase", state: "styleguide.card" },
	{ id: "styleguide-colors", path: "/styleguide/colors", scope: "showcase", state: "styleguide.colors" },
	{ id: "styleguide-header", path: "/styleguide/app-header", scope: "showcase", state: "styleguide.header" },
	{ id: "styleguide-typography", path: "/styleguide/typography", scope: "showcase", state: "styleguide.typography" },
	{ id: "styleguide-layout", path: "/styleguide/layout", scope: "showcase", state: "styleguide.layout" },
	{ id: "action-bar", path: "/demo-ui/action-bar", scope: "showcase", state: "demo-ui.action-bar" },
	{ id: "app-data", path: "/demo-ui/app-data", scope: "showcase", state: "demo-ui.app-data" },
	{ id: "breadcrumb", path: "/demo-ui/breadcrumb", scope: "showcase", state: "demo-ui.breadcrumb" },
	{ id: "collapsible", path: "/demo-ui/collapsible", scope: "showcase", state: "demo-ui.collapsible" },
	{ id: "date-picker", path: "/demo-ui/date-picker", scope: "showcase", state: "demo-ui.date-picker" },
	{ id: "date-range-picker", path: "/demo-ui/date-range-picker", scope: "showcase", state: "demo-ui.date-range-picker" },
	{ id: "date-time-picker", path: "/demo-ui/date-time-picker", scope: "showcase", state: "demo-ui.date-time-picker" },
	{ id: "dialogs", path: "/demo-ui/dialogs", scope: "showcase", state: "demo-ui.dialogs" },
	{ id: "dropdown", path: "/demo-ui/dropdown", scope: "showcase", state: "demo-ui.dropdown" },
	{ id: "generic-search", path: "/demo-ui/generic-search", scope: "showcase", state: "demo-ui.generic-search" },
	{ id: "app-footer", path: "/demo-ui/app-footer", scope: "showcase", state: "demo-ui.app-footer" },
	{
		id: "restrict-input-directive",
		path: "/demo-ui/restrict-input-directive",
		scope: "showcase",
		state: "demo-ui.restrict-input-directive"
	},
	{
		id: "transform-input-directive",
		path: "/demo-ui/transform-input-directive",
		scope: "showcase",
		state: "demo-ui.transform-input-directive"
	},
	{ id: "language-selector", path: "/demo-ui/language-selector", scope: "showcase", state: "demo-ui.language-selector" },
	{ id: "logout", path: "/demo-ui/logout", scope: "showcase", state: "demo-ui.logout" },
	{
		id: "input-mask-directives",
		path: "/demo-ui/input-mask-directives",
		scope: "showcase",
		state: "demo-ui.input-mask-directives"
	},
	{ id: "menu", path: "/demo-ui/menu", scope: "showcase", state: "demo-ui.menu" },
	{ id: "message-pane", path: "/demo-ui/message-pane", scope: "showcase", state: "demo-ui.message-pane" },
	{ id: "minimap", path: "/demo-ui/minimap", scope: "showcase", state: "demo-ui.minimap" },
	{ id: "pagination", path: "/demo-ui/pagination", scope: "showcase", state: "demo-ui.pagination" },
	{ id: "pretty-print", path: "/demo-ui/pretty-print", scope: "showcase", state: "demo-ui.pretty-print" },
	{ id: "progress-indicator", path: "/demo-ui/progress-indicator", scope: "showcase", state: "demo-ui.progress-indicator" },
	{ id: "route-search", path: "/demo-ui/route-search", scope: "showcase", state: "demo-ui.route-search" },
	{ id: "slider", path: "/demo-ui/slider", scope: "showcase", state: "demo-ui.slider" },
	{ id: "sidebar", path: "/demo-ui/sidebar", scope: "showcase", state: "demo-ui.sidebar" },
	{ id: "table", path: "/demo-ui/table", scope: "showcase", state: "demo-ui.table" },
	{ id: "toast", path: "/demo-ui/toast", scope: "showcase", state: "demo-ui.toast" },
	{
		id: "rbac-authorization",
		path: "/demo-rbac/authorization-directives",
		scope: "showcase",
		state: "demo-rbac.authorization-directives"
	},
	{
		id: "rbac-authorization-service",
		path: "/demo-rbac/authorization-service",
		scope: "showcase",
		state: "demo-rbac.authorization-service"
	},
	{
		id: "rbac-protected-page-admin",
		path: "/demo-rbac/protected-page-admin",
		scope: "showcase",
		state: "demo-rbac.protected-page-admin"
	},
	{
		id: "rbac-protected-page-manager",
		path: "/demo-rbac/protected-page-manager",
		scope: "showcase",
		state: "demo-rbac.protected-page-manager"
	},
	{
		id: "rbac-protected-page-super-admin",
		path: "/demo-rbac/protected-page-super-admin",
		scope: "showcase",
		state: "demo-rbac.protected-page-super-admin"
	},
	{ id: "session-login", path: "/starkLogin", scope: "session", state: "starkAppInit.starkLogin" },
	{ id: "session-preloading", path: "/starkPreloading", scope: "session", state: "starkAppInit.starkPreloading" },
	{
		id: "session-expired",
		path: "/starkSessionExpired",
		scope: "session",
		state: "starkAppExit.starkSessionExpired"
	},
	{
		id: "session-logout",
		path: "/starkSessionLogout",
		scope: "session",
		state: "starkAppExit.starkSessionLogout"
	}
] as const satisfies readonly VisualRouteManifestEntry[];

export type VisualRouteId = (typeof visualRouteManifest)[number]["id"];
