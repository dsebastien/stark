[![NPM version](https://img.shields.io/npm/v/@nationalbankbelgium/stark-build.svg?logo=npm&logoColor=fff&label=npm+package&color=limegreen)](https://www.npmjs.com/package/@nationalbankbelgium/stark-build)
[![npm](https://img.shields.io/npm/dm/@nationalbankbelgium/stark-build.svg?logo=npm)](https://www.npmjs.com/package/@nationalbankbelgium/stark-build)
[![Build Status](https://github.com/NationalBankBelgium/stark/workflows/build/badge.svg)](https://github.com/NationalBankBelgium/stark/actions?query=workflow%3Abuild)
[![Dependency Status](https://img.shields.io/david/nationalbankbelgium/stark-build)](https://david-dm.org/NationalBankBelgium/stark-build)
[![devDependency Status](https://img.shields.io/david/dev/nationalbankbelgium/stark-build?label=devDependencies)](https://david-dm.org/NationalBankBelgium/stark-build#info=devDependencies)
[![License](https://img.shields.io/npm/l/@nationalbankbelgium/stark-build)](LICENSE)

# Stark Build

`@nationalbankbelgium/stark-build` now contains the remaining build-time helpers that are still shared across Stark consumers on Angular 22.

## Supported surface

- Native Angular builder support for compile-time `ENV` and `HMR` globals through the package typings under `typings/`.
- `config/index-html.generator.js` to generate a final `index.html` from:
  - `src/index.html`
  - `src/stark-app-config.json`
  - `src/stark-app-metadata.json`
  - `config/index-head-config.js`
- `config/html-head-elements.js`, used by the generator for `<head>` tag creation.
- `config/json-server.common.js` for JSON-server based mock backends.

## No webpack path remains

The Angular 22 migration removed the old custom-webpack integration from the supported Stark build chain.
`stark-build` no longer publishes `webpack.config.js` or `index-html.transform.js`.

Use the native Angular builder plus the Stark index generator instead.

## Native Angular 22 workflow

1. Keep `src/index.html` as the checked-in template source.
2. Define application metadata in `src/stark-app-config.json` and `src/stark-app-metadata.json`.
3. Optionally add generated `<head>` tags through `config/index-head-config.js`.
4. Generate `.stark/generated/index.html` before `ng build` and `ng serve`.
5. Point the Angular `index.input` option to the generated file.
6. Use Angular's native `define` option for `ENV` and `HMR`.

## Typings

If your project uses the Stark compile-time globals, include the package typings in `typeRoots`:

```json
{
  "compilerOptions": {
    "typeRoots": ["./node_modules/@types", "./node_modules/@nationalbankbelgium/stark-build/typings"]
  }
}
```

## Reference

See the [Stark 13 migration guide](../../docs/MIGRATION_GUIDE_STARK_13.md#step-2-move-to-angulars-native-build) for the complete downstream Angular 22 setup.
