import { ComponentFixture, TestBed } from "@angular/core/testing";
import { NoopAnimationsModule } from "@angular/platform-browser/animations";
import { MatIconTestingModule } from "@angular/material/icon/testing";
import { TranslateModule } from "@ngx-translate/core";
import {
	STARK_LOGGING_SERVICE,
	STARK_ROUTING_SERVICE,
	STARK_SESSION_CONFIG,
	STARK_SESSION_SERVICE,
	StarkSessionConfig,
	starkSessionLogoutStateName
} from "@nationalbankbelgium/stark-core";
import { vi } from "vitest";
import { StarkAppLogoutComponent } from "./app-logout.component";

type LoggingServiceMock = {
	debug: ReturnType<typeof vi.fn<(message: string, ...args: unknown[]) => void>>;
};

type RoutingServiceMock = {
	navigateTo: ReturnType<typeof vi.fn<(state: string) => void>>;
};

type SessionServiceMock = {
	logout: ReturnType<typeof vi.fn<() => void>>;
};

describe("AppLogoutComponent", () => {
	let component: StarkAppLogoutComponent;
	let fixture: ComponentFixture<StarkAppLogoutComponent>;
	let mockLogger: LoggingServiceMock;
	let mockRoutingService: RoutingServiceMock;
	let mockSessionService: SessionServiceMock;

	const mockStarkSessionConfig: StarkSessionConfig = {
		sessionLogoutStateName: "logout-state"
	};

	beforeEach(async () => {
		mockLogger = {
			debug: vi.fn<(message: string, ...args: unknown[]) => void>()
		};
		mockRoutingService = {
			navigateTo: vi.fn<(state: string) => void>()
		};
		mockSessionService = {
			logout: vi.fn<() => void>()
		};

		await TestBed.configureTestingModule({
			imports: [MatIconTestingModule, NoopAnimationsModule, TranslateModule.forRoot(), StarkAppLogoutComponent],
			providers: [
				{ provide: STARK_LOGGING_SERVICE, useValue: mockLogger },
				{ provide: STARK_SESSION_SERVICE, useValue: mockSessionService },
				{ provide: STARK_ROUTING_SERVICE, useValue: mockRoutingService },
				{ provide: STARK_SESSION_CONFIG, useValue: { ...mockStarkSessionConfig } }
			]
		}).compileComponents();
	});

	beforeEach(() => {
		fixture = TestBed.createComponent(StarkAppLogoutComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
		mockSessionService.logout.mockClear();
		mockRoutingService.navigateTo.mockClear();
	});

	describe("on initialization", () => {
		it("should set internal component properties", () => {
			expect(fixture).toBeDefined();
			expect(component).toBeDefined();
			expect(component.logger).not.toBeNull();
			expect(component.logger).toBeDefined();
			expect(component.routingService).not.toBeNull();
			expect(component.routingService).toBeDefined();
			expect(component.sessionService).not.toBeNull();
			expect(component.sessionService).toBeDefined();
			expect(component.sessionConfig).not.toBeNull();
			expect(component.sessionConfig).toBeDefined();
		});

		it("should have its input property filled", () => {
			expect(component.icon).not.toBeNull();
			expect(component.icon).toBeDefined();
			expect(component.icon).toBe("power");
		});
	});

	describe("logout()", () => {
		it("should log out the user and navigate to sessionLogoutStateName defined in sessionConfig", () => {
			component.logout();

			expect(mockSessionService.logout).toHaveBeenCalledTimes(1);
			expect(mockRoutingService.navigateTo).toHaveBeenCalledTimes(1);
			expect(mockRoutingService.navigateTo).toHaveBeenCalledWith(mockStarkSessionConfig.sessionLogoutStateName as string);
		});

		it("should log out the user and navigate to starkSessionLogoutStateName", () => {
			component.sessionConfig!.sessionLogoutStateName = undefined;

			component.logout();

			expect(mockSessionService.logout).toHaveBeenCalledTimes(1);
			expect(mockRoutingService.navigateTo).toHaveBeenCalledTimes(1);
			expect(mockRoutingService.navigateTo).toHaveBeenCalledWith(starkSessionLogoutStateName);
		});
	});
});
