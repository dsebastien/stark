import { executableScenariosForRunner } from "../manifests/scenarios";
import { expect, stabilizeVisualPage, test } from "../fixtures/visual-test";
import { openRouteFromShowcaseShell } from "../support/navigation";

const prettyPrintRoute = {
	id: "pretty-print",
	menuTrail: ["menu-stark-ui-components", "menu-stark-ui-components-pretty-print"],
	path: "/demo-ui/pretty-print"
} as const;
const prettyPrintScenarios = executableScenariosForRunner("pretty-print-states");

for (const scenario of prettyPrintScenarios) {
	test(`visual-${scenario.id}`, async ({ page }) => {
		expect(scenario.routeId).toBe(prettyPrintRoute.id);
		await openRouteFromShowcaseShell(page, prettyPrintRoute);
		await expect(page.locator("ui-view h1").first()).toBeVisible();
		await stabilizeVisualPage(page);

		const fixture = page.locator(scenario.payload.fixtureSelector);
		await expect(fixture, `${scenario.id} fixture selector must resolve exactly once`).toHaveCount(1);
		await expect(fixture).toBeVisible();

		if (scenario.payload.action.kind === "open-example-tab") {
			const tab = page.locator(scenario.payload.tabSelector).getByText(scenario.payload.action.tabName, { exact: true });
			await expect(tab).toHaveCount(1);
			await tab.click();
		} else if (scenario.payload.action.kind === "format-invalid-json") {
			const textarea = page.locator(scenario.payload.textareaSelector);
			const format = page.locator(scenario.payload.formatSelector);
			const highlighting = page.locator(scenario.payload.highlightingSelector);
			const highlightingInput = highlighting.getByRole("checkbox");
			await expect(textarea).toHaveCount(1);
			await expect(format).toHaveCount(1);
			await expect(highlighting).toHaveCount(1);
			await expect(highlightingInput).toHaveCount(1);
			await textarea.fill(scenario.payload.expectedText);
			await highlighting.locator("label").click();
			await expect(highlightingInput).toBeChecked();
			await format.click();
			const listbox = page.locator('.cdk-overlay-pane [role="listbox"]');
			await expect(listbox).toBeVisible();
			const jsonOption = listbox.getByRole("option", { exact: true, name: "json" });
			await expect(jsonOption).toHaveCount(1);
			await jsonOption.click();
			await expect(listbox).toHaveCount(0);
			await expect(format).toHaveText("json");
		}

		const component = page.locator(scenario.payload.componentSelector);
		const output = page.locator(scenario.payload.outputSelector);
		await expect(component, `${scenario.id} component selector must resolve exactly once`).toHaveCount(1);
		await expect(output, `${scenario.id} output selector must resolve exactly once`).toHaveCount(1);
		await expect(output).toHaveCSS("width", `${scenario.payload.expectedCssWidth}px`);
		await expect(component).toHaveClass(/(?:^|\s)stark-pretty-print(?:\s|$)/u);
		if (scenario.payload.expectedText.length === 0) {
			await expect(output).not.toBeVisible();
		} else {
			await expect(output).toBeVisible();
			await expect(output).toContainText(scenario.payload.expectedText.slice(0, 24));
		}
		expect(await component.textContent()).toBe(scenario.payload.expectedText);

		const code = output.locator(":scope > code");
		if (scenario.payload.expectedHighlighted) {
			await expect(code).toHaveCount(1);
			await expect(output).toHaveClass(scenario.payload.expectedLanguageClass!);
			await expect(code).toHaveClass(scenario.payload.expectedLanguageClass!);
			await expect(code.locator("span.token")).not.toHaveCount(0);
		} else {
			await expect(code).toHaveCount(0);
			expect(scenario.payload.expectedLanguageClass).toBeNull();
		}
		if (scenario.payload.action.kind === "format-invalid-json") {
			const highlightingInput = page.locator(scenario.payload.highlightingSelector).getByRole("checkbox");
			await expect(highlightingInput).toBeChecked();
			await expect(component.locator(":scope > div > pre")).toHaveCount(1);
			await expect(component.locator(":scope > div > div > pre")).toHaveCount(0);
		}

		await stabilizeVisualPage(page);
		const outputBox = await output.boundingBox();
		expect(outputBox, `${scenario.id} output must have capture geometry`).not.toBeNull();
		if (!outputBox) {
			throw new Error(`${scenario.id} output has no capture geometry.`);
		}
		if (scenario.payload.expectedText.length === 0) {
			expect(outputBox.height).toBe(0);
		} else {
			expect(outputBox.height).toBeGreaterThan(0);
		}
		expect(outputBox.width).toBeCloseTo(scenario.payload.expectedWidth, 2);
		if (scenario.payload.capturePadding > 0) {
			expect(outputBox.x).toBeGreaterThanOrEqual(scenario.payload.capturePadding);
			expect(outputBox.y).toBeGreaterThanOrEqual(scenario.payload.capturePadding);
			const screenshot = await page.screenshot({
				animations: "disabled",
				caret: "hide",
				clip: {
					x: outputBox.x - scenario.payload.capturePadding,
					y: outputBox.y - scenario.payload.capturePadding,
					width: outputBox.width + scenario.payload.capturePadding * 2,
					height: outputBox.height + scenario.payload.capturePadding * 2
				},
				mask: scenario.maskSelectors.map((selector) => page.locator(selector)),
				scale: "css"
			});
			expect(screenshot).toMatchSnapshot(scenario.snapshotName, {
				maxDiffPixels: scenario.maxDiffPixels,
				threshold: scenario.threshold
			});
		} else {
			await output.scrollIntoViewIfNeeded();
			await expect(output).toHaveScreenshot(scenario.snapshotName, {
				animations: "disabled",
				caret: "hide",
				mask: scenario.maskSelectors.map((selector) => page.locator(selector)),
				maxDiffPixels: scenario.maxDiffPixels,
				threshold: scenario.threshold
			});
		}
	});
}
