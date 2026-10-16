import { ComponentFixture, TestBed } from "@angular/core/testing";
import { TranslateModule } from "@ngx-translate/core";
import { STARK_APP_CONFIG, STARK_LOGGING_SERVICE, STARK_ROUTING_SERVICE, StarkApplicationConfig } from "@nationalbankbelgium/stark-core";
import { StarkSessionExpiredPageComponent } from "./session-expired-page.component";
import { vi } from "vitest";

type LoggingServiceMock = {
	debug: ReturnType<typeof vi.fn<(message: string, ...args: unknown[]) => void>>;
};

type RoutingServiceMock = {
	navigateToHome: ReturnType<typeof vi.fn<(...args: unknown[]) => void>>;
};

describe("SessionExpiredPageComponent", () => {
	let component: StarkSessionExpiredPageComponent;
	let fixture: ComponentFixture<StarkSessionExpiredPageComponent>;

	const mockLogger: LoggingServiceMock = {
		debug: vi.fn<(message: string, ...args: unknown[]) => void>()
	};
	const mockRoutingService: RoutingServiceMock = {
		navigateToHome: vi.fn<(...args: unknown[]) => void>()
	};
	const mockStarkAppConfig: Partial<StarkApplicationConfig> = {
		baseUrl: "base-url"
	};

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [TranslateModule.forRoot(), StarkSessionExpiredPageComponent],
			providers: [
				{ provide: STARK_ROUTING_SERVICE, useValue: mockRoutingService as any },
				{ provide: STARK_LOGGING_SERVICE, useValue: mockLogger as any },
				{ provide: STARK_APP_CONFIG, useValue: mockStarkAppConfig }
			]
		}).compileComponents();
	});

	beforeEach(() => {
		fixture = TestBed.createComponent(StarkSessionExpiredPageComponent);
		component = fixture.componentInstance;
	});

	describe("on initialization", () => {
		it("should set internal component properties", () => {
			expect(fixture).toBeDefined();
			expect(component).toBeDefined();
			expect(component.appConfig).not.toBeNull();
			expect(component.appConfig).toBeDefined();
			expect(component.logger).not.toBeNull();
			expect(component.logger).toBeDefined();
		});
	});

	describe("reload", () => {
		it("should open url", () => {
			const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
			component.reload();
			expect(openSpy).toHaveBeenCalledTimes(1);
			expect(openSpy).toHaveBeenCalledWith("base-url", "_self");
		});
	});
});
