import { Component } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { UntypedFormControl, FormsModule, ReactiveFormsModule } from "@angular/forms";
import { StarkTransformInputDirectiveModule } from "../transform-input-directive.module";
import { StarkInputTransformationType } from "./transform-input.directive";
import { vi } from "vitest";

/**
 * Mocks an InputEvent on the element with the given value.
 * @param value - The value to set the element to.
 * @param element - The HTMLInputElement to mock the event on
 */
function mockInputEvent(value: string, element: HTMLInputElement | HTMLTextAreaElement): void {
	const inputEvent: Event = document.createEvent("Event");
	inputEvent.initEvent("input", true, true);

	element.value = value;
	element.dispatchEvent(inputEvent);
}

/**
 * Returns a function which replaces a specific word with a corresponding number of '*'.
 * @param word - The word to filter
 */
function wordFilter(word: string): (v: string) => string {
	return (v: string): string =>
		v.replace(word, (match: string) =>
			match
				.split("")
				.map(() => "*")
				.join("")
		);
}

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

describe("TransformInputDirective", () => {
	describe("with ngModel", () => {
		@Component({
			standalone: true,
			selector: "stark-transform-input-ng-model-host",
			imports: [FormsModule, StarkTransformInputDirectiveModule],
			template: "<input [(ngModel)]='value' [starkTransformInput]='starkTransformInputValue'/>"
		})
		class TestComponent {
			public starkTransformInputValue: StarkInputTransformationType = () => {
				/* noop*/
			};
			public value = "";
		}

		let fixture: ComponentFixture<TestComponent>;
		let component: TestComponent;
		let htmlInputElement: HTMLInputElement;

		const renderHost = (transformation?: StarkInputTransformationType): void => {
			fixture = TestBed.createComponent(TestComponent);
			component = fixture.componentInstance;
			if (typeof transformation !== "undefined") {
				component.starkTransformInputValue = transformation;
			}
			htmlInputElement = fixture.nativeElement.querySelector("input");

			// trigger initial data binding
			fixture.detectChanges();
		};

		beforeEach(() => {
			TestBed.configureTestingModule({
				imports: [TestComponent]
			});
		});

		it("should set value to uppercase", () => {
			const input = "upper";
			const expected = "UPPER";

			renderHost("uppercase");
			expect(component.value).toBe("");

			mockInputEvent(input, htmlInputElement);
			fixture.detectChanges();

			expect(component.value).toBe(expected);
		});

		it("should set value to lowercase", () => {
			const input = "LOWER";
			const expected = "lower";

			renderHost("lowercase");
			expect(component.value).toBe("");

			mockInputEvent(input, htmlInputElement);
			fixture.detectChanges();

			expect(component.value).toBe(expected);
		});

		it("should replace dirty word", () => {
			const input = "fudge you!";
			const expected = "***** you!";

			renderHost(wordFilter("fudge"));
			expect(component.value).toBe("");

			mockInputEvent(input, htmlInputElement);
			fixture.detectChanges();

			expect(component.value).toBe(expected);
		});
	});

	describe("with formControl", () => {
		@Component({
			standalone: true,
			selector: "stark-transform-input-form-control-host",
			imports: [ReactiveFormsModule, StarkTransformInputDirectiveModule],
			template: "<input [formControl]='formControl' [starkTransformInput]='starkTransformInputValue'/>"
		})
		class TestComponent {
			public starkTransformInputValue: StarkInputTransformationType = () => {
				/* noop*/
			};
			public formControl = new UntypedFormControl("");
		}

		let fixture: ComponentFixture<TestComponent>;
		let component: TestComponent;
		let mockValueChangeObserver: ObserverSpy;
		let htmlInputElement: HTMLInputElement;

		const renderHost = (transformation?: StarkInputTransformationType): void => {
			fixture = TestBed.createComponent(TestComponent);
			component = fixture.componentInstance;
			if (typeof transformation !== "undefined") {
				component.starkTransformInputValue = transformation;
			}
			htmlInputElement = fixture.nativeElement.querySelector("input");

			// Register mock subscription
			mockValueChangeObserver = createObserverSpy();
			component.formControl.valueChanges.subscribe({
				next: mockValueChangeObserver.next,
				error: mockValueChangeObserver.error,
				complete: mockValueChangeObserver.complete
			});

			// trigger initial data binding
			fixture.detectChanges();
		};

		beforeEach(() => {
			TestBed.configureTestingModule({
				imports: [TestComponent]
			});
		});

		it("should set value to uppercase", () => {
			const input = "upper";
			const expected = "UPPER";

			renderHost("uppercase");
			expect(component.formControl.value).toBe("");

			mockInputEvent(input, htmlInputElement);
			fixture.detectChanges();

			expect(component.formControl.value).toBe(expected);
			expect(mockValueChangeObserver.next).toHaveBeenCalledTimes(1);
			expect(mockValueChangeObserver.error).not.toHaveBeenCalled();
			expect(mockValueChangeObserver.complete).not.toHaveBeenCalled();
		});

		it("should set value to lowercase", () => {
			const input = "LOWER";
			const expected = "lower";

			renderHost("lowercase");
			expect(component.formControl.value).toBe("");

			mockInputEvent(input, htmlInputElement);
			fixture.detectChanges();

			expect(component.formControl.value).toBe(expected);
			expect(mockValueChangeObserver.next).toHaveBeenCalledTimes(1);
			expect(mockValueChangeObserver.error).not.toHaveBeenCalled();
			expect(mockValueChangeObserver.complete).not.toHaveBeenCalled();
		});

		it("should replace dirty word", () => {
			const input = "fudge you!";
			const expected = "***** you!";

			renderHost(wordFilter("fudge"));
			expect(component.formControl.value).toBe("");

			mockInputEvent(input, htmlInputElement);
			fixture.detectChanges();

			expect(component.formControl.value).toBe(expected);
			expect(mockValueChangeObserver.next).toHaveBeenCalledTimes(1);
			expect(mockValueChangeObserver.error).not.toHaveBeenCalled();
			expect(mockValueChangeObserver.complete).not.toHaveBeenCalled();
		});
	});

	describe("uncontrolled", () => {
		@Component({
			standalone: true,
			selector: "stark-transform-input-uncontrolled-host",
			imports: [StarkTransformInputDirectiveModule],
			template: "<input [starkTransformInput]='starkTransformInputValue'/>"
		})
		class TestComponent {
			public starkTransformInputValue: StarkInputTransformationType = () => {
				/* noop*/
			};
		}

		let fixture: ComponentFixture<TestComponent>;
		let component: TestComponent;
		let htmlInputElement: HTMLInputElement;

		const renderHost = (transformation?: StarkInputTransformationType): void => {
			fixture = TestBed.createComponent(TestComponent);
			component = fixture.componentInstance;
			if (typeof transformation !== "undefined") {
				component.starkTransformInputValue = transformation;
			}
			htmlInputElement = fixture.nativeElement.querySelector("input");
			htmlInputElement.value = "";

			// trigger initial data binding
			fixture.detectChanges();
		};

		beforeEach(() => {
			TestBed.configureTestingModule({
				imports: [TestComponent]
			});
		});

		it("should set value to uppercase", () => {
			const input = "upper";
			const expected = "UPPER";

			renderHost("uppercase");
			expect(htmlInputElement.value).toBe("");

			mockInputEvent(input, htmlInputElement);
			fixture.detectChanges();

			expect(htmlInputElement.value).toBe(expected);
		});

		it("should set value to lowercase", () => {
			const input = "LOWER";
			const expected = "lower";

			renderHost("lowercase");
			expect(htmlInputElement.value).toBe("");

			mockInputEvent(input, htmlInputElement);
			fixture.detectChanges();

			expect(htmlInputElement.value).toBe(expected);
		});

		it("should replace dirty word", () => {
			const input = "fudge you!";
			const expected = "***** you!";

			renderHost(wordFilter("fudge"));
			expect(htmlInputElement.value).toBe("");

			mockInputEvent(input, htmlInputElement);
			fixture.detectChanges();

			expect(htmlInputElement.value).toBe(expected);
		});
	});

	describe("on textarea", () => {
		@Component({
			standalone: true,
			selector: "stark-transform-input-textarea-host",
			imports: [StarkTransformInputDirectiveModule],
			template: "<textarea [starkTransformInput]='starkTransformInputValue'></textarea>"
		})
		class TestComponent {
			public starkTransformInputValue: StarkInputTransformationType = () => {
				/* noop*/
			};
		}

		let fixture: ComponentFixture<TestComponent>;
		let component: TestComponent;
		let htmlInputElement: HTMLTextAreaElement;

		const renderHost = (transformation?: StarkInputTransformationType): void => {
			fixture = TestBed.createComponent(TestComponent);
			component = fixture.componentInstance;
			if (typeof transformation !== "undefined") {
				component.starkTransformInputValue = transformation;
			}
			htmlInputElement = fixture.nativeElement.querySelector("textarea");
			htmlInputElement.value = "";

			// trigger initial data binding
			fixture.detectChanges();
		};

		beforeEach(() => {
			TestBed.configureTestingModule({
				imports: [TestComponent]
			});
		});

		it("should set value to uppercase", () => {
			const input = "upper";
			const expected = "UPPER";

			renderHost("uppercase");
			expect(htmlInputElement.value).toBe("");

			mockInputEvent(input, htmlInputElement);
			fixture.detectChanges();

			expect(htmlInputElement.value).toBe(expected);
		});

		it("should set value to lowercase", () => {
			const input = "LOWER";
			const expected = "lower";

			renderHost("lowercase");
			expect(htmlInputElement.value).toBe("");

			mockInputEvent(input, htmlInputElement);
			fixture.detectChanges();

			expect(htmlInputElement.value).toBe(expected);
		});

		it("should replace dirty word", () => {
			const input = "fudge you!";
			const expected = "***** you!";

			renderHost(wordFilter("fudge"));
			expect(htmlInputElement.value).toBe("");

			mockInputEvent(input, htmlInputElement);
			fixture.detectChanges();

			expect(htmlInputElement.value).toBe(expected);
		});
	});

	describe("invalid input", () => {
		@Component({
			standalone: true,
			selector: "stark-transform-input-invalid-host",
			imports: [StarkTransformInputDirectiveModule],
			template: "<input [starkTransformInput]='$any(invalidInput)'/>"
		})
		class TestComponent {
			public invalidInput: unknown = "INVALID_INPUT";
		}

		beforeEach(() => {
			TestBed.configureTestingModule({
				imports: [TestComponent]
			});
		});

		it("should throw an error", () => {
			const invalidFixture: ComponentFixture<TestComponent> = TestBed.createComponent(TestComponent);
			expect(() => invalidFixture.detectChanges()).toThrowError(/StarkInputTransformationType/);

			const validFixture: ComponentFixture<TestComponent> = TestBed.createComponent(TestComponent);
			validFixture.componentInstance.invalidInput = "uppercase";
			expect(() => validFixture.detectChanges()).not.toThrowError();

			const invalidAgainFixture: ComponentFixture<TestComponent> = TestBed.createComponent(TestComponent);
			invalidAgainFixture.componentInstance.invalidInput = "INVALID_INPUT";
			expect(() => invalidAgainFixture.detectChanges()).toThrowError(/StarkInputTransformationType/);
		});
	});
});
