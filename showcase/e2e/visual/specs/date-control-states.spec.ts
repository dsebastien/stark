import { executableScenariosForRunner } from "../manifests/scenarios";
import { visualRouteManifest } from "../manifests/routes";
import { expect, stabilizeVisualPage, test } from "../fixtures/visual-test";
import { openRouteFromShowcaseShell } from "../support/navigation";

const dateControlScenarios = executableScenariosForRunner("date-control-states");
const maximumKeyboardTabs = 200;
const calendarSelector = ".mat-datepicker-content";

for (const scenario of dateControlScenarios) {
	test(`visual-${scenario.id}`, async ({ page }) => {
		const routeEntry = visualRouteManifest.find(({ id }) => id === scenario.routeId);
		expect(routeEntry, `${scenario.id} must use a known Showcase route`).toBeDefined();
		if (!routeEntry) {
			throw new Error(`${scenario.id} has no Showcase route.`);
		}

		await openRouteFromShowcaseShell(page, {
			id: routeEntry.id,
			menuTrail: ["menu-stark-ui-components", `menu-stark-ui-components-${routeEntry.id}`],
			path: routeEntry.path
		});
		await expect(page.locator("ui-view h1").first()).toBeVisible();
		await stabilizeVisualPage(page);

		const fixture = page.locator(scenario.payload.fixtureSelector);
		const component = page.locator(scenario.payload.componentSelector);
		await expect(fixture, `${scenario.id} fixture selector must resolve exactly once`).toHaveCount(1);
		await expect(fixture).toBeVisible();
		await expect(component, `${scenario.id} component selector must resolve exactly once`).toHaveCount(1);
		await expect(component).toBeVisible();
		for (const inputSelector of scenario.payload.inputSelectors) {
			await expect(page.locator(inputSelector), `${scenario.id} input selector must resolve exactly once`).toHaveCount(1);
		}

		switch (scenario.payload.action.kind) {
			case "initial":
				break;
			case "clear-input": {
				const input = page.locator(scenario.payload.action.selector);
				await input.click();
				await input.fill("");
				if (scenario.payload.action.blur) {
					await input.press("Tab");
				}
				break;
			}
			case "fill-input": {
				const input = page.locator(scenario.payload.action.selector);
				await input.click();
				await input.fill(scenario.payload.action.value);
				if (scenario.payload.action.blur) {
					await input.press("Tab");
				}
				break;
			}
			case "toggle-disabled":
				await page.locator(scenario.payload.action.selector).click({ force: true });
				break;
			case "open-calendar":
				await page.locator(scenario.payload.action.selector).first().click();
				break;
			case "keyboard-focus": {
				const focusTarget = page.locator(scenario.payload.action.selector);
				for (let press = 0; press < maximumKeyboardTabs; press++) {
					await page.keyboard.press("Tab");
					if (await focusTarget.evaluate((element) => document.activeElement === element)) {
						break;
					}
				}
				break;
			}
		}

		await page.mouse.move(1279, 719);
		await stabilizeVisualPage(page);
		const { expected } = scenario.payload;
		if (expected.values) {
			expect(await Promise.all(scenario.payload.inputSelectors.map((selector) => page.locator(selector).inputValue()))).toEqual([
				...expected.values
			]);
		}
		if (typeof expected.disabled !== "undefined") {
			expect(await Promise.all(scenario.payload.inputSelectors.map((selector) => page.locator(selector).isDisabled()))).toEqual(
				scenario.payload.inputSelectors.map(() => expected.disabled)
			);
		}
		if (typeof expected.invalidFieldCount !== "undefined") {
			await expect(
				fixture.locator(
					"mat-form-field.mat-form-field-invalid, mat-form-field.mat-mdc-form-field-invalid, mat-form-field.mat-mdc-form-field-error"
				)
			).toHaveCount(expected.invalidFieldCount);
			await expect(fixture.locator("mat-error:visible")).toHaveCount(expected.invalidFieldCount);
		}
		if (typeof expected.overlayOpen !== "undefined") {
			await expect(page.locator(calendarSelector)).toHaveCount(expected.overlayOpen ? 1 : 0);
		}
		if (expected.calendarDisabledDates) {
			expect(await page.locator(`${calendarSelector} .mat-calendar-body-disabled`).count()).toBeGreaterThan(0);
		}
		if (expected.focusedSelector) {
			const focused = page.locator(expected.focusedSelector);
			if (expected.focusVisible) {
				await expect(focused).toBeFocused();
				expect(await focused.evaluate((element) => element.matches(":focus-visible"))).toBe(true);
			} else {
				await expect(focused).not.toBeFocused();
			}
		}
		if (expected.separateDateAndTime) {
			const [dateBox, timeBox] = await Promise.all(
				scenario.payload.inputSelectors.map((selector) => page.locator(selector).boundingBox())
			);
			expect(dateBox, "date input must have measurable geometry").not.toBeNull();
			expect(timeBox, "time input must have measurable geometry").not.toBeNull();
			if (!dateBox || !timeBox) {
				throw new Error("Date-time inputs must have measurable geometry.");
			}
			expect(dateBox.x + dateBox.width, "date input must end before the time input starts").toBeLessThanOrEqual(timeBox.x);

			if (expected.values?.some((value) => value.length > 0)) {
				const labelBox = await fixture.locator(".mat-mdc-floating-label, .mat-form-field-label").first().boundingBox();
				expect(labelBox, "populated date-time label must have measurable geometry").not.toBeNull();
				if (labelBox) {
					expect(labelBox.y + labelBox.height, "floating label must remain above the rendered input text").toBeLessThanOrEqual(
						dateBox.y + 2
					);
				}
			}
		}

		const capture = page.locator(scenario.capture.selector);
		await expect(capture, `${scenario.id} capture selector must resolve exactly once`).toHaveCount(1);
		await expect(capture).toBeVisible();
		await capture.scrollIntoViewIfNeeded();
		await stabilizeVisualPage(page);
		const screenshotOptions = {
			animations: "disabled",
			caret: "hide",
			mask: scenario.maskSelectors.map((selector) => page.locator(selector)),
			maxDiffPixels: scenario.maxDiffPixels,
			threshold: scenario.threshold
		} as const;
		if (scenario.surfaceId === "date-range-picker-component" || expected.overlayOpen) {
			// Locator screenshots round fractional element edges outwards. The legacy
			// and candidate pages can therefore differ by one pixel despite identical
			// CSS geometry. An integer page clip keeps the compared bounds deterministic.
			const captureBox = await capture.boundingBox();
			expect(captureBox, `${scenario.id} capture must have measurable geometry`).not.toBeNull();
			if (!captureBox) {
				throw new Error(`${scenario.id} capture has no measurable geometry.`);
			}
			await expect(page).toHaveScreenshot(scenario.snapshotName, {
				...screenshotOptions,
				clip: {
					x: Math.floor(captureBox.x),
					y: Math.floor(captureBox.y),
					width: Math.round(captureBox.width),
					height: Math.round(captureBox.height)
				}
			});
		} else {
			await expect(capture).toHaveScreenshot(scenario.snapshotName, screenshotOptions);
		}

		if (expected.overlayOpen) {
			await page.locator(".cdk-overlay-backdrop").click({ position: { x: 1, y: 1 } });
			await expect(page.locator(calendarSelector)).toHaveCount(0);
		}
	});
}
