import { Component, DebugElement, SimpleChange } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { UntypedFormControl, FormsModule, ReactiveFormsModule } from "@angular/forms";
import { By } from "@angular/platform-browser";
import { vi } from "vitest";
import { StarkInputMaskDirectivesModule } from "../input-mask-directives.module";
import { StarkTextMaskConfig } from "./text-mask-config.intf";
import { StarkTextMaskDirective } from "./text-mask.directive";

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

describe("TextMaskDirective", () => {
	const textMaskConfig: StarkTextMaskConfig = {
		mask: [/[0-1]/, /\d/, "/", /\d/, /\d/]
	};

	function changeInputValue(inputDebugElement: DebugElement, value: string, eventType: string = "input"): void {
		(<HTMLInputElement>inputDebugElement.nativeElement).value = value;

		const ev: Event = document.createEvent("Event");
		ev.initEvent(eventType, true, true);
		(<HTMLInputElement>inputDebugElement.nativeElement).dispatchEvent(ev);
	}

	@Component({
		standalone: true,
		selector: "stark-text-mask-uncontrolled-host",
		imports: [StarkInputMaskDirectivesModule],
		template: "<input type='text' [starkTextMask]='textMaskConfig'>"
	})
	class UncontrolledHostComponent {
		public textMaskConfig: StarkTextMaskConfig = textMaskConfig;
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

		const getDirective = (): StarkTextMaskDirective => inputElement.injector.get(StarkTextMaskDirective);

		const updateMaskConfig = (maskConfig: StarkTextMaskConfig | undefined): void => {
			const directive = getDirective();
			const previousMaskConfig = directive.maskConfig;

			hostComponent.textMaskConfig = maskConfig as StarkTextMaskConfig;
			directive.maskConfig = maskConfig as StarkTextMaskConfig;
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

				expect(inputElement.nativeElement.value).toBe("12/3_");
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
			const invalidValues: string[] = ["4", "a", " ", "whatever"];

			for (const value of invalidValues) {
				changeInputValue(inputElement, value);
				fixture.detectChanges();

				expect(inputElement.nativeElement.value).toBe("");
			}
		});

		it("should refresh the mask whenever the configuration changes", () => {
			changeInputValue(inputElement, "123");
			fixture.detectChanges();

			expect(inputElement.nativeElement.value).toBe("12/3_");

			updateMaskConfig({ ...textMaskConfig, mask: [/\d/, "/", /\d/, "/", /\d/, /\d/], placeholderChar: "-" });

			expect(inputElement.nativeElement.value).toBe("1/2/3-");
		});

		it("should show/hide the mask placeholders depending of the value of the 'guide' option", () => {
			changeInputValue(inputElement, "123");
			fixture.detectChanges();

			expect(inputElement.nativeElement.value).toBe("12/3_");

			updateMaskConfig({ ...textMaskConfig, guide: false });

			expect(inputElement.nativeElement.value).toBe("12/3");
		});

		it("should remove the mask when the config is undefined or the mask property is set to false", () => {
			changeInputValue(inputElement, "123");
			fixture.detectChanges();

			expect(inputElement.nativeElement.value).toBe("12/3_");

			updateMaskConfig(undefined);

			changeInputValue(inputElement, "whatever");
			fixture.detectChanges();

			expect(inputElement.nativeElement.value).toBe("whatever");

			updateMaskConfig({ mask: false });

			changeInputValue(inputElement, "123");
			fixture.detectChanges();

			expect(inputElement.nativeElement.value).toBe("123");
		});
	});

	@Component({
		standalone: true,
		selector: "stark-text-mask-ng-model-host",
		imports: [FormsModule, StarkInputMaskDirectivesModule],
		template: "<input type='text' [(ngModel)]='ngModelValue' [starkTextMask]='textMaskConfig'>"
	})
	class NgModelHostComponent {
		public textMaskConfig: StarkTextMaskConfig = textMaskConfig;
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

		const getDirective = (): StarkTextMaskDirective => inputElement.injector.get(StarkTextMaskDirective);

		const updateMaskConfig = (maskConfig: StarkTextMaskConfig | undefined): void => {
			const directive = getDirective();
			const previousMaskConfig = directive.maskConfig;

			hostComponent.textMaskConfig = maskConfig as StarkTextMaskConfig;
			directive.maskConfig = maskConfig as StarkTextMaskConfig;
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

				expect(hostComponent.ngModelValue).toBe("12/3_");
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
			const invalidValues: string[] = ["4", "a", " ", "whatever"];

			for (const value of invalidValues) {
				changeInputValue(inputElement, value);
				fixture.detectChanges();

				expect(hostComponent.ngModelValue).toBe("");
			}
		});

		it("should refresh the mask whenever the configuration changes", () => {
			changeInputValue(inputElement, "123");
			fixture.detectChanges();

			expect(hostComponent.ngModelValue).toBe("12/3_");

			updateMaskConfig({ ...textMaskConfig, mask: [/\d/, "/", /\d/, "/", /\d/, /\d/], placeholderChar: "-" });

			expect(hostComponent.ngModelValue).toBe("1/2/3-");
		});

		it("should show/hide the mask placeholders depending of the value of the 'guide' option", () => {
			changeInputValue(inputElement, "123");
			fixture.detectChanges();

			expect(hostComponent.ngModelValue).toBe("12/3_");

			updateMaskConfig({ ...textMaskConfig, guide: false });

			expect(hostComponent.ngModelValue).toBe("12/3");
		});

		it("should remove the mask when the config is undefined or the mask property is set to false", () => {
			changeInputValue(inputElement, "123");
			fixture.detectChanges();

			expect(hostComponent.ngModelValue).toBe("12/3_");

			updateMaskConfig(undefined);

			changeInputValue(inputElement, "whatever");
			fixture.detectChanges();

			expect(hostComponent.ngModelValue).toBe("whatever");

			updateMaskConfig({ mask: false });

			changeInputValue(inputElement, "123");
			fixture.detectChanges();

			expect(hostComponent.ngModelValue).toBe("123");
		});
	});

	@Component({
		standalone: true,
		selector: "stark-text-mask-form-control-host",
		imports: [ReactiveFormsModule, StarkInputMaskDirectivesModule],
		template: "<input type='text' [formControl]='formControl' [starkTextMask]='textMaskConfig'>"
	})
	class FormControlHostComponent {
		public textMaskConfig: StarkTextMaskConfig = textMaskConfig;
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

		const getDirective = (): StarkTextMaskDirective => inputElement.injector.get(StarkTextMaskDirective);

		const updateMaskConfig = (maskConfig: StarkTextMaskConfig | undefined): void => {
			const directive = getDirective();
			const previousMaskConfig = directive.maskConfig;

			hostComponent.textMaskConfig = maskConfig as StarkTextMaskConfig;
			directive.maskConfig = maskConfig as StarkTextMaskConfig;
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

				expect(hostComponent.formControl.value).toBe("12/3_");
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
			const invalidValues: string[] = ["4", "a", " ", "whatever"];

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

		it("should buffer IME input until composition ends", () => {
			changeInputValue(inputElement, "", "compositionstart");
			changeInputValue(inputElement, "123");
			fixture.detectChanges();

			expect((<HTMLInputElement>inputElement.nativeElement).value).toBe("123");
			expect(hostComponent.formControl.value).toBe("");
			expect(mockValueChangeObserver.next).not.toHaveBeenCalled();

			changeInputValue(inputElement, "123", "compositionend");
			fixture.detectChanges();

			expect((<HTMLInputElement>inputElement.nativeElement).value).toBe("12/3_");
			expect(hostComponent.formControl.value).toBe("12/3_");
			expect(mockValueChangeObserver.next).toHaveBeenCalledTimes(1);
		});

		it("should buffer IME input while the mask is disabled", () => {
			updateMaskConfig({ mask: false });
			mockValueChangeObserver.next.mockClear();

			changeInputValue(inputElement, "", "compositionstart");
			changeInputValue(inputElement, "自由");
			fixture.detectChanges();

			expect((<HTMLInputElement>inputElement.nativeElement).value).toBe("自由");
			expect(hostComponent.formControl.value).toBe("");
			expect(mockValueChangeObserver.next).not.toHaveBeenCalled();

			changeInputValue(inputElement, "自由", "compositionend");
			fixture.detectChanges();

			expect(hostComponent.formControl.value).toBe("自由");
			expect(mockValueChangeObserver.next).toHaveBeenCalledTimes(1);
		});

		it("should refresh the mask whenever the configuration changes", () => {
			changeInputValue(inputElement, "123");
			fixture.detectChanges();

			expect(hostComponent.formControl.value).toBe("12/3_");
			expect(mockValueChangeObserver.next).toHaveBeenCalledTimes(1);

			mockValueChangeObserver.next.mockClear();
			updateMaskConfig({ ...textMaskConfig, mask: [/\d/, "/", /\d/, "/", /\d/, /\d/], placeholderChar: "-" });

			expect(hostComponent.formControl.value).toBe("1/2/3-");
			expect(mockValueChangeObserver.next).toHaveBeenCalledTimes(1);
			expect(mockValueChangeObserver.error).not.toHaveBeenCalled();
			expect(mockValueChangeObserver.complete).not.toHaveBeenCalled();
		});

		it("should show/hide the mask placeholders depending of the value of the 'guide' option", () => {
			changeInputValue(inputElement, "123");
			fixture.detectChanges();

			expect(hostComponent.formControl.value).toBe("12/3_");
			expect(mockValueChangeObserver.next).toHaveBeenCalledTimes(1);

			mockValueChangeObserver.next.mockClear();
			updateMaskConfig({ ...textMaskConfig, guide: false });

			expect(hostComponent.formControl.value).toBe("12/3");
			expect(mockValueChangeObserver.next).toHaveBeenCalledTimes(1);
			expect(mockValueChangeObserver.error).not.toHaveBeenCalled();
			expect(mockValueChangeObserver.complete).not.toHaveBeenCalled();
		});

		it("should remove the mask when the config is undefined or the mask property is set to false", () => {
			changeInputValue(inputElement, "123");
			fixture.detectChanges();

			expect(hostComponent.formControl.value).toBe("12/3_");
			expect(mockValueChangeObserver.next).toHaveBeenCalledTimes(1);

			mockValueChangeObserver.next.mockClear();
			updateMaskConfig(undefined);
			expect(mockValueChangeObserver.next).not.toHaveBeenCalled();

			mockValueChangeObserver.next.mockClear();
			changeInputValue(inputElement, "whatever");
			fixture.detectChanges();

			expect(hostComponent.formControl.value).toBe("whatever");
			expect(mockValueChangeObserver.next).toHaveBeenCalledTimes(1);

			mockValueChangeObserver.next.mockClear();
			updateMaskConfig({ mask: false });
			expect(mockValueChangeObserver.next).not.toHaveBeenCalled();

			mockValueChangeObserver.next.mockClear();
			changeInputValue(inputElement, "123");
			fixture.detectChanges();

			expect(hostComponent.formControl.value).toBe("123");
			expect(mockValueChangeObserver.next).toHaveBeenCalledTimes(1);
			expect(mockValueChangeObserver.error).not.toHaveBeenCalled();
			expect(mockValueChangeObserver.complete).not.toHaveBeenCalled();
		});
	});
});
