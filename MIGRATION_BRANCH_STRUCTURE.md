# Angular 22 Migration Branch Structure

## Purpose

This file is the operational handoff for the Stark Angular 22 migration branch. Read it before changing migration history, moving branch pointers, or pushing commits.

## Stable branch

`migration/angular-22/stable` is the single canonical migration branch and the normal working checkout. It is a linear series of small, focused commits on top of `master`, ordered so changes can be reviewed and incorporated step by step:

1. dependency baseline (root workspace, then each package, showcase, and starter);
2. lint and shared TypeScript configuration;
3. build tooling, local package scripts, dependency modes, and CI;
4. Vitest test infrastructure replacing Karma, Jasmine, and Protractor;
5. `stark-core`, one commit per module;
6. `stark-rbac`;
7. `stark-ui` theming and shared helpers, then one commit per component;
8. showcase shell, guides, and one commit per demo page;
9. starter;
10. Playwright visual regression suite, grouped by surface family;
11. migration documentation and agent guidance.

Intermediate commits are ordered by dependency but are not each guaranteed to build on their own; the branch tip is the validated state.

## Remote roles

- `origin` is the `dsebastien/stark` fork and hosts `migration/angular-22/stable`; the local branch tracks the branch with the same name on `origin`.
- `upstream` is `NationalBankBelgium/stark`; its push URL stays `DISABLED`. Never push migration work there.

## Adding work

1. Branch from the current `migration/angular-22/stable` tip in an isolated worktree.
2. Keep each commit focused on one concern: one dependency set, one build concern, one package module or component, one showcase page, one visual-suite area, or one documentation topic. Use a conventional commit message scoped to that concern.
3. Rebase accepted work onto the latest stable tip and fast-forward `migration/angular-22/stable`; never create merge commits.
4. Run the integrity checks and the validation affected by the change, then push the fast-forward to `origin`.

## Rewriting history

Reordering, splitting, squashing, or amending existing stable commits is a history rewrite and requires explicit maintainer approval recorded in Beads. Before a rewrite, create a `backup/` ref for the current tip. After it, verify that the final tree matches the approved content, push with `--force-with-lease` (never plain `--force`), and verify the remote hash.

## Required integrity checks

```bash
bash scripts/with-project-node.sh -- npm run deps:check
git merge-base --is-ancestor master migration/angular-22/stable
test "$(git rev-list --merges --count master..migration/angular-22/stable)" = 0
git diff --check master..migration/angular-22/stable
git status --short --branch
```

Also verify the remote branch hash after pushing and confirm that the working tree is clean.

## History

The migration was previously a five-branch stack (`migration/angular-22/01-dependencies` through `migration/angular-22/05-agent-context`, one commit per layer) fed by `staging/angular-22/*` branches and many `work/*` and `review/*` branches. On 2026-10-16 all of them were consolidated into `work/angular-22/consolidated-20260916` and rebuilt as `migration/angular-22/stable` with an identical tree (Beads `stark-4sp.1.6`). The old branches remain only as history; do not add work to them. The safety backup of the pre-consolidation tip is `backup/pre-consolidation-checkpoint-20260916`. The former `feature/angular-22-migration` branch is retired; do not recreate it.

## Supporting documents

- `docs/MIGRATION_GUIDE_STARK_13.md` is the downstream application migration guide.
- `IMPROVEMENT_PLAN.md` indexes remaining Beads work and links to historical review records.
- `AGENTS.md` and nested `AGENTS.md` files provide repository and folder-specific implementation guidance.
