import { executableScenariosForRunner } from "../manifests/scenarios";
import { expect, stabilizeVisualPage, test } from "../fixtures/visual-test";
import { openRouteFromShowcaseShell } from "../support/navigation";

const minimapRoute = {
	id: "minimap",
	menuTrail: ["menu-stark-ui-components", "menu-stark-ui-components-minimap"],
	path: "/demo-ui/minimap"
} as const;
const minimapScenarios = executableScenariosForRunner("minimap-states");
const maximumKeyboardTabs = 100;

for (const scenario of minimapScenarios) {
	test(`visual-${scenario.id}`, async ({ page }) => {
		expect(scenario.routeId).toBe(minimapRoute.id);
		await openRouteFromShowcaseShell(page, minimapRoute);
		await expect(page.locator("ui-view h1").first()).toBeVisible();
		await stabilizeVisualPage(page);

		const fixture = page.locator(scenario.payload.fixtureSelector);
		const component = page.locator(scenario.payload.componentSelector);
		const button = page.locator(scenario.payload.buttonSelector);
		const dots = page.locator(scenario.payload.dotSelector);
		const menu = page.locator(scenario.payload.menuSelector);
		const menuItems = page.locator(scenario.payload.menuItemSelector);
		const checkboxes = page.locator(scenario.payload.checkboxSelector);
		await expect(fixture, `${scenario.id} fixture selector must resolve exactly once`).toHaveCount(1);
		await expect(fixture).toBeVisible();
		await expect(component, `${scenario.id} component selector must resolve exactly once`).toHaveCount(1);
		await expect(component).toBeVisible();
		await expect(button, `${scenario.id} button selector must resolve exactly once`).toHaveCount(1);
		await expect(button).toBeVisible();
		await expect(button).toHaveAccessibleName("");
		await expect(button).toHaveAttribute("aria-haspopup", "menu");
		await expect(button).toHaveAttribute("aria-expanded", "false");
		await expect(dots).toHaveCount(scenario.payload.expectedSelected.length);
		await expect(menu).toHaveCount(0);

		if (scenario.payload.action.kind === "open-menu" || scenario.payload.action.kind === "open-menu-toggle-item") {
			await button.click();
			await expect(menu).toBeVisible();
			await expect(menuItems).toHaveCount(scenario.payload.expectedLabels.length);
			await expect(menuItems).toHaveText([...scenario.payload.expectedLabels]);
			await expect(checkboxes).toHaveCount(scenario.payload.expectedLabels.length);
			if (scenario.payload.action.kind === "open-menu-toggle-item") {
				await menuItems.nth(scenario.payload.action.index).locator("mat-checkbox").click();
			}
		} else if (scenario.payload.action.kind === "keyboard-tab") {
			await expect(button).not.toBeFocused();
			for (let press = 0; press < maximumKeyboardTabs; press++) {
				await page.keyboard.press("Tab");
				if (await button.evaluate((element) => document.activeElement === element)) {
					break;
				}
			}
		}

		await expect(button).toHaveAttribute("aria-expanded", String(scenario.payload.expectedMenuOpen));
		if (scenario.payload.expectedMenuOpen) {
			await expect(button.locator("mat-icon")).toHaveClass(/(?:^|\s)open(?:\s|$)/u);
			await expect(menu).toBeVisible();
			for (const [index, expectedChecked] of scenario.payload.expectedChecked.entries()) {
				await expect(checkboxes.nth(index)).toBeChecked({ checked: expectedChecked });
			}
		} else {
			await expect(button.locator("mat-icon")).not.toHaveClass(/(?:^|\s)open(?:\s|$)/u);
			await expect(menu).toHaveCount(0);
		}
		for (const [index, expectedSelected] of scenario.payload.expectedSelected.entries()) {
			if (expectedSelected) {
				await expect(dots.nth(index)).toHaveClass(/(?:^|\s)selected(?:\s|$)/u);
			} else {
				await expect(dots.nth(index)).not.toHaveClass(/(?:^|\s)selected(?:\s|$)/u);
			}
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
