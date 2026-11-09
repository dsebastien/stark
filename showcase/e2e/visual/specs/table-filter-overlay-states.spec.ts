import type { Locator, Page } from "@playwright/test";
import { executableScenariosForRunner, type TableFilterOverlayStateScenario } from "../manifests/scenarios";
import { expect, stabilizeVisualPage, test } from "../fixtures/visual-test";
import { openRouteFromShowcaseShell } from "../support/navigation";

const tableRoute = {
	id: "table",
	menuTrail: ["menu-stark-ui-components", "menu-stark-ui-components-table"],
	path: "/demo-ui/table"
} as const;
const overlayContainerSelector = ".cdk-overlay-container";
const filterPanelSelector = `${overlayContainerSelector} .mat-table-filter`;
const backdropSelector = `${overlayContainerSelector} .cdk-overlay-backdrop`;
const tooltipSelector = `${overlayContainerSelector} .mat-tooltip, ${overlayContainerSelector} .mat-mdc-tooltip`;
const filteringClass = /(?:^|\s)filtering(?:\s|$)/u;
const filterEnabledClass = /(?:^|\s)filter-enabled(?:\s|$)/u;
type FilterOverlayPayload = TableFilterOverlayStateScenario["payload"];
type Rows = FilterOverlayPayload["contract"]["before"];

async function expectFocusVisible(locator: Locator, focusVisible: boolean): Promise<void> {
	await expect(locator).toBeFocused();
	expect(await locator.evaluate((element) => element.matches(":focus-visible"))).toBe(focusVisible);
}

async function expectRows(component: Locator, payload: FilterOverlayPayload, rows: Rows): Promise<void> {
	const tableRows = component.locator("tbody tr");
	await expect(tableRows).toHaveCount(rows.rowIds.length);
	await expect(tableRows.locator("td.mat-column-id")).toHaveText([...rows.rowIds]);
	const counter = component.locator(".stark-table-rows-counter");
	await expect(counter).toHaveCount(1);
	await expect(counter).toHaveText(rows.counterText);
	const pagination = component.locator("stark-pagination");
	await expect(pagination.locator("input")).toHaveValue("1");
	if (payload.viewport.width === 390) {
		await expect(pagination.locator("input")).toBeHidden();
	} else {
		await expect(pagination.locator("input")).toBeVisible();
	}
	await expect(pagination.locator(".total-pages")).toHaveText(String(rows.totalPages));
}

async function expectFilterIndicators(component: Locator, payload: FilterOverlayPayload): Promise<void> {
	const { filter } = payload;
	const columnFiltered = filter.kind === "column" && filter.value !== "";
	const globalFiltered = filter.kind === "global" && filter.value !== "";
	await expect(component.locator("thead th.filtering")).toHaveCount(columnFiltered ? 1 : 0);
	if (columnFiltered) {
		await expect(component.locator(`thead th.mat-column-${filter.column}`)).toHaveClass(filteringClass);
	}
	const globalFilterButton = component.locator(".button-global-filter");
	if (globalFiltered) {
		await expect(globalFilterButton).toHaveClass(filterEnabledClass);
	} else {
		await expect(globalFilterButton).not.toHaveClass(filterEnabledClass);
	}
}

async function expectMenuState(page: Page, trigger: Locator, input: Locator, payload: FilterOverlayPayload): Promise<void> {
	const panel = page.locator(filterPanelSelector);
	if (payload.menu === "open") {
		await expect(panel).toHaveCount(1);
		await expect(panel).toBeVisible();
		await expect(page.locator(backdropSelector)).toHaveCount(1);
		await expect(input).toHaveCount(1);
		await expect(input).toBeVisible();
		await expect(input).toHaveValue(payload.filter.value);
		await expect(trigger).toHaveAttribute("aria-expanded", "true");
		// The legacy menu does not autofocus its field: focus stays on the clicked trigger until typing.
		if (payload.filter.value === "") {
			await expectFocusVisible(trigger, false);
		} else {
			await expectFocusVisible(input, true);
		}
	} else {
		await expect(panel).toHaveCount(0);
		await expect(input).toHaveCount(0);
		await expect(page.locator(backdropSelector)).toHaveCount(0);
		await expect(trigger).not.toHaveAttribute("aria-expanded", "true");
		await expectFocusVisible(trigger, false);
	}
	await expect(page.locator(tooltipSelector).filter({ visible: true })).toHaveCount(0);
}

async function measure(locator: Locator): Promise<{ x: number; y: number; width: number; height: number }> {
	const box = await locator.boundingBox();
	if (!box) {
		throw new Error(`${locator.toString()} must have measurable geometry.`);
	}
	return box;
}

async function positionTable(page: Page, component: Locator, tableTop: number): Promise<void> {
	await component.evaluate((element, top) => {
		element.scrollIntoView({ block: "start", inline: "nearest" });
		let scroller = element.parentElement;
		while (
			scroller &&
			!(scroller.scrollHeight > scroller.clientHeight && /(?:auto|scroll)/u.test(getComputedStyle(scroller).overflowY))
		) {
			scroller = scroller.parentElement;
		}
		(scroller ?? document.scrollingElement ?? document.documentElement).scrollTop += element.getBoundingClientRect().top - top;
	}, tableTop);
	await stabilizeVisualPage(page);
	// A fixed Table position keeps the capture clear of the Showcase's floating header and footer actions.
	expect((await measure(component)).y).toBe(tableTop);
}

async function overlayClip(
	component: Locator,
	panel: Locator,
	payload: FilterOverlayPayload
): Promise<{ x: number; y: number; width: number; height: number }> {
	if (payload.region.kind !== "component-and-pane") {
		throw new Error("Only open filter menus use a page clip.");
	}
	const [componentBox, panelBox] = await Promise.all([measure(component), measure(panel)]);
	const { padding } = payload.region;
	const left = Math.max(0, Math.floor(Math.min(componentBox.x, panelBox.x - padding)));
	const top = Math.max(0, Math.floor(Math.min(componentBox.y, panelBox.y - padding)));
	const right = Math.min(
		payload.viewport.width,
		Math.ceil(Math.max(componentBox.x + componentBox.width, panelBox.x + panelBox.width + padding))
	);
	const bottom = Math.min(
		payload.viewport.height,
		Math.ceil(Math.max(componentBox.y + componentBox.height, panelBox.y + panelBox.height + padding))
	);
	expect(panelBox.x).toBeGreaterThanOrEqual(0);
	expect(panelBox.x + panelBox.width).toBeLessThanOrEqual(payload.viewport.width);
	expect(componentBox.y + componentBox.height).toBeLessThanOrEqual(payload.viewport.height);
	return { x: left, y: top, width: right - left, height: bottom - top };
}

for (const scenario of executableScenariosForRunner("table-filter-overlay-states")) {
	test(`visual-${scenario.id}`, async ({ page }) => {
		const { payload } = scenario;
		await openRouteFromShowcaseShell(page, tableRoute);
		await page.setViewportSize(payload.viewport);
		await stabilizeVisualPage(page);
		const fixture = page.locator(payload.fixtureSelector);
		const component = fixture.locator("stark-table");
		await expect(fixture).toHaveCount(1);
		await expect(component).toHaveCount(1);
		await fixture.scrollIntoViewIfNeeded();
		// MatIcon fetches this toolbar asset asynchronously after the table is created.
		await expect(component.locator('.header mat-icon[svgicon="sort"] svg path')).toBeVisible();
		const capture = page.locator(scenario.capture.selector);
		await expect(capture).toHaveCount(1);
		await positionTable(page, capture, payload.tableTop);
		await expectRows(component, payload, payload.contract.before);
		await expect(page.locator(filterPanelSelector)).toHaveCount(0);

		const { filter } = payload;
		const trigger =
			filter.kind === "column"
				? component.locator(`thead th.mat-column-${filter.column} .button-filter`)
				: component.locator(".button-global-filter");
		await expect(trigger).toHaveCount(1);
		await trigger.click();
		const panel = page.locator(filterPanelSelector);
		const input = page.locator(`${overlayContainerSelector} input[name="${filter.kind === "column" ? "filter" : "global-filter"}"]`);
		await expect(panel).toBeVisible();
		await expect(input).toBeVisible();
		await expect(input).toHaveValue("");
		await expectFocusVisible(trigger, false);
		const [triggerBox, panelBox] = await Promise.all([measure(trigger), measure(panel)]);
		// The menu opens below the trigger and aligns to its trailing edge (xPosition "before"), pushed
		// inside the viewport; the CDK falls back to the leading edge when there is too little room left.
		expect(panelBox.y).toBe(triggerBox.y + triggerBox.height);
		if (triggerBox.x + triggerBox.width >= panelBox.width) {
			expect(panelBox.x + panelBox.width).toBe(Math.min(triggerBox.x + triggerBox.width, payload.viewport.width));
		} else {
			expect(panelBox.x).toBe(triggerBox.x);
		}

		if (filter.value !== "") {
			await input.click();
			await input.fill(filter.value);
			await expect(input).toHaveValue(filter.value);
		}
		await expectRows(component, payload, payload.contract.after);
		if (payload.menu === "dismissed") {
			// The legacy filter field stops keyboard propagation, so Escape cannot close the menu.
			await page.locator(backdropSelector).click({ position: { x: 5, y: 5 } });
		}

		await page.mouse.move(0, 0);
		await stabilizeVisualPage(page);
		await expectMenuState(page, trigger, input, payload);
		await expectRows(component, payload, payload.contract.after);
		await expectFilterIndicators(component, payload);
		expect((await measure(capture)).y).toBe(payload.tableTop);

		const screenshotOptions = {
			animations: "disabled",
			caret: "hide",
			mask: scenario.maskSelectors.map((selector) => page.locator(selector)),
			maxDiffPixels: scenario.maxDiffPixels,
			threshold: scenario.threshold
		} as const;
		if (payload.region.kind === "component-and-pane") {
			await expect(page).toHaveScreenshot(scenario.snapshotName, {
				...screenshotOptions,
				clip: await overlayClip(capture, panel, payload)
			});
		} else {
			await expect(capture).toHaveScreenshot(scenario.snapshotName, screenshotOptions);
		}
	});
}
