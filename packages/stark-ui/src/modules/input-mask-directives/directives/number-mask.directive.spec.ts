import { Component, DebugElement, SimpleChange } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { UntypedFormControl, FormsModule, ReactiveFormsModule } from "@angular/forms";
import { By } from "@angular/platform-browser";
import { vi } from "vitest";
import { StarkInputMaskDirectivesModule } from "../input-mask-directives.module";
import { StarkNumberMaskConfig } from "./number-mask-config.intf";
import { StarkNumberMaskDirective } from "./number-mask.directive";

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

describe("NumberMaskDirective", () => {
	const numberMaskConfig: StarkNumberMaskConfig = {
		prefix: "",
		suffix: ""
	};

	function changeInputValue(inputDebugElement: DebugElement, value: string, eventType: string = "input"): void {
		(<HTMLInputElement>inputDebugElement.nativeElement).value = value;

		const ev: Event = document.createEvent("Event");
		ev.initEvent(eventType, true, true);
		(<HTMLInputElement>inputDebugElement.nativeElement).dispatchEvent(ev);
	}

	@Component({
		standalone: true,
		selector: "stark-number-mask-uncontrolled-host",
		imports: [StarkInputMaskDirectivesModule],
		template: "<input type='text' [starkNumberMask]='numberMaskConfig'>"
	})
	class UncontrolledHostComponent {
		public numberMaskConfig: StarkNumberMaskConfig = numberMaskConfig;
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

		const getDirective = (): StarkNumberMaskDirective => inputElement.injector.get(StarkNumberMaskDirective);

		const updateMaskConfig = (maskConfig: StarkNumberMaskConfig | undefined): void => {
			const directive = getDirective();
			const previousMaskConfig = directive.maskConfig;

			hostComponent.numberMaskConfig = maskConfig as StarkNumberMaskConfig;
			directive.maskConfig = maskConfig as StarkNumberMaskConfig;
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

				changeInputValue(inputElement, "12345", eventType);
				fixture.detectChanges();

				expect(inputElement.nativeElement.value).toBe("12,345");
			}

			const invalidEvents: string[] = ["blur", "keyup", "change", "focus", "keydown", "keypress", "click"];

			for (const eventType of invalidEvents) {
				changeInputValue(inputElement, "");
				fixture.detectChanges();
				expect(inputElement.nativeElement.value).toBe("");

				changeInputValue(inputElement, "12345", eventType);
				fixture.detectChanges();

				expect(inputElement.nativeElement.value).toBe("12345");
			}
		});

		it("should prevent invalid values to be entered in the input field when the value is changed manually", () => {
			const invalidValues: string[] = ["a", " ", "/*-+,."];

			for (const value of invalidValues) {
				changeInputValue(inputElement, value);
				fixture.detectChanges();

				expect(inputElement.nativeElement.value).toBe("");
			}

			const invalidNumericValues: string[] = ["1-2-3.4.5", "+1*23-4/5", ".1.234,5"];

			for (const numericValue of invalidNumericValues) {
				changeInputValue(inputElement, numericValue);
				fixture.detectChanges();

				expect(inputElement.nativeElement.value).toBe("12,345");
			}
		});

		it("should refresh the mask whenever the configuration changes", () => {
			changeInputValue(inputElement, "12345");
			fixture.detectChanges();

			expect(inputElement.nativeElement.value).toBe("12,345");

			updateMaskConfig({ ...numberMaskConfig, prefix: "%", suffix: " percent", thousandsSeparatorSymbol: "-" });

			expect(inputElement.nativeElement.value).toBe("%12-345 percent");
		});

		it("should remove the mask when the config is undefined", () => {
			changeInputValue(inputElement, "12345");
			fixture.detectChanges();

			expect(inputElement.nativeElement.value).toBe("12,345");

			updateMaskConfig(undefined);

			changeInputValue(inputElement, "whatever+1*23-4/5");
			fixture.detectChanges();

			expect(inputElement.nativeElement.value).toBe("whatever+1*23-4/5");
		});
	});

	@Component({
		standalone: true,
		selector: "stark-number-mask-ng-model-host",
		imports: [FormsModule, StarkInputMaskDirectivesModule],
		template: "<input type='text' [(ngModel)]='ngModelValue' [starkNumberMask]='numberMaskConfig'>"
	})
	class NgModelHostComponent {
		public numberMaskConfig: StarkNumberMaskConfig = numberMaskConfig;
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

		const getDirective = (): StarkNumberMaskDirective => inputElement.injector.get(StarkNumberMaskDirective);

		const updateMaskConfig = (maskConfig: StarkNumberMaskConfig | undefined): void => {
			const directive = getDirective();
			const previousMaskConfig = directive.maskConfig;

			hostComponent.numberMaskConfig = maskConfig as StarkNumberMaskConfig;
			directive.maskConfig = maskConfig as StarkNumberMaskConfig;
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

				changeInputValue(inputElement, "12345", eventType);
				fixture.detectChanges();

				expect(hostComponent.ngModelValue).toBe("12,345");
			}

			const invalidEvents: string[] = ["blur", "keyup", "change", "focus", "keydown", "keypress", "click"];

			for (const eventType of invalidEvents) {
				changeInputValue(inputElement, "");
				fixture.detectChanges();
				expect(hostComponent.ngModelValue).toBe("");

				changeInputValue(inputElement, "12345", eventType);
				fixture.detectChanges();

				expect(hostComponent.ngModelValue).toBe("");
			}
		});

		it("should prevent invalid values to be entered in the input field when the value is changed manually", () => {
			const invalidValues: string[] = ["a", " ", "/*-+,."];

			for (const value of invalidValues) {
				changeInputValue(inputElement, value);
				fixture.detectChanges();

				expect(hostComponent.ngModelValue).toBe("");
			}

			const invalidNumericValues: string[] = ["1-2-3.4.5", "+1*23-4/5", ".1.234,5"];

			for (const numericValue of invalidNumericValues) {
				changeInputValue(inputElement, numericValue);
				fixture.detectChanges();

				expect(hostComponent.ngModelValue).toBe("12,345");
			}
		});

		it("should refresh the mask whenever the configuration changes", () => {
			changeInputValue(inputElement, "12345");
			fixture.detectChanges();

			expect(hostComponent.ngModelValue).toBe("12,345");

			hostComponent.numberMaskConfig = { ...numberMaskConfig, prefix: "%", suffix: " percent", thousandsSeparatorSymbol: "-" };
			fixture.detectChanges();

			expect(hostComponent.ngModelValue).toBe("%12-345 percent");
		});

		it("should remove the mask when the config is undefined", () => {
			changeInputValue(inputElement, "12345");
			fixture.detectChanges();

			expect(hostComponent.ngModelValue).toBe("12,345");

			updateMaskConfig(undefined);

			changeInputValue(inputElement, "whatever+1*23-4/5");
			fixture.detectChanges();

			expect(hostComponent.ngModelValue).toBe("whatever+1*23-4/5");
		});
	});

	@Component({
		standalone: true,
		selector: "stark-number-mask-form-control-host",
		imports: [ReactiveFormsModule, StarkInputMaskDirectivesModule],
		template: "<input type='text' [formControl]='formControl' [starkNumberMask]='numberMaskConfig'>"
	})
	class FormControlHostComponent {
		public numberMaskConfig: StarkNumberMaskConfig = numberMaskConfig;
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

		const getDirective = (): StarkNumberMaskDirective => inputElement.injector.get(StarkNumberMaskDirective);

		const updateMaskConfig = (maskConfig: StarkNumberMaskConfig | undefined): void => {
			const directive = getDirective();
			const previousMaskConfig = directive.maskConfig;

			hostComponent.numberMaskConfig = maskConfig as StarkNumberMaskConfig;
			directive.maskConfig = maskConfig as StarkNumberMaskConfig;
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
				changeInputValue(inputElement, "12345", eventType);
				fixture.detectChanges();

				expect(hostComponent.formControl.value).toBe("12,345");
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
				changeInputValue(inputElement, "12345", eventType);
				fixture.detectChanges();

				expect(hostComponent.formControl.value).toBe("");
				expect(mockValueChangeObserver.next).not.toHaveBeenCalled();
				expect(mockValueChangeObserver.error).not.toHaveBeenCalled();
				expect(mockValueChangeObserver.complete).not.toHaveBeenCalled();
			}
		});

		it("should prevent invalid values to be entered in the input field when the value is changed manually", () => {
			const invalidValues: string[] = ["a", " ", "/*-+,."];

			for (const value of invalidValues) {
				mockValueChangeObserver.next.mockClear();
				changeInputValue(inputElement, value);
				fixture.detectChanges();

				expect(hostComponent.formControl.value).toBe("");
				expect(mockValueChangeObserver.next).toHaveBeenCalledTimes(1);
				expect(mockValueChangeObserver.error).not.toHaveBeenCalled();
				expect(mockValueChangeObserver.complete).not.toHaveBeenCalled();
			}

			const invalidNumericValues: string[] = ["1-2-3.4.5", "+1*23-4/5", ".1.234,5"];

			for (const numericValue of invalidNumericValues) {
				mockValueChangeObserver.next.mockClear();
				changeInputValue(inputElement, numericValue);
				fixture.detectChanges();

				expect(hostComponent.formControl.value).toBe("12,345");
				expect(mockValueChangeObserver.next).toHaveBeenCalledTimes(1);
				expect(mockValueChangeObserver.error).not.toHaveBeenCalled();
				expect(mockValueChangeObserver.complete).not.toHaveBeenCalled();
			}
		});

		it("should refresh the mask whenever the configuration changes", () => {
			changeInputValue(inputElement, "12345");
			fixture.detectChanges();

			expect(hostComponent.formControl.value).toBe("12,345");
			expect(mockValueChangeObserver.next).toHaveBeenCalledTimes(1);

			mockValueChangeObserver.next.mockClear();
			updateMaskConfig({ ...numberMaskConfig, prefix: "%", suffix: " percent", thousandsSeparatorSymbol: "-" });

			expect(hostComponent.formControl.value).toBe("%12-345 percent");
			expect(mockValueChangeObserver.next).toHaveBeenCalledTimes(1);
			expect(mockValueChangeObserver.error).not.toHaveBeenCalled();
			expect(mockValueChangeObserver.complete).not.toHaveBeenCalled();
		});

		it("should remove the mask when the config is undefined", () => {
			changeInputValue(inputElement, "12345");
			fixture.detectChanges();

			expect(hostComponent.formControl.value).toBe("12,345");
			expect(mockValueChangeObserver.next).toHaveBeenCalledTimes(1);

			mockValueChangeObserver.next.mockClear();
			updateMaskConfig(undefined);
			expect(mockValueChangeObserver.next).not.toHaveBeenCalled();

			mockValueChangeObserver.next.mockClear();
			changeInputValue(inputElement, "whatever+1*23-4/5");
			fixture.detectChanges();

			expect(hostComponent.formControl.value).toBe("whatever+1*23-4/5");
			expect(mockValueChangeObserver.next).toHaveBeenCalledTimes(1);
			expect(mockValueChangeObserver.error).not.toHaveBeenCalled();
			expect(mockValueChangeObserver.complete).not.toHaveBeenCalled();
		});
	});
});
