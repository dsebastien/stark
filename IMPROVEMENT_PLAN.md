# Angular 22 Remaining Work

Beads is the source of truth for task status, evidence, blockers, and next actions.
This document is an index to outstanding work, reconciled on 2026-09-15.
Read the referenced issue and its latest comments before starting a task.

```text
bd prime
bd list --status open,in_progress,blocked,deferred --limit 0
bd show <issue-id>
bd comments <issue-id>
```

## Next step

Complete `stark-4sp.4.9.8`:

1. Map the existing custom-cell journeys to the dedicated custom-cell content state.
2. Audit a native table filter path to zero visible rows and cover the empty state if
   it is deterministic; record a missing-fixture disposition only if the audit proves
   there is no stable path.
3. Validate the updated coverage contract and affected browser journeys, review, and
   push the completed step to the personal fork.

UI parity remains the active priority. Canonical integration (`stark-4sp.8.1`) and
the dependency-cycle work (`stark-4sp.9.8`) remain parked.

## Remaining UI coverage

| Work                                                                                          | Beads                              |
| --------------------------------------------------------------------------------------------- | ---------------------------------- |
| Finish table content-state coverage                                                           | `stark-4sp.4.9.8`                  |
| Advanced tables: filters, fixed headers/actions, expandable rows, row actions, and multi-sort | `stark-4sp.4.10`                   |
| Add the SVG view-box example and disabled Generic Search fixture                              | `stark-4sp.4.6`, `stark-4sp.4.8.3` |
| Session states and RBAC routes, redirects, and denied access                                  | `stark-4sp.4.11`, `stark-4sp.4.12` |
| Complete route/shell and style-guide/validation coverage                                      | `stark-4sp.4.1`, `stark-4sp.4.13`  |
| Complete responsive, zoom, motion, forced-color, and critical cross-browser checks            | `stark-4sp.4.14`, `stark-4sp.4.15` |

The implementation and verification in `stark-4sp.4.2`–`stark-4sp.4.5` and
`stark-4sp.4.7` are complete; those parents await the `stark-4sp.8.1` integration
gate. Search and core-table parents also retain the specific remaining work above.
Reuse completed journeys and their approved goldens.

## Remaining infrastructure and acceptance

| Work                                                                                                                                                                     | Beads                                                            |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------- |
| Complete clean-install acceptance for browser dependencies and resolve the prerequisite gates on the implemented runner, determinism, manifests, and comparison workflow | `stark-4sp.3.1`–`stark-4sp.3.5`, `stark-4sp.3.7`                 |
| Add failure observability, accessibility fingerprints, and the complete representative foundation pilot                                                                  | `stark-4sp.3.6`, `stark-4sp.3.8`, `stark-4sp.3.9`                |
| Add sharded browser CI and finish orchestration guardrails and Beads remote synchronization                                                                              | `stark-4sp.3.10`, `stark-4sp.2.3`, `stark-4sp.2.4`               |
| Finish only uncovered legacy states, accept completed shards, review baseline completeness, and run the complete candidate suite                                         | `stark-4sp.5.1`–`stark-4sp.5.6`                                  |
| Resolve defects discovered by the remaining coverage and final suite                                                                                                     | `stark-4sp.6.1`                                                  |
| Finish the clean local-to-canonical package cycle and execute the guide on a fresh Stark 12 consumer                                                                     | `stark-4sp.9.8`, `stark-4sp.7.1`                                 |
| Re-evaluate the strict-peer workaround, perform manual accessibility assessment, and run the full integrated validation matrix                                           | `stark-4sp.7.3`–`stark-4sp.7.5`                                  |
| Reconcile the five canonical branches, integrate approved work by layer, independently review, and publish the final stack                                               | `stark-4sp.1.3`–`stark-4sp.1.5`, `stark-4sp.8.1`–`stark-4sp.8.9` |

The implemented browser foundation is awaiting its recorded prerequisite and
acceptance gates. Those obligations remain open; they are not implementation backlog.
Existing approved goldens are reused. Baseline tasks cover missing states and final
completeness checks.

## Constraints and decision records

- Preserve Stark's existing visual system through the Material M2 compatibility APIs
  (D-004). Capture the legacy oracle only through the reviewed update command; normal
  candidate comparisons must not update goldens.
- Use generated local sibling tarballs for current migration work (D-011). A successful
  existing-workspace build does not replace the clean dependency-cycle and fresh-consumer
  gates (D-012).
- Keep strict peer validation. The Angular CLI workaround remains subject to
  `stark-4sp.7.3` (D-001).
- Follow [the branch structure](MIGRATION_BRANCH_STRUCTURE.md) and
  [execution contract](MIGRATION_EXECUTION_SPEC.md). Completed functional checkpoints
  may be committed and pushed to the personal fork under the user's standing
  authorization. Canonical restacking remains separate from that checkpoint workflow.
- Use [the Stark 13 migration guide](docs/MIGRATION_GUIDE_STARK_13.md) for downstream
  instructions.

Completed checklists, resolved IMP-001–IMP-012 findings, previous validation results,
backup hashes, and the full D-001–D-013 decision history are preserved in
[the prior review record](https://github.com/dsebastien/stark/blob/8d116f2e665ef93d6a1adb7e4b0def3763cff498/IMPROVEMENT_PLAN.md)
and Beads. The old D-005 deferral for lack of browser access is superseded by the
working Playwright suite; remaining browser and accessibility checks have the owners
listed above. Cleanup evidence is recorded in `stark-4sp.2.6`.
