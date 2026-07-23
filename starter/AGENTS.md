# AGENTS.md

## Scope

- This file applies to `starter/`.

## What Lives Here

- The starter app is the template/reference project for downstream Stark applications.
- It follows a folders-by-feature structure under `src/app/`.

## Working Rules

- Keep this app generic and reusable. Avoid showcase-specific examples or organization-specific shortcuts unless they are intentional template guidance.
- When framework changes require template updates, prefer broadly useful defaults.
- Keep the maintained test surface aligned with the Angular 22 Vitest baseline in this repository. If browser E2E coverage is reintroduced later, treat that as a separate application-specific track rather than reviving the old shared setup.

## Validation

- `npm run lint-es`
- `npm run build`
- Re-run focused tests when changing app bootstrap, routing, or shared starter configuration.
