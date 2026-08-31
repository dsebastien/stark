import { executableScenariosForRunner } from "../manifests/scenarios";
import { expect, stabilizeVisualPage, test } from "../fixtures/visual-test";
import { openRouteFromShowcaseShell, representativeRoutes } from "../support/navigation";

const actionBarDisclosureScenarios = executableScenariosForRunner("action-bar-disclosure");

for (const scenario of actionBarDisclosureScenarios) {
	test(`visual-${scenario.id}`, async ({ page }) => {
		const route = representativeRoutes.find(({ id }) => id === scenario.routeId);
		expect(route, `${scenario.id} must use a shell-navigable route`).toBeDefined();
		if (!route) {
			throw new Error(`${scenario.id} has no shell navigation target.`);
		}

		await openRouteFromShowcaseShell(page, route);
		await expect(page.locator("ui-view h1").first()).toBeVisible();
		await stabilizeVisualPage(page);

		const capture = page.locator(scenario.capture.selector);
		const component = page.locator(scenario.payload.componentSelector);
		const toggle = page.locator(scenario.payload.toggleSelector);
		const actionLabels = component.locator(".action-label");
		await expect(capture, `${scenario.id} capture selector must resolve exactly once`).toHaveCount(1);
		await expect(capture).toBeVisible();
		await expect(component, `${scenario.id} component selector must resolve exactly once`).toHaveCount(1);
		await expect(component).toBeVisible();
		await expect(toggle, `${scenario.id} toggle selector must resolve exactly once`).toHaveCount(1);
		await expect(toggle).toBeVisible();

		await expect(component).not.toHaveClass(/(?:^|\s)extended(?:\s|$)/u);
		await expect(actionLabels).toHaveCount(0);
		if (scenario.payload.action === "toggle") {
			await toggle.click();
			await stabilizeVisualPage(page);
		}

		if (scenario.payload.expectedExtended) {
			await expect(component).toHaveClass(/(?:^|\s)extended(?:\s|$)/u);
		} else {
			await expect(component).not.toHaveClass(/(?:^|\s)extended(?:\s|$)/u);
		}
		await expect(actionLabels).toHaveText([...scenario.payload.expectedActionLabels]);
		if (scenario.state === "expanded") {
			const expandedGeometry = await component.evaluate((element) => ({
				clientHeight: element.clientHeight,
				scrollHeight: element.scrollHeight
			}));
			expect(expandedGeometry.clientHeight).toBe(40);
			expect(expandedGeometry.scrollHeight).toBeGreaterThan(expandedGeometry.clientHeight);
		}

		await component.evaluate((element, scroll) => {
			element.scrollTop = scroll.kind === "end" ? element.scrollHeight : scroll.top;
		}, scenario.payload.scroll);
		await stabilizeVisualPage(page);
		const observedScrollState = await component.evaluate((element) => {
			const componentBox = element.getBoundingClientRect();
			return {
				clientHeight: element.clientHeight,
				scrollHeight: element.scrollHeight,
				scrollTop: element.scrollTop,
				visibleActionLabels: Array.from(element.querySelectorAll<HTMLElement>(".action-label"))
					.filter((label) => {
						const labelBox = label.getBoundingClientRect();
						return labelBox.top >= componentBox.top && labelBox.bottom <= componentBox.bottom;
					})
					.map((label) => label.textContent?.trim())
			};
		});
		const expectedScrollTop =
			scenario.payload.scroll.kind === "end"
				? observedScrollState.scrollHeight - observedScrollState.clientHeight
				: scenario.payload.scroll.top;
		expect(observedScrollState.scrollTop).toBe(expectedScrollTop);
		expect.soft(observedScrollState.visibleActionLabels).toEqual([...scenario.payload.expectedVisibleActionLabels]);

		await expect(capture).toHaveScreenshot(scenario.snapshotName, {
			animations: "disabled",
			caret: "hide",
			mask: scenario.maskSelectors.map((selector) => page.locator(selector)),
			maxDiffPixels: scenario.maxDiffPixels,
			threshold: scenario.threshold
		});
	});
}
