import { Directive, ElementRef, forwardRef, Inject, Input, OnChanges, Optional, Provider, Renderer2, SimpleChanges } from "@angular/core";
import { COMPOSITION_BUFFER_MODE, NG_VALUE_ACCESSOR } from "@angular/forms";
import { emailMask } from "text-mask-addons";
import { MaskedInputDirective, TextMaskConfig as Ng2TextMaskConfig } from "angular2-text-mask";
import { BooleanInput } from "@angular/cdk/coercion";

/**
 * @ignore
 */
const directiveName = "[starkEmailMask]";

/**
 * @ignore
 */
export const STARK_EMAIL_MASK_VALUE_ACCESSOR: Provider = {
	provide: NG_VALUE_ACCESSOR,

	useExisting: forwardRef(() => StarkEmailMaskDirective),
	multi: true
};

/**
 * Directive to display an email mask in input elements. This directive internally uses the {@link https://github.com/text-mask/text-mask/tree/master/core|text-mask-core} library
 * to provide the input mask functionality.
 *
 * **`IMPORTANT:`** Currently the Email Mask supports only input of type text, tel, url, password, and search.
 * Due to a limitation in browser API, other input types, such as email or number, cannot be supported.
 *
 * ### Disabling the mask
 * Passing `false` to the directive will disable the mask: `<input type="text" [starkEmailMask]="false">`
 *
 * @example
 * <input type="text" starkEmailMask> <!-- without config the mask will also be displayed -->
 * <!-- or -->
 * <input type="text" [starkEmailMask]="yourMaskConfig">
 * <!-- or -->
 * <input type="text" [(ngModel)]="yourModelValue" starkEmailMask>
 * <!-- or -->
 * <input type="text" [(ngModel)]="yourModelValue" [starkEmailMask]="yourMaskConfig">
 * <!-- or -->
 * <input type="text" [formControl]="yourFormControl" starkEmailMask>
 * <!-- or -->
 * <input type="text" [formControl]="yourFormControl" [starkEmailMask]="yourMaskConfig">
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
	exportAs: "starkEmailMask",
	providers: [STARK_EMAIL_MASK_VALUE_ACCESSOR]
})
export class StarkEmailMaskDirective extends MaskedInputDirective implements OnChanges {
	/**
	 * Whether to display the email mask in the input field.
	 */
	/* eslint-disable @angular-eslint/no-input-rename */
	@Input("starkEmailMask")
	public maskConfig = true; // enabled by default

	/**
	 * @ignore
	 */
	private elementRef: ElementRef;

	/**
	 * Latest user-entered value before masking is applied.
	 */
	private lastUnmaskedValue = "";

	/**
	 * Accepts template-side boolean coercion for the `starkEmailMask` input.
	 */
	// Information about boolean coercion https://angular.io/guide/template-typecheck#input-setter-coercion
	public static ngAcceptInputType_maskConfig: BooleanInput;

	/**
	 * Class constructor
	 * @param _renderer - Angular `Renderer2` wrapper for DOM manipulations.
	 * @param _elementRef - Reference to the DOM element where this directive is applied to.
	 * @param _compositionMode  - Injected token to control if form directives buffer IME input until the "compositionend" event occurs.
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
		const previousDisplayedValue = inputElement?.value || "";
		const currentUnmaskedValue = this.getCurrentUnmaskedValue(inputElement);

		this.textMaskConfig = this.normalizeMaskConfig(this.maskConfig);

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

			const nextDisplayedValue = inputElement?.value || "";
			if (inputElement && nextDisplayedValue !== previousDisplayedValue) {
				this.onChange(nextDisplayedValue);
			}
		}

		this.lastUnmaskedValue = currentUnmaskedValue;
	}

	/**
	 * Writes the model value to the host input while preserving unmasked state when the directive is disabled.
	 * @param value - The incoming Angular forms value.
	 */
	public override writeValue(value: any): void {
		const normalizedValue = String(value ?? "");
		this.lastUnmaskedValue = normalizedValue;

		if (this.textMaskConfig.mask === false) {
			const inputElement = this.getInputElement();
			if (inputElement) {
				inputElement.value = normalizedValue;
			}
			return;
		}

		super.writeValue(value);
	}

	/**
	 * Tracks the latest typed value and forwards it through the mask pipeline when enabled.
	 * @param value - The raw value emitted by the host input.
	 */
	public override _handleInput(value: string): void {
		if (this.textMaskConfig.mask === false) {
			this.lastUnmaskedValue = value || "";
			this.onChange(this.lastUnmaskedValue);
			return;
		}

		this.lastUnmaskedValue = value || "";
		super._handleInput(value);
	}

	/**
	 * Create a valid configuration to be passed to the MaskedInputDirective
	 * @param maskConfig - The provided configuration via the directive's input
	 */
	public normalizeMaskConfig(maskConfig: boolean = true): Ng2TextMaskConfig {
		// in case the directive is used without inputs: "<input type='text' starkEmailMask>" the maskConfig becomes an empty string ''
		// therefore "undefined" or string values will also enable the mask
		maskConfig = typeof maskConfig !== "boolean" ? true : maskConfig;

		if (!maskConfig) {
			return { mask: false }; // remove the mask
		}

		// TODO: Ng2TextMaskConfig is not the same as Core TextMaskConfig
		// even though emailMask is passed as a mask, it is actually made of both a mask and a pipe bundled together for convenience
		// https://github.com/text-mask/text-mask/tree/master/addons
		const { mask, pipe } = <{ mask: Ng2TextMaskConfig["mask"]; pipe?: Ng2TextMaskConfig["pipe"] }>emailMask;
		return { mask: mask, pipe: pipe };
	}

	private getInputElement(): HTMLInputElement | undefined {
		const nativeElement = this.elementRef.nativeElement;
		if (nativeElement instanceof HTMLInputElement) {
			return nativeElement;
		}

		return nativeElement.getElementsByTagName("INPUT")[0];
	}

	private getCurrentUnmaskedValue(inputElement?: HTMLInputElement): string {
		if (this.textMaskConfig.mask === false) {
			return inputElement?.value || this.lastUnmaskedValue;
		}

		return this.lastUnmaskedValue || inputElement?.value || "";
	}
}
