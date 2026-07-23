# Angular 22 Review and Improvement Plan

## Purpose

Use this document to review and improve the Stark Angular 22 migration after the migration branches have been split into reviewable layers.

This is a forward-looking quality plan. It is not a history of completed migration work. Record concrete findings, decisions, follow-up changes, and verification evidence here as each branch is reviewed.

## Branch stack

Review the branches in order. Every branch is based on the branch immediately above it in this table.

Read `MIGRATION_BRANCH_STRUCTURE.md` before amending, rebasing, deleting, or pushing any branch in the stack.

| Order | Branch                                  | Parent                                 | Primary scope                                                                    |
| ----- | --------------------------------------- | -------------------------------------- | -------------------------------------------------------------------------------- |
| 1     | `migration/angular-22/01-dependencies`  | `master`                               | Runtime, framework, lint, and package dependency baseline                        |
| 2     | `migration/angular-22/02-build`         | `migration/angular-22/01-dependencies` | Native Angular builders, index generation, build scripts, and CI build wiring    |
| 3     | `migration/angular-22/03-testing`       | `migration/angular-22/02-build`        | Vitest migration and retirement of Karma, Jasmine infrastructure, and Protractor |
| 4     | `migration/angular-22/04-ui`            | `migration/angular-22/03-testing`      | Runtime, component, Material MDC, showcase, starter, and visual compatibility    |
| 5     | `migration/angular-22/05-agent-context` | `migration/angular-22/04-ui`           | Agent guidance, consolidated downstream guide, and this improvement plan         |

When a lower branch changes after a higher branch has been reviewed, rebase or rebuild every affected higher branch and repeat its relevant validation.

## Review method

For each branch:

1. compare it with its direct parent, not with `master`;
2. review findings before proposing broad cleanup;
3. distinguish migration requirements from optional modernization;
4. keep public API and downstream compatibility decisions explicit;
5. add focused tests for confirmed defects;
6. run the smallest relevant validation first, then the branch-level gate;
7. record commands, results, and unresolved risks in this document.

Use one of these statuses for every review item:

- `[ ]` not reviewed;
- `[x]` reviewed and accepted;
- `[-]` reviewed and intentionally deferred, with a reason in the decision log.

## 1. Dependencies review

### Compatibility

- [ ] Verify the Node.js and npm engine ranges against Angular 22 and the supported CI images.
- [ ] Verify that all Angular framework, CLI, CDK, Material, and build packages use one compatible release line.
- [ ] Verify TypeScript, RxJS, Zone.js, NgRx, UI-Router, translation, and Angular ESLint compatibility from their official support statements.
- [ ] Verify every Stark package peer dependency range from a packed downstream consumer, not only from the monorepo.
- [ ] Verify the compatible published versions of `code-style`, `eslint-config`, `ngx-form-errors`, and UI-Router before release.
- [ ] Remove every local `file:` tarball path from release-ready manifests and lockfiles.

### Dependency hygiene

- [ ] Find and remove unused dependencies left by Webpack, Karma, Jasmine, Protractor, BrowserStack, or old polyfills.
- [ ] Confirm each dependency is in `dependencies`, `devDependencies`, or `peerDependencies` for the correct reason.
- [ ] Review duplicate and conflicting transitive package versions.
- [ ] Review security and maintenance status without applying unrelated major upgrades.
- [ ] Verify clean `npm ci` installs at the root, in `starter`, and in `showcase`.

### Evidence

- [ ] Record dependency tree and clean-install results in the validation log.
- [ ] Record every accepted temporary pin and its removal condition in the decision log.

## 2. Build review

### Native Angular builders

- [ ] Verify every maintained build, serve, extract-i18n, and library target uses a supported Angular 22 builder.
- [ ] Verify no live Stark path depends on custom Webpack, `indexTransform`, Webpack globals, or retired helper files.
- [ ] Verify development, HMR, production, and GitHub Pages configurations preserve their intended `baseHref`, assets, optimization, source-map, hashing, and integrity behavior.
- [ ] Verify CSP and other development-server headers are valid and are not mistaken for production security headers.
- [ ] Verify Browserslist queries stay inside Angular 22's supported browser set.

### Generated index

- [ ] Review `index-html.generator.js` for path handling, escaping, configuration merging, and clear failures.
- [ ] Verify `stark-app-config.json`, `stark-app-metadata.json`, `fileReplacements`, `baseHref`, and `index-head-config.js` are applied in the correct order.
- [ ] Verify production replacement of metadata occurs before index generation.
- [ ] Verify generated values are escaped safely in attributes and text nodes.
- [ ] Verify `.stark/` remains ignored and no generated index is committed.
- [ ] Add tests for missing files, malformed JSON, unknown configurations, multiple configurations, and non-root base URLs where coverage is missing.

### Packaging and CI

- [ ] Verify `stark-build` publishes every documented generator, typing, and helper file.
- [ ] Pack and consume `stark-build` from a temporary application.
- [ ] Verify CI uses Node 22 and executes the same maintained build commands documented for downstream applications.
- [ ] Verify no workflow references removed E2E, BrowserStack, Webpack, or Karma commands.

## 3. Testing review

### Test architecture

- [ ] Verify every maintained target uses Angular's unit-test builder and Vitest.
- [ ] Verify setup files, Zone.js integration, TypeScript includes, aliases, and dependency inlining are minimal and documented.
- [ ] Separate monorepo-only aliases from configuration required by published-package consumers.
- [ ] Verify shared Stark Vitest helpers have stable exports and useful types.
- [ ] Verify coverage and JUnit paths are deterministic on Windows and CI platforms.

### Test quality

- [ ] Search for mechanical Jasmine-to-Vitest conversions that changed assertion meaning or asynchronous completion behavior.
- [ ] Review mocks for excessive `any`, unsafe casts, missing return values, and accidental coupling to implementation details.
- [ ] Review tests that were deleted or narrowed during migration and restore meaningful behavioral coverage where needed.
- [ ] Identify skipped, flaky, timing-dependent, or worker-sensitive tests and record a concrete fix or deferral.
- [ ] Verify focused suites and the full CI chain produce the same pass/fail result.

### Browser testing policy

- [ ] Confirm that retiring shared Protractor and BrowserStack wiring is acceptable for Stark itself.
- [ ] Decide whether the showcase needs a maintained browser regression suite in a later improvement branch.
- [ ] Keep any future E2E solution application-owned and independent from the reusable Stark testing package.

## 4. Runtime and UI review

### Public APIs

- [ ] Compare package entry points and generated declarations against Stark 12.
- [ ] Inventory added, removed, and narrowed public types, inputs, outputs, tokens, services, and Sass symbols.
- [ ] Verify callback type narrowing accepts all documented consumer use cases.
- [ ] Verify standalone component changes preserve existing Stark NgModule imports.
- [ ] Pack each library and compile a representative downstream application.

### Angular Material 22

- [ ] Review the Stark typography map against Angular Material 22's supported M2 APIs.
- [ ] Verify M2 compatibility is intentional and clearly separated from any future M3 redesign.
- [ ] Review every `.mat-mdc-*` selector and replace it with a Stark-owned hook or public Material API where possible.
- [ ] Verify downstream-visible Stark selectors remain stable.
- [ ] Review form-field subscript sizing, overlays, focus, ripples, density, typography, and high-contrast behavior.
- [ ] Check keyboard navigation, focus restoration, accessible names, roles, and screen-reader announcements for interactive components.

### Component regression matrix

- [ ] Action bar
- [ ] App data
- [ ] App footer and logo
- [ ] App logout
- [ ] App menu and sidebar
- [ ] Breadcrumb
- [ ] Collapsible
- [ ] Date picker
- [ ] Date range picker
- [ ] Date-time picker
- [ ] Dialogs
- [ ] Dropdown
- [ ] Generic search
- [ ] Input masks
- [ ] Language selector
- [ ] Message pane
- [ ] Minimap
- [ ] Pagination
- [ ] Pretty print
- [ ] Progress indicator
- [ ] Restrict-input directive
- [ ] Route search
- [ ] Session UI
- [ ] Slider
- [ ] SVG view-box directive
- [ ] Table and multi-sort dialog
- [ ] Toast notifications
- [ ] Transform-input directive

For each component, compare behavior, layout, typography, theming, responsive behavior, keyboard use, and error states with the Stark 12 showcase. Record intentional differences instead of silently accepting them.

### Showcase and starter

- [ ] Load every configured showcase route and capture console and failed-network errors.
- [ ] Verify all examples demonstrate supported Angular 22 and Material 22 APIs.
- [ ] Verify the starter remains generic and contains no showcase-only or local migration assumptions.
- [ ] Verify RBAC routes, redirects, denied-access behavior, and protected-page examples.
- [ ] Verify translations, documentation links, news, getting-started content, and code samples.
- [ ] Check desktop, narrow mobile, zoomed, and reduced-motion presentation.

## 5. Documentation and agent-context review

- [ ] Verify `docs/MIGRATION_GUIDE_STARK_13.md` contains every required downstream change and no monorepo-only instruction is presented as mandatory.
- [ ] Execute the guide against a fresh Stark 12-style sample application and record every missing or ambiguous step.
- [ ] Verify all links and anchors in the guide.
- [ ] Verify package READMEs point to the consolidated guide rather than removed documents.
- [ ] Verify historical changelog links remain understandable even when their old target is intentionally retired.
- [ ] Review every `AGENTS.md` for accurate scope, commands, package boundaries, and current paths.
- [ ] Ensure no agent instruction points to the retired migration plan or the retired `C:\LocalData\duboiss\wks\stark` clone.
- [ ] Ensure agent guidance distinguishes generated output from source and requires downstream validation for public changes.

## Cross-cutting cleanup

- [ ] Search for `TODO`, `FIXME`, migration-only comments, obsolete version references, and dead compatibility code introduced or exposed by the migration.
- [ ] Search for references to Angular 6-16 that are no longer intentionally historical.
- [ ] Search for Karma, Jasmine, Protractor, BrowserStack, Webpack, and custom-Webpack references outside historical release notes.
- [ ] Search for stale Material 2 documentation URLs where current Material 3 or Angular Material documentation is intended.
- [ ] Review all lint-rule exceptions and keep only narrowly justified migration compatibility overrides.
- [ ] Verify no environment, script, documentation, or agent pointer references the retired local Stark clone.

## Validation matrix

Record the latest result for every required gate.

| Area            | Command or check                           | Result  | Date       | Notes                                                                 |
| --------------- | ------------------------------------------ | ------- | ---------- | --------------------------------------------------------------------- |
| Dependency sync | `npm run check:packages-dependencies`      | Failed  | 2026-07-23 | `prettier` differs between the root and `stark-ui` manifests          |
| Install         | root `npm ci`                              | Pending |            | A clean isolated checkout cannot resolve the sibling `file:` tarballs |
| TypeScript      | resolve all five effective app/lib configs | Passed  | 2026-07-24 | Shared ng22 preset; Preserve/Bundler, ES2022, isolated and strict     |
| Lint            | `npm run lint:all`                         | Failed  | 2026-07-23 | Stark Core reports 8 errors; Stark UI reports 2 errors                |
| Core tests      | `npm run test:ci:stark-core`               | Pending |            |                                                                       |
| UI tests        | `npm run test:ci:stark-ui`                 | Pending |            |                                                                       |
| RBAC tests      | `npm run test:ci:stark-rbac`               | Pending |            |                                                                       |
| Starter tests   | `npm run test:ci:starter`                  | Pending |            |                                                                       |
| Showcase tests  | `npm run test:ci:showcase`                 | Pending |            |                                                                       |
| Package build   | Git Bash `build.sh` for Core, RBAC, and UI | Passed  | 2026-07-24 | All package entry points compile with the shared strict preset        |
| Starter build   | `starter` `npm run build`                  | Passed  | 2026-07-24 | Development application build and generated index pass                |
| Showcase build  | `showcase` `npm run build:prod`            | Passed  | 2026-07-24 | Production build passes; known CommonJS optimization warnings remain  |
| Generated index | metadata replacement scenario              | Pending |            |                                                                       |
| Browser         | complete showcase route/component sweep    | Pending |            |                                                                       |
| Consumer        | packed packages in a fresh downstream app  | Pending |            |                                                                       |

## Decision log

Add one row for every intentional compatibility tradeoff, deferral, or public behavior change.

| ID    | Area | Decision | Reason | Downstream impact | Follow-up |
| ----- | ---- | -------- | ------ | ----------------- | --------- |
| D-001 |      |          |        |                   |           |

## Findings and improvement backlog

Use one entry per finding. Keep severity and verification explicit.

### IMP-001: Make dependency resolution self-contained

- Status: Confirmed
- Severity: Critical
- Branch: `migration/angular-22/01-dependencies`
- Evidence: The root, starter, and showcase manifests reference tarballs under sibling `*-dsebastien` repositories, while CI checks out only Stark.
- Impact: A clean clone and GitHub Actions cannot install the migration stack.
- Proposed change: Replace every local `file:` dependency with a published compatible version or a reproducible package source and regenerate all lockfiles.
- Compatibility: Keep the same public package versions and document any temporary fork that downstream applications must consume.
- Verification: Run `npm ci` at the root, in `starter`, and in `showcase` from an isolated clone with no sibling repositories.

### IMP-002: Align CI with the declared Node baseline

- Status: Confirmed
- Severity: High
- Branch: `migration/angular-22/02-build`
- Evidence: `.github/workflows/build.yml` uses Node 18, 20, and 22 with Node 20 as the main environment, but every migrated manifest requires Node `>=22.22.3`.
- Impact: Two matrix jobs violate the package engine contract and the main release path does not exercise the supported baseline.
- Proposed change: Use the exact supported Node 22 baseline for required jobs and add newer Node versions only as explicitly supported compatibility jobs.
- Compatibility: Downstream projects receive one unambiguous Node requirement.
- Verification: Run the complete workflow on the rewritten build branch and confirm all required jobs use Node 22.22.3 or later.

### IMP-003: Restore strict peer dependency validation

- Status: Confirmed
- Severity: High
- Branch: `migration/angular-22/01-dependencies`
- Evidence: All three `.npmrc` files still set `legacy-peer-deps=true`; NgRx 21 declares Angular 21 peers, `ngrx-store-logger` declares only NgRx 4-6 peers, and the showcase still uses deprecated Angular Flex Layout.
- Impact: Installation hides unsupported framework combinations, so passing builds do not prove Angular 22 compatibility.
- Proposed change: Replace or remove incompatible packages, then enable strict peer validation without per-package install exceptions.
- Compatibility: Dependency replacement may require documented downstream migration steps; do not publish an unsupported peer graph.
- Verification: Run clean strict `npm ci` installs and inspect `npm ls` for invalid or extraneous dependencies.

### IMP-004: Repair the mandatory dependency-sync gate

- Status: Confirmed
- Severity: High
- Branch: `migration/angular-22/01-dependencies`
- Evidence: `npm run check:packages-dependencies` fails because root `prettier` is `~3.6.2` and `stark-ui` uses `~3.3.3`; CI runs this command before installation.
- Impact: Every current CI build stops before compiling or testing.
- Proposed change: Keep Prettier as root development tooling, remove it from the Stark UI runtime package, and synchronize any dependency that intentionally remains shared.
- Compatibility: No runtime API impact is expected.
- Verification: Run the dependency-sync command before and after a clean install.

### IMP-005: Restore green lint gates

- Status: Confirmed
- Severity: High
- Branch: `migration/angular-22/03-testing` and `migration/angular-22/04-ui`
- Evidence: Stark Core has 8 errors in the new Vitest helpers and Stark UI has duplicate Material imports in app-menu and minimap components.
- Impact: The required `lint:packages` workflow gate fails.
- Proposed change: Correct the mock types and documentation in the testing layer, use a named provider export, and consolidate duplicate Material imports in the UI layer.
- Compatibility: No downstream behavior change is expected.
- Verification: Run each package lint independently and then `npm run lint:all`.

### IMP-006: Remove migration-only test scaffolding and stabilize the full suite

- Status: Confirmed
- Severity: Medium
- Branch: `migration/angular-22/03-testing`
- Evidence: Root and Stark UI Angular configs retain `test-vitest-smoke`; Stark UI hard-codes the current spec-file list; root app test scripts end with `cd ../..`; the combined run previously timed out starting the showcase worker although the isolated showcase suite passed.
- Impact: New UI specs can be silently omitted and full-suite results are worker-order sensitive.
- Proposed change: Remove smoke targets, use maintained discovery or generated includes, correct script paths, and make worker configuration deterministic.
- Compatibility: Test-only change.
- Verification: Add a temporary discovered spec during validation and run focused plus complete CI test chains repeatedly.

### IMP-007: Remove unsupported and misplaced production dependencies

- Status: Confirmed
- Severity: High
- Branch: `migration/angular-22/01-dependencies`
- Evidence: Production audits report a critical `tar` chain through Angular CLI tooling in starter and showcase; build/compiler packages are installed as runtime dependencies; Stark UI publishes Prettier as a runtime dependency.
- Impact: Consumers install unnecessary tooling and inherit avoidable vulnerability and maintenance surface.
- Proposed change: Move build-only packages to development dependencies, remove unused runtime tooling, and update patched transitive versions without bypassing peer checks.
- Compatibility: Verify packed applications because dependency placement affects consumer installs.
- Verification: Pack every library and application, install with production-only dependencies, and run `npm audit --omit=dev`.

### IMP-008: Retire abandoned runtime libraries and RxJS APIs

- Status: Confirmed
- Severity: Medium
- Branch: `migration/angular-22/04-ui`
- Evidence: Input-mask directives still subclass `angular2-text-mask` 9.0.0 and use casts into its private state; Stark Core session code still calls removed/deprecated RxJS `toPromise()` APIs.
- Impact: Core behavior depends on unmaintained compatibility code and future dependency upgrades remain fragile.
- Proposed change: Replace the mask integration with a maintained Angular 22-compatible implementation and use `firstValueFrom` or `lastValueFrom` with explicit empty-stream semantics.
- Compatibility: Preserve all current Stark directive inputs, outputs, and formatted values or document deliberate API changes.
- Verification: Add runtime mask-change, IME, reactive-form, empty-stream, and rejected-navigation tests.

### IMP-009: Remove dead build and documentation legacy

- Status: Confirmed
- Severity: Medium
- Branch: Lowest owning layer, followed by descendant restacking
- Evidence: Unreferenced `webpack-custom-config.dev.json` files remain; the starter exposes a broken TSLint script; active READMEs and docs still describe TSLint, Codelyzer, Jasmine spies, Angular CLI 7-era polyfills, and obsolete structure files.
- Impact: Maintainers and downstream teams can follow instructions that no longer work.
- Proposed change: Delete unreferenced configuration and rewrite active documentation for ESLint, Vitest, and the Angular 22 build.
- Compatibility: Keep historical changelog text intact; remove only live guidance and dead files.
- Verification: Search active sources for retired tooling names and execute every documented command.

### IMP-010: Complete the downstream API and style compatibility audit

- Status: Confirmed
- Severity: High
- Branch: `migration/angular-22/04-ui`
- Evidence: The UI migration changes public callback types, Material form-field integration, Sass symbols, and many selectors from legacy Material classes to `.mat-mdc-*`; the input masks also access third-party private fields through `any`.
- Impact: Downstream applications may compile but lose styling or behavior after package installation.
- Proposed change: Prefer Stark-owned hooks and public Material APIs, preserve documented Stark selectors, and explicitly record unavoidable breaking changes in the Stark 13 guide.
- Compatibility: This is the required review before accepting changes such as `.mat-menu-panel` to `.mat-mdc-menu-panel` as public migration requirements.
- Verification: Compare packed declarations and Sass entry points with Stark 12, then compile and visually exercise a representative downstream application.

### IMP-011: Make the maintained build orchestration cross-platform

- Status: Confirmed
- Severity: Medium
- Branch: `migration/angular-22/02-build`
- Evidence: The root `build` command still starts with `bash ./build.sh` and supporting scripts rely on Bash and Unix `cp` despite Windows being a supported development environment.
- Impact: Direct Angular targets work on Windows, but the documented package/release build depends on an external shell setup.
- Proposed change: Replace maintained orchestration with Node scripts or cross-platform package commands while preserving trace and release behavior.
- Compatibility: No application runtime impact is expected.
- Verification: Run the same root build command on Windows PowerShell and the Linux CI image.

### IMP-012: Restore the shared Angular 22 TypeScript configuration

- Status: Completed
- Severity: High
- Branch: `migration/angular-22/01-dependencies`
- Evidence: Code-style commit `24c0c62` now defines the Angular 22 preset with preserved modules, bundler resolution, isolated modules, and strict Angular compiler checks without copied legacy switches. Stark's root bridge extends that preset without overrides, while starter and showcase extend the package directly. The local tarball integrity is synchronized in tracked lockfiles, and the downstream guide documents the required `extends` value.
- Impact: Resolved. Stark validates the shared preset, strict template settings are consistent, and starter/showcase no longer depend on a parent-repository tsconfig.
- Resolution: Keep monorepo package configs behind the thin root bridge and keep standalone applications on the published preset directly. Application-specific paths, outputs, type roots, and exclusions remain local.
- Compatibility: The strict settings exposed no new errors in the completed migration stack. Downstream applications must resolve any real strict-template or isolated-module errors instead of weakening the preset.
- Verification: Angular's configuration reader resolved Stark Core, RBAC, UI, starter, and showcase to `Preserve` modules, `Bundler` resolution, ES2022, isolated modules, and strict Angular checks. Stark Core, RBAC, every Stark UI entry point, the starter development build, and the showcase production build passed. The starter config resolved the preset from its own `node_modules` without using a parent config. The showcase still reports the separately tracked CommonJS optimization warnings.

## Completion criteria

The improvement cycle is complete when:

- [ ] every checklist item is reviewed or explicitly deferred;
- [ ] all critical and high findings are resolved;
- [ ] every accepted public or visual change is documented;
- [ ] the complete validation matrix is green;
- [ ] a fresh downstream application can follow the migration guide successfully;
- [ ] the final branch stack is clean, ordered, and ready for sequential review.
