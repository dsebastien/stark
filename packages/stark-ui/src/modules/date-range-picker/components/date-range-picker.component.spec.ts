/* eslint-disable no-null/no-null, @angular-eslint/component-max-inline-declarations */
import { NoopAnimationsModule } from "@angular/platform-browser/animations";
import { Component, ViewChild } from "@angular/core";
import { ComponentFixture, TestBed, waitForAsync } from "@angular/core/testing";
import { UntypedFormControl, UntypedFormGroup, FormsModule, ReactiveFormsModule, ValidationErrors } from "@angular/forms";
import { DateAdapter, MAT_DATE_FORMATS, MAT_DATE_LOCALE } from "@angular/material/core";
import { MAT_MOMENT_DATE_FORMATS, MomentDateAdapter } from "@angular/material-moment-adapter";
import { MatDatepickerModule } from "@angular/material/datepicker";
import { MatFormFieldModule } from "@angular/material/form-field";
import { TranslateModule } from "@ngx-translate/core";
import { STARK_LOGGING_SERVICE, type StarkLoggingService } from "@nationalbankbelgium/stark-core";
import { StarkDatePickerModule } from "@nationalbankbelgium/stark-ui/src/modules/date-picker";
import { StarkInputMaskDirectivesModule } from "@nationalbankbelgium/stark-ui/src/modules/input-mask-directives";
import { StarkDateRangePickerComponent } from "./date-range-picker.component";
import moment from "moment";
import { StarkDateRangePickerModule } from "../date-range-picker.module";
import { vi } from "vitest";

type ObserverSpy = {
	next: ReturnType<typeof vi.fn<(value: unknown) => void>>;
	error: ReturnType<typeof vi.fn<(error: unknown) => void>>;
	complete: ReturnType<typeof vi.fn<() => void>>;
};

const createObserverSpy = (): ObserverSpy => ({
	next: vi.fn<(value: unknown) => void>(),
	error: vi.fn<(error: unknown) => void>(),
	complete: vi.fn<() => void>()
});

const loggingServiceMock: StarkLoggingService = {
	correlationId: "dummyCorrelationId",
	correlationIdHttpHeaderName: "Correlation-Id-HttpHeaderName",
	generateNewCorrelationId: vi.fn(),
	debug: vi.fn(),
	info: vi.fn(),
	warn: vi.fn(),
	error: vi.fn()
} as unknown as StarkLoggingService;

describe("DateRangePickerComponent", () => {
	@Component({
		standalone: true,
		selector: "test-model",
		imports: [FormsModule, StarkDateRangePickerModule],
		template: ` <stark-date-range-picker [(ngModel)]="dateRange"></stark-date-range-picker> `
	})
	class TestModelComponent {
		@ViewChild(StarkDateRangePickerComponent, { static: true })
		public dateRangePicker!: StarkDateRangePickerComponent;

		public dateRange = {};
	}

	@Component({
		standalone: true,
		selector: "test-form-group",
		imports: [ReactiveFormsModule, StarkDateRangePickerModule],
		template: `
			<stark-date-range-picker [rangeFormGroup]="formGroup">
				<ng-container start-date-errors>START-ERROR</ng-container>
				<ng-container end-date-errors>END-ERROR</ng-container>
			</stark-date-range-picker>
		`
	})
	class TestUntypedFormGroupComponent {
		@ViewChild(StarkDateRangePickerComponent, { static: true })
		public dateRangePicker!: StarkDateRangePickerComponent;

		public formGroup = new UntypedFormGroup({
			startDate: new UntypedFormControl(),
			endDate: new UntypedFormControl()
		});
	}

	beforeEach(waitForAsync(() =>
		TestBed.configureTestingModule({
			imports: [
				NoopAnimationsModule,
				MatDatepickerModule,
				MatFormFieldModule,
				FormsModule,
				ReactiveFormsModule,
				StarkDateRangePickerModule,
				StarkDatePickerModule,
				StarkInputMaskDirectivesModule,
				TestModelComponent,
				TestUntypedFormGroupComponent,
				TranslateModule.forRoot()
			],
			providers: [
				{ provide: STARK_LOGGING_SERVICE, useValue: loggingServiceMock },
				{ provide: MAT_DATE_FORMATS, useValue: MAT_MOMENT_DATE_FORMATS },
				{ provide: MAT_DATE_LOCALE, useValue: "en-us" },
				{ provide: DateAdapter, useClass: MomentDateAdapter, deps: [MAT_DATE_LOCALE] }
			]
		}).compileComponents()));

	describe("uncontrolled", () => {
		let fixture: ComponentFixture<StarkDateRangePickerComponent>;
		let component: StarkDateRangePickerComponent;

		function renderComponent(initializer?: (instance: StarkDateRangePickerComponent) => void): void {
			fixture = TestBed.createComponent(StarkDateRangePickerComponent);
			component = fixture.componentInstance;
			initializer?.(component);
			fixture.detectChanges();
		}

		beforeEach(() => {
			renderComponent();
		});

		describe("on initialization", () => {
			it("should set internal component properties", () => {
				expect(fixture).toBeDefined();
				expect(component).toBeDefined();

				expect(component.logger).not.toBeNull();
				expect(component.logger).toBeDefined();
			});

			it("should NOT have any inputs set", () => {
				expect(component.dateFilter).toBeUndefined();
				expect(component.dateMask).toBeUndefined();
				expect(component.endDate).toBeUndefined();
				expect(component.endDateLabel).toBeDefined();
				expect(component.endDateLabel).toEqual("STARK.DATE_RANGE_PICKER.TO");
				expect(component.endMaxDate).toBeNull();
				expect(component.endMinDate).toBeNull();
				expect(component.rangePickerId).toBeDefined();
				expect(component.rangePickerId).toEqual("");
				expect(component.rangePickerName).toBeDefined();
				expect(component.rangePickerName).toEqual("");
				expect(component.startDate).toBeUndefined();
				expect(component.startDateLabel).toBeDefined();
				expect(component.startDateLabel).toEqual("STARK.DATE_RANGE_PICKER.FROM");
				expect(component.startMaxDate).toBeNull();
				expect(component.startMinDate).toBeNull();
				expect(component.dateRangeChanged).toBeDefined();
			});
		});

		describe("date pickers properties", () => {
			let mockObserver: ObserverSpy;

			beforeEach(() => {
				mockObserver = createObserverSpy();
			});

			it("should be set correctly according to the given inputs and WITHOUT triggering a 'dateRangeChanged' event", () => {
				const minDate = new Date(2018, 6, 1);
				const maxDate = new Date(2018, 6, 2);

				renderComponent((instance) => {
					instance.dateRangeChanged.subscribe(mockObserver.next, mockObserver.error, mockObserver.complete);
					instance.rangePickerId = "test-id";
					instance.rangePickerName = "test-name";
					instance.startDateLabel = "startDateLabel";
					instance.endDateLabel = "endDateLabel";
					instance.startMinDate = <any>minDate;
					instance.endMinDate = <any>minDate;
					instance.startMaxDate = <any>maxDate;
					instance.endMaxDate = <any>maxDate;
				});

				expect(fixture.nativeElement.querySelector("input#test-id-start-input")).toBeTruthy();
				expect(fixture.nativeElement.querySelector("input#test-id-end-input")).toBeTruthy();
				expect(fixture.nativeElement.querySelector("mat-datepicker#test-id-start")).toBeTruthy();
				expect(fixture.nativeElement.querySelector("mat-datepicker#test-id-end")).toBeTruthy();
				expect(fixture.nativeElement.querySelector("input[name='test-name-start']")).toBeTruthy();
				expect(fixture.nativeElement.querySelector("input[name='test-name-end']")).toBeTruthy();
				expect(component.startPicker.placeholder).toBe("startDateLabel");
				expect(component.endPicker.placeholder).toBe("endDateLabel");
				expect(component.startPicker.pickerInput.min).not.toBeNull();
				expect((<moment.Moment>component.startPicker.pickerInput.min).toDate()).toEqual(minDate);
				expect(component.endPicker.pickerInput.min).not.toBeNull();
				expect((<moment.Moment>component.endPicker.pickerInput.min).toDate()).toEqual(minDate);
				expect(component.startPicker.pickerInput.max).not.toBeNull();
				expect((<moment.Moment>component.startPicker.pickerInput.max).toDate()).toEqual(maxDate);
				expect(component.endPicker.pickerInput.max).not.toBeNull();
				expect((<moment.Moment>component.endPicker.pickerInput.max).toDate()).toEqual(maxDate);

				expect(mockObserver.next).not.toHaveBeenCalled();
				expect(mockObserver.error).not.toHaveBeenCalled();
				expect(mockObserver.complete).not.toHaveBeenCalled();
			});

			it("the date pickers should be disabled when 'disabled' is true and it should NOT emit a 'dateRangeChanged' event", () => {
				renderComponent((instance) => {
					instance.dateRangeChanged.subscribe(mockObserver.next, mockObserver.error, mockObserver.complete);
					instance.disabled = true;
				});

				expect(component.startPicker.pickerInput.disabled).toBe(true);
				expect(component.endPicker.pickerInput.disabled).toBe(true);

				expect(mockObserver.next).not.toHaveBeenCalled();
				expect(mockObserver.error).not.toHaveBeenCalled();
				expect(mockObserver.complete).not.toHaveBeenCalled();
			});

			it("the date pickers value should be set correctly and they should emit a 'dateRangeChanged' event", () => {
				component.dateRangeChanged.subscribe(mockObserver.next, mockObserver.error, mockObserver.complete);

				const date = new Date(2018, 6, 3);
				component.startDate = date;
				fixture.detectChanges();

				expect(component.startPicker.value).not.toBeNull();
				expect(component.startPicker.value).toEqual(date);
				expect(mockObserver.next).toHaveBeenCalledTimes(1);
				expect(mockObserver.next).toHaveBeenCalledWith({ startDate: date, endDate: undefined });

				mockObserver.next.mockClear();
				component.endDate = date;
				fixture.detectChanges();

				expect(component.endPicker.value).not.toBeNull();
				expect(component.endPicker.value).toEqual(date);
				expect(mockObserver.next).toHaveBeenCalledTimes(1);
				expect(mockObserver.next).toHaveBeenCalledWith({ startDate: date, endDate: date });
				expect(mockObserver.error).not.toHaveBeenCalled();
				expect(mockObserver.complete).not.toHaveBeenCalled();
			});
		});

		describe("dates selection", () => {
			let mockObserver: ObserverSpy;

			beforeEach(() => {
				mockObserver = createObserverSpy();
			});

			it("the end date should be correctly set if after the start date and emit the new value in the 'dateRangeChanged' output", () => {
				// initialize start date
				const startDate = new Date(2018, 6, 6);
				component.startPicker.picker.select(moment(startDate)); // select a date in the internal date picker
				fixture.detectChanges();
				component.dateRangeChanged.subscribe(mockObserver.next, mockObserver.error, mockObserver.complete);

				expect(component.startDate).toEqual(startDate);
				const endDate = new Date(2018, 6, 7);
				component.endPicker.picker.select(moment(endDate)); // select a date in the internal date picker
				fixture.detectChanges();

				expect(component.endDate).toEqual(endDate);

				expect(mockObserver.next).toHaveBeenCalledTimes(1);
				expect(mockObserver.next).toHaveBeenCalledWith({
					startDate: startDate,
					endDate: endDate
				});
				expect(mockObserver.error).not.toHaveBeenCalled();
				expect(mockObserver.complete).not.toHaveBeenCalled();
			});

			it("the end date should be correctly set if start date is undefined and emit the new value in the 'dateRangeChanged' output", () => {
				// initialize start date
				component.startPicker.picker.select(<any>undefined); // select a date in the internal date picker
				fixture.detectChanges();
				component.dateRangeChanged.subscribe(mockObserver.next, mockObserver.error, mockObserver.complete);

				expect(component.startDate).toBeUndefined();
				const endDate = new Date(2018, 6, 8);
				component.endPicker.picker.select(moment(endDate)); // select a date in the internal date picker
				fixture.detectChanges();

				expect(component.endDate).toEqual(endDate);

				expect(mockObserver.next).toHaveBeenCalledTimes(1);
				expect(mockObserver.next).toHaveBeenCalledWith({
					startDate: undefined,
					endDate: endDate
				});
				expect(mockObserver.error).not.toHaveBeenCalled();
				expect(mockObserver.complete).not.toHaveBeenCalled();
			});

			it("the end date should be still valid if it is before the startDate BUT the startDate should be set to undefined and it should emit the new value in the 'dateRangeChanged' output", () => {
				// initialize start date
				const startDate = new Date(2018, 6, 5);
				component.startPicker.picker.select(moment(startDate)); // select a date in the internal date picker
				fixture.detectChanges();
				component.dateRangeChanged.subscribe(mockObserver.next, mockObserver.error, mockObserver.complete);

				expect(component.startDate).toEqual(startDate);
				const endDate = new Date(2018, 6, 4);
				component.endPicker.picker.select(moment(endDate)); // select a date in the internal date picker
				fixture.detectChanges();

				expect(component.startDate).toBeUndefined();
				expect(component.endDate).toEqual(endDate);
				expect(component.endDateFormControl.status).toBe("VALID");

				expect(mockObserver.next).toHaveBeenCalledTimes(1);
				expect(mockObserver.next).toHaveBeenCalledWith({
					startDate: undefined,
					endDate: endDate
				});
				expect(mockObserver.error).not.toHaveBeenCalled();
				expect(mockObserver.complete).not.toHaveBeenCalled();
			});

			it("the start date should be still valid if it is after the endDate BUT the endDate should be set to undefined and it should emit the new value in the 'dateRangeChanged' output", () => {
				// initialize end date
				const endDate = new Date(2018, 6, 5);
				component.endPicker.picker.select(moment(endDate)); // select a date in the internal date picker
				fixture.detectChanges();
				component.dateRangeChanged.subscribe(mockObserver.next, mockObserver.error, mockObserver.complete);

				expect(component.endDate).toEqual(endDate);
				const startDate = new Date(2018, 6, 6);
				component.startPicker.picker.select(moment(startDate)); // select a date in the internal date picker
				fixture.detectChanges();

				expect(component.endDate).toBeUndefined();
				expect(component.startDate).toEqual(startDate);
				expect(component.startDateFormControl.status).toBe("VALID");

				expect(mockObserver.next).toHaveBeenCalledTimes(1);
				expect(mockObserver.next).toHaveBeenCalledWith({
					startDate: startDate,
					endDate: undefined
				});
				expect(mockObserver.error).not.toHaveBeenCalled();
				expect(mockObserver.complete).not.toHaveBeenCalled();
			});
		});
	});

	describe("with ngModel", () => {
		let hostFixture: ComponentFixture<TestModelComponent>;
		let hostComponent: TestModelComponent;
		let component: StarkDateRangePickerComponent;
		let mockObserver: ObserverSpy;

		function renderHost(initializer?: (host: TestModelComponent) => void): void {
			hostFixture = TestBed.createComponent(TestModelComponent);
			hostComponent = hostFixture.componentInstance;
			initializer?.(hostComponent);
			hostFixture.detectChanges();
			component = hostComponent.dateRangePicker;
		}

		beforeEach(() => {
			renderHost();
			mockObserver = createObserverSpy();
		});

		it("should update when model is updated and it should not emit a 'dateRangeChanged' event", waitForAsync(async () => {
			component.dateRangeChanged.subscribe(mockObserver.next, mockObserver.error, mockObserver.complete);
			const dateRange = { startDate: new Date(2019, 0, 1), endDate: new Date(2019, 0, 2) };

			hostComponent.dateRange = dateRange;
			hostFixture.detectChanges();
			await hostFixture.whenStable();
			hostFixture.detectChanges();
			await hostFixture.whenStable();

			expect(component.startDate).toBeDefined();
			expect(component.startDate).toEqual(dateRange.startDate);
			expect(component.endDate).toBeDefined();
			expect(component.endDate).toEqual(dateRange.endDate);

			expect(mockObserver.next).not.toHaveBeenCalled();
			expect(mockObserver.error).not.toHaveBeenCalled();
			expect(mockObserver.complete).not.toHaveBeenCalled();
		}));
	});

	describe("with formGroup", () => {
		let hostFixture: ComponentFixture<TestUntypedFormGroupComponent>;
		let hostComponent: TestUntypedFormGroupComponent;
		let component: StarkDateRangePickerComponent;

		function renderHost(initializer?: (host: TestUntypedFormGroupComponent) => void): void {
			hostFixture = TestBed.createComponent(TestUntypedFormGroupComponent);
			hostComponent = hostFixture.componentInstance;
			initializer?.(hostComponent);
			hostFixture.detectChanges();
			component = hostComponent.dateRangePicker;
		}

		beforeEach(() => {
			renderHost();
		});

		describe("date pickers properties", () => {
			let mockObserver: ObserverSpy;

			beforeEach(() => {
				mockObserver = createObserverSpy();
			});

			it("the date pickers should be disabled when the form controls are disabled AND a 'valueChange' event should be triggered ONLY IF the 'emitEvent' option is enabled", () => {
				hostComponent.formGroup.valueChanges.subscribe(mockObserver.next, mockObserver.error, mockObserver.complete);

				hostComponent.formGroup.disable({ emitEvent: false });
				hostFixture.detectChanges();
				hostFixture.detectChanges();

				expect(component.startPicker.pickerInput.disabled).toBe(true);
				expect(component.endPicker.pickerInput.disabled).toBe(true);

				hostComponent.formGroup.enable({ emitEvent: false });
				hostFixture.detectChanges();
				hostFixture.detectChanges();

				expect(component.startPicker.pickerInput.disabled).toBe(false);
				expect(component.endPicker.pickerInput.disabled).toBe(false);
				expect(mockObserver.next).not.toHaveBeenCalled(); // because the 'emitEvent' is false
				expect(mockObserver.error).not.toHaveBeenCalled();
				expect(mockObserver.complete).not.toHaveBeenCalled();

				hostComponent.formGroup.disable(); // 'emitEvent' true by default
				hostFixture.detectChanges();
				hostFixture.detectChanges();

				expect(component.startPicker.pickerInput.disabled).toBe(true);
				expect(component.endPicker.pickerInput.disabled).toBe(true);
				expect(mockObserver.next).toHaveBeenCalledTimes(1);
				mockObserver.next.mockClear();

				hostComponent.formGroup.enable(); // 'emitEvent' true by default
				hostFixture.detectChanges();
				hostFixture.detectChanges();

				expect(component.startPicker.pickerInput.disabled).toBe(false);
				expect(component.endPicker.pickerInput.disabled).toBe(false);
				expect(mockObserver.next).toHaveBeenCalledTimes(1);
				expect(mockObserver.error).not.toHaveBeenCalled();
				expect(mockObserver.complete).not.toHaveBeenCalled();
			});

			it("should update start and end dates when values in 'rangeFormGroup' are updated", () => {
				const startDate = new Date(2019, 0, 1);
				const endDate = new Date(2019, 0, 2);

				hostComponent.formGroup.setValue({ startDate, endDate });
				hostFixture.detectChanges();

				expect(component.startDate).toBeDefined();
				expect(component.startDate).toEqual(startDate);
				expect(component.endDate).toBeDefined();
				expect(component.endDate).toEqual(endDate);
			});

			it("the start and end dates should be the same as the values set on the form controls of the 'rangeFormGroup'", () => {
				const startDate = new Date(2018, 6, 3);
				const endDate = new Date(2018, 7, 3);
				hostComponent.formGroup.controls["startDate"].setValue(startDate);
				hostComponent.formGroup.controls["endDate"].setValue(endDate);
				hostFixture.detectChanges();

				expect(component.startDate).toBe(startDate);
				expect(component.endDate).toBe(endDate);
			});

			it("should log an error when the given 'rangeFormGroup' does not contain expected 'startDate' and 'endDate' controls", () => {
				renderHost((host) => {
					host.formGroup = new UntypedFormGroup({
						start: new UntypedFormControl(new Date(2019, 0, 1)),
						end: new UntypedFormControl(new Date(2019, 0, 2))
					});
				});

				const loggerErrorSpy = vi.mocked(loggingServiceMock.error);
				expect(loggerErrorSpy).toHaveBeenCalledTimes(1);
				const errorMessage = String(loggerErrorSpy.mock.calls[0]?.[0]);
				expect(errorMessage).toMatch(/formGroup.*startDate.*endDate/);
			});

			it("should show errors at the correct input", () => {
				const { startDate: startDateFormControl, endDate: endDateFormControl } = hostComponent.formGroup.controls;
				const alwaysFail = (): ValidationErrors => ({ alwaysFail: "error" });

				startDateFormControl.setValidators(alwaysFail);
				startDateFormControl.setValue(new Date());
				startDateFormControl.markAsTouched();

				endDateFormControl.setValidators(alwaysFail);
				endDateFormControl.setValue(new Date());
				endDateFormControl.markAsTouched();

				hostFixture.detectChanges();

				const startDateError = hostFixture.nativeElement.querySelectorAll("mat-form-field mat-error").item(0);
				expect(startDateError).not.toBeNull();
				expect(startDateError.textContent).toEqual("START-ERROR");

				const endDateError = hostFixture.nativeElement.querySelectorAll("mat-form-field mat-error").item(1);
				expect(endDateError).not.toBeNull();
				expect(endDateError.textContent).toEqual("END-ERROR");
			});
		});

		describe("dates selection", () => {
			let mockObserver: ObserverSpy;

			beforeEach(() => {
				mockObserver = createObserverSpy();
			});

			it("the end date should be correctly set if after the start date and emit the new value in the form control's 'valueChange' observable", () => {
				// initialize start date
				const startDate = new Date(2018, 6, 6);
				component.startPicker.picker.select(moment(startDate)); // select a date in the internal date picker
				hostFixture.detectChanges();
				hostComponent.formGroup.valueChanges.subscribe(mockObserver.next, mockObserver.error, mockObserver.complete);

				expect(component.startDate).toEqual(startDate);
				const endDate = new Date(2018, 6, 7);
				component.endPicker.picker.select(moment(endDate)); // select a date in the internal date picker
				hostFixture.detectChanges();

				expect(component.endDate).toEqual(endDate);

				expect(mockObserver.next).toHaveBeenCalledTimes(1);
				expect(mockObserver.next).toHaveBeenCalledWith({
					startDate: startDate,
					endDate: endDate
				});
				expect(mockObserver.error).not.toHaveBeenCalled();
				expect(mockObserver.complete).not.toHaveBeenCalled();
			});

			it("the end date should be correctly set if start date is undefined and emit the new value in the form control's 'valueChange' observable", () => {
				// initialize start date
				component.startPicker.picker.select(<any>undefined); // select a date in the internal date picker
				hostFixture.detectChanges();
				hostComponent.formGroup.valueChanges.subscribe(mockObserver.next, mockObserver.error, mockObserver.complete);

				expect(component.startDate).toBeUndefined();
				const endDate = new Date(2018, 6, 8);
				component.endPicker.picker.select(moment(endDate)); // select a date in the internal date picker
				hostFixture.detectChanges();

				expect(component.endDate).toEqual(endDate);

				expect(mockObserver.next).toHaveBeenCalledTimes(1);
				expect(mockObserver.next).toHaveBeenCalledWith({
					startDate: undefined,
					endDate: endDate
				});
				expect(mockObserver.error).not.toHaveBeenCalled();
				expect(mockObserver.complete).not.toHaveBeenCalled();
			});

			it("the end date should be still valid if it is before the startDate BUT the startDate should be set to undefined and it should emit the new value in the form control's 'valueChange' observable", () => {
				// initialize start date
				const startDate = new Date(2018, 6, 5);
				component.startPicker.picker.select(moment(startDate)); // select a date in the internal date picker
				hostFixture.detectChanges();
				hostComponent.formGroup.valueChanges.subscribe(mockObserver.next, mockObserver.error, mockObserver.complete);

				expect(component.startDate).toEqual(startDate);
				const endDate = new Date(2018, 6, 4);
				component.endPicker.picker.select(moment(endDate)); // select a date in the internal date picker
				hostFixture.detectChanges();

				expect(component.startDate).toBeUndefined();
				expect(component.endDate).toEqual(endDate);
				expect(component.endDateFormControl.status).toBe("VALID");

				expect(mockObserver.next).toHaveBeenCalledTimes(1);
				expect(mockObserver.next).toHaveBeenCalledWith({
					startDate: undefined,
					endDate: endDate
				});
				expect(mockObserver.error).not.toHaveBeenCalled();
				expect(mockObserver.complete).not.toHaveBeenCalled();
			});

			it("the start date should be still valid if it is after the endDate BUT the endDate should be set to undefined and it should emit the new value in the form control's 'valueChange' observable", () => {
				// initialize end date
				const endDate = new Date(2018, 6, 5);
				component.endPicker.picker.select(moment(endDate)); // select a date in the internal date picker
				hostFixture.detectChanges();
				hostComponent.formGroup.valueChanges.subscribe(mockObserver.next, mockObserver.error, mockObserver.complete);

				expect(component.endDate).toEqual(endDate);
				const startDate = new Date(2018, 6, 6);
				component.startPicker.picker.select(moment(startDate)); // select a date in the internal date picker
				hostFixture.detectChanges();

				expect(component.endDate).toBeUndefined();
				expect(component.startDate).toEqual(startDate);
				expect(component.startDateFormControl.status).toBe("VALID");

				expect(mockObserver.next).toHaveBeenCalledTimes(1);
				expect(mockObserver.next).toHaveBeenCalledWith({
					startDate: startDate,
					endDate: undefined
				});
				expect(mockObserver.error).not.toHaveBeenCalled();
				expect(mockObserver.complete).not.toHaveBeenCalled();
			});
		});
	});
});
