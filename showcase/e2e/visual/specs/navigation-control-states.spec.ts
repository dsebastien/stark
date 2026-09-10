import { executableScenariosForRunner } from "../manifests/scenarios";
import { visualRouteManifest } from "../manifests/routes";
import { expect, stabilizeVisualPage, test } from "../fixtures/visual-test";
import { openRouteFromShowcaseShell } from "../support/navigation";

const navigationScenarios = executableScenariosForRunner("navigation-control-states");
const maximumKeyboardTabs = 150;

for (const scenario of navigationScenarios) {
	test(`visual-${scenario.id}`, async ({ page }) => {
		if (scenario.routeId === "app-shell") {
			await page.goto(".", { waitUntil: "domcontentloaded" });
			await expect(page.locator("stark-app-container").first()).toBeVisible();
			await expect(page).toHaveURL(/\/home(?:[?#]|$)/u);
		} else {
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
		}

		await page.setViewportSize(scenario.payload.viewport);
		await stabilizeVisualPage(page);

		const fixture = page.locator(scenario.payload.fixtureSelector);
		const target = page.locator(scenario.payload.targetSelector);
		await expect(fixture, `${scenario.id} fixture selector must resolve exactly once`).toHaveCount(1);
		await expect(fixture).toBeVisible();
		await expect(target, `${scenario.id} target selector must resolve exactly once`).toHaveCount(1);

		switch (scenario.payload.action.kind) {
			case "initial":
				break;
			case "click":
				await page.locator(scenario.payload.action.selector).click();
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
			case "select-option":
				await page.locator(scenario.payload.action.triggerSelector).click();
				await page.getByRole("option", { name: scenario.payload.action.optionName, exact: true }).click();
				break;
		}

		await page.mouse.move(scenario.payload.viewport.width - 1, scenario.payload.viewport.height - 1);
		await stabilizeVisualPage(page);
		const { expected } = scenario.payload;
		if (typeof expected.iconPathPrefix !== "undefined") {
			const iconPath = await target.locator("path").first().getAttribute("d");
			expect(iconPath).toBeTruthy();
			expect(iconPath?.startsWith(expected.iconPathPrefix)).toBe(true);
		}
		if (typeof expected.disabled !== "undefined") {
			if (expected.disabled) {
				await expect(target).toHaveClass(/(?:^|\s)stark-disabled(?:\s|$)/u);
			} else {
				await expect(target).not.toHaveClass(/(?:^|\s)stark-disabled(?:\s|$)/u);
			}
		}
		if (typeof expected.active !== "undefined") {
			if (expected.active) {
				await expect(target).toHaveClass(/(?:^|\s)active(?:\s|$)/u);
			} else {
				await expect(target).not.toHaveClass(/(?:^|\s)active(?:\s|$)/u);
			}
		}
		if (typeof expected.expanded !== "undefined") {
			const expansionPanel = page.locator(`${scenario.payload.targetSelector} + mat-expansion-panel`);
			await expect(expansionPanel).toHaveCount(1);
			if (expected.expanded) {
				await expect(expansionPanel).toHaveClass(/(?:^|\s)mat-expanded(?:\s|$)/u);
			} else {
				await expect(expansionPanel).not.toHaveClass(/(?:^|\s)mat-expanded(?:\s|$)/u);
			}
		}
		if (typeof expected.mode !== "undefined") {
			await expect(fixture.locator(expected.mode === "dropdown" ? "stark-dropdown" : "mat-button-toggle-group")).toHaveCount(1);
		}
		if (typeof expected.selectedText !== "undefined") {
			if (expected.mode === "toolbar") {
				await expect(fixture.locator('[role="radio"][aria-checked="true"]')).toHaveText(expected.selectedText);
			} else {
				await expect(fixture.locator('[role="combobox"]')).toContainText(expected.selectedText);
			}
		}
		if (typeof expected.overlayOpen !== "undefined") {
			await expect(page.locator('[role="listbox"]')).toHaveCount(expected.overlayOpen ? 1 : 0);
			await expect(fixture.locator('[role="combobox"]')).toHaveAttribute("aria-expanded", String(expected.overlayOpen));
		}
		if (typeof expected.drawer !== "undefined") {
			const leftDrawer = page.locator("stark-app-sidebar .stark-app-sidenav-left");
			const rightDrawer = page.locator("stark-app-sidebar .stark-app-sidenav-right");
			await expect(leftDrawer).toHaveCount(1);
			await expect(rightDrawer).toHaveCount(1);
			const leftOpen = expected.drawer === "menu" || expected.drawer === "regular-left";
			const rightOpen = expected.drawer === "right";
			if (leftOpen) {
				await expect(leftDrawer).toHaveClass(/(?:^|\s)mat-drawer-opened(?:\s|$)/u);
			} else {
				await expect(leftDrawer).not.toHaveClass(/(?:^|\s)mat-drawer-opened(?:\s|$)/u);
			}
			if (rightOpen) {
				await expect(rightDrawer).toHaveClass(/(?:^|\s)mat-drawer-opened(?:\s|$)/u);
			} else {
				await expect(rightDrawer).not.toHaveClass(/(?:^|\s)mat-drawer-opened(?:\s|$)/u);
			}
			if (expected.drawer === "menu") {
				await expect(leftDrawer).toHaveClass(/(?:^|\s)stark-app-sidenav-menu(?:\s|$)/u);
			} else if (expected.drawer === "regular-left") {
				await expect(leftDrawer).not.toHaveClass(/(?:^|\s)stark-app-sidenav-menu(?:\s|$)/u);
			}
		}
		if (typeof expected.focused !== "undefined") {
			if (expected.focused) {
				await expect(target).toBeFocused();
			} else {
				await expect(target).not.toBeFocused();
			}
		}
		if (typeof expected.focusVisible !== "undefined") {
			expect(await target.evaluate((element) => element.matches(":focus-visible"))).toBe(expected.focusVisible);
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

		if (expected.overlayOpen) {
			await page.locator(".cdk-overlay-backdrop").click({ position: { x: 1, y: 1 } });
			await expect(page.locator('[role="listbox"]')).toHaveCount(0);
		}
	});
}
