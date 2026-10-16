# Guide for migration from Stark 12 to Stark 13

This guide describes the changes required to migrate a Stark 12 application to the Stark 13 baseline built on Angular 22.
It is intended for downstream applications that follow the structure of the Stark starter or showcase.

The migration is deliberately organized in the same order as the implementation branches:

1. dependencies and toolchain;
2. native Angular build;
3. unit testing;
4. application and UI compatibility;
5. cleanup and validation.

Use the current `starter` application as the executable reference. Do not copy local `file:` dependency paths from this repository into a consuming application. Replace them with the published compatible package versions.

## Starting point

This guide assumes that the application already runs on Stark 12 and Angular 16. Applications on an older version must first apply the earlier Stark and Angular migration guides in order.

Before changing the application:

- create a migration branch;
- record a clean build, lint, and test baseline;
- inventory custom Webpack hooks, Karma/Jasmine helpers, Protractor tests, Angular Material overrides, and selectors that target `.mat-*` internals;
- compare application-specific configuration with `starter` rather than replacing files blindly;
- keep `src/stark-app-config.json` and `src/stark-app-metadata.json` as the source of application configuration and metadata.

## Step 1: Upgrade dependencies and the toolchain

### Runtime requirements

Use at least:

- Node.js `22.22.3`;
- npm `10.9.4`;
- Angular and Angular CLI `22.0.1`;
- TypeScript `6.0.3`;
- RxJS `7.8.2`;
- Zone.js `0.16.2`.

Keep all Angular framework packages, Angular CLI, Angular CDK, Angular Material, the Material adapter, and `@angular/build` on the same Angular 22 release line.

### Stark and related packages

Upgrade every `@nationalbankbelgium/stark-*` package together. Do not mix Stark 12 and Stark 13 packages in one application.

Also use Angular 22 compatible releases of:

- `@nationalbankbelgium/code-style`;
- `@nationalbankbelgium/eslint-config`;
- `@uirouter/angular`;
- `@ngrx/store`, `@ngrx/effects`, and `@ngrx/store-devtools`;
- `@ngx-translate/core`;
- `@angular-eslint/*` and `@typescript-eslint/*`.

The reference workspace uses NgRx `21.1.1`, Angular ESLint `22`, TypeScript ESLint `8`, and ESLint `9`.

### Extend the shared Angular 22 TypeScript preset

Make the application's root `tsconfig.json` extend the Angular 22 preset published by `@nationalbankbelgium/code-style`:

```json
{
  "extends": "@nationalbankbelgium/code-style/tsconfig/6.0.x/ng22",
  "compilerOptions": {
    "baseUrl": "./src",
    "outDir": "./dist",
    "typeRoots": ["./node_modules/@types", "./node_modules/@nationalbankbelgium/stark-build/typings"]
  },
  "exclude": ["node_modules", "dist", "src/assets"]
}
```

Keep application-specific paths, output folders, type roots, and exclusions in the application config. The shared preset supplies the TypeScript 6 strict baseline and Angular 22 compiler settings, including preserved modules, bundler resolution, isolated-module compilation, and strict template checks.

Do not copy the Stark monorepo's `tsconfig.base.json` and do not extend a retired Stark-Build tsconfig. The starter and showcase extend the published code-style preset directly so their configuration remains portable outside this repository.

### Add the native Angular build and test packages

Add these packages to the application dependencies or development dependencies as appropriate:

```json
{
  "@angular/build": "^22.0.1",
  "@vitest/coverage-v8": "^4.1.9",
  "jsdom": "^28.1.0",
  "vitest": "^4.1.9"
}
```

### Remove retired dependencies

Remove dependencies that only supported the old Stark build or test stack:

- `@angular-builders/custom-webpack`;
- `@angular-devkit/build-angular` when no application-specific target still needs it;
- `@angularclass/hmr`;
- `@types/webpack` and `@types/webpack-env` when no application code imports them;
- `moment-locales-webpack-plugin`;
- `webpack-bundle-analyzer` and direct Webpack scripts used by the old Stark build;
- Karma, Jasmine, their launchers/reporters, and their type packages after Step 3 is complete;
- Protractor, Puppeteer used only by Protractor, BrowserStack Local, and WebDriver manager scripts after Step 3 is complete.

If the application has its own Webpack customization unrelated to Stark, migrate that customization separately to a supported Angular builder feature. Stark 13 does not provide a custom-Webpack compatibility layer.

### TypeScript and lint compatibility

TypeScript 6 and the current ESLint rules reject several broad legacy types. Replace them with explicit signatures:

```ts
// Before
let callback: Function;

// After
let callback: (...args: unknown[]) => void;
```

Use `VoidFunction` for no-argument callbacks and concrete generic signatures when arguments or return values matter.

The migrated Stark workspace intentionally keeps its NgModule-based application architecture and existing template control flow. A downstream application taking the same incremental path may temporarily disable these migration-only preferences in its local ESLint configuration:

```json
{
  "@angular-eslint/prefer-inject": "off",
  "@angular-eslint/prefer-standalone": "off",
  "@angular-eslint/template/prefer-control-flow": "off"
}
```

These are local migration choices, not a requirement imposed by Stark packages. New application code may adopt `inject`, standalone APIs, and built-in control flow independently.

### Reinstall cleanly

After updating manifests:

1. remove the old `node_modules` directories and stale Angular caches;
2. regenerate the lockfile with the selected published package versions;
3. use `npm ci` in CI;
4. verify that only one Angular 22 version line is resolved.

Do not publish or commit the local tarball paths used by the Stark migration workspace.

## Step 2: Move to Angular's native build

### Replace custom builders

Use the Angular 22 native builders:

| Target                 | Builder                       |
| ---------------------- | ----------------------------- |
| application build      | `@angular/build:application`  |
| development server     | `@angular/build:dev-server`   |
| translation extraction | `@angular/build:extract-i18n` |
| unit tests             | `@angular/build:unit-test`    |

Remove `customWebpackConfig`, `indexTransform`, custom-Webpack builders, direct Webpack entry points, and the old Stark Webpack configuration files.

The application builder uses `browser` for the browser entry point instead of the old `main` option. A minimal application target looks like this:

```json
{
  "build": {
    "builder": "@angular/build:application",
    "options": {
      "outputPath": {
        "base": "dist",
        "browser": ""
      },
      "index": {
        "input": ".stark/generated/index.html",
        "output": "index.html"
      },
      "browser": "src/main.browser.ts",
      "polyfills": ["src/polyfills.browser.ts"],
      "tsConfig": "tsconfig.app.json",
      "define": {
        "ENV": "\"development\"",
        "HMR": "false"
      },
      "assets": [],
      "styles": ["src/styles/styles.scss"],
      "scripts": []
    },
    "configurations": {
      "development": {},
      "hmr": {
        "define": {
          "ENV": "\"development\"",
          "HMR": "true"
        },
        "fileReplacements": [
          {
            "replace": "src/environments/environment.ts",
            "with": "src/environments/environment.hmr.ts"
          }
        ]
      },
      "production": {
        "optimization": true,
        "aot": true,
        "define": {
          "ENV": "\"production\"",
          "HMR": "false"
        },
        "outputHashing": "all",
        "subresourceIntegrity": true,
        "sourceMap": false,
        "namedChunks": false,
        "extractLicenses": true,
        "fileReplacements": [
          {
            "replace": "src/environments/environment.ts",
            "with": "src/environments/environment.prod.ts"
          }
        ]
      }
    }
  }
}
```

Copy the complete assets, styles, `allowedCommonJsDependencies`, `baseHref`, and `deployUrl` settings from the existing application into the new target. The example above intentionally omits application-specific values.

### Define `ENV` and `HMR` without Webpack

Stark applications still use the compile-time globals `ENV` and `HMR`. Define them through the native builder as shown above.

Include Stark's declarations so TypeScript recognizes the globals:

```json
{
  "compilerOptions": {
    "typeRoots": ["./node_modules/@types", "./node_modules/@nationalbankbelgium/stark-build/typings"]
  }
}
```

Do not recreate the old `DefinePlugin` configuration. Angular's development server manages HMR itself, so application bootstrap code must not call `module.hot`, `createNewHosts`, or `@angularclass/hmr`.

Configure the HMR serve target natively:

```json
{
  "serve": {
    "builder": "@angular/build:dev-server",
    "options": {
      "buildTarget": "your-app:build"
    },
    "configurations": {
      "development": {
        "buildTarget": "your-app:build:development"
      },
      "hmr": {
        "hmr": true,
        "buildTarget": "your-app:build:hmr"
      },
      "production": {
        "buildTarget": "your-app:build:production"
      }
    },
    "defaultConfiguration": "development"
  }
}
```

### Generate `index.html` at build time

`src/index.html` remains the checked-in template. The final HTML must be generated before every build and serve command by:

```text
@nationalbankbelgium/stark-build/config/index-html.generator.js
```

Add scripts equivalent to:

```json
{
  "scripts": {
    "prepare:index-html": "node ./node_modules/@nationalbankbelgium/stark-build/config/index-html.generator.js --project your-app --input src/index.html --output .stark/generated/index.html",
    "build:dev": "npm run prepare:index-html -- --configuration development && ng build",
    "build:prod": "npm run prepare:index-html -- --configuration production && ng build -c production",
    "serve:dev": "npm run prepare:index-html -- --configuration development && ng serve"
  }
}
```

Add `.stark/` to `.gitignore`. The generated file is build output and must not be committed.

Point `projects.<application>.architect.build.options.index.input` to `.stark/generated/index.html` as shown in the build example.

### Keep metadata dynamic

Do not replace Stark metadata placeholders with hard-coded values in `src/index.html`.

Use the existing placeholder groups:

- `starkOptions.starkAppMetadata.*`;
- `starkOptions.starkAppConfig.*`;
- `starkOptions.metadata.*`.

For example:

```html
<!doctype html>
<html lang="<%= starkOptions.starkAppConfig.defaultLanguage %>">
  <head>
    <meta charset="utf-8" />
    <title><%= starkOptions.starkAppMetadata.name %></title>
    <meta name="description" content="<%= starkOptions.starkAppMetadata.description %>" />
  </head>
  <body>
    <app-root></app-root>
  </body>
</html>
```

This is required for deployments that replace `src/stark-app-metadata.json` or `src/stark-app-config.json` before building. The replacement must happen before `prepare:index-html`; otherwise the generated HTML contains stale metadata.

The generator reads the selected Angular project and configuration, applies configuration-aware file replacements, and derives `starkOptions.metadata.BASE_URL` from the effective `baseHref`.

### Generate additional head elements

Move application-specific links and meta tags to `config/index-head-config.js`. The generator loads this file automatically when it exists:

```js
module.exports = {
  link: [
    { rel: "manifest", href: "manifest.json" },
    { rel: "shortcut icon", type: "image/x-icon", href: "favicon.ico" }
  ],
  meta: [
    {
      name: "application-name",
      content: "<%= starkOptions.starkAppMetadata.name %>"
    },
    { name: "theme-color", content: "#0076c8" }
  ]
};
```

Relative `href` attributes are prefixed with the effective base URL by default. To control prefixing explicitly, add a boolean property whose name is prefixed with `=`:

```js
{ rel: "apple-touch-icon", href: "assets/icon.png", "=href": false }
{ name: "msapplication-TileImage", content: "assets/tile.png", "=content": true }
```

If the application does not need generated head tags, omit `config/index-head-config.js`.

### Move development-server headers

Move headers formerly emitted by the Stark Webpack development server to `projects.<application>.architect.serve.options.headers`:

```json
{
  "headers": {
    "Access-Control-Allow-Origin": "*",
    "Content-Security-Policy": "base-uri 'self'; default-src 'self'",
    "X-Frame-Options": "deny",
    "X-Content-Type-Options": "nosniff"
  }
}
```

Keep the application's real CSP directives. The abbreviated policy above is only a structural example.

### Update Browserslist

Use a browser query supported by Angular 22. The starter currently uses:

```text
[production]
baseline widely available on 2026-05-07

[modern]
baseline widely available on 2026-05-07

[ssr]
node 22

baseline widely available on 2026-05-07
```

Avoid broad queries such as `last 8 versions`, which can select browser releases outside Angular 22's supported range and produce CLI warnings.
The date above matches the Baseline date embedded in the repository's `@angular/build` 22.0.8 release; recheck it when intentionally upgrading the Angular build line.

## Step 3: Migrate unit tests to Vitest

### Configure the Angular unit-test builder

Replace the Karma target with:

```json
{
  "test": {
    "builder": "@angular/build:unit-test",
    "options": {
      "buildTarget": "your-app:build:unit-test",
      "runner": "vitest",
      "runnerConfig": "vitest.config.mjs",
      "setupFiles": ["base.vitest.spec.ts"],
      "tsConfig": "tsconfig.spec.json"
    }
  }
}
```

Add a build configuration that includes `zone.js/testing`:

```json
{
  "unit-test": {
    "polyfills": ["src/polyfills.browser.ts", "zone.js/testing"]
  }
}
```

Use `--coverage`, not the retired Karma-style `--code-coverage` flag:

```json
{
  "test-fast": "ng test",
  "test-fast:ci": "ng test --watch=false --coverage"
}
```

### Add the Vitest setup file

Create `base.vitest.spec.ts`:

```ts
"use strict";
import type {} from "vitest/globals";
import "zone.js/plugins/vitest-patch";

globalThis["ENV"] = "development";
```

Retain any browser polyfills genuinely required by the application. Do not copy obsolete IE-only polyfills from older projects.

### Update `tsconfig.spec.json`

Remove Jasmine types and include the Vitest setup:

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "types": ["node"]
  },
  "files": ["base.vitest.spec.ts", "src/polyfills.browser.ts"],
  "include": ["src/**/*.spec.ts", "src/**/*.d.ts"],
  "exclude": ["src/assets", "dist", "src/**/*.e2e.ts", "e2e/**/*.ts"]
}
```

The path aliases in the monorepo's starter and showcase point directly to local package sources. A normal downstream application consuming published Stark packages does not need those aliases.

### Configure reporting when needed

`@nationalbankbelgium/stark-testing/vitest-reporting` exposes the shared Stark coverage and JUnit report layout. A monorepo or application may use it from `vitest.config.mjs`, or define equivalent Vitest reporters locally.

The reference application also inlines Stark and `lodash-es` dependencies for Vitest and uses a single fork worker on Windows. Treat those aliases and worker limits as environment-specific, not mandatory public API.

### Convert Jasmine APIs

Typical conversions are:

| Jasmine                       | Vitest                                    |
| ----------------------------- | ----------------------------------------- |
| `jasmine.createSpy()`         | `vi.fn()`                                 |
| `jasmine.createSpyObj()`      | typed object containing `vi.fn()` methods |
| `spy.and.returnValue(value)`  | `spy.mockReturnValue(value)`              |
| `spy.and.callFake(fn)`        | `spy.mockImplementation(fn)`              |
| `spy.calls.reset()`           | `spy.mockClear()`                         |
| `spy.calls.mostRecent().args` | `spy.mock.calls.at(-1)`                   |
| Jasmine `done` callbacks      | returned promises or `async` tests        |
| global `fail(message)`        | `throw new Error(message)`                |

Stark Core testing exports typed helpers such as `createMockFn`, `createMockObject`, `VitestMock`, and `VitestMockObject` for consumers that need Stark-compatible mocks.

Angular 22 tests should configure all standalone components in `imports`, not `declarations`. NgModule-declared application components can remain in a small test NgModule when that preserves the application architecture.

### Retire shared E2E assumptions

Stark 13 no longer ships Protractor configuration, application E2E folders, BrowserStack wiring, or a shared maintained browser-E2E setup.

Remove obsolete `e2e` projects and scripts from `angular.json` and `package.json`. If the application requires browser E2E coverage, own that setup in the application with a currently supported tool. It is not part of the Stark package contract.

## Step 4: Adapt application and UI code

### Angular Material remains on the M2 compatibility API

Angular Material 22 supports M3, but upgrading Angular does not require a forced visual migration to M3. Stark 13 intentionally compiles its established visual system through Material's supported M2 compatibility APIs.

Use the Stark typography config when emitting Material typography:

```scss
@use "@angular/material" as mat;
@use "@nationalbankbelgium/stark-ui" as stark-ui;

@include mat.all-component-typographies(stark-ui.$typography-config);
@include mat.core();
@include stark-ui.set-stark-ui-styles();
```

Do not call the removed `mat.m2-define-legacy-typography-config`. Stark's `$typography-config` now maps the historical Stark values onto current Material M2 level names.

### Replace obsolete typography classes

Material's old display classes are no longer the correct public hierarchy names. Replace usages such as:

| Old class           | Current class     |
| ------------------- | ----------------- |
| `.mat-display-4`    | `.mat-headline-1` |
| `.mat-display-3`    | `.mat-headline-2` |
| `.mat-display-2`    | `.mat-headline-3` |
| `.mat-display-1`    | `.mat-headline-4` |
| `.mat-headline`     | `.mat-headline-5` |
| `.mat-title`        | `.mat-headline-6` |
| `.mat-subheading-2` | `.mat-subtitle-1` |

Use `.mat-body-1`, `.mat-body-2`, and `.mat-caption` for body and caption text.

### Preserve form-field spacing

Material's MDC form-field spacing differs from the legacy implementation. Keep Material's fixed subscript sizing as the application default so fields retain the space expected by existing Stark layouts. Use `subscriptSizing="dynamic"` only on an individual field whose surrounding layout explicitly supports a changing height.

Stark's date, date-range, date-time, and compact table-dialog styles apply narrowly scoped MDC sizing tokens to preserve their legacy geometry. Avoid a global `MAT_FORM_FIELD_DEFAULT_OPTIONS` override: it changes every field's height and can reintroduce label/value overlap or clipped dialog content.

### Preserve overlay dismissal behavior

Angular CDK 22 enables native popover-backed overlays by default. Stark applications that retain the established overlay layout and backdrop behavior must opt out at the application root:

```ts
import { OVERLAY_DEFAULT_CONFIG } from "@angular/cdk/overlay";

providers: [{ provide: OVERLAY_DEFAULT_CONFIG, useValue: { usePopover: false } }];
```

This keeps selects, menus, date pickers, and dialogs on the connected-overlay path used by Stark 12, including dismissal when the user clicks the backdrop. Apply the provider once in the root application module; do not add it independently to feature modules.

### Review Material selectors

The legacy Material DOM and CSS classes were replaced by MDC equivalents. Audit every application override that targets Angular Material internals.

Prefer:

1. a Stark-owned stable class;
2. a documented Material host or control-type class;
3. a narrowly scoped `.mat-mdc-*` selector only when no public styling API exists.

Do not expose Material implementation classes as a new downstream contract. Stark keeps stable hooks such as `stark-dropdown-mat-form-field` for that reason.

The repository's reviewed selector inventory and rationale for each remaining compatibility bridge are recorded in [Material 22 compatibility](./stark-ui/MATERIAL_22_COMPATIBILITY.md).

Common host classes now include `.mat-mdc-form-field`, `.mat-mdc-button`, `.mat-mdc-icon-button`, `.mat-mdc-card`, `.mat-mdc-dialog-container`, `.mat-mdc-snack-bar-container`, `.mat-mdc-table`, and `.mat-mdc-list-item`.

For dialog tests, the element remains `mat-dialog-container`; the MDC host selector is:

```css
mat-dialog-container.mat-mdc-dialog-container
```

### Standalone-compatible Stark components

Many Stark UI components are now standalone internally, while their existing Stark NgModules remain available for compatibility. Existing downstream NgModule imports can remain. When importing a standalone Stark component directly, place it in an Angular component or NgModule `imports` array.

Test hosts declared with `standalone: true` must also be placed in TestBed `imports`.

### Public TypeScript contracts

Broad callback types were narrowed to explicit signatures. The most visible contracts are:

```ts
export type StarkActionCall = ($event: Event, scope: any) => void;
export type StarkFormButtonClick = VoidFunction;
```

Update callbacks that relied on incompatible parameters or return types. Calls that already matched the documented behavior require no runtime change.

Translation contracts are also more precise. `StarkLocale.translations` now uses ngx-translate's `TranslationObject`, and `commonCoreTranslations` is a language-code keyed record rather than an array-shaped object. Valid nested translation objects remain source-compatible; replace casts or array operations that depended on the former broad declarations.

The Stark-owned mask implementation exports its consumer configuration types directly from `@nationalbankbelgium/stark-ui/src/modules/input-mask-directives`, including `StarkTextMaskConfig`, `StarkNumberMaskConfig`, `StarkTimestampMaskConfig`, `StarkMask`, and the pipe/result types. Existing directive inputs and formatted values are preserved; consumers must no longer import types from the abandoned `angular2-text-mask` or `text-mask-*` packages.

`stringMap` now has an explicit serializer-factory signature and accepts an optional target type. Existing valid calls remain supported.

### Dropdown panel width

`stark-dropdown` adds an optional input:

```html
<stark-dropdown [panelWidth]="'212px'"></stark-dropdown>
```

The default is `null`, preserving Material's default behavior. Only set it when the application needs an explicit overlay width.

### Date, dialog, table, snackbar, menu, and button overrides

Recheck application-specific styling around:

- date picker, date range picker, and date-time picker form-field hosts and overlays;
- dialog title/content/action spacing;
- table sticky cells and multi-sort dialogs;
- snackbar panel, label, and action layout;
- menu/list item content and trailing icons;
- icon-button state layers and ripples;
- button text casing;
- card title and content typography.

Do not copy showcase pixel overrides into an application unless that application intentionally uses the same visual design. Use the showcase to identify expected Stark behavior, then keep application-specific styling local.

### Application bootstrap and routes

Keep the existing Stark bootstrap flow, but remove application code that manually integrates Webpack HMR. Angular's dev server now owns HMR lifecycle management. `AbstractStarkMain.bootstrapHmr` was a protected Webpack-specific extension point and has been removed; subclasses must delete overrides or calls to it.

Review route names and redirects while upgrading UI-Router. Invalid state names that were previously tolerated can now surface as transition rejections. Route hooks must return valid deregistration callbacks.

## Step 5: Remove legacy files and validate

### Remove retired files

Delete files that are no longer referenced:

- `karma.conf.js` files;
- Protractor configuration and `e2e/` folders;
- old `base.spec.ts` files replaced by `base.vitest.spec.ts`;
- Webpack configuration, partials, metadata helpers, index transforms, and bundle-analyzer scripts;
- E2E-specific Angular environment files;
- BrowserStack-only scripts and workflow steps.

Do not keep compatibility files merely because they existed in the starter. Every retained file must have a live consumer.

### Update CI

CI should use Node 22, install from the lockfile, and run the maintained targets:

```text
npm ci
npm run lint
npm run test:ci
npm run build:prod
```

Use application-specific browser E2E jobs only when the application owns and maintains them.

### Validate generated metadata

Before accepting the production build:

1. replace `stark-app-metadata.json` with recognizable test values;
2. run the same production build command used by deployment;
3. inspect generated `index.html`;
4. verify language, title, description, application name, icon URLs, and base URL;
5. restore the real metadata source.

This check proves that metadata replacement happens before index generation and that no hard-coded values bypass deployment configuration.

### Final checklist

- [ ] Node, npm, Angular, TypeScript, RxJS, Zone.js, NgRx, UI-Router, and Stark packages are on compatible release lines.
- [ ] No local migration tarball path remains in application manifests or lockfiles.
- [ ] No custom-Webpack Stark builder, `indexTransform`, or Webpack HMR code remains.
- [ ] `ENV` and `HMR` are provided by Angular `define` and covered by Stark typings.
- [ ] Every build and serve script generates `.stark/generated/index.html` first.
- [ ] Production metadata replacement is reflected in final `index.html`.
- [ ] Browserslist selects only Angular 22 supported browsers.
- [ ] Karma/Jasmine tests have moved to the Angular unit-test builder and Vitest.
- [ ] Protractor and shared BrowserStack configuration have been removed.
- [ ] Application-owned E2E tooling, if any, is independently maintained.
- [ ] Material typography uses current hierarchy classes and Stark's typography config.
- [ ] Form-field spacing and application Material overrides have been reviewed under MDC.
- [ ] No downstream CSS contract depends unnecessarily on raw Material internals.
- [ ] Lint passes.
- [ ] All unit tests pass with coverage where required.
- [ ] Development and production builds pass.
- [ ] The application starts without Angular builder, browser-support, or Material console warnings.
- [ ] Critical routes and interactive Stark components have been checked in a real browser.

## Reference implementation

The authoritative executable examples are:

- `starter/package.json` and `starter/angular.json` for scripts and native builders;
- `starter/src/index.html` and `starter/config/index-head-config.js` for index generation;
- `starter/base.vitest.spec.ts`, `starter/vitest.config.mjs`, and `starter/tsconfig.spec.json` for tests;
- `starter/src/styles/_theme.scss` for Angular Material 22 typography and Stark styles;
- `showcase` for the complete component and visual integration surface.

When this guide and the reference applications differ, treat the reference application behavior and automated tests as the executable source of truth, then correct the guide in the same change.
