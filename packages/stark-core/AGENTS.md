# AGENTS.md

## Scope

- This file applies to `packages/stark-core/`.

## What Lives Here

- Foundational Stark modules, configuration, utilities, validation helpers, serialization helpers, and testing support.
- The main source surface is under `src/`; test helpers live under `testing/`.

## Working Rules

- Treat this package as a framework foundation. API changes ripple into `stark-ui`, `stark-rbac`, `showcase`, and `starter`.
- Keep barrels and public exports aligned with the intended public surface.
- `@uirouter/angular` is a peer dependency here; do not reintroduce it as a bundled runtime dependency.
- Favor stable abstractions over showcase-specific shortcuts.

## Validation

- `npm run lint-es`
- `npm run lint-css`
- `GH_ACTIONS_TAG=local npm run build:stark-core`
- Revalidate consumer packages/apps when routing, auth, translation, or shared models change.
