/* eslint-disable @angular-eslint/no-lifecycle-call */
import { NgModule } from "@angular/core";
import { ComponentFixture, TestBed, waitForAsync } from "@angular/core/testing";
import { HttpClientTestingModule } from "@angular/common/http/testing";
import { StoreModule } from "@ngrx/store";
import { TranslateModule } from "@ngx-translate/core";
import { STARK_LOGGING_SERVICE, type StarkLoggingService } from "@nationalbankbelgium/stark-core";
import { HomePageComponent } from "./home-page.component";
import { vi } from "vitest";

type LoggingServiceMock = Pick<StarkLoggingService, "debug"> & {
	debug: ReturnType<typeof vi.fn<(message: string, ...args: unknown[]) => void>>;
};

@NgModule({
	declarations: [HomePageComponent],
	imports: [TranslateModule]
})
class HomePageTestModule {}

describe(`Home`, () => {
	let comp: HomePageComponent;
	let fixture: ComponentFixture<HomePageComponent>;
	let logger: LoggingServiceMock;

	/**
	 * async beforeEach.
	 */
	beforeEach(waitForAsync(() => {
		logger = {
			debug: vi.fn<(message: string, ...args: unknown[]) => void>()
		};

		return (
			TestBed.configureTestingModule({
				imports: [StoreModule.forRoot({}), HttpClientTestingModule, TranslateModule.forRoot(), HomePageTestModule],
				providers: [{ provide: STARK_LOGGING_SERVICE, useValue: logger }]
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
