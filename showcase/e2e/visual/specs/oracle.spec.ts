import { expect, test } from "@playwright/test";
import { getVisualTarget, legacyOracle } from "../support/oracle";

test("legacy Showcase document matches the pinned oracle build", async ({ page }, testInfo) => {
	test.skip(getVisualTarget() !== "legacy", "the candidate must never become the oracle");

	const response = await page.goto(".", { waitUntil: "domcontentloaded" });
	expect(response, "the pinned legacy oracle must be reachable").not.toBeNull();
	expect(response?.status()).toBe(200);

	const observed = {
		baseHref: await page.locator("base").getAttribute("href"),
		etag: response?.headers().etag,
		lastModified: response?.headers()["last-modified"],
		scripts: await page.locator("script[type=module]").evaluateAll((elements) =>
			elements.map((element) => ({
				integrity: element.getAttribute("integrity"),
				path: element.getAttribute("src")
			}))
		),
		stylesheets: await page.locator('link[rel="stylesheet"]').evaluateAll((elements) =>
			elements.map((element) => ({
				integrity: element.getAttribute("integrity"),
				path: element.getAttribute("href")
			}))
		)
	};
	await testInfo.attach("legacy-oracle-build.json", {
		body: JSON.stringify(observed, null, 2),
		contentType: "application/json"
	});

	expect(observed.baseHref).toBe(legacyOracle.baseHref);
	expect(observed.etag).toBe(legacyOracle.build.etag);
	expect(observed.lastModified).toBe(legacyOracle.build.lastModified);
	expect(observed.stylesheets).toEqual(legacyOracle.build.assets.stylesheets);
	expect(observed.scripts).toEqual(legacyOracle.build.assets.scripts);
});
