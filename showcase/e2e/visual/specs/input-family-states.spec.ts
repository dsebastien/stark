import { executableScenariosForRunner } from "../manifests/scenarios";
import { visualRouteManifest } from "../manifests/routes";
import { expect, stabilizeVisualPage, test } from "../fixtures/visual-test";
import { openRouteFromShowcaseShell } from "../support/navigation";

const inputFamilyScenarios = executableScenariosForRunner("input-family-states");
const maximumKeyboardTabs = 150;

for (const scenario of inputFamilyScenarios) {
	test(`visual-${scenario.id}`, async ({ page }) => {
		const routeEntry = visualRouteManifest.find(({ id }) => id === scenario.routeId);
		const directiveMenuIds: Partial<Record<typeof scenario.routeId, string>> = {
			"input-mask-directives": "menu-stark-ui-input-mask",
			"restrict-input-directive": "menu-stark-ui-restrict-input",
			"transform-input-directive": "menu-stark-ui-transform-input"
		};
		const directiveMenuId = directiveMenuIds[scenario.routeId];
		const route = routeEntry
			? {
					id: routeEntry.id,
					menuTrail: directiveMenuId
						? ["menu-stark-ui-directives", directiveMenuId]
						: ["menu-stark-ui-components", `menu-stark-ui-components-${routeEntry.id}`],
					path: routeEntry.path
				}
			: undefined;
		expect(route, `${scenario.id} must use a shell-navigable route`).toBeDefined();
		if (!route) {
			throw new Error(`${scenario.id} has no shell navigation target.`);
		}

		await openRouteFromShowcaseShell(page, route);
		await expect(page.locator("ui-view h1").first()).toBeVisible();
		await stabilizeVisualPage(page);

		const fixture = page.locator(scenario.payload.fixtureSelector);
		const target = page.locator(scenario.payload.targetSelector);
		await expect(fixture, `${scenario.id} fixture selector must resolve exactly once`).toHaveCount(1);
		await expect(fixture).toBeVisible();
		await expect(target).toHaveCount(scenario.payload.expected.sliderValues?.length ?? 1);
		await expect(target.first()).toBeVisible();

		let transferPrevented: boolean | undefined;
		switch (scenario.payload.action.kind) {
			case "initial":
				break;
			case "keyboard-focus":
				for (let press = 0; press < maximumKeyboardTabs; press++) {
					await page.keyboard.press("Tab");
					if (await target.first().evaluate((element) => document.activeElement === element)) {
						break;
					}
				}
				break;
			case "blur":
				await target.first().click();
				await page.keyboard.press("Escape");
				await page.keyboard.press("Tab");
				break;
			case "type":
				await target.first().focus();
				await target.first().pressSequentially(scenario.payload.action.value);
				break;
			case "open-select":
				await target.first().click();
				break;
			case "select-option":
				await target.first().click();
				await page.getByRole("option", { name: scenario.payload.action.optionName, exact: true }).click();
				break;
			case "toggle-checkbox":
				await page.locator(scenario.payload.action.selector).click();
				break;
			case "slider-key":
				await target.first().focus();
				await target.first().press(scenario.payload.action.key);
				break;
			case "slider-value": {
				const valueInput = page.locator(scenario.payload.action.inputSelector);
				await valueInput.fill(scenario.payload.action.value);
				await valueInput.press("Tab");
				break;
			}
			case "paste":
			case "drop":
				transferPrevented = await target.first().evaluate((element, action) => {
					const transfer = new DataTransfer();
					transfer.setData("text/plain", action.value);
					const event =
						action.kind === "paste"
							? new ClipboardEvent("paste", { bubbles: true, cancelable: true, clipboardData: transfer })
							: new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: transfer });
					element.dispatchEvent(event);
					return event.defaultPrevented;
				}, scenario.payload.action);
				break;
		}

		await stabilizeVisualPage(page);
		const { expected } = scenario.payload;
		if (typeof expected.value !== "undefined") {
			await expect(target.first()).toHaveValue(expected.value);
		}
		if (typeof expected.disabled !== "undefined") {
			if (scenario.surfaceId === "slider-component") {
				const slider = fixture.locator("stark-slider .slider");
				if (expected.disabled) {
					await expect(slider).toHaveAttribute("disabled", "");
				} else {
					await expect(slider).not.toHaveAttribute("disabled", /.*/u);
				}
			} else {
				expect(await target.first().isDisabled()).toBe(expected.disabled);
			}
		}
		if (typeof expected.invalid !== "undefined") {
			await expect(fixture.locator("mat-error")).toHaveCount(expected.invalid ? 1 : 0);
			await expect(fixture.locator("mat-form-field.mat-form-field-invalid, mat-form-field.mat-mdc-form-field-invalid")).toHaveCount(
				expected.invalid ? 1 : 0
			);
		}
		if (typeof expected.selectedText !== "undefined") {
			const selectedText = (await target.first().locator(".mat-mdc-select-value-text, .mat-select-value-text").allTextContents())
				.join(" ")
				.trim();
			expect(selectedText).toBe(expected.selectedText);
		}
		if (typeof expected.overlayOpen !== "undefined") {
			await expect(page.locator('[role="listbox"]')).toHaveCount(expected.overlayOpen ? 1 : 0);
			await expect(target.first()).toHaveAttribute("aria-expanded", String(expected.overlayOpen));
		}
		if (expected.sliderValues) {
			expect(await target.evaluateAll((handles) => handles.map((handle) => handle.getAttribute("aria-valuenow")))).toEqual([
				...expected.sliderValues
			]);
		}
		if (typeof expected.focused !== "undefined") {
			if (expected.focused) {
				await expect(target.first()).toBeFocused();
			} else {
				await expect(target.first()).not.toBeFocused();
			}
		}
		if (typeof expected.focusVisible !== "undefined") {
			expect(await target.first().evaluate((element) => element.matches(":focus-visible"))).toBe(expected.focusVisible);
		}
		if (typeof expected.transferPrevented !== "undefined") {
			expect(transferPrevented).toBe(expected.transferPrevented);
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

		if (scenario.payload.expected.overlayOpen) {
			await page.locator(".cdk-overlay-backdrop").click({ position: { x: 1, y: 1 } });
			await expect(page.locator('[role="listbox"]')).toHaveCount(0);
		}
	});
}
