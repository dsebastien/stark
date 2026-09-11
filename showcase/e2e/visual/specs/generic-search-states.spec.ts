import type { Locator, Page } from "@playwright/test";
import {
	executableScenariosForRunner,
	genericSearchCriteria,
	genericSearchRows,
	type GenericSearchStateScenario
} from "../manifests/scenarios";
import { expect, fixedVisualTime, stabilizeVisualPage, test } from "../fixtures/visual-test";
import { openRouteFromShowcaseShell } from "../support/navigation";

const genericSearchRoute = {
	id: "generic-search",
	menuTrail: ["menu-stark-ui-components", "menu-stark-ui-generic-search"],
	path: "/demo-ui/generic-search"
} as const;
type Criteria = GenericSearchStateScenario["payload"]["criteria"];
type ResultRows = GenericSearchStateScenario["payload"]["expectedRows"];

async function expectCriteria(form: Locator, criteria: Criteria): Promise<void> {
	for (const name of ["year", "hero", "movie"] as const) {
		await expect(form.locator(`input[formcontrolname=${name}]`)).toHaveValue(criteria[name]);
	}
}

async function fillCriteria(form: Locator, criteria: Criteria): Promise<void> {
	for (const name of ["year", "hero", "movie"] as const) {
		const input = form.locator(`input[formcontrolname=${name}]`);
		await input.fill(criteria[name]);
		await input.press("Escape");
	}
	await expectCriteria(form, criteria);
	await expect(form.page().locator("[role=listbox]:visible")).toHaveCount(0);
}

async function expectResults(table: Locator, spinner: Locator, expectedRows: ResultRows): Promise<void> {
	await expect(spinner).toBeHidden();
	await expect(table).toBeVisible();
	// Count DOM rows, including hidden ones, so stale results cannot pass a no-match/reset assertion.
	const rows = table.locator("tbody tr:not(.expandable-row)");
	await expect(rows).toHaveCount(expectedRows.length);
	for (const [index, cells] of expectedRows.entries()) {
		await expect(rows.nth(index).locator("td")).toHaveText([...cells]);
	}
}

async function expectClosedForm(form: Locator): Promise<void> {
	await expect(form).toHaveCSS("height", "4px");
	await expect(form).toHaveCSS("overflow", "hidden");
	const geometry = await form.evaluate((element) => {
		const bounds = element.getBoundingClientRect();
		return {
			height: bounds.height,
			bottom: bounds.bottom,
			inputTops: [...element.querySelectorAll("input")].map((input) => input.getBoundingClientRect().top)
		};
	});
	expect(geometry.height).toBe(4);
	expect(geometry.inputTops).toHaveLength(3);
	for (const top of geometry.inputTops) {
		expect(top).toBeGreaterThanOrEqual(geometry.bottom);
	}
}

async function focusSearchWithKeyboard(page: Page, search: Locator): Promise<void> {
	for (let attempt = 0; attempt < 12; attempt++) {
		await page.keyboard.press("Tab");
		if (await search.evaluate((element) => element === document.activeElement)) {
			break;
		}
	}
	await expect(search).toBeFocused();
	expect(await search.evaluate((element) => element.matches(":focus-visible"))).toBe(true);
}

for (const scenario of executableScenariosForRunner("generic-search-states")) {
	test(`visual-${scenario.id}`, async ({ page }) => {
		await openRouteFromShowcaseShell(page, genericSearchRoute);
		await page.setViewportSize(scenario.payload.viewport);
		await stabilizeVisualPage(page);
		const { criteria, expectedCriteria, expectedFormOpen, expectedKeyboardFocus, expectedRows, journey } = scenario.payload;
		const fixture = page.locator(scenario.payload.fixtureSelector);
		const form = fixture.locator(scenario.payload.formSelector);
		const toggle = fixture.locator("mat-slide-toggle");
		const toggleControl = toggle.getByRole("switch").or(toggle.getByRole("checkbox"));
		const table = fixture.locator("stark-table");
		const spinner = fixture.locator("stark-progress-indicator");
		const footer = form.locator(".stark-form-actions");
		const search = footer.getByRole("button", { name: "Search", exact: true });
		const reset = footer.getByRole("button", { name: "Reset", exact: true });
		const actionBar = form.locator("stark-action-bar");
		await expect(fixture).toHaveCount(1);
		await expect(form).toHaveCount(1);
		await expect(form).toBeVisible();
		await expect(toggleControl).toHaveCount(1);
		await expect(toggleControl).toBeChecked();
		await expect(search).toBeEnabled();
		await expect(reset).toBeEnabled();
		await expectCriteria(form, genericSearchCriteria.empty);
		await expectResults(table, spinner, []);

		const capture = async (): Promise<void> => {
			await page.mouse.move(scenario.payload.viewport.width - 1, scenario.payload.viewport.height - 1);
			const target = page.locator(scenario.capture.selector);
			await expect(target).toHaveCount(1);
			await expect(target).toBeVisible();
			await expect(target).toHaveScreenshot(scenario.snapshotName, {
				animations: "disabled",
				caret: "hide",
				mask: scenario.maskSelectors.map((selector) => page.locator(selector)),
				maxDiffPixels: scenario.maxDiffPixels,
				threshold: scenario.threshold
			});
		};

		if (journey !== "initial") {
			await fillCriteria(form, criteria);
		}
		switch (journey) {
			case "close":
			case "reopen":
				await toggle.click();
				await expect(toggleControl).not.toBeChecked();
				await expectClosedForm(form);
				await expectCriteria(form, criteria);
				if (journey === "reopen") {
					await toggle.click();
					await expect(toggleControl).toBeChecked();
				}
				break;
			case "hero-search":
				await search.click();
				break;
			case "year-keyboard":
				await focusSearchWithKeyboard(page, search);
				await search.press("Enter");
				break;
			case "movie-action-bar":
				await actionBar.locator("button#search-action-bar-search-action-bar").click();
				break;
			case "no-matches":
				await search.click();
				await expectResults(table, spinner, genericSearchRows.hero);
				await fillCriteria(form, expectedCriteria);
				await search.click();
				break;
			case "reset":
			case "all-results":
				await search.click();
				await expectResults(table, spinner, genericSearchRows.combined);
				if (journey === "reset") {
					await actionBar.locator("button#search-action-bar-undo-action-bar").click();
				} else {
					await reset.click();
				}
				await expectCriteria(form, genericSearchCriteria.empty);
				await expectResults(table, spinner, []);
				if (journey === "all-results") {
					await search.click();
				}
				break;
			case "loading": {
				await stabilizeVisualPage(page);
				const time = new Date(fixedVisualTime);
				// Keep the pause target in the future while the clock installation completes.
				await page.clock.install({ time: new Date(time.getTime() - 60_000) });
				await page.clock.pauseAt(time);
				try {
					await search.click();
					await expect(spinner).toBeVisible();
					await expect(table).toBeHidden();
					await expect(table.locator("tbody tr:not(.expandable-row)")).toHaveCount(0);
					// Angular remains intentionally unstable while the demo's 1000 ms delay is pending.
					await capture();
					await page.clock.runFor(1001);
					await expectResults(table, spinner, expectedRows);
				} finally {
					await page.clock.resume();
				}
				break;
			}
		}

		await expectCriteria(form, expectedCriteria);
		await expectResults(table, spinner, expectedRows);
		if (expectedFormOpen) {
			await expect(toggleControl).toBeChecked();
			await expect(form).not.toHaveCSS("height", "4px");
			await expect(search).toBeVisible();
			await expect(search).toBeEnabled();
		} else {
			await expect(toggleControl).not.toBeChecked();
			await expectClosedForm(form);
		}
		if (expectedKeyboardFocus) {
			await expect(search).toBeFocused();
		}
		if (scenario.axis === "focus" && scenario.state === "rest") {
			await expect(form.locator(":focus")).toHaveCount(0);
		}
		expect(await search.evaluate((element) => element.matches(":focus-visible"))).toBe(expectedKeyboardFocus);
		await stabilizeVisualPage(page);
		if (journey !== "loading") {
			await capture();
		}
	});
}
