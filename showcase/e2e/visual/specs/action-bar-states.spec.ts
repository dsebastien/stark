import { executableScenariosForRunner } from "../manifests/scenarios";
import { expect, stabilizeVisualPage, test } from "../fixtures/visual-test";
import { openRouteFromShowcaseShell, representativeRoutes } from "../support/navigation";

const actionBarScenarios = executableScenariosForRunner("action-bar-states");
const maximumKeyboardTabs = 100;

for (const scenario of actionBarScenarios) {
	test(`visual-${scenario.id}`, async ({ page }) => {
		const route = representativeRoutes.find(({ id }) => id === scenario.routeId);
		expect(route, `${scenario.id} must use a shell-navigable route`).toBeDefined();
		if (!route) {
			throw new Error(`${scenario.id} has no shell navigation target.`);
		}

		await openRouteFromShowcaseShell(page, route);
		await expect(page.locator("ui-view h1").first()).toBeVisible();
		await stabilizeVisualPage(page);

		const fixture = page.locator(scenario.payload.fixtureSelector);
		const component = page.locator(scenario.payload.componentSelector);
		const primaryButtons = page.locator(scenario.payload.primaryButtonSelector);
		const alternativeTrigger = page.locator(scenario.payload.alternativeTriggerSelector);
		const menu = page.locator(scenario.payload.menuSelector);
		const menuItems = page.locator(scenario.payload.menuItemSelector);
		await expect(fixture, `${scenario.id} fixture selector must resolve exactly once`).toHaveCount(1);
		await expect(component, `${scenario.id} component selector must resolve exactly once`).toHaveCount(1);
		await expect(component).toBeVisible();
		await expect(primaryButtons).toHaveCount(scenario.payload.expectedPrimaryActionIds.length);
		expect(await primaryButtons.evaluateAll((buttons) => buttons.map(({ id }) => id))).toEqual([
			...scenario.payload.expectedPrimaryActionIds
		]);
		expect(
			await primaryButtons.evaluateAll((buttons) =>
				buttons.filter((button) => (button as HTMLButtonElement).disabled).map(({ id }) => id)
			)
		).toEqual([...scenario.payload.expectedDisabledActionIds]);
		await expect(menu).toHaveCount(0);

		if (scenario.payload.action.kind === "open-menu") {
			await expect(alternativeTrigger).toHaveCount(1);
			await alternativeTrigger.click();
			await expect(menu).toBeVisible();
			expect(await menuItems.evaluateAll((items) => items.map(({ id }) => id))).toEqual([
				...scenario.payload.expectedAlternativeActionIds
			]);
		} else if (scenario.payload.action.kind === "keyboard-tab") {
			const target = page.locator(`#${scenario.payload.expectedFocusedActionId}`);
			for (let press = 0; press < maximumKeyboardTabs; press++) {
				await page.keyboard.press("Tab");
				if (await target.evaluate((element) => document.activeElement === element)) {
					break;
				}
			}
			await expect(target).toBeFocused();
			expect(await target.evaluate((element) => element.matches(":focus-visible"))).toBe(true);
		} else {
			expect(await primaryButtons.evaluateAll((buttons) => buttons.every((button) => document.activeElement !== button))).toBe(true);
		}

		await expect(menu).toHaveCount(scenario.payload.expectedMenuOpen ? 1 : 0);
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

		if (scenario.payload.expectedMenuOpen) {
			await page.locator(".cdk-overlay-backdrop").click({ position: { x: 1, y: 1 } });
			await expect(menu).toHaveCount(0);
		}
	});
}
