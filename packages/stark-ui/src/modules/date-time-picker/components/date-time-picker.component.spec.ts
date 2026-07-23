/* eslint-disable @angular-eslint/component-max-inline-declarations */
import { Component, ViewChild } from "@angular/core";
import { ComponentFixture, TestBed, waitForAsync } from "@angular/core/testing";
import { NoopAnimationsModule } from "@angular/platform-browser/animations";
import { UntypedFormControl, ReactiveFormsModule, Validators } from "@angular/forms";
import { By } from "@angular/platform-browser";
import { MatFormField, MatFormFieldModule } from "@angular/material/form-field";
import { DateAdapter, MAT_DATE_FORMATS, MAT_DATE_LOCALE } from "@angular/material/core";
import { MatIconTestingModule } from "@angular/material/icon/testing";
import { MomentDateAdapter } from "@angular/material-moment-adapter";
import { TranslateModule } from "@ngx-translate/core";
import { STARK_LOGGING_SERVICE, type StarkLoggingService } from "@nationalbankbelgium/stark-core";
import moment from "moment";
import {
	STARK_DATE_FORMATS,
	StarkDatePickerFilter,
	StarkDatePickerMaskConfig
} from "@nationalbankbelgium/stark-ui/src/modules/date-picker";
import { StarkTimestampMaskConfig } from "@nationalbankbelgium/stark-ui/src/modules/input-mask-directives";
import { DEFAULT_TIME_MASK_CONFIG, StarkDateTimePickerComponent } from "./date-time-picker.component";
import { StarkDateTimePickerModule } from "../date-time-picker.module";
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

@Component({
	standalone: true,
	selector: "host-component",
	imports: [MatFormFieldModule, StarkDateTimePickerModule],
	template: `
		<mat-form-field>
			@if (placeholder) {
				<mat-label>{{ placeholder }}</mat-label>
			}
			<stark-date-time-picker
				[value]="value"
				[pickerId]="pickerId"
				[pickerName]="pickerName"
				[placeholder]="placeholder"
				[disabled]="isDisabled"
				[required]="required"
				[dateMask]="dateMask"
				[timeMask]="timeMask"
				[dateFilter]="dateFilter"
				[min]="minDate"
				[max]="maxDate"
				(dateTimeChange)="onValueChange($event)"
			></stark-date-time-picker>
		</mat-form-field>
	`
})
class TestHostComponent {
	@ViewChild(StarkDateTimePickerComponent, { static: true })
	public dateTimePickerComponent!: StarkDateTimePickerComponent;

	public value: Date | null = null;
	public pickerId = "";
	public pickerName = "";
	public placeholder = "";
	public isDisabled = false;
	public required = false;
	public dateMask?: StarkDatePickerMaskConfig;
	public timeMask: StarkTimestampMaskConfig = DEFAULT_TIME_MASK_CONFIG;
	public dateFilter?: StarkDatePickerFilter;
	public minDate: Date | null = null;
	public maxDate: Date | null = null;

	public onValueChange = vi.fn((value: Date | null): void => {
		this.value = value;
	});
}

@Component({
	standalone: true,
	selector: "host-form-control-component",
	imports: [MatFormFieldModule, ReactiveFormsModule, StarkDateTimePickerModule],
	template: `
		<mat-form-field>
			@if (placeholder) {
				<mat-label>{{ placeholder }}</mat-label>
			}
			<stark-date-time-picker
				[formControl]="formControl"
				[pickerId]="pickerId"
				[pickerName]="pickerName"
				[placeholder]="placeholder"
				[required]="required"
				[dateMask]="dateMask"
				[timeMask]="timeMask"
				[dateFilter]="dateFilter"
				[min]="minDate"
				[max]="maxDate"
			></stark-date-time-picker>
		</mat-form-field>
	`
})
class TestHostFormControlComponent {
	@ViewChild(StarkDateTimePickerComponent, { static: true })
	public dateTimePickerComponent!: StarkDateTimePickerComponent;

	public formControl = new UntypedFormControl();
	public pickerId = "";
	public pickerName = "";
	public placeholder = "";
	public isDisabled = false;
	public required = false;
	public dateMask?: StarkDatePickerMaskConfig;
	public timeMask: StarkTimestampMaskConfig = DEFAULT_TIME_MASK_CONFIG;
	public dateFilter?: StarkDatePickerFilter;
	public minDate: Date | null = null;
	public maxDate: Date | null = null;
}

describe("DateTimePickerComponent", () => {
	let component: StarkDateTimePickerComponent;
	const timeInputSelector = ".time-input";

	beforeEach(waitForAsync(() =>
		TestBed.configureTestingModule({
			imports: [
				NoopAnimationsModule,
				MatIconTestingModule,
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

		beforeEach(() => {
			renderHost();
		});

		function renderHost(initializer?: (host: TestHostFormControlComponent) => void): void {
			hostFixture = TestBed.createComponent(TestHostFormControlComponent);
			hostComponent = hostFixture.componentInstance;
			initializer?.(hostComponent);
			hostFixture.detectChanges(); // trigger initial data binding

			component = hostComponent.dateTimePickerComponent;
		}

		it("if date is initially invalid, the date time picker should not be displayed as invalid until the user interacts with the date or time picker", () => {
			// re-create component with a form control with "required" validator
			renderHost((host) => {
				host.formControl = new UntypedFormControl(undefined, Validators.required); // initially invalid
			});

			let formFieldDebugElement = hostFixture.debugElement.query(By.directive(MatFormField));
			expect(formFieldDebugElement.classes[formFieldInvalidClass]).toBeUndefined();

			const datePickerInputDebugElement = hostFixture.debugElement.query(By.css("stark-date-picker > input"));
			expect(datePickerInputDebugElement).toBeTruthy();
			// more verbose way to create and trigger an event (the only way it works in IE)
			// https://developer.mozilla.org/en-US/docs/Web/Guide/Events/Creating_and_triggering_events
			let blurEvent = document.createEvent("Event");
			blurEvent.initEvent("blur", true, true);
			datePickerInputDebugElement.nativeElement.dispatchEvent(blurEvent); // simulate that the user has touched the input
			hostFixture.detectChanges();

			expect(formFieldDebugElement.classes[formFieldInvalidClass]).toBe(true);

			// re-create component with a form control with "required" validator
			renderHost((host) => {
				host.formControl = new UntypedFormControl(undefined, Validators.required); // initially invalid
			});

			formFieldDebugElement = hostFixture.debugElement.query(By.directive(MatFormField));
			expect(formFieldDebugElement.classes[formFieldInvalidClass]).toBeUndefined();

			const timeInputDebugElement = hostFixture.debugElement.query(By.css(".time-picker > input"));
			expect(timeInputDebugElement).toBeTruthy();
			// more verbose way to create and trigger an event (the only way it works in IE)
			// https://developer.mozilla.org/en-US/docs/Web/Guide/Events/Creating_and_triggering_events
			blurEvent = document.createEvent("Event");
			blurEvent.initEvent("blur", true, true);
			timeInputDebugElement.nativeElement.dispatchEvent(blurEvent); // simulate that the user has touched the input
			hostFixture.detectChanges();

			expect(formFieldDebugElement.classes[formFieldInvalidClass]).toBe(true);
		});

		it("if date time is initially invalid, the date time picker should not be displayed as invalid until the form control is marked as 'touched'", () => {
			// re-create component with a form control with "required" validator
			renderHost((host) => {
				host.formControl = new UntypedFormControl(undefined, Validators.required); // initially invalid
			});

			const formFieldDebugElement = hostFixture.debugElement.query(By.directive(MatFormField));
			expect(formFieldDebugElement.classes[formFieldInvalidClass]).toBeUndefined();

			hostComponent.formControl.markAsTouched();
			hostFixture.detectChanges();

			expect(formFieldDebugElement.classes[formFieldInvalidClass]).toBe(true);
		});

		it("if date time is initially invalid, the date time picker should not be displayed as invalid until the form control is marked as 'dirty'", () => {
			// re-create component with a form control with "required" validator
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

		beforeEach(() => {
			renderHost();
		});

		function renderHost(initializer?: (host: TestHostFormControlComponent) => void): void {
			hostFixture = TestBed.createComponent(TestHostFormControlComponent);
			hostComponent = hostFixture.componentInstance;
			initializer?.(hostComponent);
			hostFixture.detectChanges(); // trigger initial data binding

			component = hostComponent.dateTimePickerComponent;
		}

		describe("on initialization", () => {
			it("should set internal component properties", () => {
				expect(hostFixture).toBeDefined();
				expect(component).toBeDefined();
				expect(component.logger).toBeTruthy();
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
				expect(component.dateMask).toBeUndefined();
				expect(component.timeMask).toBe(DEFAULT_TIME_MASK_CONFIG);
				expect(component.dateTimeChange).toBeDefined();
			});

			it("should NOT have any validation errors if the model value is empty", () => {
				expect(hostComponent.formControl.value).toBeNull();
				expect(hostComponent.formControl.errors).toBeNull();
				expect(component.dateTimeFormGroup.errors).toBeNull();
				expect(component.dateTimeFormGroup.controls["date"].errors).toBeNull();
				expect(component.dateTimeFormGroup.controls["time"].errors).toBeNull();
			});
		});

		describe("datepicker properties", () => {
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
					/// host.required = true;  // IMPORTANT: toggling the 'required' property triggers a 'valueChange' event fired by the Angular 'required' validator (see Validators.required)
				});

				expect(hostFixture.nativeElement.querySelector("mat-datepicker#test-id")).toBeTruthy();
				expect(hostFixture.nativeElement.querySelector("input#test-id-input")).toBeTruthy(); // the "-input" suffix is appended to the pickerId
				expect(hostFixture.nativeElement.querySelector("input[name='test-name']")).toBeTruthy();
				/// expect(hostFixture.nativeElement.querySelector("input#test-id-time-input[required]")).toBeTruthy(); // see comment above about Angular 'required' validator
				expect(component.datePicker.min).not.toBeNull();
				expect(component.datePicker.min?.toDate()).toEqual(minDate);
				expect(component.datePicker.max).not.toBeNull();
				expect(component.datePicker.max?.toDate()).toEqual(maxDate);

				expect(mockObserver.next).not.toHaveBeenCalled();
				expect(mockObserver.error).not.toHaveBeenCalled();
				expect(mockObserver.complete).not.toHaveBeenCalled();
			});

			it("the datepicker should be disabled when the form control is disabled AND it should trigger a 'valueChange' event ONLY IF the 'emitEvent' option is enabled", () => {
				hostComponent.formControl.valueChanges.subscribe(mockObserver.next, mockObserver.error, mockObserver.complete);

				hostComponent.formControl.disable({ emitEvent: false });
				hostFixture.detectChanges();

				expect(component.datePicker.disabled).toBe(true);

				hostComponent.formControl.enable({ emitEvent: false });
				hostFixture.detectChanges();

				expect(component.datePicker.disabled).toBe(false);
				expect(mockObserver.next).not.toHaveBeenCalled(); // because the 'emitEvent' is false
				expect(mockObserver.error).not.toHaveBeenCalled();
				expect(mockObserver.complete).not.toHaveBeenCalled();

				hostComponent.formControl.disable(); // 'emitEvent' true by default
				hostFixture.detectChanges();

				expect(component.datePicker.disabled).toBe(true);
				expect(mockObserver.next).toHaveBeenCalledTimes(1);
				mockObserver.next.mockClear();

				hostComponent.formControl.enable(); // 'emitEvent' true by default
				hostFixture.detectChanges();

				expect(component.datePicker.disabled).toBe(false);
				expect(mockObserver.next).toHaveBeenCalledTimes(1);
				expect(mockObserver.error).not.toHaveBeenCalled();
				expect(mockObserver.complete).not.toHaveBeenCalled();
			});

			it("the datepicker value should be the same as the date part of the form control's value", () => {
				const date = new Date(2018, 6, 3, 10, 15, 20);
				hostComponent.formControl.setValue(date);
				hostFixture.detectChanges();
				expect(component.datePicker.value).not.toBeNull();
				expect(component.datePicker.value).toEqual(new Date(date.getFullYear(), date.getMonth(), date.getDate()));
			});
		});

		describe("date mask", () => {
			it("the dateMask should be passed 'as is' to the internal datepicker", () => {
				renderHost((host) => {
					host.dateMask = true;
				});
				expect(component.dateMask).toBe(true);

				renderHost((host) => {
					host.dateMask = <any>"";
				});
				expect(component.dateMask).toBe(<any>"");

				renderHost((host) => {
					host.dateMask = false;
				});
				expect(component.dateMask).toBe(false);

				const dateMask: StarkDatePickerMaskConfig = { format: "DD-MM-YYYY" };
				renderHost((host) => {
					host.dateMask = dateMask;
				});
				expect(component.dateMask).toBe(dateMask);
			});
		});

		describe("date filter", () => {
			it("the dateFilter should be passed 'as is' to the internal datepicker", () => {
				expect(component.dateFilter).toBeUndefined();

				const filterFn: any = (date: Date): boolean => {
					const day: number = date.getDay();
					return day === 3;
				};

				renderHost((host) => {
					host.dateFilter = filterFn;
				});
				expect(component.dateFilter).toBe(filterFn);

				renderHost((host) => {
					host.dateFilter = "OnlyWeekdays";
				});
				expect(component.dateFilter).toBe("OnlyWeekdays");

				renderHost((host) => {
					host.dateFilter = "OnlyWeekends";
				});
				expect(component.dateFilter).toBe("OnlyWeekends");
			});
		});

		describe("time input properties", () => {
			let mockObserver: ObserverSpy;

			beforeEach(() => {
				mockObserver = createObserverSpy();
			});

			it("should be set correctly according to the specified inputs and WITHOUT triggering a 'valueChange' event", () => {
				renderHost((host) => {
					host.formControl.valueChanges.subscribe(mockObserver.next, mockObserver.error, mockObserver.complete);
					host.pickerId = "test-id";
					host.pickerName = "test-name";
					/// host.required = true;  // IMPORTANT: toggling the 'required' property triggers a 'valueChange' event fired by the Angular 'required' validator (see Validators.required)
				});

				expect(hostFixture.debugElement.query(By.css(timeInputSelector))).toBeTruthy();
				expect(hostFixture.nativeElement.querySelector("input#test-id-time-input")).toBeTruthy(); // the "-time-input" suffix is appended to the pickerId
				expect(hostFixture.nativeElement.querySelector("input[name='test-name-time-input']")).toBeTruthy();
				/// expect(hostFixture.nativeElement.querySelector("input#test-id-time-input[required]")).toBeTruthy(); // see comment above about Angular 'required' validator

				expect(mockObserver.next).not.toHaveBeenCalled();
				expect(mockObserver.error).not.toHaveBeenCalled();
				expect(mockObserver.complete).not.toHaveBeenCalled();
			});

			it("the time input should be disabled when the form control is disabled AND it should trigger a 'valueChange' event ONLY IF the 'emitEvent' option is enabled", () => {
				const timeInputDebugElement = hostFixture.debugElement.query(By.css(timeInputSelector));
				expect(timeInputDebugElement).toBeTruthy();
				hostComponent.formControl.valueChanges.subscribe(mockObserver.next, mockObserver.error, mockObserver.complete);

				hostComponent.formControl.disable({ emitEvent: false });
				hostFixture.detectChanges();

				expect(timeInputDebugElement.properties["disabled"]).toBe(true);
				expect(component.timeInput.nativeElement.disabled).toBe(true);
				//
				hostComponent.formControl.enable({ emitEvent: false });
				hostFixture.detectChanges();

				expect(timeInputDebugElement.properties["disabled"]).toBe(false);
				expect(component.timeInput.nativeElement.disabled).toBe(false);
				expect(mockObserver.next).not.toHaveBeenCalled(); // because the 'emitEvent' is false
				expect(mockObserver.error).not.toHaveBeenCalled();
				expect(mockObserver.complete).not.toHaveBeenCalled();

				hostComponent.formControl.disable(); // 'emitEvent' true by default
				hostFixture.detectChanges();

				expect(timeInputDebugElement.properties["disabled"]).toBe(true);
				expect(component.timeInput.nativeElement.disabled).toBe(true);
				expect(mockObserver.next).toHaveBeenCalledTimes(1);
				mockObserver.next.mockClear();
				//
				hostComponent.formControl.enable(); // 'emitEvent' true by default
				hostFixture.detectChanges();

				expect(timeInputDebugElement.properties["disabled"]).toBe(false);
				expect(component.timeInput.nativeElement.disabled).toBe(false);
				expect(mockObserver.next).toHaveBeenCalledTimes(1);
				expect(mockObserver.error).not.toHaveBeenCalled();
				expect(mockObserver.complete).not.toHaveBeenCalled();
			});

			it("the time input value should be the same as the time part of the form control's value", () => {
				const date = new Date(2018, 6, 3, 10, 15, 20);
				hostComponent.formControl.setValue(date);
				hostFixture.detectChanges();
				expect(component.timeInput.nativeElement.value).not.toBeNull();
				expect(component.timeInput.nativeElement.value).toEqual(`${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}`);
			});
		});

		describe("time mask", () => {
			it("the timeMask should be passed 'as is' to the internal time input only if it is a valid mask config or use the DEFAULT_TIME_MASK otherwise", () => {
				renderHost((host) => {
					host.timeMask = <any>true; // invalid mask
				});
				expect(component.timeMask).toBe(DEFAULT_TIME_MASK_CONFIG);

				renderHost((host) => {
					host.timeMask = <any>""; // invalid mask
				});
				expect(component.timeMask).toBe(DEFAULT_TIME_MASK_CONFIG);

				renderHost((host) => {
					host.timeMask = <any>false; // invalid mask
				});
				expect(component.timeMask).toBe(DEFAULT_TIME_MASK_CONFIG);

				const timeMask: StarkTimestampMaskConfig = { format: "HH:mm" };
				renderHost((host) => {
					host.timeMask = timeMask;
				});
				expect(component.timeMask).toBe(timeMask);
			});
		});

		describe("date time selection", () => {
			let mockObserver: ObserverSpy;

			beforeEach(() => {
				mockObserver = createObserverSpy();
			});

			it("the date time should be correctly set and emit the new value in the form control's 'valueChange' observable", () => {
				hostComponent.formControl.valueChanges.subscribe(mockObserver.next, mockObserver.error, mockObserver.complete);

				const date = new Date(2018, 6, 7);
				component.datePicker.picker.select(moment(date)); // select a date in the internal date picker
				hostFixture.detectChanges();

				expect(mockObserver.next).toHaveBeenCalledTimes(1);
				expect(mockObserver.next).toHaveBeenCalledWith(date);
				mockObserver.next.mockClear();

				const dateTime = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 15, 30, 45);
				// type the time in the time input
				component.timeInput.nativeElement.value = `${dateTime.getHours()}:${dateTime.getMinutes()}:${dateTime.getSeconds()}`;
				// more verbose way to create and trigger an event (the only way it works in IE)
				// https://developer.mozilla.org/en-US/docs/Web/Guide/Events/Creating_and_triggering_events
				const inputEvent: Event = document.createEvent("Event");
				inputEvent.initEvent("input", true, true);
				component.timeInput.nativeElement.dispatchEvent(inputEvent);
				const changeEvent = document.createEvent("Event");
				changeEvent.initEvent("change", true, true);
				component.timeInput.nativeElement.dispatchEvent(changeEvent);
				hostFixture.detectChanges();

				expect(mockObserver.next).toHaveBeenCalledTimes(1);
				expect(mockObserver.next).toHaveBeenCalledWith(dateTime);
				expect(mockObserver.error).not.toHaveBeenCalled();
				expect(mockObserver.complete).not.toHaveBeenCalled();
			});

			it("the date part should be set to the default date if it is not defined and emit the new value in the form control's 'valueChange' observable", () => {
				hostComponent.formControl.valueChanges.subscribe(mockObserver.next, mockObserver.error, mockObserver.complete);

				const time = [15, 15, 15]; // later converted to "XX:XX:XX" (the default format is HH:mm:ss)
				const expectedDateTime = new Date(
					component.defaultDate.getFullYear(), // default date
					component.defaultDate.getMonth(),
					component.defaultDate.getDate(),
					...time // + given time
				);
				// type the time in the time input
				component.timeInput.nativeElement.value = time.join(":"); // to have the time string in the format "XX:XX:XX"
				// more verbose way to create and trigger an event (the only way it works in IE)
				// https://developer.mozilla.org/en-US/docs/Web/Guide/Events/Creating_and_triggering_events
				const inputEvent: Event = document.createEvent("Event");
				inputEvent.initEvent("input", true, true);
				component.timeInput.nativeElement.dispatchEvent(inputEvent);
				const changeEvent = document.createEvent("Event");
				changeEvent.initEvent("change", true, true);
				component.timeInput.nativeElement.dispatchEvent(changeEvent);
				hostFixture.detectChanges();

				expect(mockObserver.next).toHaveBeenCalledTimes(1);
				expect(mockObserver.next).not.toHaveBeenCalledWith(component.defaultDate);
				expect(mockObserver.next).toHaveBeenCalledWith(expectedDateTime);
				expect(mockObserver.error).not.toHaveBeenCalled();
				expect(mockObserver.complete).not.toHaveBeenCalled();
			});

			it("the time part should be set to the default time if it is not defined and emit the new value in the form control's 'valueChange' observable", () => {
				hostComponent.formControl.valueChanges.subscribe(mockObserver.next, mockObserver.error, mockObserver.complete);

				const date = new Date(2018, 6, 7, 15, 15, 15, 155);
				const expectedDateTime = new Date(
					date.getFullYear(), // given date
					date.getMonth(),
					date.getDate(),
					component.defaultTime.getHours(), // + default time
					component.defaultTime.getMinutes(),
					component.defaultTime.getSeconds(),
					component.defaultTime.getMilliseconds()
				);
				component.datePicker.picker.select(moment(date)); // select a date in the internal date picker
				hostFixture.detectChanges();

				expect(mockObserver.next).toHaveBeenCalledTimes(1);
				expect(mockObserver.next).not.toHaveBeenCalledWith(date);
				expect(mockObserver.next).toHaveBeenCalledWith(expectedDateTime);
				expect(mockObserver.error).not.toHaveBeenCalled();
				expect(mockObserver.complete).not.toHaveBeenCalled();
			});
		});
	});

	describe("NOT using formControl", () => {
		let hostComponent: TestHostComponent;
		let hostFixture: ComponentFixture<TestHostComponent>;

		beforeEach(() => {
			renderHost();
		});

		function renderHost(initializer?: (host: TestHostComponent) => void): void {
			hostFixture = TestBed.createComponent(TestHostComponent);
			hostComponent = hostFixture.componentInstance;
			initializer?.(hostComponent);
			hostFixture.detectChanges(); // trigger initial data binding

			component = hostComponent.dateTimePickerComponent;
		}

		describe("on initialization", () => {
			it("should set internal component properties", () => {
				expect(hostFixture).toBeDefined();
				expect(component).toBeDefined();
				expect(component.logger).toBeTruthy();
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
				expect(component.dateMask).toBeUndefined();
				expect(component.timeMask).toBe(DEFAULT_TIME_MASK_CONFIG);
				expect(component.dateTimeChange).toBeDefined();
			});
		});

		describe("datepicker properties", () => {
			let mockObserver: ObserverSpy;

			beforeEach(() => {
				mockObserver = createObserverSpy();
			});

			it("should be set correctly according to the given inputs and WITHOUT emitting a 'dateTimeChange' event", () => {
				const minDate = new Date(2018, 6, 1);
				const maxDate = new Date(2018, 6, 2);
				renderHost((host) => {
					host.pickerId = "test-id";
					host.pickerName = "test-name";
					host.minDate = minDate;
					host.maxDate = maxDate;
					host.required = true;
				});
				component.dateTimeChange.subscribe(mockObserver.next, mockObserver.error, mockObserver.complete);

				expect(hostFixture.nativeElement.querySelector("mat-datepicker#test-id")).toBeTruthy();
				expect(hostFixture.nativeElement.querySelector("input#test-id-input")).toBeTruthy(); // the "-input" suffix is appended to the pickerId
				expect(hostFixture.nativeElement.querySelector("input[name='test-name']")).toBeTruthy();
				expect(hostFixture.nativeElement.querySelector("input#test-id-time-input[required]")).toBeTruthy();
				expect(component.datePicker.min).not.toBeNull();
				expect(component.datePicker.min?.toDate()).toEqual(minDate);
				expect(component.datePicker.max).not.toBeNull();
				expect(component.datePicker.max?.toDate()).toEqual(maxDate);

				expect(hostComponent.onValueChange).not.toHaveBeenCalled();
				expect(mockObserver.next).not.toHaveBeenCalled();
				expect(mockObserver.error).not.toHaveBeenCalled();
				expect(mockObserver.complete).not.toHaveBeenCalled();
			});

			it("the datepicker should respect the provided 'disabled' input state and it should NOT emit a 'dateTimeChange' event", () => {
				renderHost((host) => {
					host.isDisabled = true;
				});
				component.dateTimeChange.subscribe(mockObserver.next, mockObserver.error, mockObserver.complete);

				expect(component.datePicker.disabled).toBe(true);
				expect(hostComponent.onValueChange).not.toHaveBeenCalled();

				renderHost((host) => {
					host.isDisabled = false;
				});
				component.dateTimeChange.subscribe(mockObserver.next, mockObserver.error, mockObserver.complete);

				expect(component.datePicker.disabled).toBe(false);

				expect(hostComponent.onValueChange).not.toHaveBeenCalled();
				expect(mockObserver.next).not.toHaveBeenCalled();
				expect(mockObserver.error).not.toHaveBeenCalled();
				expect(mockObserver.complete).not.toHaveBeenCalled();
			});

			it("the datepicker value should be the same as the date part of the 'value' input and it should not emit a 'dateChange' event", () => {
				const date = new Date(2018, 6, 3, 10, 15, 20);
				renderHost((host) => {
					host.value = date;
				});
				component.dateTimeChange.subscribe(mockObserver.next, mockObserver.error, mockObserver.complete);

				expect(component.datePicker.value).not.toBeNull();
				expect(component.datePicker.value).toEqual(new Date(date.getFullYear(), date.getMonth(), date.getDate()));

				expect(hostComponent.onValueChange).not.toHaveBeenCalled();
				expect(mockObserver.next).not.toHaveBeenCalled();
				expect(mockObserver.error).not.toHaveBeenCalled();
				expect(mockObserver.complete).not.toHaveBeenCalled();
			});
		});

		describe("time input properties", () => {
			let mockObserver: ObserverSpy;

			beforeEach(() => {
				mockObserver = createObserverSpy();
			});

			it("should be set correctly according to the specified inputs and WITHOUT emitting a 'dateTimeChange' event", () => {
				renderHost((host) => {
					host.pickerId = "test-id";
					host.pickerName = "test-name";
				});
				component.dateTimeChange.subscribe(mockObserver.next, mockObserver.error, mockObserver.complete);

				expect(hostFixture.debugElement.query(By.css(timeInputSelector))).toBeTruthy();
				expect(hostFixture.nativeElement.querySelector("input#test-id-time-input")).toBeTruthy(); // the "-time-input" suffix is appended to the pickerId
				expect(hostFixture.nativeElement.querySelector("input[name='test-name-time-input']")).toBeTruthy();

				expect(hostComponent.onValueChange).not.toHaveBeenCalled();
				expect(mockObserver.next).not.toHaveBeenCalled();
				expect(mockObserver.error).not.toHaveBeenCalled();
				expect(mockObserver.complete).not.toHaveBeenCalled();
			});

			it("the time input should respect the provided 'disabled' input state and it should NOT emit a 'dateTimeChange' event", () => {
				renderHost((host) => {
					host.isDisabled = true;
				});
				component.dateTimeChange.subscribe(mockObserver.next, mockObserver.error, mockObserver.complete);

				const timeInputDebugElement = hostFixture.debugElement.query(By.css(timeInputSelector));
				expect(timeInputDebugElement).toBeTruthy();

				expect(timeInputDebugElement.properties["disabled"]).toBe(true);
				expect(component.timeInput.nativeElement.disabled).toBe(true);
				expect(hostComponent.onValueChange).not.toHaveBeenCalled();

				renderHost((host) => {
					host.isDisabled = false;
				});
				component.dateTimeChange.subscribe(mockObserver.next, mockObserver.error, mockObserver.complete);

				expect(hostFixture.debugElement.query(By.css(timeInputSelector)).properties["disabled"]).toBe(false);
				expect(component.timeInput.nativeElement.disabled).toBe(false);

				expect(hostComponent.onValueChange).not.toHaveBeenCalled();
				expect(mockObserver.next).not.toHaveBeenCalled();
				expect(mockObserver.error).not.toHaveBeenCalled();
				expect(mockObserver.complete).not.toHaveBeenCalled();
			});

			it("the time input value should be the same as the time part of 'value' and it should not emit a 'dateChange' event", () => {
				const date = new Date(2018, 6, 3, 10, 15, 20);
				renderHost((host) => {
					host.value = date;
				});
				component.dateTimeChange.subscribe(mockObserver.next, mockObserver.error, mockObserver.complete);

				expect(component.timeInput.nativeElement.value).not.toBeNull();
				expect(component.timeInput.nativeElement.value).toEqual(`${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}`);

				expect(hostComponent.onValueChange).not.toHaveBeenCalled();
				expect(mockObserver.next).not.toHaveBeenCalled();
				expect(mockObserver.error).not.toHaveBeenCalled();
				expect(mockObserver.complete).not.toHaveBeenCalled();
			});
		});

		describe("date changes", () => {
			let mockObserver: ObserverSpy;

			beforeEach(() => {
				mockObserver = createObserverSpy();
			});

			it("should emit the new value in the 'dateChange' output", () => {
				component.dateTimeChange.subscribe(mockObserver.next, mockObserver.error, mockObserver.complete);

				const date = new Date(2018, 6, 3);
				component.datePicker.picker.select(moment(date)); // select a date in the internal date picker
				hostFixture.detectChanges();

				expect(hostComponent.onValueChange).toHaveBeenCalledTimes(1);
				expect(hostComponent.onValueChange).toHaveBeenCalledWith(date);
				expect(mockObserver.next).toHaveBeenCalledTimes(1);
				expect(mockObserver.next).toHaveBeenCalledWith(date);
				hostComponent.onValueChange.mockClear();
				mockObserver.next.mockClear();

				const dateTime = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 15, 30, 45);
				component.timeInput.nativeElement.value = `${dateTime.getHours()}:${dateTime.getMinutes()}:${dateTime.getSeconds()}`;
				// more verbose way to create and trigger an event (the only way it works in IE)
				// https://developer.mozilla.org/en-US/docs/Web/Guide/Events/Creating_and_triggering_events
				const inputEvent: Event = document.createEvent("Event");
				inputEvent.initEvent("input", true, true);
				component.timeInput.nativeElement.dispatchEvent(inputEvent);
				const changeEvent = document.createEvent("Event");
				changeEvent.initEvent("change", true, true);
				component.timeInput.nativeElement.dispatchEvent(changeEvent);
				hostFixture.detectChanges();

				expect(hostComponent.onValueChange).toHaveBeenCalledTimes(1);
				expect(hostComponent.onValueChange).toHaveBeenCalledWith(dateTime);
				expect(mockObserver.next).toHaveBeenCalledTimes(1);
				expect(mockObserver.next).toHaveBeenCalledWith(dateTime);
				expect(mockObserver.error).not.toHaveBeenCalled();
				expect(mockObserver.complete).not.toHaveBeenCalled();
			});
		});
	});
});
