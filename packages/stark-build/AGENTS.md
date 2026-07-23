# AGENTS.md

## Scope

- This file applies to `packages/stark-build/`.

## What Lives Here

- Reusable build-time tooling for Stark consumers, especially native Angular index generation, shared compile-time typings, and JSON-server helpers.
- Most changes here affect the workspace build chain rather than runtime behavior.

## Working Rules

- Keep Angular CLI builder compatibility and shared build behavior aligned with the root workspace versions.
- Do not reintroduce Webpack or custom-webpack entrypoints; Angular 22 support is based on the native Angular builder plus the generated-index flow.
- Prefer small, configuration-focused changes over broad rewrites because `showcase/` and `starter/` both depend on this package.
- Do not hand-edit generated outputs under `dist/`.

## Validation

- Validate through consuming builds rather than isolated theory:
  - `cd packages/stark-build && npm test`
  - `npm run build:stark-build`
  - `cd starter && npm run build:dev`
  - `cd showcase && npm run build:prod:ghpages`
