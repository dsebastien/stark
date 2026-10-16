# AGENTS.md

## Scope

- This file applies to `packages/stark-testing/`.

## What Lives Here

- Shared testing infrastructure for Stark's Angular 22 Vitest path, especially reporting helpers.

## Working Rules

- Keep this package generic and consumer-facing; it should not depend on app-specific runtime code.
- Favor stable test infrastructure and wrappers over one-off project behavior.
- Avoid introducing runtime dependencies that belong in consumer apps instead of shared testing support.

## Validation

- Validate through the consuming Vitest suites that rely on this package.
- When changing reporting helpers or published package metadata, rerun the nearest affected app or package tests.
