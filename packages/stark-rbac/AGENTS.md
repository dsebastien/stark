# AGENTS.md

## Scope

- This file applies to `packages/stark-rbac/`.

## What Lives Here

- RBAC extensions layered on top of `stark-core`.
- Source code lives under `src/`; testing helpers live under `testing/`.

## Working Rules

- Keep the dependency direction one-way: this package extends `stark-core`; it should not grow showcase-specific behavior.
- Preserve peer dependency boundaries instead of copying shared logic locally.
- Coordinate changes with `stark-core` if shared permission/auth concepts move.

## Validation

- `npm run lint`
- `npm run test-fast:ci`
- Re-run the root lint/build chain when shared RBAC contracts change.
