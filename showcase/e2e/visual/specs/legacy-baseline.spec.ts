import { expect, test } from "@playwright/test";
import { getVisualTarget } from "../support/oracle";
import { openRouteFromShowcaseShell, representativeRoutes } from "../support/navigation";

test("captures reviewed legacy representative-route artifacts", async ({ page }, testInfo) => {
	test.skip(
		getVisualTarget() !== "legacy" || process.env.STARK_VISUAL_BASELINE_UPDATE !== "1",
		"legacy screenshots and videos require the privileged baseline command"
	);

	const capturedRoutes: string[] = [];
	for (const route of representativeRoutes) {
		await openRouteFromShowcaseShell(page, route);
		await expect(page.locator("ui-view h1").first()).toBeVisible();
		capturedRoutes.push(route.id);
		await testInfo.attach(`legacy-${route.id}.png`, {
			body: await page.screenshot({ fullPage: true }),
			contentType: "image/png"
		});
	}

	await testInfo.attach("captured-routes.json", {
		body: JSON.stringify(capturedRoutes, null, 2),
		contentType: "application/json"
	});
});
