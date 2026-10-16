/* eslint-disable @angular-eslint/no-lifecycle-call */
import { NgModule, NO_ERRORS_SCHEMA } from "@angular/core";
import { ComponentFixture, TestBed, waitForAsync } from "@angular/core/testing";
import { TranslateModule, TranslateService } from "@ngx-translate/core";
import { STARK_APP_SIDEBAR_SERVICE, type StarkAppSidebarService } from "@nationalbankbelgium/stark-ui";
import { AppComponent } from "./app.component";
import {
	STARK_LOGGING_SERVICE,
	STARK_ROUTING_SERVICE,
	type StarkLoggingService,
	type StarkRoutingService
} from "@nationalbankbelgium/stark-core";
import { vi } from "vitest";

type LoggingServiceMock = Pick<StarkLoggingService, "debug"> & {
	debug: ReturnType<typeof vi.fn<(message: string, ...args: unknown[]) => void>>;
};

type RoutingServiceMock = Pick<StarkRoutingService, "navigateToHome"> & {
	navigateToHome: ReturnType<typeof vi.fn<StarkRoutingService["navigateToHome"]>>;
};

type AppSidebarServiceMock = Pick<StarkAppSidebarService, "toggleMenu"> & {
	toggleMenu: ReturnType<typeof vi.fn<() => void>>;
};

@NgModule({
	declarations: [AppComponent],
	imports: [TranslateModule],
	schemas: [NO_ERRORS_SCHEMA]
})
class AppComponentTestModule {}

describe(`App`, () => {
	let component: AppComponent;
	let fixture: ComponentFixture<AppComponent>;
	let mockLogger: LoggingServiceMock;
	let mockRoutingService: RoutingServiceMock;
	let mockSidebarService: AppSidebarServiceMock;

	/**
	 * async beforeEach
	 */
	beforeEach(waitForAsync(() => {
		mockLogger = {
			debug: vi.fn<(message: string, ...args: unknown[]) => void>()
		};
		mockRoutingService = {
			navigateToHome: vi.fn<StarkRoutingService["navigateToHome"]>(() => undefined as any)
		};
		mockSidebarService = {
			toggleMenu: vi.fn<() => void>()
		};

		return (
			TestBed.configureTestingModule({
				imports: [TranslateModule.forRoot(), AppComponentTestModule],
				providers: [
					{ provide: STARK_LOGGING_SERVICE, useValue: mockLogger },
					{ provide: STARK_ROUTING_SERVICE, useValue: mockRoutingService as unknown as StarkRoutingService },
					{ provide: STARK_APP_SIDEBAR_SERVICE, useValue: mockSidebarService as unknown as StarkAppSidebarService },
					TranslateService
				]
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
