import { assertShellContentDoesNotOverlapNavigation, shellCaptureClip } from "../fixtures/visual";
import { expect, stabilizeVisualPage, test } from "../fixtures/visual-test";
import { openRouteFromShowcaseShell } from "../support/navigation";
import { pilotVisualComparisons } from "../support/visual-manifest";

test("guide copy changes leave shell pixels unchanged while shell defects remain visible", async ({ page }) => {
	const comparisons = pilotVisualComparisons.filter(({ capture }) => capture.scope === "shell");
	expect(comparisons).toHaveLength(3);
	await openRouteFromShowcaseShell(page, comparisons[0].route);
	await stabilizeVisualPage(page);
	await assertShellContentDoesNotOverlapNavigation(page);

	const regions = comparisons.map(({ capture }) => {
		if (capture.scope !== "shell") {
			throw new Error("Expected a shell capture.");
		}
		return { capture, locator: page.locator(capture.selector) };
	});
	const before: Buffer[] = [];
	for (const region of regions) {
		await expect(region.locator).toHaveCount(1);
		await expect(region.locator.locator(".getting-started-content section, .getting-started-content table-of-contents")).toHaveCount(0);
		before.push(await page.screenshot({ clip: await shellCaptureClip(page, region.capture) }));
	}

	// Exercise the scope contract using the real guide without changing its shell.
	await page.locator("#system_configuration + p").evaluate((paragraph) => {
		paragraph.textContent = "Intentional toolchain documentation changes must not become shell pixel differences.";
	});
	await stabilizeVisualPage(page);
	for (const [index, region] of regions.entries()) {
		const after = await page.screenshot({ clip: await shellCaptureClip(page, region.capture) });
		expect(Buffer.compare(before[index], after), comparisons[index].scenarioId).toBe(0);
	}

	await page.locator(".getting-started-content > div:first-child").evaluate((title) => {
		title.textContent = "Unexpected title regression";
	});
	const changedTitle = await page.screenshot({ clip: await shellCaptureClip(page, regions[2].capture) });
	expect(Buffer.compare(before[2], changedTitle), "stable title changes must still affect the capture").not.toBe(0);

	await regions[2].locator.evaluate((title) => {
		(title as HTMLElement).style.transform = "translateY(1px)";
	});
	await expect(shellCaptureClip(page, regions[2].capture)).rejects.toThrow(/legacy position and size/);

	await page.locator("main.stark-main-container").evaluate((content) => {
		(content as HTMLElement).style.transform = "translateX(-280px)";
	});
	await expect(assertShellContentDoesNotOverlapNavigation(page)).rejects.toThrow(/content left edge/);
});
