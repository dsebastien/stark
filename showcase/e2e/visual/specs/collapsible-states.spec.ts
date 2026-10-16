import { executableScenariosForRunner } from "../manifests/scenarios";
import { expect, stabilizeVisualPage, test } from "../fixtures/visual-test";
import { openRouteFromShowcaseShell } from "../support/navigation";

const collapsibleRoute = {
	id: "collapsible",
	menuTrail: ["menu-stark-ui-components", "menu-stark-ui-components-collapsible"],
	path: "/demo-ui/collapsible"
} as const;

const collapsibleScenarios = executableScenariosForRunner("collapsible-states");

for (const scenario of collapsibleScenarios) {
	test(`visual-${scenario.id}`, async ({ page }) => {
		expect(scenario.routeId).toBe(collapsibleRoute.id);
		await openRouteFromShowcaseShell(page, collapsibleRoute);
		await expect(page.locator("ui-view h1").first()).toBeVisible();
		await stabilizeVisualPage(page);

		const capture = page.locator(scenario.capture.selector);
		const component = page.locator(scenario.payload.componentSelector);
		const header = page.locator(scenario.payload.headerSelector);
		const content = page.locator(scenario.payload.contentSelector);
		const status = page.locator(scenario.payload.statusSelector);
		await expect(capture, `${scenario.id} capture selector must resolve exactly once`).toHaveCount(1);
		await expect(capture).toBeVisible();
		await expect(component, `${scenario.id} component selector must resolve exactly once`).toHaveCount(1);
		await expect(component).toBeVisible();
		await expect(header, `${scenario.id} header selector must resolve exactly once`).toHaveCount(1);
		await expect(header).toBeVisible();
		await expect(content, `${scenario.id} content selector must resolve exactly once`).toHaveCount(1);
		await expect(content).toContainText(scenario.payload.expectedContentText);
		await expect(status, `${scenario.id} status selector must resolve exactly once`).toHaveCount(1);

		const initiallyExpanded = scenario.payload.action.kind === "toggle-header" ? false : scenario.payload.expectedExpanded;
		await expect(header).toHaveAttribute("aria-expanded", String(initiallyExpanded));
		await expect(status).toHaveText(initiallyExpanded ? "Open" : "Closed");

		if (scenario.payload.action.kind === "toggle-header") {
			await header.click();
		} else if (scenario.payload.action.kind === "keyboard-focus-header") {
			const nextFocusable = page.locator(scenario.payload.action.nextFocusableSelector);
			await expect(nextFocusable, `${scenario.id} focus setup selector must resolve exactly once`).toHaveCount(1);
			await nextFocusable.focus();
			await page.keyboard.press("Shift+Tab");
		}
		await stabilizeVisualPage(page);

		await expect.soft(header).toHaveAttribute("aria-expanded", String(scenario.payload.expectedExpanded));
		await expect.soft(status).toHaveText(scenario.payload.expectedStatus);
		if (scenario.payload.expectedContentVisible) {
			await expect.soft(content).toBeVisible();
		} else {
			await expect.soft(content).toBeHidden();
		}
		if (scenario.payload.expectedKeyboardFocused) {
			await expect.soft(header).toBeFocused();
			await expect.soft(header).toHaveClass(/(?:^|\s)cdk-keyboard-focused(?:\s|$)/u);
		} else {
			await expect.soft(header).not.toHaveClass(/(?:^|\s)cdk-keyboard-focused(?:\s|$)/u);
		}

		await expect(capture).toHaveScreenshot(scenario.snapshotName, {
			animations: "disabled",
			caret: "hide",
			mask: scenario.maskSelectors.map((selector) => page.locator(selector)),
			maxDiffPixels: scenario.maxDiffPixels,
			threshold: scenario.threshold
		});
	});
}
