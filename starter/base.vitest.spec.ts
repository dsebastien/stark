import type {} from "vitest/globals";

/* eslint-disable import/no-unassigned-import */
import "zone.js/plugins/vitest-patch";
/* eslint-enable import/no-unassigned-import */

// define global environment variable (used in some places in stark-core and stark-ui)
(globalThis as typeof globalThis & { ENV: string }).ENV = "development";
