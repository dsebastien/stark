# AGENTS.md

## Scope

- This file applies to the whole `stark` repository.
- If a subfolder contains its own `AGENTS.md`, follow the closer file for that subtree.

## Repository Purpose

- `stark` is the framework monorepo.
- It contains reusable framework packages in `packages/`, a demo/reference app in `showcase/`, a project template in `starter/`, and package-focused docs in `docs/`.

## Working Rules

- Read `MIGRATION_BRANCH_STRUCTURE.md` before changing any Angular 22 migration branch or commit.
- On this Windows workstation, prefer Git Bash because the repo scripts and local tool bootstrap are wired there.
- Do not edit generated outputs such as `dist/`, `coverage/`, `reports/`, `.angular/`, packaged tarballs, or `node_modules/`.
- Keep public API changes deliberate. This repo is a library workspace first, so package boundaries and peer dependency boundaries matter.
- During coordinated framework migrations, inspect sibling clones under `C:\LocalData\duboiss\wks\NGMigration` before replacing local tarballs or peer dependency wiring.
- Keep commits conventional and granular. Existing history uses forms such as `feat(scope): ...`, `fix(scope): ...`, `docs(scope): ...`, and `chore(release): ...`.

## High-Value Paths

- `packages/`: reusable Stark packages
- `showcase/`: demo app and living guide
- `starter/`: starter/template app
- `docs/`: package and workflow documentation
- `MIGRATION_BRANCH_STRUCTURE.md`: authoritative migration branch ancestry and restacking rules
- `docs/MIGRATION_GUIDE_STARK_13.md`: authoritative downstream migration guide for the Angular 22 baseline

## Validation Flow

- Root validation: `npm run lint:all`
- Library build order matters: build `stark-core` before `stark-ui`
- Library builds commonly used in this repo:
  - `GH_ACTIONS_TAG=local npm run build:stark-core`
  - `GH_ACTIONS_TAG=local npm run build:stark-ui`
- App validation:
  - `cd showcase && npm run lint-es && npm run build`
  - `cd starter && npm run lint-es && npm run build`
- Keep `docs/MIGRATION_GUIDE_STARK_13.md` aligned with downstream-visible build, test, and UI changes.

## Folder Map

- Read [packages/AGENTS.md](packages/AGENTS.md) before changing reusable packages.
- Read [showcase/AGENTS.md](showcase/AGENTS.md) before changing the showcase app.
- Read [starter/AGENTS.md](starter/AGENTS.md) before changing the starter template.
- Read [docs/AGENTS.md](docs/AGENTS.md) before changing package docs or developer guides.
