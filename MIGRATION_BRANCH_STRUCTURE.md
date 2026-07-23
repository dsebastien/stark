# Angular 22 Migration Branch Structure

## Purpose

This file is the operational handoff for the Stark Angular 22 migration stack. Read it before changing migration history, moving branch pointers, or pushing rewritten commits.

The migration is intentionally split into reviewable layers. Do not collapse the stack into one branch or merge a higher layer into a lower layer.

## Canonical stack

Each branch is based directly on the branch above it and contains one migration commit relative to that parent.

| Order | Branch                                  | Direct parent                          | Scope                                                                 |
| ----- | --------------------------------------- | -------------------------------------- | --------------------------------------------------------------------- |
| 1     | `migration/angular-22/01-dependencies`  | `master`                               | Dependency, engine, compiler, lint, and package baseline              |
| 2     | `migration/angular-22/02-build`         | `migration/angular-22/01-dependencies` | Angular builders, index generation, metadata, and build configuration |
| 3     | `migration/angular-22/03-testing`       | `migration/angular-22/02-build`        | Vitest and removal of Karma, Jasmine infrastructure, and Protractor   |
| 4     | `migration/angular-22/04-ui`            | `migration/angular-22/03-testing`      | Runtime, Material, components, showcase, and starter                  |
| 5     | `migration/angular-22/05-agent-context` | `migration/angular-22/04-ui`           | Agent guidance, migration documentation, and review planning          |

`migration/angular-22/05-agent-context` is the highest branch and the normal working checkout after stack maintenance.

The former `feature/angular-22-migration` branch is retired locally and on the fork. Do not recreate or use it as a review base.

## Remote roles

- `origin` is the `dsebastien/stark` fork and contains the five migration branches.
- `upstream` is `NationalBankBelgium/stark`; do not push migration branches there directly.
- Every local migration branch should track the branch with the same name on `origin`.

## Review order

Review and integrate the branches from lowest to highest:

1. compare `01-dependencies` with `master`;
2. compare `02-build` with `01-dependencies`;
3. compare `03-testing` with `02-build`;
4. compare `04-ui` with `03-testing`;
5. compare `05-agent-context` with `04-ui`.

Never review a higher branch directly against `master`; that hides the responsibility of the intermediate layers.

## Changing an existing layer

Place a fix in the lowest layer that owns the concern. Dependency fixes belong in `01-dependencies`, build fixes in `02-build`, test-runner fixes in `03-testing`, runtime or visual fixes in `04-ui`, and agent/documentation-only fixes in `05-agent-context`.

When a lower layer changes:

1. create a local backup ref for the current highest tip;
2. amend the owning layer's single commit;
3. rebase every descendant branch in order onto its rewritten parent;
4. verify that each branch still has the expected direct parent and scope;
5. rerun validation affected by the rewritten layers;
6. push rewritten branches with `--force-with-lease`, never plain `--force`;
7. return the working copy to `migration/angular-22/05-agent-context`.

Do not add cleanup for one layer to an unrelated higher commit merely to avoid restacking. Do not rewrite already reviewed layers without recording why in `IMPROVEMENT_PLAN.md`.

## Required integrity checks

Run these checks after restacking:

```powershell
git merge-base --is-ancestor master migration/angular-22/01-dependencies
git merge-base --is-ancestor migration/angular-22/01-dependencies migration/angular-22/02-build
git merge-base --is-ancestor migration/angular-22/02-build migration/angular-22/03-testing
git merge-base --is-ancestor migration/angular-22/03-testing migration/angular-22/04-ui
git merge-base --is-ancestor migration/angular-22/04-ui migration/angular-22/05-agent-context
git diff --check master..migration/angular-22/05-agent-context
git status --short --branch
```

Also verify each remote branch hash after pushing and confirm the working tree is clean on the highest branch.

## Supporting documents

- `docs/MIGRATION_GUIDE_STARK_13.md` is the downstream application migration guide.
- `IMPROVEMENT_PLAN.md` is the review checklist, decision log, and validation backlog.
- `AGENTS.md` and nested `AGENTS.md` files provide repository and folder-specific implementation guidance.
