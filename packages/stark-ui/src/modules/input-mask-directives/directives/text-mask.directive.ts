import { Directive, ElementRef, forwardRef, Inject, Input, OnChanges, Optional, Provider, Renderer2, SimpleChanges } from "@angular/core";
import { COMPOSITION_BUFFER_MODE, NG_VALUE_ACCESSOR } from "@angular/forms";
import { AbstractStarkTextMaskDirective, StarkTextMaskRuntimeConfig } from "./abstract-text-mask.directive";
import { StarkTextMaskConfig } from "./text-mask-config.intf";

/**
 * @ignore
 */
const directiveName = "[starkTextMask]";

/**
 * @ignore
 */
export const STARK_TEXT_MASK_VALUE_ACCESSOR: Provider = {
	provide: NG_VALUE_ACCESSOR,

	useExisting: forwardRef(() => StarkTextMaskDirective),
	multi: true
};

/**
 * Directive to display a configurable mask in input elements.
 *
 * **`IMPORTANT:`** Currently the Text Mask supports only input of type text, tel, url, password, and search.
 * Due to a limitation in browser API, other input types, such as email or number, cannot be supported.
 *
 * ### Disabling the mask
 * Passing an `undefined` value as config or a config object with `mask: false` will disable the mask.
 *
 * @example
 * <input type="text" [starkTextMask]="yourMaskConfig">
 * <!-- or -->
 * <input type="text" [(ngModel)]="yourModelValue" [starkTextMask]="yourMaskConfig">
 * <!-- or -->
 * <input type="text" [formControl]="yourFormControl" [starkTextMask]="yourMaskConfig">
 *
 */
@Directive({
	standalone: false,
	host: {
		"(input)": "_handleInput($any($event.target).value)",
		"(blur)": "onTouched()",
		"(compositionstart)": "_compositionStart()",
		"(compositionend)": "_compositionEnd($any($event.target).value)"
	},
	selector: directiveName,
	exportAs: "starkTextMask",
	providers: [STARK_TEXT_MASK_VALUE_ACCESSOR]
})
export class StarkTextMaskDirective extends AbstractStarkTextMaskDirective implements OnChanges {
	/**
	 * Configuration object for the mask to be displayed in the input field.
	 */
	/* eslint-disable @angular-eslint/no-input-rename */
	@Input("starkTextMask")
	public maskConfig: StarkTextMaskConfig = { mask: false };

	/**
	 * Default configuration.
	 * It will be merged with the configuration passed to the directive.
	 */
	private readonly defaultTextMaskConfig: StarkTextMaskConfig = {
		mask: false, // by default the mask is disabled
		guide: true,
		placeholderChar: "_",
		keepCharPositions: true
	};

	/**
	 * Latest user-entered value without static mask characters.
	 */
	private lastUnmaskedValue = "";

	/**
	 * Class constructor
	 * @param _renderer - Angular `Renderer2` wrapper for DOM manipulations.
	 * @param _elementRef - Reference to the DOM element where this directive is applied to.
	 * @param _compositionMode - Injected token to control if form directives buffer IME input until the "compositionend" event occurs.
	 */
	public constructor(
		_renderer: Renderer2,
		_elementRef: ElementRef,
		@Optional() @Inject(COMPOSITION_BUFFER_MODE) _compositionMode: boolean
	) {
		super(_renderer, _elementRef, _compositionMode);
	}

	/**
	 * Component lifecycle hook
	 * @param changes - Contains the changed properties
	 */
	public override ngOnChanges(changes: SimpleChanges): void {
		const inputElement = this.getInputElement();
		const currentUnmaskedValue = this.getUnmaskedValue(inputElement?.value || "", this.textMaskConfig) || this.lastUnmaskedValue;

		this.textMaskConfig = this.normalizeMaskConfig(this.maskConfig);

		if (this.textMaskConfig.mask === false) {
			this.clearMask();
			if (inputElement) {
				inputElement.value = currentUnmaskedValue;
			}
			this.lastUnmaskedValue = currentUnmaskedValue;
			return;
		}

		super.ngOnChanges(changes);

		if (changes["maskConfig"] && !changes["maskConfig"].isFirstChange()) {
			const textMaskInputElement = this.textMaskInputElement;
			if (textMaskInputElement) {
				textMaskInputElement.update(currentUnmaskedValue);
			}

			this.lastUnmaskedValue = this.getUnmaskedValue(inputElement?.value || "");

			// Re-emit the normalized value so Angular forms stay in sync after a runtime mask change.
			if (inputElement) {
				this.onChange(inputElement.value);
			}
		}
	}

	/**
	 * Writes the model value to the host input while preserving the unmasked text representation.
	 * @param value - The incoming Angular forms value.
	 */
	public override writeValue(value: any): void {
		const normalizedValue = String(value ?? "");
		const inputElement = this.getInputElement();
		this.lastUnmaskedValue = this.getUnmaskedValue(normalizedValue);

		if (this.textMaskConfig.mask === false) {
			if (inputElement) {
				inputElement.value = normalizedValue;
			}
			return;
		}

		super.writeValue(value);
		this.lastUnmaskedValue = this.getUnmaskedValue(inputElement?.value || normalizedValue);
	}

	/**
	 * Tracks user input across masked and unmasked states before delegating to the Stark mask engine.
	 * @param value - The raw value emitted by the host input.
	 */
	public override _handleInput(value: string): void {
		if (this.shouldBufferInput()) {
			return;
		}

		if (this.textMaskConfig.mask === false) {
			this.lastUnmaskedValue = value || "";
			this.onChange(this.lastUnmaskedValue);
			return;
		}

		this.lastUnmaskedValue = this.getUnmaskedValue(value || "");
		super._handleInput(value);

		const inputElement = this.getInputElement();
		this.lastUnmaskedValue = this.getUnmaskedValue(inputElement?.value || this.lastUnmaskedValue);
	}

	/**
	 * Create a normalized configuration for the Stark mask runtime.
	 * @param maskConfig - The provided configuration via the directive's input
	 */
	public normalizeMaskConfig(maskConfig: StarkTextMaskConfig): StarkTextMaskRuntimeConfig {
		return { ...this.defaultTextMaskConfig, ...maskConfig };
	}

	private getUnmaskedValue(value: string, maskConfig: StarkTextMaskRuntimeConfig = this.textMaskConfig): string {
		if (!value || maskConfig.mask === false || !(maskConfig.mask instanceof Array)) {
			return value || "";
		}

		const placeholderChar = maskConfig.placeholderChar || this.defaultTextMaskConfig.placeholderChar || "_";
		let rawValue = "";
		let valueIndex = 0;

		for (const maskToken of maskConfig.mask) {
			const currentChar = value[valueIndex];
			if (typeof currentChar === "undefined") {
				break;
			}

			if (maskToken instanceof RegExp) {
				if (currentChar !== placeholderChar) {
					rawValue += currentChar;
				}
				valueIndex++;
				continue;
			}

			if (value.startsWith(maskToken, valueIndex)) {
				valueIndex += maskToken.length;
			}
		}

		return rawValue;
	}
}
