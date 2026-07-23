import { BooleanInput } from "@angular/cdk/coercion";
import { Component, DebugElement, SimpleChange } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { UntypedFormControl, FormsModule, ReactiveFormsModule } from "@angular/forms";
import { By } from "@angular/platform-browser";
import { vi } from "vitest";
import { StarkInputMaskDirectivesModule } from "../input-mask-directives.module";
import { StarkEmailMaskDirective } from "./email-mask.directive";

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

describe("EmailMaskDirective", () => {
	function changeInputValue(inputDebugElement: DebugElement, value: string, eventType: string = "input"): void {
		(<HTMLInputElement>inputDebugElement.nativeElement).value = value;

		const ev: Event = document.createEvent("Event");
		ev.initEvent(eventType, true, true);
		(<HTMLInputElement>inputDebugElement.nativeElement).dispatchEvent(ev);
	}

	@Component({
		standalone: true,
		selector: "stark-email-mask-uncontrolled-host",
		imports: [StarkInputMaskDirectivesModule],
		template: "<input type='text' [starkEmailMask]='emailMaskConfig'>"
	})
	class UncontrolledHostComponent {
		public emailMaskConfig: BooleanInput = true;
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

		const getDirective = (): StarkEmailMaskDirective => inputElement.injector.get(StarkEmailMaskDirective);

		const updateMaskConfig = (maskConfig: BooleanInput): void => {
			const directive = getDirective();
			const previousMaskConfig = directive.maskConfig;

			hostComponent.emailMaskConfig = maskConfig;
			directive.maskConfig = maskConfig as boolean;
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

				changeInputValue(inputElement, "my-email@", eventType);
				fixture.detectChanges();

				expect(inputElement.nativeElement.value).toBe("my-email@ .");
			}

			const invalidEvents: string[] = ["blur", "keyup", "change", "focus", "keydown", "keypress", "click"];

			for (const eventType of invalidEvents) {
				changeInputValue(inputElement, "");
				fixture.detectChanges();
				expect(inputElement.nativeElement.value).toBe("");

				changeInputValue(inputElement, "my-email", eventType);
				fixture.detectChanges();

				expect(inputElement.nativeElement.value).toBe("my-email");
			}
		});

		it("should prevent invalid values to be entered in the input field when the value is changed manually", () => {
			const invalidValues: string[] = ["@@", "@.a.", " @ .", "what@.ever@."];

			for (const value of invalidValues) {
				changeInputValue(inputElement, value);
				fixture.detectChanges();

				expect(inputElement.nativeElement.value).toBe("");
			}
		});

		it("should remove the mask only when the config is set to false", () => {
			changeInputValue(inputElement, "my-email@");
			fixture.detectChanges();

			expect(inputElement.nativeElement.value).toBe("my-email@ .");

			updateMaskConfig(undefined);

			changeInputValue(inputElement, "what@.ever@.");
			fixture.detectChanges();

			expect(inputElement.nativeElement.value).toBe("my-email@ .");

			updateMaskConfig("");

			changeInputValue(inputElement, "what@.ever@.");
			fixture.detectChanges();

			expect(inputElement.nativeElement.value).toBe("my-email@ .");

			updateMaskConfig(false);

			changeInputValue(inputElement, "what@@.ever@.");
			fixture.detectChanges();

			expect(inputElement.nativeElement.value).toBe("what@@.ever@.");
		});
	});

	@Component({
		standalone: true,
		selector: "stark-email-mask-ng-model-host",
		imports: [FormsModule, StarkInputMaskDirectivesModule],
		template: "<input type='text' [(ngModel)]='ngModelValue' [starkEmailMask]='emailMaskConfig'>"
	})
	class NgModelHostComponent {
		public emailMaskConfig: BooleanInput = true;
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

		const getDirective = (): StarkEmailMaskDirective => inputElement.injector.get(StarkEmailMaskDirective);

		const updateMaskConfig = (maskConfig: BooleanInput): void => {
			const directive = getDirective();
			const previousMaskConfig = directive.maskConfig;

			hostComponent.emailMaskConfig = maskConfig;
			directive.maskConfig = maskConfig as boolean;
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

				changeInputValue(inputElement, "my-email@", eventType);
				fixture.detectChanges();

				expect(hostComponent.ngModelValue).toBe("my-email@ .");
			}

			const invalidEvents: string[] = ["blur", "keyup", "change", "focus", "keydown", "keypress", "click"];

			for (const eventType of invalidEvents) {
				changeInputValue(inputElement, "");
				fixture.detectChanges();
				expect(hostComponent.ngModelValue).toBe("");

				changeInputValue(inputElement, "my-email@", eventType);
				fixture.detectChanges();

				expect(hostComponent.ngModelValue).toBe("");
			}
		});

		it("should prevent invalid values to be entered in the input field when the value is changed manually", () => {
			const invalidValues: string[] = ["@@", "@.a.", " @ .", "what@.ever@."];

			for (const value of invalidValues) {
				changeInputValue(inputElement, value);
				fixture.detectChanges();

				expect(hostComponent.ngModelValue).toBe("");
			}
		});

		it("should remove the mask only when the config is set to false", () => {
			changeInputValue(inputElement, "my-email@");
			fixture.detectChanges();

			expect(hostComponent.ngModelValue).toBe("my-email@ .");

			updateMaskConfig(undefined);

			changeInputValue(inputElement, "what@.ever@.");
			fixture.detectChanges();

			expect(hostComponent.ngModelValue).toBe("my-email@ .");

			updateMaskConfig("");

			changeInputValue(inputElement, "what@.ever@.");
			fixture.detectChanges();

			expect(hostComponent.ngModelValue).toBe("my-email@ .");

			updateMaskConfig(false);

			changeInputValue(inputElement, "what@@.ever@.");
			fixture.detectChanges();

			expect(hostComponent.ngModelValue).toBe("what@@.ever@.");
		});
	});

	@Component({
		standalone: true,
		selector: "stark-email-mask-form-control-host",
		imports: [ReactiveFormsModule, StarkInputMaskDirectivesModule],
		template: "<input type='text' [formControl]='formControl' [starkEmailMask]='emailMaskConfig'>"
	})
	class FormControlHostComponent {
		public emailMaskConfig: BooleanInput = true;
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

		const getDirective = (): StarkEmailMaskDirective => inputElement.injector.get(StarkEmailMaskDirective);

		const updateMaskConfig = (maskConfig: BooleanInput): void => {
			const directive = getDirective();
			const previousMaskConfig = directive.maskConfig;

			hostComponent.emailMaskConfig = maskConfig;
			directive.maskConfig = maskConfig as boolean;
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
				changeInputValue(inputElement, "my-email@", eventType);
				fixture.detectChanges();

				expect(hostComponent.formControl.value).toBe("my-email@ .");
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
				changeInputValue(inputElement, "my-email@", eventType);
				fixture.detectChanges();

				expect(hostComponent.formControl.value).toBe("");
				expect(mockValueChangeObserver.next).not.toHaveBeenCalled();
				expect(mockValueChangeObserver.error).not.toHaveBeenCalled();
				expect(mockValueChangeObserver.complete).not.toHaveBeenCalled();
			}
		});

		it("should prevent invalid values to be entered in the input field when the value is changed manually", () => {
			const invalidValues: string[] = ["@@", "@.a.", " @ .", "what@.ever@."];

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

		it("should remove the mask when the config is undefined", () => {
			changeInputValue(inputElement, "my-email@");
			fixture.detectChanges();

			expect(hostComponent.formControl.value).toBe("my-email@ .");
			expect(mockValueChangeObserver.next).toHaveBeenCalledTimes(1);

			mockValueChangeObserver.next.mockClear();
			updateMaskConfig(undefined);
			expect(mockValueChangeObserver.next).not.toHaveBeenCalled();

			mockValueChangeObserver.next.mockClear();
			changeInputValue(inputElement, "what@.ever@.");
			fixture.detectChanges();

			expect(hostComponent.formControl.value).toBe("my-email@ .");
			expect(mockValueChangeObserver.next).toHaveBeenCalledTimes(1);

			mockValueChangeObserver.next.mockClear();
			updateMaskConfig("");
			expect(mockValueChangeObserver.next).not.toHaveBeenCalled();

			mockValueChangeObserver.next.mockClear();
			changeInputValue(inputElement, "what@.ever@.");
			fixture.detectChanges();

			expect(hostComponent.formControl.value).toBe("my-email@ .");
			expect(mockValueChangeObserver.next).toHaveBeenCalledTimes(1);

			mockValueChangeObserver.next.mockClear();
			updateMaskConfig(false);
			expect(mockValueChangeObserver.next).not.toHaveBeenCalled();

			mockValueChangeObserver.next.mockClear();
			changeInputValue(inputElement, "what@@.ever@.");
			fixture.detectChanges();

			expect(hostComponent.formControl.value).toBe("what@@.ever@.");
			expect(mockValueChangeObserver.next).toHaveBeenCalledTimes(1);
			expect(mockValueChangeObserver.error).not.toHaveBeenCalled();
			expect(mockValueChangeObserver.complete).not.toHaveBeenCalled();
		});
	});
});
