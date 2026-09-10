import { executableScenariosForRunner } from "../manifests/scenarios";
import { expect, stabilizeVisualPage, test } from "../fixtures/visual-test";
import { openRouteFromShowcaseShell } from "../support/navigation";

const breadcrumbRoute = {
	id: "breadcrumb",
	menuTrail: ["menu-stark-ui-components", "menu-stark-ui-components-breadcrumb"],
	path: "/demo-ui/breadcrumb"
} as const;
const breadcrumbScenarios = executableScenariosForRunner("breadcrumb-states");

for (const scenario of breadcrumbScenarios) {
	test(`visual-${scenario.id}`, async ({ page }) => {
		expect(scenario.routeId).toBe(breadcrumbRoute.id);
		await openRouteFromShowcaseShell(page, breadcrumbRoute);
		await expect(page.locator("ui-view h1").first()).toBeVisible();
		await stabilizeVisualPage(page);

		const capture = page.locator(scenario.capture.selector);
		const component = page.locator(scenario.payload.componentSelector);
		const links = page.locator(scenario.payload.linkSelector);
		const separators = page.locator(scenario.payload.separatorSelector);
		const focusTarget = page.locator(scenario.payload.focusTargetSelector);
		await expect(capture, `${scenario.id} capture selector must resolve exactly once`).toHaveCount(1);
		await expect(capture).toBeVisible();
		await expect(component, `${scenario.id} component selector must resolve exactly once`).toHaveCount(1);
		await expect(component).toBeVisible();
		await expect(links).toHaveCount(scenario.payload.expectedLinks.length);
		await expect(separators).toHaveCount(scenario.payload.expectedLinks.length - 1);
		for (const [index, expectedLink] of scenario.payload.expectedLinks.entries()) {
			await expect(links.nth(index)).toHaveAttribute("id", expectedLink.id);
			await expect(links.nth(index)).toHaveText(expectedLink.text);
		}
		for (const separator of await separators.all()) {
			await expect(separator).toHaveText(scenario.payload.expectedSeparator);
		}

		await expect(focusTarget).not.toBeFocused();
		const observedFocusVisible = await focusTarget.evaluate((element) => element.matches(":focus-visible"));
		expect(observedFocusVisible).toBe(scenario.payload.expectedFocusVisible);

		await expect(capture).toHaveScreenshot(scenario.snapshotName, {
			animations: "disabled",
			caret: "hide",
			mask: scenario.maskSelectors.map((selector) => page.locator(selector)),
			maxDiffPixels: scenario.maxDiffPixels,
			threshold: scenario.threshold
		});
	});
}
