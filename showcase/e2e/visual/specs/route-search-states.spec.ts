import type { Locator, Page } from "@playwright/test";
import { executableScenariosForRunner, routeSearchPanelSelector } from "../manifests/scenarios";
import { expect, stabilizeVisualPage, test } from "../fixtures/visual-test";
import { openRouteFromShowcaseShell, representativeRoutes } from "../support/navigation";

const routeSearchRoute = representativeRoutes.find(({ id }) => id === "route-search")!;
const matchingLabels = {
	brEAd: ["Breadcrumb"],
	typography: ["Typography"],
	date: ["Date picker", "Date range picker", "Date time picker"],
	__stark_unmatched_route__: []
} as const;

async function expectActiveOption(page: Page, input: Locator, label: string): Promise<void> {
	await expect(input).toHaveAttribute("aria-activedescendant", /\S+/);
	const activeId = await input.getAttribute("aria-activedescendant");
	await expect(page.locator(`[id="${activeId}"]`)).toHaveText(label);
}

async function expectAllRoutes(options: Locator): Promise<void> {
	await expect(options).toHaveCount(29);
	const labels = (await options.allTextContents()).map((label) => label.trim());
	// The component uses case-sensitive label ordering. Assert the full ordering
	// without changing the existing Generic Search route-translation metadata.
	expect(labels).toEqual([...labels].sort());
	expect(labels).toEqual(expect.arrayContaining(["Breadcrumb", "Date picker", "Date range picker", "Date time picker", "Route Search"]));
	expect(labels).not.toContain("Typography");
}

for (const scenario of executableScenariosForRunner("route-search-states")) {
	test(`visual-${scenario.id}`, async ({ page }) => {
		await openRouteFromShowcaseShell(page, routeSearchRoute);
		await stabilizeVisualPage(page);
		const { action, expected, fixtureSelector } = scenario.payload;
		const fixture = page.locator(fixtureSelector);
		const component = fixture.locator("stark-route-search");
		const trigger = component.locator("button.search-button");
		const input = component.locator("input.search-field-input");
		const panel = page.locator(routeSearchPanelSelector);
		const options = panel.getByRole("option");
		const domOptions = panel.locator("[role=option]");
		await expect(fixture).toHaveCount(1);
		await fixture.scrollIntoViewIfNeeded();
		await expect(component).toHaveCount(1);
		await expect(trigger).toBeVisible();
		await expect(input).toBeHidden();
		await expect(input).toHaveValue("");
		await expect(panel).toBeHidden();

		if (action.kind !== "initial") {
			await trigger.click();
			await expect(input).toBeVisible();
			await expect(input).toBeFocused();
			await expect(input).toHaveAccessibleName("Search page");
			await expect(input).toHaveValue("");
			await expect(panel).toBeVisible();
			if ("query" in action) {
				await input.fill(action.query);
				await expect(input).toHaveValue(action.query);
				await expect(input).toHaveAccessibleName("Search page");
				const labels = matchingLabels[action.query];
				if (labels.length === 0) {
					await expect(panel).toBeHidden();
					await expect(domOptions).toHaveCount(0);
				} else {
					await expect(panel).toBeVisible();
					await expect(options).toHaveText([...labels]);
					await expectActiveOption(page, input, labels[0]);
				}
			}
		}

		switch (action.kind) {
			case "clear":
				await input.fill("");
				break;
			case "escape":
				await input.press("Escape");
				break;
			case "toggle-close":
			case "toggle-reopen":
				await trigger.click();
				await expect(input).toBeHidden();
				await expect(input).toHaveValue(action.query);
				await expect(panel).toBeHidden();
				await expect(page).toHaveURL(/\/demo-ui\/route-search(?:[?#]|$)/);
				if (action.kind === "toggle-reopen") {
					await trigger.click();
					await expect(input).toBeFocused();
				}
				break;
			case "select":
				if (expected.kind !== "destination") {
					throw new Error(`${scenario.id} must declare its navigation result`);
				}
				if (action.via === "pointer") {
					await options.getByText(expected.heading, { exact: true }).click();
				} else {
					if (action.via === "second-enter") {
						await input.press("ArrowDown");
					}
					await expectActiveOption(page, input, expected.heading);
					await input.press("Enter");
				}
				break;
		}

		if (expected.kind === "destination") {
			await expect(page).toHaveURL(new RegExp(`${expected.path}(?:[?#]|$)`));
			const heading = page.getByRole("heading", { name: expected.heading, level: 1, exact: true });
			await expect(heading).toHaveCount(1);
			await expect(heading).toBeVisible();
			await expect(fixture).toHaveCount(0);
			await expect(panel).toBeHidden();
		} else {
			await expect(page).toHaveURL(/\/demo-ui\/route-search(?:[?#]|$)/);
			if (expected.inputVisible) {
				await expect(input).toBeVisible();
				await expect(input).toBeFocused();
			} else {
				await expect(input).toBeHidden();
			}
			await expect(input).toHaveValue(expected.value);
			const panelOpen = expected.results === "all" || (expected.results !== null && expected.results.length > 0);
			await expect(input).toHaveAttribute("aria-expanded", String(panelOpen));
			if (panelOpen) {
				await expect(panel).toHaveCount(1);
				await expect(panel).toBeVisible();
				if (expected.results === "all") {
					await expectAllRoutes(options);
				} else {
					await expect(options).toHaveText([...(expected.results ?? [])]);
				}
				for (const option of await options.all()) {
					await expect(option).toHaveAttribute("aria-selected", "false");
				}
			} else {
				await expect(panel).toBeHidden();
				if (expected.results !== null && expected.results.length === 0) {
					await expect(domOptions).toHaveCount(0);
				}
			}
		}

		await stabilizeVisualPage(page);
		const capture = page.locator(scenario.capture.selector);
		await expect(capture).toHaveCount(1);
		await expect(capture).toBeVisible();
		await expect(capture).toHaveScreenshot(scenario.snapshotName, {
			animations: "disabled",
			caret: "hide",
			mask: scenario.maskSelectors.map((selector) => page.locator(selector)),
			maxDiffPixels: scenario.maxDiffPixels,
			threshold: scenario.threshold
		});
	});
}
