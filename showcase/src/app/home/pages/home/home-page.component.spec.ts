/* eslint-disable @angular-eslint/no-lifecycle-call */
import { NgModule, NO_ERRORS_SCHEMA } from "@angular/core";
import { ComponentFixture, TestBed, waitForAsync } from "@angular/core/testing";
import { HttpClientTestingModule } from "@angular/common/http/testing";
import { provideMockStore } from "@ngrx/store/testing";
import {
	STARK_APP_CONFIG,
	STARK_HTTP_SERVICE,
	STARK_LOGGING_SERVICE,
	StarkApplicationConfig,
	StarkBackend,
	StarkBackendAuthenticationTypes,
	type StarkLoggingService
} from "@nationalbankbelgium/stark-core";
import { MockStarkHttpService } from "@nationalbankbelgium/stark-core/testing";
import { TranslateModule } from "@ngx-translate/core";
import { HomePageComponent } from "./home-page.component";
import { vi } from "vitest";

type LoggingServiceMock = Pick<StarkLoggingService, "debug"> & {
	debug: ReturnType<typeof vi.fn<(message: string, ...args: unknown[]) => void>>;
};

@NgModule({
	declarations: [HomePageComponent],
	imports: [TranslateModule],
	schemas: [NO_ERRORS_SCHEMA]
})
class HomePageTestModule {}

describe(`Home`, () => {
	let comp: HomePageComponent;
	let fixture: ComponentFixture<HomePageComponent>;
	let logger: LoggingServiceMock;

	const mockBackend = {
		authenticationType: StarkBackendAuthenticationTypes.PUBLIC,
		name: "logging",
		url: "dummy/url"
	} as StarkBackend;

	const mockStarkAppConfig: Partial<StarkApplicationConfig> = {
		angularDebugInfoEnabled: true,
		debugLoggingEnabled: true,
		getBackend: vi.fn<StarkApplicationConfig["getBackend"]>(() => mockBackend)
	};

	/**
	 * async beforeEach.
	 */
	beforeEach(waitForAsync(() => {
		logger = {
			debug: vi.fn<(message: string, ...args: unknown[]) => void>()
		};

		return (
			TestBed.configureTestingModule({
				imports: [HttpClientTestingModule, TranslateModule.forRoot(), HomePageTestModule],
				providers: [
					{ provide: STARK_APP_CONFIG, useValue: mockStarkAppConfig },
					{ provide: STARK_HTTP_SERVICE, useValue: MockStarkHttpService },
					{ provide: STARK_LOGGING_SERVICE, useValue: logger },
					provideMockStore()
				]
			})

				/**
				 * Compile template and css.
				 */
				.compileComponents()
		);
	}));

	/**
	 * Synchronous beforeEach.
	 */
	beforeEach(() => {
		fixture = TestBed.createComponent(HomePageComponent);
		comp = fixture.componentInstance;

		/**
		 * Trigger initial data binding.
		 */
		fixture.detectChanges();
		logger.debug.mockClear();
	});

	it("should log ngOnInit", () => {
		expect(logger.debug).not.toHaveBeenCalled();

		comp.ngOnInit();
		expect(logger.debug).toHaveBeenCalled();
	});
});
