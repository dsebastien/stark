"use strict";
import type {} from "vitest/globals";

/* eslint-disable import/no-unassigned-import */
import "zone.js/plugins/vitest-patch";
/* eslint-enable import/no-unassigned-import */

// See https://developer.mozilla.org/en-US/docs/Web/API/Element/matches#Polyfill
/* eslint-disable @typescript-eslint/unbound-method */
if (!Element.prototype.matches) {
	Element.prototype.matches = (<any>Element.prototype).msMatchesSelector || Element.prototype.webkitMatchesSelector;
}

// See: https://developer.mozilla.org/en-US/docs/Web/API/NodeList/forEach#Polyfill
if ((<any>window).NodeList && !NodeList.prototype.forEach) {
	(<any>NodeList.prototype).forEach = Array.prototype.forEach;
}

/* eslint-enable @typescript-eslint/unbound-method */

// define global environment variable (used in some places in stark-core and stark-ui)
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
globalThis["ENV"] = "development";
