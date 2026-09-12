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

export type MissingVisualFixtureState = {
	readonly sourceStateId: string;
	readonly ownerBead: VisualCoverageBeadId;
	readonly status: "missing-fixture";
	readonly rationale: string;
};

export const visualScenarioRunnerIds = [
	"action-bar-disclosure",
	"action-bar-states",
	"app-data-states",
	"app-footer-states",
	"app-logo-focus",
	"breadcrumb-states",
	"collapsible-states",
	"date-control-states",
	"feedback-states",
	"generic-search-states",
	"input-family-states",
	"minimap-states",
	"navigation-control-states",
	"pagination-states",
	"pretty-print-states",
	"route-search-states",
	"table-selection-states"
] as const;
export type VisualScenarioRunnerId = (typeof visualScenarioRunnerIds)[number];

/**
 * Pixel ceilings for reviewed Chromium rendering-only differences. Geometry,
 * content and interaction state remain asserted separately by each runner;
 * masks and color-distance tolerance remain forbidden.
 */
export const reviewedVisualDiffBudgets: Readonly<Record<string, number>> = {
	// The pre-MDC and MDC mini-fab implementations share exact geometry and
	// colors but rasterize the circular elevation/focus layers differently.
	"app-logout-content-default-icon": 212,
	"app-logout-content-custom-icon": 212,
	"app-logout-focus-rest": 212,
	"app-logout-focus-keyboard": 1293,
	"app-sidebar-service-disclosure-menu-open": 91,
	// The pre-MDC and MDC controls now share content, colors and geometry. The
	// remaining pixels are text/icon antialiasing and subpixel border rasterization.
	"language-selector-content-dropdown": 281,
	"language-selector-content-toolbar": 14,
	"language-selector-selection-english": 281,
	"language-selector-selection-french": 247,
	"language-selector-overlay-closed": 281,
	"language-selector-overlay-open": 206,
	"language-selector-focus-rest": 281,
	"language-selector-focus-keyboard": 281,
	"route-search-focus-rest": 212,
	"route-search-focus-keyboard": 1281,
	"action-bar-disclosure-collapsed": 380,
	"action-bar-disclosure-expanded-approve": 260,
	"action-bar-disclosure-expanded-save": 190,
	"action-bar-disclosure-expanded-delete": 300,
	"action-bar-disclosure-expanded-close": 225,
	"action-bar-content-primary-actions": 260,
	"action-bar-content-compact": 260,
	"action-bar-availability-enabled": 260,
	"action-bar-availability-disabled": 260,
	"action-bar-overlay-closed": 285,
	"action-bar-focus-rest": 260,
	"action-bar-focus-keyboard": 260,
	"action-bar-content-alternative-actions": 650,
	"action-bar-overlay-open": 650,
	"app-data-disclosure-open": 575,
	"app-data-focus-keyboard": 25,
	"collapsible-disclosure-collapsed": 930,
	"collapsible-disclosure-expanded": 1750,
	"collapsible-content-populated": 1950,
	"collapsible-focus-rest": 930,
	"collapsible-focus-keyboard": 930,
	"minimap-selection-all-visible": 200,
	"minimap-selection-partially-hidden": 420,
	"minimap-overlay-open": 200,
	"pagination-content-populated": 124,
	"pagination-availability-previous-disabled": 124,
	"pagination-availability-next-enabled": 124,
	"pagination-availability-next-disabled": 124,
	"pagination-selection-first-page": 148,
	"pagination-selection-middle-page": 147,
	"pagination-selection-page-size": 133,
	"pagination-focus-rest": 124,
	"pagination-focus-keyboard": 138,
	// MDC select uses a different glyph rasterizer; the compatibility styles
	// restore the legacy label, value, underline, arrow and panel geometry.
	"dropdown-content-populated": 13,
	"dropdown-availability-enabled": 443,
	"dropdown-availability-disabled": 736,
	"dropdown-validity-valid": 654,
	"dropdown-validity-invalid": 819,
	"dropdown-selection-unselected": 450,
	"dropdown-selection-selected": 654,
	"dropdown-overlay-closed": 450,
	"dropdown-overlay-open": 13,
	"dropdown-focus-rest": 450,
	"dropdown-focus-keyboard": 221,
	// Angular Material 22 and the legacy renderer rasterize transformed floating
	// labels differently. Content, geometry and state remain asserted exactly.
	"email-mask-content-populated": 111,
	"email-mask-validity-accepted": 111,
	"email-mask-validity-rejected": 111,
	"email-mask-focus-keyboard": 435,
	"text-mask-content-partial": 127,
	"text-mask-content-complete": 127,
	"text-mask-validity-accepted": 127,
	"text-mask-validity-rejected": 127,
	"text-mask-focus-keyboard": 636,
	"restrict-input-content-populated": 290,
	"restrict-input-validity-allowed-key": 290,
	"restrict-input-validity-rejected-key": 290,
	"restrict-input-focus-keyboard": 459,
	"transform-input-content-populated": 229,
	"transform-input-selection-uppercase": 229,
	"transform-input-selection-lowercase": 219,
	"transform-input-selection-custom": 215,
	"transform-input-focus-keyboard": 398,
	// Element screenshots for these lower-page fixtures have a stable one-pixel
	// crop-origin offset between the legacy and candidate pages.
	"number-mask-content-empty": 720,
	"number-mask-content-integer": 933,
	"number-mask-content-decimal-negative": 946,
	"number-mask-availability-configured": 720,
	"number-mask-validity-accepted": 993,
	"number-mask-validity-rejected": 1317,
	"number-mask-focus-rest": 720,
	"number-mask-focus-keyboard": 1317,
	"timestamp-mask-content-empty": 814,
	"timestamp-mask-content-partial": 1036,
	"timestamp-mask-content-complete": 1099,
	"timestamp-mask-availability-configured": 814,
	"timestamp-mask-validity-accepted": 1099,
	"timestamp-mask-validity-rejected": 1038,
	"timestamp-mask-focus-rest": 814,
	"timestamp-mask-focus-keyboard": 1212,
	// Date controls retain the legacy content, state and measured geometry. The
	// remaining reviewed pixels are MDC text/icon rasterization plus a stable
	// one-pixel element-capture rounding difference on date-range fixtures.
	"date-picker-content-empty": 1170,
	"date-picker-content-populated": 1262,
	"date-picker-availability-enabled": 1262,
	"date-picker-availability-disabled": 1033,
	"date-picker-validity-valid": 1262,
	"date-picker-validity-invalid": 1375,
	"date-picker-overlay-closed": 1252,
	"date-picker-overlay-open": 777,
	"date-picker-focus-rest": 1262,
	"date-picker-focus-keyboard": 1172,
	"date-range-picker-content-empty": 1071,
	"date-range-picker-content-partial": 2205,
	"date-range-picker-content-populated": 2390,
	"date-range-picker-availability-enabled": 2390,
	"date-range-picker-availability-disabled": 1921,
	"date-range-picker-validity-valid": 2390,
	"date-range-picker-validity-invalid": 2350,
	"date-range-picker-overlay-closed": 2390,
	"date-range-picker-overlay-open": 489,
	"date-range-picker-focus-rest": 2390,
	"date-range-picker-focus-keyboard": 3041,
	"date-time-picker-content-empty": 1038,
	"date-time-picker-content-populated": 976,
	"date-time-picker-availability-enabled": 976,
	"date-time-picker-availability-disabled": 912,
	"date-time-picker-validity-valid": 976,
	"date-time-picker-validity-invalid": 2548,
	"date-time-picker-overlay-closed": 976,
	"date-time-picker-overlay-open": 489,
	"date-time-picker-focus-rest": 976,
	"date-time-picker-focus-keyboard": 978,
	// Dialog content, colors and geometry now match the legacy renderer. The
	// remaining reviewed pixels are MDC text, button, border and elevation
	// rasterization; prompt fields also retain their legacy dimensions.
	"alert-dialog-component-content-short-message": 1598,
	"alert-dialog-component-content-long-message": 1598,
	"alert-dialog-component-overlay-closed": 1566,
	"alert-dialog-component-overlay-open": 1598,
	"alert-dialog-component-focus-rest": 1598,
	"alert-dialog-component-focus-keyboard": 1598,
	"confirm-dialog-component-content-default-copy": 3011,
	"confirm-dialog-component-content-custom-copy": 3011,
	"confirm-dialog-component-overlay-closed": 1566,
	"confirm-dialog-component-overlay-open": 3011,
	"confirm-dialog-component-focus-rest": 3011,
	"confirm-dialog-component-focus-keyboard": 3011,
	"prompt-dialog-component-content-empty": 5625,
	"prompt-dialog-component-content-populated": 3751,
	"prompt-dialog-component-availability-accept-disabled": 5625,
	"prompt-dialog-component-availability-accept-enabled": 3752,
	"prompt-dialog-component-overlay-closed": 1566,
	"prompt-dialog-component-overlay-open": 5625,
	"prompt-dialog-component-focus-rest": 5625,
	"prompt-dialog-component-focus-keyboard": 5625,
	// Message-pane structure, counts, category state and bounds are asserted by
	// the runner. These ceilings cover only stable icon/text/button and border
	// rasterization differences between the legacy and MDC renderers.
	"message-pane-component-content-empty": 3682,
	"message-pane-component-content-populated": 3434,
	"message-pane-component-disclosure-hidden": 3682,
	"message-pane-component-disclosure-visible": 92,
	"message-pane-component-selection-errors": 3434,
	"message-pane-component-selection-warnings": 2202,
	"message-pane-component-selection-infos": 2060,
	"message-pane-component-focus-rest": 92,
	"message-pane-component-focus-keyboard": 87,
	"message-pane-service-content-empty": 3682,
	"message-pane-service-content-populated": 92,
	"message-pane-service-content-cleared": 5416,
	"message-pane-service-selection-error": 3434,
	"message-pane-service-selection-warning": 2202,
	"message-pane-service-selection-info": 2060,
	// The progress fixture restores the legacy 38px control height. Remaining
	// pixels are raised-button and progress-arc rasterization at exact geometry.
	"progress-indicator-component-async-hidden": 601,
	"progress-indicator-component-async-visible": 1334,
	"progress-indicator-directive-content-spinner": 1334,
	"progress-indicator-directive-async-idle": 601,
	"progress-indicator-directive-async-loading": 1334,
	"progress-indicator-directive-async-completed": 1458,
	"progress-indicator-service-async-idle": 601,
	"progress-indicator-service-async-loading": 1334,
	"progress-indicator-service-async-completed": 1458,
	"progress-indicator-service-selection-topic-a": 1334,
	// Toast layout, colors and lifecycle now match the legacy oracle. These
	// residuals are text/focus and two corner pixels from MDC rasterization.
	"toast-notification-component-content-with-action": 311,
	"toast-notification-component-selection-error": 2,
	"toast-notification-component-overlay-open": 311,
	"toast-notification-component-focus-rest": 311,
	"toast-notification-component-focus-keyboard": 1150,
	"toast-notification-service-content-with-action": 311,
	"toast-notification-service-async-active": 311,
	"toast-notification-service-overlay-open": 311
};

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
	readonly maxDiffPixels: number;
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

export type ActionBarStateScenario = ExecutableVisualScenarioCore<
	"action-bar-states",
	{
		readonly fixtureSelector: string;
		readonly componentSelector: string;
		readonly primaryButtonSelector: string;
		readonly alternativeTriggerSelector: string;
		readonly menuSelector: string;
		readonly menuItemSelector: string;
		readonly action: Readonly<{ kind: "initial" }> | Readonly<{ kind: "open-menu" }> | Readonly<{ kind: "keyboard-tab" }>;
		readonly expectedPrimaryActionIds: readonly string[];
		readonly expectedDisabledActionIds: readonly string[];
		readonly expectedAlternativeActionIds: readonly string[];
		readonly expectedMenuOpen: boolean;
		readonly expectedFocusedActionId: string | null;
	}
> & { readonly capture: Readonly<{ scope: "component"; selector: string }> };

export type AppFooterStateScenario = ExecutableVisualScenarioCore<
	"app-footer-states",
	{
		readonly componentSelector: string;
		readonly legalInfoLinkSelector: string;
		readonly helpLinkSelector: string;
		readonly focusTargetSelector: string;
		readonly action: Readonly<{ kind: "initial" }> | Readonly<{ kind: "keyboard-tab" }>;
		readonly expectedText: string;
		readonly expectedKeyboardFocused: boolean;
		readonly expectedFocusVisible: boolean;
	}
> & { readonly capture: Readonly<{ scope: "component"; selector: string }> };

export type AppDataStateScenario = ExecutableVisualScenarioCore<
	"app-data-states",
	{
		readonly fixtureSelector: string;
		readonly componentSelector: string;
		readonly buttonSelector: string;
		readonly detailSelector: string;
		readonly action: Readonly<{ kind: "initial" }> | Readonly<{ kind: "open-dropdown" }> | Readonly<{ kind: "keyboard-tab" }>;
		readonly expectedMode: "dropdown" | "menu";
		readonly expectedSummaryValues: readonly string[];
		readonly expectedDetailValues: readonly string[];
		readonly expectedOpen: boolean;
		readonly expectedFocused: boolean;
		readonly expectedFocusVisible: boolean;
	}
> & { readonly capture: Readonly<{ scope: "component"; selector: string }> };

export type AppLogoFocusScenario = ExecutableVisualScenarioCore<
	"app-logo-focus",
	{
		readonly componentSelector: string;
		readonly focusTargetSelector: string;
		readonly action: Readonly<{ kind: "initial" }> | Readonly<{ kind: "keyboard-tab" }>;
		readonly expectedFocusVisible: boolean;
		readonly capturePadding: number;
	}
> & { readonly capture: Readonly<{ scope: "component"; selector: string }> };

export type BreadcrumbStateScenario = ExecutableVisualScenarioCore<
	"breadcrumb-states",
	{
		readonly componentSelector: string;
		readonly linkSelector: string;
		readonly separatorSelector: string;
		readonly focusTargetSelector: string;
		readonly expectedLinks: readonly Readonly<{ id: string; text: string }>[];
		readonly expectedSeparator: string;
		readonly expectedFocusVisible: false;
	}
> & { readonly capture: Readonly<{ scope: "component"; selector: string }> };

export type MinimapStateScenario = ExecutableVisualScenarioCore<
	"minimap-states",
	{
		readonly fixtureSelector: string;
		readonly componentSelector: string;
		readonly buttonSelector: string;
		readonly dotSelector: string;
		readonly menuSelector: string;
		readonly menuItemSelector: string;
		readonly checkboxSelector: string;
		readonly action:
			| Readonly<{ kind: "initial" }>
			| Readonly<{ kind: "open-menu" }>
			| Readonly<{ kind: "open-menu-toggle-item"; index: number }>
			| Readonly<{ kind: "keyboard-tab" }>;
		readonly expectedLabels: readonly string[];
		readonly expectedSelected: readonly boolean[];
		readonly expectedChecked: readonly boolean[];
		readonly expectedMenuOpen: boolean;
		readonly expectedFocused: boolean;
		readonly expectedFocusVisible: boolean;
	}
> & { readonly capture: Readonly<{ scope: "component"; selector: string }> };

export type PaginationStateScenario = ExecutableVisualScenarioCore<
	"pagination-states",
	{
		readonly fixtureSelector: string;
		readonly componentSelector: string;
		readonly firstButtonSelector: string;
		readonly previousButtonSelector: string;
		readonly nextButtonSelector: string;
		readonly lastButtonSelector: string;
		readonly pageInputSelector: string;
		readonly totalPagesSelector: string;
		readonly pageNumberSelector: string;
		readonly activePageSelector: string;
		readonly itemsPerPageSelector: string;
		readonly eventSelector: string;
		readonly action:
			| Readonly<{ kind: "initial" }>
			| Readonly<{ kind: "go-to-last" }>
			| Readonly<{ kind: "go-to-page"; page: number }>
			| Readonly<{ kind: "select-page-size"; size: number }>
			| Readonly<{ kind: "keyboard-tab" }>;
		readonly expectedCurrentPage: number;
		readonly expectedTotalPages: number;
		readonly expectedItemsPerPage: number;
		readonly expectedPageNumbers: readonly string[];
		readonly expectedActivePage: string | null;
		readonly expectedFirstDisabled: boolean | null;
		readonly expectedPreviousDisabled: boolean;
		readonly expectedNextDisabled: boolean;
		readonly expectedLastDisabled: boolean | null;
		readonly expectedEvent: string | null;
		readonly expectedFocused: boolean;
		readonly expectedFocusVisible: boolean;
	}
> & { readonly capture: Readonly<{ scope: "component"; selector: string }> };

export type PrettyPrintStateScenario = ExecutableVisualScenarioCore<
	"pretty-print-states",
	{
		readonly fixtureSelector: string;
		readonly componentSelector: string;
		readonly outputSelector: string;
		readonly tabSelector: string;
		readonly textareaSelector: string;
		readonly formatSelector: string;
		readonly highlightingSelector: string;
		readonly action:
			| Readonly<{ kind: "initial" }>
			| Readonly<{ kind: "open-example-tab"; tabName: "Formatted" | "Formatted with highlighting" }>
			| Readonly<{ kind: "format-invalid-json" }>;
		readonly expectedText: string;
		readonly expectedHighlighted: boolean;
		readonly expectedLanguageClass: "language-typescript" | null;
		readonly expectedCssWidth: 854 | 866 | 898;
		readonly expectedWidth: 866 | 882 | 898;
		readonly capturePadding: number;
	}
> & { readonly capture: Readonly<{ scope: "component"; selector: string }> };

export type CollapsibleStateScenario = ExecutableVisualScenarioCore<
	"collapsible-states",
	{
		readonly componentSelector: string;
		readonly headerSelector: string;
		readonly contentSelector: string;
		readonly statusSelector: string;
		readonly action:
			| Readonly<{ kind: "initial" }>
			| Readonly<{ kind: "toggle-header" }>
			| Readonly<{ kind: "keyboard-focus-header"; nextFocusableSelector: string }>;
		readonly expectedExpanded: boolean;
		readonly expectedContentVisible: boolean;
		readonly expectedContentText: string;
		readonly expectedStatus: string;
		readonly expectedKeyboardFocused: boolean;
	}
> & { readonly capture: Readonly<{ scope: "component"; selector: string }> };

export type InputFamilyStateScenario = ExecutableVisualScenarioCore<
	"input-family-states",
	{
		readonly fixtureSelector: string;
		readonly targetSelector: string;
		readonly action:
			| Readonly<{ kind: "initial" }>
			| Readonly<{ kind: "keyboard-focus" }>
			| Readonly<{ kind: "blur" }>
			| Readonly<{ kind: "type"; value: string }>
			| Readonly<{ kind: "open-select" }>
			| Readonly<{ kind: "select-option"; optionName: string }>
			| Readonly<{ kind: "toggle-checkbox"; selector: string }>
			| Readonly<{ kind: "slider-key"; key: "Home" | "End" }>
			| Readonly<{ kind: "slider-value"; inputSelector: string; value: string }>
			| Readonly<{ kind: "paste" | "drop"; value: string }>;
		readonly expected: Readonly<{
			disabled?: boolean;
			focused?: boolean;
			focusVisible?: boolean;
			invalid?: boolean;
			overlayOpen?: boolean;
			selectedText?: string;
			sliderValues?: readonly string[];
			transferPrevented?: boolean;
			value?: string;
		}>;
	}
> & { readonly capture: Readonly<{ scope: "component"; selector: string }> };

export type DateControlStateScenario = ExecutableVisualScenarioCore<
	"date-control-states",
	{
		readonly fixtureSelector: string;
		readonly componentSelector: string;
		readonly inputSelectors: readonly string[];
		readonly action:
			| Readonly<{ kind: "initial" }>
			| Readonly<{ kind: "clear-input"; selector: string; blur: boolean }>
			| Readonly<{ kind: "fill-input"; selector: string; value: string; blur: boolean }>
			| Readonly<{ kind: "toggle-disabled"; selector: string }>
			| Readonly<{ kind: "open-calendar"; selector: string }>
			| Readonly<{ kind: "keyboard-focus"; selector: string }>;
		readonly expected: Readonly<{
			calendarDisabledDates?: boolean;
			disabled?: boolean;
			focusedSelector?: string;
			focusVisible?: boolean;
			invalidFieldCount?: number;
			overlayOpen?: boolean;
			separateDateAndTime?: boolean;
			values?: readonly string[];
		}>;
	}
> & { readonly capture: Readonly<{ scope: "component"; selector: string }> };

export type FeedbackStateScenario = ExecutableVisualScenarioCore<
	"feedback-states",
	{
		readonly fixtureSelector: string;
		readonly steps: readonly (
			| Readonly<{ kind: "click"; selector: string; index?: number }>
			| Readonly<{ kind: "fill"; selector: string; value: string }>
			| Readonly<{ kind: "keyboard-activate"; selector: string }>
			| Readonly<{ kind: "keyboard-focus"; selector: string }>
			| Readonly<{ kind: "wait"; milliseconds: number }>
		)[];
		readonly assertions: readonly Readonly<{
			selector: string;
			count?: number;
			visible?: boolean;
			text?: string;
			containsText?: string;
			classes?: readonly string[];
			absentClasses?: readonly string[];
			disabled?: boolean;
			value?: string;
			focused?: boolean;
			focusVisible?: boolean;
			withinViewport?: boolean;
		}>[];
	}
> & { readonly capture: Readonly<{ scope: "component"; selector: string }> };

export type NavigationControlStateScenario = ExecutableVisualScenarioCore<
	"navigation-control-states",
	{
		readonly fixtureSelector: string;
		readonly targetSelector: string;
		readonly viewport: Readonly<{ width: number; height: number }>;
		readonly action:
			| Readonly<{ kind: "initial" }>
			| Readonly<{ kind: "click"; selector: string }>
			| Readonly<{ kind: "keyboard-focus"; selector: string }>
			| Readonly<{ kind: "select-option"; triggerSelector: string; optionName: string }>;
		readonly expected: Readonly<{
			active?: boolean;
			disabled?: boolean;
			drawer?: "closed" | "menu" | "regular-left" | "right";
			expanded?: boolean;
			focused?: boolean;
			focusVisible?: boolean;
			iconPathPrefix?: string;
			mode?: "dropdown" | "toolbar";
			overlayOpen?: boolean;
			selectedText?: string;
		}>;
	}
> & { readonly capture: Readonly<{ scope: "component"; selector: string }> };

type RouteSearchFixture =
	| "example-viewer#direction-left"
	| "example-viewer#direction-right"
	| "example-viewer#with-menu-config-and-custom-color";
type RouteSearchQuery = "brEAd" | "typography" | "date" | "__stark_unmatched_route__";
type RouteSearchAction =
	| Readonly<{ kind: "initial" | "open" }>
	| Readonly<{ kind: "filter" | "clear" | "escape" | "toggle-close" | "toggle-reopen"; query: RouteSearchQuery }>
	| Readonly<{ kind: "select"; query: RouteSearchQuery; via: "pointer" | "enter" | "second-enter" }>;
type RouteSearchExpectation =
	| Readonly<{ kind: "search"; inputVisible: boolean; value: string; results: "all" | readonly string[] | null }>
	| Readonly<{ kind: "destination"; path: string; heading: string }>;

export type RouteSearchStateScenario = ExecutableVisualScenarioCore<
	"route-search-states",
	{
		readonly fixtureSelector: RouteSearchFixture;
		readonly action: RouteSearchAction;
		readonly expected: RouteSearchExpectation;
	}
> & { readonly capture: Readonly<{ scope: "component"; selector: string }> };

type GenericSearchCriteria = Readonly<{ year: string; hero: string; movie: string }>;
type GenericSearchRow = readonly [hero: string, movie: string, year: string];
type GenericSearchJourney =
	| "initial"
	| "close"
	| "reopen"
	| "hero-search"
	| "year-keyboard"
	| "loading"
	| "no-matches"
	| "reset"
	| "all-results"
	| "movie-action-bar";

export type GenericSearchStateScenario = ExecutableVisualScenarioCore<
	"generic-search-states",
	{
		readonly fixtureSelector: "example-viewer#generic-search-component";
		readonly formSelector: "#demo-generic-search-form";
		readonly viewport: Readonly<{ width: number; height: number }>;
		readonly journey: GenericSearchJourney;
		readonly criteria: GenericSearchCriteria;
		readonly expectedCriteria: GenericSearchCriteria;
		readonly expectedRows: readonly GenericSearchRow[];
		readonly expectedFormOpen: boolean;
		readonly expectedKeyboardFocus: boolean;
	}
> & {
	readonly surfaceId: "generic-search-component";
	readonly routeId: "generic-search";
	readonly ownerBead: "stark-4sp.4.8";
	readonly capture: Readonly<{ scope: "component"; selector: string }>;
};

type TableSelectionJourney = "initial" | "pointer-one" | "retained-one" | "all-first" | "all-last" | "clear" | "keyboard-one";
type TableSelectionCheckpoint = {
	readonly action:
		| Readonly<{ kind: "initial" | "header-checkbox" | "next-page" | "first-page" }>
		| Readonly<{ kind: "row-checkbox" | "row-space"; rowId: string }>;
	readonly page: 1 | 2 | 3;
	readonly expectedRowIds: readonly string[];
	readonly expectedSelectedRowIds: readonly string[];
	readonly expectedHeaderChecked: boolean;
	readonly expectedHeaderIndeterminate: boolean;
};

export type TableSelectionStateScenario = ExecutableVisualScenarioCore<
	"table-selection-states",
	{
		readonly fixtureSelector: "example-viewer#selection";
		readonly viewport: Readonly<{ width: number; height: number }>;
		readonly journey: TableSelectionJourney;
		readonly checkpoints: readonly TableSelectionCheckpoint[];
	}
> & {
	readonly surfaceId: "table-component";
	readonly routeId: "table";
	readonly axis: "selection";
	readonly ownerBead: "stark-4sp.4.9";
	readonly capture: Readonly<{ scope: "component"; selector: string }>;
};

export type ExecutableVisualScenario =
	| ActionBarDisclosureScenario
	| ActionBarStateScenario
	| AppDataStateScenario
	| AppFooterStateScenario
	| AppLogoFocusScenario
	| BreadcrumbStateScenario
	| CollapsibleStateScenario
	| DateControlStateScenario
	| FeedbackStateScenario
	| GenericSearchStateScenario
	| InputFamilyStateScenario
	| MinimapStateScenario
	| NavigationControlStateScenario
	| PaginationStateScenario
	| PrettyPrintStateScenario
	| RouteSearchStateScenario
	| TableSelectionStateScenario;

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

/** Source-backed states that the pinned legacy Showcase cannot render. */
export const missingVisualFixtureStates: readonly MissingVisualFixtureState[] = [
	{
		sourceStateId: "generic-search-component.availability.disabled",
		ownerBead: "stark-4sp.4.8",
		status: "missing-fixture",
		rationale:
			"The pinned legacy Generic Search demo mounts the default enabled Search actions and exposes no disabled form-button configuration."
	},
	{
		sourceStateId: "app-menu-component.content.empty",
		ownerBead: "stark-4sp.4.3",
		status: "missing-fixture",
		rationale: "The pinned legacy Showcase provides sectioned and simple App Menu fixtures, but no empty menu configuration."
	},
	{
		sourceStateId: "app-menu-item-component.focus.keyboard",
		ownerBead: "stark-4sp.4.3",
		status: "missing-fixture",
		rationale: "The legacy App Menu renders mat-list-item hosts without tabindex, so no menu item is keyboard-focusable."
	},
	{
		sourceStateId: "action-bar-component.content.empty",
		ownerBead: "stark-4sp.4.2",
		status: "missing-fixture",
		rationale: "The pinned legacy Showcase has no Action Bar fixture without configured actions."
	},
	{
		sourceStateId: "collapsible-component.content.empty",
		ownerBead: "stark-4sp.4.2",
		status: "missing-fixture",
		rationale: "The pinned legacy Showcase has no empty projected-content fixture."
	},
	{
		sourceStateId: "app-footer-component.content.without-links",
		ownerBead: "stark-4sp.4.2",
		status: "missing-fixture",
		rationale: "The pinned legacy shell always configures both footer links."
	},
	{
		sourceStateId: "breadcrumb-component.content.empty",
		ownerBead: "stark-4sp.4.2",
		status: "missing-fixture",
		rationale: "The pinned legacy Showcase has no empty breadcrumb fixture."
	},
	{
		sourceStateId: "breadcrumb-component.content.single",
		ownerBead: "stark-4sp.4.2",
		status: "missing-fixture",
		rationale: "The pinned legacy Showcase has no single-item breadcrumb fixture."
	},
	{
		sourceStateId: "breadcrumb-component.focus.keyboard",
		ownerBead: "stark-4sp.4.2",
		status: "missing-fixture",
		rationale: "The legacy breadcrumb anchors have no href or tabindex and cannot receive keyboard focus."
	},
	{
		sourceStateId: "minimap-component.content.empty",
		ownerBead: "stark-4sp.4.2",
		status: "missing-fixture",
		rationale: "The pinned legacy Showcase has no empty minimap fixture."
	},
	{
		sourceStateId: "pagination-component.content.empty",
		ownerBead: "stark-4sp.4.2",
		status: "missing-fixture",
		rationale: "The pinned legacy Showcase has no empty pagination fixture."
	},
	{
		sourceStateId: "pretty-print-component.async.pending",
		ownerBead: "stark-4sp.4.2",
		status: "missing-fixture",
		rationale: "The pinned legacy Showcase exposes no deterministic pending component state."
	},
	{
		sourceStateId: "pretty-print-component.validity.unsupported-format",
		ownerBead: "stark-4sp.4.2",
		status: "missing-fixture",
		rationale: "The pinned legacy Showcase exposes no unsupported component format fixture."
	},
	{
		sourceStateId: "pretty-print-service.content.empty",
		ownerBead: "stark-4sp.4.2",
		status: "missing-fixture",
		rationale: "The pinned legacy Showcase exposes no empty service fixture."
	},
	{
		sourceStateId: "pretty-print-service.async.pending",
		ownerBead: "stark-4sp.4.2",
		status: "missing-fixture",
		rationale: "The pinned legacy Showcase exposes no deterministic pending service state."
	},
	{
		sourceStateId: "dropdown-component.content.empty",
		ownerBead: "stark-4sp.4.5",
		status: "missing-fixture",
		rationale: "The pinned legacy Showcase has no dropdown fixture with an empty options array."
	},
	{
		sourceStateId: "email-mask-directive.availability.disabled",
		ownerBead: "stark-4sp.4.5",
		status: "missing-fixture",
		rationale: "The pinned legacy Showcase does not expose a runtime control for disabling the email mask."
	},
	{
		sourceStateId: "number-mask-directive.availability.unconfigured",
		ownerBead: "stark-4sp.4.5",
		status: "missing-fixture",
		rationale: "The pinned legacy Showcase does not render a number-mask input without configuration."
	},
	{
		sourceStateId: "text-mask-directive.availability.disabled",
		ownerBead: "stark-4sp.4.5",
		status: "missing-fixture",
		rationale: "The pinned legacy Showcase does not expose a runtime control for disabling the text mask."
	},
	{
		sourceStateId: "timestamp-mask-directive.availability.unconfigured",
		ownerBead: "stark-4sp.4.5",
		status: "missing-fixture",
		rationale: "The pinned legacy Showcase does not render a timestamp-mask input without configuration."
	},
	{
		sourceStateId: "progress-indicator-directive.content.fallback",
		ownerBead: "stark-4sp.4.7",
		status: "missing-fixture",
		rationale: "The pinned legacy Showcase configures only the spinner progress-indicator type."
	},
	{
		sourceStateId: "progress-indicator-service.selection.topic-b",
		ownerBead: "stark-4sp.4.7",
		status: "missing-fixture",
		rationale: "The pinned legacy Showcase registers one progress topic and exposes no second independent topic."
	}
];

const fullActionBarExampleSelector = "example-viewer#classic-full";
const fullActionBarSelector = `${fullActionBarExampleSelector} stark-action-bar > .stark-action-bar.stark-action-bar-full`;
const fullActionBarToggleSelector = `${fullActionBarSelector} > .alt-actions > button.extend-action-bar`;
const compactActionBarFixtureSelector = "example-viewer#classic-compact";
const compactActionBarSelector = `${compactActionBarFixtureSelector} stark-action-bar > .stark-action-bar.stark-action-bar-compact`;
const alternativeActionBarFixtureSelector = "example-viewer#alternative";
const alternativeActionBarSelector = `${alternativeActionBarFixtureSelector} stark-action-bar > .stark-action-bar.stark-action-bar-compact`;
const actionBarMenuSelector = '.cdk-overlay-pane [role="menu"]:has(.stark-action-bar-menu-item)';
const primaryActionIds = ["actionValidate", "actionSave", "actionDelete", "actionClose"] as const;
const alternativeActionIds = ["actionAdd", "actionMinus", "actionEdit"] as const;
const appDataDropdownFixtureSelector = "example-viewer#dropdown";
const appDataDropdownComponentSelector = `${appDataDropdownFixtureSelector} stark-app-data.stark-app-data > div.stark-app-data.dropdown`;
const appDataDropdownButtonSelector = `${appDataDropdownComponentSelector} > button[aria-label="Application Data"]`;
const appDataMenuFixtureSelector = "example-viewer#menu";
const appDataMenuComponentSelector = `${appDataMenuFixtureSelector} stark-app-data.stark-app-data > div.stark-app-data.menu`;
const appDataMenuButtonSelector = `${appDataMenuComponentSelector} > button[aria-label="Application Data"]`;
const appDataDetailSelector = ".cdk-overlay-pane .stark-app-data.dropdown-detail";
const appDataExpectedSummaryValues = ["johndoe (manager)", "Jan 2, 2020 3:04 AM"] as const;
const appDataExpectedDetailValues = ["0.0.0", "visual"] as const;
const minimapFixtureSelector = "example-viewer#full";
const minimapComponentSelector = `${minimapFixtureSelector} stark-minimap.stark-minimap:not(.stark-primary):not(.stark-accent)`;
const minimapButtonSelector = `${minimapComponentSelector} > button`;
const minimapDotSelector = `${minimapComponentSelector} > .stark-minimap-dots > .stark-minimap-dot`;
const minimapMenuSelector = '.cdk-overlay-pane [role="menu"]:has(.stark-minimap-menu-item)';
const minimapMenuItemSelector = `${minimapMenuSelector} .stark-minimap-menu-item`;
const minimapCheckboxSelector = `${minimapMenuItemSelector} mat-checkbox input[type="checkbox"]`;
const minimapExpectedLabels = ["First", "Second", "Third", "Fourth"] as const;
const minimapAllVisible = [true, true, true, true] as const;
const minimapPartiallyHidden = [true, false, true, true] as const;
const paginationSimpleFixtureSelector = "example-viewer#simple-config";
const paginationExtendedFixtureSelector = "example-viewer#extended-config";
const paginationSimpleComponentSelector = `${paginationSimpleFixtureSelector} stark-pagination.stark-pagination`;
const paginationExtendedComponentSelector = `${paginationExtendedFixtureSelector} stark-pagination.stark-pagination`;
const paginationSimpleExpectedState = {
	expectedCurrentPage: 1,
	expectedTotalPages: 2,
	expectedItemsPerPage: 10,
	expectedPageNumbers: [],
	expectedActivePage: null,
	expectedFirstDisabled: true,
	expectedPreviousDisabled: true,
	expectedNextDisabled: false,
	expectedLastDisabled: false,
	expectedEvent: null
} as const;
const paginationExtendedExpectedState = {
	expectedCurrentPage: 1,
	expectedTotalPages: 10,
	expectedItemsPerPage: 2,
	expectedPageNumbers: ["1", "...", "5", "...", "10"],
	expectedActivePage: "1",
	expectedFirstDisabled: null,
	expectedPreviousDisabled: true,
	expectedNextDisabled: false,
	expectedLastDisabled: null,
	expectedEvent: null
} as const;
const prettyPrintFormFixtureSelector = "demo-pretty-print > section.stark-section:first-of-type > mat-card";
const prettyPrintExamplesSelector = "demo-pretty-print > section.stark-section:nth-of-type(2)";
const prettyPrintTypescriptFixtureSelector = `${prettyPrintExamplesSelector} > example-viewer:nth-of-type(5)`;
const prettyPrintJsonFixtureSelector = `${prettyPrintExamplesSelector} > example-viewer:nth-of-type(6)`;
const prettyPrintXmlFixtureSelector = `${prettyPrintExamplesSelector} > example-viewer:nth-of-type(7)`;
const prettyPrintFormComponentSelector = `${prettyPrintFormFixtureSelector} .pretty-print-result > stark-pretty-print.stark-pretty-print`;
const prettyPrintTypescriptComponentSelector = `${prettyPrintTypescriptFixtureSelector} stark-pretty-print.stark-pretty-print`;
const prettyPrintJsonComponentSelector = `${prettyPrintJsonFixtureSelector} stark-pretty-print.stark-pretty-print`;
const prettyPrintXmlComponentSelector = `${prettyPrintXmlFixtureSelector} stark-pretty-print.stark-pretty-print`;
const prettyPrintPlainOutputSelector = (componentSelector: string): string => `${componentSelector} > div > pre`;
const prettyPrintHighlightedOutputSelector = (componentSelector: string): string => `${componentSelector} > div > div > pre`;
const prettyPrintInvalidJson = '{"broken":}';
const prettyPrintTypescriptText =
	[
		"function calculateData(seed: any, operationFn: Function): any {",
		"  var data: any = operationFn(seed);",
		"  if (!data) {",
		'    data = "could not calculate data";',
		"  }",
		"  return data;",
		"}"
	].join("\n") + "\n";
const prettyPrintJsonText =
	[
		"{",
		'  "menu": {',
		'    "id": "file",',
		'    "value": "File",',
		'    "menuitem": [',
		'      { "value": "New", "onclick": "CreateNewDoc()" },',
		'      { "value": "Open", "onclick": "OpenDoc()" },',
		'      { "value": "Close", "onclick": "CloseDoc()" }',
		"    ]",
		"  }",
		"}"
	].join("\n") + "\n";
const prettyPrintXmlText =
	[
		'<menu id="file" value="File">',
		'  <menuitem value="New" onclick="CreateNewDoc()" />',
		'  <menuitem value="Open" onclick="OpenDoc()" />',
		'  <menuitem value="Close" onclick="CloseDoc()" />',
		"</menu>"
	].join("\n") + "\n";
const appFooterComponentSelector = "mat-sidenav-content stark-app-footer.stark-app-footer";
const appFooterLegalInfoLinkSelector = `${appFooterComponentSelector} a[href="https://www.nbb.be/en/disclaimer-and-legal-information"]`;
const appFooterHelpLinkSelector = `${appFooterComponentSelector} a[href="https://www.nbb.be/en/links"]`;
const appFooterExpectedText = "National Bank of Belgium. All rights reserved © 2018 - 2020 • Legal information • Help";
const appLogoComponentSelector = ".stark-app-header .app-logo > stark-app-logo";
const appLogoFocusTargetSelector = `${appLogoComponentSelector} > a[href="#"]`;
const breadcrumbExampleSelector = "example-viewer#with-config-input";
const breadcrumbComponentSelector = `${breadcrumbExampleSelector} stark-breadcrumb.stark-breadcrumb`;
const breadcrumbLinkSelector = `${breadcrumbComponentSelector} > span > a`;
const breadcrumbSeparatorSelector = `${breadcrumbComponentSelector} > span > span`;
const breadcrumbFocusTargetSelector = `${breadcrumbComponentSelector} > span:first-child > a[id="path 1"]`;
const breadcrumbExpectedLinks = [
	{ id: "path 1", text: "Root ancestor" },
	{ id: "path 1.1", text: "Grand parent" },
	{ id: "path 1.1.1", text: "Parent" },
	{ id: "path 1.1.1.1", text: "Child" }
] as const;

const actionBarStatePayload = (
	fixture: "compact" | "alternative",
	action: ActionBarStateScenario["payload"]["action"]
): ActionBarStateScenario["payload"] => {
	const alternative = fixture === "alternative";
	const fixtureSelector = alternative ? alternativeActionBarFixtureSelector : compactActionBarFixtureSelector;
	const componentSelector = alternative ? alternativeActionBarSelector : compactActionBarSelector;
	const actionBarId = alternative ? "alt" : "classic-compact";
	return {
		fixtureSelector,
		componentSelector,
		primaryButtonSelector: `${componentSelector} > .action-bar-wrapper > button.stark-action-bar-action`,
		alternativeTriggerSelector: `${componentSelector} > .alt-actions > button.open-alt-actions`,
		menuSelector: actionBarMenuSelector,
		menuItemSelector: `${actionBarMenuSelector} button.stark-action-bar-menu-item`,
		action,
		expectedPrimaryActionIds: primaryActionIds.map((id) => `${actionBarId}-${id}`),
		expectedDisabledActionIds: [`${actionBarId}-actionDelete`],
		expectedAlternativeActionIds: alternative ? alternativeActionIds.map((id) => `${actionBarId}-alt-${id}`) : [],
		expectedMenuOpen: action.kind === "open-menu",
		expectedFocusedActionId: action.kind === "keyboard-tab" ? `${actionBarId}-actionValidate` : null
	};
};
const defaultCollapsibleExampleSelector = "example-viewer#default";
const defaultCollapsibleSelector = `${defaultCollapsibleExampleSelector} stark-collapsible > mat-expansion-panel#firstCollapsible.stark-collapsible`;
const populatedCollapsibleExampleSelector = "example-viewer#custom";
const populatedCollapsibleHostSelector = `${populatedCollapsibleExampleSelector} stark-collapsible:has(> mat-expansion-panel#fourthCollapsible)`;
const populatedCollapsibleSelector = `${populatedCollapsibleHostSelector} > mat-expansion-panel#fourthCollapsible.stark-collapsible`;
const appDataPayload = (
	expectedMode: AppDataStateScenario["payload"]["expectedMode"],
	action: AppDataStateScenario["payload"]["action"]
): AppDataStateScenario["payload"] => {
	const isDropdown = expectedMode === "dropdown";
	const expectedOpen = action.kind === "open-dropdown";
	return {
		fixtureSelector: isDropdown ? appDataDropdownFixtureSelector : appDataMenuFixtureSelector,
		componentSelector: isDropdown ? appDataDropdownComponentSelector : appDataMenuComponentSelector,
		buttonSelector: isDropdown ? appDataDropdownButtonSelector : appDataMenuButtonSelector,
		detailSelector: appDataDetailSelector,
		action,
		expectedMode,
		expectedSummaryValues: isDropdown ? appDataExpectedSummaryValues : [],
		expectedDetailValues: expectedOpen ? appDataExpectedDetailValues : [],
		expectedOpen,
		expectedFocused: expectedOpen || action.kind === "keyboard-tab",
		expectedFocusVisible: action.kind === "keyboard-tab"
	};
};
const minimapPayload = (action: MinimapStateScenario["payload"]["action"]): MinimapStateScenario["payload"] => {
	const menuOpen = action.kind === "open-menu" || action.kind === "open-menu-toggle-item";
	const partiallyHidden = action.kind === "open-menu-toggle-item";
	return {
		fixtureSelector: minimapFixtureSelector,
		componentSelector: minimapComponentSelector,
		buttonSelector: minimapButtonSelector,
		dotSelector: minimapDotSelector,
		menuSelector: minimapMenuSelector,
		menuItemSelector: minimapMenuItemSelector,
		checkboxSelector: minimapCheckboxSelector,
		action,
		expectedLabels: minimapExpectedLabels,
		expectedSelected: partiallyHidden ? minimapPartiallyHidden : minimapAllVisible,
		expectedChecked: menuOpen ? (partiallyHidden ? minimapPartiallyHidden : minimapAllVisible) : [],
		expectedMenuOpen: menuOpen,
		expectedFocused: action.kind === "keyboard-tab",
		expectedFocusVisible: action.kind === "keyboard-tab"
	};
};
type PaginationExpectedOverrides = Partial<
	Pick<
		PaginationStateScenario["payload"],
		| "expectedCurrentPage"
		| "expectedTotalPages"
		| "expectedItemsPerPage"
		| "expectedPageNumbers"
		| "expectedActivePage"
		| "expectedFirstDisabled"
		| "expectedPreviousDisabled"
		| "expectedNextDisabled"
		| "expectedLastDisabled"
		| "expectedEvent"
	>
>;
const paginationPayload = (
	fixture: "simple" | "extended",
	action: PaginationStateScenario["payload"]["action"],
	expectedOverrides: PaginationExpectedOverrides = {}
): PaginationStateScenario["payload"] => {
	const fixtureSelector = fixture === "simple" ? paginationSimpleFixtureSelector : paginationExtendedFixtureSelector;
	const componentSelector = fixture === "simple" ? paginationSimpleComponentSelector : paginationExtendedComponentSelector;
	const suffix = fixture === "simple" ? "simple-config" : "extended-config";
	const expectedState = fixture === "simple" ? paginationSimpleExpectedState : paginationExtendedExpectedState;
	return {
		fixtureSelector,
		componentSelector,
		firstButtonSelector: `${componentSelector} > div:not(.compact) > ul > li.first-page > button`,
		previousButtonSelector: `${componentSelector} > div:not(.compact) > ul > li.previous > button`,
		nextButtonSelector: `${componentSelector} > div:not(.compact) > ul > li.next > button`,
		lastButtonSelector: `${componentSelector} > div:not(.compact) > ul > li.last-page > button`,
		pageInputSelector: `${componentSelector} > div:not(.compact) > .pagination-enter-page > input#current-page-pagination-${suffix}`,
		totalPagesSelector: `${componentSelector} > div:not(.compact) > .pagination-enter-page > .total-pages`,
		pageNumberSelector: `${componentSelector} > div:not(.compact) > ul > li.page-numbers`,
		activePageSelector: `${componentSelector} > div:not(.compact) > ul > li.page-numbers.active`,
		itemsPerPageSelector: `${componentSelector} > div:not(.compact) > .pagination-items-per-page mat-select#items-per-page-pagination-${suffix}`,
		eventSelector: `${fixtureSelector} stark-pretty-print`,
		action,
		...expectedState,
		...expectedOverrides,
		expectedFocused: action.kind === "keyboard-tab",
		expectedFocusVisible: action.kind === "keyboard-tab"
	};
};
const prettyPrintPayload = (
	fixture: "form" | "typescript" | "json" | "xml",
	action: PrettyPrintStateScenario["payload"]["action"],
	expectedText: string,
	expectedHighlighted = false
): PrettyPrintStateScenario["payload"] => {
	const fixtureSelector =
		fixture === "form"
			? prettyPrintFormFixtureSelector
			: fixture === "typescript"
				? prettyPrintTypescriptFixtureSelector
				: fixture === "json"
					? prettyPrintJsonFixtureSelector
					: prettyPrintXmlFixtureSelector;
	const componentSelector =
		fixture === "form"
			? prettyPrintFormComponentSelector
			: fixture === "typescript"
				? prettyPrintTypescriptComponentSelector
				: fixture === "json"
					? prettyPrintJsonComponentSelector
					: prettyPrintXmlComponentSelector;
	return {
		fixtureSelector,
		componentSelector,
		outputSelector: expectedHighlighted
			? prettyPrintHighlightedOutputSelector(componentSelector)
			: prettyPrintPlainOutputSelector(componentSelector),
		tabSelector: `${fixtureSelector} [role="tab"]`,
		textareaSelector: `${prettyPrintFormFixtureSelector} textarea[name="unformattedData"]`,
		formatSelector: `${prettyPrintFormFixtureSelector} mat-select#dataFormatDropdown`,
		highlightingSelector: `${prettyPrintFormFixtureSelector} mat-checkbox.highlighting-enabled-field`,
		action,
		expectedText,
		expectedHighlighted,
		expectedLanguageClass: expectedHighlighted ? "language-typescript" : null,
		expectedCssWidth: fixture === "form" ? 898 : expectedHighlighted ? 854 : 866,
		expectedWidth: fixture === "form" ? 898 : expectedHighlighted ? 882 : 866,
		capturePadding: expectedText.length === 0 ? 8 : 0
	};
};
const expectedPrettyPrintPayloadForSourceState = (sourceStateId: string): PrettyPrintStateScenario["payload"] | undefined => {
	switch (sourceStateId) {
		case "pretty-print-component.content.empty":
			return prettyPrintPayload("form", { kind: "initial" }, "");
		case "pretty-print-component.content.plain":
		case "pretty-print-component.content.typescript":
		case "pretty-print-component.async.formatted":
		case "pretty-print-service.async.formatted":
			return prettyPrintPayload("typescript", { kind: "open-example-tab", tabName: "Formatted" }, prettyPrintTypescriptText);
		case "pretty-print-component.content.highlighted":
		case "pretty-print-component.validity.supported-format":
		case "pretty-print-service.validity.valid":
			return prettyPrintPayload(
				"typescript",
				{ kind: "open-example-tab", tabName: "Formatted with highlighting" },
				prettyPrintTypescriptText,
				true
			);
		case "pretty-print-component.async.error":
		case "pretty-print-service.async.error":
		case "pretty-print-service.validity.invalid":
			return prettyPrintPayload("form", { kind: "format-invalid-json" }, prettyPrintInvalidJson);
		case "pretty-print-service.content.json":
			return prettyPrintPayload("json", { kind: "open-example-tab", tabName: "Formatted" }, prettyPrintJsonText);
		case "pretty-print-service.content.xml":
			return prettyPrintPayload("xml", { kind: "open-example-tab", tabName: "Formatted" }, prettyPrintXmlText);
		default:
			return undefined;
	}
};
const appFooterPayload = (action: AppFooterStateScenario["payload"]["action"]): AppFooterStateScenario["payload"] => ({
	componentSelector: appFooterComponentSelector,
	legalInfoLinkSelector: appFooterLegalInfoLinkSelector,
	helpLinkSelector: appFooterHelpLinkSelector,
	focusTargetSelector: appFooterLegalInfoLinkSelector,
	action,
	expectedText: appFooterExpectedText,
	expectedKeyboardFocused: action.kind === "keyboard-tab",
	expectedFocusVisible: action.kind === "keyboard-tab"
});
const breadcrumbPayload = (): BreadcrumbStateScenario["payload"] => ({
	componentSelector: breadcrumbComponentSelector,
	linkSelector: breadcrumbLinkSelector,
	separatorSelector: breadcrumbSeparatorSelector,
	focusTargetSelector: breadcrumbFocusTargetSelector,
	expectedLinks: breadcrumbExpectedLinks,
	expectedSeparator: "›",
	expectedFocusVisible: false
});
const collapsiblePayload = (
	exampleSelector: string,
	componentSelector: string,
	action: CollapsibleStateScenario["payload"]["action"],
	expectedExpanded: boolean,
	expectedKeyboardFocused = false,
	statusSelector = `${exampleSelector} span.collapsible-demo-status`
): CollapsibleStateScenario["payload"] => ({
	componentSelector,
	headerSelector: `${componentSelector} > mat-expansion-panel-header`,
	contentSelector: `${componentSelector} [role="region"]`,
	statusSelector,
	action,
	expectedExpanded,
	expectedContentVisible: expectedExpanded,
	expectedContentText: "Any HTML content",
	expectedStatus: expectedExpanded ? "Open" : "Closed",
	expectedKeyboardFocused
});

type NavigationSurfaceId =
	| "app-logout-component"
	| "app-menu-item-component"
	| "app-menu-component"
	| "app-sidebar-component"
	| "app-sidebar-service"
	| "language-selector-component"
	| "route-search-component";

const wideNavigationViewport = { width: 1280, height: 720 } as const;
const narrowNavigationViewport = { width: 800, height: 900 } as const;
const sidebarComponentSelector = "stark-app-sidebar";
const sidebarContainerSelector = `${sidebarComponentSelector} > mat-sidenav-container`;
const sidebarMenuButtonSelector = ".stark-app-bar-content-left .stark-actions > button:nth-of-type(2)";
const sidebarLeftButtonSelector = ".stark-app-bar-content-right-center > button:nth-of-type(1)";
const sidebarRightButtonSelector = ".stark-app-bar-content-right-center > button:nth-of-type(2)";
const sidebarDemoSelector = "example-viewer#demo";
const sidebarDemoMenuButtonSelector = `${sidebarDemoSelector} button[color="primary"]:nth-of-type(1)`;
const sidebarDemoLeftButtonSelector = `${sidebarDemoSelector} button[color="primary"]:nth-of-type(2)`;
const sidebarDemoRightButtonSelector = `${sidebarDemoSelector} button[color="primary"]:nth-of-type(3)`;

const navigationScenario = (
	surfaceId: NavigationSurfaceId,
	routeId: Extract<VisualRouteId, "app-shell" | "language-selector" | "logout" | "menu" | "route-search" | "sidebar">,
	axis: VisualStateAxis,
	state: string,
	captureSelector: string,
	payload: NavigationControlStateScenario["payload"]
): NavigationControlStateScenario => {
	const id = `${surfaceId.replace(/-component$/u, "").replace(/-service$/u, "-service")}-${axis}-${state}`;
	return {
		id,
		sourceStateId: `${surfaceId}.${axis}.${state}`,
		surfaceId,
		axis,
		state,
		ownerBead: requirementOwner(surfaceId, axis),
		routeId,
		runner: "navigation-control-states",
		capture: { scope: "component", selector: captureSelector },
		snapshotName: `${id}.png`,
		maskSelectors: [],
		maxDiffPixels: reviewedVisualDiffBudgets[id] ?? 0,
		threshold: 0,
		payload
	};
};

const navigationPayload = (
	fixtureSelector: string,
	targetSelector: string,
	action: NavigationControlStateScenario["payload"]["action"] = { kind: "initial" },
	expected: NavigationControlStateScenario["payload"]["expected"] = {},
	viewport: NavigationControlStateScenario["payload"]["viewport"] = wideNavigationViewport
): NavigationControlStateScenario["payload"] => ({ fixtureSelector, targetSelector, viewport, action, expected });

const navigationControlScenarios: readonly NavigationControlStateScenario[] = [
	navigationScenario(
		"app-logout-component",
		"logout",
		"content",
		"default-icon",
		"example-viewer#default-icon stark-app-logout button",
		navigationPayload(
			"example-viewer#default-icon",
			"example-viewer#default-icon stark-app-logout button",
			{ kind: "initial" },
			{ iconPathPrefix: "M16.56,5.44" }
		)
	),
	navigationScenario(
		"app-logout-component",
		"logout",
		"content",
		"custom-icon",
		"example-viewer#custom-icon stark-app-logout button",
		navigationPayload(
			"example-viewer#custom-icon",
			"example-viewer#custom-icon stark-app-logout button",
			{ kind: "initial" },
			{ iconPathPrefix: "M16,17" }
		)
	),
	navigationScenario(
		"app-logout-component",
		"logout",
		"focus",
		"rest",
		"example-viewer#default-icon stark-app-logout button",
		navigationPayload(
			"example-viewer#default-icon",
			"example-viewer#default-icon stark-app-logout button",
			{ kind: "initial" },
			{ focused: false, focusVisible: false }
		)
	),
	navigationScenario(
		"app-logout-component",
		"logout",
		"focus",
		"keyboard",
		"example-viewer#default-icon stark-app-logout button",
		navigationPayload(
			"example-viewer#default-icon",
			"example-viewer#default-icon stark-app-logout button",
			{ kind: "keyboard-focus", selector: "example-viewer#default-icon stark-app-logout button" },
			{ focused: true, focusVisible: true }
		)
	),
	...(
		[
			["content", "leaf", "#sections #menu-item-home", { kind: "initial" }, {}],
			["content", "nested", "#sections #menu-item-with-entries", { kind: "initial" }, { expanded: false }],
			["availability", "enabled", "#sections #menu-item-home", { kind: "initial" }, { disabled: false }],
			["availability", "disabled", "#sections #menu-item-2", { kind: "initial" }, { disabled: true }],
			["selection", "inactive", "#sections #menu-item-home", { kind: "initial" }, { active: false }],
			["selection", "active", ".stark-app-sidenav-menu #menu-stark-ui-components-menu", { kind: "initial" }, { active: true }],
			["disclosure", "collapsed", "#sections #menu-item-with-entries", { kind: "initial" }, { expanded: false }],
			[
				"disclosure",
				"expanded",
				"#sections #menu-item-with-entries",
				{ kind: "click", selector: "#sections #menu-item-with-entries" },
				{ expanded: true }
			],
			["focus", "rest", "#sections #menu-item-home", { kind: "initial" }, { focused: false, focusVisible: false }]
		] as const
	).map(([axis, state, target, action, expected]) =>
		navigationScenario(
			"app-menu-item-component",
			"menu",
			axis,
			state,
			state === "expanded" ? "#sections stark-app-menu-item:has(> #menu-item-with-entries)" : target,
			navigationPayload("demo-menu", target, action, expected)
		)
	),
	navigationScenario(
		"app-menu-component",
		"menu",
		"content",
		"simple",
		"example-viewer#no-sections stark-app-menu",
		navigationPayload("example-viewer#no-sections", "example-viewer#no-sections stark-app-menu")
	),
	navigationScenario(
		"app-menu-component",
		"menu",
		"content",
		"sectioned",
		"example-viewer#sections stark-app-menu",
		navigationPayload("example-viewer#sections", "example-viewer#sections stark-app-menu")
	),
	...(
		[
			["content", "menu", wideNavigationViewport, { kind: "initial" }, { drawer: "menu" }],
			[
				"content",
				"regular",
				narrowNavigationViewport,
				{ kind: "click", selector: sidebarLeftButtonSelector },
				{ drawer: "regular-left" }
			],
			["disclosure", "closed", narrowNavigationViewport, { kind: "initial" }, { drawer: "closed" }],
			[
				"disclosure",
				"menu-open",
				narrowNavigationViewport,
				{ kind: "click", selector: sidebarMenuButtonSelector },
				{ drawer: "menu" }
			],
			[
				"disclosure",
				"left-open",
				narrowNavigationViewport,
				{ kind: "click", selector: sidebarLeftButtonSelector },
				{ drawer: "regular-left" }
			],
			[
				"disclosure",
				"right-open",
				narrowNavigationViewport,
				{ kind: "click", selector: sidebarRightButtonSelector },
				{ drawer: "right" }
			],
			["responsive", "wide", wideNavigationViewport, { kind: "initial" }, { drawer: "menu" }],
			["responsive", "narrow", narrowNavigationViewport, { kind: "initial" }, { drawer: "closed" }]
		] as const
	).map(([axis, state, viewport, action, expected]) =>
		navigationScenario(
			"app-sidebar-component",
			"app-shell",
			axis,
			state,
			expected.drawer === "closed"
				? sidebarMenuButtonSelector
				: expected.drawer === "right"
					? `${sidebarComponentSelector} .stark-app-sidenav-right`
					: `${sidebarComponentSelector} .stark-app-sidenav-left`,
			navigationPayload(sidebarComponentSelector, sidebarContainerSelector, action, expected, viewport)
		)
	),
	...(
		[
			["closed", { kind: "initial" }, { drawer: "closed" }],
			["menu-open", { kind: "click", selector: sidebarDemoMenuButtonSelector }, { drawer: "menu" }],
			["left-open", { kind: "click", selector: sidebarDemoLeftButtonSelector }, { drawer: "regular-left" }],
			["right-open", { kind: "click", selector: sidebarDemoRightButtonSelector }, { drawer: "right" }],
			["toggled", { kind: "click", selector: sidebarMenuButtonSelector }, { drawer: "menu" }]
		] as const
	).map(([state, action, expected]) =>
		navigationScenario(
			"app-sidebar-service",
			"sidebar",
			"disclosure",
			state,
			expected.drawer === "closed"
				? sidebarMenuButtonSelector
				: expected.drawer === "right"
					? `${sidebarComponentSelector} .stark-app-sidenav-right`
					: expected.drawer === "menu"
						? `${sidebarComponentSelector} .stark-app-sidenav-left #menu-home`
						: `${sidebarComponentSelector} .stark-app-sidenav-left`,
			navigationPayload(sidebarDemoSelector, sidebarContainerSelector, action, expected, narrowNavigationViewport)
		)
	),
	...(
		[
			["content", "dropdown", "#dropdown mat-form-field", { kind: "initial" }, { mode: "dropdown" }],
			["content", "toolbar", "#toolbar mat-button-toggle-group", { kind: "initial" }, { mode: "toolbar" }],
			["selection", "english", "#dropdown mat-form-field", { kind: "initial" }, { mode: "dropdown", selectedText: "English" }],
			[
				"selection",
				"french",
				"#dropdown mat-form-field",
				{ kind: "select-option", triggerSelector: "#dropdown [role=combobox]", optionName: "Français" },
				{ mode: "dropdown", selectedText: "Français" }
			],
			["overlay", "closed", "#dropdown mat-form-field", { kind: "initial" }, { mode: "dropdown", overlayOpen: false }],
			[
				"overlay",
				"open",
				"[role=listbox]",
				{ kind: "click", selector: "#dropdown [role=combobox]" },
				{ mode: "dropdown", overlayOpen: true }
			],
			["focus", "rest", "#dropdown mat-form-field", { kind: "initial" }, { mode: "dropdown", focused: false, focusVisible: false }],
			[
				"focus",
				"keyboard",
				"#dropdown mat-form-field",
				{ kind: "keyboard-focus", selector: "#dropdown [role=combobox]" },
				{ mode: "dropdown", focused: true, focusVisible: true }
			]
		] as const
	).map(([axis, state, capture, action, expected]) =>
		navigationScenario(
			"language-selector-component",
			"language-selector",
			axis,
			state,
			capture,
			navigationPayload(
				state === "toolbar" ? "example-viewer#toolbar" : "example-viewer#dropdown",
				state === "toolbar" ? "#toolbar stark-language-selector" : "#dropdown [role=combobox]",
				action,
				expected
			)
		)
	),
	...(
		[
			["rest", { kind: "initial" }, { focused: false, focusVisible: false }],
			[
				"keyboard",
				{ kind: "keyboard-focus", selector: "#direction-left stark-route-search button.search-button" },
				{ focused: true, focusVisible: true }
			]
		] as const
	).map(([state, action, expected]) =>
		navigationScenario(
			"route-search-component",
			"route-search",
			"focus",
			state,
			"#direction-left stark-route-search button.search-button",
			navigationPayload("example-viewer#direction-left", "#direction-left stark-route-search button.search-button", action, expected)
		)
	)
];

type DateControlSurfaceId = "date-picker-component" | "date-range-picker-component" | "date-time-picker-component";
type DateControlRouteId = Extract<VisualRouteId, "date-picker" | "date-range-picker" | "date-time-picker">;

const dateControlScenario = (
	surfaceId: DateControlSurfaceId,
	routeId: DateControlRouteId,
	axis: VisualStateAxis,
	state: string,
	captureSelector: string,
	payload: DateControlStateScenario["payload"]
): DateControlStateScenario => {
	const id = `${surfaceId.replace(/-component$/u, "")}-${axis}-${state}`;
	return {
		id,
		sourceStateId: `${surfaceId}.${axis}.${state}`,
		surfaceId,
		axis,
		state,
		ownerBead: "stark-4sp.4.4",
		routeId,
		runner: "date-control-states",
		capture: { scope: "component", selector: captureSelector },
		snapshotName: `${id}.png`,
		maskSelectors: [],
		maxDiffPixels: reviewedVisualDiffBudgets[id] ?? 0,
		threshold: 0,
		payload
	};
};

const dateControlPayload = (
	fixtureSelector: string,
	componentSelector: string,
	inputSelectors: readonly string[],
	action: DateControlStateScenario["payload"]["action"] = { kind: "initial" },
	expected: DateControlStateScenario["payload"]["expected"] = {}
): DateControlStateScenario["payload"] => ({ fixtureSelector, componentSelector, inputSelectors, action, expected });

const datePickerReactiveFixture = "example-viewer#reactive-form";
const datePickerReactiveComponent = `${datePickerReactiveFixture} stark-date-picker`;
const datePickerReactiveInput = `${datePickerReactiveComponent} input`;
const datePickerReactiveCapture = `${datePickerReactiveFixture} mat-form-field`;
const datePickerFilterFixture = "example-viewer#weekdays-filter";
const datePickerFilterComponent = `${datePickerFilterFixture} stark-date-picker`;
const datePickerFilterInput = `${datePickerFilterComponent} input`;
const datePickerFilterCapture = `${datePickerFilterFixture} mat-form-field`;
const dateRangeModelFixture = "example-viewer#ng-model";
const dateRangeModelComponent = `${dateRangeModelFixture} stark-date-range-picker`;
const dateRangeModelInputs = [
	`${dateRangeModelComponent} mat-form-field:nth-of-type(1) input`,
	`${dateRangeModelComponent} mat-form-field:nth-of-type(2) input`
] as const;
const dateRangeModelCapture = `${dateRangeModelFixture} mat-card-content`;
const dateRangeReactiveFixture = "example-viewer#reactive-form-group";
const dateRangeReactiveComponent = `${dateRangeReactiveFixture} stark-date-range-picker`;
const dateRangeReactiveInputs = [
	`${dateRangeReactiveComponent} mat-form-field:nth-of-type(1) input`,
	`${dateRangeReactiveComponent} mat-form-field:nth-of-type(2) input`
] as const;
const dateRangeReactiveCapture = `${dateRangeReactiveFixture} mat-card-content`;
const dateRangeMaskFixture = "example-viewer#default-date-mask";
const dateRangeMaskComponent = `${dateRangeMaskFixture} stark-date-range-picker`;
const dateRangeMaskInputs = [
	`${dateRangeMaskComponent} mat-form-field:nth-of-type(1) input`,
	`${dateRangeMaskComponent} mat-form-field:nth-of-type(2) input`
] as const;
const dateRangeMaskCapture = `${dateRangeMaskFixture} mat-card-content`;
const dateTimeReactiveFixture = "example-viewer#reactive-form";
const dateTimeReactiveComponent = `${dateTimeReactiveFixture} stark-date-time-picker`;
const dateTimeReactiveInputs = [
	`${dateTimeReactiveComponent} input#date-time-picker-form-control-input`,
	`${dateTimeReactiveComponent} input#date-time-picker-form-control-time-input`
] as const;
const dateTimeReactiveCapture = `${dateTimeReactiveFixture} mat-form-field`;
const dateTimeModelFixture = "example-viewer#ng-model";
const dateTimeModelComponent = `${dateTimeModelFixture} stark-date-time-picker`;
const dateTimeModelInputs = [
	`${dateTimeModelComponent} input#date-time-picker-ng-model-input`,
	`${dateTimeModelComponent} input#date-time-picker-ng-model-time-input`
] as const;
const dateTimeModelCapture = `${dateTimeModelFixture} mat-form-field`;
const calendarSelector = ".mat-datepicker-content";

const dateControlScenarios: readonly DateControlStateScenario[] = [
	dateControlScenario(
		"date-picker-component",
		"date-picker",
		"content",
		"empty",
		datePickerFilterCapture,
		dateControlPayload(
			datePickerFilterFixture,
			datePickerFilterComponent,
			[datePickerFilterInput],
			{ kind: "clear-input", selector: datePickerFilterInput, blur: false },
			{ values: [""] }
		)
	),
	dateControlScenario(
		"date-picker-component",
		"date-picker",
		"content",
		"populated",
		datePickerReactiveCapture,
		dateControlPayload(
			datePickerReactiveFixture,
			datePickerReactiveComponent,
			[datePickerReactiveInput],
			{ kind: "initial" },
			{
				values: ["January 2, 2020"]
			}
		)
	),
	dateControlScenario(
		"date-picker-component",
		"date-picker",
		"availability",
		"enabled",
		datePickerReactiveCapture,
		dateControlPayload(
			datePickerReactiveFixture,
			datePickerReactiveComponent,
			[datePickerReactiveInput],
			{ kind: "initial" },
			{
				disabled: false
			}
		)
	),
	dateControlScenario(
		"date-picker-component",
		"date-picker",
		"availability",
		"disabled",
		datePickerReactiveCapture,
		dateControlPayload(
			datePickerReactiveFixture,
			datePickerReactiveComponent,
			[datePickerReactiveInput],
			{ kind: "toggle-disabled", selector: `${datePickerReactiveFixture} mat-checkbox input` },
			{ disabled: true }
		)
	),
	dateControlScenario(
		"date-picker-component",
		"date-picker",
		"validity",
		"valid",
		datePickerReactiveCapture,
		dateControlPayload(
			datePickerReactiveFixture,
			datePickerReactiveComponent,
			[datePickerReactiveInput],
			{ kind: "initial" },
			{
				invalidFieldCount: 0
			}
		)
	),
	dateControlScenario(
		"date-picker-component",
		"date-picker",
		"validity",
		"invalid",
		datePickerReactiveCapture,
		dateControlPayload(
			datePickerReactiveFixture,
			datePickerReactiveComponent,
			[datePickerReactiveInput],
			{ kind: "clear-input", selector: datePickerReactiveInput, blur: true },
			{ invalidFieldCount: 1, values: [""] }
		)
	),
	dateControlScenario(
		"date-picker-component",
		"date-picker",
		"overlay",
		"closed",
		datePickerFilterCapture,
		dateControlPayload(
			datePickerFilterFixture,
			datePickerFilterComponent,
			[datePickerFilterInput],
			{ kind: "initial" },
			{
				overlayOpen: false
			}
		)
	),
	dateControlScenario(
		"date-picker-component",
		"date-picker",
		"overlay",
		"open",
		calendarSelector,
		dateControlPayload(
			datePickerFilterFixture,
			datePickerFilterComponent,
			[datePickerFilterInput],
			{ kind: "open-calendar", selector: `${datePickerFilterComponent} button[aria-label="Open calendar"]` },
			{ calendarDisabledDates: true, overlayOpen: true }
		)
	),
	dateControlScenario(
		"date-picker-component",
		"date-picker",
		"focus",
		"rest",
		datePickerReactiveCapture,
		dateControlPayload(
			datePickerReactiveFixture,
			datePickerReactiveComponent,
			[datePickerReactiveInput],
			{ kind: "initial" },
			{
				focusedSelector: datePickerReactiveInput,
				focusVisible: false
			}
		)
	),
	dateControlScenario(
		"date-picker-component",
		"date-picker",
		"focus",
		"keyboard",
		datePickerReactiveCapture,
		dateControlPayload(
			datePickerReactiveFixture,
			datePickerReactiveComponent,
			[datePickerReactiveInput],
			{ kind: "keyboard-focus", selector: datePickerReactiveInput },
			{ focusedSelector: datePickerReactiveInput, focusVisible: true }
		)
	),
	dateControlScenario(
		"date-range-picker-component",
		"date-range-picker",
		"content",
		"empty",
		dateRangeMaskCapture,
		dateControlPayload(dateRangeMaskFixture, dateRangeMaskComponent, dateRangeMaskInputs, { kind: "initial" }, { values: ["", ""] })
	),
	dateControlScenario(
		"date-range-picker-component",
		"date-range-picker",
		"content",
		"partial",
		dateRangeReactiveCapture,
		dateControlPayload(
			dateRangeReactiveFixture,
			dateRangeReactiveComponent,
			dateRangeReactiveInputs,
			{ kind: "fill-input", selector: dateRangeReactiveInputs[0], value: "January 2, 2020", blur: false },
			{ values: ["January 2, 2020", ""] }
		)
	),
	dateControlScenario(
		"date-range-picker-component",
		"date-range-picker",
		"content",
		"populated",
		dateRangeModelCapture,
		dateControlPayload(
			dateRangeModelFixture,
			dateRangeModelComponent,
			dateRangeModelInputs,
			{ kind: "initial" },
			{
				values: ["January 2, 2020", "February 1, 2020"]
			}
		)
	),
	dateControlScenario(
		"date-range-picker-component",
		"date-range-picker",
		"availability",
		"enabled",
		dateRangeModelCapture,
		dateControlPayload(
			dateRangeModelFixture,
			dateRangeModelComponent,
			dateRangeModelInputs,
			{ kind: "initial" },
			{
				disabled: false
			}
		)
	),
	dateControlScenario(
		"date-range-picker-component",
		"date-range-picker",
		"availability",
		"disabled",
		dateRangeModelCapture,
		dateControlPayload(
			dateRangeModelFixture,
			dateRangeModelComponent,
			dateRangeModelInputs,
			{ kind: "toggle-disabled", selector: `${dateRangeModelFixture} mat-checkbox input` },
			{ disabled: true }
		)
	),
	dateControlScenario(
		"date-range-picker-component",
		"date-range-picker",
		"validity",
		"valid",
		dateRangeModelCapture,
		dateControlPayload(
			dateRangeModelFixture,
			dateRangeModelComponent,
			dateRangeModelInputs,
			{ kind: "initial" },
			{
				invalidFieldCount: 0
			}
		)
	),
	dateControlScenario(
		"date-range-picker-component",
		"date-range-picker",
		"validity",
		"invalid",
		dateRangeReactiveCapture,
		dateControlPayload(
			dateRangeReactiveFixture,
			dateRangeReactiveComponent,
			dateRangeReactiveInputs,
			{ kind: "clear-input", selector: dateRangeReactiveInputs[0], blur: true },
			{ invalidFieldCount: 1, values: ["", ""] }
		)
	),
	dateControlScenario(
		"date-range-picker-component",
		"date-range-picker",
		"overlay",
		"closed",
		dateRangeModelCapture,
		dateControlPayload(
			dateRangeModelFixture,
			dateRangeModelComponent,
			dateRangeModelInputs,
			{ kind: "initial" },
			{
				overlayOpen: false
			}
		)
	),
	dateControlScenario(
		"date-range-picker-component",
		"date-range-picker",
		"overlay",
		"open",
		calendarSelector,
		dateControlPayload(
			dateRangeModelFixture,
			dateRangeModelComponent,
			dateRangeModelInputs,
			{ kind: "open-calendar", selector: `${dateRangeModelComponent} button[aria-label="Open calendar"]` },
			{ calendarDisabledDates: true, overlayOpen: true }
		)
	),
	dateControlScenario(
		"date-range-picker-component",
		"date-range-picker",
		"focus",
		"rest",
		dateRangeModelCapture,
		dateControlPayload(
			dateRangeModelFixture,
			dateRangeModelComponent,
			dateRangeModelInputs,
			{ kind: "initial" },
			{
				focusedSelector: dateRangeModelInputs[0],
				focusVisible: false
			}
		)
	),
	dateControlScenario(
		"date-range-picker-component",
		"date-range-picker",
		"focus",
		"keyboard",
		dateRangeModelCapture,
		dateControlPayload(
			dateRangeModelFixture,
			dateRangeModelComponent,
			dateRangeModelInputs,
			{ kind: "keyboard-focus", selector: dateRangeModelInputs[0] },
			{ focusedSelector: dateRangeModelInputs[0], focusVisible: true }
		)
	),
	dateControlScenario(
		"date-time-picker-component",
		"date-time-picker",
		"content",
		"empty",
		dateTimeModelCapture,
		dateControlPayload(
			dateTimeModelFixture,
			dateTimeModelComponent,
			dateTimeModelInputs,
			{ kind: "initial" },
			{
				separateDateAndTime: true,
				values: ["", ""]
			}
		)
	),
	dateControlScenario(
		"date-time-picker-component",
		"date-time-picker",
		"content",
		"populated",
		dateTimeReactiveCapture,
		dateControlPayload(
			dateTimeReactiveFixture,
			dateTimeReactiveComponent,
			dateTimeReactiveInputs,
			{ kind: "initial" },
			{
				separateDateAndTime: true,
				values: ["January 2, 2020", "03:04"]
			}
		)
	),
	dateControlScenario(
		"date-time-picker-component",
		"date-time-picker",
		"availability",
		"enabled",
		dateTimeReactiveCapture,
		dateControlPayload(
			dateTimeReactiveFixture,
			dateTimeReactiveComponent,
			dateTimeReactiveInputs,
			{ kind: "initial" },
			{
				disabled: false,
				separateDateAndTime: true
			}
		)
	),
	dateControlScenario(
		"date-time-picker-component",
		"date-time-picker",
		"availability",
		"disabled",
		dateTimeReactiveCapture,
		dateControlPayload(
			dateTimeReactiveFixture,
			dateTimeReactiveComponent,
			dateTimeReactiveInputs,
			{ kind: "toggle-disabled", selector: `${dateTimeReactiveFixture} mat-checkbox input` },
			{ disabled: true, separateDateAndTime: true }
		)
	),
	dateControlScenario(
		"date-time-picker-component",
		"date-time-picker",
		"validity",
		"valid",
		dateTimeReactiveCapture,
		dateControlPayload(
			dateTimeReactiveFixture,
			dateTimeReactiveComponent,
			dateTimeReactiveInputs,
			{ kind: "initial" },
			{
				invalidFieldCount: 0,
				separateDateAndTime: true
			}
		)
	),
	dateControlScenario(
		"date-time-picker-component",
		"date-time-picker",
		"validity",
		"invalid",
		dateTimeReactiveCapture,
		dateControlPayload(
			dateTimeReactiveFixture,
			dateTimeReactiveComponent,
			dateTimeReactiveInputs,
			{ kind: "fill-input", selector: dateTimeReactiveInputs[1], value: "1", blur: true },
			{ invalidFieldCount: 1, separateDateAndTime: true, values: ["January 2, 2020", "1_:__"] }
		)
	),
	dateControlScenario(
		"date-time-picker-component",
		"date-time-picker",
		"overlay",
		"closed",
		dateTimeReactiveCapture,
		dateControlPayload(
			dateTimeReactiveFixture,
			dateTimeReactiveComponent,
			dateTimeReactiveInputs,
			{ kind: "initial" },
			{
				overlayOpen: false,
				separateDateAndTime: true
			}
		)
	),
	dateControlScenario(
		"date-time-picker-component",
		"date-time-picker",
		"overlay",
		"open",
		calendarSelector,
		dateControlPayload(
			dateTimeReactiveFixture,
			dateTimeReactiveComponent,
			dateTimeReactiveInputs,
			{ kind: "open-calendar", selector: `${dateTimeReactiveComponent} button[aria-label="Open calendar"]` },
			{ calendarDisabledDates: true, overlayOpen: true, separateDateAndTime: true }
		)
	),
	dateControlScenario(
		"date-time-picker-component",
		"date-time-picker",
		"focus",
		"rest",
		dateTimeReactiveCapture,
		dateControlPayload(
			dateTimeReactiveFixture,
			dateTimeReactiveComponent,
			dateTimeReactiveInputs,
			{ kind: "initial" },
			{
				focusedSelector: dateTimeReactiveInputs[0],
				focusVisible: false,
				separateDateAndTime: true
			}
		)
	),
	dateControlScenario(
		"date-time-picker-component",
		"date-time-picker",
		"focus",
		"keyboard",
		dateTimeReactiveCapture,
		dateControlPayload(
			dateTimeReactiveFixture,
			dateTimeReactiveComponent,
			dateTimeReactiveInputs,
			{ kind: "keyboard-focus", selector: dateTimeReactiveInputs[0] },
			{ focusedSelector: dateTimeReactiveInputs[0], focusVisible: true, separateDateAndTime: true }
		)
	)
];

type InputFamilySurfaceId =
	| "dropdown-component"
	| "slider-component"
	| "email-mask-directive"
	| "number-mask-directive"
	| "text-mask-directive"
	| "timestamp-mask-directive"
	| "restrict-input-directive"
	| "transform-input-directive";

const inputFamilyScenario = (
	surfaceId: InputFamilySurfaceId,
	routeId: Extract<
		VisualRouteId,
		"dropdown" | "slider" | "input-mask-directives" | "restrict-input-directive" | "transform-input-directive"
	>,
	axis: VisualStateAxis,
	state: string,
	captureSelector: string,
	payload: InputFamilyStateScenario["payload"]
): InputFamilyStateScenario => {
	const id = `${surfaceId.replace(/-(?:component|directive)$/u, "")}-${axis}-${state}`;
	return {
		id,
		sourceStateId: `${surfaceId}.${axis}.${state}`,
		surfaceId,
		axis,
		state,
		ownerBead: "stark-4sp.4.5",
		routeId,
		runner: "input-family-states",
		capture: { scope: "component", selector: captureSelector },
		snapshotName: `${id}.png`,
		maskSelectors: [],
		maxDiffPixels: reviewedVisualDiffBudgets[id] ?? 0,
		threshold: 0,
		payload
	};
};

const inputPayload = (
	fixtureSelector: string,
	targetSelector: string,
	action: InputFamilyStateScenario["payload"]["action"] = { kind: "initial" },
	expected: InputFamilyStateScenario["payload"]["expected"] = {}
): InputFamilyStateScenario["payload"] => ({ fixtureSelector, targetSelector, action, expected });

const dropdownFixture = "example-viewer#reactive-form";
const dropdownTarget = `${dropdownFixture} mat-select#reactiveFormDropdown`;
const dropdownField = `${dropdownFixture} mat-form-field`;
const dropdownPanel = '.cdk-overlay-pane [role="listbox"]';
const sliderFixture = "example-viewer#horizontal";
const sliderTarget = `${sliderFixture} .noUi-handle`;
const sliderCapture = `${sliderFixture} stark-slider`;
const textMaskFixture = "example-viewer#text-mask-directive";
const numberMaskFixture = "example-viewer#number-mask-directive";
const emailMaskFixture = "example-viewer#email-mask-directive";
const timestampMaskFixture = "example-viewer#timestamp-mask-directive";
const restrictInputFixture = "example-viewer#demo";
const transformInputFixture = "example-viewer#demo";
const fieldContaining = (targetSelector: string): string => `mat-form-field:has(${targetSelector})`;
const inputFamilyScenarios: readonly InputFamilyStateScenario[] = [
	inputFamilyScenario(
		"dropdown-component",
		"dropdown",
		"content",
		"populated",
		dropdownPanel,
		inputPayload(dropdownFixture, dropdownTarget, { kind: "open-select" }, { overlayOpen: true })
	),
	inputFamilyScenario(
		"dropdown-component",
		"dropdown",
		"availability",
		"enabled",
		"example-viewer#white-color mat-form-field",
		inputPayload(
			"example-viewer#white-color",
			"example-viewer#white-color mat-select#serviceWhiteDropdown",
			{ kind: "initial" },
			{ disabled: false }
		)
	),
	inputFamilyScenario(
		"dropdown-component",
		"dropdown",
		"availability",
		"disabled",
		"example-viewer#disabled mat-form-field",
		inputPayload(
			"example-viewer#disabled",
			"example-viewer#disabled mat-select#disabledDropdown",
			{ kind: "initial" },
			{ disabled: true }
		)
	),
	inputFamilyScenario(
		"dropdown-component",
		"dropdown",
		"validity",
		"valid",
		dropdownField,
		inputPayload(
			dropdownFixture,
			dropdownTarget,
			{ kind: "select-option", optionName: "IT applications" },
			{ invalid: false, selectedText: "IT applications" }
		)
	),
	inputFamilyScenario(
		"dropdown-component",
		"dropdown",
		"validity",
		"invalid",
		dropdownField,
		inputPayload(dropdownFixture, dropdownTarget, { kind: "blur" }, { invalid: true, selectedText: "" })
	),
	inputFamilyScenario(
		"dropdown-component",
		"dropdown",
		"selection",
		"unselected",
		dropdownField,
		inputPayload(dropdownFixture, dropdownTarget, { kind: "initial" }, { selectedText: "" })
	),
	inputFamilyScenario(
		"dropdown-component",
		"dropdown",
		"selection",
		"selected",
		dropdownField,
		inputPayload(
			dropdownFixture,
			dropdownTarget,
			{ kind: "select-option", optionName: "IT applications" },
			{ selectedText: "IT applications" }
		)
	),
	inputFamilyScenario(
		"dropdown-component",
		"dropdown",
		"overlay",
		"closed",
		dropdownField,
		inputPayload(dropdownFixture, dropdownTarget, { kind: "initial" }, { overlayOpen: false })
	),
	inputFamilyScenario(
		"dropdown-component",
		"dropdown",
		"overlay",
		"open",
		dropdownPanel,
		inputPayload(dropdownFixture, dropdownTarget, { kind: "open-select" }, { overlayOpen: true })
	),
	inputFamilyScenario(
		"dropdown-component",
		"dropdown",
		"focus",
		"rest",
		dropdownField,
		inputPayload(dropdownFixture, dropdownTarget, { kind: "initial" }, { focusVisible: false, focused: false })
	),
	inputFamilyScenario(
		"dropdown-component",
		"dropdown",
		"focus",
		"keyboard",
		dropdownField,
		inputPayload(dropdownFixture, dropdownTarget, { kind: "keyboard-focus" }, { focusVisible: true, focused: true })
	),
	inputFamilyScenario(
		"slider-component",
		"slider",
		"content",
		"single-value",
		sliderCapture,
		inputPayload(sliderFixture, sliderTarget, { kind: "initial" }, { sliderValues: ["100.0"] })
	),
	inputFamilyScenario(
		"slider-component",
		"slider",
		"content",
		"range-values",
		"example-viewer#horizontal-range stark-slider",
		inputPayload(
			"example-viewer#horizontal-range",
			"example-viewer#horizontal-range .noUi-handle",
			{ kind: "initial" },
			{ sliderValues: ["100.0", "900.0"] }
		)
	),
	inputFamilyScenario(
		"slider-component",
		"slider",
		"availability",
		"enabled",
		sliderCapture,
		inputPayload(sliderFixture, sliderTarget, { kind: "initial" }, { disabled: false, sliderValues: ["100.0"] })
	),
	inputFamilyScenario(
		"slider-component",
		"slider",
		"availability",
		"disabled",
		sliderCapture,
		inputPayload(
			sliderFixture,
			sliderTarget,
			{ kind: "toggle-checkbox", selector: `${sliderFixture} mat-checkbox` },
			{ disabled: true, sliderValues: ["100.0"] }
		)
	),
	inputFamilyScenario(
		"slider-component",
		"slider",
		"selection",
		"minimum",
		sliderCapture,
		inputPayload(sliderFixture, sliderTarget, { kind: "slider-key", key: "Home" }, { sliderValues: ["0.0"] })
	),
	inputFamilyScenario(
		"slider-component",
		"slider",
		"selection",
		"middle",
		sliderCapture,
		inputPayload(
			sliderFixture,
			sliderTarget,
			{ kind: "slider-value", inputSelector: `${sliderFixture} input[type="number"]`, value: "500" },
			{ sliderValues: ["500.0"] }
		)
	),
	inputFamilyScenario(
		"slider-component",
		"slider",
		"selection",
		"maximum",
		sliderCapture,
		inputPayload(sliderFixture, sliderTarget, { kind: "slider-key", key: "End" }, { sliderValues: ["1000.0"] })
	),
	inputFamilyScenario(
		"slider-component",
		"slider",
		"focus",
		"rest",
		sliderCapture,
		inputPayload(sliderFixture, sliderTarget, { kind: "initial" }, { focusVisible: false, focused: false, sliderValues: ["100.0"] })
	),
	inputFamilyScenario(
		"slider-component",
		"slider",
		"focus",
		"keyboard-focus",
		sliderCapture,
		inputPayload(
			sliderFixture,
			sliderTarget,
			{ kind: "keyboard-focus" },
			{ focusVisible: true, focused: true, sliderValues: ["100.0"] }
		)
	),
	...(
		[
			["email-mask-directive", emailMaskFixture, "#email-input-mask", "content", "empty", { kind: "initial" }, { value: "" }],
			[
				"email-mask-directive",
				emailMaskFixture,
				"#email-input-mask",
				"content",
				"populated",
				{ kind: "type", value: "test@example.com" },
				{ value: "test@example.com" }
			],
			[
				"email-mask-directive",
				emailMaskFixture,
				"#email-input-mask",
				"availability",
				"enabled",
				{ kind: "initial" },
				{ disabled: false, value: "" }
			],
			[
				"email-mask-directive",
				emailMaskFixture,
				"#email-input-mask",
				"validity",
				"accepted",
				{ kind: "type", value: "test@example.com" },
				{ value: "test@example.com" }
			],
			[
				"email-mask-directive",
				emailMaskFixture,
				"#email-input-mask",
				"validity",
				"rejected",
				{ kind: "type", value: "test example.com" },
				{ value: "testexample.com@ ." }
			],
			[
				"email-mask-directive",
				emailMaskFixture,
				"#email-input-mask",
				"focus",
				"rest",
				{ kind: "initial" },
				{ focusVisible: false, focused: false, value: "" }
			],
			[
				"email-mask-directive",
				emailMaskFixture,
				"#email-input-mask",
				"focus",
				"keyboard",
				{ kind: "keyboard-focus" },
				{ focusVisible: true, focused: true, value: "" }
			],
			["number-mask-directive", numberMaskFixture, "#euros-input-mask", "content", "empty", { kind: "initial" }, { value: "" }],
			[
				"number-mask-directive",
				numberMaskFixture,
				"#euros-input-mask",
				"content",
				"integer",
				{ kind: "type", value: "1234" },
				{ value: "1,234 €" }
			],
			[
				"number-mask-directive",
				numberMaskFixture,
				"#percentage-input-mask",
				"content",
				"decimal-negative",
				{ kind: "type", value: "-12.3456" },
				{ value: "-% 12.345" }
			],
			[
				"number-mask-directive",
				numberMaskFixture,
				"#euros-input-mask",
				"availability",
				"configured",
				{ kind: "initial" },
				{ disabled: false, value: "" }
			],
			[
				"number-mask-directive",
				numberMaskFixture,
				"#euros-input-mask",
				"validity",
				"accepted",
				{ kind: "type", value: "1234.56" },
				{ value: "1,234.56 €" }
			],
			[
				"number-mask-directive",
				numberMaskFixture,
				"#euros-input-mask",
				"validity",
				"rejected",
				{ kind: "type", value: "abc" },
				{ value: "" }
			],
			[
				"number-mask-directive",
				numberMaskFixture,
				"#euros-input-mask",
				"focus",
				"rest",
				{ kind: "initial" },
				{ focusVisible: false, focused: false, value: "" }
			],
			[
				"number-mask-directive",
				numberMaskFixture,
				"#euros-input-mask",
				"focus",
				"keyboard",
				{ kind: "keyboard-focus" },
				{ focusVisible: true, focused: true, value: "" }
			],
			["text-mask-directive", textMaskFixture, "#credit-card-input-mask", "content", "empty", { kind: "initial" }, { value: "" }],
			[
				"text-mask-directive",
				textMaskFixture,
				"#credit-card-input-mask",
				"content",
				"partial",
				{ kind: "type", value: "1234" },
				{ value: "1234-____-____-____" }
			],
			[
				"text-mask-directive",
				textMaskFixture,
				"#credit-card-input-mask",
				"content",
				"complete",
				{ kind: "type", value: "1234567812345678" },
				{ value: "1234-5678-1234-5678" }
			],
			[
				"text-mask-directive",
				textMaskFixture,
				"#credit-card-input-mask",
				"availability",
				"enabled",
				{ kind: "initial" },
				{ disabled: false, value: "" }
			],
			[
				"text-mask-directive",
				textMaskFixture,
				"#credit-card-input-mask",
				"validity",
				"accepted",
				{ kind: "type", value: "1234567812345678" },
				{ value: "1234-5678-1234-5678" }
			],
			[
				"text-mask-directive",
				textMaskFixture,
				"#credit-card-input-mask",
				"validity",
				"rejected",
				{ kind: "type", value: "1234A567812345678" },
				{ value: "1234-5678-1234-5678" }
			],
			[
				"text-mask-directive",
				textMaskFixture,
				"#credit-card-input-mask",
				"focus",
				"rest",
				{ kind: "initial" },
				{ focusVisible: false, focused: false, value: "" }
			],
			[
				"text-mask-directive",
				textMaskFixture,
				"#credit-card-input-mask",
				"focus",
				"keyboard",
				{ kind: "keyboard-focus" },
				{ focusVisible: true, focused: true, value: "" }
			],
			[
				"timestamp-mask-directive",
				timestampMaskFixture,
				"#full-date-input-mask",
				"content",
				"empty",
				{ kind: "initial" },
				{ value: "" }
			],
			[
				"timestamp-mask-directive",
				timestampMaskFixture,
				"#full-date-input-mask",
				"content",
				"partial",
				{ kind: "type", value: "3112" },
				{ value: "31-12-____" }
			],
			[
				"timestamp-mask-directive",
				timestampMaskFixture,
				"#full-date-input-mask",
				"content",
				"complete",
				{ kind: "type", value: "31122026" },
				{ value: "31-12-2026" }
			],
			[
				"timestamp-mask-directive",
				timestampMaskFixture,
				"#full-date-input-mask",
				"availability",
				"configured",
				{ kind: "initial" },
				{ disabled: false, value: "" }
			],
			[
				"timestamp-mask-directive",
				timestampMaskFixture,
				"#full-date-input-mask",
				"validity",
				"accepted",
				{ kind: "type", value: "31122026" },
				{ value: "31-12-2026" }
			],
			[
				"timestamp-mask-directive",
				timestampMaskFixture,
				"#full-date-input-mask",
				"validity",
				"rejected",
				{ kind: "type", value: "99132026" },
				{ value: "9_-__-____" }
			],
			[
				"timestamp-mask-directive",
				timestampMaskFixture,
				"#full-date-input-mask",
				"focus",
				"rest",
				{ kind: "initial" },
				{ focusVisible: false, focused: false, value: "" }
			],
			[
				"timestamp-mask-directive",
				timestampMaskFixture,
				"#full-date-input-mask",
				"focus",
				"keyboard",
				{ kind: "keyboard-focus" },
				{ focusVisible: true, focused: true, value: "" }
			]
		] as const
	).map(([surfaceId, fixture, target, axis, state, action, expected]) =>
		inputFamilyScenario(
			surfaceId,
			"input-mask-directives",
			axis,
			state,
			fieldContaining(target),
			inputPayload(fixture, target, action, expected)
		)
	),
	...(
		[
			["content", "empty", { kind: "initial" }, { value: "" }],
			["content", "populated", { kind: "type", value: "123" }, { value: "123" }],
			["validity", "allowed-key", { kind: "type", value: "123" }, { value: "123" }],
			["validity", "rejected-key", { kind: "type", value: "12a3" }, { value: "123" }],
			["validity", "rejected-paste", { kind: "paste", value: "abc" }, { transferPrevented: true, value: "" }],
			["validity", "rejected-drop", { kind: "drop", value: "abc" }, { transferPrevented: true, value: "" }],
			["focus", "rest", { kind: "initial" }, { focusVisible: false, focused: false, value: "" }],
			["focus", "keyboard", { kind: "keyboard-focus" }, { focusVisible: true, focused: true, value: "" }]
		] as const
	).map(([axis, state, action, expected]) => {
		const target = `${restrictInputFixture} mat-form-field:nth-of-type(1) input`;
		return inputFamilyScenario(
			"restrict-input-directive",
			"restrict-input-directive",
			axis,
			state,
			`${restrictInputFixture} mat-form-field:nth-of-type(1)`,
			inputPayload(restrictInputFixture, target, action, expected)
		);
	}),
	...(
		[
			["content", "empty", 1, { kind: "initial" }, { value: "" }],
			["content", "populated", 1, { kind: "type", value: "Ab c" }, { value: "AB C" }],
			["selection", "uppercase", 1, { kind: "type", value: "Ab c" }, { value: "AB C" }],
			["selection", "lowercase", 2, { kind: "type", value: "Ab C" }, { value: "ab c" }],
			["selection", "custom", 3, { kind: "type", value: ":rocket:" }, { value: "🚀" }],
			["focus", "rest", 1, { kind: "initial" }, { focusVisible: false, focused: false, value: "" }],
			["focus", "keyboard", 1, { kind: "keyboard-focus" }, { focusVisible: true, focused: true, value: "" }]
		] as const
	).map(([axis, state, field, action, expected]) => {
		const target = `${transformInputFixture} mat-form-field:nth-of-type(${field}) input`;
		return inputFamilyScenario(
			"transform-input-directive",
			"transform-input-directive",
			axis,
			state,
			`${transformInputFixture} mat-form-field:nth-of-type(${field})`,
			inputPayload(transformInputFixture, target, action, expected)
		);
	})
];

const feedbackScenario = (
	surfaceId: VisualSurfaceId,
	routeId: VisualRouteId,
	axis: VisualStateAxis,
	state: string,
	captureSelector: string,
	payload: FeedbackStateScenario["payload"]
): FeedbackStateScenario => {
	const id = `${surfaceId}-${axis}-${state}`;
	return {
		id,
		sourceStateId: `${surfaceId}.${axis}.${state}`,
		surfaceId,
		axis,
		state,
		ownerBead: "stark-4sp.4.7",
		routeId,
		runner: "feedback-states",
		capture: { scope: "component", selector: captureSelector },
		snapshotName: `${id}.png`,
		maskSelectors: [],
		maxDiffPixels: reviewedVisualDiffBudgets[id] ?? 0,
		threshold: 0,
		payload
	};
};

const dialogFixture = "example-viewer#demo";
const dialogTriggers = `${dialogFixture} .dialog-demo-content button`;
const dialogClosedCapture = `${dialogFixture} .dialog-demo-content`;
const dialogResultCapture = `${dialogFixture} .demo-prompt-dialog-status`;
const dialogRoot = '[role="dialog"]';

const openDialogSteps = (index: number): FeedbackStateScenario["payload"]["steps"] => [{ kind: "click", selector: dialogTriggers, index }];
const keyboardOpenDialogSteps = (index: number): FeedbackStateScenario["payload"]["steps"] => [
	{ kind: "keyboard-activate", selector: `${dialogTriggers}:nth-of-type(${index + 1})` }
];
const openDialogAssertions = (componentSelector: string, containsText: string): FeedbackStateScenario["payload"]["assertions"] => [
	{ selector: dialogRoot, count: 1, visible: true, withinViewport: true },
	{ selector: componentSelector, count: 1, visible: true, containsText }
];

const dialogFeedbackScenarios: readonly FeedbackStateScenario[] = [
	feedbackScenario("alert-dialog-component", "dialogs", "content", "short-message", dialogRoot, {
		fixtureSelector: dialogFixture,
		steps: openDialogSteps(0),
		assertions: openDialogAssertions("stark-alert-dialog", "This is an alert title")
	}),
	feedbackScenario("alert-dialog-component", "dialogs", "content", "long-message", dialogRoot, {
		fixtureSelector: dialogFixture,
		steps: openDialogSteps(0),
		assertions: openDialogAssertions("stark-alert-dialog", "You can specify some description text in here.")
	}),
	feedbackScenario("alert-dialog-component", "dialogs", "overlay", "closed", dialogClosedCapture, {
		fixtureSelector: dialogFixture,
		steps: [],
		assertions: [{ selector: dialogRoot, count: 0 }]
	}),
	feedbackScenario("alert-dialog-component", "dialogs", "overlay", "open", dialogRoot, {
		fixtureSelector: dialogFixture,
		steps: openDialogSteps(0),
		assertions: openDialogAssertions("stark-alert-dialog", "Got it!")
	}),
	feedbackScenario("alert-dialog-component", "dialogs", "focus", "rest", dialogRoot, {
		fixtureSelector: dialogFixture,
		steps: openDialogSteps(0),
		assertions: [
			...openDialogAssertions("stark-alert-dialog", "Got it!"),
			{ selector: `${dialogRoot} .button-ok`, focused: true, focusVisible: false }
		]
	}),
	feedbackScenario("alert-dialog-component", "dialogs", "focus", "keyboard", dialogRoot, {
		fixtureSelector: dialogFixture,
		steps: keyboardOpenDialogSteps(0),
		assertions: [
			...openDialogAssertions("stark-alert-dialog", "Got it!"),
			{ selector: `${dialogRoot} .button-ok`, focused: true, focusVisible: true }
		]
	}),
	feedbackScenario("confirm-dialog-component", "dialogs", "content", "default-copy", dialogRoot, {
		fixtureSelector: dialogFixture,
		steps: openDialogSteps(1),
		assertions: openDialogAssertions("stark-confirm-dialog", "Would you like to delete your debt?")
	}),
	feedbackScenario("confirm-dialog-component", "dialogs", "content", "custom-copy", dialogRoot, {
		fixtureSelector: dialogFixture,
		steps: openDialogSteps(1),
		assertions: openDialogAssertions("stark-confirm-dialog", "All of the banks have agreed to forgive you your debts.")
	}),
	feedbackScenario("confirm-dialog-component", "dialogs", "selection", "cancel", dialogResultCapture, {
		fixtureSelector: dialogFixture,
		steps: [...openDialogSteps(1), { kind: "click", selector: `${dialogRoot} .button-cancel` }],
		assertions: [
			{ selector: dialogRoot, count: 0 },
			{ selector: dialogResultCapture, count: 1, visible: true, text: "You decided to keep your debt." }
		]
	}),
	feedbackScenario("confirm-dialog-component", "dialogs", "selection", "confirm", dialogResultCapture, {
		fixtureSelector: dialogFixture,
		steps: [...openDialogSteps(1), { kind: "click", selector: `${dialogRoot} .button-ok` }],
		assertions: [
			{ selector: dialogRoot, count: 0 },
			{ selector: dialogResultCapture, count: 1, visible: true, text: "You decided to get rid of your debt." }
		]
	}),
	feedbackScenario("confirm-dialog-component", "dialogs", "overlay", "closed", dialogClosedCapture, {
		fixtureSelector: dialogFixture,
		steps: [],
		assertions: [{ selector: dialogRoot, count: 0 }]
	}),
	feedbackScenario("confirm-dialog-component", "dialogs", "overlay", "open", dialogRoot, {
		fixtureSelector: dialogFixture,
		steps: openDialogSteps(1),
		assertions: openDialogAssertions("stark-confirm-dialog", "Please do it!")
	}),
	feedbackScenario("confirm-dialog-component", "dialogs", "focus", "rest", dialogRoot, {
		fixtureSelector: dialogFixture,
		steps: openDialogSteps(1),
		assertions: [
			...openDialogAssertions("stark-confirm-dialog", "Please do it!"),
			{ selector: `${dialogRoot} .button-ok`, focused: true, focusVisible: false }
		]
	}),
	feedbackScenario("confirm-dialog-component", "dialogs", "focus", "keyboard", dialogRoot, {
		fixtureSelector: dialogFixture,
		steps: keyboardOpenDialogSteps(1),
		assertions: [
			...openDialogAssertions("stark-confirm-dialog", "Please do it!"),
			{ selector: `${dialogRoot} .button-ok`, focused: true, focusVisible: true }
		]
	}),
	feedbackScenario("prompt-dialog-component", "dialogs", "content", "empty", dialogRoot, {
		fixtureSelector: dialogFixture,
		steps: openDialogSteps(2),
		assertions: [
			...openDialogAssertions("stark-prompt-dialog", "Bowser is a common name."),
			{ selector: `${dialogRoot} input`, value: "" }
		]
	}),
	feedbackScenario("prompt-dialog-component", "dialogs", "content", "populated", dialogRoot, {
		fixtureSelector: dialogFixture,
		steps: [...openDialogSteps(2), { kind: "fill", selector: `${dialogRoot} input`, value: "Rex" }],
		assertions: [
			...openDialogAssertions("stark-prompt-dialog", "Bowser is a common name."),
			{ selector: `${dialogRoot} input`, value: "Rex" }
		]
	}),
	feedbackScenario("prompt-dialog-component", "dialogs", "availability", "accept-disabled", dialogRoot, {
		fixtureSelector: dialogFixture,
		steps: openDialogSteps(2),
		assertions: [...openDialogAssertions("stark-prompt-dialog", "Okay!"), { selector: `${dialogRoot} .button-ok`, disabled: true }]
	}),
	feedbackScenario("prompt-dialog-component", "dialogs", "availability", "accept-enabled", dialogRoot, {
		fixtureSelector: dialogFixture,
		steps: [...openDialogSteps(2), { kind: "fill", selector: `${dialogRoot} input`, value: "Rex" }],
		assertions: [...openDialogAssertions("stark-prompt-dialog", "Okay!"), { selector: `${dialogRoot} .button-ok`, disabled: false }]
	}),
	feedbackScenario("prompt-dialog-component", "dialogs", "selection", "cancel", dialogResultCapture, {
		fixtureSelector: dialogFixture,
		steps: [...openDialogSteps(2), { kind: "click", selector: `${dialogRoot} .button-cancel` }],
		assertions: [
			{ selector: dialogRoot, count: 0 },
			{ selector: dialogResultCapture, count: 1, visible: true, text: "You didn't name your dog." }
		]
	}),
	feedbackScenario("prompt-dialog-component", "dialogs", "selection", "accept", dialogResultCapture, {
		fixtureSelector: dialogFixture,
		steps: [
			...openDialogSteps(2),
			{ kind: "fill", selector: `${dialogRoot} input`, value: "Rex" },
			{ kind: "click", selector: `${dialogRoot} .button-ok` }
		],
		assertions: [
			{ selector: dialogRoot, count: 0 },
			{ selector: dialogResultCapture, count: 1, visible: true, text: "You decided to name your dog 'Rex'" }
		]
	}),
	feedbackScenario("prompt-dialog-component", "dialogs", "overlay", "closed", dialogClosedCapture, {
		fixtureSelector: dialogFixture,
		steps: [],
		assertions: [{ selector: dialogRoot, count: 0 }]
	}),
	feedbackScenario("prompt-dialog-component", "dialogs", "overlay", "open", dialogRoot, {
		fixtureSelector: dialogFixture,
		steps: openDialogSteps(2),
		assertions: openDialogAssertions("stark-prompt-dialog", "Dog name")
	}),
	feedbackScenario("prompt-dialog-component", "dialogs", "focus", "rest", dialogRoot, {
		fixtureSelector: dialogFixture,
		steps: openDialogSteps(2),
		assertions: [
			...openDialogAssertions("stark-prompt-dialog", "Dog name"),
			{ selector: `${dialogRoot} input`, focused: true, focusVisible: true }
		]
	}),
	feedbackScenario("prompt-dialog-component", "dialogs", "focus", "keyboard", dialogRoot, {
		fixtureSelector: dialogFixture,
		steps: keyboardOpenDialogSteps(2),
		assertions: [
			...openDialogAssertions("stark-prompt-dialog", "Dog name"),
			{ selector: `${dialogRoot} input`, focused: true, focusVisible: true }
		]
	})
];

const messagePaneFixture = "example-viewer#demo";
const messagePane = "stark-message-pane.stark-message-pane";
const messagePaneActions = `${messagePaneFixture} .message-pane-demo-actions button`;
const messagePaneClosedCapture = `${messagePaneFixture} .message-pane-demo-actions`;
const messagePaneOpenCapture = `${messagePane} > .inner`;
const showMessages = { kind: "click", selector: messagePaneActions, index: 0 } as const;
const messagePaneAssertions = (activeCategory?: "errors" | "warnings" | "infos"): FeedbackStateScenario["payload"]["assertions"] => [
	{ selector: messagePane, count: 1, classes: ["displayed", "display-animated"] },
	{ selector: messagePaneOpenCapture, count: 1, visible: true, withinViewport: true },
	{ selector: `${messagePane} button.errors.tab`, count: 1, text: "3", classes: activeCategory === "errors" ? ["active"] : [] },
	{ selector: `${messagePane} button.warnings.tab`, count: 1, text: "2", classes: activeCategory === "warnings" ? ["active"] : [] },
	{ selector: `${messagePane} button.infos.tab`, count: 1, text: "2", classes: activeCategory === "infos" ? ["active"] : [] },
	{ selector: `${messagePane} .stark-message-pane-total`, count: 1, text: "7" }
];

const messagePaneFeedbackScenarios: readonly FeedbackStateScenario[] = [
	feedbackScenario("message-pane-component", "message-pane", "content", "empty", messagePaneClosedCapture, {
		fixtureSelector: messagePaneFixture,
		steps: [],
		assertions: [
			{ selector: messagePane, count: 1, visible: false, absentClasses: ["displayed"] },
			{ selector: `${messagePane} .stark-message-pane-total`, count: 1, text: "0" }
		]
	}),
	feedbackScenario("message-pane-component", "message-pane", "content", "populated", messagePaneOpenCapture, {
		fixtureSelector: messagePaneFixture,
		steps: [showMessages, { kind: "click", selector: `${messagePane} button.errors.tab` }],
		assertions: [
			...messagePaneAssertions("errors"),
			{ selector: `${messagePane} .stark-message-pane-item-error`, count: 3, visible: true }
		]
	}),
	feedbackScenario("message-pane-component", "message-pane", "disclosure", "hidden", messagePaneClosedCapture, {
		fixtureSelector: messagePaneFixture,
		steps: [],
		assertions: [{ selector: messagePane, count: 1, visible: false, absentClasses: ["displayed"] }]
	}),
	feedbackScenario("message-pane-component", "message-pane", "disclosure", "visible", messagePaneOpenCapture, {
		fixtureSelector: messagePaneFixture,
		steps: [showMessages],
		assertions: messagePaneAssertions()
	}),
	...(["errors", "warnings", "infos"] as const).map((category) =>
		feedbackScenario("message-pane-component", "message-pane", "selection", category, messagePaneOpenCapture, {
			fixtureSelector: messagePaneFixture,
			steps: [showMessages, { kind: "click", selector: `${messagePane} button.${category}.tab` }],
			assertions: [
				...messagePaneAssertions(category),
				{
					selector: `${messagePane} .stark-message-pane-item-${category === "infos" ? "info" : category.slice(0, -1)}`,
					count: category === "errors" ? 3 : 2,
					visible: true
				}
			]
		})
	),
	feedbackScenario("message-pane-component", "message-pane", "focus", "rest", messagePaneOpenCapture, {
		fixtureSelector: messagePaneFixture,
		steps: [showMessages],
		assertions: [...messagePaneAssertions(), { selector: `${messagePane} button.errors.tab`, focused: false, focusVisible: false }]
	}),
	feedbackScenario("message-pane-component", "message-pane", "focus", "keyboard", messagePaneOpenCapture, {
		fixtureSelector: messagePaneFixture,
		steps: [showMessages, { kind: "keyboard-focus", selector: `${messagePane} button.errors.tab` }],
		assertions: [...messagePaneAssertions(), { selector: `${messagePane} button.errors.tab`, focused: true, focusVisible: true }]
	}),
	feedbackScenario("message-pane-service", "message-pane", "content", "empty", messagePaneClosedCapture, {
		fixtureSelector: messagePaneFixture,
		steps: [],
		assertions: [{ selector: `${messagePane} .stark-message-pane-total`, count: 1, text: "0" }]
	}),
	feedbackScenario("message-pane-service", "message-pane", "content", "populated", messagePaneOpenCapture, {
		fixtureSelector: messagePaneFixture,
		steps: [showMessages],
		assertions: messagePaneAssertions()
	}),
	feedbackScenario("message-pane-service", "message-pane", "content", "cleared", messagePaneClosedCapture, {
		fixtureSelector: messagePaneFixture,
		steps: [showMessages, { kind: "click", selector: messagePaneActions, index: 1 }, { kind: "wait", milliseconds: 600 }],
		assertions: [
			{ selector: messagePane, count: 1, visible: false, absentClasses: ["displayed"] },
			{ selector: `${messagePane} .stark-message-pane-total`, count: 1, text: "0" }
		]
	}),
	...(["error", "warning", "info"] as const).map((type) => {
		const category: "errors" | "warnings" | "infos" = type === "info" ? "infos" : `${type}s`;
		return feedbackScenario("message-pane-service", "message-pane", "selection", type, messagePaneOpenCapture, {
			fixtureSelector: messagePaneFixture,
			steps: [showMessages, { kind: "click", selector: `${messagePane} button.${category}.tab` }],
			assertions: messagePaneAssertions(category)
		});
	})
];

const progressFixture = "example-viewer#demo";
const progressCapture = `${progressFixture} mat-card-content`;
const progressButton = `${progressFixture} .progress-indicator-button`;
const progressContent = `${progressFixture} .progress-indicator-view`;
const progressIndicator = `${progressFixture} stark-progress-indicator`;
const progressAssertions = (visible: boolean): FeedbackStateScenario["payload"]["assertions"] => [
	{ selector: progressIndicator, count: visible ? 1 : 0 },
	{
		selector: progressContent,
		count: 1,
		visible: !visible,
		classes: visible ? ["stark-hide"] : [],
		absentClasses: visible ? [] : ["stark-hide"]
	},
	{ selector: progressButton, count: 1, text: visible ? "Hide" : "Show" }
];
const progressLoadingSteps = [{ kind: "click", selector: progressButton }] as const;
const progressCompletedSteps = [
	{ kind: "click", selector: progressButton },
	{ kind: "click", selector: progressButton }
] as const;

const progressFeedbackScenarios: readonly FeedbackStateScenario[] = [
	feedbackScenario("progress-indicator-component", "progress-indicator", "async", "hidden", progressCapture, {
		fixtureSelector: progressFixture,
		steps: [],
		assertions: progressAssertions(false)
	}),
	feedbackScenario("progress-indicator-component", "progress-indicator", "async", "visible", progressCapture, {
		fixtureSelector: progressFixture,
		steps: progressLoadingSteps,
		assertions: progressAssertions(true)
	}),
	feedbackScenario("progress-indicator-directive", "progress-indicator", "content", "spinner", progressCapture, {
		fixtureSelector: progressFixture,
		steps: progressLoadingSteps,
		assertions: [...progressAssertions(true), { selector: `${progressIndicator} .stark-loading-icon`, count: 1, visible: true }]
	}),
	feedbackScenario("progress-indicator-directive", "progress-indicator", "async", "idle", progressCapture, {
		fixtureSelector: progressFixture,
		steps: [],
		assertions: progressAssertions(false)
	}),
	feedbackScenario("progress-indicator-directive", "progress-indicator", "async", "loading", progressCapture, {
		fixtureSelector: progressFixture,
		steps: progressLoadingSteps,
		assertions: progressAssertions(true)
	}),
	feedbackScenario("progress-indicator-directive", "progress-indicator", "async", "completed", progressCapture, {
		fixtureSelector: progressFixture,
		steps: progressCompletedSteps,
		assertions: progressAssertions(false)
	}),
	feedbackScenario("progress-indicator-service", "progress-indicator", "async", "idle", progressCapture, {
		fixtureSelector: progressFixture,
		steps: [],
		assertions: progressAssertions(false)
	}),
	feedbackScenario("progress-indicator-service", "progress-indicator", "async", "loading", progressCapture, {
		fixtureSelector: progressFixture,
		steps: progressLoadingSteps,
		assertions: progressAssertions(true)
	}),
	feedbackScenario("progress-indicator-service", "progress-indicator", "async", "completed", progressCapture, {
		fixtureSelector: progressFixture,
		steps: progressCompletedSteps,
		assertions: progressAssertions(false)
	}),
	feedbackScenario("progress-indicator-service", "progress-indicator", "selection", "topic-a", progressCapture, {
		fixtureSelector: progressFixture,
		steps: progressLoadingSteps,
		assertions: progressAssertions(true)
	})
];

const toastFixture = "example-viewer#demo";
const toastButtons = `${toastFixture} .toast-demo-button`;
const toastContainer = ".mat-snack-bar-container, .mat-mdc-snack-bar-container";
const toastComponent = "stark-toast-notification.stark-toast-notification";
const toastSurface = `${toastComponent} .stark-toast`;
const toastStatus = `${toastFixture} .toast-demo-message`;
const toastOpenAssertions = (type: "info" | "warning" | "error", withAction: boolean): FeedbackStateScenario["payload"]["assertions"] => [
	{ selector: toastContainer, count: 1, visible: true, withinViewport: true },
	{ selector: toastComponent, count: 1, visible: true },
	{ selector: toastSurface, count: 1, classes: [`stark-toast-message-${type}`] },
	{ selector: `${toastSurface} .stark-toast-text`, count: 1, containsText: "Lorem ipsum dolor sit amet" },
	{ selector: `${toastSurface} .stark-toast-action`, count: withAction ? 1 : 0 }
];
const openToast = (index: number) => ({ kind: "click", selector: toastButtons, index }) as const;

const toastFeedbackScenarios: readonly FeedbackStateScenario[] = [
	feedbackScenario("toast-notification-component", "toast", "content", "message-only", toastContainer, {
		fixtureSelector: toastFixture,
		steps: [openToast(0)],
		assertions: toastOpenAssertions("info", false)
	}),
	feedbackScenario("toast-notification-component", "toast", "content", "with-action", toastContainer, {
		fixtureSelector: toastFixture,
		steps: [openToast(3)],
		assertions: toastOpenAssertions("info", true)
	}),
	feedbackScenario("toast-notification-component", "toast", "content", "long-message", toastContainer, {
		fixtureSelector: toastFixture,
		steps: [openToast(4)],
		assertions: toastOpenAssertions("info", false)
	}),
	feedbackScenario("toast-notification-component", "toast", "selection", "standard", toastContainer, {
		fixtureSelector: toastFixture,
		steps: [openToast(0)],
		assertions: toastOpenAssertions("info", false)
	}),
	feedbackScenario("toast-notification-component", "toast", "selection", "warning", toastContainer, {
		fixtureSelector: toastFixture,
		steps: [openToast(2)],
		assertions: toastOpenAssertions("warning", false)
	}),
	feedbackScenario("toast-notification-component", "toast", "selection", "error", toastContainer, {
		fixtureSelector: toastFixture,
		steps: [openToast(1)],
		assertions: toastOpenAssertions("error", false)
	}),
	feedbackScenario("toast-notification-component", "toast", "overlay", "closed", toastStatus, {
		fixtureSelector: toastFixture,
		steps: [],
		assertions: [
			{ selector: toastContainer, count: 0 },
			{ selector: toastStatus, count: 1, visible: true, text: "Click one button to test the toast notification." }
		]
	}),
	feedbackScenario("toast-notification-component", "toast", "overlay", "open", toastContainer, {
		fixtureSelector: toastFixture,
		steps: [openToast(3)],
		assertions: toastOpenAssertions("info", true)
	}),
	feedbackScenario("toast-notification-component", "toast", "focus", "rest", toastContainer, {
		fixtureSelector: toastFixture,
		steps: [openToast(3)],
		assertions: [
			...toastOpenAssertions("info", true),
			{ selector: `${toastSurface} .stark-toast-action`, focused: false, focusVisible: false }
		]
	}),
	feedbackScenario("toast-notification-component", "toast", "focus", "keyboard", toastContainer, {
		fixtureSelector: toastFixture,
		steps: [openToast(3), { kind: "keyboard-focus", selector: `${toastSurface} .stark-toast-action` }],
		assertions: [
			...toastOpenAssertions("info", true),
			{ selector: `${toastSurface} .stark-toast-action`, focused: true, focusVisible: true }
		]
	}),
	feedbackScenario("toast-notification-service", "toast", "content", "message-only", toastContainer, {
		fixtureSelector: toastFixture,
		steps: [openToast(0)],
		assertions: toastOpenAssertions("info", false)
	}),
	feedbackScenario("toast-notification-service", "toast", "content", "with-action", toastContainer, {
		fixtureSelector: toastFixture,
		steps: [openToast(3)],
		assertions: toastOpenAssertions("info", true)
	}),
	feedbackScenario("toast-notification-service", "toast", "async", "active", toastContainer, {
		fixtureSelector: toastFixture,
		steps: [openToast(3)],
		assertions: toastOpenAssertions("info", true)
	}),
	feedbackScenario("toast-notification-service", "toast", "async", "auto-dismissed", toastStatus, {
		fixtureSelector: toastFixture,
		steps: [openToast(5), { kind: "wait", milliseconds: 2500 }],
		assertions: [
			{ selector: toastContainer, count: 0 },
			{ selector: toastStatus, count: 1, visible: true, text: "Toast closed automatically after delay timeout." }
		]
	}),
	feedbackScenario("toast-notification-service", "toast", "async", "manually-dismissed", toastStatus, {
		fixtureSelector: toastFixture,
		steps: [openToast(4), { kind: "click", selector: toastButtons, index: 6 }],
		assertions: [
			{ selector: toastContainer, count: 0 },
			{ selector: toastStatus, count: 1, visible: true, text: "You closed the toast!" }
		]
	}),
	feedbackScenario("toast-notification-service", "toast", "overlay", "closed", toastStatus, {
		fixtureSelector: toastFixture,
		steps: [],
		assertions: [{ selector: toastContainer, count: 0 }]
	}),
	feedbackScenario("toast-notification-service", "toast", "overlay", "open", toastContainer, {
		fixtureSelector: toastFixture,
		steps: [openToast(3)],
		assertions: toastOpenAssertions("info", true)
	})
];

const feedbackScenarios: readonly FeedbackStateScenario[] = [
	...dialogFeedbackScenarios,
	...messagePaneFeedbackScenarios,
	...progressFeedbackScenarios,
	...toastFeedbackScenarios
];

export const tableSelectionPageIds = {
	1: ["1", "10", "12", "2", "23"],
	2: ["222", "112", "232", "154", "27"],
	3: ["86", "44"]
} as const;
const tableSelectionAllIds = [...tableSelectionPageIds[1], ...tableSelectionPageIds[2], ...tableSelectionPageIds[3]];
const tableSelectionFixtureSelector = "example-viewer#selection";
const tableSelectionCaptureSelector = `${tableSelectionFixtureSelector} .table-container`;

function tableSelectionCheckpoint(
	action: TableSelectionCheckpoint["action"],
	page: TableSelectionCheckpoint["page"],
	selectedIds: readonly string[] = []
): TableSelectionCheckpoint {
	return {
		action,
		page,
		expectedRowIds: tableSelectionPageIds[page],
		expectedSelectedRowIds: tableSelectionPageIds[page].filter((id) => selectedIds.includes(id)),
		expectedHeaderChecked: selectedIds.length === 12,
		expectedHeaderIndeterminate: selectedIds.length > 0 && selectedIds.length < 12
	};
}

function tableSelectionCheckpoints(journey: TableSelectionJourney): readonly TableSelectionCheckpoint[] | undefined {
	const initial = tableSelectionCheckpoint({ kind: "initial" }, 1);
	const one = tableSelectionCheckpoint({ kind: "row-checkbox", rowId: "1" }, 1, ["1"]);
	const all = tableSelectionAllIds;
	switch (journey) {
		case "initial":
			return [initial];
		case "pointer-one":
			return [initial, one];
		case "keyboard-one":
			return [initial, tableSelectionCheckpoint({ kind: "row-space", rowId: "1" }, 1, ["1"])];
		case "retained-one":
			return [
				initial,
				one,
				tableSelectionCheckpoint({ kind: "next-page" }, 2, ["1"]),
				tableSelectionCheckpoint({ kind: "next-page" }, 3, ["1"]),
				tableSelectionCheckpoint({ kind: "first-page" }, 1, ["1"])
			];
		case "all-first":
			return [
				initial,
				tableSelectionCheckpoint({ kind: "header-checkbox" }, 1, all),
				tableSelectionCheckpoint({ kind: "next-page" }, 2, all),
				tableSelectionCheckpoint({ kind: "next-page" }, 3, all),
				tableSelectionCheckpoint({ kind: "first-page" }, 1, all)
			];
		case "all-last":
			return [
				initial,
				one,
				tableSelectionCheckpoint({ kind: "next-page" }, 2, ["1"]),
				tableSelectionCheckpoint({ kind: "next-page" }, 3, ["1"]),
				tableSelectionCheckpoint({ kind: "header-checkbox" }, 3, all),
				tableSelectionCheckpoint({ kind: "first-page" }, 1, all),
				tableSelectionCheckpoint({ kind: "next-page" }, 2, all),
				tableSelectionCheckpoint({ kind: "next-page" }, 3, all)
			];
		case "clear":
			return [
				initial,
				tableSelectionCheckpoint({ kind: "header-checkbox" }, 1, all),
				tableSelectionCheckpoint({ kind: "next-page" }, 2, all),
				tableSelectionCheckpoint(
					{ kind: "row-checkbox", rowId: "222" },
					2,
					all.filter((id) => id !== "222")
				),
				tableSelectionCheckpoint({ kind: "header-checkbox" }, 2, all),
				tableSelectionCheckpoint({ kind: "header-checkbox" }, 2),
				tableSelectionCheckpoint({ kind: "next-page" }, 3),
				tableSelectionCheckpoint({ kind: "first-page" }, 1)
			];
		default:
			return undefined;
	}
}

function tableSelectionSourceState(journey: TableSelectionJourney): string | undefined {
	switch (journey) {
		case "initial":
		case "clear":
			return "none-selected";
		case "pointer-one":
		case "retained-one":
		case "keyboard-one":
			return "one-selected";
		case "all-first":
		case "all-last":
			return "all-selected";
		default:
			return undefined;
	}
}

function tableSelectionScenario(
	suffix: string,
	journey: TableSelectionJourney,
	viewport = { width: 1280, height: 900 }
): TableSelectionStateScenario {
	const checkpoints = tableSelectionCheckpoints(journey);
	const state = tableSelectionSourceState(journey);
	if (!checkpoints || !state) {
		throw new Error(`Unsupported Table selection journey: ${journey}`);
	}
	const id = `table-selection-${suffix}`;
	return {
		id,
		sourceStateId: `table-component.selection.${state}`,
		surfaceId: "table-component",
		axis: "selection",
		state,
		ownerBead: "stark-4sp.4.9",
		routeId: "table",
		runner: "table-selection-states",
		capture: { scope: "component", selector: tableSelectionCaptureSelector },
		snapshotName: `${id}.png`,
		maskSelectors: [],
		maxDiffPixels: 0,
		threshold: 0,
		payload: { fixtureSelector: tableSelectionFixtureSelector, viewport, journey, checkpoints }
	};
}

const tableSelectionScenarios: readonly TableSelectionStateScenario[] = [
	tableSelectionScenario("none", "initial"),
	tableSelectionScenario("one", "pointer-one"),
	tableSelectionScenario("retained-one", "retained-one"),
	tableSelectionScenario("all-first-page", "all-first"),
	tableSelectionScenario("all-last-page", "all-last"),
	tableSelectionScenario("cleared", "clear"),
	tableSelectionScenario("keyboard-one", "keyboard-one"),
	tableSelectionScenario("narrow-one", "pointer-one", { width: 390, height: 900 }),
	tableSelectionScenario("narrow-cleared", "clear", { width: 390, height: 900 })
];

export const genericSearchFixtureSelector = "example-viewer#generic-search-component";
export const genericSearchFormSelector = "#demo-generic-search-form";
export const genericSearchToggleSelector = `${genericSearchFixtureSelector} mat-slide-toggle`;
export const genericSearchSpinnerSelector = `${genericSearchFixtureSelector} stark-progress-indicator`;

export const genericSearchCriteria = {
	empty: { year: "", hero: "", movie: "" },
	hero: { year: "", hero: "iRoN", movie: "" },
	year: { year: "2008", hero: "", movie: "" },
	movie: { year: "", hero: "", movie: "iRoN MaN 2" },
	combined: { year: "2008", hero: "iRoN", movie: "Iron Man" },
	unmatched: { year: "", hero: "__stark_unmatched_hero__", movie: "" }
} as const satisfies Readonly<Record<string, GenericSearchCriteria>>;

/** Exact demo rows, in source order; these are assertions, not a replica filter. */
export const genericSearchRows = {
	hero: [
		["Iron Man", "Iron Man", "2008"],
		["Iron Man", "Iron Man 2", "2010"],
		["Iron Man", "Iron Man 3", "2013"]
	],
	year: [
		["Iron Man", "Iron Man", "2008"],
		["Batman", "The Dark Knight", "2008"]
	],
	movie: [["Iron Man", "Iron Man 2", "2010"]],
	combined: [["Iron Man", "Iron Man", "2008"]],
	all: [
		["Black Panther", "Black Panther", "2018"],
		["Wonder Woman", "Wonder Woman", "2017"],
		["Ant-Man", "Ant-Man", "2015"],
		["Iron Man", "Iron Man", "2008"],
		["Batman", "The Dark Knight", "2008"],
		["Batman", "Batman", "1989"],
		["Iron Man", "Iron Man 2", "2010"],
		["Iron Man", "Iron Man 3", "2013"]
	]
} as const satisfies Readonly<Record<string, readonly GenericSearchRow[]>>;

function genericSearchPayload(
	journey: GenericSearchJourney,
	viewport: GenericSearchStateScenario["payload"]["viewport"]
): GenericSearchStateScenario["payload"] | undefined {
	const criteria = genericSearchCriteria;
	let initialCriteria: GenericSearchCriteria;
	let expectedCriteria: GenericSearchCriteria;
	let expectedRows: readonly GenericSearchRow[] = [];
	switch (journey) {
		case "initial":
			initialCriteria = expectedCriteria = criteria.empty;
			break;
		case "close":
		case "reopen":
			initialCriteria = expectedCriteria = criteria.combined;
			break;
		case "hero-search":
		case "loading":
			initialCriteria = expectedCriteria = criteria.hero;
			expectedRows = genericSearchRows.hero;
			break;
		case "year-keyboard":
			initialCriteria = expectedCriteria = criteria.year;
			expectedRows = genericSearchRows.year;
			break;
		case "movie-action-bar":
			initialCriteria = expectedCriteria = criteria.movie;
			expectedRows = genericSearchRows.movie;
			break;
		case "no-matches":
			initialCriteria = criteria.hero;
			expectedCriteria = criteria.unmatched;
			break;
		case "reset":
		case "all-results":
			initialCriteria = criteria.combined;
			expectedCriteria = criteria.empty;
			expectedRows = journey === "all-results" ? genericSearchRows.all : [];
			break;
		default:
			return undefined;
	}
	return {
		fixtureSelector: genericSearchFixtureSelector,
		formSelector: genericSearchFormSelector,
		viewport,
		journey,
		criteria: initialCriteria,
		expectedCriteria,
		expectedRows,
		expectedFormOpen: journey !== "close",
		expectedKeyboardFocus: journey === "year-keyboard"
	};
}

function genericSearchCaptureSelector(journey: GenericSearchJourney): string {
	return journey === "close"
		? genericSearchToggleSelector
		: journey === "loading"
			? genericSearchSpinnerSelector
			: genericSearchFormSelector;
}

function genericSearchScenario(
	suffix: string,
	axis: "disclosure" | "availability" | "focus",
	state: string,
	journey: GenericSearchJourney,
	viewport = { width: 1280, height: 900 }
): GenericSearchStateScenario {
	const id = `generic-search-${suffix}`;
	const payload = genericSearchPayload(journey, viewport);
	if (!payload) {
		throw new Error(`Unsupported Generic Search journey: ${journey}`);
	}
	return {
		id,
		sourceStateId: `generic-search-component.${axis}.${state}`,
		surfaceId: "generic-search-component",
		axis,
		state,
		ownerBead: "stark-4sp.4.8",
		routeId: "generic-search",
		runner: "generic-search-states",
		capture: { scope: "component", selector: genericSearchCaptureSelector(journey) },
		snapshotName: `${id}.png`,
		maskSelectors: [],
		maxDiffPixels: 0,
		threshold: 0,
		payload
	};
}

const genericSearchScenarios: readonly GenericSearchStateScenario[] = [
	genericSearchScenario("form-open", "disclosure", "form-open", "initial"),
	genericSearchScenario("form-closed", "disclosure", "form-closed", "close"),
	genericSearchScenario("form-reopened", "disclosure", "form-open", "reopen"),
	genericSearchScenario("hero-matches", "availability", "enabled", "hero-search"),
	genericSearchScenario("keyboard-year-matches", "focus", "keyboard", "year-keyboard"),
	genericSearchScenario("loading", "availability", "enabled", "loading"),
	genericSearchScenario("no-matches", "availability", "enabled", "no-matches"),
	genericSearchScenario("reset", "availability", "enabled", "reset"),
	genericSearchScenario("all-results", "availability", "enabled", "all-results"),
	genericSearchScenario("focus-rest", "focus", "rest", "initial"),
	genericSearchScenario("action-bar-movie-matches", "availability", "enabled", "movie-action-bar"),
	genericSearchScenario("narrow-hero-matches", "availability", "enabled", "hero-search", { width: 390, height: 844 }),
	genericSearchScenario("narrow-form-closed", "disclosure", "form-closed", "close", { width: 390, height: 844 })
];

export const routeSearchPanelSelector = ".search-route-autocomplete[role=listbox]";
const routeSearchLeftFixture = "example-viewer#direction-left";
const routeSearchRightFixture = "example-viewer#direction-right";
const routeSearchMenuFixture = "example-viewer#with-menu-config-and-custom-color";

function expectedRouteSearchOutcome(fixture: RouteSearchFixture, action: RouteSearchAction): RouteSearchExpectation | undefined {
	if (![routeSearchLeftFixture, routeSearchRightFixture, routeSearchMenuFixture].includes(fixture)) {
		return undefined;
	}
	const menuConfig = fixture === routeSearchMenuFixture;
	if (action.kind === "initial") {
		return { kind: "search", inputVisible: false, value: "", results: null };
	}
	if (action.kind === "open") {
		return menuConfig ? undefined : { kind: "search", inputVisible: true, value: "", results: "all" };
	}
	if (!("query" in action)) {
		return undefined;
	}
	const matchingQuery = menuConfig ? "typography" : "brEAd";
	const matchingLabel = menuConfig ? "Typography" : "Breadcrumb";
	if (action.kind === "select") {
		if (action.via === "second-enter" && action.query === "date" && fixture === routeSearchRightFixture) {
			return { kind: "destination", path: "/demo-ui/date-range-picker", heading: "Date range picker" };
		}
		if (action.query !== matchingQuery || !["pointer", "enter"].includes(action.via)) {
			return undefined;
		}
		return {
			kind: "destination",
			path: menuConfig ? "/styleguide/typography" : "/demo-ui/breadcrumb",
			heading: matchingLabel
		};
	}
	if (action.kind === "filter" && action.query === "__stark_unmatched_route__") {
		return { kind: "search", inputVisible: true, value: action.query, results: [] };
	}
	if (action.query !== matchingQuery) {
		return undefined;
	}
	switch (action.kind) {
		case "filter":
		case "toggle-reopen":
			return { kind: "search", inputVisible: true, value: action.query, results: [matchingLabel] };
		case "clear":
			return menuConfig ? undefined : { kind: "search", inputVisible: true, value: "", results: "all" };
		case "escape":
		case "toggle-close":
			return { kind: "search", inputVisible: action.kind === "escape", value: action.query, results: null };
		default:
			return undefined;
	}
}

function routeSearchCaptureSelector(sourceState: string, fixture: RouteSearchFixture, expected: RouteSearchExpectation): string {
	if (expected.kind === "destination") {
		return `ui-view h1:text-is("${expected.heading}")`;
	}
	return ["content.empty-query", "content.matches", "selection.unselected", "overlay.open"].includes(sourceState)
		? routeSearchPanelSelector
		: fixture;
}

function routeSearchScenario(
	idSuffix: string,
	fixtureSelector: RouteSearchFixture,
	axis: "content" | "disclosure" | "selection" | "overlay",
	state: string,
	action: RouteSearchAction
): RouteSearchStateScenario {
	const expected = expectedRouteSearchOutcome(fixtureSelector, action);
	if (!expected) {
		throw new Error(`Unsupported Route Search interaction: ${idSuffix}`);
	}
	const id = `route-search-${idSuffix}`;
	return {
		id,
		sourceStateId: `route-search-component.${axis}.${state}`,
		surfaceId: "route-search-component",
		axis,
		state,
		ownerBead: "stark-4sp.4.8",
		routeId: "route-search",
		runner: "route-search-states",
		capture: { scope: "component", selector: routeSearchCaptureSelector(`${axis}.${state}`, fixtureSelector, expected) },
		snapshotName: `${id}.png`,
		maskSelectors: [],
		maxDiffPixels: 0,
		threshold: 0,
		payload: { fixtureSelector, action, expected }
	};
}

const routeSearchScenarios: readonly RouteSearchStateScenario[] = [
	routeSearchScenario("left-empty-query", routeSearchLeftFixture, "content", "empty-query", { kind: "open" }),
	routeSearchScenario("left-matches", routeSearchLeftFixture, "content", "matches", { kind: "filter", query: "brEAd" }),
	routeSearchScenario("left-no-matches", routeSearchLeftFixture, "content", "no-matches", {
		kind: "filter",
		query: "__stark_unmatched_route__"
	}),
	routeSearchScenario("left-closed", routeSearchLeftFixture, "disclosure", "closed", { kind: "initial" }),
	routeSearchScenario("right-open", routeSearchRightFixture, "disclosure", "open", { kind: "open" }),
	routeSearchScenario("left-unselected", routeSearchLeftFixture, "selection", "unselected", { kind: "filter", query: "brEAd" }),
	routeSearchScenario("left-pointer-selection", routeSearchLeftFixture, "selection", "selected", {
		kind: "select",
		query: "brEAd",
		via: "pointer"
	}),
	routeSearchScenario("right-enter-selection", routeSearchRightFixture, "selection", "selected", {
		kind: "select",
		query: "brEAd",
		via: "enter"
	}),
	routeSearchScenario("left-escape", routeSearchLeftFixture, "overlay", "closed", { kind: "escape", query: "brEAd" }),
	routeSearchScenario("right-overlay-open", routeSearchRightFixture, "overlay", "open", { kind: "filter", query: "brEAd" }),
	routeSearchScenario("right-toggle-closed", routeSearchRightFixture, "disclosure", "closed", { kind: "toggle-close", query: "brEAd" }),
	routeSearchScenario("right-reopened", routeSearchRightFixture, "disclosure", "open", { kind: "toggle-reopen", query: "brEAd" }),
	routeSearchScenario("right-cleared-query", routeSearchRightFixture, "content", "empty-query", { kind: "clear", query: "brEAd" }),
	routeSearchScenario("menu-matches", routeSearchMenuFixture, "content", "matches", { kind: "filter", query: "typography" }),
	routeSearchScenario("menu-enter-selection", routeSearchMenuFixture, "selection", "selected", {
		kind: "select",
		query: "typography",
		via: "enter"
	}),
	routeSearchScenario("right-second-enter-selection", routeSearchRightFixture, "selection", "selected", {
		kind: "select",
		query: "date",
		via: "second-enter"
	})
];

/**
 * Runnable scenarios are added only after their route, interaction, assertion,
 * and component-only capture selectors have been audited in both applications.
 */
export const executableVisualScenarios = [
	{
		id: "app-logo-focus-rest",
		sourceStateId: "app-logo-component.focus.rest",
		surfaceId: "app-logo-component",
		axis: "focus",
		state: "rest",
		ownerBead: "stark-4sp.4.2",
		routeId: "app-shell",
		runner: "app-logo-focus",
		capture: { scope: "component", selector: appLogoComponentSelector },
		snapshotName: "app-logo-focus-rest.png",
		maskSelectors: [],
		maxDiffPixels: 0,
		threshold: 0,
		payload: {
			componentSelector: appLogoComponentSelector,
			focusTargetSelector: appLogoFocusTargetSelector,
			action: { kind: "initial" },
			expectedFocusVisible: false,
			capturePadding: 2
		}
	},
	{
		id: "app-logo-focus-keyboard",
		sourceStateId: "app-logo-component.focus.keyboard",
		surfaceId: "app-logo-component",
		axis: "focus",
		state: "keyboard",
		ownerBead: "stark-4sp.4.2",
		routeId: "app-shell",
		runner: "app-logo-focus",
		capture: { scope: "component", selector: appLogoComponentSelector },
		snapshotName: "app-logo-focus-keyboard.png",
		maskSelectors: [],
		maxDiffPixels: 0,
		threshold: 0,
		payload: {
			componentSelector: appLogoComponentSelector,
			focusTargetSelector: appLogoFocusTargetSelector,
			action: { kind: "keyboard-tab" },
			expectedFocusVisible: true,
			capturePadding: 2
		}
	},
	{
		id: "app-data-content-dropdown",
		sourceStateId: "app-data-component.content.dropdown",
		surfaceId: "app-data-component",
		axis: "content",
		state: "dropdown",
		ownerBead: "stark-4sp.4.2",
		routeId: "app-data",
		runner: "app-data-states",
		capture: { scope: "component", selector: appDataDropdownComponentSelector },
		snapshotName: "app-data-content-dropdown.png",
		maskSelectors: [],
		maxDiffPixels: 0,
		threshold: 0,
		payload: appDataPayload("dropdown", { kind: "initial" })
	},
	{
		id: "app-data-content-menu",
		sourceStateId: "app-data-component.content.menu",
		surfaceId: "app-data-component",
		axis: "content",
		state: "menu",
		ownerBead: "stark-4sp.4.2",
		routeId: "app-data",
		runner: "app-data-states",
		capture: { scope: "component", selector: appDataMenuComponentSelector },
		snapshotName: "app-data-content-menu.png",
		maskSelectors: [],
		maxDiffPixels: 0,
		threshold: 0,
		payload: appDataPayload("menu", { kind: "initial" })
	},
	{
		id: "app-data-disclosure-closed",
		sourceStateId: "app-data-component.disclosure.closed",
		surfaceId: "app-data-component",
		axis: "disclosure",
		state: "closed",
		ownerBead: "stark-4sp.4.2",
		routeId: "app-data",
		runner: "app-data-states",
		capture: { scope: "component", selector: appDataDropdownComponentSelector },
		snapshotName: "app-data-disclosure-closed.png",
		maskSelectors: [],
		maxDiffPixels: 0,
		threshold: 0,
		payload: appDataPayload("dropdown", { kind: "initial" })
	},
	{
		id: "app-data-disclosure-open",
		sourceStateId: "app-data-component.disclosure.open",
		surfaceId: "app-data-component",
		axis: "disclosure",
		state: "open",
		ownerBead: "stark-4sp.4.2",
		routeId: "app-data",
		runner: "app-data-states",
		capture: { scope: "component", selector: appDataDetailSelector },
		snapshotName: "app-data-disclosure-open.png",
		maskSelectors: [],
		maxDiffPixels: 575,
		threshold: 0,
		payload: appDataPayload("dropdown", { kind: "open-dropdown" })
	},
	{
		id: "app-data-focus-rest",
		sourceStateId: "app-data-component.focus.rest",
		surfaceId: "app-data-component",
		axis: "focus",
		state: "rest",
		ownerBead: "stark-4sp.4.2",
		routeId: "app-data",
		runner: "app-data-states",
		capture: { scope: "component", selector: appDataDropdownComponentSelector },
		snapshotName: "app-data-focus-rest.png",
		maskSelectors: [],
		maxDiffPixels: 0,
		threshold: 0,
		payload: appDataPayload("dropdown", { kind: "initial" })
	},
	{
		id: "app-data-focus-keyboard",
		sourceStateId: "app-data-component.focus.keyboard",
		surfaceId: "app-data-component",
		axis: "focus",
		state: "keyboard",
		ownerBead: "stark-4sp.4.2",
		routeId: "app-data",
		runner: "app-data-states",
		capture: { scope: "component", selector: appDataDropdownComponentSelector },
		snapshotName: "app-data-focus-keyboard.png",
		maskSelectors: [],
		maxDiffPixels: 25,
		threshold: 0,
		payload: appDataPayload("dropdown", { kind: "keyboard-tab" })
	},
	{
		id: "minimap-content-populated",
		sourceStateId: "minimap-component.content.populated",
		surfaceId: "minimap-component",
		axis: "content",
		state: "populated",
		ownerBead: "stark-4sp.4.2",
		routeId: "minimap",
		runner: "minimap-states",
		capture: { scope: "component", selector: minimapComponentSelector },
		snapshotName: "minimap-content-populated.png",
		maskSelectors: [],
		maxDiffPixels: 0,
		threshold: 0,
		payload: minimapPayload({ kind: "initial" })
	},
	{
		id: "minimap-selection-all-visible",
		sourceStateId: "minimap-component.selection.all-visible",
		surfaceId: "minimap-component",
		axis: "selection",
		state: "all-visible",
		ownerBead: "stark-4sp.4.2",
		routeId: "minimap",
		runner: "minimap-states",
		capture: { scope: "component", selector: minimapMenuSelector },
		snapshotName: "minimap-selection-all-visible.png",
		maskSelectors: [],
		maxDiffPixels: 200,
		threshold: 0,
		payload: minimapPayload({ kind: "open-menu" })
	},
	{
		id: "minimap-selection-partially-hidden",
		sourceStateId: "minimap-component.selection.partially-hidden",
		surfaceId: "minimap-component",
		axis: "selection",
		state: "partially-hidden",
		ownerBead: "stark-4sp.4.2",
		routeId: "minimap",
		runner: "minimap-states",
		capture: { scope: "component", selector: minimapMenuSelector },
		snapshotName: "minimap-selection-partially-hidden.png",
		maskSelectors: [],
		maxDiffPixels: 420,
		threshold: 0,
		payload: minimapPayload({ kind: "open-menu-toggle-item", index: 1 })
	},
	{
		id: "minimap-overlay-closed",
		sourceStateId: "minimap-component.overlay.closed",
		surfaceId: "minimap-component",
		axis: "overlay",
		state: "closed",
		ownerBead: "stark-4sp.4.2",
		routeId: "minimap",
		runner: "minimap-states",
		capture: { scope: "component", selector: minimapComponentSelector },
		snapshotName: "minimap-overlay-closed.png",
		maskSelectors: [],
		maxDiffPixels: 0,
		threshold: 0,
		payload: minimapPayload({ kind: "initial" })
	},
	{
		id: "minimap-overlay-open",
		sourceStateId: "minimap-component.overlay.open",
		surfaceId: "minimap-component",
		axis: "overlay",
		state: "open",
		ownerBead: "stark-4sp.4.2",
		routeId: "minimap",
		runner: "minimap-states",
		capture: { scope: "component", selector: minimapMenuSelector },
		snapshotName: "minimap-overlay-open.png",
		maskSelectors: [],
		maxDiffPixels: 200,
		threshold: 0,
		payload: minimapPayload({ kind: "open-menu" })
	},
	{
		id: "minimap-focus-rest",
		sourceStateId: "minimap-component.focus.rest",
		surfaceId: "minimap-component",
		axis: "focus",
		state: "rest",
		ownerBead: "stark-4sp.4.2",
		routeId: "minimap",
		runner: "minimap-states",
		capture: { scope: "component", selector: minimapComponentSelector },
		snapshotName: "minimap-focus-rest.png",
		maskSelectors: [],
		maxDiffPixels: 0,
		threshold: 0,
		payload: minimapPayload({ kind: "initial" })
	},
	{
		id: "minimap-focus-keyboard",
		sourceStateId: "minimap-component.focus.keyboard",
		surfaceId: "minimap-component",
		axis: "focus",
		state: "keyboard",
		ownerBead: "stark-4sp.4.2",
		routeId: "minimap",
		runner: "minimap-states",
		capture: { scope: "component", selector: minimapComponentSelector },
		snapshotName: "minimap-focus-keyboard.png",
		maskSelectors: [],
		maxDiffPixels: 0,
		threshold: 0,
		payload: minimapPayload({ kind: "keyboard-tab" })
	},
	{
		id: "pagination-content-populated",
		sourceStateId: "pagination-component.content.populated",
		surfaceId: "pagination-component",
		axis: "content",
		state: "populated",
		ownerBead: "stark-4sp.4.2",
		routeId: "pagination",
		runner: "pagination-states",
		capture: { scope: "component", selector: paginationSimpleComponentSelector },
		snapshotName: "pagination-content-populated.png",
		maskSelectors: [],
		maxDiffPixels: 124,
		threshold: 0,
		payload: paginationPayload("simple", { kind: "initial" })
	},
	{
		id: "pagination-availability-previous-disabled",
		sourceStateId: "pagination-component.availability.previous-disabled",
		surfaceId: "pagination-component",
		axis: "availability",
		state: "previous-disabled",
		ownerBead: "stark-4sp.4.2",
		routeId: "pagination",
		runner: "pagination-states",
		capture: { scope: "component", selector: paginationSimpleComponentSelector },
		snapshotName: "pagination-availability-previous-disabled.png",
		maskSelectors: [],
		maxDiffPixels: 124,
		threshold: 0,
		payload: paginationPayload("simple", { kind: "initial" })
	},
	{
		id: "pagination-availability-next-enabled",
		sourceStateId: "pagination-component.availability.next-enabled",
		surfaceId: "pagination-component",
		axis: "availability",
		state: "next-enabled",
		ownerBead: "stark-4sp.4.2",
		routeId: "pagination",
		runner: "pagination-states",
		capture: { scope: "component", selector: paginationSimpleComponentSelector },
		snapshotName: "pagination-availability-next-enabled.png",
		maskSelectors: [],
		maxDiffPixels: 124,
		threshold: 0,
		payload: paginationPayload("simple", { kind: "initial" })
	},
	{
		id: "pagination-availability-next-disabled",
		sourceStateId: "pagination-component.availability.next-disabled",
		surfaceId: "pagination-component",
		axis: "availability",
		state: "next-disabled",
		ownerBead: "stark-4sp.4.2",
		routeId: "pagination",
		runner: "pagination-states",
		capture: { scope: "component", selector: paginationSimpleComponentSelector },
		snapshotName: "pagination-availability-next-disabled.png",
		maskSelectors: [],
		maxDiffPixels: 124,
		threshold: 0,
		payload: paginationPayload(
			"simple",
			{ kind: "go-to-last" },
			{
				expectedCurrentPage: 2,
				expectedFirstDisabled: false,
				expectedPreviousDisabled: false,
				expectedNextDisabled: true,
				expectedLastDisabled: true,
				expectedEvent: '{"page":2,"itemsPerPage":10}'
			}
		)
	},
	{
		id: "pagination-selection-first-page",
		sourceStateId: "pagination-component.selection.first-page",
		surfaceId: "pagination-component",
		axis: "selection",
		state: "first-page",
		ownerBead: "stark-4sp.4.2",
		routeId: "pagination",
		runner: "pagination-states",
		capture: { scope: "component", selector: paginationExtendedComponentSelector },
		snapshotName: "pagination-selection-first-page.png",
		maskSelectors: [],
		maxDiffPixels: 148,
		threshold: 0,
		payload: paginationPayload("extended", { kind: "initial" })
	},
	{
		id: "pagination-selection-middle-page",
		sourceStateId: "pagination-component.selection.middle-page",
		surfaceId: "pagination-component",
		axis: "selection",
		state: "middle-page",
		ownerBead: "stark-4sp.4.2",
		routeId: "pagination",
		runner: "pagination-states",
		capture: { scope: "component", selector: paginationExtendedComponentSelector },
		snapshotName: "pagination-selection-middle-page.png",
		maskSelectors: [],
		maxDiffPixels: 147,
		threshold: 0,
		payload: paginationPayload(
			"extended",
			{ kind: "go-to-page", page: 5 },
			{
				expectedCurrentPage: 5,
				expectedActivePage: "5",
				expectedPreviousDisabled: false,
				expectedEvent: '{"page":5,"itemsPerPage":2}'
			}
		)
	},
	{
		id: "pagination-selection-page-size",
		sourceStateId: "pagination-component.selection.page-size",
		surfaceId: "pagination-component",
		axis: "selection",
		state: "page-size",
		ownerBead: "stark-4sp.4.2",
		routeId: "pagination",
		runner: "pagination-states",
		capture: { scope: "component", selector: paginationSimpleComponentSelector },
		snapshotName: "pagination-selection-page-size.png",
		maskSelectors: [],
		maxDiffPixels: 133,
		threshold: 0,
		payload: paginationPayload(
			"simple",
			{ kind: "select-page-size", size: 20 },
			{
				expectedTotalPages: 1,
				expectedItemsPerPage: 20,
				expectedNextDisabled: true,
				expectedLastDisabled: true,
				expectedEvent: '{"page":1,"itemsPerPage":20}'
			}
		)
	},
	{
		id: "pagination-focus-rest",
		sourceStateId: "pagination-component.focus.rest",
		surfaceId: "pagination-component",
		axis: "focus",
		state: "rest",
		ownerBead: "stark-4sp.4.2",
		routeId: "pagination",
		runner: "pagination-states",
		capture: { scope: "component", selector: paginationSimpleComponentSelector },
		snapshotName: "pagination-focus-rest.png",
		maskSelectors: [],
		maxDiffPixels: 124,
		threshold: 0,
		payload: paginationPayload("simple", { kind: "initial" })
	},
	{
		id: "pagination-focus-keyboard",
		sourceStateId: "pagination-component.focus.keyboard",
		surfaceId: "pagination-component",
		axis: "focus",
		state: "keyboard",
		ownerBead: "stark-4sp.4.2",
		routeId: "pagination",
		runner: "pagination-states",
		capture: { scope: "component", selector: paginationSimpleComponentSelector },
		snapshotName: "pagination-focus-keyboard.png",
		maskSelectors: [],
		maxDiffPixels: 138,
		threshold: 0,
		payload: paginationPayload("simple", { kind: "keyboard-tab" })
	},
	{
		id: "pretty-print-component-content-empty",
		sourceStateId: "pretty-print-component.content.empty",
		surfaceId: "pretty-print-component",
		axis: "content",
		state: "empty",
		ownerBead: "stark-4sp.4.2",
		routeId: "pretty-print",
		runner: "pretty-print-states",
		capture: { scope: "component", selector: prettyPrintPlainOutputSelector(prettyPrintFormComponentSelector) },
		snapshotName: "pretty-print-component-content-empty.png",
		maskSelectors: [],
		maxDiffPixels: 0,
		threshold: 0,
		payload: prettyPrintPayload("form", { kind: "initial" }, "")
	},
	{
		id: "pretty-print-component-content-plain",
		sourceStateId: "pretty-print-component.content.plain",
		surfaceId: "pretty-print-component",
		axis: "content",
		state: "plain",
		ownerBead: "stark-4sp.4.2",
		routeId: "pretty-print",
		runner: "pretty-print-states",
		capture: { scope: "component", selector: prettyPrintPlainOutputSelector(prettyPrintTypescriptComponentSelector) },
		snapshotName: "pretty-print-component-content-plain.png",
		maskSelectors: [],
		maxDiffPixels: 0,
		threshold: 0,
		payload: prettyPrintPayload("typescript", { kind: "open-example-tab", tabName: "Formatted" }, prettyPrintTypescriptText)
	},
	{
		id: "pretty-print-component-content-highlighted",
		sourceStateId: "pretty-print-component.content.highlighted",
		surfaceId: "pretty-print-component",
		axis: "content",
		state: "highlighted",
		ownerBead: "stark-4sp.4.2",
		routeId: "pretty-print",
		runner: "pretty-print-states",
		capture: { scope: "component", selector: prettyPrintHighlightedOutputSelector(prettyPrintTypescriptComponentSelector) },
		snapshotName: "pretty-print-component-content-highlighted.png",
		maskSelectors: [],
		maxDiffPixels: 0,
		threshold: 0,
		payload: prettyPrintPayload(
			"typescript",
			{ kind: "open-example-tab", tabName: "Formatted with highlighting" },
			prettyPrintTypescriptText,
			true
		)
	},
	{
		id: "pretty-print-component-content-typescript",
		sourceStateId: "pretty-print-component.content.typescript",
		surfaceId: "pretty-print-component",
		axis: "content",
		state: "typescript",
		ownerBead: "stark-4sp.4.2",
		routeId: "pretty-print",
		runner: "pretty-print-states",
		capture: { scope: "component", selector: prettyPrintPlainOutputSelector(prettyPrintTypescriptComponentSelector) },
		snapshotName: "pretty-print-component-content-typescript.png",
		maskSelectors: [],
		maxDiffPixels: 0,
		threshold: 0,
		payload: prettyPrintPayload("typescript", { kind: "open-example-tab", tabName: "Formatted" }, prettyPrintTypescriptText)
	},
	{
		id: "pretty-print-component-async-formatted",
		sourceStateId: "pretty-print-component.async.formatted",
		surfaceId: "pretty-print-component",
		axis: "async",
		state: "formatted",
		ownerBead: "stark-4sp.4.2",
		routeId: "pretty-print",
		runner: "pretty-print-states",
		capture: { scope: "component", selector: prettyPrintPlainOutputSelector(prettyPrintTypescriptComponentSelector) },
		snapshotName: "pretty-print-component-async-formatted.png",
		maskSelectors: [],
		maxDiffPixels: 0,
		threshold: 0,
		payload: prettyPrintPayload("typescript", { kind: "open-example-tab", tabName: "Formatted" }, prettyPrintTypescriptText)
	},
	{
		id: "pretty-print-component-async-error",
		sourceStateId: "pretty-print-component.async.error",
		surfaceId: "pretty-print-component",
		axis: "async",
		state: "error",
		ownerBead: "stark-4sp.4.2",
		routeId: "pretty-print",
		runner: "pretty-print-states",
		capture: { scope: "component", selector: prettyPrintPlainOutputSelector(prettyPrintFormComponentSelector) },
		snapshotName: "pretty-print-component-async-error.png",
		maskSelectors: [],
		maxDiffPixels: 0,
		threshold: 0,
		payload: prettyPrintPayload("form", { kind: "format-invalid-json" }, prettyPrintInvalidJson)
	},
	{
		id: "pretty-print-component-validity-supported-format",
		sourceStateId: "pretty-print-component.validity.supported-format",
		surfaceId: "pretty-print-component",
		axis: "validity",
		state: "supported-format",
		ownerBead: "stark-4sp.4.2",
		routeId: "pretty-print",
		runner: "pretty-print-states",
		capture: { scope: "component", selector: prettyPrintHighlightedOutputSelector(prettyPrintTypescriptComponentSelector) },
		snapshotName: "pretty-print-component-validity-supported-format.png",
		maskSelectors: [],
		maxDiffPixels: 0,
		threshold: 0,
		payload: prettyPrintPayload(
			"typescript",
			{ kind: "open-example-tab", tabName: "Formatted with highlighting" },
			prettyPrintTypescriptText,
			true
		)
	},
	{
		id: "pretty-print-service-content-json",
		sourceStateId: "pretty-print-service.content.json",
		surfaceId: "pretty-print-service",
		axis: "content",
		state: "json",
		ownerBead: "stark-4sp.4.2",
		routeId: "pretty-print",
		runner: "pretty-print-states",
		capture: { scope: "component", selector: prettyPrintPlainOutputSelector(prettyPrintJsonComponentSelector) },
		snapshotName: "pretty-print-service-content-json.png",
		maskSelectors: [],
		maxDiffPixels: 0,
		threshold: 0,
		payload: prettyPrintPayload("json", { kind: "open-example-tab", tabName: "Formatted" }, prettyPrintJsonText)
	},
	{
		id: "pretty-print-service-content-xml",
		sourceStateId: "pretty-print-service.content.xml",
		surfaceId: "pretty-print-service",
		axis: "content",
		state: "xml",
		ownerBead: "stark-4sp.4.2",
		routeId: "pretty-print",
		runner: "pretty-print-states",
		capture: { scope: "component", selector: prettyPrintPlainOutputSelector(prettyPrintXmlComponentSelector) },
		snapshotName: "pretty-print-service-content-xml.png",
		maskSelectors: [],
		maxDiffPixels: 0,
		threshold: 0,
		payload: prettyPrintPayload("xml", { kind: "open-example-tab", tabName: "Formatted" }, prettyPrintXmlText)
	},
	{
		id: "pretty-print-service-async-formatted",
		sourceStateId: "pretty-print-service.async.formatted",
		surfaceId: "pretty-print-service",
		axis: "async",
		state: "formatted",
		ownerBead: "stark-4sp.4.2",
		routeId: "pretty-print",
		runner: "pretty-print-states",
		capture: { scope: "component", selector: prettyPrintPlainOutputSelector(prettyPrintTypescriptComponentSelector) },
		snapshotName: "pretty-print-service-async-formatted.png",
		maskSelectors: [],
		maxDiffPixels: 0,
		threshold: 0,
		payload: prettyPrintPayload("typescript", { kind: "open-example-tab", tabName: "Formatted" }, prettyPrintTypescriptText)
	},
	{
		id: "pretty-print-service-async-error",
		sourceStateId: "pretty-print-service.async.error",
		surfaceId: "pretty-print-service",
		axis: "async",
		state: "error",
		ownerBead: "stark-4sp.4.2",
		routeId: "pretty-print",
		runner: "pretty-print-states",
		capture: { scope: "component", selector: prettyPrintPlainOutputSelector(prettyPrintFormComponentSelector) },
		snapshotName: "pretty-print-service-async-error.png",
		maskSelectors: [],
		maxDiffPixels: 0,
		threshold: 0,
		payload: prettyPrintPayload("form", { kind: "format-invalid-json" }, prettyPrintInvalidJson)
	},
	{
		id: "pretty-print-service-validity-valid",
		sourceStateId: "pretty-print-service.validity.valid",
		surfaceId: "pretty-print-service",
		axis: "validity",
		state: "valid",
		ownerBead: "stark-4sp.4.2",
		routeId: "pretty-print",
		runner: "pretty-print-states",
		capture: { scope: "component", selector: prettyPrintHighlightedOutputSelector(prettyPrintTypescriptComponentSelector) },
		snapshotName: "pretty-print-service-validity-valid.png",
		maskSelectors: [],
		maxDiffPixels: 0,
		threshold: 0,
		payload: prettyPrintPayload(
			"typescript",
			{ kind: "open-example-tab", tabName: "Formatted with highlighting" },
			prettyPrintTypescriptText,
			true
		)
	},
	{
		id: "pretty-print-service-validity-invalid",
		sourceStateId: "pretty-print-service.validity.invalid",
		surfaceId: "pretty-print-service",
		axis: "validity",
		state: "invalid",
		ownerBead: "stark-4sp.4.2",
		routeId: "pretty-print",
		runner: "pretty-print-states",
		capture: { scope: "component", selector: prettyPrintPlainOutputSelector(prettyPrintFormComponentSelector) },
		snapshotName: "pretty-print-service-validity-invalid.png",
		maskSelectors: [],
		maxDiffPixels: 0,
		threshold: 0,
		payload: prettyPrintPayload("form", { kind: "format-invalid-json" }, prettyPrintInvalidJson)
	},
	{
		id: "app-footer-content-with-links",
		sourceStateId: "app-footer-component.content.with-links",
		surfaceId: "app-footer-component",
		axis: "content",
		state: "with-links",
		ownerBead: "stark-4sp.4.2",
		routeId: "app-shell",
		runner: "app-footer-states",
		capture: { scope: "component", selector: appFooterComponentSelector },
		snapshotName: "app-footer-content-with-links.png",
		maskSelectors: [],
		maxDiffPixels: 0,
		threshold: 0,
		payload: appFooterPayload({ kind: "initial" })
	},
	{
		id: "app-footer-focus-rest",
		sourceStateId: "app-footer-component.focus.rest",
		surfaceId: "app-footer-component",
		axis: "focus",
		state: "rest",
		ownerBead: "stark-4sp.4.2",
		routeId: "app-shell",
		runner: "app-footer-states",
		capture: { scope: "component", selector: appFooterComponentSelector },
		snapshotName: "app-footer-focus-rest.png",
		maskSelectors: [],
		maxDiffPixels: 0,
		threshold: 0,
		payload: appFooterPayload({ kind: "initial" })
	},
	{
		id: "app-footer-focus-keyboard",
		sourceStateId: "app-footer-component.focus.keyboard",
		surfaceId: "app-footer-component",
		axis: "focus",
		state: "keyboard",
		ownerBead: "stark-4sp.4.2",
		routeId: "app-shell",
		runner: "app-footer-states",
		capture: { scope: "component", selector: appFooterComponentSelector },
		snapshotName: "app-footer-focus-keyboard.png",
		maskSelectors: [],
		maxDiffPixels: 0,
		threshold: 0,
		payload: appFooterPayload({ kind: "keyboard-tab" })
	},
	{
		id: "breadcrumb-content-nested",
		sourceStateId: "breadcrumb-component.content.nested",
		surfaceId: "breadcrumb-component",
		axis: "content",
		state: "nested",
		ownerBead: "stark-4sp.4.2",
		routeId: "breadcrumb",
		runner: "breadcrumb-states",
		capture: { scope: "component", selector: breadcrumbComponentSelector },
		snapshotName: "breadcrumb-content-nested.png",
		maskSelectors: [],
		maxDiffPixels: 0,
		threshold: 0,
		payload: breadcrumbPayload()
	},
	{
		id: "breadcrumb-focus-rest",
		sourceStateId: "breadcrumb-component.focus.rest",
		surfaceId: "breadcrumb-component",
		axis: "focus",
		state: "rest",
		ownerBead: "stark-4sp.4.2",
		routeId: "breadcrumb",
		runner: "breadcrumb-states",
		capture: { scope: "component", selector: breadcrumbComponentSelector },
		snapshotName: "breadcrumb-focus-rest.png",
		maskSelectors: [],
		maxDiffPixels: 0,
		threshold: 0,
		payload: breadcrumbPayload()
	},
	{
		id: "action-bar-content-primary-actions",
		sourceStateId: "action-bar-component.content.primary-actions",
		surfaceId: "action-bar-component",
		axis: "content",
		state: "primary-actions",
		ownerBead: "stark-4sp.4.2",
		routeId: "action-bar",
		runner: "action-bar-states",
		capture: { scope: "component", selector: compactActionBarSelector },
		snapshotName: "action-bar-content-primary-actions.png",
		maskSelectors: [],
		maxDiffPixels: 260,
		threshold: 0,
		payload: actionBarStatePayload("compact", { kind: "initial" })
	},
	{
		id: "action-bar-content-alternative-actions",
		sourceStateId: "action-bar-component.content.alternative-actions",
		surfaceId: "action-bar-component",
		axis: "content",
		state: "alternative-actions",
		ownerBead: "stark-4sp.4.2",
		routeId: "action-bar",
		runner: "action-bar-states",
		capture: { scope: "component", selector: actionBarMenuSelector },
		snapshotName: "action-bar-content-alternative-actions.png",
		maskSelectors: [],
		maxDiffPixels: 650,
		threshold: 0,
		payload: actionBarStatePayload("alternative", { kind: "open-menu" })
	},
	{
		id: "action-bar-content-compact",
		sourceStateId: "action-bar-component.content.compact",
		surfaceId: "action-bar-component",
		axis: "content",
		state: "compact",
		ownerBead: "stark-4sp.4.2",
		routeId: "action-bar",
		runner: "action-bar-states",
		capture: { scope: "component", selector: compactActionBarSelector },
		snapshotName: "action-bar-content-compact.png",
		maskSelectors: [],
		maxDiffPixels: 260,
		threshold: 0,
		payload: actionBarStatePayload("compact", { kind: "initial" })
	},
	{
		id: "action-bar-availability-enabled",
		sourceStateId: "action-bar-component.availability.enabled",
		surfaceId: "action-bar-component",
		axis: "availability",
		state: "enabled",
		ownerBead: "stark-4sp.4.2",
		routeId: "action-bar",
		runner: "action-bar-states",
		capture: { scope: "component", selector: compactActionBarSelector },
		snapshotName: "action-bar-availability-enabled.png",
		maskSelectors: [],
		maxDiffPixels: 260,
		threshold: 0,
		payload: actionBarStatePayload("compact", { kind: "initial" })
	},
	{
		id: "action-bar-availability-disabled",
		sourceStateId: "action-bar-component.availability.disabled",
		surfaceId: "action-bar-component",
		axis: "availability",
		state: "disabled",
		ownerBead: "stark-4sp.4.2",
		routeId: "action-bar",
		runner: "action-bar-states",
		capture: { scope: "component", selector: compactActionBarSelector },
		snapshotName: "action-bar-availability-disabled.png",
		maskSelectors: [],
		maxDiffPixels: 260,
		threshold: 0,
		payload: actionBarStatePayload("compact", { kind: "initial" })
	},
	{
		id: "action-bar-overlay-closed",
		sourceStateId: "action-bar-component.overlay.closed",
		surfaceId: "action-bar-component",
		axis: "overlay",
		state: "closed",
		ownerBead: "stark-4sp.4.2",
		routeId: "action-bar",
		runner: "action-bar-states",
		capture: { scope: "component", selector: alternativeActionBarSelector },
		snapshotName: "action-bar-overlay-closed.png",
		maskSelectors: [],
		maxDiffPixels: 285,
		threshold: 0,
		payload: actionBarStatePayload("alternative", { kind: "initial" })
	},
	{
		id: "action-bar-overlay-open",
		sourceStateId: "action-bar-component.overlay.open",
		surfaceId: "action-bar-component",
		axis: "overlay",
		state: "open",
		ownerBead: "stark-4sp.4.2",
		routeId: "action-bar",
		runner: "action-bar-states",
		capture: { scope: "component", selector: actionBarMenuSelector },
		snapshotName: "action-bar-overlay-open.png",
		maskSelectors: [],
		maxDiffPixels: 650,
		threshold: 0,
		payload: actionBarStatePayload("alternative", { kind: "open-menu" })
	},
	{
		id: "action-bar-focus-rest",
		sourceStateId: "action-bar-component.focus.rest",
		surfaceId: "action-bar-component",
		axis: "focus",
		state: "rest",
		ownerBead: "stark-4sp.4.2",
		routeId: "action-bar",
		runner: "action-bar-states",
		capture: { scope: "component", selector: compactActionBarSelector },
		snapshotName: "action-bar-focus-rest.png",
		maskSelectors: [],
		maxDiffPixels: 260,
		threshold: 0,
		payload: actionBarStatePayload("compact", { kind: "initial" })
	},
	{
		id: "action-bar-focus-keyboard",
		sourceStateId: "action-bar-component.focus.keyboard",
		surfaceId: "action-bar-component",
		axis: "focus",
		state: "keyboard",
		ownerBead: "stark-4sp.4.2",
		routeId: "action-bar",
		runner: "action-bar-states",
		capture: { scope: "component", selector: compactActionBarSelector },
		snapshotName: "action-bar-focus-keyboard.png",
		maskSelectors: [],
		maxDiffPixels: 260,
		threshold: 0,
		payload: actionBarStatePayload("compact", { kind: "keyboard-tab" })
	},
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
		maxDiffPixels: 380,
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
		maxDiffPixels: 260,
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
		maxDiffPixels: 190,
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
		maxDiffPixels: 300,
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
		maxDiffPixels: 225,
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
	},
	{
		id: "collapsible-disclosure-collapsed",
		sourceStateId: "collapsible-component.disclosure.collapsed",
		surfaceId: "collapsible-component",
		axis: "disclosure",
		state: "collapsed",
		ownerBead: "stark-4sp.4.2",
		routeId: "collapsible",
		runner: "collapsible-states",
		capture: { scope: "component", selector: defaultCollapsibleExampleSelector },
		snapshotName: "collapsible-disclosure-collapsed.png",
		maskSelectors: [],
		maxDiffPixels: 930,
		threshold: 0,
		payload: collapsiblePayload(defaultCollapsibleExampleSelector, defaultCollapsibleSelector, { kind: "initial" }, false)
	},
	{
		id: "collapsible-disclosure-expanded",
		sourceStateId: "collapsible-component.disclosure.expanded",
		surfaceId: "collapsible-component",
		axis: "disclosure",
		state: "expanded",
		ownerBead: "stark-4sp.4.2",
		routeId: "collapsible",
		runner: "collapsible-states",
		capture: { scope: "component", selector: defaultCollapsibleExampleSelector },
		snapshotName: "collapsible-disclosure-expanded.png",
		maskSelectors: [],
		maxDiffPixels: 1750,
		threshold: 0,
		payload: {
			...collapsiblePayload(defaultCollapsibleExampleSelector, defaultCollapsibleSelector, { kind: "toggle-header" }, true),
			expectedStatus: "SHOWCASE.DEMO.COLLAPSIBLE.OPEN"
		}
	},
	{
		id: "collapsible-content-populated",
		sourceStateId: "collapsible-component.content.populated",
		surfaceId: "collapsible-component",
		axis: "content",
		state: "populated",
		ownerBead: "stark-4sp.4.2",
		routeId: "collapsible",
		runner: "collapsible-states",
		capture: { scope: "component", selector: populatedCollapsibleExampleSelector },
		snapshotName: "collapsible-content-populated.png",
		maskSelectors: [],
		maxDiffPixels: 1950,
		threshold: 0,
		payload: collapsiblePayload(
			populatedCollapsibleExampleSelector,
			populatedCollapsibleSelector,
			{ kind: "initial" },
			true,
			false,
			`${populatedCollapsibleHostSelector} + button.collapsible-demo-button + span.collapsible-demo-status`
		)
	},
	{
		id: "collapsible-focus-rest",
		sourceStateId: "collapsible-component.focus.rest",
		surfaceId: "collapsible-component",
		axis: "focus",
		state: "rest",
		ownerBead: "stark-4sp.4.2",
		routeId: "collapsible",
		runner: "collapsible-states",
		capture: { scope: "component", selector: defaultCollapsibleExampleSelector },
		snapshotName: "collapsible-focus-rest.png",
		maskSelectors: [],
		maxDiffPixels: 930,
		threshold: 0,
		payload: collapsiblePayload(defaultCollapsibleExampleSelector, defaultCollapsibleSelector, { kind: "initial" }, false)
	},
	{
		id: "collapsible-focus-keyboard",
		sourceStateId: "collapsible-component.focus.keyboard",
		surfaceId: "collapsible-component",
		axis: "focus",
		state: "keyboard",
		ownerBead: "stark-4sp.4.2",
		routeId: "collapsible",
		runner: "collapsible-states",
		capture: { scope: "component", selector: defaultCollapsibleExampleSelector },
		snapshotName: "collapsible-focus-keyboard.png",
		maskSelectors: [],
		maxDiffPixels: 930,
		threshold: 0,
		payload: collapsiblePayload(
			defaultCollapsibleExampleSelector,
			defaultCollapsibleSelector,
			{
				kind: "keyboard-focus-header",
				nextFocusableSelector: `${defaultCollapsibleExampleSelector} button.collapsible-demo-button`
			},
			false,
			true
		)
	},
	...navigationControlScenarios,
	...dateControlScenarios,
	...inputFamilyScenarios,
	...feedbackScenarios,
	...genericSearchScenarios,
	...tableSelectionScenarios,
	...routeSearchScenarios
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
	executableScenarios: 300,
	missingVisualFixtures: 22,
	executableScenariosByRunner: {
		"action-bar-disclosure": 5,
		"action-bar-states": 9,
		"app-data-states": 6,
		"app-footer-states": 3,
		"app-logo-focus": 2,
		"breadcrumb-states": 2,
		"collapsible-states": 5,
		"date-control-states": 31,
		"feedback-states": 66,
		"generic-search-states": 13,
		"input-family-states": 66,
		"minimap-states": 7,
		"navigation-control-states": 38,
		"pagination-states": 9,
		"pretty-print-states": 13,
		"route-search-states": 16,
		"table-selection-states": 9
	} as const satisfies Readonly<Record<VisualScenarioRunnerId, number>>,
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
		"message-pane-component": "message-pane",
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
	executableScenarios: readonly ExecutableVisualScenario[] = executableVisualScenarios,
	missingFixtures: readonly MissingVisualFixtureState[] = missingVisualFixtureStates
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
	if (missingFixtures.length !== reviewedCoverageBaseline.missingVisualFixtures) {
		errors.push(
			`reviewed baseline requires ${reviewedCoverageBaseline.missingVisualFixtures} missing visual fixtures, received ${missingFixtures.length}`
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
	for (const duplicate of duplicates(missingFixtures.map(({ sourceStateId }) => sourceStateId))) {
		errors.push(`duplicate missing visual fixture ${duplicate}`);
	}
	const requirementStates = requirements.flatMap((requirement) =>
		requirement.states.map((state) => ({ id: `${requirement.surfaceId}.${requirement.axis}.${state.id}`, requirement }))
	);
	for (const missingFixture of missingFixtures) {
		const sourceState = requirementStates.find(({ id }) => id === missingFixture.sourceStateId);
		if (!sourceState) {
			errors.push(`missing visual fixture references unknown source state ${missingFixture.sourceStateId}`);
			continue;
		}
		if (missingFixture.ownerBead !== sourceState.requirement.ownerBead || isBlank(missingFixture.rationale)) {
			errors.push(`${missingFixture.sourceStateId} has an invalid missing-fixture disposition`);
		}
		if (executableScenarios.some(({ sourceStateId }) => sourceStateId === missingFixture.sourceStateId)) {
			errors.push(`${missingFixture.sourceStateId} is both executable and marked as a missing fixture`);
		}
	}
	for (const { id } of requirementStates.filter(
		({ requirement }) =>
			["stark-4sp.4.2", "stark-4sp.4.3", "stark-4sp.4.4", "stark-4sp.4.5"].includes(requirement.ownerBead) ||
			(["route-search-component", "generic-search-component"].includes(requirement.surfaceId) &&
				requirement.ownerBead === "stark-4sp.4.8") ||
			(requirement.surfaceId === "table-component" && requirement.axis === "selection")
	)) {
		const dispositions =
			Number(executableScenarios.some(({ sourceStateId }) => sourceStateId === id)) +
			Number(missingFixtures.some(({ sourceStateId }) => sourceStateId === id));
		if (dispositions !== 1) {
			errors.push(`${id} must have exactly one executable or missing-fixture disposition`);
		}
	}
	for (const scenarioId of Object.keys(reviewedVisualDiffBudgets)) {
		if (!executableScenarios.some(({ id }) => id === scenarioId)) {
			errors.push(`reviewed visual diff budget references unknown scenario ${scenarioId}`);
		}
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
		if (
			scenario.surfaceId === "route-search-component" &&
			requirementEntry?.ownerBead === "stark-4sp.4.8" &&
			scenario.runner !== "route-search-states"
		) {
			errors.push(`${scenario.id} must use the Route Search state runner`);
		}
		if (
			scenario.surfaceId === "generic-search-component" &&
			requirementEntry?.ownerBead === "stark-4sp.4.8" &&
			scenario.runner !== "generic-search-states"
		) {
			errors.push(`${scenario.id} must use the Generic Search state runner`);
		}
		if (scenario.surfaceId === "table-component" && scenario.axis === "selection" && scenario.runner !== "table-selection-states") {
			errors.push(`${scenario.id} must use the Table selection state runner`);
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
		const reviewedMaxDiffPixels = reviewedVisualDiffBudgets[scenario.id] ?? 0;
		if (
			scenario.maskSelectors.length !== 0 ||
			scenario.maxDiffPixels !== reviewedMaxDiffPixels ||
			!Number.isInteger(scenario.maxDiffPixels) ||
			scenario.maxDiffPixels < 0 ||
			scenario.threshold !== 0
		) {
			errors.push(`${scenario.id} weakens its reviewed unmasked visual comparison`);
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
		} else if (scenario.runner === "action-bar-states") {
			const { action, componentSelector, expectedFocusedActionId, expectedMenuOpen, fixtureSelector } = scenario.payload;
			const isAlternative = fixtureSelector === alternativeActionBarFixtureSelector;
			const expectedComponentSelector = isAlternative ? alternativeActionBarSelector : compactActionBarSelector;
			if (
				scenario.surfaceId !== "action-bar-component" ||
				scenario.routeId !== "action-bar" ||
				scenario.capture.scope !== "component" ||
				(fixtureSelector !== compactActionBarFixtureSelector && !isAlternative) ||
				componentSelector !== expectedComponentSelector ||
				!scenario.payload.primaryButtonSelector.startsWith(`${componentSelector} `) ||
				scenario.payload.alternativeTriggerSelector !== `${componentSelector} > .alt-actions > button.open-alt-actions` ||
				scenario.payload.menuSelector !== actionBarMenuSelector ||
				scenario.payload.menuItemSelector !== `${actionBarMenuSelector} button.stark-action-bar-menu-item` ||
				expectedMenuOpen !== (action.kind === "open-menu") ||
				expectedFocusedActionId !== (action.kind === "keyboard-tab" ? "classic-compact-actionValidate" : null)
			) {
				errors.push(`${scenario.id} does not use the audited Action Bar state fixture and interaction flow`);
			}
		} else if (scenario.runner === "app-data-states") {
			const {
				action,
				buttonSelector,
				componentSelector,
				detailSelector,
				expectedDetailValues,
				expectedFocusVisible,
				expectedFocused,
				expectedMode,
				expectedOpen,
				expectedSummaryValues,
				fixtureSelector
			} = scenario.payload;
			const expectedFixtureSelector = expectedMode === "dropdown" ? appDataDropdownFixtureSelector : appDataMenuFixtureSelector;
			const expectedComponentSelector = expectedMode === "dropdown" ? appDataDropdownComponentSelector : appDataMenuComponentSelector;
			const expectedButtonSelector = expectedMode === "dropdown" ? appDataDropdownButtonSelector : appDataMenuButtonSelector;
			const actionOpensDropdown = action.kind === "open-dropdown";
			const actionUsesKeyboard = action.kind === "keyboard-tab";
			if (
				scenario.surfaceId !== "app-data-component" ||
				scenario.routeId !== "app-data" ||
				scenario.capture.scope !== "component" ||
				fixtureSelector !== expectedFixtureSelector ||
				componentSelector !== expectedComponentSelector ||
				buttonSelector !== expectedButtonSelector ||
				detailSelector !== appDataDetailSelector ||
				JSON.stringify(expectedSummaryValues) !== JSON.stringify(expectedMode === "dropdown" ? appDataExpectedSummaryValues : []) ||
				JSON.stringify(expectedDetailValues) !== JSON.stringify(actionOpensDropdown ? appDataExpectedDetailValues : []) ||
				expectedOpen !== actionOpensDropdown ||
				expectedFocused !== (actionOpensDropdown || actionUsesKeyboard) ||
				expectedFocusVisible !== actionUsesKeyboard ||
				(actionOpensDropdown && expectedMode !== "dropdown") ||
				scenario.capture.selector !== (actionOpensDropdown ? appDataDetailSelector : expectedComponentSelector)
			) {
				errors.push(`${scenario.id} does not use the audited App Data fixture and interaction flow`);
			}
		} else if (scenario.runner === "app-footer-states") {
			const {
				action,
				componentSelector,
				expectedFocusVisible,
				expectedKeyboardFocused,
				expectedText,
				focusTargetSelector,
				helpLinkSelector,
				legalInfoLinkSelector
			} = scenario.payload;
			if (
				scenario.surfaceId !== "app-footer-component" ||
				scenario.routeId !== "app-shell" ||
				scenario.capture.scope !== "component" ||
				scenario.capture.selector !== appFooterComponentSelector ||
				componentSelector !== appFooterComponentSelector ||
				legalInfoLinkSelector !== appFooterLegalInfoLinkSelector ||
				helpLinkSelector !== appFooterHelpLinkSelector ||
				focusTargetSelector !== appFooterLegalInfoLinkSelector ||
				expectedText !== appFooterExpectedText ||
				expectedKeyboardFocused !== (action.kind === "keyboard-tab") ||
				expectedFocusVisible !== (action.kind === "keyboard-tab")
			) {
				errors.push(`${scenario.id} does not use the audited App Footer selectors and keyboard flow`);
			}
		} else if (scenario.runner === "app-logo-focus") {
			const { action, capturePadding, componentSelector, expectedFocusVisible, focusTargetSelector } = scenario.payload;
			if (
				scenario.surfaceId !== "app-logo-component" ||
				scenario.routeId !== "app-shell" ||
				scenario.capture.scope !== "component" ||
				scenario.capture.selector !== appLogoComponentSelector ||
				componentSelector !== appLogoComponentSelector ||
				focusTargetSelector !== appLogoFocusTargetSelector ||
				capturePadding !== 2 ||
				expectedFocusVisible !== (action.kind === "keyboard-tab")
			) {
				errors.push(`${scenario.id} does not use the audited App Logo focus selectors and keyboard flow`);
			}
		} else if (scenario.runner === "breadcrumb-states") {
			const {
				componentSelector,
				expectedFocusVisible,
				expectedLinks,
				expectedSeparator,
				focusTargetSelector,
				linkSelector,
				separatorSelector
			} = scenario.payload;
			if (
				scenario.surfaceId !== "breadcrumb-component" ||
				scenario.routeId !== "breadcrumb" ||
				scenario.capture.scope !== "component" ||
				scenario.capture.selector !== breadcrumbComponentSelector ||
				componentSelector !== breadcrumbComponentSelector ||
				linkSelector !== breadcrumbLinkSelector ||
				separatorSelector !== breadcrumbSeparatorSelector ||
				focusTargetSelector !== breadcrumbFocusTargetSelector ||
				JSON.stringify(expectedLinks) !== JSON.stringify(breadcrumbExpectedLinks) ||
				expectedSeparator !== "›" ||
				expectedFocusVisible !== false
			) {
				errors.push(`${scenario.id} does not use the audited Breadcrumb fixture`);
			}
		} else if (scenario.runner === "minimap-states") {
			const {
				action,
				buttonSelector,
				checkboxSelector,
				componentSelector,
				dotSelector,
				expectedChecked,
				expectedFocusVisible,
				expectedFocused,
				expectedLabels,
				expectedMenuOpen,
				expectedSelected,
				fixtureSelector,
				menuItemSelector,
				menuSelector
			} = scenario.payload;
			const actionOpensMenu = action.kind === "open-menu" || action.kind === "open-menu-toggle-item";
			const actionTogglesItem = action.kind === "open-menu-toggle-item";
			const actionUsesKeyboard = action.kind === "keyboard-tab";
			if (
				scenario.surfaceId !== "minimap-component" ||
				scenario.routeId !== "minimap" ||
				scenario.capture.scope !== "component" ||
				fixtureSelector !== minimapFixtureSelector ||
				componentSelector !== minimapComponentSelector ||
				buttonSelector !== minimapButtonSelector ||
				dotSelector !== minimapDotSelector ||
				menuSelector !== minimapMenuSelector ||
				menuItemSelector !== minimapMenuItemSelector ||
				checkboxSelector !== minimapCheckboxSelector ||
				JSON.stringify(expectedLabels) !== JSON.stringify(minimapExpectedLabels) ||
				JSON.stringify(expectedSelected) !== JSON.stringify(actionTogglesItem ? minimapPartiallyHidden : minimapAllVisible) ||
				JSON.stringify(expectedChecked) !==
					JSON.stringify(actionOpensMenu ? (actionTogglesItem ? minimapPartiallyHidden : minimapAllVisible) : []) ||
				expectedMenuOpen !== actionOpensMenu ||
				expectedFocused !== actionUsesKeyboard ||
				expectedFocusVisible !== actionUsesKeyboard ||
				(actionTogglesItem && action.index !== 1) ||
				scenario.capture.selector !== (actionOpensMenu ? minimapMenuSelector : minimapComponentSelector)
			) {
				errors.push(`${scenario.id} does not use the audited Minimap fixture and interaction flow`);
			}
		} else if (scenario.runner === "pagination-states") {
			let expectedPayload: PaginationStateScenario["payload"] | undefined;
			switch (scenario.sourceStateId) {
				case "pagination-component.content.populated":
				case "pagination-component.availability.previous-disabled":
				case "pagination-component.availability.next-enabled":
				case "pagination-component.focus.rest":
					expectedPayload = paginationPayload("simple", { kind: "initial" });
					break;
				case "pagination-component.availability.next-disabled":
					expectedPayload = paginationPayload(
						"simple",
						{ kind: "go-to-last" },
						{
							expectedCurrentPage: 2,
							expectedFirstDisabled: false,
							expectedPreviousDisabled: false,
							expectedNextDisabled: true,
							expectedLastDisabled: true,
							expectedEvent: '{"page":2,"itemsPerPage":10}'
						}
					);
					break;
				case "pagination-component.selection.first-page":
					expectedPayload = paginationPayload("extended", { kind: "initial" });
					break;
				case "pagination-component.selection.middle-page":
					expectedPayload = paginationPayload(
						"extended",
						{ kind: "go-to-page", page: 5 },
						{
							expectedCurrentPage: 5,
							expectedActivePage: "5",
							expectedPreviousDisabled: false,
							expectedEvent: '{"page":5,"itemsPerPage":2}'
						}
					);
					break;
				case "pagination-component.selection.page-size":
					expectedPayload = paginationPayload(
						"simple",
						{ kind: "select-page-size", size: 20 },
						{
							expectedTotalPages: 1,
							expectedItemsPerPage: 20,
							expectedNextDisabled: true,
							expectedLastDisabled: true,
							expectedEvent: '{"page":1,"itemsPerPage":20}'
						}
					);
					break;
				case "pagination-component.focus.keyboard":
					expectedPayload = paginationPayload("simple", { kind: "keyboard-tab" });
					break;
			}
			if (
				scenario.surfaceId !== "pagination-component" ||
				scenario.routeId !== "pagination" ||
				scenario.capture.scope !== "component" ||
				scenario.capture.selector !== scenario.payload.componentSelector ||
				expectedPayload === undefined ||
				JSON.stringify(scenario.payload) !== JSON.stringify(expectedPayload)
			) {
				errors.push(`${scenario.id} does not use the audited Pagination fixture and interaction flow`);
			}
		} else if (scenario.runner === "pretty-print-states") {
			const expectedPayload = expectedPrettyPrintPayloadForSourceState(scenario.sourceStateId);
			if (
				(scenario.surfaceId !== "pretty-print-component" && scenario.surfaceId !== "pretty-print-service") ||
				scenario.routeId !== "pretty-print" ||
				scenario.capture.scope !== "component" ||
				scenario.capture.selector !== scenario.payload.outputSelector ||
				expectedPayload === undefined ||
				JSON.stringify(scenario.payload) !== JSON.stringify(expectedPayload)
			) {
				errors.push(`${scenario.id} does not use the audited Pretty Print fixture and interaction flow`);
			}
		} else if (scenario.runner === "table-selection-states") {
			const { fixtureSelector, journey, checkpoints, viewport } = scenario.payload;
			const expectedCheckpoints = tableSelectionCheckpoints(journey);
			const expectedState = tableSelectionSourceState(journey);
			const desktop = viewport.width === 1280 && viewport.height === 900;
			const narrow = viewport.width === 390 && viewport.height === 900 && ["pointer-one", "clear"].includes(journey);
			if (
				scenario.surfaceId !== "table-component" ||
				scenario.routeId !== "table" ||
				scenario.ownerBead !== "stark-4sp.4.9" ||
				scenario.axis !== "selection" ||
				scenario.state !== expectedState ||
				expectedCheckpoints === undefined ||
				JSON.stringify(checkpoints) !== JSON.stringify(expectedCheckpoints) ||
				fixtureSelector !== tableSelectionFixtureSelector ||
				(!desktop && !narrow) ||
				scenario.capture.scope !== "component" ||
				scenario.capture.selector !== tableSelectionCaptureSelector ||
				scenario.snapshotName !== `${scenario.id}.png` ||
				scenario.maskSelectors.length !== 0 ||
				scenario.maxDiffPixels !== 0 ||
				scenario.threshold !== 0
			) {
				errors.push(`${scenario.id} does not use the audited Table selection fixture and interaction flow`);
			}
		} else if (scenario.runner === "generic-search-states") {
			const { journey, viewport } = scenario.payload;
			const expectedPayload = genericSearchPayload(journey, viewport);
			const allowedStates: Readonly<Record<string, boolean>> = {
				"disclosure.form-open": journey === "initial" || journey === "reopen",
				"disclosure.form-closed": journey === "close",
				"availability.enabled": ["hero-search", "loading", "no-matches", "reset", "all-results", "movie-action-bar"].includes(
					journey
				),
				"focus.rest": journey === "initial",
				"focus.keyboard": journey === "year-keyboard"
			};
			const desktop = viewport.width === 1280 && viewport.height === 900;
			const narrow = viewport.width === 390 && viewport.height === 844 && ["hero-search", "close"].includes(journey);
			if (
				scenario.surfaceId !== "generic-search-component" ||
				scenario.routeId !== "generic-search" ||
				scenario.ownerBead !== "stark-4sp.4.8" ||
				!allowedStates[`${scenario.axis}.${scenario.state}`] ||
				(!desktop && !narrow) ||
				expectedPayload === undefined ||
				JSON.stringify(scenario.payload) !== JSON.stringify(expectedPayload) ||
				scenario.capture.scope !== "component" ||
				scenario.capture.selector !== genericSearchCaptureSelector(journey) ||
				scenario.snapshotName !== `${scenario.id}.png` ||
				scenario.maskSelectors.length !== 0 ||
				scenario.maxDiffPixels !== 0 ||
				scenario.threshold !== 0
			) {
				errors.push(`${scenario.id} does not use the audited Generic Search fixture and interaction flow`);
			}
		} else if (scenario.runner === "route-search-states") {
			const { action, expected, fixtureSelector } = scenario.payload;
			const expectedOutcome = expectedRouteSearchOutcome(fixtureSelector, action);
			const sourceState = `${scenario.axis}.${scenario.state}`;
			const noMatches = action.kind === "filter" && action.query === "__stark_unmatched_route__";
			const allowedStates: Readonly<Record<string, boolean>> = {
				"content.empty-query": action.kind === "open" || action.kind === "clear",
				"content.matches": action.kind === "filter" && !noMatches,
				"content.no-matches": noMatches,
				"disclosure.closed": action.kind === "initial" || action.kind === "toggle-close",
				"disclosure.open": action.kind === "open" || action.kind === "toggle-reopen",
				"selection.unselected": action.kind === "filter" && !noMatches,
				"selection.selected": action.kind === "select",
				"overlay.closed": action.kind === "escape",
				"overlay.open": action.kind === "filter" && !noMatches
			};
			if (
				scenario.surfaceId !== "route-search-component" ||
				scenario.routeId !== "route-search" ||
				scenario.ownerBead !== "stark-4sp.4.8" ||
				!allowedStates[sourceState] ||
				expectedOutcome === undefined ||
				JSON.stringify(expected) !== JSON.stringify(expectedOutcome) ||
				scenario.capture.scope !== "component" ||
				scenario.capture.selector !== routeSearchCaptureSelector(sourceState, fixtureSelector, expectedOutcome) ||
				scenario.snapshotName !== `${scenario.id}.png` ||
				scenario.maskSelectors.length !== 0 ||
				scenario.maxDiffPixels !== 0 ||
				scenario.threshold !== 0
			) {
				errors.push(`${scenario.id} does not use the audited Route Search fixture and interaction flow`);
			}
		} else if (scenario.runner === "collapsible-states") {
			const { action, componentSelector, contentSelector, headerSelector, statusSelector } = scenario.payload;
			if (
				scenario.surfaceId !== "collapsible-component" ||
				scenario.capture.scope !== "component" ||
				!scenario.capture.selector.startsWith("example-viewer#") ||
				isBlank(componentSelector) ||
				!componentSelector.startsWith(`${scenario.capture.selector} `) ||
				isBlank(headerSelector) ||
				!headerSelector.startsWith(`${componentSelector} `) ||
				isBlank(contentSelector) ||
				!contentSelector.startsWith(`${componentSelector} `) ||
				isBlank(statusSelector) ||
				!statusSelector.startsWith(`${scenario.capture.selector} `) ||
				(action.kind === "keyboard-focus-header" &&
					(isBlank(action.nextFocusableSelector) || !action.nextFocusableSelector.startsWith(`${scenario.capture.selector} `)))
			) {
				errors.push(`${scenario.id} does not use audited Collapsible selectors`);
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
