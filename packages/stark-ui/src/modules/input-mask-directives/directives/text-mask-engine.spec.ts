import { starkEmailMask } from "./standard-mask-patterns";
import { createStarkTextMaskInputElement, StarkTextMaskInputElement } from "./text-mask-engine";

function typeSequentially(input: HTMLInputElement, controller: StarkTextMaskInputElement, value: string): void {
	input.focus();
	for (const character of value) {
		const selectionStart = input.selectionStart ?? input.value.length;
		const selectionEnd = input.selectionEnd ?? selectionStart;
		input.setRangeText(character, selectionStart, selectionEnd, "end");
		controller.update(input.value);
	}
}

describe("text mask engine", () => {
	let input: HTMLInputElement;

	beforeEach(() => {
		input = document.createElement("input");
		document.body.appendChild(input);
	});

	afterEach(() => input.remove());

	it("keeps the caret aligned after rejecting a character in a fixed-position mask", () => {
		const digit = /\d/;
		const controller = createStarkTextMaskInputElement({
			inputElement: input,
			mask: [
				digit,
				digit,
				digit,
				digit,
				"-",
				digit,
				digit,
				digit,
				digit,
				"-",
				digit,
				digit,
				digit,
				digit,
				"-",
				digit,
				digit,
				digit,
				digit
			],
			guide: true,
			keepCharPositions: true,
			placeholderChar: "_"
		});

		typeSequentially(input, controller, "1234A567812345678");

		expect(input.value).toBe("1234-5678-1234-5678");
	});

	it("keeps the caret aligned while a dynamic email mask grows", () => {
		const controller = createStarkTextMaskInputElement({
			inputElement: input,
			mask: starkEmailMask.mask,
			pipe: starkEmailMask.pipe,
			guide: true,
			keepCharPositions: false,
			placeholderChar: "_"
		});

		typeSequentially(input, controller, "test@example.com");

		expect(input.value).toBe("test@example.com");
	});
});
