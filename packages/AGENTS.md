# AGENTS.md

## Scope

- This file applies to `packages/` and its children unless a deeper `AGENTS.md` overrides it.

## What Lives Here

- `packages/` contains the reusable Stark packages that are consumed by the showcase, the starter, and downstream applications.
- Each package has its own public API and build/lint/test expectations.

## Working Rules

- Keep package boundaries clear. Avoid reaching across packages with private imports.
- Do not edit `dist/packages/**` by hand.
- Build order matters in this workspace:
  - `stark-core` before `stark-ui`
  - `stark-rbac` depends on `stark-core`
- When a package change affects consumers, validate the closest consumer app after the package-level checks.

## Read Before Editing

- [stark-build/AGENTS.md](stark-build/AGENTS.md)
- [stark-core/AGENTS.md](stark-core/AGENTS.md)
- [stark-rbac/AGENTS.md](stark-rbac/AGENTS.md)
- [stark-testing/AGENTS.md](stark-testing/AGENTS.md)
- [stark-ui/AGENTS.md](stark-ui/AGENTS.md)
