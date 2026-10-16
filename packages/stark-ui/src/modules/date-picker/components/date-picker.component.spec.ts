/* eslint-disable @angular-eslint/component-max-inline-declarations */
import { NoopAnimationsModule } from "@angular/platform-browser/animations";
import { By } from "@angular/platform-browser";
import { Component, ViewChild } from "@angular/core";
import { UntypedFormControl, FormsModule, ReactiveFormsModule, Validators } from "@angular/forms";
import { ComponentFixture, TestBed, waitForAsync } from "@angular/core/testing";
import { DateAdapter, MAT_DATE_FORMATS, MAT_DATE_LOCALE } from "@angular/material/core";
import { MatDatepickerModule } from "@angular/material/datepicker";
import { MatFormField, MatFormFieldModule } from "@angular/material/form-field";
import { MatInputModule } from "@angular/material/input";
import { MatMomentDateModule, MomentDateAdapter } from "@angular/material-moment-adapter";
import { TranslateModule } from "@ngx-translate/core";
import { STARK_LOGGING_SERVICE, type StarkLoggingService } from "@nationalbankbelgium/stark-core";
import moment from "moment";
import { DEFAULT_DATE_MASK_CONFIG, StarkDatePickerComponent, StarkDatePickerMaskConfig } from "./date-picker.component";
import { STARK_DATE_FORMATS } from "./date-format.constants";
import { StarkInputMaskDirectivesModule } from "@nationalbankbelgium/stark-ui/src/modules/input-mask-directives";
import { StarkDatePickerModule } from "../date-picker.module";
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

/**
 * To be able to test changes to the input fields, the Date Picker component is hosted inside the TestHostComponent class.
 * This one uses the Input "value" and the Output "dateChange"
 */
@Component({
	standalone: true,
	selector: `host-component`,
	imports: [MatFormFieldModule, StarkDatePickerModule],
	template: `
		<mat-form-field>
			@if (placeholder) {
				<mat-label>{{ placeholder }}</mat-label>
			}
			<stark-date-picker
				[value]="value"
				[pickerId]="pickerId"
				[pickerName]="pickerName"
				[required]="required"
				[disabled]="isDisabled"
				[placeholder]="placeholder"
				[min]="minDate"
				[max]="maxDate"
				(dateChange)="onValueChange($event)"
			></stark-date-picker>
		</mat-form-field>
	`
})
class TestHostComponent {
	@ViewChild(StarkDatePickerComponent, { static: true })
	public datePickerComponent!: StarkDatePickerComponent;

	public value: Date | null = null;
	public pickerId = "";
	public pickerName = "";
	public placeholder = "";
	public isDisabled = false;
	public required = false;
	public minDate: Date | null = null;
	public maxDate: Date | null = null;

	/**
	 * Simulates the OnValueChanges event of the date-picker component
	 * To be able to test the 'Changes' output
	 * @param value - Date.
	 */
	public onValueChange(value: Date | undefined): void {
		this.value = value ?? null;
	}
}

/**
 * To be able to test changes to the input fields, the Date Picker component is hosted inside the TestHostFormControlComponent class.
 * This one does not use the Input "value" nor the Output "dateChange"
 */
@Component({
	standalone: true,
	selector: `host-form-control-component`,
	imports: [MatFormFieldModule, ReactiveFormsModule, StarkDatePickerModule],
	template: `
		<mat-form-field>
			@if (placeholder) {
				<mat-label>{{ placeholder }}</mat-label>
			}
			<stark-date-picker
				[formControl]="formControl"
				[required]="required"
				[pickerId]="pickerId"
				[pickerName]="pickerName"
				[placeholder]="placeholder"
				[dateMask]="dateMask"
				[min]="minDate"
				[max]="maxDate"
			></stark-date-picker>
		</mat-form-field>
	`
})
class TestHostFormControlComponent {
	@ViewChild(StarkDatePickerComponent, { static: true })
	public datePickerComponent!: StarkDatePickerComponent;

	public formControl = new UntypedFormControl();
	public pickerId = "";
	public pickerName = "";
	public dateMask?: StarkDatePickerMaskConfig;
	public placeholder = "";
	public required = false;
	public minDate: Date | null = null;
	public maxDate: Date | null = null;
}

describe("DatePickerComponent", () => {
	let component: StarkDatePickerComponent;

	beforeEach(waitForAsync(() =>
		TestBed.configureTestingModule({
			imports: [
				NoopAnimationsModule,
				MatDatepickerModule,
				MatFormFieldModule,
				MatInputModule,
				MatMomentDateModule,
				FormsModule,
				ReactiveFormsModule,
				StarkDatePickerModule,
				StarkInputMaskDirectivesModule,
				TestHostComponent,
				TestHostFormControlComponent,
				TranslateModule.forRoot()
			],
			providers: [
				{ provide: STARK_LOGGING_SERVICE, useValue: loggingServiceMock },
				{ provide: MAT_DATE_FORMATS, useValue: STARK_DATE_FORMATS },
				{ provide: MAT_DATE_LOCALE, useValue: "en-us" },
				{ provide: DateAdapter, useClass: MomentDateAdapter, deps: [MAT_DATE_LOCALE] }
			]
		}).compileComponents()));

	describe("MatFormFieldControl", () => {
		let hostComponent: TestHostFormControlComponent;
		let hostFixture: ComponentFixture<TestHostFormControlComponent>;
		const formFieldInvalidClass = "mat-form-field-invalid";

		function renderHost(initializer?: (host: TestHostFormControlComponent) => void): void {
			hostFixture = TestBed.createComponent(TestHostFormControlComponent);
			hostComponent = hostFixture.componentInstance;
			initializer?.(hostComponent);
			hostFixture.detectChanges(); // trigger initial data binding
		}

		beforeEach(() => {
			renderHost();
		});

		it("if date is initially invalid, the date picker should not be displayed as invalid until the user interacts with it", () => {
			renderHost((host) => {
				host.formControl = new UntypedFormControl(undefined, Validators.required); // initially invalid
			});

			const formFieldDebugElement = hostFixture.debugElement.query(By.directive(MatFormField));
			expect(formFieldDebugElement.classes[formFieldInvalidClass]).toBeUndefined();

			// more verbose way to create and trigger an event (the only way it works in IE)
			// https://developer.mozilla.org/en-US/docs/Web/Guide/Events/Creating_and_triggering_events
			const blurEvent = document.createEvent("Event");
			blurEvent.initEvent("blur", true, true);
			const inputDebugElement = hostFixture.debugElement.query(By.css("input"));
			inputDebugElement.nativeElement.dispatchEvent(blurEvent); // simulate that the user has touched the input
			hostFixture.detectChanges();

			expect(formFieldDebugElement.classes[formFieldInvalidClass]).toBe(true);
		});

		it("if date is initially invalid, the date picker should not be displayed as invalid until the form control is marked as 'touched'", () => {
			renderHost((host) => {
				host.formControl = new UntypedFormControl(undefined, Validators.required); // initially invalid
			});

			const formFieldDebugElement = hostFixture.debugElement.query(By.directive(MatFormField));
			expect(formFieldDebugElement.classes[formFieldInvalidClass]).toBeUndefined();

			hostComponent.formControl.markAsTouched();
			hostFixture.detectChanges();

			expect(formFieldDebugElement.classes[formFieldInvalidClass]).toBe(true);
		});

		it("if date is initially invalid, the date picker should not be displayed as invalid until the form control is marked as 'dirty'", () => {
			renderHost((host) => {
				host.formControl = new UntypedFormControl(undefined, Validators.required); // initially invalid
			});

			const formFieldDebugElement = hostFixture.debugElement.query(By.directive(MatFormField));
			expect(formFieldDebugElement.classes[formFieldInvalidClass]).toBeUndefined();

			hostComponent.formControl.markAsDirty();
			hostFixture.detectChanges();

			expect(formFieldDebugElement.classes[formFieldInvalidClass]).toBe(true);
		});

		it("if marked as required, an asterisk should be appended to the label", () => {
			const formFieldLabelSelector = ".mat-mdc-floating-label";
			const formFieldRequiredMarkerSelector = ".mat-mdc-form-field-required-marker";

			renderHost((host) => {
				host.placeholder = "this is a placeholder";
			});
			expect(hostFixture.debugElement.query(By.css(formFieldLabelSelector))).toBeTruthy();
			expect(hostFixture.debugElement.query(By.css(formFieldRequiredMarkerSelector))).toBeFalsy();

			renderHost((host) => {
				host.placeholder = "this is a placeholder";
				host.required = <any>""; // coerced to true
			});
			expect(hostFixture.debugElement.query(By.css(formFieldLabelSelector))).toBeTruthy();
			expect(hostFixture.debugElement.query(By.css(formFieldRequiredMarkerSelector))).toBeTruthy();

			renderHost((host) => {
				host.placeholder = "this is a placeholder";
				host.required = false;
			});
			expect(hostFixture.debugElement.query(By.css(formFieldLabelSelector))).toBeTruthy();
			expect(hostFixture.debugElement.query(By.css(formFieldRequiredMarkerSelector))).toBeFalsy();

			renderHost((host) => {
				host.placeholder = "this is a placeholder";
				host.required = true;
			});
			expect(hostFixture.debugElement.query(By.css(formFieldLabelSelector))).toBeTruthy();
			expect(hostFixture.debugElement.query(By.css(formFieldRequiredMarkerSelector))).toBeTruthy();
		});
	});

	describe("using formControl", () => {
		let hostComponent: TestHostFormControlComponent;
		let hostFixture: ComponentFixture<TestHostFormControlComponent>;

		function renderHost(initializer?: (host: TestHostFormControlComponent) => void): void {
			hostFixture = TestBed.createComponent(TestHostFormControlComponent);
			hostComponent = hostFixture.componentInstance;
			initializer?.(hostComponent);
			hostFixture.detectChanges(); // trigger initial data binding

			component = hostComponent.datePickerComponent;
		}

		beforeEach(() => {
			renderHost();
		});

		describe("on initialization", () => {
			it("should set internal component properties", () => {
				expect(hostFixture).toBeDefined();
				expect(component).toBeDefined();
				expect(component.logger).not.toBeNull();
				expect(component.logger).toBeDefined();
			});

			it("should NOT have any inputs set", () => {
				expect(component.value).toBeNull();
				expect(component.dateFilter).toBeUndefined();
				expect(component.disabled).toBe(false);
				expect(component.required).toBe(false);
				expect(component.max).toBeNull();
				expect(component.min).toBeNull();
				expect(component.pickerId).toEqual("");
				expect(component.pickerName).toEqual("");
				expect(component.placeholder).toEqual("");
				expect(component.dateChange).toBeDefined();
				expect(component.dateInput).toBeDefined();
			});
		});

		describe("mat-datepicker properties", () => {
			let mockObserver: ObserverSpy;

			beforeEach(() => {
				mockObserver = createObserverSpy();
			});

			it("should be set correctly according to the given inputs and WITHOUT triggering a 'valueChange' event", () => {
				const minDate = new Date(2018, 6, 1);
				const maxDate = new Date(2018, 6, 2);
				renderHost((host) => {
					host.formControl.valueChanges.subscribe(mockObserver.next, mockObserver.error, mockObserver.complete);
					host.pickerId = "test-id";
					host.pickerName = "test-name";
					host.minDate = minDate;
					host.maxDate = maxDate;
				});

				expect(hostFixture.nativeElement.querySelector("mat-datepicker#test-id")).toBeTruthy();
				expect(hostFixture.nativeElement.querySelector("input#test-id-input")).toBeTruthy(); // the "-input" suffix is appended to the pickerId
				expect(hostFixture.nativeElement.querySelector("input[name='test-name']")).toBeTruthy();
				/// expect(hostFixture.nativeElement.querySelector("input#test-id-input[required]")).toBeTruthy(); // see comment above about Angular 'required' validator
				expect(component.pickerInput.min).not.toBeNull();
				expect((<moment.Moment>component.pickerInput.min).toDate()).toEqual(minDate);
				expect(component.pickerInput.max).not.toBeNull();
				expect((<moment.Moment>component.pickerInput.max).toDate()).toEqual(maxDate);

				expect(mockObserver.next).not.toHaveBeenCalled();
				expect(mockObserver.error).not.toHaveBeenCalled();
				expect(mockObserver.complete).not.toHaveBeenCalled();
			});

			it("the MatDatepickerInput should be disabled when the form control is disabled AND it should trigger a 'valueChange' event ONLY IF the 'emitEvent' option is enabled", () => {
				hostComponent.formControl.valueChanges.subscribe(mockObserver.next, mockObserver.error, mockObserver.complete);

				hostComponent.formControl.disable({ emitEvent: false });
				hostFixture.detectChanges();

				expect(component.pickerInput.disabled).toBe(true);

				hostComponent.formControl.enable({ emitEvent: false });
				hostFixture.detectChanges();

				expect(component.pickerInput.disabled).toBe(false);
				expect(mockObserver.next).not.toHaveBeenCalled(); // because the 'emitEvent' is false
				expect(mockObserver.error).not.toHaveBeenCalled();
				expect(mockObserver.complete).not.toHaveBeenCalled();

				hostComponent.formControl.disable(); // 'emitEvent' true by default
				hostFixture.detectChanges();

				expect(component.pickerInput.disabled).toBe(true);
				expect(mockObserver.next).toHaveBeenCalledTimes(1);
				mockObserver.next.mockClear();

				hostComponent.formControl.enable(); // 'emitEvent' true by default
				hostFixture.detectChanges();

				expect(component.pickerInput.disabled).toBe(false);
				expect(mockObserver.next).toHaveBeenCalledTimes(1);
				expect(mockObserver.error).not.toHaveBeenCalled();
				expect(mockObserver.complete).not.toHaveBeenCalled();
			});

			it("the MatDatepickerInput value should be the same as the form control's value", () => {
				const date = new Date(2018, 6, 3, 10, 15, 20);
				hostComponent.formControl.setValue(date);
				hostFixture.detectChanges();
				expect(component.pickerInput.value).not.toBeNull();
				expect((<moment.Moment>component.pickerInput.value).toDate()).toEqual(date);
			});

			it("should log an error when 'min' value is after 'max' value", () => {
				const loggerErrorSpy = vi.mocked(loggingServiceMock.error);

				renderHost((host) => {
					host.maxDate = new Date(2018, 6, 3, 10, 15, 20);
					host.minDate = new Date(2018, 6, 3, 11, 15, 20); // maxDate + 1 hr
				});

				expect(loggerErrorSpy).toHaveBeenCalledTimes(1);
				const errorMessage = String(loggerErrorSpy.mock.calls[0]?.[0]);
				expect(errorMessage).toMatch(/min date.*cannot be after max date/);
			});
		});

		describe("date mask", () => {
			it("the dateMaskConfig should be DEFAULT_DATE_MASK_CONFIG when 'dateMask' is TRUE or empty string", () => {
				renderHost((host) => {
					host.dateMask = true;
				});
				expect(component.dateMaskConfig).toBe(DEFAULT_DATE_MASK_CONFIG);

				renderHost((host) => {
					host.dateMask = <any>"";
				});
				expect(component.dateMaskConfig).toBe(DEFAULT_DATE_MASK_CONFIG);
			});

			it("the dateMaskConfig should be undefined when 'dateMask' is FALSE", () => {
				renderHost((host) => {
					host.dateMask = false;
				});
				expect(component.dateMaskConfig).toBeUndefined();
			});

			it("the dateMaskConfig should be the same as 'dateMask'", () => {
				const dateMaskConfig: StarkDatePickerMaskConfig = { format: "DD-MM-YYYY" };

				renderHost((host) => {
					host.dateMask = dateMaskConfig;
				});
				expect(component.dateMaskConfig).toBe(dateMaskConfig);
			});

			it("should throw an error when 'dateMask' is not a valid StarkDatePickerMaskConfig value", () => {
				expect(() =>
					renderHost((host) => {
						host.dateMask = <any>{ someProp: "whatever" };
					})
				).toThrowError(/dateMask.*not.*StarkDatePickerMaskConfig/);
			});

			it("should throw an error when 'dateMask' is not compatible with the MAT_DATE_FORMATS provided", () => {
				const expectedError = /dateMask\.format.*parse format.*MAT_DATE_FORMATS.*NOT compatible/;

				// some formats that are incompatible with the parse formats defined in STARK_DATE_FORMATS
				const incompatibleFormats = ["DD/MM/Y", "MM/DD/YYYY", "YYYY/MM/DD", "YYYY MM DD", "YYYY/DD/MM", "L", "l", "HH:mm"];

				for (const format of incompatibleFormats) {
					expect(() =>
						renderHost((host) => {
							host.dateMask = { format: format };
						})
					).toThrowError(expectedError);
				}
			});
		});

		describe("date filters", () => {
			it("filterOnlyWeekdays() should filter week days", () => {
				expect(component.filterOnlyWeekdays(new Date(2018, 6, 16))).toBe(true);
				expect(component.filterOnlyWeekdays(new Date(2018, 6, 17))).toBe(true);
				expect(component.filterOnlyWeekdays(new Date(2018, 6, 18))).toBe(true);
				expect(component.filterOnlyWeekdays(new Date(2018, 6, 19))).toBe(true);
				expect(component.filterOnlyWeekdays(new Date(2018, 6, 20))).toBe(true);
				expect(component.filterOnlyWeekdays(new Date(2018, 6, 21))).toBe(false);
				expect(component.filterOnlyWeekdays(new Date(2018, 6, 22))).toBe(false);
			});

			it("filterOnlyWeekends() should filter week days", () => {
				expect(component.filterOnlyWeekends(new Date(2018, 6, 16))).toBe(false);
				expect(component.filterOnlyWeekends(new Date(2018, 6, 17))).toBe(false);
				expect(component.filterOnlyWeekends(new Date(2018, 6, 18))).toBe(false);
				expect(component.filterOnlyWeekends(new Date(2018, 6, 19))).toBe(false);
				expect(component.filterOnlyWeekends(new Date(2018, 6, 20))).toBe(false);
				expect(component.filterOnlyWeekends(new Date(2018, 6, 21))).toBe(true);
				expect(component.filterOnlyWeekends(new Date(2018, 6, 22))).toBe(true);
			});

			it("dateFilter should be filterOnlyWeekdays() when dateFilter is 'OnlyWeekdays'", () => {
				component.dateFilter = "OnlyWeekdays";
				hostFixture.detectChanges();
				expect(typeof component.dateFilter).toBe("function");
				if (typeof component.dateFilter === "function") {
					/* eslint-disable-next-line @typescript-eslint/unbound-method */
					expect(component.dateFilter).toBe(component.filterOnlyWeekdays);
				}
			});

			it("dateFilter should be filterOnlyWeekends() when dateFilter is 'OnlyWeekends'", () => {
				component.dateFilter = "OnlyWeekends";
				hostFixture.detectChanges();
				expect(typeof component.dateFilter).toBe("function");
				if (typeof component.dateFilter === "function") {
					/* eslint-disable-next-line @typescript-eslint/unbound-method */
					expect(component.dateFilter).toBe(component.filterOnlyWeekends);
				}
			});

			it("dateFilter should be the given filter function if any", () => {
				expect(component.dateFilter).toBeUndefined();

				const filterFn: any = (date: Date): boolean => {
					const day: number = date.getDay();
					return day === 3;
				};
				component.dateFilter = filterFn;
				hostFixture.detectChanges();
				expect(component.dateFilter).toBe(filterFn);
			});
		});

		describe("date changes", () => {
			let mockObserver: ObserverSpy;

			beforeEach(() => {
				mockObserver = createObserverSpy();
			});

			it("should emit the new value in the form control's 'valueChanges' observable", () => {
				const dummyDate = new Date(2018, 6, 3, 10, 15, 20);
				hostComponent.formControl.valueChanges.subscribe(mockObserver.next, mockObserver.error, mockObserver.complete);

				component.picker.select(moment(dummyDate)); // select a date in the internal date picker
				hostFixture.detectChanges();

				expect(mockObserver.next).toHaveBeenCalledTimes(1);
				expect(mockObserver.next).toHaveBeenCalledWith(dummyDate);
				expect(mockObserver.error).not.toHaveBeenCalled();
				expect(mockObserver.complete).not.toHaveBeenCalled();
			});

			it("should emit 'undefined' in the form control's 'valueChanges' observable when the new value is null or undefined", () => {
				// set an initial date
				const initialDummyDate = new Date(2018, 6, 3, 10, 15, 20);
				hostComponent.formControl.setValue(initialDummyDate);
				hostFixture.detectChanges();
				hostComponent.formControl.valueChanges.subscribe(mockObserver.next, mockObserver.error, mockObserver.complete);

				/* eslint-disable-next-line no-null/no-null */
				component.picker.select(<any>null); // set 'null' in the internal date picker
				hostFixture.detectChanges();

				expect(mockObserver.next).toHaveBeenCalledTimes(1);
				expect(mockObserver.next).toHaveBeenCalledWith(undefined);
				mockObserver.next.mockClear();

				// re-initialize date
				hostComponent.formControl.setValue(initialDummyDate, { emitEvent: false });
				hostFixture.detectChanges();
				expect(mockObserver.next).not.toHaveBeenCalled();

				component.picker.select(<any>undefined); // set 'undefined' in the internal date picker
				hostFixture.detectChanges();

				expect(mockObserver.next).toHaveBeenCalledTimes(1);
				expect(mockObserver.next).toHaveBeenCalledWith(undefined);
				expect(mockObserver.error).not.toHaveBeenCalled();
				expect(mockObserver.complete).not.toHaveBeenCalled();
			});
		});
	});

	describe("NOT using formControl", () => {
		let hostComponent: TestHostComponent;
		let hostFixture: ComponentFixture<TestHostComponent>;

		function renderHost(initializer?: (host: TestHostComponent) => void): void {
			hostFixture = TestBed.createComponent(TestHostComponent);
			hostComponent = hostFixture.componentInstance;
			initializer?.(hostComponent);
			hostFixture.detectChanges(); // trigger initial data binding

			component = hostComponent.datePickerComponent;
		}

		beforeEach(() => {
			renderHost();
		});

		describe("on initialization", () => {
			it("should set internal component properties", () => {
				expect(hostFixture).toBeDefined();
				expect(component).toBeDefined();

				expect(component.logger).not.toBeNull();
				expect(component.logger).toBeDefined();
			});

			it("should NOT have any inputs set", () => {
				expect(component.value).toBeNull();
				expect(component.dateFilter).toBeUndefined();
				expect(component.disabled).toBe(false);
				expect(component.required).toBe(false);
				expect(component.max).toBeNull();
				expect(component.min).toBeNull();
				expect(component.pickerId).toEqual("");
				expect(component.pickerName).toEqual("");
				expect(component.placeholder).toEqual("");
				expect(component.dateChange).toBeDefined();
				expect(component.dateInput).toBeDefined();
			});
		});

		describe("mat-datepicker properties", () => {
			it("should be set correctly according to the given inputs and WITHOUT emitting a 'dateChange' event", () => {
				const minDate = new Date(2018, 6, 1);
				const maxDate = new Date(2018, 6, 2);
				renderHost((host) => {
					vi.spyOn(host, "onValueChange");
					host.pickerId = "test-id";
					host.pickerName = "test-name";
					host.minDate = minDate;
					host.maxDate = maxDate;
					host.required = true;
				});

				expect(hostFixture.nativeElement.querySelector("mat-datepicker#test-id")).toBeTruthy();
				expect(hostFixture.nativeElement.querySelector("input#test-id-input")).toBeTruthy(); // the "-input" suffix is appended to the pickerId
				expect(hostFixture.nativeElement.querySelector("input[name='test-name']")).toBeTruthy();
				expect(hostFixture.nativeElement.querySelector("input#test-id-input[required]")).toBeTruthy();
				expect(component.pickerInput.min).not.toBeNull();
				expect((<moment.Moment>component.pickerInput.min).toDate()).toEqual(minDate);
				expect(component.pickerInput.max).not.toBeNull();
				expect((<moment.Moment>component.pickerInput.max).toDate()).toEqual(maxDate);

				expect(hostComponent.onValueChange).not.toHaveBeenCalled();
			});

			it("the MatDatepickerInput should be disabled when 'disabled' is true and it should NOT emit a 'dateChange' event", () => {
				renderHost((host) => {
					vi.spyOn(host, "onValueChange");
					host.isDisabled = true;
				});
				expect(component.pickerInput.disabled).toBe(true);
				expect(hostComponent.onValueChange).not.toHaveBeenCalled();

				renderHost((host) => {
					vi.spyOn(host, "onValueChange");
					host.isDisabled = false;
				});
				expect(component.pickerInput.disabled).toBe(false);
				expect(hostComponent.onValueChange).not.toHaveBeenCalled();
			});

			it("the MatDatepickerInput value should be set when the 'value' input is set and it should not emit a 'dateChange' event", () => {
				const date = new Date(2018, 6, 3, 10, 15, 20);
				renderHost((host) => {
					vi.spyOn(host, "onValueChange");
					host.value = date;
				});
				expect(component.pickerInput.value).not.toBeNull();
				expect((<moment.Moment>component.pickerInput.value).toDate()).toEqual(date);

				expect(hostComponent.onValueChange).not.toHaveBeenCalled();
			});
		});

		describe("date changes", () => {
			let mockObserver: ObserverSpy;

			beforeEach(() => {
				mockObserver = createObserverSpy();
			});

			it("should emit the new value in the 'dateChange' output", () => {
				vi.spyOn(hostComponent, "onValueChange");
				component.dateChange.subscribe(mockObserver.next, mockObserver.error, mockObserver.complete);

				const dummyDate = new Date(2018, 6, 3, 10, 15, 20);
				component.picker.select(moment(dummyDate)); // select a date in the internal date picker
				hostFixture.detectChanges();

				expect(hostComponent.onValueChange).toHaveBeenCalledTimes(1);
				expect(hostComponent.onValueChange).toHaveBeenCalledWith(dummyDate);
				expect(mockObserver.next).toHaveBeenCalledTimes(1);
				expect(mockObserver.next).toHaveBeenCalledWith(dummyDate);
				expect(mockObserver.error).not.toHaveBeenCalled();
				expect(mockObserver.complete).not.toHaveBeenCalled();
			});

			it("should emit 'undefined' in the 'dateChange' output when the new value is null or undefined", () => {
				// set an initial date
				const initialDummyDate = new Date(2018, 6, 3, 10, 15, 20);
				hostComponent.value = initialDummyDate;
				hostFixture.detectChanges();
				const onValueChangeSpy = vi.spyOn(hostComponent, "onValueChange");
				component.dateChange.subscribe(mockObserver.next, mockObserver.error, mockObserver.complete);

				/* eslint-disable-next-line no-null/no-null */
				component.picker.select(<any>null); // set 'null' in the internal date picker
				hostFixture.detectChanges();

				expect(hostComponent.onValueChange).toHaveBeenCalledTimes(1);
				expect(hostComponent.onValueChange).toHaveBeenCalledWith(undefined);
				expect(mockObserver.next).toHaveBeenCalledTimes(1);
				expect(mockObserver.next).toHaveBeenCalledWith(undefined);
				onValueChangeSpy.mockClear();
				mockObserver.next.mockClear();

				// re-initialize date
				hostComponent.value = initialDummyDate;
				hostFixture.detectChanges();
				expect(hostComponent.onValueChange).not.toHaveBeenCalled();
				expect(mockObserver.next).not.toHaveBeenCalled();

				component.picker.select(<any>undefined); // set 'undefined' in the internal date picker
				hostFixture.detectChanges();

				expect(hostComponent.onValueChange).toHaveBeenCalledTimes(1);
				expect(hostComponent.onValueChange).toHaveBeenCalledWith(undefined);
				expect(mockObserver.next).toHaveBeenCalledTimes(1);
				expect(mockObserver.next).toHaveBeenCalledWith(undefined);
				expect(mockObserver.error).not.toHaveBeenCalled();
				expect(mockObserver.complete).not.toHaveBeenCalled();
			});
		});
	});
});
