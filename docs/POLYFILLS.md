# Polyfills

Angular 22 targets its documented Baseline browser set. Internet Explorer and other browsers outside that set are not supported by Stark 13, and the old `core-js` 2/IE compatibility block must not be restored.

The starter and showcase load Zone.js through the build target's `polyfills` option:

```json
{
  "projects": {
    "application": {
      "architect": {
        "build": {
          "options": {
            "polyfills": ["zone.js"]
          }
        }
      }
    }
  }
}
```

Add an application polyfill only when a supported target browser lacks a web platform feature the application actually uses. Put those imports in an application-owned file such as `src/polyfills.browser.ts`, then include that file in the `polyfills` array after `zone.js`:

```json
"polyfills": ["zone.js", "src/polyfills.browser.ts"]
```

Keep the application's `.browserslistrc` within Angular 22's supported browser set. See the [Angular browser support policy](https://angular.dev/reference/versions#browser-support) and the [Stark 13 migration guide](./MIGRATION_GUIDE_STARK_13.md#update-browserslist).
