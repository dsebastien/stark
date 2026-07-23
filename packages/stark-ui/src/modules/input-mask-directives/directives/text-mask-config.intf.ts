type StarkMaskArray = Array<string | RegExp>;
type StarkMaskFunction = (raw: string) => StarkMaskArray;
interface StarkPipeResultObject {
	value: string;
	indexesOfPipedChars?: number[];
}
type StarkPipeFunction = (conformedValue: string, config: StarkTextMaskConfig) => false | string | StarkPipeResultObject;
type StarkMask = StarkMaskArray | StarkMaskFunction;

/**
 * Defines the base configuration for the mask directives provided by Stark-UI.
 */
export interface StarkTextMaskBaseConfig {
	/**
	 * Whether to show the mask while the user is typing in the input field in order to guide him.
	 *
	 * Default: `true`.
	 *
	 * See {@link https://github.com/text-mask/text-mask/blob/master/componentDocumentation.md#guide}
	 */
	guide?: boolean;

	/**
	 * Placeholder character represents the fillable spot in the mask.
	 *
	 * Default: `"_"`.
	 *
	 * See {@link https://github.com/text-mask/text-mask/blob/master/componentDocumentation.md#placeholderchar}
	 */
	placeholderChar?: string;

	/**
	 * Whether to keep the spaces used by character after they are added/deleted.
	 *
	 * Default: `true`.
	 *
	 * See {@link https://github.com/text-mask/text-mask/blob/master/componentDocumentation.md#keepcharpositions}
	 */
	keepCharPositions?: boolean;
}

/**
 * Defines the configuration object for the {@link StarkTextMaskDirective}.
 */
export interface StarkTextMaskConfig extends StarkTextMaskBaseConfig {
	/**
	 * Array or a function that defines how the user input is going to be masked. If is set to `false`, the mask will be removed.
	 *
	 * See {@link https://github.com/text-mask/text-mask/blob/master/componentDocumentation.md#mask}
	 */
	mask: StarkMask | false;

	/**
	 * Function that can modify the conformed value before it is displayed on the screen.
	 *
	 * See {@link https://github.com/text-mask/text-mask/blob/master/componentDocumentation.md#pipe}
	 */
	pipe?: StarkPipeFunction;
}
