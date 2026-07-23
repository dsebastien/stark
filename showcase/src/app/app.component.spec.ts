/* eslint-disable @angular-eslint/no-lifecycle-call */
import { BreakpointObserver, type BreakpointState } from "@angular/cdk/layout";
import { NgModule, NO_ERRORS_SCHEMA } from "@angular/core";
import { ComponentFixture, TestBed, waitForAsync } from "@angular/core/testing";
import { TranslateModule, TranslateService } from "@ngx-translate/core";
import { STARK_APP_SIDEBAR_SERVICE, type StarkAppSidebarService } from "@nationalbankbelgium/stark-ui";
import { UIRouterModule } from "@uirouter/angular";
import { AppComponent } from "./app.component";
import {
	STARK_APP_METADATA,
	STARK_LOGGING_SERVICE,
	STARK_ROUTING_SERVICE,
	STARK_SESSION_SERVICE,
	STARK_USER_SERVICE,
	StarkApplicationMetadata,
	StarkApplicationMetadataImpl,
	StarkLanguages,
	StarkUser,
	type StarkLoggingService,
	type StarkRoutingService,
	type StarkSessionService,
	type StarkUserService
} from "@nationalbankbelgium/stark-core";
import { of, type Observable } from "rxjs";
import { vi } from "vitest";

type LoggingServiceMock = Pick<StarkLoggingService, "debug"> & {
	debug: ReturnType<typeof vi.fn<(message: string, ...args: unknown[]) => void>>;
};

type RoutingServiceMock = Pick<StarkRoutingService, "addTransitionHook" | "navigateToHome"> & {
	addTransitionHook: ReturnType<typeof vi.fn<StarkRoutingService["addTransitionHook"]>>;
	navigateToHome: ReturnType<typeof vi.fn<StarkRoutingService["navigateToHome"]>>;
};

type AppSidebarServiceMock = Pick<StarkAppSidebarService, "toggleMenu" | "openLeft" | "openRight"> & {
	toggleMenu: ReturnType<typeof vi.fn<() => void>>;
	openLeft: ReturnType<typeof vi.fn<() => void>>;
	openRight: ReturnType<typeof vi.fn<() => void>>;
};

type UserServiceMock = Pick<StarkUserService, "fetchUserProfile"> & {
	fetchUserProfile: ReturnType<typeof vi.fn<() => Observable<StarkUser>>>;
};

type BreakpointObserverMock = Pick<BreakpointObserver, "isMatched" | "observe"> & {
	isMatched: ReturnType<typeof vi.fn<(query: string | string[]) => boolean>>;
	observe: ReturnType<typeof vi.fn<(query: string | string[]) => Observable<BreakpointState>>>;
};

@NgModule({
	declarations: [AppComponent],
	imports: [TranslateModule, UIRouterModule],
	schemas: [NO_ERRORS_SCHEMA]
})
class AppComponentTestModule {}

describe(`App`, () => {
	let component: AppComponent;
	let fixture: ComponentFixture<AppComponent>;
	let appMetadata: StarkApplicationMetadata;
	let mockLogger: LoggingServiceMock;
	let mockRoutingService: RoutingServiceMock;
	let mockSidebarService: AppSidebarServiceMock;
	let mockUserService: UserServiceMock;
	let mockBreakpointObserver: BreakpointObserverMock;
	appMetadata = new StarkApplicationMetadataImpl();
	appMetadata.supportedLanguages = [StarkLanguages.EN_US, StarkLanguages.FR_BE, StarkLanguages.NL_BE];
	const mockUser: StarkUser = {
		uuid: "1",
		username: "username",
		firstName: "firstName",
		lastName: "lastName",
		email: "email",
		phone: "02/221.12.34",
		language: "en",
		selectedLanguage: "en",
		referenceNumber: "12345",
		roles: ["employee"],
		isAnonymous: false
	};
	/**
	 * async beforeEach
	 */
	beforeEach(waitForAsync(() => {
		mockLogger = {
			debug: vi.fn<(message: string, ...args: unknown[]) => void>()
		};
		mockRoutingService = {
			addTransitionHook: vi.fn<StarkRoutingService["addTransitionHook"]>(() => () => undefined),
			navigateToHome: vi.fn<StarkRoutingService["navigateToHome"]>(() => undefined as any)
		};
		mockSidebarService = {
			toggleMenu: vi.fn<() => void>(),
			openLeft: vi.fn<() => void>(),
			openRight: vi.fn<() => void>()
		};
		mockUserService = {
			fetchUserProfile: vi.fn<() => Observable<StarkUser>>()
		};
		mockBreakpointObserver = {
			isMatched: vi.fn<(query: string | string[]) => boolean>(() => false),
			observe: vi.fn<(query: string | string[]) => Observable<BreakpointState>>(() =>
				of({ matches: false, breakpoints: {} } as BreakpointState)
			)
		};

		return (
			TestBed.configureTestingModule({
				imports: [TranslateModule.forRoot(), UIRouterModule.forRoot({ useHash: true }), AppComponentTestModule],
				providers: [
					{ provide: STARK_LOGGING_SERVICE, useValue: mockLogger },
					{ provide: STARK_ROUTING_SERVICE, useValue: mockRoutingService as unknown as StarkRoutingService },
					{ provide: STARK_APP_SIDEBAR_SERVICE, useValue: mockSidebarService as unknown as StarkAppSidebarService },
					{ provide: STARK_USER_SERVICE, useValue: mockUserService as unknown as StarkUserService },
					{ provide: STARK_SESSION_SERVICE, useValue: {} as StarkSessionService },
					{ provide: STARK_APP_METADATA, useValue: appMetadata },
					{ provide: BreakpointObserver, useValue: mockBreakpointObserver },
					TranslateService
				]
			})
				.overrideComponent(AppComponent, {
					set: {
						template: ""
					}
				})
				/**
				 * Compile template and css
				 */
				.compileComponents()
		);
	}));

	/**
	 * Synchronous beforeEach
	 */
	beforeEach(() => {
		fixture = TestBed.createComponent(AppComponent);
		component = fixture.componentInstance;

		mockUserService.fetchUserProfile.mockReset();
		mockUserService.fetchUserProfile.mockReturnValue(of(mockUser));

		/**
		 * Trigger initial data binding
		 */
		fixture.detectChanges();
	});

	it(`should be readly initialized`, () => {
		expect(fixture).toBeDefined();
		expect(component).toBeDefined();
	});

	it("should log ngOnInit", () => {
		mockLogger.debug.mockClear();
		expect(component.logger.debug).not.toHaveBeenCalled();

		component.ngOnInit();
		expect(component.logger.debug).toHaveBeenCalled();
	});
});
