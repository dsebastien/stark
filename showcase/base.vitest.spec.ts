import type {} from "vitest/globals";

/* eslint-disable import/no-unassigned-import */
import "zone.js/plugins/vitest-patch";
/* eslint-enable import/no-unassigned-import */

(globalThis as typeof globalThis & { ENV: string }).ENV = "development";
