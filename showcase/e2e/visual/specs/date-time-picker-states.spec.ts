import { expect, stabilizeVisualPage, test } from "../fixtures/visual-test";
import { openRouteFromShowcaseShell } from "../support/navigation";

const dateTimePickerRoute = {
	id: "date-time-picker",
	menuTrail: ["menu-stark-ui-components", "menu-stark-ui-components-date-time-picker"],
	path: "/demo-ui/date-time-picker"
} as const;

test("date-time picker keeps date and time text in separate bounds", async ({ page }) => {
	await openRouteFromShowcaseShell(page, dateTimePickerRoute);
	await expect(page.locator("ui-view h1").first()).toBeVisible();
	await stabilizeVisualPage(page);

	const fixture = page.locator("example-viewer#reactive-form");
	const label = fixture.locator(".mat-mdc-floating-label, .mat-form-field-label").first();
	const dateInput = fixture.locator("#date-time-picker-form-control-input");
	const timeInput = fixture.locator("#date-time-picker-form-control-time-input");
	await expect(label).toBeVisible();
	await expect(dateInput).toBeVisible();
	await expect(timeInput).toBeVisible();

	const [labelBox, dateBox, timeBox] = await Promise.all([label.boundingBox(), dateInput.boundingBox(), timeInput.boundingBox()]);
	expect(labelBox).not.toBeNull();
	expect(dateBox).not.toBeNull();
	expect(timeBox).not.toBeNull();
	if (!labelBox || !dateBox || !timeBox) {
		throw new Error("Date-time label and inputs must have measurable geometry.");
	}
	expect(labelBox.y + labelBox.height, "floating label must remain above the rendered input text").toBeLessThanOrEqual(dateBox.y + 2);
	expect(dateBox.x + dateBox.width, "date input must end before the time input starts").toBeLessThanOrEqual(timeBox.x);

	await expect(fixture.locator("mat-form-field")).toHaveScreenshot("date-time-picker-populated.png", {
		animations: "disabled",
		caret: "hide",
		maxDiffPixels: 976,
		threshold: 0
	});
});
