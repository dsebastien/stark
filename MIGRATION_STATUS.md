# Angular 22 Migration Status

Updated: 2026-08-20

This is the human-readable checkpoint. Beads remains the authoritative task graph.

## Executive status

| Item               | Current state                                                                                                 |
| ------------------ | ------------------------------------------------------------------------------------------------------------- |
| Phase              | Canonical dependency cutover, UI-Router 22 validation, durable orchestration, and browser-baseline foundation |
| Beads              | 83 total: 16 closed, 1 in progress, 64 open, 52 blocked, 12 ready                                             |
| Active tasks       | `stark-4sp.2.5` handoff hooks; browser foundation awaits prerequisite graph closure                           |
| Staging            | Layer 05 at `2c3d0dce`; UI-Router dependency at `b9e63a92`                                                    |
| Canonical branches | Unchanged                                                                                                     |
| Pushes             | None                                                                                                          |
| Upstream safety    | `NationalBankBelgium/stark` remains fetch-only; local push URL is `DISABLED`                                  |

## Completed checkpoints

- Beads and GitHub Copilot integration is installed with orchestrator-only writes.
- The current Beads graph has no cycles, template warnings, or orphans in the latest audit.
- All five canonical local tips and observed `origin` lease hashes have timestamped local backup refs.
- Independent standards and specification reviews attributed every local-versus-origin changed file.
- Personal-fork synchronization is separated from migration validation and requires its own exact-hash approval.
- The approved orchestration and reconciliation record is committed locally on the layer-05 staging branch.
- The profile-free Git Bash/fnm launcher and the five-repository local tarball map are independently reviewed and integrated on layer-02 staging.
- Repository guidance now gives every worker the same copy-paste launcher and local-tarball-only contract.
- The public `@uirouter/angular@22.0.0` package replaced the Angular 22 fork in the root, Showcase, and Starter manifests and locks; no fork references remain.
- UI-Router 22 routing is validated in package tests and the Showcase: initial home/otherwise redirects, lazy-loaded states, `uiView`/`uiSref`, route-search, session, and RBAC journeys pass in the supported browser paths. Root, Showcase, and Starter installs resolve `@uirouter/angular@22.0.0` with `@uirouter/core@6.1.2` and `@uirouter/rx@1.0.0`.
- Codex and GitHub Copilot now share a tested Beads-backed session handoff and PreCompact checkpoint flow.
- The pinned Chromium Playwright/axe runner, pinned legacy oracle metadata, shell-driven route transitions, and privileged legacy artifact capture are integrated; candidate and legacy representative journeys pass. Beads retains the full browser matrix as blocked by prerequisite stack-validation beads.
- The immutable local-package publication design is recorded in `docs/LOCAL_PACKAGE_PUBLICATION_STATE.md`; implementation remains gated behind that design and precedes the full visual matrix.

## Active work

| Bead              | Owner               | State   | Current evidence                                                                                       |
| ----------------- | ------------------- | ------- | ------------------------------------------------------------------------------------------------------ |
| `stark-4sp.2.5`   | Orchestrator        | Active  | Handoff script, Codex hooks, Copilot hooks, pinned Node launcher, and focused tests are integrated.    |
| `stark-4sp.3.2`   | Orchestrator/worker | Blocked | Runner, axe dependency, legacy smoke, and candidate smoke pass; graph awaits `.9.8`/`.1.4`.            |
| `stark-4sp.10.1`  | Orchestrator/worker | Closed  | Public UI-Router 22.0.0 manifests/locks integrated; fork references removed.                           |
| `stark-4sp.10.2`  | Orchestrator/worker | Closed  | Package and browser routing journeys pass; published-package docs replace the retired fork workaround. |
| `stark-4sp.3.11`  | Orchestrator/worker | Closed  | Legacy oracle build metadata is pinned; shell transitions and privileged artifact capture pass.        |
| `stark-4sp.9.4.1` | Orchestrator/worker | Closed  | Immutable local-package publication state machine and adversarial test matrix are designed.            |
| `stark-4sp.7.1`   | Unassigned          | Blocked | The initial run used remote companion archives and is not accepted; resume after `.9.8`.               |

## Current work queue

1. Implement and verify the immutable local-package state machine through `.9.4`, `.9.5`, and `.9.8` without bypassing dependency guards.
2. Complete the prerequisite `.9.8`/`.1.4` stack validation so the browser foundation beads can close.
3. Resume `stark-4sp.3.4`/`.3.5`, then complete all 48 routes/52 surfaces in the visual baseline matrix.

No package release, version bump, npm publication, or release-guard work is in scope.

## Next decisions and actions

1. Integrate the reviewed Playwright runner and deterministic fixtures without auto-updating goldens.
2. Implement the state machine in `scripts/build-local-packages.mjs` and its fault/concurrency tests.
3. Build local tarballs for code-style, eslint-config, ngx-form-errors, and Stark packages.
4. Implement reversible local dependency switching and the upstream-PR path guard.
5. Synchronize WIP branches only after a separate exact-hash approval; later upstream changes use pull requests.

## Update contract

The orchestrator updates this file and reports the same concise status in chat after any:

- completed or newly blocked bead;
- maintainer decision;
- accepted staging commit;
- integration checkpoint;
- canonical history rewrite;
- Git or Dolt push.
