import { Directive, ElementRef, forwardRef, Inject, Input, OnChanges, Optional, Provider, Renderer2, SimpleChanges } from "@angular/core";
import { COMPOSITION_BUFFER_MODE, NG_VALUE_ACCESSOR } from "@angular/forms";
import { MaskedInputDirective, TextMaskConfig as Ng2TextMaskConfig } from "angular2-text-mask";
import { createNumberMask } from "text-mask-addons";
import { StarkNumberMaskConfig } from "./number-mask-config.intf";

/**
 * @ignore
 */
const directiveName = "[starkNumberMask]";

/**
 * @ignore
 */
export const STARK_NUMBER_MASK_VALUE_ACCESSOR: Provider = {
	provide: NG_VALUE_ACCESSOR,

	useExisting: forwardRef(() => StarkNumberMaskDirective),
	multi: true
};

/**
 * Directive to display a number mask in input elements. This directive internally uses the {@link https://github.com/text-mask/text-mask/tree/master/core|text-mask-core} library
 * to provide the input mask functionality.
 *
 * **`IMPORTANT:`** Currently the Number Mask supports only input of type text, tel, url, password, and search.
 * Due to a limitation in browser API, other input types, such as email or number, cannot be supported.
 *
 * ### Disabling the mask
 * Passing an `undefined` value as config to the directive will disable the mask.
 *
 * @example
 * <input type="text" [starkNumberMask]="yourMaskConfig">
 * <!-- or -->
 * <input type="text" [(ngModel)]="yourModelValue" [starkNumberMask]="yourMaskConfig">
 * <!-- or -->
 * <input type="text" [formControl]="yourFormControl" [starkNumberMask]="yourMaskConfig">
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
	exportAs: "starkNumberMask",
	providers: [STARK_NUMBER_MASK_VALUE_ACCESSOR]
})
export class StarkNumberMaskDirective extends MaskedInputDirective implements OnChanges {
	/**
	 * Configuration object for the mask to be displayed in the input field.
	 */
	/* eslint-disable @angular-eslint/no-input-rename */
	@Input("starkNumberMask")
	public maskConfig: StarkNumberMaskConfig = {};

	/**
	 * @ignore
	 */
	private elementRef: ElementRef;

	/**
	 * Default configuration.
	 * It will be merged with the configuration passed to the directive.
	 */
	private readonly defaultNumberMaskConfig: StarkNumberMaskConfig = {
		prefix: "",
		suffix: "",
		includeThousandsSeparator: true,
		thousandsSeparatorSymbol: ",",
		allowDecimal: false,
		decimalSymbol: ".",
		decimalLimit: 2,
		requireDecimal: false,
		allowNegative: true,
		allowLeadingZeroes: false
	};

	/**
	 * Latest user-entered value without static mask characters.
	 */
	private lastUnmaskedValue = "";

	/**
	 * Latest normalized number mask configuration.
	 */
	private appliedMaskConfig: StarkNumberMaskConfig | undefined = { ...this.defaultNumberMaskConfig };

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
		this.elementRef = _elementRef;
	}

	/**
	 * Component lifecycle hook
	 * @param changes - Contains the changed properties
	 */
	public override ngOnChanges(changes: SimpleChanges): void {
		const inputElement = this.getInputElement();
		const currentUnmaskedValue = this.getUnmaskedValue(inputElement?.value || "", this.appliedMaskConfig) || this.lastUnmaskedValue;

		this.textMaskConfig = this.normalizeMaskConfig(this.maskConfig);
		this.appliedMaskConfig =
			typeof this.maskConfig === "undefined" ? undefined : { ...this.defaultNumberMaskConfig, ...this.maskConfig };

		if (this.textMaskConfig.mask === false) {
			(<any>this).textMaskInputElement = undefined;
			if (inputElement) {
				inputElement.value = currentUnmaskedValue;
			}
			this.lastUnmaskedValue = currentUnmaskedValue;
			return;
		}

		super.ngOnChanges(changes);

		if (changes["maskConfig"] && !changes["maskConfig"].isFirstChange()) {
			const textMaskInputElement: { update: (value: string) => void } | undefined = (<any>this).textMaskInputElement;
			if (textMaskInputElement) {
				textMaskInputElement.update(currentUnmaskedValue);
			}

			this.lastUnmaskedValue = this.getUnmaskedValue(inputElement?.value || "", this.appliedMaskConfig);

			if (inputElement) {
				this.onChange(inputElement.value);
			}
		}
	}

	/**
	 * Writes the model value to the host input while preserving the unmasked numeric representation.
	 * @param value - The incoming Angular forms value.
	 */
	public override writeValue(value: any): void {
		const normalizedValue = String(value ?? "");
		const inputElement = this.getInputElement();
		this.lastUnmaskedValue = this.getUnmaskedValue(normalizedValue, this.appliedMaskConfig);

		if (this.textMaskConfig.mask === false) {
			if (inputElement) {
				inputElement.value = normalizedValue;
			}
			return;
		}

		super.writeValue(value);
		this.lastUnmaskedValue = this.getUnmaskedValue(inputElement?.value || normalizedValue, this.appliedMaskConfig);
	}

	/**
	 * Tracks user input across masked and unmasked states before delegating to the text-mask runtime.
	 * @param value - The raw value emitted by the host input.
	 */
	public override _handleInput(value: string): void {
		if (this.textMaskConfig.mask === false) {
			this.lastUnmaskedValue = value || "";
			this.onChange(this.lastUnmaskedValue);
			return;
		}

		this.lastUnmaskedValue = this.getUnmaskedValue(value || "", this.appliedMaskConfig);
		super._handleInput(value);

		const inputElement = this.getInputElement();
		this.lastUnmaskedValue = this.getUnmaskedValue(inputElement?.value || this.lastUnmaskedValue, this.appliedMaskConfig);
	}

	/**
	 * Create a valid configuration to be passed to the MaskedInputDirective
	 * @param maskConfig - The provided configuration via the directive's input
	 */
	public normalizeMaskConfig(maskConfig: StarkNumberMaskConfig): Ng2TextMaskConfig {
		if (typeof maskConfig === "undefined") {
			return { mask: false }; // remove the mask
		}

		// TODO: Ng2TextMaskConfig is not the same as Core TextMaskConfig
		const numberMaskConfig: StarkNumberMaskConfig = { ...this.defaultNumberMaskConfig, ...maskConfig };
		return { mask: <any>createNumberMask(numberMaskConfig) };
	}

	private getInputElement(): HTMLInputElement | undefined {
		const nativeElement = this.elementRef.nativeElement;
		if (nativeElement instanceof HTMLInputElement) {
			return nativeElement;
		}

		return nativeElement.getElementsByTagName("INPUT")[0];
	}

	private getUnmaskedValue(value: string, maskConfig: StarkNumberMaskConfig | undefined = this.appliedMaskConfig): string {
		if (!value) {
			return "";
		}

		if (typeof maskConfig === "undefined") {
			return value;
		}

		const normalizedMaskConfig: StarkNumberMaskConfig = { ...this.defaultNumberMaskConfig, ...maskConfig };
		let rawValue = value;
		const prefix = normalizedMaskConfig.prefix || "";
		const suffix = normalizedMaskConfig.suffix || "";

		if (prefix && rawValue.startsWith(prefix)) {
			rawValue = rawValue.slice(prefix.length);
		}

		if (suffix && rawValue.endsWith(suffix)) {
			rawValue = rawValue.slice(0, rawValue.length - suffix.length);
		}

		if (normalizedMaskConfig.includeThousandsSeparator !== false && normalizedMaskConfig.thousandsSeparatorSymbol) {
			rawValue = rawValue.split(normalizedMaskConfig.thousandsSeparatorSymbol).join("");
		}

		if (normalizedMaskConfig.allowDecimal && normalizedMaskConfig.decimalSymbol && normalizedMaskConfig.decimalSymbol !== ".") {
			rawValue = rawValue.split(normalizedMaskConfig.decimalSymbol).join(".");
		}

		rawValue = rawValue.replace(/[^0-9.-]+/g, "");
		return this.normalizeSignedDecimalValue(rawValue, normalizedMaskConfig);
	}

	private normalizeSignedDecimalValue(rawValue: string, normalizedMaskConfig: StarkNumberMaskConfig): string {
		if (!normalizedMaskConfig.allowNegative) {
			rawValue = rawValue.replace(/-/g, "");
		} else {
			rawValue = rawValue.replace(/(?!^)-/g, "");
		}

		if (!normalizedMaskConfig.allowDecimal) {
			return rawValue.replace(/\./g, "");
		}

		const firstDecimalSeparatorIndex = rawValue.indexOf(".");
		if (firstDecimalSeparatorIndex !== -1) {
			rawValue =
				rawValue.slice(0, firstDecimalSeparatorIndex + 1) + rawValue.slice(firstDecimalSeparatorIndex + 1).replace(/\./g, "");
		}

		return rawValue;
	}
}
