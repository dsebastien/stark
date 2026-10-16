/* eslint-disable @angular-eslint/no-lifecycle-call */
import { NgModule } from "@angular/core";
import { ActivatedRoute, Data } from "@angular/router";
import { ComponentFixture, TestBed, waitForAsync } from "@angular/core/testing";
import { StoreModule } from "@ngrx/store";
import { TranslateModule } from "@ngx-translate/core";
import {
	STARK_APP_CONFIG,
	STARK_LOGGING_SERVICE,
	StarkApplicationConfig,
	StarkBackend,
	StarkBackendAuthenticationTypes,
	type StarkLoggingService
} from "@nationalbankbelgium/stark-core";
import { AboutPageComponent } from "./about-page.component";
import { vi } from "vitest";

type LoggingServiceMock = Pick<StarkLoggingService, "debug"> & {
	debug: ReturnType<typeof vi.fn<(message: string, ...args: unknown[]) => void>>;
};

@NgModule({
	declarations: [AboutPageComponent],
	imports: [TranslateModule]
})
class AboutPageTestModule {}

describe("About", () => {
	/**
	 * Provide our implementations or mocks to the dependency injector
	 */
	let about: AboutPageComponent;
	let fixture: ComponentFixture<AboutPageComponent>;
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

	beforeEach(waitForAsync(() => {
		logger = {
			debug: vi.fn<(message: string, ...args: unknown[]) => void>()
		};

		return TestBed.configureTestingModule({
			imports: [StoreModule.forRoot({}), TranslateModule.forRoot(), AboutPageTestModule],
			providers: [
				/**
				 * Provide a better mock.
				 */
				{
					provide: ActivatedRoute,
					useValue: {
						data: {
							subscribe: (fn: (value: Data) => void): void =>
								fn({
									yourData: "yolo"
								})
						}
					}
				},
				{ provide: STARK_APP_CONFIG, useValue: mockStarkAppConfig },
				{ provide: STARK_LOGGING_SERVICE, useValue: logger }
			]
		}).compileComponents();
	}));

	beforeEach(() => {
		fixture = TestBed.createComponent(AboutPageComponent);
		about = fixture.componentInstance;
		fixture.detectChanges();
		logger.debug.mockClear();
	});

	it("should log ngOnInit", () => {
		expect(logger.debug).not.toHaveBeenCalled();

		about.ngOnInit();
		expect(logger.debug).toHaveBeenCalled();
	});
});
