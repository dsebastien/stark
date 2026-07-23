"use strict";
import type {} from "vitest/globals";
/* eslint-disable import/no-unassigned-import */
import "core-js/es";
import "core-js/proposals/reflect-metadata";
import "zone.js";
import "zone.js/plugins/long-stack-trace-zone";
import "zone.js/plugins/sync-test";
import "zone.js/plugins/proxy";
import "zone.js/plugins/async-test";
import "zone.js/plugins/fake-async-test";
import "zone.js/plugins/vitest-patch";
/* eslint-enable import/no-unassigned-import */

// define global environment variable (used in some places in stark-core and stark-ui)
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
globalThis["ENV"] = "development";
