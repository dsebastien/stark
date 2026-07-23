import { Directive, ElementRef, OnChanges, Renderer2, SimpleChanges } from "@angular/core";
import { ControlValueAccessor } from "@angular/forms";
import { StarkTextMaskConfig } from "./text-mask-config.intf";
import { createStarkTextMaskInputElement, StarkTextMaskInputElement } from "./text-mask-engine";

export type StarkTextMaskRuntimeConfig = StarkTextMaskConfig & { showMask?: boolean };

/** Shared Angular 22 forms adapter for Stark's public masking directives. */
@Directive()
export abstract class AbstractStarkTextMaskDirective implements ControlValueAccessor, OnChanges {
	protected textMaskConfig: StarkTextMaskRuntimeConfig = {
		mask: [],
		guide: true,
		placeholderChar: "_",
		keepCharPositions: false
	};

	protected textMaskInputElement?: StarkTextMaskInputElement;

	public onChange: (value: string) => void = (_value: string): void => undefined;
	public onTouched: () => void = (): void => undefined;

	private inputElement?: HTMLInputElement;
	private composing = false;
	private readonly compositionMode: boolean;

	protected constructor(
		private readonly renderer: Renderer2,
		private readonly elementRef: ElementRef<HTMLElement>,
		compositionMode?: boolean
	) {
		const userAgent = typeof navigator === "undefined" ? "" : navigator.userAgent.toLowerCase();
		this.compositionMode = compositionMode ?? !/android \d+/.test(userAgent);
	}

	public ngOnChanges(_changes: SimpleChanges): void {
		this.setupMask(true);
		this.textMaskInputElement?.update(this.getInputElement()?.value);
	}

	public writeValue(value: unknown): void {
		const inputElement = this.getInputElement();
		if (!inputElement) {
			return;
		}

		const normalizedValue = value ?? "";
		this.renderer.setProperty(inputElement, "value", normalizedValue);
		this.textMaskInputElement?.update(value);
	}

	public registerOnChange(fn: (value: string) => void): void {
		this.onChange = fn;
	}

	public registerOnTouched(fn: () => void): void {
		this.onTouched = fn;
	}

	public setDisabledState(isDisabled: boolean): void {
		const inputElement = this.getInputElement();
		if (inputElement) {
			this.renderer.setProperty(inputElement, "disabled", isDisabled);
		}
	}

	public _handleInput(value: string): void {
		if (this.shouldBufferInput()) {
			return;
		}

		this.setupMask();
		this.textMaskInputElement?.update(value);
		const inputElement = this.getInputElement();
		if (this.textMaskInputElement && inputElement) {
			this.onChange(inputElement.value);
		}
	}

	public _compositionStart(): void {
		this.composing = true;
	}

	public _compositionEnd(value: string): void {
		this.composing = false;
		if (this.compositionMode) {
			this._handleInput(value);
		}
	}

	protected getInputElement(): HTMLInputElement | undefined {
		if (!this.inputElement) {
			const nativeElement: HTMLElement = this.elementRef.nativeElement;
			this.inputElement = nativeElement instanceof HTMLInputElement ? nativeElement : nativeElement.getElementsByTagName("input")[0];
		}

		return this.inputElement;
	}

	protected clearMask(): void {
		this.textMaskInputElement = undefined;
	}

	/** Whether Angular forms should keep buffering the current IME composition. */
	protected shouldBufferInput(): boolean {
		return this.compositionMode && this.composing;
	}

	private setupMask(recreate: boolean = false): void {
		const inputElement = this.getInputElement();
		if (!inputElement || this.textMaskConfig.mask === false) {
			this.clearMask();
			return;
		}

		if (recreate || !this.textMaskInputElement) {
			this.textMaskInputElement = createStarkTextMaskInputElement({ inputElement, ...this.textMaskConfig });
		}
	}
}
