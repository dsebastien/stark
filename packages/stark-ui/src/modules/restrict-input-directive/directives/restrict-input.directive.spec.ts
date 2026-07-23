import { Component, DebugElement } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { STARK_LOGGING_SERVICE, StarkLoggingService } from "@nationalbankbelgium/stark-core";
import { vi } from "vitest";
import { StarkRestrictInputDirectiveModule } from "../restrict-input-directive.module";

describe("RestrictInputDirective", () => {
	@Component({
		standalone: true,
		selector: "stark-restrict-input-default-host",
		imports: [StarkRestrictInputDirectiveModule],
		template: "<input type='text' starkRestrictInput>"
	})
	class DefaultHostComponent {}

	@Component({
		standalone: true,
		selector: "stark-restrict-input-pattern-host",
		imports: [StarkRestrictInputDirectiveModule],
		template: "<input type='text' starkRestrictInput='\\d'>"
	})
	class PatternHostComponent {}

	const mockLogger = {
		debug: vi.fn<(message: string) => void>(),
		warn: vi.fn<(message: string) => void>()
	} as unknown as StarkLoggingService;

	/**
	 * Return whether the triggered event was cancelled (default prevented)
	 */
	function triggerKeyPressEvent(inputElement: DebugElement, value: string): boolean {
		(<HTMLInputElement>inputElement.nativeElement).value = value;

		const keypressEvent = new KeyboardEvent("keypress", { key: value, bubbles: true, cancelable: true });
		// dispatchEvent() returns false if any of the event handlers which handled this event called Event.preventDefault()
		return !(<HTMLInputElement>inputElement.nativeElement).dispatchEvent(keypressEvent);
	}

	function triggerPasteEvent(inputElement: DebugElement, value: string): boolean {
		const pasteEvent = new Event("paste", { bubbles: true, cancelable: true }) as ClipboardEvent;
		Object.defineProperty(pasteEvent, "clipboardData", {
			value: {
				getData: (): string => value
			}
		});

		return !(<HTMLInputElement>inputElement.nativeElement).dispatchEvent(pasteEvent);
	}

	function triggerDropEvent(inputElement: DebugElement, value: string): boolean {
		const dragEvent = new Event("drop", { bubbles: true, cancelable: true }) as DragEvent;
		Object.defineProperty(dragEvent, "dataTransfer", {
			value: {
				getData: (): string => value
			}
		});

		return !(<HTMLInputElement>inputElement.nativeElement).dispatchEvent(dragEvent);
	}

	function triggerAndAssert(
		inputElement: DebugElement,
		values: string[],
		shouldBeValid: boolean,
		triggerFunction: (inputElement: DebugElement, value: string) => boolean
	): void {
		for (const value of values) {
			const eventDefaultPrevented = triggerFunction(inputElement, value);
			expect(eventDefaultPrevented).toBe(shouldBeValid);
		}
	}

	describe("when input restriction is not defined", () => {
		let fixture: ComponentFixture<DefaultHostComponent>;

		beforeEach(() => {
			TestBed.configureTestingModule({
				imports: [DefaultHostComponent],
				providers: [{ provide: STARK_LOGGING_SERVICE, useValue: mockLogger }]
			});

			fixture = TestBed.createComponent(DefaultHostComponent);
			fixture.detectChanges();
		});

		it("should NOT prevent any value from being typed in the input when no input restriction was provided", () => {
			expect(fixture).toBeDefined();
			const inputElement: DebugElement = fixture.debugElement.query(By.css("input"));

			triggerAndAssert(inputElement, ["1", "a", "-"], false, triggerKeyPressEvent);
		});

		it("should NOT prevent any value from being pasted in the input when no input restriction was provided", () => {
			expect(fixture).toBeDefined();
			const inputElement: DebugElement = fixture.debugElement.query(By.css("input"));

			triggerAndAssert(inputElement, ["1", "a", "-"], false, triggerPasteEvent);
		});

		it("should NOT prevent any value from being drop in the input when no input restriction was provided", () => {
			expect(fixture).toBeDefined();
			const inputElement: DebugElement = fixture.debugElement.query(By.css("input"));

			triggerAndAssert(inputElement, ["1", "a", "-"], false, triggerDropEvent);
		});
	});

	describe("when input restriction is given", () => {
		let fixture: ComponentFixture<PatternHostComponent>;

		beforeEach(() => {
			TestBed.configureTestingModule({
				imports: [PatternHostComponent],
				providers: [{ provide: STARK_LOGGING_SERVICE, useValue: mockLogger }]
			});

			fixture = TestBed.createComponent(PatternHostComponent);
			fixture.detectChanges();
		});

		it("should prevent any value other than the given ones in the configuration from being typed in the input", () => {
			const inputElement: DebugElement = fixture.debugElement.query(By.css("input"));

			triggerAndAssert(inputElement, ["a", "B", "-"], true, triggerKeyPressEvent);
		});

		it("should NOT prevent any of the values given in the configuration from being typed in the input", () => {
			const inputElement: DebugElement = fixture.debugElement.query(By.css("input"));

			triggerAndAssert(inputElement, ["9", "1", "0"], false, triggerKeyPressEvent);
		});

		it("should prevent any of the values given in the configuration from being pasted in the input", () => {
			expect(fixture).toBeDefined();
			const inputElement: DebugElement = fixture.debugElement.query(By.css("input"));

			triggerAndAssert(inputElement, ["a", "B", "-"], true, triggerPasteEvent);
		});

		it("should NOT prevent any of the values given in the configuration from being pasted in the input", () => {
			expect(fixture).toBeDefined();
			const inputElement: DebugElement = fixture.debugElement.query(By.css("input"));
			triggerAndAssert(inputElement, ["9", "1", "0"], false, triggerPasteEvent);
		});

		it("should prevent any of the values given in the configuration from being drop in the input", () => {
			expect(fixture).toBeDefined();
			const inputElement: DebugElement = fixture.debugElement.query(By.css("input"));
			triggerAndAssert(inputElement, ["a", "B", "-"], true, triggerDropEvent);
		});

		it("should NOT prevent any of the values given in the configuration from being drop in the input", () => {
			expect(fixture).toBeDefined();
			const inputElement: DebugElement = fixture.debugElement.query(By.css("input"));
			triggerAndAssert(inputElement, ["9", "1", "0"], false, triggerDropEvent);
		});
	});
});
