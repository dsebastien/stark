import type { VisualRouteId } from "./routes";

export const visualStateAxes = [
	"content",
	"disclosure",
	"availability",
	"validity",
	"async",
	"selection",
	"overlay",
	"focus",
	"responsive"
] as const;

export type VisualStateAxis = (typeof visualStateAxes)[number];
export type VisualSurfaceType = "component" | "directive" | "service";
export type VisualCoverageBeadId =
	| "stark-4sp.4.2"
	| "stark-4sp.4.3"
	| "stark-4sp.4.4"
	| "stark-4sp.4.5"
	| "stark-4sp.4.6"
	| "stark-4sp.4.7"
	| "stark-4sp.4.8"
	| "stark-4sp.4.9"
	| "stark-4sp.4.10"
	| "stark-4sp.4.11"
	| "stark-4sp.4.12"
	| "stark-4sp.4.13"
	| "stark-4sp.4.14"
	| "stark-4sp.4.15";

export type SourceEvidence = {
	readonly path: `${"packages" | "showcase"}/${string}`;
	readonly needle: string;
};

export type ShowcaseIntegration =
	| {
			readonly kind: "mounted";
			readonly routeId: VisualRouteId;
			readonly routeEvidence: SourceEvidence;
			readonly evidence: readonly [SourceEvidence, ...SourceEvidence[]];
	  }
	| {
			readonly kind: "missing";
			readonly ownerBead: VisualCoverageBeadId;
			readonly rationale: string;
	  };

export type VisualSurface = {
	readonly id: string;
	readonly type: VisualSurfaceType;
	readonly symbol: string;
	readonly selector?: string;
	readonly sourcePath: `packages/${string}.ts`;
	readonly source: SourceEvidence;
	readonly showcase: ShowcaseIntegration;
};

const evidence = (path: SourceEvidence["path"], needle: string): SourceEvidence => ({ path, needle });

function mounted(routeId: VisualRouteId, first: SourceEvidence, ...rest: SourceEvidence[]): ShowcaseIntegration {
	const routeEvidence =
		routeId === "app-shell"
			? evidence("showcase/src/app/app.routes.ts", 'name: "app"')
			: routeId === "rbac-authorization-service"
				? evidence("showcase/src/app/demo-rbac/routes.ts", 'name: "demo-rbac.authorization-service"')
				: evidence("showcase/src/app/demo-ui/routes.ts", `name: "demo-ui.${routeId}"`);
	return { kind: "mounted", routeId, routeEvidence, evidence: [first, ...rest] };
}

function missing(ownerBead: VisualCoverageBeadId, rationale: string): ShowcaseIntegration {
	return { kind: "missing", ownerBead, rationale };
}

function component<const Id extends string>(
	id: Id,
	symbol: string,
	selector: string,
	sourcePath: `packages/${string}.ts`,
	showcase: ShowcaseIntegration
): VisualSurface & { readonly id: Id } {
	return { id, type: "component", symbol, selector, sourcePath, source: evidence(sourcePath, `export class ${symbol}`), showcase };
}

function directive<const Id extends string>(
	id: Id,
	symbol: string,
	selector: string,
	sourcePath: `packages/${string}.ts`,
	showcase: ShowcaseIntegration
): VisualSurface & { readonly id: Id } {
	return { id, type: "directive", symbol, selector, sourcePath, source: evidence(sourcePath, `export class ${symbol}`), showcase };
}

function service<const Id extends string>(
	id: Id,
	symbol: string,
	sourcePath: `packages/${string}.ts`,
	showcase: ShowcaseIntegration
): VisualSurface & { readonly id: Id } {
	return { id, type: "service", symbol, sourcePath, source: evidence(sourcePath, `export class ${symbol}`), showcase };
}

const appShell = (needle: string): ShowcaseIntegration => mounted("app-shell", evidence("showcase/src/app/app.component.html", needle));

const componentSurfaces = [
	component(
		"action-bar-component",
		"StarkActionBarComponent",
		"stark-action-bar",
		"packages/stark-ui/src/modules/action-bar/components/action-bar.component.ts",
		mounted(
			"action-bar",
			evidence("showcase/src/app/demo-ui/pages/action-bar/demo-action-bar-page.component.html", "<stark-action-bar")
		)
	),
	component(
		"app-data-component",
		"StarkAppDataComponent",
		"stark-app-data",
		"packages/stark-ui/src/modules/app-data/components/app-data.component.ts",
		mounted("app-data", evidence("showcase/src/app/demo-ui/pages/app-data/demo-app-data-page.component.html", "<stark-app-data"))
	),
	component(
		"app-footer-component",
		"StarkAppFooterComponent",
		"stark-app-footer",
		"packages/stark-ui/src/modules/app-footer/components/app-footer.component.ts",
		appShell("<stark-app-footer")
	),
	component(
		"app-logo-component",
		"StarkAppLogoComponent",
		"stark-app-logo",
		"packages/stark-ui/src/modules/app-logo/components/app-logo.component.ts",
		appShell("<stark-app-logo")
	),
	component(
		"app-logout-component",
		"StarkAppLogoutComponent",
		"stark-app-logout",
		"packages/stark-ui/src/modules/app-logout/components/app-logout.component.ts",
		mounted("logout", evidence("showcase/src/app/demo-ui/pages/logout/demo-logout-page.component.html", "<stark-app-logout"))
	),
	component(
		"app-menu-item-component",
		"StarkAppMenuItemComponent",
		"stark-app-menu-item",
		"packages/stark-ui/src/modules/app-menu/components/app-menu-item.component.ts",
		mounted(
			"menu",
			evidence("showcase/src/app/demo-ui/pages/menu/demo-menu-page.component.html", "<stark-app-menu"),
			evidence("packages/stark-ui/src/modules/app-menu/components/app-menu.component.html", "<stark-app-menu-item")
		)
	),
	component(
		"app-menu-component",
		"StarkAppMenuComponent",
		"stark-app-menu",
		"packages/stark-ui/src/modules/app-menu/components/app-menu.component.ts",
		mounted("menu", evidence("showcase/src/app/demo-ui/pages/menu/demo-menu-page.component.html", "<stark-app-menu"))
	),
	component(
		"app-sidebar-component",
		"StarkAppSidebarComponent",
		"stark-app-sidebar",
		"packages/stark-ui/src/modules/app-sidebar/components/app-sidebar.component.ts",
		appShell("<stark-app-sidebar")
	),
	component(
		"breadcrumb-component",
		"StarkBreadcrumbComponent",
		"stark-breadcrumb",
		"packages/stark-ui/src/modules/breadcrumb/components/breadcrumb.component.ts",
		mounted(
			"breadcrumb",
			evidence("showcase/src/app/demo-ui/pages/breadcrumb/demo-breadcrumb-page.component.html", "<stark-breadcrumb")
		)
	),
	component(
		"collapsible-component",
		"StarkCollapsibleComponent",
		"stark-collapsible",
		"packages/stark-ui/src/modules/collapsible/components/collapsible.component.ts",
		mounted(
			"collapsible",
			evidence("showcase/src/app/demo-ui/pages/collapsible/demo-collapsible-page.component.html", "<stark-collapsible")
		)
	),
	component(
		"date-picker-component",
		"StarkDatePickerComponent",
		"stark-date-picker",
		"packages/stark-ui/src/modules/date-picker/components/date-picker.component.ts",
		mounted(
			"date-picker",
			evidence("showcase/src/app/demo-ui/pages/date-picker/demo-date-picker-page.component.html", "<stark-date-picker")
		)
	),
	component(
		"date-range-picker-component",
		"StarkDateRangePickerComponent",
		"stark-date-range-picker",
		"packages/stark-ui/src/modules/date-range-picker/components/date-range-picker.component.ts",
		mounted(
			"date-range-picker",
			evidence(
				"showcase/src/app/demo-ui/pages/date-range-picker/demo-date-range-picker-page.component.html",
				"<stark-date-range-picker"
			)
		)
	),
	component(
		"date-time-picker-component",
		"StarkDateTimePickerComponent",
		"stark-date-time-picker",
		"packages/stark-ui/src/modules/date-time-picker/components/date-time-picker.component.ts",
		mounted(
			"date-time-picker",
			evidence("showcase/src/app/demo-ui/pages/date-time-picker/demo-date-time-picker-page.html", "<stark-date-time-picker")
		)
	),
	component(
		"alert-dialog-component",
		"StarkAlertDialogComponent",
		"stark-alert-dialog",
		"packages/stark-ui/src/modules/dialogs/components/alert-dialog.component.ts",
		mounted("dialogs", evidence("showcase/src/app/demo-ui/pages/dialogs/dialogs-page.component.ts", ".open<StarkAlertDialogComponent"))
	),
	component(
		"confirm-dialog-component",
		"StarkConfirmDialogComponent",
		"stark-confirm-dialog",
		"packages/stark-ui/src/modules/dialogs/components/confirm-dialog.component.ts",
		mounted(
			"dialogs",
			evidence("showcase/src/app/demo-ui/pages/dialogs/dialogs-page.component.ts", ".open<StarkConfirmDialogComponent")
		)
	),
	component(
		"prompt-dialog-component",
		"StarkPromptDialogComponent",
		"stark-prompt-dialog",
		"packages/stark-ui/src/modules/dialogs/components/prompt-dialog.component.ts",
		mounted("dialogs", evidence("showcase/src/app/demo-ui/pages/dialogs/dialogs-page.component.ts", ".open<StarkPromptDialogComponent"))
	),
	component(
		"dropdown-component",
		"StarkDropdownComponent",
		"stark-dropdown",
		"packages/stark-ui/src/modules/dropdown/components/dropdown.component.ts",
		mounted("dropdown", evidence("showcase/src/app/demo-ui/pages/dropdown/demo-dropdown-page.component.html", "<stark-dropdown"))
	),
	component(
		"generic-search-component",
		"StarkGenericSearchComponent",
		"stark-generic-search",
		"packages/stark-ui/src/modules/generic-search/components/generic-search/generic-search.component.ts",
		mounted(
			"generic-search",
			evidence("showcase/src/app/demo-ui/pages/generic-search/demo-generic-search-page.component.html", "<stark-generic-search")
		)
	),
	component(
		"language-selector-component",
		"StarkLanguageSelectorComponent",
		"stark-language-selector",
		"packages/stark-ui/src/modules/language-selector/components/language-selector.component.ts",
		mounted(
			"language-selector",
			evidence(
				"showcase/src/app/demo-ui/pages/language-selector/demo-language-selector-page.component.html",
				"<stark-language-selector"
			)
		)
	),
	component(
		"message-pane-component",
		"StarkMessagePaneComponent",
		"stark-message-pane",
		"packages/stark-ui/src/modules/message-pane/components/message-pane.component.ts",
		mounted(
			"message-pane",
			evidence("showcase/src/app/app.component.html", "<stark-message-pane"),
			evidence("showcase/src/app/demo-ui/pages/message-pane/demo-message-pane-page.component.html", '(click)="notifyMessages()"')
		)
	),
	component(
		"minimap-component",
		"StarkMinimapComponent",
		"stark-minimap",
		"packages/stark-ui/src/modules/minimap/components/minimap.component.ts",
		mounted("minimap", evidence("showcase/src/app/demo-ui/pages/minimap/demo-minimap-page.component.html", "<stark-minimap"))
	),
	component(
		"pagination-component",
		"StarkPaginationComponent",
		"stark-pagination",
		"packages/stark-ui/src/modules/pagination/components/pagination.component.ts",
		mounted(
			"pagination",
			evidence("showcase/src/app/demo-ui/pages/pagination/demo-pagination-page.component.html", "<stark-pagination")
		)
	),
	component(
		"pretty-print-component",
		"StarkPrettyPrintComponent",
		"stark-pretty-print",
		"packages/stark-ui/src/modules/pretty-print/components/pretty-print.component.ts",
		mounted(
			"pretty-print",
			evidence("showcase/src/app/demo-ui/pages/pretty-print/demo-pretty-print-page.component.html", "<stark-pretty-print")
		)
	),
	component(
		"progress-indicator-component",
		"StarkProgressIndicatorComponent",
		"stark-progress-indicator",
		"packages/stark-ui/src/modules/progress-indicator/components/progress-indicator.component.ts",
		mounted(
			"progress-indicator",
			evidence(
				"showcase/src/app/demo-ui/pages/progress-indicator/demo-progress-indicator-page.component.html",
				"starkProgressIndicator"
			),
			evidence(
				"packages/stark-ui/src/modules/progress-indicator/directives/progress-indicator.directive.ts",
				"createComponent(StarkProgressIndicatorComponent"
			)
		)
	),
	component(
		"route-search-component",
		"StarkRouteSearchComponent",
		"stark-route-search",
		"packages/stark-ui/src/modules/route-search/components/route-search.component.ts",
		mounted(
			"route-search",
			evidence("showcase/src/app/demo-ui/pages/route-search/demo-route-search-page.component.html", "<stark-route-search")
		)
	),
	component(
		"session-card-component",
		"StarkSessionCardComponent",
		"stark-session-card",
		"packages/stark-ui/src/modules/session-ui/components/session-card/session-card.component.ts",
		missing(
			"stark-4sp.4.11",
			"No Showcase-owned template mounts the session card; package session pages alone are not a Showcase fixture."
		)
	),
	component(
		"session-timeout-warning-dialog-component",
		"StarkSessionTimeoutWarningDialogComponent",
		"stark-session-timeout-warning-dialog",
		"packages/stark-ui/src/modules/session-ui/components/session-timeout-warning-dialog/session-timeout-warning-dialog.component.ts",
		missing("stark-4sp.4.11", "The Showcase has no deterministic timeout-warning trigger or fixture.")
	),
	component(
		"login-page-component",
		"StarkLoginPageComponent",
		"stark-login-page",
		"packages/stark-ui/src/modules/session-ui/pages/login/login-page.component.ts",
		missing("stark-4sp.4.11", "The session route exists, but no Showcase-owned source directly mounts the login page component.")
	),
	component(
		"preloading-page-component",
		"StarkPreloadingPageComponent",
		"stark-preloading-page",
		"packages/stark-ui/src/modules/session-ui/pages/preloading/preloading-page.component.ts",
		missing("stark-4sp.4.11", "The session route exists, but no deterministic Showcase preloading fixture is present.")
	),
	component(
		"session-expired-page-component",
		"StarkSessionExpiredPageComponent",
		"stark-session-expired-page",
		"packages/stark-ui/src/modules/session-ui/pages/session-expired/session-expired-page.component.ts",
		missing("stark-4sp.4.11", "The session route exists, but no Showcase-owned source directly mounts the expired page component.")
	),
	component(
		"session-logout-page-component",
		"StarkSessionLogoutPageComponent",
		"stark-session-logout-page",
		"packages/stark-ui/src/modules/session-ui/pages/session-logout/session-logout-page.component.ts",
		missing("stark-4sp.4.11", "The session route exists, but no Showcase-owned source directly mounts the logout page component.")
	),
	component(
		"slider-component",
		"StarkSliderComponent",
		"stark-slider",
		"packages/stark-ui/src/modules/slider/components/slider.component.ts",
		mounted("slider", evidence("showcase/src/app/demo-ui/pages/slider/demo-slider-page.component.html", "<stark-slider"))
	),
	component(
		"table-column-component",
		"StarkTableColumnComponent",
		"stark-table-column",
		"packages/stark-ui/src/modules/table/components/column.component.ts",
		mounted(
			"table",
			evidence("showcase/src/app/demo-ui/components/table-regular/table-regular.component.html", "<stark-table"),
			evidence("packages/stark-ui/src/modules/table/components/table.component.html", "<stark-table-column")
		)
	),
	component(
		"table-multisort-dialog-component",
		"StarkTableMultisortDialogComponent",
		"stark-table-dialog-multisort",
		"packages/stark-ui/src/modules/table/components/dialogs/multisort.component.ts",
		mounted(
			"table",
			evidence("showcase/src/app/demo-ui/components/table-regular/table-regular.component.html", "<stark-table"),
			evidence("packages/stark-ui/src/modules/table/components/table.component.ts", ">(StarkTableMultisortDialogComponent, {")
		)
	),
	component(
		"table-component",
		"StarkTableComponent",
		"stark-table",
		"packages/stark-ui/src/modules/table/components/table.component.ts",
		mounted("table", evidence("showcase/src/app/demo-ui/components/table-regular/table-regular.component.html", "<stark-table"))
	),
	component(
		"toast-notification-component",
		"StarkToastNotificationComponent",
		"stark-toast-notification",
		"packages/stark-ui/src/modules/toast-notification/components/toast-notification.component.ts",
		mounted(
			"toast",
			evidence("showcase/src/app/demo-ui/pages/toast/demo-toast-notification-page.component.ts", "this.toastService.show(toastData)"),
			evidence(
				"packages/stark-ui/src/modules/toast-notification/services/toast-notification.service.ts",
				"openFromComponent(StarkToastNotificationComponent"
			)
		)
	)
] as const;

const directiveSurfaces = [
	directive(
		"email-mask-directive",
		"StarkEmailMaskDirective",
		"[starkEmailMask]",
		"packages/stark-ui/src/modules/input-mask-directives/directives/email-mask.directive.ts",
		mounted(
			"input-mask-directives",
			evidence(
				"showcase/src/app/demo-ui/pages/input-mask-directives/demo-input-mask-directives-page.component.html",
				"starkEmailMask"
			)
		)
	),
	directive(
		"number-mask-directive",
		"StarkNumberMaskDirective",
		"[starkNumberMask]",
		"packages/stark-ui/src/modules/input-mask-directives/directives/number-mask.directive.ts",
		mounted(
			"input-mask-directives",
			evidence(
				"showcase/src/app/demo-ui/pages/input-mask-directives/demo-input-mask-directives-page.component.html",
				"starkNumberMask"
			)
		)
	),
	directive(
		"text-mask-directive",
		"StarkTextMaskDirective",
		"[starkTextMask]",
		"packages/stark-ui/src/modules/input-mask-directives/directives/text-mask.directive.ts",
		mounted(
			"input-mask-directives",
			evidence("showcase/src/app/demo-ui/pages/input-mask-directives/demo-input-mask-directives-page.component.html", "starkTextMask")
		)
	),
	directive(
		"timestamp-mask-directive",
		"StarkTimestampMaskDirective",
		"[starkTimestampMask]",
		"packages/stark-ui/src/modules/input-mask-directives/directives/timestamp-mask.directive.ts",
		mounted(
			"input-mask-directives",
			evidence(
				"showcase/src/app/demo-ui/pages/input-mask-directives/demo-input-mask-directives-page.component.html",
				"starkTimestampMask"
			)
		)
	),
	directive(
		"progress-indicator-directive",
		"StarkProgressIndicatorDirective",
		"[starkProgressIndicator]",
		"packages/stark-ui/src/modules/progress-indicator/directives/progress-indicator.directive.ts",
		mounted(
			"progress-indicator",
			evidence(
				"showcase/src/app/demo-ui/pages/progress-indicator/demo-progress-indicator-page.component.html",
				"starkProgressIndicator"
			)
		)
	),
	directive(
		"restrict-input-directive",
		"StarkRestrictInputDirective",
		"[starkRestrictInput]",
		"packages/stark-ui/src/modules/restrict-input-directive/directives/restrict-input.directive.ts",
		mounted(
			"restrict-input-directive",
			evidence(
				"showcase/src/app/demo-ui/pages/restrict-input-directive/demo-restrict-input-directive-page.component.html",
				"starkRestrictInput"
			)
		)
	),
	directive(
		"svg-view-box-directive",
		"StarkSvgViewBoxDirective",
		"[starkSvgViewBox]",
		"packages/stark-ui/src/modules/svg-view-box/directives/svg-view-box.directive.ts",
		missing("stark-4sp.4.6", "No starkSvgViewBox usage exists under showcase/src; the route previously assigned to it was unrelated.")
	),
	directive(
		"table-expand-detail-directive",
		"StarkTableExpandDetailDirective",
		"[starkTableExpandDetail]",
		"packages/stark-ui/src/modules/table/directives/table-expand-detail.directive.ts",
		mounted(
			"table",
			evidence(
				"showcase/src/app/demo-ui/components/table-with-collapsible-rows/table-with-collapsible-rows.component.html",
				"starkTableExpandDetail"
			)
		)
	),
	directive(
		"table-row-content-directive",
		"StarkTableRowContentDirective",
		"[starkTableRowContent]",
		"packages/stark-ui/src/modules/table/directives/table-row-content.directive.ts",
		mounted(
			"table",
			evidence(
				"showcase/src/app/demo-ui/components/table-with-custom-cell-rendering/table-with-custom-cell-rendering.component.html",
				"starkTableRowContent"
			)
		)
	),
	directive(
		"transform-input-directive",
		"StarkTransformInputDirective",
		"[starkTransformInput]",
		"packages/stark-ui/src/modules/transform-input-directive/directives/transform-input.directive.ts",
		mounted(
			"transform-input-directive",
			evidence(
				"showcase/src/app/demo-ui/pages/transform-input-directive/demo-transform-input-directive-page.component.html",
				"starkTransformInput"
			)
		)
	)
] as const;

const serviceSurfaces = [
	service(
		"app-sidebar-service",
		"StarkAppSidebarServiceImpl",
		"packages/stark-ui/src/modules/app-sidebar/services/app-sidebar.service.ts",
		mounted(
			"sidebar",
			evidence("showcase/src/app/demo-ui/pages/sidebar/demo-sidebar-page.component.ts", "this.sidebarService.openMenu()")
		)
	),
	service(
		"message-pane-service",
		"StarkMessagePaneServiceImpl",
		"packages/stark-ui/src/modules/message-pane/services/message-pane.service.ts",
		mounted(
			"message-pane",
			evidence(
				"showcase/src/app/demo-ui/pages/message-pane/demo-message-pane-page.component.ts",
				"this.starkMessagePaneService.add(["
			)
		)
	),
	service(
		"pretty-print-service",
		"StarkPrettyPrintServiceImpl",
		"packages/stark-ui/src/modules/pretty-print/services/pretty-print.service.ts",
		mounted(
			"pretty-print",
			evidence("showcase/src/app/demo-ui/pages/pretty-print/demo-pretty-print-page.component.html", "<stark-pretty-print"),
			evidence("packages/stark-ui/src/modules/pretty-print/components/pretty-print.component.ts", "this.prettyPrintService.format(")
		)
	),
	service(
		"progress-indicator-service",
		"StarkProgressIndicatorServiceImpl",
		"packages/stark-ui/src/modules/progress-indicator/services/progress-indicator.service.ts",
		mounted(
			"progress-indicator",
			evidence(
				"showcase/src/app/demo-ui/pages/progress-indicator/demo-progress-indicator-page.component.ts",
				"this.progressService.show(this.progressIndicatorConfig.topic)"
			)
		)
	),
	service(
		"toast-notification-service",
		"StarkToastNotificationServiceImpl",
		"packages/stark-ui/src/modules/toast-notification/services/toast-notification.service.ts",
		mounted(
			"toast",
			evidence("showcase/src/app/demo-ui/pages/toast/demo-toast-notification-page.component.ts", "this.toastService.show(toastData)")
		)
	),
	service(
		"rbac-authorization-service",
		"StarkRBACAuthorizationServiceImpl",
		"packages/stark-rbac/src/modules/authorization/services/authorization.service.ts",
		mounted(
			"rbac-authorization-service",
			evidence("showcase/src/app/demo-rbac/services/demo-authorization.service.ts", "extends StarkRBACAuthorizationServiceImpl")
		)
	)
] as const;

export const visualSurfaceManifest = [...componentSurfaces, ...directiveSurfaces, ...serviceSurfaces] as const;
export type VisualSurfaceId = (typeof visualSurfaceManifest)[number]["id"];
