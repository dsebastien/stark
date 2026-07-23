"use strict";
import type {} from "vitest/globals";
/* eslint-disable import/no-unassigned-import */
import "core-js/es";
import "core-js/proposals/reflect-metadata";
import "zone.js";
import "zone.js/plugins/sync-test";
import "zone.js/plugins/proxy";
import "zone.js/plugins/async-test";
import "zone.js/plugins/fake-async-test";
import "zone.js/plugins/vitest-patch";
/* eslint-enable import/no-unassigned-import */

// IE polyfills

// See https://developer.mozilla.org/en-US/docs/Web/API/Element/matches#Polyfill
if (!Element.prototype.matches) {
	// eslint-disable-next-line @typescript-eslint/unbound-method
	Element.prototype.matches = (<any>Element.prototype).msMatchesSelector || Element.prototype.webkitMatchesSelector;
}

// See: https://developer.mozilla.org/en-US/docs/Web/API/NodeList/forEach#Polyfill
if ((<any>window).NodeList && !NodeList.prototype.forEach) {
	// eslint-disable-next-line @typescript-eslint/unbound-method
	(<any>NodeList.prototype).forEach = Array.prototype.forEach;
}

// define global environment variable (used in some places in stark-core and stark-ui)
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
globalThis["ENV"] = "development";
