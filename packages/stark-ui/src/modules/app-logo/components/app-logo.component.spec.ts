import { ComponentFixture, TestBed } from "@angular/core/testing";
import { STARK_LOGGING_SERVICE, STARK_ROUTING_SERVICE } from "@nationalbankbelgium/stark-core";
import { vi } from "vitest";
import { StarkAppLogoComponent } from "./app-logo.component";

type LoggingServiceMock = {
	debug: ReturnType<typeof vi.fn<(message: string, ...args: unknown[]) => void>>;
};

type RoutingServiceMock = {
	navigateToHome: ReturnType<typeof vi.fn<(params?: { [property: string]: any }) => void>>;
};

describe("AppLogoComponent", () => {
	let component: StarkAppLogoComponent;
	let fixture: ComponentFixture<StarkAppLogoComponent>;
	let mockLogger: LoggingServiceMock;
	let mockRoutingService: RoutingServiceMock;

	beforeEach(async () => {
		mockLogger = {
			debug: vi.fn<(message: string, ...args: unknown[]) => void>()
		};
		mockRoutingService = {
			navigateToHome: vi.fn<(params?: { [property: string]: any }) => void>()
		};

		await TestBed.configureTestingModule({
			imports: [StarkAppLogoComponent],
			providers: [
				{ provide: STARK_LOGGING_SERVICE, useValue: mockLogger },
				{ provide: STARK_ROUTING_SERVICE, useValue: mockRoutingService }
			]
		}).compileComponents();
	});

	beforeEach(() => {
		fixture = TestBed.createComponent(StarkAppLogoComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
		mockRoutingService.navigateToHome.mockClear();
	});

	describe("on initialization", () => {
		it("should set internal component properties", () => {
			expect(fixture).toBeDefined();
			expect(component).toBeDefined();
			expect(component.logger).not.toBeNull();
			expect(component.logger).toBeDefined();
			expect(component.routingService).not.toBeNull();
			expect(component.routingService).toBeDefined();
		});

		it("should NOT have any inputs set", () => {
			expect(component.homeStateParams).toBeUndefined();
		});
	});

	describe("logoClickHandler()", () => {
		it("should navigate to Home", () => {
			const dummyClickEvent = {
				preventDefault: vi.fn<() => void>()
			} as unknown as Event;

			component.homeStateParams = {
				someParam: "dummy param"
			};
			fixture.detectChanges();

			component.logoClickHandler(dummyClickEvent);

			expect(mockRoutingService.navigateToHome).toHaveBeenCalledTimes(1);
			expect(mockRoutingService.navigateToHome).toHaveBeenCalledWith(component.homeStateParams);
		});
	});
});
