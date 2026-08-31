import { createHash } from "node:crypto";
import type { VisualRouteId, VisualRouteManifestEntry } from "./routes";
import {
	visualStateAxes,
	visualSurfaceManifest,
	type SourceEvidence,
	type VisualCoverageBeadId,
	type VisualStateAxis,
	type VisualSurface,
	type VisualSurfaceId
} from "./surfaces";

export type RequiredState = {
	readonly id: string;
	readonly evidence?: readonly [SourceEvidence, ...SourceEvidence[]];
};

export type StateRequirement = {
	readonly id: string;
	readonly surfaceId: VisualSurfaceId;
	readonly axis: VisualStateAxis;
	readonly status: "required";
	readonly ownerBead: VisualCoverageBeadId;
	readonly description: string;
	readonly evidence: readonly [SourceEvidence, ...SourceEvidence[]];
	readonly states: readonly [RequiredState, RequiredState, ...RequiredState[]];
};

export type StateAxisReview =
	| {
			readonly surfaceId: VisualSurfaceId;
			readonly axis: VisualStateAxis;
			readonly status: "required";
			readonly requirementId: string;
			readonly evidence: readonly [SourceEvidence, ...SourceEvidence[]];
	  }
	| {
			readonly surfaceId: VisualSurfaceId;
			readonly axis: VisualStateAxis;
			readonly status: "reviewed-out";
			readonly rationale: string;
			readonly evidence: readonly [SourceEvidence, ...SourceEvidence[]];
	  };

export type SourceBackedState = {
	readonly id: string;
	readonly status: "required";
	readonly surfaceId: VisualSurfaceId;
	readonly axis: VisualStateAxis;
	readonly state: string;
	readonly ownerBead: VisualCoverageBeadId;
	readonly evidence: readonly [SourceEvidence, ...SourceEvidence[]];
};

export const visualScenarioRunnerIds = ["action-bar-disclosure"] as const;
export type VisualScenarioRunnerId = (typeof visualScenarioRunnerIds)[number];
export type ExecutableVisualCapture = Readonly<{ scope: "page" }> | Readonly<{ scope: "component"; selector: string }>;

export type ExecutableVisualScenarioCore<RunnerId extends VisualScenarioRunnerId, Payload> = {
	readonly id: string;
	readonly sourceStateId: string;
	readonly surfaceId: VisualSurfaceId;
	readonly axis: VisualStateAxis;
	readonly state: string;
	readonly ownerBead: VisualCoverageBeadId;
	readonly routeId: VisualRouteId;
	readonly runner: RunnerId;
	readonly capture: ExecutableVisualCapture;
	readonly snapshotName: `${string}.png`;
	readonly maskSelectors: readonly [];
	readonly maxDiffPixels: 0;
	readonly threshold: 0;
	readonly payload: Payload;
};

export type ActionBarDisclosureScenario = ExecutableVisualScenarioCore<
	"action-bar-disclosure",
	{
		readonly componentSelector: string;
		readonly toggleSelector: string;
		readonly action: "initial" | "toggle";
		readonly expectedExtended: boolean;
		readonly expectedActionLabels: readonly string[];
		readonly expectedVisibleActionLabels: readonly string[];
		readonly scroll: Readonly<{ kind: "offset"; top: number }> | Readonly<{ kind: "end" }>;
	}
> & { readonly capture: Readonly<{ scope: "component"; selector: string }> };

export type ExecutableVisualScenario = ActionBarDisclosureScenario;

const byId = new Map<string, VisualSurface>(visualSurfaceManifest.map((surface) => [surface.id, surface]));
const ev = (path: SourceEvidence["path"], needle: string): SourceEvidence => ({ path, needle });

export const surfaceImplementationOwners: Readonly<Record<VisualSurfaceId, VisualCoverageBeadId>> = {
	"action-bar-component": "stark-4sp.4.2",
	"app-data-component": "stark-4sp.4.2",
	"app-footer-component": "stark-4sp.4.2",
	"app-logo-component": "stark-4sp.4.2",
	"app-logout-component": "stark-4sp.4.3",
	"app-menu-item-component": "stark-4sp.4.3",
	"app-menu-component": "stark-4sp.4.3",
	"app-sidebar-component": "stark-4sp.4.3",
	"breadcrumb-component": "stark-4sp.4.2",
	"collapsible-component": "stark-4sp.4.2",
	"date-picker-component": "stark-4sp.4.4",
	"date-range-picker-component": "stark-4sp.4.4",
	"date-time-picker-component": "stark-4sp.4.4",
	"alert-dialog-component": "stark-4sp.4.7",
	"confirm-dialog-component": "stark-4sp.4.7",
	"prompt-dialog-component": "stark-4sp.4.7",
	"dropdown-component": "stark-4sp.4.5",
	"generic-search-component": "stark-4sp.4.8",
	"language-selector-component": "stark-4sp.4.3",
	"message-pane-component": "stark-4sp.4.7",
	"minimap-component": "stark-4sp.4.2",
	"pagination-component": "stark-4sp.4.2",
	"pretty-print-component": "stark-4sp.4.2",
	"progress-indicator-component": "stark-4sp.4.7",
	"route-search-component": "stark-4sp.4.8",
	"session-card-component": "stark-4sp.4.11",
	"session-timeout-warning-dialog-component": "stark-4sp.4.11",
	"login-page-component": "stark-4sp.4.11",
	"preloading-page-component": "stark-4sp.4.11",
	"session-expired-page-component": "stark-4sp.4.11",
	"session-logout-page-component": "stark-4sp.4.11",
	"slider-component": "stark-4sp.4.5",
	"table-column-component": "stark-4sp.4.9",
	"table-multisort-dialog-component": "stark-4sp.4.10",
	"table-component": "stark-4sp.4.9",
	"toast-notification-component": "stark-4sp.4.7",
	"email-mask-directive": "stark-4sp.4.5",
	"number-mask-directive": "stark-4sp.4.5",
	"text-mask-directive": "stark-4sp.4.5",
	"timestamp-mask-directive": "stark-4sp.4.5",
	"progress-indicator-directive": "stark-4sp.4.7",
	"restrict-input-directive": "stark-4sp.4.5",
	"svg-view-box-directive": "stark-4sp.4.6",
	"table-expand-detail-directive": "stark-4sp.4.10",
	"table-row-content-directive": "stark-4sp.4.9",
	"transform-input-directive": "stark-4sp.4.5",
	"app-sidebar-service": "stark-4sp.4.3",
	"message-pane-service": "stark-4sp.4.7",
	"pretty-print-service": "stark-4sp.4.2",
	"progress-indicator-service": "stark-4sp.4.7",
	"toast-notification-service": "stark-4sp.4.7",
	"rbac-authorization-service": "stark-4sp.4.12"
};

type RequirementId = `${VisualSurfaceId}.${VisualStateAxis}`;

/** Durable bead scopes that intentionally split one surface across implementation suites. */
export const requirementOwnerOverrides = {
	"route-search-component.focus": "stark-4sp.4.3",
	"table-component.availability": "stark-4sp.4.10",
	"table-component.disclosure": "stark-4sp.4.10",
	"table-component.focus": "stark-4sp.4.10",
	"table-component.overlay": "stark-4sp.4.10"
} as const satisfies Partial<Record<RequirementId, VisualCoverageBeadId>>;

function requirementOwner(surfaceId: VisualSurfaceId, axis: VisualStateAxis): VisualCoverageBeadId {
	const requirementId: RequirementId = `${surfaceId}.${axis}`;
	return (
		requirementOwnerOverrides[requirementId as keyof typeof requirementOwnerOverrides] ??
		(axis === "responsive" ? "stark-4sp.4.14" : surfaceImplementationOwners[surfaceId])
	);
}

type StateDefinition = string | RequiredState;

const requiredState = (id: string, ...evidence: [SourceEvidence, ...SourceEvidence[]]): RequiredState => ({ id, evidence });

function states(definitions: readonly StateDefinition[], description: string): [RequiredState, RequiredState, ...RequiredState[]] {
	if (definitions.length < 2) {
		throw new Error(`State requirement ${description} must contain at least two states.`);
	}
	return definitions.map((definition) => (typeof definition === "string" ? { id: definition } : definition)) as [
		RequiredState,
		RequiredState,
		...RequiredState[]
	];
}

function evidenceContract(references: readonly SourceEvidence[]): string[] {
	return references.map(({ path, needle }) => `${path}\u0000${needle}`).sort();
}

/** Stable digest of every reviewed requirement, state, owner and evidence reference. */
export function requirementContractSha256(requirements: readonly StateRequirement[]): string {
	const contracts = requirements
		.map((requirementEntry) => ({
			id: requirementEntry.id,
			surfaceId: requirementEntry.surfaceId,
			axis: requirementEntry.axis,
			status: requirementEntry.status,
			ownerBead: requirementEntry.ownerBead,
			description: requirementEntry.description,
			evidence: evidenceContract(requirementEntry.evidence),
			states: requirementEntry.states
				.map((state) => ({ id: state.id, evidence: evidenceContract(state.evidence ?? []) }))
				.sort((left, right) => left.id.localeCompare(right.id))
		}))
		.sort((left, right) => left.id.localeCompare(right.id));

	return createHash("sha256").update(JSON.stringify(contracts)).digest("hex");
}

function requirement(
	surfaceId: VisualSurfaceId,
	axis: VisualStateAxis,
	stateIds: readonly [StateDefinition, StateDefinition, ...StateDefinition[]],
	needle: string,
	contract: string,
	path?: SourceEvidence["path"]
): StateRequirement {
	const surface = byId.get(surfaceId);
	if (!surface) {
		throw new Error(`Unknown surface ${surfaceId}`);
	}
	return {
		id: `${surfaceId}.${axis}`,
		surfaceId,
		axis,
		status: "required",
		ownerBead: requirementOwner(surfaceId, axis),
		description: contract,
		evidence: [ev(path ?? surface.sourcePath, needle)],
		states: states(stateIds, contract)
	};
}

const r = requirement;
const focus = (surfaceId: VisualSurfaceId, path: SourceEvidence["path"], needle: string): StateRequirement =>
	r(surfaceId, "focus", ["rest", "keyboard"], needle, "Keyboard focus", path);
const responsive = (surfaceId: VisualSurfaceId, path: SourceEvidence["path"], needle: string): StateRequirement =>
	r(surfaceId, "responsive", ["wide", "narrow"], needle, "Responsive layout", path);

/**
 * Source-backed requirements are intentionally not runnable tests. A state
 * becomes executable only after its Showcase fixture, action target and assertion
 * selector have all been audited below.
 */
export const stateRequirements: readonly StateRequirement[] = [
	r(
		"action-bar-component",
		"content",
		["empty", "primary-actions", "alternative-actions", "compact"],
		"public actionBarConfig",
		"Action configuration and mode"
	),
	r("action-bar-component", "disclosure", ["collapsed", "expanded"], "public isExtended = false;", "Full-mode action disclosure"),
	r("action-bar-component", "availability", ["enabled", "disabled"], "if (action.isEnabled)", "Action availability"),
	r(
		"action-bar-component",
		"overlay",
		["closed", "open"],
		'[matMenuTriggerFor]="menu"',
		"Alternative-action menu",
		"packages/stark-ui/src/modules/action-bar/components/action-bar.component.html"
	),
	r("app-data-component", "content", ["dropdown", "menu"], "public mode?: StarkAppDataComponentMode", "App-data presentation mode"),
	r(
		"app-data-component",
		"disclosure",
		["closed", "open"],
		"dropdownDetailTrigger.menuOpen",
		"App-data details",
		"packages/stark-ui/src/modules/app-data/components/app-data.component.html"
	),
	r("app-footer-component", "content", ["without-links", "with-links"], "public legalInfoUrl?: string;", "Optional footer links"),
	r("app-logout-component", "content", ["default-icon", "custom-icon"], "public icon:", "Logout icon"),
	r("app-menu-item-component", "content", ["leaf", "nested"], "public menuGroup: StarkMenuGroup", "Menu item structure"),
	r("app-menu-item-component", "availability", ["enabled", "disabled"], "isEnabled", "Menu item availability"),
	r("app-menu-item-component", "selection", ["inactive", "active"], "public set isActive", "Menu item active state"),
	r("app-menu-item-component", "disclosure", ["collapsed", "expanded"], "this.menuGroupsPanel.open()", "Nested menu disclosure"),
	r("app-menu-component", "content", ["empty", "simple", "sectioned"], "public hasSections = false;", "Menu configuration shape"),
	r("app-sidebar-component", "content", ["menu", "regular"], "public sidenavLeftType?", "Sidebar region type"),
	r(
		"app-sidebar-component",
		"disclosure",
		["closed", "menu-open", "left-open", "right-open"],
		"public openSidenav(",
		"Sidebar drawer state"
	),
	r("app-sidebar-component", "responsive", ["wide", "narrow"], "public isShiftingToSmaller = false;", "Responsive sidebar layout"),
	r("breadcrumb-component", "content", ["empty", "single", "nested"], "public breadcrumbConfig", "Breadcrumb hierarchy"),
	r(
		"collapsible-component",
		"content",
		["empty", "populated"],
		"<ng-content></ng-content>",
		"Collapsible projected content",
		"packages/stark-ui/src/modules/collapsible/components/collapsible.component.html"
	),
	r("collapsible-component", "disclosure", ["collapsed", "expanded"], "public isExpanded = false;", "Collapsible disclosure"),
	r("date-picker-component", "content", ["empty", "populated"], "public get value(): Date | null", "Date value"),
	r("date-picker-component", "availability", ["enabled", "disabled"], "public get disabled(): boolean", "Date-picker availability"),
	r("date-picker-component", "validity", ["valid", "invalid"], "public validate(control: AbstractControl)", "Date validation"),
	r(
		"date-picker-component",
		"overlay",
		["closed", "open"],
		"<mat-datepicker",
		"Calendar overlay",
		"packages/stark-ui/src/modules/date-picker/components/date-picker.component.html"
	),
	r("date-range-picker-component", "content", ["empty", "partial", "populated"], "public set rangeFormGroup", "Date range values"),
	r("date-range-picker-component", "availability", ["enabled", "disabled"], "public set disabled", "Date-range availability"),
	r("date-range-picker-component", "validity", ["valid", "invalid"], "_startBeforeEndValidator", "Date-range validation"),
	r(
		"date-range-picker-component",
		"overlay",
		["closed", "open"],
		"<stark-date-picker",
		"Date-range calendar overlay",
		"packages/stark-ui/src/modules/date-range-picker/components/date-range-picker.component.html"
	),
	r("date-time-picker-component", "content", ["empty", "populated"], "public get value(): Date | null", "Date-time value"),
	r("date-time-picker-component", "availability", ["enabled", "disabled"], "public get disabled(): boolean", "Date-time availability"),
	r("date-time-picker-component", "validity", ["valid", "invalid"], "public validate(control: AbstractControl)", "Date-time validation"),
	r(
		"date-time-picker-component",
		"overlay",
		["closed", "open"],
		"<stark-date-picker",
		"Date-time calendar overlay",
		"packages/stark-ui/src/modules/date-time-picker/components/date-time-picker.component.html"
	),
	r(
		"alert-dialog-component",
		"content",
		["short-message", "long-message"],
		"public content: StarkAlertDialogContent",
		"Alert message content"
	),
	r("alert-dialog-component", "overlay", ["closed", "open"], "MatDialogRef<StarkAlertDialogComponent", "Alert dialog lifecycle"),
	r(
		"confirm-dialog-component",
		"content",
		["default-copy", "custom-copy"],
		"public content: StarkConfirmDialogContent",
		"Confirmation copy"
	),
	r("confirm-dialog-component", "selection", ["cancel", "confirm"], "StarkConfirmDialogResult", "Confirmation result"),
	r(
		"confirm-dialog-component",
		"overlay",
		["closed", "open"],
		"MatDialogRef<StarkConfirmDialogComponent",
		"Confirmation dialog lifecycle"
	),
	r("prompt-dialog-component", "content", ["empty", "populated"], "public content: StarkPromptDialogContent", "Prompt value"),
	r(
		"prompt-dialog-component",
		"availability",
		["accept-disabled", "accept-enabled"],
		'[disabled]="!formControl.value"',
		"Prompt acceptance",
		"packages/stark-ui/src/modules/dialogs/components/prompt-dialog.component.html"
	),
	r("prompt-dialog-component", "selection", ["cancel", "accept"], "StarkPromptDialogResult", "Prompt result"),
	r("prompt-dialog-component", "overlay", ["closed", "open"], "MatDialogRef<StarkPromptDialogComponent", "Prompt dialog lifecycle"),
	r("dropdown-component", "content", ["empty", "populated"], "public options", "Dropdown options"),
	r("dropdown-component", "availability", ["enabled", "disabled"], "public disabled = false;", "Dropdown availability"),
	r("dropdown-component", "validity", ["valid", "invalid"], "public validate(control: AbstractControl)", "Dropdown validation"),
	r("dropdown-component", "selection", ["unselected", "selected"], "public readonly selectionChanged", "Dropdown selection"),
	r("dropdown-component", "overlay", ["closed", "open"], "MatSelect", "Dropdown overlay"),
	r("generic-search-component", "disclosure", ["form-open", "form-closed"], "public isFormHidden = false;", "Search form disclosure"),
	r(
		"generic-search-component",
		"availability",
		["enabled", "disabled"],
		'[disabled]="!normalizedFormButtonsConfig.search.isEnabled"',
		"Search action availability",
		"packages/stark-ui/src/modules/generic-search/components/generic-search/generic-search.component.html"
	),
	r(
		"language-selector-component",
		"content",
		["dropdown", "toolbar"],
		"public mode: StarkLanguageSelectorMode",
		"Language selector mode"
	),
	r("language-selector-component", "selection", ["english", "french"], "public selectedLanguage", "Selected language"),
	r(
		"language-selector-component",
		"overlay",
		["closed", "open"],
		"<stark-dropdown",
		"Language menu overlay",
		"packages/stark-ui/src/modules/language-selector/components/language-selector.component.html"
	),
	r(
		"message-pane-component",
		"content",
		["empty", "populated"],
		"public messageCollection: StarkMessageCollection",
		"Message collection"
	),
	r("message-pane-component", "disclosure", ["hidden", "visible"], "public isVisible = false;", "Message pane visibility"),
	r("message-pane-component", "selection", ["errors", "warnings", "infos"], "public toggleActive(", "Message category selection"),
	r("minimap-component", "content", ["empty", "populated"], "public items: StarkMinimapItemProperties[] = [];", "Minimap items"),
	r("minimap-component", "selection", ["all-visible", "partially-hidden"], "public isItemVisible(", "Minimap visibility selection"),
	r(
		"minimap-component",
		"overlay",
		["closed", "open"],
		"minimapMenuTrigger.menuOpen",
		"Minimap menu",
		"packages/stark-ui/src/modules/minimap/components/minimap.component.html"
	),
	r("minimap-component", "responsive", ["full", "compact"], "public mode?: StarkMinimapComponentMode", "Minimap mode"),
	r(
		"pagination-component",
		"content",
		["empty", "populated"],
		"public paginationConfig!: StarkPaginationConfig;",
		"Pagination item count"
	),
	r(
		"pagination-component",
		"availability",
		["previous-disabled", "next-enabled", "next-disabled"],
		"disabled",
		"Pagination controls",
		"packages/stark-ui/src/modules/pagination/components/pagination.component.html"
	),
	r("pagination-component", "selection", ["first-page", "middle-page", "page-size"], "public goToPage(", "Pagination selection"),
	r("pagination-component", "responsive", ["extended", "compact"], "public isCompactMode(): boolean", "Pagination mode"),
	r("pretty-print-component", "content", ["empty", "plain", "highlighted", "typescript"], "public data", "Pretty-print input and format"),
	r(
		"pretty-print-component",
		"async",
		["pending", "formatted", "error"],
		"this.prettyPrintService.format(",
		"Observable formatting lifecycle"
	),
	r(
		"pretty-print-component",
		"validity",
		["supported-format", "unsupported-format"],
		"StarkPrettyPrintFormat",
		"Pretty-print format support"
	),
	r(
		"progress-indicator-component",
		"async",
		["hidden", "visible"],
		"this._progressService.isVisible(this.topic)",
		"Progress visibility",
		"packages/stark-ui/src/modules/progress-indicator/directives/progress-indicator.directive.ts"
	),
	r("route-search-component", "content", ["empty-query", "matches", "no-matches"], "public search", "Route-search results"),
	r("route-search-component", "disclosure", ["closed", "open"], "public hide = true;", "Route-search disclosure"),
	r("route-search-component", "selection", ["unselected", "selected"], "public redirect(routeEntry:", "Route-search selection"),
	r(
		"route-search-component",
		"overlay",
		["closed", "open"],
		"<mat-autocomplete",
		"Route-search results overlay",
		"packages/stark-ui/src/modules/route-search/components/route-search.component.html"
	),
	r("session-card-component", "content", ["without-title", "with-title"], "public cardTitle", "Session card title"),
	r(
		"session-timeout-warning-dialog-component",
		"content",
		["countdown-start", "countdown-near-expiry"],
		"public countdown",
		"Timeout countdown"
	),
	r("session-timeout-warning-dialog-component", "async", ["active", "expired"], "this.countdown$ = interval(1000)", "Timeout lifecycle"),
	r(
		"session-timeout-warning-dialog-component",
		"selection",
		["keep-logged", "countdown-finished"],
		"this.dialogRef.close",
		"Timeout decision"
	),
	r(
		"session-timeout-warning-dialog-component",
		"overlay",
		["closed", "open"],
		"MatDialogRef<StarkSessionTimeoutWarningDialogComponent",
		"Timeout dialog lifecycle"
	),
	r("login-page-component", "content", ["empty", "populated"], "public users: StarkUser[] = [];", "Login profiles"),
	r(
		"login-page-component",
		"selection",
		["unselected", "selected"],
		"public authenticateUser(user: StarkUser): void",
		"Login profile selection"
	),
	r("preloading-page-component", "async", ["loading", "success", "error"], "public userFetchingFailed = false;", "Preloading lifecycle"),
	r(
		"session-expired-page-component",
		"content",
		["expired", "localized"],
		"STARK.SESSION_EXPIRED",
		"Expired-session content",
		"packages/stark-ui/src/modules/session-ui/pages/session-expired/session-expired-page.component.html"
	),
	r(
		"session-logout-page-component",
		"content",
		["logged-out", "localized"],
		"STARK.SESSION_LOGOUT",
		"Logout content",
		"packages/stark-ui/src/modules/session-ui/pages/session-logout/session-logout-page.component.html"
	),
	r("slider-component", "content", ["single-value", "range-values"], "public values!: number[];", "Slider values"),
	r("slider-component", "availability", ["enabled", "disabled"], "public isDisabled?: boolean;", "Slider availability"),
	r("slider-component", "selection", ["minimum", "middle", "maximum"], "public readonly changed", "Slider selection"),
	r(
		"slider-component",
		"focus",
		["rest", "keyboard-focus"],
		"&:focus,",
		"Slider keyboard focus",
		"packages/stark-ui/src/modules/slider/components/_slider-theme.scss"
	),
	r(
		"table-column-component",
		"content",
		[
			requiredState("hidden", ev("packages/stark-ui/src/modules/table/components/column.component.ts", "if (!this.visible)")),
			requiredState(
				"plain",
				ev("packages/stark-ui/src/modules/table/components/column.component.ts", "formattedValue = rawValue.toString();")
			),
			requiredState(
				"formatted-footer",
				ev("packages/stark-ui/src/modules/table/components/column.component.ts", "formattedValue = this.cellFormatter"),
				ev("packages/stark-ui/src/modules/table/components/column.component.html", "footerValue!.toString() | translate")
			)
		],
		"public get name(): string",
		"Table column content"
	),
	r("table-column-component", "availability", ["static", "interactive"], "public sortable", "Column interactivity"),
	r("table-column-component", "selection", ["unsorted", "ascending", "descending"], "public sortDirection", "Column sort state"),
	r(
		"table-column-component",
		"overlay",
		["closed", "filter-open"],
		"matMenuTriggerFor",
		"Column filter overlay",
		"packages/stark-ui/src/modules/table/components/column.component.html"
	),
	r("table-multisort-dialog-component", "content", ["empty", "populated"], "data.columns", "Multisort columns"),
	r(
		"table-multisort-dialog-component",
		"availability",
		["add-enabled", "add-disabled"],
		"public isAddDisabled = false;",
		"Multisort add action"
	),
	r(
		"table-multisort-dialog-component",
		"selection",
		["none", "one-column", "multiple-columns"],
		"public rules: StarkSortingRule[] = [];",
		"Multisort rules"
	),
	r(
		"table-multisort-dialog-component",
		"overlay",
		["closed", "open"],
		"MatDialogRef<StarkTableMultisortDialogComponent",
		"Multisort dialog lifecycle"
	),
	r("table-component", "content", ["empty", "populated", "footer", "custom-cells"], "public data", "Table data and cells"),
	r("table-component", "disclosure", ["rows-collapsed", "row-expanded"], "public expandedRows: T[] = [];", "Expandable table rows"),
	r("table-component", "availability", ["read-only", "interactive"], "public tableRowActions", "Table actions"),
	r(
		"table-component",
		"selection",
		["none-selected", "one-selected", "all-selected"],
		"public isAllSelected(): boolean",
		"Table row selection"
	),
	r("table-component", "overlay", ["closed", "filter-open", "multisort-open"], "public openMultiSortDialog(): void", "Table overlays"),
	r("toast-notification-component", "content", ["message-only", "with-action", "long-message"], "public message", "Toast content"),
	r("toast-notification-component", "selection", ["standard", "warning", "error"], "StarkMessageType", "Toast type"),
	r("toast-notification-component", "overlay", ["closed", "open"], "public closeToast(): void", "Toast lifecycle"),
	r("email-mask-directive", "content", ["empty", "populated"], "starkEmailMask", "Email mask input"),
	r("email-mask-directive", "availability", ["enabled", "disabled"], "public maskConfig = true;", "Email mask availability"),
	r("email-mask-directive", "validity", ["accepted", "rejected"], "public maskConfig", "Email mask acceptance"),
	r("number-mask-directive", "content", ["empty", "integer", "decimal-negative"], "starkNumberMask", "Number mask input"),
	r(
		"number-mask-directive",
		"availability",
		["configured", "unconfigured"],
		'typeof maskConfig === "undefined"',
		"Number mask availability"
	),
	r("number-mask-directive", "validity", ["accepted", "rejected"], "public maskConfig", "Number mask acceptance"),
	r("text-mask-directive", "content", ["empty", "partial", "complete"], "starkTextMask", "Text mask input"),
	r("text-mask-directive", "availability", ["enabled", "disabled"], "mask: false", "Text mask availability"),
	r("text-mask-directive", "validity", ["accepted", "rejected"], "public maskConfig", "Text mask acceptance"),
	r("timestamp-mask-directive", "content", ["empty", "partial", "complete"], "starkTimestampMask", "Timestamp mask input"),
	r(
		"timestamp-mask-directive",
		"availability",
		["configured", "unconfigured"],
		'typeof this.maskConfig === "undefined"',
		"Timestamp mask availability"
	),
	r("timestamp-mask-directive", "validity", ["accepted", "rejected"], "public maskConfig", "Timestamp mask acceptance"),
	r("progress-indicator-directive", "content", ["spinner", "fallback"], "public type!:", "Progress indicator type"),
	r(
		"progress-indicator-directive",
		"async",
		["idle", "loading", "completed"],
		"this._progressService.isVisible(this.topic)",
		"Directive visibility lifecycle"
	),
	r("restrict-input-directive", "content", ["empty", "populated"], "starkRestrictInput", "Restricted input value"),
	r(
		"restrict-input-directive",
		"validity",
		["allowed-key", "rejected-key", "rejected-paste", "rejected-drop"],
		"private testValue(",
		"Input restriction"
	),
	r(
		"svg-view-box-directive",
		"content",
		["default-size", "custom-size", "existing-viewbox"],
		"starkSvgViewBox",
		"SVG view-box calculation"
	),
	r("table-expand-detail-directive", "content", ["empty-detail", "populated-detail"], "TemplateRef", "Expanded-row content"),
	r("table-expand-detail-directive", "disclosure", ["collapsed", "expanded"], "starkTableExpandDetail", "Expanded-row disclosure"),
	r("table-row-content-directive", "content", ["empty-cell", "custom-cell"], "TemplateRef", "Custom table-cell content"),
	r("transform-input-directive", "content", ["empty", "populated"], "starkTransformInput", "Transform input value"),
	r("transform-input-directive", "selection", ["uppercase", "lowercase", "custom"], "StarkInputTransformationType", "Transform action"),
	r(
		"app-sidebar-service",
		"disclosure",
		["closed", "menu-open", "left-open", "right-open", "toggled"],
		"public openMenu(): void",
		"Sidebar service events"
	),
	r(
		"message-pane-service",
		"content",
		["empty", "populated", "cleared"],
		"public add(messages: StarkMessage[]): void",
		"Message-pane collection"
	),
	r("message-pane-service", "selection", ["error", "warning", "info"], "message.type", "Message-pane types"),
	r("pretty-print-service", "content", ["empty", "json", "xml"], "public format(data: string", "Pretty-print service input"),
	r("pretty-print-service", "async", ["pending", "formatted", "error"], "): Observable<string>", "Observable formatting result"),
	r("pretty-print-service", "validity", ["valid", "invalid"], "throwError", "Formatting errors"),
	r(
		"progress-indicator-service",
		"async",
		["idle", "loading", "completed"],
		"public show(topic: string): void",
		"Progress topic lifecycle"
	),
	r("progress-indicator-service", "selection", ["topic-a", "topic-b"], "public topicsShowMap$", "Independent progress topics"),
	r(
		"toast-notification-service",
		"content",
		["message-only", "with-action"],
		"public show(message: StarkToastMessage)",
		"Toast service message"
	),
	r(
		"toast-notification-service",
		"async",
		["active", "auto-dismissed", "manually-dismissed"],
		"public hide(): void",
		"Toast service lifecycle"
	),
	r("toast-notification-service", "overlay", ["closed", "open"], "openFromComponent(StarkToastNotificationComponent", "Toast overlay"),
	r(
		"rbac-authorization-service",
		"availability",
		["authorized", "unauthorized"],
		"protected isNavigationAuthorized",
		"Authorization result"
	),
	r("rbac-authorization-service", "selection", ["single-role", "any-role", "all-roles"], "roles", "Role matching"),
	r(
		"rbac-authorization-service",
		"content",
		["protected-content", "denial-feedback"],
		"return false",
		"Authorization-controlled content"
	),

	// Focus requirements exist only where the audited template/directive owns an interactive target.
	focus("action-bar-component", "packages/stark-ui/src/modules/action-bar/components/action-bar.component.html", "<button"),
	focus("app-data-component", "packages/stark-ui/src/modules/app-data/components/app-data.component.html", "mat-icon-button"),
	focus(
		"app-footer-component",
		"packages/stark-ui/src/modules/app-footer/components/app-footer.component.html",
		'<a *ngIf="legalInfoUrl"'
	),
	focus("app-logo-component", "packages/stark-ui/src/modules/app-logo/components/app-logo.component.html", "<a (click)"),
	focus("app-logout-component", "packages/stark-ui/src/modules/app-logout/components/app-logout.component.html", "<button"),
	focus("app-menu-item-component", "packages/stark-ui/src/modules/app-menu/components/app-menu-item.component.html", "mat-list-item"),
	focus("breadcrumb-component", "packages/stark-ui/src/modules/breadcrumb/components/breadcrumb.component.html", "<a (click)"),
	focus(
		"collapsible-component",
		"packages/stark-ui/src/modules/collapsible/components/collapsible.component.html",
		"<mat-expansion-panel-header"
	),
	focus("date-picker-component", "packages/stark-ui/src/modules/date-picker/components/date-picker.component.html", "matInput"),
	focus(
		"date-range-picker-component",
		"packages/stark-ui/src/modules/date-range-picker/components/date-range-picker.component.html",
		"<stark-date-picker"
	),
	focus(
		"date-time-picker-component",
		"packages/stark-ui/src/modules/date-time-picker/components/date-time-picker.component.html",
		"matInput"
	),
	focus("alert-dialog-component", "packages/stark-ui/src/modules/dialogs/components/alert-dialog.component.html", "<button"),
	focus("confirm-dialog-component", "packages/stark-ui/src/modules/dialogs/components/confirm-dialog.component.html", "cdkFocusInitial"),
	focus("prompt-dialog-component", "packages/stark-ui/src/modules/dialogs/components/prompt-dialog.component.html", "<input matInput"),
	focus("dropdown-component", "packages/stark-ui/src/modules/dropdown/components/dropdown.component.html", "<mat-select"),
	focus(
		"generic-search-component",
		"packages/stark-ui/src/modules/generic-search/components/generic-search/generic-search.component.html",
		"<button"
	),
	focus(
		"language-selector-component",
		"packages/stark-ui/src/modules/language-selector/components/language-selector.component.html",
		"<mat-button-toggle"
	),
	focus("message-pane-component", "packages/stark-ui/src/modules/message-pane/components/message-pane.component.html", "mat-icon-button"),
	focus("minimap-component", "packages/stark-ui/src/modules/minimap/components/minimap.component.html", "<button"),
	focus("pagination-component", "packages/stark-ui/src/modules/pagination/components/pagination.component.html", "<button"),
	focus("route-search-component", "packages/stark-ui/src/modules/route-search/components/route-search.component.html", "<button"),
	focus(
		"session-timeout-warning-dialog-component",
		"packages/stark-ui/src/modules/session-ui/components/session-timeout-warning-dialog/session-timeout-warning-dialog.component.html",
		"<button"
	),
	focus("login-page-component", "packages/stark-ui/src/modules/session-ui/pages/login/login-page.component.html", "mat-list-item"),
	focus(
		"preloading-page-component",
		"packages/stark-ui/src/modules/session-ui/pages/preloading/preloading-page.component.html",
		"<button"
	),
	focus(
		"session-expired-page-component",
		"packages/stark-ui/src/modules/session-ui/pages/session-expired/session-expired-page.component.html",
		"<button"
	),
	focus(
		"session-logout-page-component",
		"packages/stark-ui/src/modules/session-ui/pages/session-logout/session-logout-page.component.html",
		"<button"
	),
	focus("table-column-component", "packages/stark-ui/src/modules/table/components/column.component.html", "mat-icon-button"),
	focus("table-multisort-dialog-component", "packages/stark-ui/src/modules/table/components/dialogs/multisort.component.html", "<button"),
	focus("table-component", "packages/stark-ui/src/modules/table/components/table.component.html", "<button"),
	focus(
		"toast-notification-component",
		"packages/stark-ui/src/modules/toast-notification/components/toast-notification.component.html",
		"mat-button"
	),
	focus("email-mask-directive", "packages/stark-ui/src/modules/input-mask-directives/directives/email-mask.directive.ts", '"(blur)"'),
	focus("number-mask-directive", "packages/stark-ui/src/modules/input-mask-directives/directives/number-mask.directive.ts", '"(blur)"'),
	focus("text-mask-directive", "packages/stark-ui/src/modules/input-mask-directives/directives/text-mask.directive.ts", '"(blur)"'),
	focus(
		"timestamp-mask-directive",
		"packages/stark-ui/src/modules/input-mask-directives/directives/timestamp-mask.directive.ts",
		'"(blur)"'
	),
	focus(
		"restrict-input-directive",
		"packages/stark-ui/src/modules/restrict-input-directive/directives/restrict-input.directive.ts",
		'@HostListener("keypress"'
	),
	focus(
		"transform-input-directive",
		"packages/stark-ui/src/modules/transform-input-directive/directives/transform-input.directive.ts",
		'"(blur)"'
	),

	// Responsive requirements are limited to surfaces with explicit breakpoint source.
	responsive(
		"action-bar-component",
		"packages/stark-ui/src/modules/action-bar/components/_action-bar.component.scss",
		"@media #{$tablet-query}"
	),
	responsive(
		"breadcrumb-component",
		"packages/stark-ui/src/modules/breadcrumb/components/breadcrumb.component.scss",
		"@media #{$tablet-query}"
	),
	responsive(
		"generic-search-component",
		"packages/stark-ui/src/modules/generic-search/components/generic-search/_generic-search.component.scss",
		"@media #{$tablet-query}"
	),
	responsive(
		"message-pane-component",
		"packages/stark-ui/src/modules/message-pane/components/_message-pane.component.scss",
		"@media #{$desktop-lg-query}"
	),
	responsive(
		"route-search-component",
		"packages/stark-ui/src/modules/route-search/components/_route-search.component.scss",
		"@media #{$mobile-only-query}"
	)
];

export const stateAxisReviews: readonly StateAxisReview[] = visualSurfaceManifest.flatMap((surface) =>
	visualStateAxes.map((axis): StateAxisReview => {
		const sourceRequirement = stateRequirements.find(
			(requirementEntry) => requirementEntry.surfaceId === surface.id && requirementEntry.axis === axis
		);
		return sourceRequirement
			? {
					surfaceId: surface.id,
					axis,
					status: "required",
					requirementId: sourceRequirement.id,
					evidence: sourceRequirement.evidence
				}
			: {
					surfaceId: surface.id,
					axis,
					status: "reviewed-out",
					rationale: `No distinct surface-owned ${axis} contract was found in the audited ${surface.symbol} source.`,
					evidence: [surface.source]
				};
	})
);

export const sourceBackedStates: readonly SourceBackedState[] = stateRequirements.flatMap((requirementEntry) =>
	requirementEntry.states.map(
		(requiredState): SourceBackedState => ({
			id: `${requirementEntry.id}.${requiredState.id}`,
			status: "required",
			surfaceId: requirementEntry.surfaceId,
			axis: requirementEntry.axis,
			state: requiredState.id,
			ownerBead: requirementEntry.ownerBead,
			evidence: requiredState.evidence ? [...requirementEntry.evidence, ...requiredState.evidence] : requirementEntry.evidence
		})
	)
);

const fullActionBarExampleSelector = "example-viewer#classic-full";
const fullActionBarSelector = `${fullActionBarExampleSelector} stark-action-bar > .stark-action-bar.stark-action-bar-full`;
const fullActionBarToggleSelector = `${fullActionBarSelector} > .alt-actions > button.extend-action-bar`;

/**
 * Runnable scenarios are added only after their route, interaction, assertion,
 * and component-only capture selectors have been audited in both applications.
 */
export const executableVisualScenarios = [
	{
		id: "action-bar-disclosure-collapsed",
		sourceStateId: "action-bar-component.disclosure.collapsed",
		surfaceId: "action-bar-component",
		axis: "disclosure",
		state: "collapsed",
		ownerBead: "stark-4sp.4.2",
		routeId: "action-bar",
		runner: "action-bar-disclosure",
		capture: { scope: "component", selector: fullActionBarExampleSelector },
		snapshotName: "action-bar-disclosure-collapsed.png",
		maskSelectors: [],
		maxDiffPixels: 0,
		threshold: 0,
		payload: {
			componentSelector: fullActionBarSelector,
			toggleSelector: fullActionBarToggleSelector,
			action: "initial",
			expectedExtended: false,
			expectedActionLabels: [],
			expectedVisibleActionLabels: [],
			scroll: { kind: "offset", top: 0 }
		}
	},
	{
		id: "action-bar-disclosure-expanded-approve",
		sourceStateId: "action-bar-component.disclosure.expanded",
		surfaceId: "action-bar-component",
		axis: "disclosure",
		state: "expanded",
		ownerBead: "stark-4sp.4.2",
		routeId: "action-bar",
		runner: "action-bar-disclosure",
		capture: { scope: "component", selector: fullActionBarExampleSelector },
		snapshotName: "action-bar-disclosure-expanded.png",
		maskSelectors: [],
		maxDiffPixels: 0,
		threshold: 0,
		payload: {
			componentSelector: fullActionBarSelector,
			toggleSelector: fullActionBarToggleSelector,
			action: "toggle",
			expectedExtended: true,
			expectedActionLabels: ["Approve", "Save", "Delete", "Close"],
			expectedVisibleActionLabels: ["Approve"],
			scroll: { kind: "offset", top: 0 }
		}
	},
	{
		id: "action-bar-disclosure-expanded-save",
		sourceStateId: "action-bar-component.disclosure.expanded",
		surfaceId: "action-bar-component",
		axis: "disclosure",
		state: "expanded",
		ownerBead: "stark-4sp.4.2",
		routeId: "action-bar",
		runner: "action-bar-disclosure",
		capture: { scope: "component", selector: fullActionBarExampleSelector },
		snapshotName: "action-bar-disclosure-expanded-save.png",
		maskSelectors: [],
		maxDiffPixels: 0,
		threshold: 0,
		payload: {
			componentSelector: fullActionBarSelector,
			toggleSelector: fullActionBarToggleSelector,
			action: "toggle",
			expectedExtended: true,
			expectedActionLabels: ["Approve", "Save", "Delete", "Close"],
			expectedVisibleActionLabels: ["Save"],
			scroll: { kind: "offset", top: 40 }
		}
	},
	{
		id: "action-bar-disclosure-expanded-delete",
		sourceStateId: "action-bar-component.disclosure.expanded",
		surfaceId: "action-bar-component",
		axis: "disclosure",
		state: "expanded",
		ownerBead: "stark-4sp.4.2",
		routeId: "action-bar",
		runner: "action-bar-disclosure",
		capture: { scope: "component", selector: fullActionBarExampleSelector },
		snapshotName: "action-bar-disclosure-expanded-delete.png",
		maskSelectors: [],
		maxDiffPixels: 0,
		threshold: 0,
		payload: {
			componentSelector: fullActionBarSelector,
			toggleSelector: fullActionBarToggleSelector,
			action: "toggle",
			expectedExtended: true,
			expectedActionLabels: ["Approve", "Save", "Delete", "Close"],
			expectedVisibleActionLabels: ["Delete"],
			scroll: { kind: "offset", top: 80 }
		}
	},
	{
		id: "action-bar-disclosure-expanded-close",
		sourceStateId: "action-bar-component.disclosure.expanded",
		surfaceId: "action-bar-component",
		axis: "disclosure",
		state: "expanded",
		ownerBead: "stark-4sp.4.2",
		routeId: "action-bar",
		runner: "action-bar-disclosure",
		capture: { scope: "component", selector: fullActionBarExampleSelector },
		snapshotName: "action-bar-disclosure-expanded-close.png",
		maskSelectors: [],
		maxDiffPixels: 0,
		threshold: 0,
		payload: {
			componentSelector: fullActionBarSelector,
			toggleSelector: fullActionBarToggleSelector,
			action: "toggle",
			expectedExtended: true,
			expectedActionLabels: ["Approve", "Save", "Delete", "Close"],
			expectedVisibleActionLabels: ["Close"],
			scroll: { kind: "end" }
		}
	}
] as const satisfies readonly ExecutableVisualScenario[];

export function executableScenariosForRunner<RunnerId extends VisualScenarioRunnerId>(
	runnerId: RunnerId
): readonly Extract<ExecutableVisualScenario, { readonly runner: RunnerId }>[] {
	return executableVisualScenarios.filter(({ runner }) => runner === runnerId) as unknown as readonly Extract<
		ExecutableVisualScenario,
		{ readonly runner: RunnerId }
	>[];
}

/** Reviewed inventory baseline. Changes require an explicit source audit and review. */
export const reviewedCoverageBaseline = {
	requirementGroups: 176,
	stateRequirements: 395,
	executableScenarios: 5,
	executableScenariosByRunner: { "action-bar-disclosure": 5 } as const satisfies Readonly<Record<VisualScenarioRunnerId, number>>,
	requirementContractSha256: "f242d1982a251bec7a8d459ab298b94b1c601a8b796604d1599c027e2ceaacd1",
	mountedSurfaceRoutes: {
		"action-bar-component": "action-bar",
		"app-data-component": "app-data",
		"app-footer-component": "app-shell",
		"app-logo-component": "app-shell",
		"app-logout-component": "logout",
		"app-menu-item-component": "menu",
		"app-menu-component": "menu",
		"app-sidebar-component": "app-shell",
		"breadcrumb-component": "breadcrumb",
		"collapsible-component": "collapsible",
		"date-picker-component": "date-picker",
		"date-range-picker-component": "date-range-picker",
		"date-time-picker-component": "date-time-picker",
		"alert-dialog-component": "dialogs",
		"confirm-dialog-component": "dialogs",
		"prompt-dialog-component": "dialogs",
		"dropdown-component": "dropdown",
		"generic-search-component": "generic-search",
		"language-selector-component": "language-selector",
		"message-pane-component": "app-shell",
		"minimap-component": "minimap",
		"pagination-component": "pagination",
		"pretty-print-component": "pretty-print",
		"progress-indicator-component": "progress-indicator",
		"route-search-component": "route-search",
		"slider-component": "slider",
		"table-column-component": "table",
		"table-multisort-dialog-component": "table",
		"table-component": "table",
		"toast-notification-component": "toast",
		"email-mask-directive": "input-mask-directives",
		"number-mask-directive": "input-mask-directives",
		"text-mask-directive": "input-mask-directives",
		"timestamp-mask-directive": "input-mask-directives",
		"progress-indicator-directive": "progress-indicator",
		"restrict-input-directive": "restrict-input-directive",
		"table-expand-detail-directive": "table",
		"table-row-content-directive": "table",
		"transform-input-directive": "transform-input-directive",
		"app-sidebar-service": "sidebar",
		"message-pane-service": "message-pane",
		"pretty-print-service": "pretty-print",
		"progress-indicator-service": "progress-indicator",
		"toast-notification-service": "toast",
		"rbac-authorization-service": "rbac-authorization-service"
	} as const satisfies Partial<Record<VisualSurfaceId, VisualRouteId>>,
	missingSurfaceOwners: {
		"session-card-component": "stark-4sp.4.11",
		"session-timeout-warning-dialog-component": "stark-4sp.4.11",
		"login-page-component": "stark-4sp.4.11",
		"preloading-page-component": "stark-4sp.4.11",
		"session-expired-page-component": "stark-4sp.4.11",
		"session-logout-page-component": "stark-4sp.4.11",
		"svg-view-box-directive": "stark-4sp.4.6"
	} as const satisfies Partial<Record<VisualSurfaceId, VisualCoverageBeadId>>
} as const;

function duplicates(values: readonly string[]): string[] {
	return [...new Set(values.filter((value, index) => values.indexOf(value) !== index))].sort();
}

function isBlank(value: string): boolean {
	return value.trim().length === 0;
}

function validateEvidence(
	label: string,
	references: readonly SourceEvidence[],
	readEvidence: (reference: SourceEvidence) => string | undefined
): string[] {
	const errors: string[] = [];
	if (references.length === 0) {
		return [`${label} has no evidence`];
	}
	for (const reference of references) {
		if (isBlank(reference.path) || isBlank(reference.needle)) {
			errors.push(`${label} has empty evidence`);
			continue;
		}
		const source = readEvidence(reference);
		if (source === undefined) {
			errors.push(`${label} evidence source does not exist: ${reference.path}`);
		} else if (!source.includes(reference.needle)) {
			errors.push(`${label} evidence '${reference.needle}' not found in source ${reference.path}`);
		}
	}
	return errors;
}

/** Validate census, source evidence, state requirements and route ownership. */
export function validateVisualCoverage(
	surfaces: readonly VisualSurface[],
	requirements: readonly StateRequirement[],
	reviews: readonly StateAxisReview[],
	routes: readonly VisualRouteManifestEntry[],
	readEvidence: (reference: SourceEvidence) => string | undefined,
	executableScenarios: readonly ExecutableVisualScenario[] = executableVisualScenarios
): string[] {
	const errors: string[] = [];
	const routeById = new Map(routes.map((route) => [route.id, route]));
	const surfaceById = new Map(surfaces.map((surface) => [surface.id, surface]));

	if (routes.length !== 48) {
		errors.push(`expected the integrated 48-route manifest, received ${routes.length} routes`);
	}
	if (surfaces.length !== 52) {
		errors.push(`expected exactly 52 surfaces, received ${surfaces.length}`);
	}
	if (requirements.length !== reviewedCoverageBaseline.requirementGroups) {
		errors.push(
			`reviewed baseline requires ${reviewedCoverageBaseline.requirementGroups} requirement groups, received ${requirements.length}`
		);
	}
	const stateCount = requirements.reduce((count, requirementEntry) => count + requirementEntry.states.length, 0);
	if (stateCount !== reviewedCoverageBaseline.stateRequirements) {
		errors.push(`reviewed baseline requires ${reviewedCoverageBaseline.stateRequirements} states, received ${stateCount}`);
	}
	if (executableScenarios.length !== reviewedCoverageBaseline.executableScenarios) {
		errors.push(
			`reviewed baseline requires ${reviewedCoverageBaseline.executableScenarios} executable scenarios, received ${executableScenarios.length}`
		);
	}
	const requirementFingerprint = requirementContractSha256(requirements);
	if (requirementFingerprint !== reviewedCoverageBaseline.requirementContractSha256) {
		errors.push(
			`requirements differ from the reviewed source-backed baseline: expected ${reviewedCoverageBaseline.requirementContractSha256}, received ${requirementFingerprint}`
		);
	}
	for (const [type, expected] of [
		["component", 36],
		["directive", 10],
		["service", 6]
	] as const) {
		const actual = surfaces.filter((surface) => surface.type === type).length;
		if (actual !== expected) {
			errors.push(`expected exactly ${expected} ${type} surfaces, received ${actual}`);
		}
	}

	for (const duplicate of duplicates(surfaces.map(({ id }) => id))) {
		errors.push(`duplicate surface ID ${duplicate}`);
	}
	const actualMounted = surfaces
		.filter(({ showcase }) => showcase.kind === "mounted")
		.map(({ id }) => id)
		.sort();
	const expectedMounted = Object.keys(reviewedCoverageBaseline.mountedSurfaceRoutes).sort();
	if (actualMounted.join("|") !== expectedMounted.join("|")) {
		errors.push("mounted/missing Showcase classification differs from the reviewed baseline");
	}
	for (const surface of surfaces) {
		errors.push(...validateEvidence(surface.id, [surface.source], readEvidence));
		if (surface.showcase.kind === "mounted") {
			const expectedRoute =
				reviewedCoverageBaseline.mountedSurfaceRoutes[surface.id as keyof typeof reviewedCoverageBaseline.mountedSurfaceRoutes];
			if (surface.showcase.routeId !== expectedRoute) {
				errors.push(`${surface.id} Showcase route differs from the reviewed source-backed route ${expectedRoute}`);
			}
			const route = routeById.get(surface.showcase.routeId);
			if (!route) {
				errors.push(`${surface.id} has unknown Showcase route ${surface.showcase.routeId}`);
			} else if (surface.showcase.routeEvidence.needle !== `name: "${route.state}"`) {
				errors.push(`${surface.id} Showcase route evidence does not bind route ${surface.showcase.routeId}`);
			}
			errors.push(...validateEvidence(`${surface.id} Showcase route`, [surface.showcase.routeEvidence], readEvidence));
			errors.push(...validateEvidence(`${surface.id} Showcase integration`, surface.showcase.evidence, readEvidence));
		} else {
			const expectedOwner =
				reviewedCoverageBaseline.missingSurfaceOwners[surface.id as keyof typeof reviewedCoverageBaseline.missingSurfaceOwners];
			if (surface.showcase.ownerBead !== expectedOwner || isBlank(surface.showcase.rationale)) {
				errors.push(`${surface.id} has an incorrectly owned missing Showcase fixture`);
			}
		}
	}

	for (const duplicate of duplicates(requirements.map(({ id }) => id))) {
		errors.push(`duplicate requirement ID ${duplicate}`);
	}
	for (const duplicate of duplicates(executableScenarios.map(({ id }) => id))) {
		errors.push(`duplicate executable scenario ID ${duplicate}`);
	}
	for (const duplicate of duplicates(executableScenarios.map(({ snapshotName }) => snapshotName))) {
		errors.push(`duplicate executable snapshot name ${duplicate}`);
	}
	for (const runnerId of visualScenarioRunnerIds) {
		const actual = executableScenarios.filter(({ runner }) => runner === runnerId).length;
		if (actual !== reviewedCoverageBaseline.executableScenariosByRunner[runnerId]) {
			errors.push(
				`${runnerId} runner owns ${actual} scenarios, expected ${reviewedCoverageBaseline.executableScenariosByRunner[runnerId]}`
			);
		}
	}
	for (const scenario of executableScenarios) {
		if (!(visualScenarioRunnerIds as readonly string[]).includes(scenario.runner)) {
			errors.push(`${scenario.id} declares unknown runner ${scenario.runner}`);
			continue;
		}
		const requirementEntry = requirements.find(
			(requirement) => requirement.surfaceId === scenario.surfaceId && requirement.axis === scenario.axis
		);
		const sourceStateId = `${scenario.surfaceId}.${scenario.axis}.${scenario.state}`;
		if (!requirementEntry?.states.some(({ id }) => id === scenario.state) || scenario.sourceStateId !== sourceStateId) {
			errors.push(`${scenario.id} does not map to source-backed state ${scenario.sourceStateId}`);
		}
		if (requirementEntry && scenario.ownerBead !== requirementEntry.ownerBead) {
			errors.push(`${scenario.id} expected owner ${requirementEntry.ownerBead}, received ${scenario.ownerBead}`);
		}
		const surface = surfaceById.get(scenario.surfaceId);
		if (!routes.some(({ id }) => id === scenario.routeId)) {
			errors.push(`${scenario.id} has unknown route ${scenario.routeId}`);
		} else if (surface?.showcase.kind !== "mounted" || surface.showcase.routeId !== scenario.routeId) {
			errors.push(`${scenario.id} does not use its audited Showcase route ${scenario.routeId}`);
		}
		if (scenario.capture.scope === "component" && isBlank(scenario.capture.selector)) {
			errors.push(`${scenario.id} has an empty component capture selector`);
		}
		if (scenario.maskSelectors.length !== 0 || scenario.maxDiffPixels !== 0 || scenario.threshold !== 0) {
			errors.push(`${scenario.id} weakens exact unmasked visual comparison`);
		}
		if (scenario.runner === "action-bar-disclosure") {
			if (
				scenario.capture.scope !== "component" ||
				!scenario.capture.selector.startsWith("example-viewer#") ||
				isBlank(scenario.payload.componentSelector) ||
				!scenario.payload.componentSelector.startsWith(`${scenario.capture.selector} `) ||
				isBlank(scenario.payload.toggleSelector) ||
				!scenario.payload.toggleSelector.startsWith(`${scenario.payload.componentSelector} `)
			) {
				errors.push(`${scenario.id} does not use audited Action Bar selectors`);
			}
		}
	}
	for (const requirementEntry of requirements) {
		if (!surfaceById.has(requirementEntry.surfaceId)) {
			errors.push(`${requirementEntry.id} owns unknown surface ${requirementEntry.surfaceId}`);
		}
		if (requirementEntry.id !== `${requirementEntry.surfaceId}.${requirementEntry.axis}`) {
			errors.push(`${requirementEntry.id} is not deterministic`);
		}
		const expectedOwner = requirementOwner(requirementEntry.surfaceId, requirementEntry.axis);
		if (requirementEntry.ownerBead !== expectedOwner) {
			errors.push(`${requirementEntry.id} expected owner ${expectedOwner}, received ${requirementEntry.ownerBead}`);
		}
		if (requirementEntry.states.length < 2) {
			errors.push(`${requirementEntry.id} does not enumerate contrasting states`);
		}
		for (const duplicate of duplicates(requirementEntry.states.map(({ id }) => id))) {
			errors.push(`${requirementEntry.id} has duplicate state ${duplicate}`);
		}
		if (isBlank(requirementEntry.description)) {
			errors.push(`${requirementEntry.id} has no requirement description`);
		}
		for (const state of requirementEntry.states) {
			if (isBlank(state.id)) {
				errors.push(`${requirementEntry.id} has an unnamed required state`);
			}
			if (state.evidence) {
				errors.push(...validateEvidence(`${requirementEntry.id}.${state.id}`, state.evidence, readEvidence));
			}
		}
		errors.push(...validateEvidence(requirementEntry.id, requirementEntry.evidence, readEvidence));
	}

	for (const surface of surfaces) {
		const surfaceReviews = reviews.filter(({ surfaceId }) => surfaceId === surface.id);
		for (const duplicate of duplicates(surfaceReviews.map(({ axis }) => axis))) {
			errors.push(`${surface.id} reviews ${duplicate} more than once`);
		}
		for (const axis of visualStateAxes) {
			const review = surfaceReviews.find((entry) => entry.axis === axis);
			const requirementEntry = requirements.find((entry) => entry.surfaceId === surface.id && entry.axis === axis);
			if (!review) {
				errors.push(`${surface.id} silently omits ${axis}`);
				continue;
			}
			errors.push(...validateEvidence(`${surface.id}.${axis} review`, review.evidence, readEvidence));
			if (requirementEntry && review.status === "reviewed-out") {
				errors.push(`source-backed axis ${surface.id}.${axis} is reviewed out`);
			} else if (!requirementEntry && review.status === "required") {
				errors.push(`${surface.id}.${axis} is required without a source-backed requirement`);
			} else if (review.status === "reviewed-out" && isBlank(review.rationale)) {
				errors.push(`${surface.id}.${axis} has no reviewed-out rationale`);
			}
		}
	}

	return errors;
}
