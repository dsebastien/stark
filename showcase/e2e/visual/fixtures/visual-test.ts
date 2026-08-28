import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test as base, type Page } from "@playwright/test";

export const fixedVisualTime = "2020-01-02T03:04:05.000Z";
export const fixedVisualMetadata = {
	lastAccess: "Jan 2, 2020 3:04 AM",
	version: "0.0.0",
	environment: "visual"
} as const;

const screenshotStyles = readFileSync(resolve(__dirname, "../styles/screenshot.css"), "utf8");

export const test = base.extend({
	page: async ({ page }, use) => {
		await page.clock.setFixedTime(new Date(fixedVisualTime));
		await page.emulateMedia({ reducedMotion: "reduce" });
		await use(page);
	}
});

test.use({
	contextOptions: { reducedMotion: "reduce" },
	locale: "en-US",
	timezoneId: "UTC"
});

export async function stabilizeVisualPage(page: Page): Promise<void> {
	if ((await page.locator("style[data-stark-visual-styles]").count()) === 0) {
		const style = await page.addStyleTag({ content: screenshotStyles });
		await style.evaluate((element) => (element as HTMLStyleElement).setAttribute("data-stark-visual-styles", ""));
	}

	await page.evaluate(async (metadata) => {
		await document.fonts.ready;

		const replacements = new Map([
			["last access", metadata.lastAccess],
			["version", metadata.version],
			["environment", metadata.environment]
		]);
		for (const label of document.querySelectorAll<HTMLElement>("stark-app-data .label, .stark-app-data-detail .label")) {
			const key = label.textContent
				?.replace(/\s*:\s*$/, "")
				.trim()
				.toLowerCase();
			const replacement = key === undefined ? undefined : replacements.get(key);
			const value = label.nextElementSibling;
			if (replacement !== undefined && value?.classList.contains("value")) {
				value.textContent = replacement;
			}
		}
	}, fixedVisualMetadata);
	await page.evaluate(
		() =>
			new Promise<void>((resolveAfterPaint) => {
				requestAnimationFrame(() => requestAnimationFrame(() => resolveAfterPaint()));
			})
	);
}

export async function captureVisualScreenshot(page: Page): Promise<Buffer> {
	await stabilizeVisualPage(page);
	return page.screenshot({
		fullPage: true,
		scale: "css"
	});
}

export { expect };
