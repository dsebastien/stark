import { executableScenariosForRunner } from "../manifests/scenarios";
import { visualRouteManifest } from "../manifests/routes";
import { expect, stabilizeVisualPage, test } from "../fixtures/visual-test";
import { openRouteFromShowcaseShell } from "../support/navigation";

const feedbackScenarios = executableScenariosForRunner("feedback-states");
const maximumKeyboardTabs = 200;

for (const scenario of feedbackScenarios) {
	test(`visual-${scenario.id}`, async ({ page }) => {
		const routeEntry = visualRouteManifest.find(({ id }) => id === scenario.routeId);
		expect(routeEntry, `${scenario.id} must use a known Showcase route`).toBeDefined();
		if (!routeEntry) {
			throw new Error(`${scenario.id} has no Showcase route.`);
		}
		const menuTrail =
			routeEntry.id === "progress-indicator"
				? ["menu-stark-ui-directives", "menu-stark-ui-progress-indicator"]
				: ["menu-stark-ui-components", `menu-stark-ui-components-${routeEntry.id}`];

		await openRouteFromShowcaseShell(page, {
			id: routeEntry.id,
			menuTrail,
			path: routeEntry.path
		});
		await expect(page.locator("ui-view h1").first()).toBeVisible();
		await stabilizeVisualPage(page);

		const fixture = page.locator(scenario.payload.fixtureSelector);
		await expect(fixture, `${scenario.id} fixture selector must resolve exactly once`).toHaveCount(1);
		await expect(fixture).toBeVisible();

		for (const step of scenario.payload.steps) {
			switch (step.kind) {
				case "click":
					await page
						.locator(step.selector)
						.nth(step.index ?? 0)
						.click();
					break;
				case "fill":
					await page.locator(step.selector).fill(step.value);
					break;
				case "keyboard-activate": {
					const target = page.locator(step.selector);
					for (let press = 0; press < maximumKeyboardTabs; press++) {
						await page.keyboard.press("Tab");
						if (await target.evaluate((element) => document.activeElement === element)) {
							break;
						}
					}
					await expect(target).toBeFocused();
					await page.keyboard.press("Enter");
					break;
				}
				case "keyboard-focus": {
					const target = page.locator(step.selector);
					for (let press = 0; press < maximumKeyboardTabs; press++) {
						await page.keyboard.press("Tab");
						if (await target.evaluate((element) => document.activeElement === element)) {
							break;
						}
					}
					await expect(target).toBeFocused();
					break;
				}
				case "wait":
					await page.waitForTimeout(step.milliseconds);
					break;
			}
			await stabilizeVisualPage(page);
		}

		await page.mouse.move(1279, 719);
		await stabilizeVisualPage(page);
		for (const assertion of scenario.payload.assertions) {
			const target = page.locator(assertion.selector);
			if (typeof assertion.count !== "undefined") {
				await expect(target, `${scenario.id}: ${assertion.selector}`).toHaveCount(assertion.count);
			}
			if (assertion.count === 0) {
				continue;
			}
			if (typeof assertion.visible !== "undefined") {
				if (assertion.visible) {
					const targetCount = await target.count();
					for (let index = 0; index < targetCount; index++) {
						await expect(target.nth(index)).toBeVisible();
					}
				} else {
					const targetCount = await target.count();
					for (let index = 0; index < targetCount; index++) {
						await expect(target.nth(index)).toBeHidden();
					}
				}
			}
			if (typeof assertion.text !== "undefined") {
				await expect(target).toHaveText(assertion.text);
			}
			if (typeof assertion.containsText !== "undefined") {
				await expect(target).toContainText(assertion.containsText);
			}
			for (const className of assertion.classes ?? []) {
				await expect(target).toHaveClass(new RegExp(`(^|\\s)${className}(\\s|$)`, "u"));
			}
			for (const className of assertion.absentClasses ?? []) {
				await expect(target).not.toHaveClass(new RegExp(`(^|\\s)${className}(\\s|$)`, "u"));
			}
			if (typeof assertion.disabled !== "undefined") {
				if (assertion.disabled) {
					await expect(target).toBeDisabled();
				} else {
					await expect(target).toBeEnabled();
				}
			}
			if (typeof assertion.value !== "undefined") {
				await expect(target).toHaveValue(assertion.value);
			}
			if (typeof assertion.focused !== "undefined") {
				if (assertion.focused) {
					await expect(target).toBeFocused();
				} else {
					await expect(target).not.toBeFocused();
				}
			}
			if (typeof assertion.focusVisible !== "undefined") {
				expect(await target.evaluate((element) => element.matches(":focus-visible"))).toBe(assertion.focusVisible);
			}
			if (assertion.withinViewport) {
				const box = await target.boundingBox();
				expect(box, `${scenario.id}: ${assertion.selector} must have measurable geometry`).not.toBeNull();
				if (box) {
					const viewport = page.viewportSize();
					expect(viewport, "visual tests require a fixed viewport").not.toBeNull();
					if (viewport) {
						expect(box.x).toBeGreaterThanOrEqual(0);
						expect(box.y).toBeGreaterThanOrEqual(0);
						expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
						expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
					}
				}
			}
		}

		const capture = page.locator(scenario.capture.selector);
		await expect(capture, `${scenario.id} capture selector must resolve exactly once`).toHaveCount(1);
		await expect(capture).toBeVisible();
		await capture.scrollIntoViewIfNeeded();
		await stabilizeVisualPage(page);
		await expect(capture).toHaveScreenshot(scenario.snapshotName, {
			animations: "disabled",
			caret: "hide",
			mask: scenario.maskSelectors.map((selector) => page.locator(selector)),
			maxDiffPixels: scenario.maxDiffPixels,
			threshold: scenario.threshold
		});
	});
}
