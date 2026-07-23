/* eslint-disable @angular-eslint/no-lifecycle-call */
import { NgModule, NO_ERRORS_SCHEMA } from "@angular/core";
import { ComponentFixture, TestBed, waitForAsync } from "@angular/core/testing";
import { HttpClientTestingModule } from "@angular/common/http/testing";
import { provideMockStore } from "@ngrx/store/testing";
import { STARK_LOGGING_SERVICE, type StarkLoggingService } from "@nationalbankbelgium/stark-core";
import { NewsPageComponent } from "./news-page.component";
import { vi } from "vitest";

type LoggingServiceMock = Pick<StarkLoggingService, "debug"> & {
	debug: ReturnType<typeof vi.fn<(message: string, ...args: unknown[]) => void>>;
};

@NgModule({
	declarations: [NewsPageComponent],
	schemas: [NO_ERRORS_SCHEMA]
})
class NewsPageTestModule {}

describe(`News`, () => {
	let comp: NewsPageComponent;
	let fixture: ComponentFixture<NewsPageComponent>;
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
				imports: [HttpClientTestingModule, NewsPageTestModule],
				providers: [{ provide: STARK_LOGGING_SERVICE, useValue: logger }, provideMockStore()]
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
		fixture = TestBed.createComponent(NewsPageComponent);
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
