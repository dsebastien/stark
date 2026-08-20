import { expect, test } from "@playwright/test";
import { recordShellRouteTransitions, representativeRoutes } from "../support/navigation";

test("records representative UI-Router transitions through the visible Showcase shell", async ({ page }, testInfo) => {
	const transitions = await recordShellRouteTransitions(page);

	await testInfo.attach("route-transitions.json", {
		body: JSON.stringify(transitions, null, 2),
		contentType: "application/json"
	});

	expect(transitions.map(({ id, to }) => ({ id, to }))).toEqual(
		representativeRoutes.map(({ id, path }) => ({ id, to: path }))
	);
	expect(transitions.every(({ from, to }) => from !== to), "each shell click must produce a route transition").toBe(true);
});
