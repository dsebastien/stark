import { StarkMask, StarkMaskArray, StarkPipeFunction, StarkTextMaskConfig } from "./text-mask-config.intf";

export interface StarkTextMaskEngineConfig extends Omit<StarkTextMaskConfig, "mask"> {
	inputElement: HTMLInputElement;
	mask: StarkMask | false;
	showMask?: boolean;
}

export interface StarkTextMaskInputElement {
	update(value?: unknown): void;
}

interface ConformConfig {
	currentCaretPosition: number;
	guide: boolean;
	keepCharPositions: boolean;
	placeholder: string;
	placeholderChar: string;
	previousConformedValue: string;
}

interface RuntimePipeConfig extends StarkTextMaskConfig {
	currentCaretPosition: number;
	placeholder: string;
	previousConformedValue: string;
	rawValue: string;
}

/** Marker emitted by dynamic masks to influence caret placement without rendering a character. */
const CARET_TRAP = "[]";

/**
 * Creates a stateful mask controller for one input element.
 * @param config - Element, mask, and display configuration.
 */
export function createStarkTextMaskInputElement(config: StarkTextMaskEngineConfig): StarkTextMaskInputElement {
	let previousConformedValue = "";

	return {
		update(value?: unknown): void {
			const rawValue = normalizeValue(typeof value === "undefined" ? config.inputElement.value : value);
			if (rawValue === previousConformedValue || config.mask === false) {
				return;
			}

			const currentCaretPosition = config.inputElement.selectionEnd ?? rawValue.length;
			const mask = resolveMask(config.mask, rawValue);
			const placeholderChar = config.placeholderChar || "_";
			const placeholder = convertMaskToPlaceholder(mask, placeholderChar);
			const conformConfig: ConformConfig = {
				currentCaretPosition,
				guide: config.guide !== false,
				keepCharPositions: config.keepCharPositions === true,
				placeholder,
				placeholderChar,
				previousConformedValue
			};

			let conformedValue = conformToMask(rawValue, mask, conformConfig);
			if (config.pipe) {
				conformedValue = applyPipe(config.pipe, conformedValue, {
					...config,
					...conformConfig,
					mask: config.mask,
					rawValue
				});
			}

			const inputValue = conformedValue === placeholder ? (config.showMask ? placeholder : "") : conformedValue;
			previousConformedValue = inputValue;
			if (config.inputElement.value !== inputValue) {
				config.inputElement.value = inputValue;
				setCaretPosition(config.inputElement, inputValue, placeholderChar, currentCaretPosition);
			}
		}
	};
}

/**
 * Resolves a static or dynamic mask and removes caret-only markers.
 * @param mask - Static token list or mask factory.
 * @param rawValue - Current unmasked input value.
 */
function resolveMask(mask: StarkMask, rawValue: string): StarkMaskArray {
	const resolvedMask = typeof mask === "function" ? mask(rawValue) : mask;
	return resolvedMask.filter((token) => token !== CARET_TRAP);
}

/**
 * Builds the display placeholder represented by a mask.
 * @param mask - Resolved mask tokens.
 * @param placeholderChar - Character rendered for unfilled editable tokens.
 */
function convertMaskToPlaceholder(mask: StarkMaskArray, placeholderChar: string): string {
	if (mask.includes(placeholderChar)) {
		throw new Error(`The placeholder character ${JSON.stringify(placeholderChar)} cannot be a static mask character.`);
	}

	return mask.map((token) => (token instanceof RegExp ? placeholderChar : token)).join("");
}

/**
 * Conforms raw input to a resolved mask while preserving edit and caret semantics.
 * @param rawValue - Current input value.
 * @param mask - Resolved mask tokens.
 * @param config - Current and previous edit state.
 */
// eslint-disable-next-line complexity, sonarjs/cognitive-complexity -- Text-mask compatibility requires a stateful character-placement algorithm.
function conformToMask(rawValue: string, mask: StarkMaskArray, config: ConformConfig): string {
	const { currentCaretPosition, guide, keepCharPositions, placeholder, placeholderChar, previousConformedValue } = config;
	const suppressGuide = !guide;
	const editDistance = rawValue.length - previousConformedValue.length;
	const isAddition = editDistance > 0;
	const indexOfFirstChange = Math.max(0, currentCaretPosition + (isAddition ? -editDistance : 0));
	const indexOfLastChange = indexOfFirstChange + Math.abs(editDistance);

	if (keepCharPositions && !isAddition) {
		let compensatingPlaceholders = "";
		for (let index = indexOfFirstChange; index < indexOfLastChange; index++) {
			if (placeholder[index] === placeholderChar) {
				compensatingPlaceholders += placeholderChar;
			}
		}
		rawValue = `${rawValue.slice(0, indexOfFirstChange)}${compensatingPlaceholders}${rawValue.slice(indexOfFirstChange)}`;
	}

	const characters = rawValue.split("").map((char, index) => ({
		char,
		isNew: index >= indexOfFirstChange && index < indexOfLastChange
	}));

	for (let index = rawValue.length - 1; index >= 0; index--) {
		const character = characters[index]?.char;
		if (character !== placeholderChar) {
			const offset = index >= indexOfFirstChange && previousConformedValue.length === mask.length ? editDistance : 0;
			if (character === placeholder[index - offset]) {
				characters.splice(index, 1);
			}
		}
	}

	let conformedValue = "";
	placeholderLoop: for (let index = 0; index < placeholder.length; index++) {
		if (placeholder[index] !== placeholderChar) {
			conformedValue += placeholder[index];
			continue;
		}

		while (characters.length > 0) {
			const characterData = characters.shift();
			if (!characterData) {
				break;
			}
			if (characterData.char === placeholderChar && !suppressGuide) {
				conformedValue += placeholderChar;
				continue placeholderLoop;
			}

			const pattern = mask[index];
			if (pattern instanceof RegExp && testPattern(pattern, characterData.char)) {
				if (!keepCharPositions || !characterData.isNew || !previousConformedValue || !guide || !isAddition) {
					conformedValue += characterData.char;
					continue placeholderLoop;
				}

				const nextPlaceholderIndex = characters.findIndex((item) => item.char === placeholderChar);
				const blockedIndex = characters.findIndex((item) => item.char !== placeholderChar && !item.isNew);
				if (nextPlaceholderIndex !== -1 && (blockedIndex === -1 || nextPlaceholderIndex < blockedIndex)) {
					conformedValue += characterData.char;
					characters.splice(nextPlaceholderIndex, 1);
					continue placeholderLoop;
				}
				index--;
			}
		}

		if (!suppressGuide) {
			conformedValue += placeholder.slice(index);
		}
		break;
	}

	if (suppressGuide && !isAddition) {
		let lastFilledPosition = -1;
		for (let index = 0; index < conformedValue.length; index++) {
			if (placeholder[index] === placeholderChar) {
				lastFilledPosition = index;
			}
		}
		conformedValue = lastFilledPosition === -1 ? "" : conformedValue.slice(0, lastFilledPosition + 1);
	}

	return conformedValue;
}

/**
 * Applies an optional public pipe result to the conformed mask value.
 * @param pipe - Consumer-provided value transformation.
 * @param value - Conformed value before the pipe runs.
 * @param config - Runtime mask state passed to the pipe.
 */
function applyPipe(pipe: StarkPipeFunction, value: string, config: RuntimePipeConfig): string {
	const result = pipe(value, config);
	if (result === false) {
		return config.previousConformedValue;
	}
	if (typeof result === "string") {
		return result;
	}
	return result.value;
}

/**
 * Converts supported form values to the string representation consumed by the mask engine.
 * @param value - Form value to normalize.
 */
function normalizeValue(value: unknown): string {
	if (typeof value === "string" || typeof value === "number") {
		return String(value);
	}
	if (typeof value === "undefined" || (typeof value === "object" && !value)) {
		return "";
	}
	throw new Error(`Mask values must be strings or numbers. Received ${JSON.stringify(value)}.`);
}

/**
 * Tests a mask pattern without leaking state from global or sticky regular expressions.
 * @param pattern - Editable-token expression.
 * @param value - Character to test.
 */
function testPattern(pattern: RegExp, value: string): boolean {
	pattern.lastIndex = 0;
	return pattern.test(value);
}

/**
 * Moves the caret to the next editable character when the input currently has focus.
 * @param element - Masked input element.
 * @param value - Conformed input value.
 * @param placeholderChar - Character identifying unfilled editable positions.
 * @param currentPosition - Caret position before the update.
 */
function setCaretPosition(element: HTMLInputElement, value: string, placeholderChar: string, currentPosition: number): void {
	if (typeof document === "undefined" || document.activeElement !== element) {
		return;
	}

	const nextPlaceholder = value.indexOf(placeholderChar, Math.max(0, currentPosition));
	const position = nextPlaceholder === -1 ? value.length : nextPlaceholder;
	element.setSelectionRange(position, position, "none");
}
