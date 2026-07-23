import { TestBed } from "@angular/core/testing";
import { Component } from "@angular/core";
import { OverlayContainer } from "@angular/cdk/overlay";
import {
	StateObject,
	StateService,
	UIRouterGlobals,
	UrlService,
	_UIROUTER_INSTANCE_PROVIDERS,
	_UIROUTER_SERVICE_PROVIDERS,
	locationStrategy,
	makeRootProviders,
	UIView
} from "@uirouter/angular";
import { Store } from "@ngrx/store";
import { EffectsModule } from "@ngrx/effects";
import { provideMockActions } from "@ngrx/effects/testing";
import { TranslateModule } from "@ngx-translate/core";
import { of } from "rxjs";
import {
	STARK_APP_CONFIG,
	STARK_LOGGING_SERVICE,
	STARK_ROUTING_SERVICE,
	SESSION_STATES,
	STARK_SESSION_SERVICE,
	starkSessionExpiredStateName,
	starkSessionLogoutStateName
} from "@nationalbankbelgium/stark-core";
import { StarkSessionUiModule } from "./session-ui.module";
import { vi } from "vitest";

type StoreMock = {
	dispatch: ReturnType<typeof vi.fn<(action: unknown) => void>>;
};

type OverlayContainerMock = {
	ngOnDestroy: ReturnType<typeof vi.fn<() => void>>;
};

type SessionServiceMock = {
	pauseUserActivityTracking: ReturnType<typeof vi.fn<() => void>>;
	resumeUserActivityTracking: ReturnType<typeof vi.fn<() => void>>;
};

type LoggingServiceMock = {
	debug: ReturnType<typeof vi.fn<(message: string, ...args: unknown[]) => void>>;
	correlationId: string;
};

type RoutingServiceMock = {
	navigateToHome: ReturnType<typeof vi.fn<() => void>>;
};

describe("SessionUiModule", () => {
	let $state: StateService;
	let $globals: UIRouterGlobals;
	const homeStateNAme = "homepage";

	@Component({ standalone: true, selector: "home-component", template: "HOME" })
	class HomeComponent {}

	@Component({
		standalone: true,
		imports: [UIView],
		selector: "session-ui-test-root",
		template: '<ui-view name="initOrExit"></ui-view>'
	})
	class SessionUiTestRootComponent {}

	const routerConfig = {
		useHash: true,
		deferIntercept: true,
		states: [
			{
				name: homeStateNAme,
				url: `/${homeStateNAme}`,
				parent: "",
				component: HomeComponent
			},
			...SESSION_STATES // these are the parent states of the Session UI States
		]
	};

	let overlayContainer: OverlayContainerMock;
	let mockLogger: LoggingServiceMock;
	let mockRoutingService: RoutingServiceMock;

	beforeEach(async () => {
		TestBed.resetTestingModule();

		overlayContainer = {
			ngOnDestroy: vi.fn<() => void>()
		};
		mockLogger = {
			debug: vi.fn<(message: string, ...args: unknown[]) => void>(),
			correlationId: "mock-correlation-id"
		};
		mockRoutingService = {
			navigateToHome: vi.fn<() => void>()
		};

		await TestBed.configureTestingModule({
			imports: [
				HomeComponent,
				SessionUiTestRootComponent,
				EffectsModule.forRoot([]),
				TranslateModule.forRoot(),
				StarkSessionUiModule.forRoot()
			],
			providers: [
				..._UIROUTER_INSTANCE_PROVIDERS,
				..._UIROUTER_SERVICE_PROVIDERS,
				locationStrategy(routerConfig.useHash),
				...makeRootProviders(routerConfig),
				provideMockActions(() => of("some action")),
				{
					provide: Store,
					useValue: {
						dispatch: vi.fn<(action: unknown) => void>()
					} satisfies StoreMock
				},
				{
					provide: OverlayContainer,
					useValue: overlayContainer
				},
				{
					provide: STARK_LOGGING_SERVICE,
					useValue: mockLogger
				},
				{
					provide: STARK_APP_CONFIG,
					useValue: { baseUrl: "base-url" }
				},
				{
					provide: STARK_ROUTING_SERVICE,
					useValue: mockRoutingService
				},
				{
					provide: STARK_SESSION_SERVICE,
					useValue: {
						pauseUserActivityTracking: vi.fn<() => void>(),
						resumeUserActivityTracking: vi.fn<() => void>()
					} satisfies SessionServiceMock
				}
			]
		}).compileComponents();

		TestBed.createComponent(SessionUiTestRootComponent).detectChanges();
		$state = TestBed.inject(StateService);
		$globals = TestBed.inject(UIRouterGlobals);
		overlayContainer.ngOnDestroy.mockClear();
	});

	afterEach(() => {
		// IMPORTANT: reset the url after each test,
		// otherwise UI-Router will try to find a match of the current url and navigate to it!!
		const urlService = TestBed.inject(UrlService, null);
		urlService?.url("");
	});

	describe("session UI states", () => {
		describe("starkSessionExpiredState", () => {
			it("when navigating to the state, it should destroy the Angular CDK OverlayContainer", async () => {
				const homeState: StateObject = await $state.go(homeStateNAme);
				expect(homeState).toBeDefined();
				expect(homeState.name).toBe(homeStateNAme);
				expect($globals.$current.name).toBe(homeState.name);
				expect(overlayContainer.ngOnDestroy).not.toHaveBeenCalled();

				const enteredState: StateObject = await $state.go(starkSessionExpiredStateName);
				expect(enteredState).toBeDefined();
				expect(enteredState.name).toBe(starkSessionExpiredStateName);
				expect($globals.$current.name).toBe(enteredState.name);
				expect(overlayContainer.ngOnDestroy).toHaveBeenCalledTimes(1);
			});
		});

		describe("starkSessionLogoutState", () => {
			it("when navigating to the state, it should destroy the Angular CDK OverlayContainer", async () => {
				const homeState: StateObject = await $state.go(homeStateNAme);
				expect(homeState).toBeDefined();
				expect(homeState.name).toBe(homeStateNAme);
				expect($globals.$current.name).toBe(homeState.name);
				expect(overlayContainer.ngOnDestroy).not.toHaveBeenCalled();

				const enteredState: StateObject = await $state.go(starkSessionLogoutStateName);
				expect(enteredState).toBeDefined();
				expect(enteredState.name).toBe(starkSessionLogoutStateName);
				expect($globals.$current.name).toBe(enteredState.name);
				expect(overlayContainer.ngOnDestroy).toHaveBeenCalledTimes(1);
			});
		});
	});
});
