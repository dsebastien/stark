# Angular 22 Migration Status

Updated: 2026-08-14

This is the human-readable checkpoint. Beads remains the authoritative task graph.

## Executive status

| Item               | Current state                                                                       |
| ------------------ | ----------------------------------------------------------------------------------- |
| Phase              | Build deterministic local tarball workflow across sibling forks                     |
| Beads              | 77 total: 12 closed, 0 in progress, 65 open                                         |
| Active tasks       | No worker is active; `stark-4sp.9.4` is the next implementation task                |
| Staging            | Layer 02 at `8259c826`; layer 05 at `b73adbf9` plus this status/guidance checkpoint |
| Canonical branches | Unchanged                                                                           |
| Pushes             | None                                                                                |
| Upstream safety    | `NationalBankBelgium/stark` remains fetch-only; local push URL is `DISABLED`        |

## Completed checkpoints

- Beads and GitHub Copilot integration is installed with orchestrator-only writes.
- The 77-issue graph has no cycles, template warnings, or orphans.
- All five canonical local tips and observed `origin` lease hashes have timestamped local backup refs.
- Independent standards and specification reviews attributed every local-versus-origin changed file.
- Personal-fork synchronization is separated from migration validation and requires its own exact-hash approval.
- The approved orchestration and reconciliation record is committed locally on the layer-05 staging branch.
- The profile-free Git Bash/fnm launcher and the five-repository local tarball map are independently reviewed and integrated on layer-02 staging.
- Repository guidance now gives every worker the same copy-paste launcher and local-tarball-only contract.

## Active work

| Bead            | Owner                   | State   | Current evidence                                                                                      |
| --------------- | ----------------------- | ------- | ----------------------------------------------------------------------------------------------------- |
| `stark-4sp.9.1` | `shell-launcher-worker` | Closed  | Launcher passed 11 focused tests, live fnm Node/npm checks, and independent review.                   |
| `stark-4sp.9.3` | `dependency-map-worker` | Closed  | Map validates 5 repositories, 8 packages, 24 consumers, and 7 negative cases; independently approved. |
| `stark-4sp.7.1` | Unassigned              | Blocked | The initial run used remote companion archives and is not accepted. It resumes after `stark-4sp.9.8`. |
| `stark-4sp.7.2` | Orchestrator            | Closed  | Source/package provenance now feeds build-time evidence in the local tarball map.                     |

## Current work queue

1. `stark-4sp.9.4`: build deterministic local tarballs from the sibling forks.
2. `stark-4sp.9.5`: switch consumers into local-tarball mode without hand edits.
3. `stark-4sp.9.6` through `.9.8`: guard, independently review, and validate the workflow.
4. Resume `stark-4sp.7.1`, then proceed to browser infrastructure and visual coverage.

No package release, version bump, npm publication, or release-guard work is in scope.

## Next decisions and actions

1. Build local tarballs for code-style, eslint-config, ngx-form-errors, UI-Router, and Stark packages.
2. Implement reversible local dependency switching and the upstream-PR path guard.
3. Independently review and validate local dependency mode.
4. Resume the fresh-consumer validation with those local tarballs.
5. Synchronize WIP branches only after a separate exact-hash approval; later upstream changes use pull requests.

## Update contract

The orchestrator updates this file and reports the same concise status in chat after any:

- completed or newly blocked bead;
- maintainer decision;
- accepted staging commit;
- integration checkpoint;
- canonical history rewrite;
- Git or Dolt push.
