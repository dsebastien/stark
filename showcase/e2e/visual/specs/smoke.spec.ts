import { expect, test } from "@playwright/test";
import { openRouteFromShowcaseShell, smokeRoute } from "../support/navigation";

test("navigates to a UI demo through the Showcase shell", async ({ page }) => {
	const pageErrors: string[] = [];
	const failedRequests: string[] = [];

	page.on("pageerror", (error) => pageErrors.push(error.message));
	page.on("requestfailed", (request) => {
		const failure = request.failure()?.errorText;
		if (failure && failure !== "net::ERR_ABORTED") {
			failedRequests.push(request.method() + " " + request.url() + " (" + failure + ")");
		}
	});

	await openRouteFromShowcaseShell(page, smokeRoute);
	await expect(page.locator("ui-view h1").first()).toBeVisible();

	expect(pageErrors, "the smoke journey must not raise uncaught page errors").toEqual([]);
	expect(failedRequests, "the smoke journey must not fail network requests").toEqual([]);
});
