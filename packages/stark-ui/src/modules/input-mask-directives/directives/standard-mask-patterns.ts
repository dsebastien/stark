import {
	StarkMaskArray,
	StarkMaskFunction,
	StarkMaskFunctionConfig,
	StarkPipeFunction,
	StarkTextMaskConfig
} from "./text-mask-config.intf";
import { StarkNumberMaskConfig } from "./number-mask-config.intf";

/** Pattern matching a single decimal digit. */
const DIGIT = /\d/;

/** Marker used to keep caret movement stable around generated separators. */
const CARET_TRAP = "[]";

interface StarkEmailPipeConfig extends StarkTextMaskConfig {
	currentCaretPosition: number;
	previousConformedValue: string;
	rawValue: string;
}

/**
 * Creates the dynamic mask used by Stark's number-mask directive.
 * @param config - Number formatting and mask options.
 */
export function createStarkNumberMask(config: StarkNumberMaskConfig = {}): StarkMaskFunction {
	const {
		prefix = "$",
		suffix = "",
		includeThousandsSeparator = true,
		thousandsSeparatorSymbol = ",",
		allowDecimal = false,
		decimalSymbol = ".",
		decimalLimit = 2,
		requireDecimal = false,
		allowNegative = false,
		allowLeadingZeroes = false,
		integerLimit
	} = config;

	// eslint-disable-next-line complexity, sonarjs/cognitive-complexity -- Number-mask compatibility requires interdependent formatting options.
	return (input: string = ""): StarkMaskArray => {
		if (!input || (input[0] === prefix[0] && input.length === 1)) {
			return [...prefix, DIGIT, ...suffix];
		}
		if (input === decimalSymbol && allowDecimal) {
			return [...prefix, "0", decimalSymbol, DIGIT, ...suffix];
		}

		const negative = input.startsWith("-") && allowNegative;
		let rawValue = negative ? input.slice(1) : input;
		if (suffix && rawValue.endsWith(suffix)) {
			rawValue = rawValue.slice(0, -suffix.length);
		}

		const decimalIndex = rawValue.lastIndexOf(decimalSymbol);
		const hasDecimal = decimalIndex !== -1;
		let integer =
			hasDecimal && (allowDecimal || requireDecimal)
				? rawValue.slice(rawValue.startsWith(prefix) ? prefix.length : 0, decimalIndex)
				: rawValue.startsWith(prefix)
					? rawValue.slice(prefix.length)
					: rawValue;
		let fraction = hasDecimal && (allowDecimal || requireDecimal) ? rawValue.slice(decimalIndex + 1).replace(/\D+/g, "") : "";

		if (typeof integerLimit === "number") {
			const separators = integer.split(thousandsSeparatorSymbol).length - 1;
			integer = integer.slice(0, integerLimit + separators * thousandsSeparatorSymbol.length);
		}
		integer = integer.replace(/\D+/g, "");
		if (!allowLeadingZeroes) {
			integer = integer.replace(/^0+(0$|[^0])/, "$1");
		}
		if (includeThousandsSeparator) {
			integer = integer.replace(/\B(?=(\d{3})+(?!\d))/g, thousandsSeparatorSymbol);
		}

		let mask = toDigitMask(integer);
		if ((hasDecimal && allowDecimal) || requireDecimal) {
			if (rawValue[decimalIndex - 1] !== decimalSymbol) {
				mask.push(CARET_TRAP);
			}
			mask.push(decimalSymbol, CARET_TRAP);
			fraction = fraction.slice(0, decimalLimit);
			mask.push(...toDigitMask(fraction));
			if (requireDecimal && rawValue[decimalIndex - 1] === decimalSymbol) {
				mask.push(DIGIT);
			}
		}
		mask = [...prefix, ...mask];
		if (negative) {
			if (mask.length === prefix.length) {
				mask.push(DIGIT);
			}
			mask.unshift(/-/);
		}
		mask.push(...suffix);
		return mask;
	};
}

export const starkEmailMask: { mask: StarkMaskFunction; pipe: StarkPipeFunction } = {
	mask: (input: string, config?: StarkMaskFunctionConfig): StarkMaskArray => {
		const rawValue = input.replace(/\s/g, "");
		const placeholderChar = config?.placeholderChar ?? "_";
		const currentCaretPosition = config?.currentCaretPosition ?? rawValue.length;
		const atIndex = rawValue.indexOf("@");
		const lastDot = rawValue.lastIndexOf(".");
		const topLevelDot = lastDot < atIndex ? -1 : lastDot;
		const local = atIndex === -1 ? rawValue : rawValue.slice(0, atIndex);
		let domain = atIndex === -1 ? "" : rawValue.slice(atIndex + 1, topLevelDot === -1 ? rawValue.length : topLevelDot);
		let topLevelDomain = topLevelDot === -1 ? "" : rawValue.slice(topLevelDot + 1);
		domain = domain.replace(new RegExp(`[\\s${placeholderChar}]`, "g"), "");
		topLevelDomain = topLevelDomain.replace(new RegExp(`[\\s${placeholderChar}.]`, "g"), "");
		if (domain === "@") {
			domain = "*";
		} else if (domain.length < 1) {
			domain = " ";
		} else if (domain.endsWith(".")) {
			domain = domain.slice(0, -1);
		}
		if (topLevelDomain.length === 0 && rawValue[topLevelDot - 1] === "." && currentCaretPosition !== rawValue.length) {
			topLevelDomain = "*";
		}

		return [
			...toCharacterMask(local, false),
			...emailConnector(rawValue, atIndex + 1, "@"),
			...toCharacterMask(domain, false),
			...emailConnector(rawValue, topLevelDot - 1, "."),
			...toCharacterMask(topLevelDomain, true)
		];
	},
	pipe: (value: string, config: StarkTextMaskConfig): false | string => {
		let normalized = value.replace(/@/g, (match, offset) => (offset === value.indexOf("@") ? match : ""));
		const runtimeConfig: StarkEmailPipeConfig = <StarkEmailPipeConfig>(<unknown>config);
		const rawValue = String(runtimeConfig.rawValue || "");
		const currentCaretPosition = runtimeConfig.currentCaretPosition;
		const previousValue = runtimeConfig.previousConformedValue;
		const placeholderChar = config.placeholderChar || "_";
		if (!new RegExp(`[^@\\s.${placeholderChar}]`).test(rawValue)) {
			return "";
		}
		const atDotIndex = normalized.indexOf("@.");
		if (
			normalized.includes("..") ||
			(atDotIndex !== -1 && currentCaretPosition !== atDotIndex + 1) ||
			(!rawValue.includes("@") && previousValue !== "" && rawValue.includes("."))
		) {
			return false;
		}
		const domain = normalized.slice(normalized.indexOf("@") + 1);
		if ((domain.match(/\./g) || []).length > 1 && normalized.endsWith(".") && currentCaretPosition !== rawValue.length) {
			normalized = normalized.slice(0, -1);
		}
		return normalized;
	}
};

/**
 * Keeps an email separator literal in the dynamic mask and surrounds it with caret traps.
 * @param rawValue - Current unmasked input value.
 * @param connectionIndex - Index at which the separator is expected.
 * @param connectionSymbol - Email separator to preserve.
 */
function emailConnector(rawValue: string, connectionIndex: number, connectionSymbol: string): StarkMaskArray {
	return rawValue[connectionIndex] === connectionSymbol ? [connectionSymbol, CARET_TRAP] : [CARET_TRAP, connectionSymbol, CARET_TRAP];
}

/**
 * Converts numeric characters into reusable digit-mask tokens.
 * @param value - Value whose digits should become editable tokens.
 */
function toDigitMask(value: string): StarkMaskArray {
	return [...value].map((character) => (/\d/.test(character) ? DIGIT : character));
}

/**
 * Converts literal input into character-mask tokens with optional dot rejection.
 * @param value - Value whose characters should become editable tokens.
 * @param disallowDots - Whether the generated character tokens should reject dots.
 */
function toCharacterMask(value: string, disallowDots: boolean): StarkMaskArray {
	return [...value].map((character) => (character === " " ? character : disallowDots ? /[^.\s]/ : /[^\s]/));
}
