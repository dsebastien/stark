import { createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { captureVisualScreenshot, expect, fixedVisualMetadata, fixedVisualTime, stabilizeVisualPage, test } from "../fixtures/visual-test";
import { openRouteFromShowcaseShell, smokeRoute } from "../support/navigation";

test("uses the pinned visual browser environment", async ({ page }) => {
	await page.goto(".", { waitUntil: "domcontentloaded" });
	await stabilizeVisualPage(page);

	const environment = await page.evaluate(() => ({
		date: new Date().toISOString(),
		fontStatus: document.fonts.status,
		language: navigator.language,
		languages: navigator.languages,
		reducedMotion: matchMedia("(prefers-reduced-motion: reduce)").matches,
		timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
	}));

	expect(environment).toEqual({
		date: fixedVisualTime,
		fontStatus: "loaded",
		language: "en-US",
		languages: ["en-US"],
		reducedMotion: true,
		timeZone: "UTC"
	});
});

test("rejects delayed UI-Router transition errors before capture", async ({ page }) => {
	await page.setContent("<stark-message-pane></stark-message-pane>");
	await page.evaluate(() => {
		setTimeout(() => {
			const error = document.createElement("div");
			error.textContent = "Error: Transition Rejection: transition superseded";
			document.querySelector("stark-message-pane")?.append(error);
		}, 50);
	});

	await expect(stabilizeVisualPage(page)).rejects.toThrow(/transition rejection/i);
});

test("produces byte-identical representative screenshots without masking component content", async ({ page }, testInfo) => {
	await openRouteFromShowcaseShell(page, smokeRoute);
	const heading = page.locator("ui-view h1").first();
	const headingBeforeCapture = await heading.innerText();

	const firstCapture = await captureVisualScreenshot(page);
	await openRouteFromShowcaseShell(page, smokeRoute);
	const secondCapture = await captureVisualScreenshot(page);
	const captureHashes = [firstCapture, secondCapture].map((capture) => createHash("sha256").update(capture).digest("hex"));
	const firstCapturePath = testInfo.outputPath("determinism-capture-1.png");
	const secondCapturePath = testInfo.outputPath("determinism-capture-2.png");
	await Promise.all([writeFile(firstCapturePath, firstCapture), writeFile(secondCapturePath, secondCapture)]);
	await testInfo.attach("determinism-capture-1.png", { path: firstCapturePath });
	await testInfo.attach("determinism-capture-2.png", { path: secondCapturePath });
	await testInfo.attach("determinism-hashes.json", {
		body: JSON.stringify(captureHashes, null, 2),
		contentType: "application/json"
	});
	expect(Buffer.compare(firstCapture, secondCapture), "repeated PNG captures must be byte-identical").toBe(0);
	expect(await heading.innerText(), "stable component content must remain untouched").toBe(headingBeforeCapture);

	const shellValues = await page.locator(".stark-app-header stark-app-data .value").allTextContents();
	expect(shellValues).toContain(fixedVisualMetadata.lastAccess);

	await page.getByRole("button", { name: "Application Data" }).first().click();
	await expect(page.locator(".stark-app-data-detail")).toBeVisible();
	await stabilizeVisualPage(page);
	await expect(page.locator(".stark-app-data-detail .value")).toHaveText([fixedVisualMetadata.version, fixedVisualMetadata.environment]);

	const screenshotStyles = await page.locator("body").evaluate((body) => {
		const styles = getComputedStyle(body);
		return {
			animationDuration: styles.animationDuration,
			caretColor: styles.caretColor,
			transitionDuration: styles.transitionDuration
		};
	});
	expect(screenshotStyles).toEqual({
		animationDuration: "0s",
		caretColor: "rgba(0, 0, 0, 0)",
		transitionDuration: "0s"
	});
});
