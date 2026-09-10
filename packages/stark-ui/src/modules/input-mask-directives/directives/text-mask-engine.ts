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
	let previousPlaceholder = "";

	return {
		update(value?: unknown): void {
			const rawValue = normalizeValue(typeof value === "undefined" ? config.inputElement.value : value);
			if (rawValue === previousConformedValue || config.mask === false) {
				return;
			}

			const placeholderChar = config.placeholderChar || "_";
			const currentCaretPosition = config.inputElement.selectionEnd ?? rawValue.length;
			const { caretTrapIndexes, mask } = resolveMask(config.mask, rawValue, {
				currentCaretPosition,
				placeholderChar,
				previousConformedValue
			});
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
			let indexesOfPipedChars: readonly number[] = [];
			if (config.pipe) {
				const pipeResult = applyPipe(config.pipe, conformedValue, {
					...config,
					...conformConfig,
					mask: config.mask,
					rawValue
				});
				conformedValue = pipeResult.value;
				indexesOfPipedChars = pipeResult.indexesOfPipedChars;
			}

			const adjustedCaretPosition = adjustCaretPosition({
				caretTrapIndexes,
				conformedValue,
				currentCaretPosition,
				indexesOfPipedChars,
				placeholder,
				placeholderChar,
				previousConformedValue,
				previousPlaceholder,
				rawValue
			});
			const inputValue = conformedValue === placeholder ? (config.showMask ? placeholder : "") : conformedValue;
			previousConformedValue = inputValue;
			previousPlaceholder = placeholder;
			if (config.inputElement.value !== inputValue) {
				config.inputElement.value = inputValue;
				setCaretPosition(config.inputElement, adjustedCaretPosition);
			}
		}
	};
}

/**
 * Resolves a static or dynamic mask and removes caret-only markers.
 * @param mask - Static token list or mask factory.
 * @param rawValue - Current unmasked input value.
 * @param config - Context supplied to a dynamic mask factory.
 * @param config.currentCaretPosition - Current input caret position.
 * @param config.placeholderChar - Character used for editable placeholder positions.
 * @param config.previousConformedValue - Previously accepted masked value.
 */
function resolveMask(
	mask: StarkMask,
	rawValue: string,
	config: { readonly currentCaretPosition: number; readonly placeholderChar: string; readonly previousConformedValue: string }
): { readonly caretTrapIndexes: readonly number[]; readonly mask: StarkMaskArray } {
	const resolvedMask = [...(typeof mask === "function" ? mask(rawValue, config) : mask)];
	const caretTrapIndexes: number[] = [];
	let caretTrapIndex = resolvedMask.indexOf(CARET_TRAP);
	while (caretTrapIndex !== -1) {
		caretTrapIndexes.push(caretTrapIndex);
		resolvedMask.splice(caretTrapIndex, 1);
		caretTrapIndex = resolvedMask.indexOf(CARET_TRAP);
	}
	return { caretTrapIndexes, mask: resolvedMask };
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
function applyPipe(
	pipe: StarkPipeFunction,
	value: string,
	config: RuntimePipeConfig
): { readonly value: string; readonly indexesOfPipedChars: readonly number[] } {
	const result = pipe(value, config);
	if (result === false) {
		return { value: config.previousConformedValue, indexesOfPipedChars: [] };
	}
	if (typeof result === "string") {
		return { value: result, indexesOfPipedChars: [] };
	}
	return { value: result.value, indexesOfPipedChars: result.indexesOfPipedChars ?? [] };
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
 * Reproduces text-mask's edit-aware caret contract. A simple "next placeholder"
 * search loses the insertion point after a rejected character and while a
 * dynamic mask grows (notably the email mask).
 * @param config - Previous and current edit state used to place the caret.
 * @param config.previousConformedValue - Previously accepted masked value.
 * @param config.previousPlaceholder - Placeholder used for the previous mask.
 * @param config.currentCaretPosition - Caret position reported by the input event.
 * @param config.conformedValue - Newly accepted masked value.
 * @param config.rawValue - Raw input value before conformance.
 * @param config.placeholderChar - Character used for editable placeholder positions.
 * @param config.placeholder - Placeholder generated from the current mask.
 * @param config.indexesOfPipedChars - Character indexes inserted by a pipe function.
 * @param config.caretTrapIndexes - Preferred caret positions supplied by a dynamic mask.
 */
// eslint-disable-next-line complexity, sonarjs/cognitive-complexity -- Caret placement depends on the complete previous/current edit state.
function adjustCaretPosition(config: {
	readonly previousConformedValue: string;
	readonly previousPlaceholder: string;
	readonly currentCaretPosition: number;
	readonly conformedValue: string;
	readonly rawValue: string;
	readonly placeholderChar: string;
	readonly placeholder: string;
	readonly indexesOfPipedChars: readonly number[];
	readonly caretTrapIndexes: readonly number[];
}): number {
	const {
		previousConformedValue,
		previousPlaceholder,
		currentCaretPosition,
		conformedValue,
		rawValue,
		placeholderChar,
		placeholder,
		indexesOfPipedChars,
		caretTrapIndexes
	} = config;
	if (currentCaretPosition === 0 || rawValue.length === 0) {
		return 0;
	}

	const editLength = rawValue.length - previousConformedValue.length;
	const isAddition = editLength > 0;
	const isFirstRawValue = previousConformedValue.length === 0;
	if (editLength > 1 && !isAddition && !isFirstRawValue) {
		return currentCaretPosition;
	}

	const possiblyHasRejectedChar = isAddition && (previousConformedValue === conformedValue || conformedValue === placeholder);
	let startingSearchIndex = 0;
	let trackRightCharacter = false;
	let targetChar: string | undefined;

	if (possiblyHasRejectedChar) {
		startingSearchIndex = currentCaretPosition - editLength;
	} else {
		const normalizedConformedValue = conformedValue.toLowerCase();
		const normalizedRawValue = rawValue.toLowerCase();
		const intersection = normalizedRawValue
			.slice(0, currentCaretPosition)
			.split("")
			.filter((character) => normalizedConformedValue.includes(character));
		targetChar = intersection.at(-1);

		const previousLeftMaskChars = previousPlaceholder
			.slice(0, intersection.length)
			.split("")
			.filter((character) => character !== placeholderChar).length;
		const leftMaskChars = placeholder
			.slice(0, intersection.length)
			.split("")
			.filter((character) => character !== placeholderChar).length;
		const targetIsMaskMovingLeft =
			typeof previousPlaceholder[intersection.length - 1] !== "undefined" &&
			typeof placeholder[intersection.length - 2] !== "undefined" &&
			previousPlaceholder[intersection.length - 1] !== placeholderChar &&
			previousPlaceholder[intersection.length - 1] !== placeholder[intersection.length - 1] &&
			previousPlaceholder[intersection.length - 1] === placeholder[intersection.length - 2];

		if (
			!isAddition &&
			(leftMaskChars !== previousLeftMaskChars || targetIsMaskMovingLeft) &&
			previousLeftMaskChars > 0 &&
			typeof targetChar !== "undefined" &&
			placeholder.includes(targetChar) &&
			typeof rawValue[currentCaretPosition] !== "undefined"
		) {
			trackRightCharacter = true;
			targetChar = rawValue[currentCaretPosition];
		}

		const countTargetCharInPipedChars = indexesOfPipedChars
			.map((index) => normalizedConformedValue[index])
			.filter((character) => character === targetChar).length;
		const countTargetCharInIntersection = intersection.filter((character) => character === targetChar).length;
		const firstPlaceholderIndex = placeholder.indexOf(placeholderChar);
		const countTargetCharInPlaceholder = placeholder
			.slice(0, firstPlaceholderIndex === -1 ? 0 : firstPlaceholderIndex)
			.split("")
			.filter((character, index) => character === targetChar && rawValue[index] !== character).length;
		const requiredNumberOfMatches =
			countTargetCharInPlaceholder + countTargetCharInIntersection + countTargetCharInPipedChars + Number(trackRightCharacter);

		let numberOfEncounteredMatches = 0;
		for (let index = 0; index < conformedValue.length; index++) {
			startingSearchIndex = index + 1;
			if (normalizedConformedValue[index] === targetChar) {
				numberOfEncounteredMatches++;
			}
			if (numberOfEncounteredMatches >= requiredNumberOfMatches) {
				break;
			}
		}
	}

	if (isAddition) {
		let lastPlaceholderIndex = startingSearchIndex;
		for (let index = startingSearchIndex; index <= placeholder.length; index++) {
			if (placeholder[index] === placeholderChar) {
				lastPlaceholderIndex = index;
			}
			if (placeholder[index] === placeholderChar || caretTrapIndexes.includes(index) || index === placeholder.length) {
				return lastPlaceholderIndex;
			}
		}
	} else if (trackRightCharacter) {
		for (let index = startingSearchIndex - 1; index >= 0; index--) {
			if (conformedValue[index] === targetChar || caretTrapIndexes.includes(index) || index === 0) {
				return index;
			}
		}
	} else {
		for (let index = startingSearchIndex; index >= 0; index--) {
			if (placeholder[index - 1] === placeholderChar || caretTrapIndexes.includes(index) || index === 0) {
				return index;
			}
		}
	}

	return currentCaretPosition;
}

/**
 * Moves the caret when the masked input currently owns focus.
 * @param element - Input whose selection should be updated.
 * @param position - Collapsed selection position.
 */
function setCaretPosition(element: HTMLInputElement, position: number): void {
	if (typeof document === "undefined" || document.activeElement !== element) {
		return;
	}

	element.setSelectionRange(position, position, "none");
}
