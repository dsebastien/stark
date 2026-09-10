import { executableScenariosForRunner } from "../manifests/scenarios";
import { expect, stabilizeVisualPage, test } from "../fixtures/visual-test";
import { openRouteFromShowcaseShell } from "../support/navigation";

const appDataRoute = {
	id: "app-data",
	menuTrail: ["menu-stark-ui-components", "menu-stark-ui-components-app-data"],
	path: "/demo-ui/app-data"
} as const;
const appDataScenarios = executableScenariosForRunner("app-data-states");
const maximumKeyboardTabs = 80;

for (const scenario of appDataScenarios) {
	test(`visual-${scenario.id}`, async ({ page }) => {
		expect(scenario.routeId).toBe(appDataRoute.id);
		await openRouteFromShowcaseShell(page, appDataRoute);
		await expect(page.locator("ui-view h1").first()).toBeVisible();
		await stabilizeVisualPage(page);

		const fixture = page.locator(scenario.payload.fixtureSelector);
		const component = page.locator(scenario.payload.componentSelector);
		const button = page.locator(scenario.payload.buttonSelector);
		const detail = page.locator(scenario.payload.detailSelector);
		await expect(fixture, `${scenario.id} fixture selector must resolve exactly once`).toHaveCount(1);
		await expect(fixture).toBeVisible();
		await expect(component, `${scenario.id} component selector must resolve exactly once`).toHaveCount(1);
		await expect(component).toBeVisible();
		await expect(component).toHaveClass(new RegExp(`(?:^|\\s)${scenario.payload.expectedMode}(?:\\s|$)`, "u"));
		await expect(button, `${scenario.id} button selector must resolve exactly once`).toHaveCount(1);
		await expect(button).toBeVisible();
		await expect(button).toHaveAccessibleName("Application Data");
		await expect(button).toHaveAttribute("aria-haspopup", "menu");
		await expect(button).toHaveAttribute("aria-expanded", "false");
		await expect(detail).toHaveCount(0);
		await expect(component.locator(".stark-app-data-summary .value")).toHaveText([...scenario.payload.expectedSummaryValues]);

		if (scenario.payload.action.kind === "open-dropdown") {
			await button.click();
			await expect(detail).toBeVisible();
			await stabilizeVisualPage(page);
		} else if (scenario.payload.action.kind === "keyboard-tab") {
			await expect(button).not.toBeFocused();
			for (let press = 0; press < maximumKeyboardTabs; press++) {
				await page.keyboard.press("Tab");
				if (await button.evaluate((element) => document.activeElement === element)) {
					break;
				}
			}
		}

		await expect(button).toHaveAttribute("aria-expanded", String(scenario.payload.expectedOpen));
		if (scenario.payload.expectedOpen) {
			await expect(button).toHaveClass(/(?:^|\s)is-open(?:\s|$)/u);
			await expect(detail, `${scenario.id} detail selector must resolve exactly once`).toHaveCount(1);
			await expect(detail).toBeVisible();
			await expect(detail.locator(".stark-app-data-detail .value")).toHaveText([...scenario.payload.expectedDetailValues]);
		} else {
			await expect(button).not.toHaveClass(/(?:^|\s)is-open(?:\s|$)/u);
			await expect(detail).toHaveCount(0);
		}

		if (scenario.payload.expectedFocused) {
			await expect(button).toBeFocused();
		} else {
			await expect(button).not.toBeFocused();
		}
		const observedFocusVisible = await button.evaluate((element) => element.matches(":focus-visible"));
		expect(observedFocusVisible).toBe(scenario.payload.expectedFocusVisible);

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
