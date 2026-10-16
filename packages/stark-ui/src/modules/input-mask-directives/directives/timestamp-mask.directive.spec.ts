import { Component, DebugElement, SimpleChange } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { UntypedFormControl, FormsModule, ReactiveFormsModule } from "@angular/forms";
import { By } from "@angular/platform-browser";
import { vi } from "vitest";
import { StarkInputMaskDirectivesModule } from "../input-mask-directives.module";
import { StarkTimestampMaskConfig } from "./timestamp-mask-config.intf";
import { StarkTimestampMaskDirective } from "./timestamp-mask.directive";

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

describe("TimestampMaskDirective", () => {
	const timestampMaskConfig: StarkTimestampMaskConfig = {
		format: "DD/MM/YYYY"
	};

	function changeInputValue(inputDebugElement: DebugElement, value: string, eventType: string = "input"): void {
		(<HTMLInputElement>inputDebugElement.nativeElement).value = value;

		const ev: Event = document.createEvent("Event");
		ev.initEvent(eventType, true, true);
		(<HTMLInputElement>inputDebugElement.nativeElement).dispatchEvent(ev);
	}

	@Component({
		standalone: true,
		selector: "stark-timestamp-mask-uncontrolled-host",
		imports: [StarkInputMaskDirectivesModule],
		template: "<input type='text' [starkTimestampMask]='timestampMaskConfig'>"
	})
	class UncontrolledHostComponent {
		public timestampMaskConfig: StarkTimestampMaskConfig | undefined = timestampMaskConfig;
	}

	describe("uncontrolled", () => {
		let fixture: ComponentFixture<UncontrolledHostComponent>;
		let hostComponent: UncontrolledHostComponent;
		let inputElement: DebugElement;

		const renderHost = (): void => {
			fixture = TestBed.createComponent(UncontrolledHostComponent);
			hostComponent = fixture.componentInstance;
			inputElement = fixture.debugElement.query(By.css("input"));
			fixture.detectChanges();
		};

		const getDirective = (): StarkTimestampMaskDirective => inputElement.injector.get(StarkTimestampMaskDirective);

		const updateMaskConfig = (maskConfig: StarkTimestampMaskConfig | undefined): void => {
			const directive = getDirective();
			const previousMaskConfig = directive.maskConfig;

			hostComponent.timestampMaskConfig = maskConfig;
			directive.maskConfig = maskConfig;
			directive.ngOnChanges({
				maskConfig: new SimpleChange(previousMaskConfig, maskConfig, false)
			});
		};

		beforeEach(() => {
			TestBed.configureTestingModule({
				imports: [UncontrolledHostComponent]
			});

			renderHost();
		});

		it("should render the appropriate content", () => {
			expect(getDirective()).toBeDefined();
		});

		it("should update the input value and show the mask only when a valid event is triggered in the input field", () => {
			const validEvents: string[] = ["input"];

			for (const eventType of validEvents) {
				changeInputValue(inputElement, "");
				fixture.detectChanges();
				expect(inputElement.nativeElement.value).toBe("");

				changeInputValue(inputElement, "123", eventType);
				fixture.detectChanges();

				expect(inputElement.nativeElement.value).toBe("12/3_/____");
			}

			const invalidEvents: string[] = ["blur", "keyup", "change", "focus", "keydown", "keypress", "click"];

			for (const eventType of invalidEvents) {
				changeInputValue(inputElement, "");
				fixture.detectChanges();
				expect(inputElement.nativeElement.value).toBe("");

				changeInputValue(inputElement, "123", eventType);
				fixture.detectChanges();

				expect(inputElement.nativeElement.value).toBe("123");
			}
		});

		it("should prevent invalid values to be entered in the input field when the value is changed manually", () => {
			const invalidValues: string[] = ["a", " ", "whatever"];

			for (const value of invalidValues) {
				changeInputValue(inputElement, value);
				fixture.detectChanges();

				expect(inputElement.nativeElement.value).toBe("");
			}
		});

		it("should refresh the mask whenever the configuration changes", () => {
			changeInputValue(inputElement, "123");
			fixture.detectChanges();

			expect(inputElement.nativeElement.value).toBe("12/3_/____");

			updateMaskConfig({ ...timestampMaskConfig, format: "DD-MM" });

			expect(inputElement.nativeElement.value).toBe("12-3_");
		});

		it("should remove the mask when the config is undefined", () => {
			changeInputValue(inputElement, "123");
			fixture.detectChanges();

			expect(inputElement.nativeElement.value).toBe("12/3_/____");

			updateMaskConfig(undefined);

			changeInputValue(inputElement, "whatever");
			fixture.detectChanges();

			expect(inputElement.nativeElement.value).toBe("whatever");
		});

		it("should allow to enter February 29 manually in the input field when a year is foreseen but is not yet entered", () => {
			changeInputValue(inputElement, "2902");
			fixture.detectChanges();

			expect(inputElement.nativeElement.value).toBe("29/02/____");

			changeInputValue(inputElement, "");
			fixture.detectChanges();

			updateMaskConfig({ ...timestampMaskConfig, format: "MM-DD-YY" });

			changeInputValue(inputElement, "0229");
			fixture.detectChanges();

			expect(inputElement.nativeElement.value).toBe("02-29-__");
		});
	});

	@Component({
		standalone: true,
		selector: "stark-timestamp-mask-ng-model-host",
		imports: [FormsModule, StarkInputMaskDirectivesModule],
		template: "<input type='text' [(ngModel)]='ngModelValue' [starkTimestampMask]='timestampMaskConfig'>"
	})
	class NgModelHostComponent {
		public timestampMaskConfig: StarkTimestampMaskConfig | undefined = timestampMaskConfig;
		public ngModelValue = "";
	}

	describe("with ngModel", () => {
		let fixture: ComponentFixture<NgModelHostComponent>;
		let hostComponent: NgModelHostComponent;
		let inputElement: DebugElement;

		const renderHost = (): void => {
			fixture = TestBed.createComponent(NgModelHostComponent);
			hostComponent = fixture.componentInstance;
			inputElement = fixture.debugElement.query(By.css("input"));
			fixture.detectChanges();
		};

		const getDirective = (): StarkTimestampMaskDirective => inputElement.injector.get(StarkTimestampMaskDirective);

		const updateMaskConfig = (maskConfig: StarkTimestampMaskConfig | undefined): void => {
			const directive = getDirective();
			const previousMaskConfig = directive.maskConfig;

			hostComponent.timestampMaskConfig = maskConfig;
			directive.maskConfig = maskConfig;
			directive.ngOnChanges({
				maskConfig: new SimpleChange(previousMaskConfig, maskConfig, false)
			});
		};

		beforeEach(() => {
			TestBed.configureTestingModule({
				imports: [NgModelHostComponent]
			});

			renderHost();
		});

		it("should render the appropriate content", () => {
			expect(getDirective()).toBeDefined();
		});

		it("should update the input value and show the mask only when a valid event is triggered in the input field", () => {
			const validEvents: string[] = ["input"];

			for (const eventType of validEvents) {
				changeInputValue(inputElement, "");
				fixture.detectChanges();
				expect(hostComponent.ngModelValue).toBe("");

				changeInputValue(inputElement, "123", eventType);
				fixture.detectChanges();

				expect(hostComponent.ngModelValue).toBe("12/3_/____");
			}

			const invalidEvents: string[] = ["blur", "keyup", "change", "focus", "keydown", "keypress", "click"];

			for (const eventType of invalidEvents) {
				changeInputValue(inputElement, "");
				fixture.detectChanges();
				expect(hostComponent.ngModelValue).toBe("");

				changeInputValue(inputElement, "123", eventType);
				fixture.detectChanges();

				expect(hostComponent.ngModelValue).toBe("");
			}
		});

		it("should prevent invalid values to be entered in the input field when the value is changed manually", () => {
			const invalidValues: string[] = ["a", " ", "whatever"];

			for (const value of invalidValues) {
				changeInputValue(inputElement, value);
				fixture.detectChanges();

				expect(hostComponent.ngModelValue).toBe("");
			}
		});

		it("should refresh the mask whenever the configuration changes", () => {
			changeInputValue(inputElement, "123");
			fixture.detectChanges();

			expect(hostComponent.ngModelValue).toBe("12/3_/____");

			updateMaskConfig({ ...timestampMaskConfig, format: "DD-MM" });

			expect(hostComponent.ngModelValue).toBe("12-3_");
		});

		it("should remove the mask when the config is undefined", () => {
			changeInputValue(inputElement, "123");
			fixture.detectChanges();

			expect(hostComponent.ngModelValue).toBe("12/3_/____");

			updateMaskConfig(undefined);

			changeInputValue(inputElement, "whatever");
			fixture.detectChanges();

			expect(hostComponent.ngModelValue).toBe("whatever");
		});

		it("should allow to enter February 29 manually in the input field when a year is foreseen but is not yet entered", () => {
			changeInputValue(inputElement, "2902");
			fixture.detectChanges();

			expect(hostComponent.ngModelValue).toBe("29/02/____");

			changeInputValue(inputElement, "");
			fixture.detectChanges();

			updateMaskConfig({ ...timestampMaskConfig, format: "MM-DD-YY" });

			changeInputValue(inputElement, "0229");
			fixture.detectChanges();

			expect(hostComponent.ngModelValue).toBe("02-29-__");
		});
	});

	@Component({
		standalone: true,
		selector: "stark-timestamp-mask-form-control-host",
		imports: [ReactiveFormsModule, StarkInputMaskDirectivesModule],
		template: "<input type='text' [formControl]='formControl' [starkTimestampMask]='timestampMaskConfig'>"
	})
	class FormControlHostComponent {
		public timestampMaskConfig: StarkTimestampMaskConfig | undefined = timestampMaskConfig;
		public formControl = new UntypedFormControl("");
	}

	describe("with FormControl", () => {
		let fixture: ComponentFixture<FormControlHostComponent>;
		let hostComponent: FormControlHostComponent;
		let inputElement: DebugElement;
		let mockValueChangeObserver: ObserverSpy;

		const renderHost = (): void => {
			fixture = TestBed.createComponent(FormControlHostComponent);
			hostComponent = fixture.componentInstance;
			inputElement = fixture.debugElement.query(By.css("input"));
			fixture.detectChanges();

			mockValueChangeObserver = createObserverSpy();
			hostComponent.formControl.valueChanges.subscribe({
				next: mockValueChangeObserver.next,
				error: mockValueChangeObserver.error,
				complete: mockValueChangeObserver.complete
			});
		};

		const getDirective = (): StarkTimestampMaskDirective => inputElement.injector.get(StarkTimestampMaskDirective);

		const updateMaskConfig = (maskConfig: StarkTimestampMaskConfig | undefined): void => {
			const directive = getDirective();
			const previousMaskConfig = directive.maskConfig;

			hostComponent.timestampMaskConfig = maskConfig;
			directive.maskConfig = maskConfig;
			directive.ngOnChanges({
				maskConfig: new SimpleChange(previousMaskConfig, maskConfig, false)
			});
		};

		beforeEach(() => {
			TestBed.configureTestingModule({
				imports: [FormControlHostComponent]
			});

			renderHost();
		});

		it("should render the appropriate content", () => {
			expect(getDirective()).toBeDefined();
		});

		it("should update the input value and show the mask only when a valid event is triggered in the input field", () => {
			const validEvents: string[] = ["input"];

			for (const eventType of validEvents) {
				changeInputValue(inputElement, "");
				fixture.detectChanges();
				expect(hostComponent.formControl.value).toBe("");
				expect(mockValueChangeObserver.next).toHaveBeenCalledTimes(1);

				mockValueChangeObserver.next.mockClear();
				changeInputValue(inputElement, "123", eventType);
				fixture.detectChanges();

				expect(hostComponent.formControl.value).toBe("12/3_/____");
				expect(mockValueChangeObserver.next).toHaveBeenCalledTimes(1);
				expect(mockValueChangeObserver.error).not.toHaveBeenCalled();
				expect(mockValueChangeObserver.complete).not.toHaveBeenCalled();
			}

			mockValueChangeObserver.next.mockClear();
			const invalidEvents: string[] = ["blur", "keyup", "change", "focus", "keydown", "keypress", "click"];

			for (const eventType of invalidEvents) {
				changeInputValue(inputElement, "");
				fixture.detectChanges();
				expect(hostComponent.formControl.value).toBe("");
				expect(mockValueChangeObserver.next).toHaveBeenCalledTimes(1);

				mockValueChangeObserver.next.mockClear();
				changeInputValue(inputElement, "123", eventType);
				fixture.detectChanges();

				expect(hostComponent.formControl.value).toBe("");
				expect(mockValueChangeObserver.next).not.toHaveBeenCalled();
				expect(mockValueChangeObserver.error).not.toHaveBeenCalled();
				expect(mockValueChangeObserver.complete).not.toHaveBeenCalled();
			}
		});

		it("should prevent invalid values to be entered in the input field when the value is changed manually", () => {
			const invalidValues: string[] = ["a", " ", "whatever"];

			for (const value of invalidValues) {
				mockValueChangeObserver.next.mockClear();
				changeInputValue(inputElement, value);
				fixture.detectChanges();

				expect(hostComponent.formControl.value).toBe("");
				expect(mockValueChangeObserver.next).toHaveBeenCalledTimes(1);
				expect(mockValueChangeObserver.error).not.toHaveBeenCalled();
				expect(mockValueChangeObserver.complete).not.toHaveBeenCalled();
			}
		});

		it("should refresh the mask whenever the configuration changes", () => {
			changeInputValue(inputElement, "123");
			fixture.detectChanges();

			expect(hostComponent.formControl.value).toBe("12/3_/____");
			expect(mockValueChangeObserver.next).toHaveBeenCalledTimes(1);

			mockValueChangeObserver.next.mockClear();
			updateMaskConfig({ ...timestampMaskConfig, format: "DD-MM" });

			expect(hostComponent.formControl.value).toBe("12-3_");
			expect(mockValueChangeObserver.next).toHaveBeenCalledTimes(1);
			expect(mockValueChangeObserver.error).not.toHaveBeenCalled();
			expect(mockValueChangeObserver.complete).not.toHaveBeenCalled();
		});

		it("should remove the mask when the config is undefined", () => {
			changeInputValue(inputElement, "123");
			fixture.detectChanges();

			expect(hostComponent.formControl.value).toBe("12/3_/____");
			expect(mockValueChangeObserver.next).toHaveBeenCalledTimes(1);

			mockValueChangeObserver.next.mockClear();
			updateMaskConfig(undefined);
			expect(mockValueChangeObserver.next).not.toHaveBeenCalled();

			mockValueChangeObserver.next.mockClear();
			changeInputValue(inputElement, "whatever");
			fixture.detectChanges();

			expect(hostComponent.formControl.value).toBe("whatever");
			expect(mockValueChangeObserver.next).toHaveBeenCalledTimes(1);
			expect(mockValueChangeObserver.error).not.toHaveBeenCalled();
			expect(mockValueChangeObserver.complete).not.toHaveBeenCalled();
		});

		it("should allow to enter February 29 manually in the input field when a year is foreseen but is not yet entered", () => {
			changeInputValue(inputElement, "2902");
			fixture.detectChanges();

			expect(hostComponent.formControl.value).toBe("29/02/____");

			changeInputValue(inputElement, "");
			fixture.detectChanges();

			updateMaskConfig({ ...timestampMaskConfig, format: "MM-DD-YY" });

			changeInputValue(inputElement, "0229");
			fixture.detectChanges();

			expect(hostComponent.formControl.value).toBe("02-29-__");
		});
	});
});
