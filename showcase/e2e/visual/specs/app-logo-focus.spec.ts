import { executableScenariosForRunner } from "../manifests/scenarios";
import { expect, stabilizeVisualPage, test } from "../fixtures/visual-test";

const appLogoFocusScenarios = executableScenariosForRunner("app-logo-focus");
const maximumKeyboardTabs = 50;

for (const scenario of appLogoFocusScenarios) {
	test(`visual-${scenario.id}`, async ({ page }) => {
		expect(scenario.routeId).toBe("app-shell");
		await page.goto(".", { waitUntil: "domcontentloaded" });
		await expect(page.locator("stark-app-container").first()).toBeVisible();
		await expect(page).toHaveURL(/\/home(?:[?#]|$)/u);
		await stabilizeVisualPage(page);

		const component = page.locator(scenario.payload.componentSelector);
		const focusTarget = page.locator(scenario.payload.focusTargetSelector);
		await expect(component, `${scenario.id} component selector must resolve exactly once`).toHaveCount(1);
		await expect(component).toBeVisible();
		await expect(focusTarget, `${scenario.id} focus target selector must resolve exactly once`).toHaveCount(1);
		await expect(focusTarget).toBeVisible();
		await expect(page.locator("body"), `${scenario.id} must start keyboard traversal at the document`).toBeFocused();

		if (scenario.payload.action.kind === "keyboard-tab") {
			for (let press = 0; press < maximumKeyboardTabs; press++) {
				await page.keyboard.press("Tab");
				if (await focusTarget.evaluate((element) => document.activeElement === element)) {
					break;
				}
			}
			await expect(focusTarget).toBeFocused();
		} else {
			await expect(focusTarget).not.toBeFocused();
		}

		const observedFocusVisible = await focusTarget.evaluate((element) => element.matches(":focus-visible"));
		expect(observedFocusVisible).toBe(scenario.payload.expectedFocusVisible);
		if (await focusTarget.evaluate((element) => element.classList.contains("cdk-keyboard-focused"))) {
			await expect(focusTarget).toHaveClass(/(?:^|\s)cdk-keyboard-focused(?:\s|$)/u);
		}

		const componentBox = await component.boundingBox();
		expect(componentBox, `${scenario.id} component must have measurable capture geometry`).not.toBeNull();
		if (!componentBox) {
			throw new Error(`${scenario.id} component has no capture geometry.`);
		}
		expect(componentBox.x).toBeGreaterThanOrEqual(scenario.payload.capturePadding);
		expect(componentBox.y).toBeGreaterThanOrEqual(scenario.payload.capturePadding);

		const screenshot = await page.screenshot({
			animations: "disabled",
			caret: "hide",
			clip: {
				x: componentBox.x - scenario.payload.capturePadding,
				y: componentBox.y - scenario.payload.capturePadding,
				width: componentBox.width + scenario.payload.capturePadding * 2,
				height: componentBox.height + scenario.payload.capturePadding * 2
			},
			mask: scenario.maskSelectors.map((selector) => page.locator(selector)),
			scale: "css"
		});
		expect(screenshot).toMatchSnapshot(scenario.snapshotName, {
			maxDiffPixels: scenario.maxDiffPixels,
			threshold: scenario.threshold
		});
	});
}
