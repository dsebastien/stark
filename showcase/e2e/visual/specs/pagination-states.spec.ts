import type { Locator } from "@playwright/test";
import { executableScenariosForRunner } from "../manifests/scenarios";
import { expect, stabilizeVisualPage, test } from "../fixtures/visual-test";
import { openRouteFromShowcaseShell } from "../support/navigation";

const paginationRoute = {
	id: "pagination",
	menuTrail: ["menu-stark-ui-components", "menu-stark-ui-components-pagination"],
	path: "/demo-ui/pagination"
} as const;
const paginationScenarios = executableScenariosForRunner("pagination-states");
const maximumKeyboardTabs = 100;

async function expectOptionalButton(button: Locator, expectedDisabled: boolean | null): Promise<void> {
	if (expectedDisabled === null) {
		await expect(button).toHaveCount(0);
		return;
	}

	await expect(button).toHaveCount(1);
	await expect(button).toBeVisible();
	if (expectedDisabled) {
		await expect(button).toBeDisabled();
	} else {
		await expect(button).toBeEnabled();
	}
}

for (const scenario of paginationScenarios) {
	test(`visual-${scenario.id}`, async ({ page }) => {
		expect(scenario.routeId).toBe(paginationRoute.id);
		await openRouteFromShowcaseShell(page, paginationRoute);
		await expect(page.locator("ui-view h1").first()).toBeVisible();
		await stabilizeVisualPage(page);

		const fixture = page.locator(scenario.payload.fixtureSelector);
		const component = page.locator(scenario.payload.componentSelector);
		const firstButton = page.locator(scenario.payload.firstButtonSelector);
		const previousButton = page.locator(scenario.payload.previousButtonSelector);
		const nextButton = page.locator(scenario.payload.nextButtonSelector);
		const lastButton = page.locator(scenario.payload.lastButtonSelector);
		const pageInput = page.locator(scenario.payload.pageInputSelector);
		const totalPages = page.locator(scenario.payload.totalPagesSelector);
		const pageNumbers = page.locator(scenario.payload.pageNumberSelector);
		const activePage = page.locator(scenario.payload.activePageSelector);
		const itemsPerPage = page.locator(scenario.payload.itemsPerPageSelector);
		const emittedEvent = page.locator(scenario.payload.eventSelector);
		await expect(fixture, `${scenario.id} fixture selector must resolve exactly once`).toHaveCount(1);
		await expect(fixture).toBeVisible();
		await expect(component, `${scenario.id} component selector must resolve exactly once`).toHaveCount(1);
		await expect(component).toBeVisible();
		await expect(nextButton, `${scenario.id} next button selector must resolve exactly once`).toHaveCount(1);
		await expect(nextButton).toBeVisible();
		await expect(pageInput, `${scenario.id} page input selector must resolve exactly once`).toHaveCount(1);
		await expect(itemsPerPage, `${scenario.id} page-size selector must resolve exactly once`).toHaveCount(1);
		await expect(emittedEvent).toHaveCount(0);

		if (scenario.payload.action.kind === "go-to-last") {
			await expect(lastButton).toBeEnabled();
			await lastButton.click();
		} else if (scenario.payload.action.kind === "go-to-page") {
			const pageLink = pageNumbers.locator("a").filter({ hasText: new RegExp(`^${scenario.payload.action.page}$`, "u") });
			await expect(pageLink).toHaveCount(1);
			await pageLink.click();
		} else if (scenario.payload.action.kind === "select-page-size") {
			await itemsPerPage.click();
			const listbox = page.locator('.cdk-overlay-pane [role="listbox"]');
			await expect(listbox).toBeVisible();
			const option = listbox.getByRole("option", { exact: true, name: String(scenario.payload.action.size) });
			await expect(option).toHaveCount(1);
			await option.click();
			await expect(listbox).toHaveCount(0);
		} else if (scenario.payload.action.kind === "keyboard-tab") {
			await expect(nextButton).not.toBeFocused();
			for (let press = 0; press < maximumKeyboardTabs; press++) {
				await page.keyboard.press("Tab");
				if (await nextButton.evaluate((element) => document.activeElement === element)) {
					break;
				}
			}
		}

		await expect(pageInput).toHaveValue(String(scenario.payload.expectedCurrentPage));
		await expect(totalPages).toHaveText(String(scenario.payload.expectedTotalPages));
		await expect(itemsPerPage).toContainText(String(scenario.payload.expectedItemsPerPage));
		await expect(pageNumbers).toHaveCount(scenario.payload.expectedPageNumbers.length);
		if (scenario.payload.expectedPageNumbers.length > 0) {
			await expect(pageNumbers).toHaveText([...scenario.payload.expectedPageNumbers]);
		}
		if (scenario.payload.expectedActivePage === null) {
			await expect(activePage).toHaveCount(0);
		} else {
			await expect(activePage).toHaveCount(1);
			await expect(activePage).toHaveText(scenario.payload.expectedActivePage);
		}

		await expectOptionalButton(firstButton, scenario.payload.expectedFirstDisabled);
		await expectOptionalButton(previousButton, scenario.payload.expectedPreviousDisabled);
		await expectOptionalButton(nextButton, scenario.payload.expectedNextDisabled);
		await expectOptionalButton(lastButton, scenario.payload.expectedLastDisabled);
		if (scenario.payload.expectedEvent === null) {
			await expect(emittedEvent).toHaveCount(0);
		} else {
			await expect(emittedEvent).toHaveCount(1);
			await expect(emittedEvent).toBeVisible();
			const normalizedEvent = (await emittedEvent.textContent())?.replace(/\s+/gu, "");
			expect(normalizedEvent).toContain(scenario.payload.expectedEvent);
		}

		if (scenario.payload.expectedFocused) {
			await expect(nextButton).toBeFocused();
		} else {
			await expect(nextButton).not.toBeFocused();
		}
		const observedFocusVisible = await nextButton.evaluate((element) => element.matches(":focus-visible"));
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
