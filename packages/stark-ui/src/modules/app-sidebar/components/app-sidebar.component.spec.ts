import { Subject } from "rxjs";
import { NoopAnimationsModule } from "@angular/platform-browser/animations";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { BreakpointObserver, BreakpointState } from "@angular/cdk/layout";
import { HookMatchCriteria, TransitionHookFn, TransitionStateHookFn } from "@uirouter/core";
import { STARK_LOGGING_SERVICE, STARK_ROUTING_SERVICE, StarkRoutingTransitionHook } from "@nationalbankbelgium/stark-core";
import { StarkAppSidebarComponent } from "./app-sidebar.component";
import { STARK_APP_SIDEBAR_SERVICE, StarkAppSidebarOpenEvent } from "../services";
import { vi } from "vitest";

// Definitions
/**
 * Defines the breakpoint set by the {@link StarkAppSidebarComponent}.
 */
const BREAKPOINT_STRING = "(min-width: 1280px)";
let _fakeBreakPointObservable: Subject<BreakpointState>;

/**
 * Use this function to mock the screen resizing (breakpoint triggering)
 * {@link BreakpointObserver}
 * @param breakPointState - The current state of a layout breakpoint.
 */
function simulateBreakPointStateChange(breakPointState: BreakpointState): void {
	_fakeBreakPointObservable.next(breakPointState);
}

/**
 * Placeholder for function set by the {@link StarkAppSidebarComponent} through `mockStarkRoutingService.addTransitionHook` function.
 * Use this to trigger the flow following a navigation.
 */
let mockNavigationTrigger: () => void;

let fixture: ComponentFixture<StarkAppSidebarComponent>;
let component: StarkAppSidebarComponent;

type LoggingServiceMock = {
	debug: ReturnType<typeof vi.fn<(message: string, ...args: unknown[]) => void>>;
	warn: ReturnType<typeof vi.fn<(message: string, ...args: unknown[]) => void>>;
};

type AppSidebarServiceMock = {
	openSidebar$: Subject<StarkAppSidebarOpenEvent>;
	closeSidebar$: Subject<void>;
	toggleSidebar$: Subject<StarkAppSidebarOpenEvent>;
	close: ReturnType<typeof vi.fn<() => void>>;
};

type RoutingServiceMock = {
	addTransitionHook: ReturnType<
		typeof vi.fn<
			(lifecycleHook: string, matchCriteria: HookMatchCriteria, callback: TransitionHookFn | TransitionStateHookFn) => VoidFunction
		>
	>;
};

type BreakpointObserverMock = {
	isMatched: ReturnType<typeof vi.fn<(value: string | string[]) => boolean>>;
	observe: ReturnType<typeof vi.fn<(value: string | string[]) => Subject<BreakpointState>>>;
	ngOnDestroy: ReturnType<typeof vi.fn<() => void>>;
};

let mockStarkLoggingService: LoggingServiceMock;
let mockStarkAppSideBarService: AppSidebarServiceMock;
let mockStarkRoutingService: RoutingServiceMock;
let mockBreakPointObserver: BreakpointObserverMock;

describe("AppSidebarComponent", () => {
	beforeEach(() => {
		_fakeBreakPointObservable = new Subject<BreakpointState>();
		mockStarkLoggingService = {
			debug: vi.fn<(message: string, ...args: unknown[]) => void>(),
			warn: vi.fn<(message: string, ...args: unknown[]) => void>()
		};
		mockStarkAppSideBarService = {
			openSidebar$: new Subject<StarkAppSidebarOpenEvent>(),
			closeSidebar$: new Subject<void>(),
			toggleSidebar$: new Subject<StarkAppSidebarOpenEvent>(),
			close: vi.fn<() => void>()
		};
		mockStarkRoutingService = {
			addTransitionHook: vi.fn(
				(
					lifecycleHook: string,
					matchCriteria: HookMatchCriteria,
					callback: TransitionHookFn | TransitionStateHookFn
				): VoidFunction => {
					expect(lifecycleHook).toBe(StarkRoutingTransitionHook.ON_SUCCESS);
					expect(matchCriteria).toEqual({});
					mockNavigationTrigger = callback as () => void;
					return (): void => {
						/* Do Nothing*/
					};
				}
			)
		};
		mockBreakPointObserver = {
			isMatched: vi.fn<(value: string | string[]) => boolean>(() => false),
			observe: vi.fn<(value: string | string[]) => Subject<BreakpointState>>((value: string | string[]) => {
				if (
					(typeof value === "string" && value === BREAKPOINT_STRING) ||
					(Array.isArray(value) && value[0] === BREAKPOINT_STRING)
				) {
					return _fakeBreakPointObservable;
				}
				return new Subject<BreakpointState>();
			}),
			ngOnDestroy: vi.fn<() => void>()
		};
	});

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [NoopAnimationsModule, StarkAppSidebarComponent],
			providers: [
				{ provide: STARK_LOGGING_SERVICE, useValue: mockStarkLoggingService as any },
				{ provide: STARK_APP_SIDEBAR_SERVICE, useValue: mockStarkAppSideBarService as any },
				{ provide: STARK_ROUTING_SERVICE, useValue: mockStarkRoutingService as any },
				{ provide: BreakpointObserver, useValue: mockBreakPointObserver as unknown as BreakpointObserver }
			]
		}).compileComponents();
	});

	beforeEach(() => {
		fixture = TestBed.createComponent(StarkAppSidebarComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	describe("sidebar events handling", sidebarEventsHandlingTests);

	describe("screen size change handler", screenSizeChangeHandlingTests);

	describe("navigation handler", navigationHandlingTests);
});

function sidebarEventsHandlingTests(): void {
	describe("onCloseSidenavs should work as expected", () => {
		it("sidenavs should close", () => {
			component.appSidenavLeft.opened = true;
			component.appSidenavRight.opened = true;
			component.onCloseSidenavs();
			expect(component.appSidenavLeft.opened).toBe(false);
			expect(component.appSidenavRight.opened).toBe(false);
		});
	});

	describe("onOpenSidenav should work as expected", () => {
		it("sidenavs should not open when already opened", () => {
			const openSidenavSpy = vi.spyOn(component, "openSidenav");
			component.appSidenavLeft.opened = true;
			fixture.detectChanges();
			component.onOpenSidenav({
				sidebar: "left",
				type: "regular"
			});
			expect(openSidenavSpy).toHaveBeenCalledTimes(0);

			component.appSidenavRight.opened = true;
			fixture.detectChanges();
			component.onOpenSidenav({
				sidebar: "right"
			});
			expect(openSidenavSpy).toHaveBeenCalledTimes(0);
		});

		it("sidenavs should open when closed", () => {
			const openSidenavSpy = vi.spyOn(component, "openSidenav");
			component.appSidenavLeft.opened = false;
			fixture.detectChanges();
			component.onOpenSidenav({
				sidebar: "left",
				type: "regular"
			});
			expect(openSidenavSpy).toHaveBeenCalledTimes(1);

			component.appSidenavRight.opened = false;
			fixture.detectChanges();
			component.onOpenSidenav({
				sidebar: "right"
			});
			expect(openSidenavSpy).toHaveBeenCalledTimes(2);
		});

		it("left sidebar should display the menu correctly", () => {
			component.appSidenavLeft.opened = false;
			fixture.detectChanges();
			component.onOpenSidenav({
				sidebar: "left",
				type: "menu"
			});
			const sidenav: HTMLElement = fixture.nativeElement.querySelector(".stark-app-sidenav-menu");
			expect(sidenav).toBeDefined();
		});

		it("left sidebar should close and then open when left sidebar is opened and sidenavLeftType is changed", () => {
			const shiftLeftSidenavCallbackSpy = vi.spyOn(component, "shiftLeftSidenavCallback");
			const closeSidenavSpy = vi
				.spyOn(component, "closeSidenav")
				.mockImplementation((_sidenav, successHandler: (value: "open" | "close") => void): void => {
					successHandler("close");
				});
			component.sidenavLeftType = "menu";
			component.appSidenavLeft.opened = true;
			fixture.detectChanges();
			component.onOpenSidenav({
				sidebar: "left",
				type: "regular"
			});
			expect(closeSidenavSpy).toHaveBeenCalledTimes(1);
			expect(shiftLeftSidenavCallbackSpy).toHaveBeenCalledTimes(1);
			expect(component.sidenavLeftType).toBe("regular");
		});
	});

	describe("onToggleSidenav should work as expected", () => {
		it("left sidenav should toggle", () => {
			const closeSidenavSpy = vi.spyOn(component, "closeSidenav");
			component.appSidenavLeft.opened = true;
			fixture.detectChanges();
			component.onToggleSidenav({
				sidebar: "left"
			});
			expect(closeSidenavSpy).toHaveBeenCalledTimes(1);

			const openSidenavSpy = vi.spyOn(component, "openSidenav");
			component.appSidenavLeft.opened = false;
			fixture.detectChanges();
			component.onToggleSidenav({
				sidebar: "left"
			});
			expect(openSidenavSpy).toHaveBeenCalledTimes(1);
		});
	});
}

function screenSizeChangeHandlingTests(): void {
	describe("from large desktop screen to smaller", () => {
		const state: BreakpointState = {
			matches: false,
			breakpoints: {}
		};

		it("left sidebar should be 'over' mode", () => {
			component.sidenavLeftMode = "side";
			component.appSidenavLeft.opened = false;
			fixture.detectChanges();
			simulateBreakPointStateChange(state);
			expect(component.sidenavLeftMode).toBe("over");
		});

		it("left sidebar should close when open with type 'menu'", () => {
			const closeSidenavSpy = vi.spyOn(component, "closeSidenav");
			component.appSidenavLeft.opened = true;
			component.sidenavLeftType = "menu";
			fixture.detectChanges();
			simulateBreakPointStateChange(state);
			expect(closeSidenavSpy).toHaveBeenCalledTimes(1);
		});

		it("left sidebar should not close when open with type 'regular'", () => {
			const closeSidenavSpy = vi.spyOn(component, "closeSidenav");
			component.appSidenavLeft.opened = true;
			component.sidenavLeftType = "regular";
			fixture.detectChanges();
			simulateBreakPointStateChange(state);
			expect(closeSidenavSpy).toHaveBeenCalledTimes(0);
		});
	});

	describe("from smaller screen to large desktop", () => {
		const state: BreakpointState = {
			matches: true,
			breakpoints: {}
		};

		it("left sidebar should be side mode", () => {
			component.sidenavLeftMode = "over";
			fixture.detectChanges();
			simulateBreakPointStateChange(state);
			expect(component.sidenavLeftMode).toBe("side");
		});

		it("left sidebar should open with type menu when it is closed", () => {
			const openSidenavSpy = vi.spyOn(component, "openSidenav");
			component.appSidenavLeft.opened = false;
			component.sidenavLeftType = "menu";
			fixture.detectChanges();
			simulateBreakPointStateChange(state);
			expect(openSidenavSpy).toHaveBeenCalledTimes(1);
		});

		it("left sidebar should be displayed in side mode when already opened with type menu", () => {
			component.appSidenavLeft.opened = true;
			component.sidenavLeftType = "menu";
			component.sidenavLeftMode = "over";
			fixture.detectChanges();
			simulateBreakPointStateChange(state);
			expect(component.sidenavLeftMode).toBe("side");
		});
	});
}

function navigationHandlingTests(): void {
	describe("behaviour when automatic closing is enabled (/ default behaviour).", () => {
		beforeEach(() => {
			mockStarkAppSideBarService.close.mockClear();
			fixture.detectChanges();
		});

		it("left sidebar should stay open on larger screen", () => {
			mockBreakPointObserver.isMatched.mockImplementation((value: string | string[]) => {
				expect([[BREAKPOINT_STRING], BREAKPOINT_STRING]).toContain(value);
				return true; // screen is >= 1280px
			});
			mockNavigationTrigger();
			fixture.detectChanges();
			expect(mockStarkAppSideBarService.close).not.toHaveBeenCalled();
		});

		it("left sidebar should close on smaller screen", () => {
			mockBreakPointObserver.isMatched.mockImplementation((value: string | string[]) => {
				expect([[BREAKPOINT_STRING], BREAKPOINT_STRING]).toContain(value);
				return false; // screen is >= 1280px
			});
			mockNavigationTrigger();
			fixture.detectChanges();

			expect(mockStarkAppSideBarService.close).toHaveBeenCalled();
		});
	});

	describe("behaviour when automatic closing is disabled", () => {
		beforeEach(() => {
			mockStarkAppSideBarService.close.mockClear();
			component.closeOnNavigate = false;
			fixture.detectChanges();
		});

		// Function is duplicate, but in a different context (component.closeOnNavigate = false;)
		it("left sidebar should stay open on larger screen", () => {
			mockBreakPointObserver.isMatched.mockImplementation((value: string | string[]) => {
				expect([[BREAKPOINT_STRING], BREAKPOINT_STRING]).toContain(value);
				return true; // screen is >= 1280px
			});
			mockNavigationTrigger();
			fixture.detectChanges();
			expect(mockStarkAppSideBarService.close).not.toHaveBeenCalled();
		});

		it("left sidebar should close on smaller screen", () => {
			mockBreakPointObserver.isMatched.mockImplementation((value: string | string[]) => {
				expect([[BREAKPOINT_STRING], BREAKPOINT_STRING]).toContain(value);
				return false; // screen is >= 1280px
			});
			mockNavigationTrigger();
			fixture.detectChanges();

			expect(mockStarkAppSideBarService.close).not.toHaveBeenCalled();
		});
	});
}
