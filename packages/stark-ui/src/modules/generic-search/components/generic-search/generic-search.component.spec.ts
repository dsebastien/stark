import { Component, EventEmitter } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { UntypedFormGroup } from "@angular/forms";
import { MatIconTestingModule } from "@angular/material/icon/testing";
import { NoopAnimationsModule } from "@angular/platform-browser/animations";
import { STARK_LOGGING_SERVICE } from "@nationalbankbelgium/stark-core";
import { TranslateModule } from "@ngx-translate/core";
import { vi } from "vitest";
import { StarkSearchFormComponent } from "../../classes";
import { StarkGenericSearchModule } from "../../generic-search.module";

type LoggingServiceMock = {
	debug: ReturnType<typeof vi.fn>;
	error: ReturnType<typeof vi.fn>;
	warn: ReturnType<typeof vi.fn>;
};

@Component({
	standalone: true,
	selector: "search-form-component",
	template: ""
})
class TestSearchFormComponent implements StarkSearchFormComponent<any> {
	public searchForm: UntypedFormGroup = new UntypedFormGroup({});
	public workingCopyChanged = new EventEmitter<any>();

	public createSearchForm(_searchCriteria: any): UntypedFormGroup {
		return this.searchForm;
	}

	public resetSearchForm(_searchCriteria: any): void {
		/* noop */
	}
}

@Component({
	standalone: true,
	selector: "host-component",
	imports: [StarkGenericSearchModule, TestSearchFormComponent],
	template: `
		<stark-generic-search>
			<search-form-component #searchForm></search-form-component>
		</stark-generic-search>
	`
})
class TestHostComponent {}

@Component({
	standalone: true,
	selector: "bad-host-component",
	imports: [StarkGenericSearchModule],
	template: `<stark-generic-search></stark-generic-search>`
})
class BadTestHostComponent {}

describe("GenericSearchComponent", () => {
	let hostFixture: ComponentFixture<TestHostComponent>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [TestHostComponent, BadTestHostComponent, MatIconTestingModule, NoopAnimationsModule, TranslateModule.forRoot()],
			providers: [{ provide: STARK_LOGGING_SERVICE, useValue: createLoggerMock() }]
		}).compileComponents();
	});

	it("should throw error because `searchFormComponent` is not included", () => {
		hostFixture = TestBed.createComponent(BadTestHostComponent);
		expect(() => hostFixture.detectChanges()).toThrowError("StarkGenericSearchComponent: the searchForm content child is required.");
	});

	it("should not throw error because `searchFormComponent` is included", () => {
		hostFixture = TestBed.createComponent(TestHostComponent);
		expect(() => hostFixture.detectChanges()).not.toThrowError();
	});

	beforeEach(() => {
		hostFixture = TestBed.createComponent(TestHostComponent);
		hostFixture.detectChanges();
	});
});

function createLoggerMock(): LoggingServiceMock {
	return {
		debug: vi.fn(),
		error: vi.fn(),
		warn: vi.fn()
	};
}
