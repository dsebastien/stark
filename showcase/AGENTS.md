# AGENTS.md

## Scope

- This file applies to `showcase/`.

## What Lives Here

- The showcase app demonstrates Stark packages, doubles as a living guide, and exercises real framework integrations.
- The app follows a folders-by-feature structure under `src/app/`.

## Working Rules

- Keep the showcase representative of real Stark usage, not a dumping ground for one-off hacks.
- `src/assets/examples/**` often contains rendered source examples for documentation and demos; those files are not always the same as runtime page styles.
- When framework behavior changes, update showcase examples so they remain a trustworthy reference.

## Validation

- `npm run lint-es`
- `npm run build`
- Run focused tests if you change Angular Material markup, router behavior, or showcased integration patterns.
