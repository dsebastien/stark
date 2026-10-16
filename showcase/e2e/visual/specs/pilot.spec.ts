import { test } from "../fixtures/visual";
import { pilotVisualComparisons } from "../support/visual-manifest";

for (const comparison of pilotVisualComparisons) {
	test(`visual-${comparison.scenarioId}`, async ({ compareToLegacy }) => {
		await compareToLegacy(comparison);
	});
}
