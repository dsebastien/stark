# AGENTS.md

## Scope

- This file applies to `packages/stark-ui/`.

## What Lives Here

- Reusable UI components, theming, styles, utilities, and testing support for Stark.
- Runtime source lives under `src/`; shared Sass and theme infrastructure live under `styles/`; test helpers live under `testing/`.

## Working Rules

- Preserve public component APIs and theme entrypoints.
- This package builds on top of Angular Material. When DOM coupling is unavoidable, target current Angular Material 22 MDC selectors rather than legacy pre-MDC classes.
- Do not reintroduce selectors such as `.mat-form-field-label`, `.mat-form-field-wrapper`, `.mat-menu-item`, or other removed pre-MDC internals.
- Keep Sass changes consistent with the repo's existing Material theming approach.

## Validation

- `npm run lint`
- `npm run test-fast:ci`
- From the repository root, `npm run build:stark-ui`
- Run focused component/spec validation when changing Material-driven HTML or SCSS behavior.
