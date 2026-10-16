/* eslint-disable @angular-eslint/no-lifecycle-call */
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { Observable, of, throwError } from "rxjs";
import { RawParams } from "@uirouter/core";
import {
	STARK_LOGGING_SERVICE,
	STARK_ROUTING_SERVICE,
	STARK_SESSION_SERVICE,
	STARK_USER_SERVICE,
	StarkUser
} from "@nationalbankbelgium/stark-core";
import { StarkPreloadingPageComponent } from "./preloading-page.component";
import { vi } from "vitest";

type LoggingServiceMock = {
	debug: ReturnType<typeof vi.fn<(message: string, ...args: unknown[]) => void>>;
	error: ReturnType<typeof vi.fn<(message: string, ...args: unknown[]) => void>>;
	correlationId: string;
};

type UserServiceMock = {
	fetchUserProfile: ReturnType<typeof vi.fn<() => Observable<StarkUser> | undefined>>;
};

type SessionServiceMock = {
	login: ReturnType<typeof vi.fn<(user: StarkUser) => void>>;
};

type RoutingServiceMock = {
	navigateTo: ReturnType<typeof vi.fn<(state: string, params?: RawParams) => void>>;
	navigateToHome: ReturnType<typeof vi.fn<() => void>>;
	reload: ReturnType<typeof vi.fn<() => void>>;
};

describe("PreloadingPageComponent", () => {
	let component: StarkPreloadingPageComponent;
	let fixture: ComponentFixture<StarkPreloadingPageComponent>;
	let mockLogger: LoggingServiceMock;
	let mockUserService: UserServiceMock;
	let mockSessionService: SessionServiceMock;
	let mockRoutingService: RoutingServiceMock;

	const mockUser: StarkUser = { firstName: "John", lastName: "Doe", username: "jdoe", uuid: "mock-uuid", roles: [] };

	beforeEach(async () => {
		mockLogger = {
			debug: vi.fn<(message: string, ...args: unknown[]) => void>(),
			error: vi.fn<(message: string, ...args: unknown[]) => void>(),
			correlationId: "mock-correlation-id"
		};
		mockUserService = {
			fetchUserProfile: vi.fn(() => of(mockUser))
		};
		mockSessionService = {
			login: vi.fn<(user: StarkUser) => void>()
		};
		mockRoutingService = {
			navigateTo: vi.fn<(state: string, params?: RawParams) => void>(),
			navigateToHome: vi.fn<() => void>(),
			reload: vi.fn<() => void>()
		};

		await TestBed.configureTestingModule({
			imports: [StarkPreloadingPageComponent],
			providers: [
				{ provide: STARK_LOGGING_SERVICE, useValue: mockLogger as any },
				{ provide: STARK_ROUTING_SERVICE, useValue: mockRoutingService as any },
				{ provide: STARK_USER_SERVICE, useValue: mockUserService as any },
				{ provide: STARK_SESSION_SERVICE, useValue: mockSessionService as any }
			]
		}).compileComponents();
	});

	beforeEach(() => {
		fixture = TestBed.createComponent(StarkPreloadingPageComponent);
		component = fixture.componentInstance;

		mockUserService.fetchUserProfile.mockClear();
		mockSessionService.login.mockClear();
		mockRoutingService.navigateTo.mockClear();
		mockRoutingService.navigateToHome.mockClear();
		mockRoutingService.reload.mockClear();
		mockLogger.error.mockClear();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	describe("on initialization", () => {
		it("should set internal component properties", () => {
			expect(fixture).toBeDefined();
			expect(component).toBeDefined();
			expect(component.logger).not.toBeNull();
			expect(component.logger).toBeDefined();
			expect(component.routingService).not.toBeNull();
			expect(component.routingService).toBeDefined();
			expect(component.userService).not.toBeNull();
			expect(component.userService).toBeDefined();
		});
	});

	describe("ngOnInit", () => {
		it("should log the user in automatically after fetching the user profile successfully", () => {
			vi.useFakeTimers();
			mockUserService.fetchUserProfile.mockReturnValue(of(mockUser));
			component.loginDelay = 1;

			component.ngOnInit();
			vi.advanceTimersByTime(1);

			expect(mockUserService.fetchUserProfile).toHaveBeenCalledTimes(1);
			expect(mockSessionService.login).toHaveBeenCalledTimes(1);
			expect(mockSessionService.login).toHaveBeenCalledWith(mockUser);
			expect(component.userFetchingFailed).toBeFalsy();
		});

		it("should navigate to home or the target state if defined after fetching the user profile successfully", () => {
			vi.useFakeTimers();
			mockUserService.fetchUserProfile.mockReturnValue(of(mockUser));
			component.loginDelay = 1;

			component.ngOnInit();
			vi.advanceTimersByTime(1);

			expect(mockRoutingService.navigateToHome).toHaveBeenCalledTimes(1);
			expect(mockRoutingService.navigateTo).not.toHaveBeenCalled();

			mockRoutingService.navigateToHome.mockClear();
			component.targetState = "dummy state";
			component.targetStateParams = { someParam: "dummy param" };
			component.ngOnInit();
			vi.advanceTimersByTime(1);

			expect(mockRoutingService.navigateToHome).not.toHaveBeenCalled();
			expect(mockRoutingService.navigateTo).toHaveBeenCalledTimes(1);
			expect(mockRoutingService.navigateTo).toHaveBeenCalledWith(component.targetState, component.targetStateParams);
		});

		it("should NOT do anything when the user profile cannot be fetched", () => {
			vi.useFakeTimers();
			mockUserService.fetchUserProfile.mockReturnValue(throwError(() => "could not fetch user profile") as any);
			component.loginDelay = 1;

			component.ngOnInit();
			vi.advanceTimersByTime(1);

			expect(mockRoutingService.navigateToHome).not.toHaveBeenCalled();
			expect(mockRoutingService.navigateTo).not.toHaveBeenCalled();
			expect(component.userFetchingFailed).toBe(true);
		});

		it("should fail gracefully when the user service does not return an observable", () => {
			mockUserService.fetchUserProfile.mockReturnValue(undefined);

			component.ngOnInit();

			expect(mockLogger.error).toHaveBeenCalledTimes(1);
			expect(component.userFetchingFailed).toBe(true);
			expect(component.correlationId).toBe(mockLogger.correlationId);
			expect(mockSessionService.login).not.toHaveBeenCalled();
			expect(mockRoutingService.navigateToHome).not.toHaveBeenCalled();
			expect(mockRoutingService.navigateTo).not.toHaveBeenCalled();
		});
	});

	describe("reload", () => {
		it("should call reload method of routingService", () => {
			component.reload();
			expect(component.routingService.reload).toHaveBeenCalledTimes(1);
		});
	});
});
