export type StarkMaskArray = Array<string | RegExp>;
export type StarkMaskFunction = (raw: string) => StarkMaskArray;
export interface StarkPipeResultObject {
	value: string;
	indexesOfPipedChars?: number[];
}
export type StarkPipeFunction = (conformedValue: string, config: StarkTextMaskConfig) => false | string | StarkPipeResultObject;
export type StarkMask = StarkMaskArray | StarkMaskFunction;

/**
 * Defines the base configuration for the mask directives provided by Stark-UI.
 */
export interface StarkTextMaskBaseConfig {
	/**
	 * Whether to show the mask while the user is typing in the input field in order to guide him.
	 *
	 * Default: `true`.
	 *
	 */
	guide?: boolean;

	/**
	 * Placeholder character represents the fillable spot in the mask.
	 *
	 * Default: `"_"`.
	 *
	 */
	placeholderChar?: string;

	/**
	 * Whether to keep the spaces used by character after they are added/deleted.
	 *
	 * Default: `true`.
	 *
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
	 */
	mask: StarkMask | false;

	/**
	 * Function that can modify the conformed value before it is displayed on the screen.
	 *
	 */
	pipe?: StarkPipeFunction;
}
