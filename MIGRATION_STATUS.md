# Angular 22 Migration Status

Updated: 2026-08-20

This is the human-readable checkpoint. Beads remains the authoritative task graph.

## Executive status

| Item               | Current state                                                                        |
| ------------------ | ------------------------------------------------------------------------------------ |
| Phase              | Canonical dependency cutover, durable orchestration, and browser-baseline foundation |
| Beads              | 83 total: 13 closed, 1 in progress, 68 open, 52 blocked, 16 ready                    |
| Active tasks       | `stark-4sp.2.5` handoff hooks; runner work is blocked on local Stark packages        |
| Staging            | Layer 05 at `7bf7c1d1`; UI-Router dependency at `b9e63a92`                           |
| Canonical branches | Unchanged                                                                            |
| Pushes             | None                                                                                 |
| Upstream safety    | `NationalBankBelgium/stark` remains fetch-only; local push URL is `DISABLED`         |

## Completed checkpoints

- Beads and GitHub Copilot integration is installed with orchestrator-only writes.
- The 77-issue graph has no cycles, template warnings, or orphans.
- All five canonical local tips and observed `origin` lease hashes have timestamped local backup refs.
- Independent standards and specification reviews attributed every local-versus-origin changed file.
- Personal-fork synchronization is separated from migration validation and requires its own exact-hash approval.
- The approved orchestration and reconciliation record is committed locally on the layer-05 staging branch.
- The profile-free Git Bash/fnm launcher and the five-repository local tarball map are independently reviewed and integrated on layer-02 staging.
- Repository guidance now gives every worker the same copy-paste launcher and local-tarball-only contract.
- The public `@uirouter/angular@22.0.0` package replaced the Angular 22 fork in the root, Showcase, and Starter manifests and locks; no fork references remain.
- Codex and GitHub Copilot now share a tested Beads-backed session handoff and PreCompact checkpoint flow.
- The pinned Chromium Playwright runner and legacy-shell smoke journey are integrated; candidate startup is explicitly blocked until local Stark packages are installed.

## Active work

| Bead             | Owner               | State   | Current evidence                                                                                    |
| ---------------- | ------------------- | ------- | --------------------------------------------------------------------------------------------------- |
| `stark-4sp.2.5`  | Orchestrator        | Active  | Handoff script, Codex hooks, Copilot hooks, pinned Node launcher, and focused tests are integrated. |
| `stark-4sp.3.2`  | Orchestrator/worker | Blocked | Runner integrated; legacy smoke passed, candidate needs local Stark tarball/node_modules.           |
| `stark-4sp.10.1` | Orchestrator/worker | Closed  | Public UI-Router 22.0.0 manifests/locks integrated; fork references removed.                        |
| `stark-4sp.10.2` | Unassigned          | Open    | Validate routing journeys and remove remaining fork bookkeeping/docs.                               |
| `stark-4sp.7.1`  | Unassigned          | Blocked | The initial run used remote companion archives and is not accepted; resume after `.9.8`.            |

## Current work queue

1. Unblock `stark-4sp.3.2` by installing/building the local Stark packages, then run the candidate smoke.
2. `stark-4sp.10.2`: validate public UI-Router routing, lazy loading, and session/RBAC transitions.
3. `stark-4sp.9.4` through `.9.8`: build, guard, review, and validate the local tarball workflow.
4. Resume `stark-4sp.3.4`/`.3.5`, then complete all 48 routes/52 surfaces in the visual baseline matrix.

No package release, version bump, npm publication, or release-guard work is in scope.

## Next decisions and actions

1. Integrate the reviewed Playwright runner and deterministic fixtures without auto-updating goldens.
2. Validate the published UI-Router package through focused routing journeys before closing `.10.2`.
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
