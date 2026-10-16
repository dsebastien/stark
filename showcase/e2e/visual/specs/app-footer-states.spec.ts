import { executableScenariosForRunner } from "../manifests/scenarios";
import { expect, stabilizeVisualPage, test } from "../fixtures/visual-test";

const appFooterScenarios = executableScenariosForRunner("app-footer-states");
const maximumKeyboardTabs = 50;

for (const scenario of appFooterScenarios) {
	test(`visual-${scenario.id}`, async ({ page }) => {
		expect(scenario.routeId).toBe("app-shell");
		await page.goto(".", { waitUntil: "domcontentloaded" });
		await expect(page.locator("stark-app-container").first()).toBeVisible();
		await expect(page).toHaveURL(/\/home(?:[?#]|$)/u);
		await stabilizeVisualPage(page);

		const component = page.locator(scenario.payload.componentSelector);
		const legalInfoLink = page.locator(scenario.payload.legalInfoLinkSelector);
		const helpLink = page.locator(scenario.payload.helpLinkSelector);
		const focusTarget = page.locator(scenario.payload.focusTargetSelector);
		await expect(component, `${scenario.id} component selector must resolve exactly once`).toHaveCount(1);
		await expect(component).toBeVisible();
		await expect(component.locator("a"), `${scenario.id} must expose exactly the two configured links`).toHaveCount(2);
		await expect(component).toHaveText(scenario.payload.expectedText);
		await expect(legalInfoLink, `${scenario.id} legal-information link must resolve exactly once`).toHaveCount(1);
		await expect(legalInfoLink).toHaveAccessibleName("Legal information");
		await expect(legalInfoLink).toHaveAttribute("target", "_blank");
		await expect(legalInfoLink).toHaveAttribute("rel", "noopener noreferrer");
		await expect(helpLink, `${scenario.id} help link must resolve exactly once`).toHaveCount(1);
		await expect(helpLink).toHaveAccessibleName("Help");
		await expect(helpLink).toHaveAttribute("target", "_blank");
		await expect(helpLink).toHaveAttribute("rel", "noopener noreferrer");
		await expect(page.locator("body"), `${scenario.id} must start keyboard traversal at the document`).toBeFocused();

		if (scenario.payload.action.kind === "keyboard-tab") {
			for (let press = 0; press < maximumKeyboardTabs; press++) {
				await page.keyboard.press("Tab");
				if (await focusTarget.evaluate((element) => document.activeElement === element)) {
					break;
				}
			}
		}

		if (scenario.payload.expectedKeyboardFocused) {
			await expect(focusTarget).toBeFocused();
		} else {
			await expect(focusTarget).not.toBeFocused();
		}
		const observedFocusVisible = await focusTarget.evaluate((element) => element.matches(":focus-visible"));
		expect(observedFocusVisible).toBe(scenario.payload.expectedFocusVisible);

		await component.scrollIntoViewIfNeeded();
		await stabilizeVisualPage(page);
		await expect(component).toHaveScreenshot(scenario.snapshotName, {
			animations: "disabled",
			caret: "hide",
			mask: scenario.maskSelectors.map((selector) => page.locator(selector)),
			maxDiffPixels: scenario.maxDiffPixels,
			threshold: scenario.threshold
		});
	});
}
