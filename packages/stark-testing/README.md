[![NPM version](https://img.shields.io/npm/v/@nationalbankbelgium/stark-testing.svg?logo=npm&logoColor=fff&label=npm+package&color=limegreen)](https://www.npmjs.com/package/@nationalbankbelgium/stark-testing)
[![npm](https://img.shields.io/npm/dm/@nationalbankbelgium/stark-testing.svg?logo=npm)](https://www.npmjs.com/package/@nationalbankbelgium/stark-testing)
[![Build Status](https://github.com/NationalBankBelgium/stark/workflows/build/badge.svg)](https://github.com/NationalBankBelgium/stark/actions?query=workflow%3Abuild)
[![Dependency Status](https://img.shields.io/david/nationalbankbelgium/stark-testing)](https://david-dm.org/NationalBankBelgium/stark-testing)
[![devDependency Status](https://img.shields.io/david/dev/nationalbankbelgium/stark-testing?label=devDependencies)](https://david-dm.org/NationalBankBelgium/stark-testing#info=devDependencies)
[![License](https://img.shields.io/npm/l/@nationalbankbelgium/stark-testing)](LICENSE)

# Stark Testing

Stark's testing module (aka stark-testing) now provides the shared Vitest reporting helper used by the Angular 22 test path in this repository.
The older shared Karma/Jasmine launcher configuration has been retired from the maintained baseline.

The current public helper surface is `vitest-reporting.mjs`, which centralizes coverage and JUnit output paths for Stark packages and applications.
