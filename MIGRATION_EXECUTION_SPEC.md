# Angular 22 Migration Execution Specification

## Status

Approved orchestration contract. Implementation is in progress.

## Objective

Finish the Angular 22 migration without losing work to context limits and without accepting unexplained UI drift.

Beads is the durable source of truth for remaining work. A single orchestrator owns Beads state, dispatches small tasks to isolated Codex or explicitly configured worker agents, verifies their evidence, and coordinates review and integration.

The current local five-branch migration stack is canonical:

1. `migration/angular-22/01-dependencies`
2. `migration/angular-22/02-build`
3. `migration/angular-22/03-testing`
4. `migration/angular-22/04-ui`
5. `migration/angular-22/05-agent-context`

The Stark 12 showcase at `https://stark.nbb.be/` is the visual and behavioral oracle. The migrated Showcase must preserve the visual system and behavior of all Stark UI surfaces and all Showcase/demo routes unless a difference is explicitly reviewed and approved.

## Confirmed Decisions

- Use Codex agents when the session host provides them, with the same isolated-worktree and worker-report contract as other configured clients. Do not install a separate Beads Codex integration; the orchestrator writes Beads through the repository CLI.
- The orchestrator is the only process allowed to claim, update, or close Beads issues.
- Workers receive an immutable issue snapshot and return code, validation evidence, and discovered follow-up work.
- Use Beads as the durable migration work tracker in `05-agent-context`.
- Version immutable legacy golden screenshots in Git.
- Keep videos, traces, HTML reports, console logs, network logs, and accessibility details as CI artifacts rather than Git-tracked files.
- Run all repository commands through profile-independent Git Bash and the repository launcher, which activates fnm and verifies the target repository's `.nvmrc` before invoking Node or npm.
- Never use the ambient Windows `node`, `npm`, or `npx` from PowerShell or `cmd.exe`.
- During all current sibling-repository migration work, build and consume generated local `file:` tarballs for every cross-project relationship.
- Canonical mode exists only to remove machine-specific references when preparing clean upstream pull requests; no package release work is in scope.
- Never push to the `upstream` remote (`NationalBankBelgium/stark`). Synchronize migration branches only to the personal `origin` fork after explicit approval.
- Preserve the documented one-commit-per-layer migration stack.

## Work continuity

Beads is the durable source of truth for active work, validation evidence, blockers,
and next actions. Agents load that state directly with `bd prime` and `bd show`.

## Tech Stack

- Angular `22.0.1`
- Angular Material/CDK `22.0.1`
- Node.js `>=22.22.3`
- npm `>=10.9.4`
- TypeScript `~6.0.3`
- Vitest `^4.1.9`
- Beads CLI `1.2.1`
- Planned Playwright Test `1.62.1`
- Planned `@axe-core/playwright` `4.13.0`

## Commands

### Beads and Copilot integration

These and all following repository commands run inside the verified Git Bash/fnm environment described below.

```bash
bd version
bd init --prefix stark --skip-agents --non-interactive
bd setup copilot
bd setup copilot --check
bd config set agent.profile conservative
bd doctor
bd hooks list
bd prime
bd ready --type task --json
```

`--skip-agents` prevents `bd init` from installing unrelated agent integrations. `bd setup copilot` is the only agent recipe installed.

### Migration stack integrity

```bash
git merge-base --is-ancestor master migration/angular-22/01-dependencies
git merge-base --is-ancestor migration/angular-22/01-dependencies migration/angular-22/02-build
git merge-base --is-ancestor migration/angular-22/02-build migration/angular-22/03-testing
git merge-base --is-ancestor migration/angular-22/03-testing migration/angular-22/04-ui
git merge-base --is-ancestor migration/angular-22/04-ui migration/angular-22/05-agent-context
git diff --check master..migration/angular-22/05-agent-context
git status --short --branch
```

### Existing validation

```bash
npm run check:packages-dependencies
npm run lint:all
npm run test:ci:packages
npm run build
npm run test:ci:starter
npm run test:ci:showcase
npm run build:starter
npm run build:showcase:ghpages
```

### Planned browser regression commands

The implementation must expose stable npm scripts with these responsibilities:

```bash
npm --prefix showcase run test:visual:install
npm --prefix showcase run test:visual:manifest
npm --prefix showcase run test:visual:legacy:update
npm --prefix showcase run test:visual:candidate
npm --prefix showcase run test:visual:critical:cross-browser
npm --prefix showcase run test:visual:report
```

`test:visual:legacy:update` is a privileged maintenance command. Normal CI must never update golden files.

### Planned execution-environment commands

Agents must invoke the configured Git Bash executable without interactive or login profiles:

```text
C:\LocalData\DEV\Software\Git\usr\bin\bash.exe --noprofile --norc
```

The launcher performs this bootstrap inside the target repository:

```bash
eval "$(fnm env --shell bash)"
fnm use --install-if-missing
test "$(node --version)" = "v$(cat .nvmrc)"
node --version
npm --version
```

Agents use the approved repository helper as the stable entry point:

```bash
bash scripts/with-project-node.sh -- npm run lint:all
bash scripts/with-project-node.sh -- npm run build
bash scripts/with-project-node.sh --repo /c/LocalData/duboiss/wks/NGMigration/code-style-dsebastien -- npm run build
```

It must fail closed when Git Bash, fnm, `.nvmrc`, Node, or npm does not match the repository contract.

### Planned sibling-dependency commands

```bash
npm run deps:local
npm run deps:canonical
npm run deps:check
```

- `deps:local` builds and packs the active sibling repositories, then rewrites the relevant manifests and lockfiles to generated local `file:` tarballs.
- `deps:canonical` restores the tracked non-local references and regenerates deterministic lockfiles for upstream PR preparation.
- `deps:check` fails when local tarball references, stale tarballs, mismatched hashes, or the wrong dependency mode are present in an upstream PR diff.
- Agents must never hand-edit dependency mode changes or commit local workspace paths.

## Project Structure

```text
.beads/                                      Beads workspace and tracked interchange data
.github/copilot-instructions.md              Repository and Beads workflow instructions
MIGRATION_EXECUTION_SPEC.md                  This specification
IMPROVEMENT_PLAN.md                          Review status, decisions, and validation results
scripts/
  with-project-node.sh                       Profile-free Git Bash/fnm command launcher
  manage-workspace-dependencies.mjs          Local/canonical dependency-mode switch
  workspace-dependencies.json                Sibling repositories, build order, and canonical refs
tmp/local-packages/                          Ignored generated sibling tarballs and checksums
showcase/e2e/visual/
  playwright.config.ts                       Browser, viewport, artifact, and web-server policy
  manifests/
    routes.ts                                Expected Showcase and session routes
    surfaces.ts                              Stark UI surface-to-scenario coverage
    scenarios.ts                             Interaction and state definitions
  fixtures/                                  Deterministic clock, locale, data, and browser setup
  pages/                                     Semantic page objects where reuse is justified
  specs/                                     Route, component, interaction, RBAC, and a11y tests
  snapshots/                                 Immutable legacy screenshot goldens
  styles/screenshot.css                      Narrowly scoped deterministic screenshot styling
```

Generated output belongs under ignored artifact directories such as `showcase/test-results/`, `showcase/playwright-report/`, and `showcase/artifacts/`.

## Code Style

Use typed, data-driven manifests and semantic locators. Do not couple tests to Angular Material's internal DOM when an accessible role, label, Stark-owned selector, or stable example ID is available.

```typescript
export const starkUiSurfaces = [
  {
    id: "dropdown",
    route: "/demo-ui/dropdown",
    scenarios: ["required", "multi-select", "disabled", "white-theme"]
  }
] as const;
```

- Keep each task focused and normally limited to five source files.
- Prefer one clear scenario helper over repeated ad hoc setup.
- Do not add abstraction layers until at least three scenarios need the same behavior.
- Document every mask, exclusion, threshold, and intentional difference with a reason.

## Beads Model

### Required hierarchy

- One migration execution epic.
- Child epics for:
  - canonical stack reconciliation;
  - Beads and Copilot orchestration;
  - browser regression infrastructure;
  - route and surface coverage;
  - immutable legacy baseline capture;
  - visual and behavioral remediation;
  - downstream migration-guide validation;
  - review, integration, fork synchronization, and upstream PR preparation.

### Required task fields

Every executable bead must include:

- target repository;
- owning migration layer;
- required dependency mode (`local` for coordinated development or `canonical` for review/integration);
- concrete scope and out-of-scope statement;
- acceptance criteria;
- exact validation commands;
- expected files or directories;
- dependencies and integration batch;
- execution metadata for agent type, model, reasoning effort, and parallel group;
- review evidence and final disposition.

### State ownership

Only the orchestrator may run Beads write commands. Worker agents may run `bd prime`, `bd show`, and other read-only commands only when needed. Workers must report proposed new tasks rather than creating or closing beads. Parent epics organize scope but are not dispatchable; use `bd ready --type task --json` for the executable frontier.

## Copilot Agent Protocol

1. The orchestrator selects a ready bead and verifies its dependencies.
2. The orchestrator creates an isolated worktree and short-lived branch from the bead's owning staging layer.
3. The orchestrator marks the bead in progress and passes the worker:
   - issue snapshot;
   - relevant specification section;
   - owning branch and worktree path;
   - repository guidance;
   - allowed files;
   - exact validation commands.
4. The implementation agent changes only its assigned worktree and returns:
   - changed files;
   - validation results;
   - assumptions;
   - risks;
   - discovered follow-up work.
5. A separate review agent reviews the diff against the bead, this specification, repository guidance, and the five review axes.
6. Required findings return to the implementation agent. The same reviewer rechecks the revised diff.
7. The orchestrator independently verifies the final diff and validation evidence before accepting it.
8. The orchestrator commits accepted work with the Beads ID in the commit message and updates Beads.

Workers must not push, amend canonical migration commits, modify Beads state, or remove another worker's worktree.

Workers must execute project commands only through profile-independent Git Bash and the repository's fnm-selected Node. A worker that cannot prove its shell, Node, npm, repository, and dependency mode must stop before installing, building, testing, or editing lockfiles.

## Execution Environment Contract

### Shell

- Git Bash is the only supported local project shell for migration agents.
- Agent automation launches Git Bash with `--noprofile --norc`; it must not load the current `/etc/profile.d/nbb_bash.sh`, which is not safe in non-interactive sessions.
- PowerShell and `cmd.exe` may not run repository Git, Node, npm, npx, build, test, package, or dependency-switching commands.
- CI may use its native POSIX shell but must still select the repository's pinned Node version.

### Node

- Each target repository's `.nvmrc` is authoritative.
- `fnm use --install-if-missing` runs after changing to the target repository so fnm resolves the correct file.
- The launcher verifies the active executable and version before forwarding a command.
- Child processes inherit the verified Node/npm paths; scripts must not rediscover ambient Windows executables.

### Dependency modes

`local` mode is for coordinated changes across the sibling repositories under `C:\LocalData\duboiss\wks\NGMigration`:

1. select each repository's `.nvmrc` through fnm;
2. build and `npm pack` packages in dependency order;
3. store generated tarballs and checksums under the ignored `tmp/local-packages/` directory;
4. update consuming `package.json` and lockfiles to those generated `file:` tarballs;
5. record the source repository, branch, commit, package version, tarball path, and checksum.

`canonical` mode is used only for clean upstream PR preparation and final integration validation:

1. restore the repository-appropriate non-local package references;
2. regenerate lockfiles with the verified fnm Node/npm toolchain;
3. reject local absolute paths, sibling-directory links, stale tarballs, and uncommitted dependency-mode changes;
4. run clean install, strict dependency-tree, package, and consumer checks.

Switching modes must be idempotent and reversible. The canonical dependency map is tracked; generated tarballs and machine-specific paths are not.

## Review and Integration Strategy

### Review gates

Every bead requires:

1. tests or executable evidence that fail or expose the gap before the fix where applicable;
2. focused validation by the implementation agent;
3. independent Copilot review for correctness, readability, architecture, security, and performance;
4. specification and repository-guidance compliance review;
5. orchestrator verification;
6. maintainer review for baseline changes, intentional visual differences, dependency additions, CI changes, and history rewrites.

Critical and required review findings block integration. Optional findings may be deferred only into a linked bead with explicit justification.

### Staging branches

Accepted atomic commits accumulate on layer-specific staging branches:

```text
staging/angular-22/01-dependencies
staging/angular-22/02-build
staging/angular-22/03-testing
staging/angular-22/04-ui
staging/angular-22/05-agent-context
```

Worker branches target the lowest staging layer that owns the concern. Examples:

- dependency additions: layer 01;
- build and packaging wiring: layer 02;
- test runner and browser-test infrastructure: layer 03;
- Showcase fixtures and UI corrections: layer 04;
- Beads, agent guidance, migration status, and review documentation: layer 05.

Atomic staging commits remain individually reviewable and revertible. Canonical migration branches are not rewritten for every bead.

### Integration checkpoints

At a reviewed checkpoint:

1. freeze new worker dispatch for affected layers;
2. confirm every included bead is approved and closed or integration-ready;
3. create backup refs for all affected canonical branch tips;
4. review the complete staged delta per owning layer;
5. fold approved staging commits into the owning layer's single canonical commit;
6. restack every descendant canonical branch in order;
7. run the affected focused gates and the complete stack integrity checks;
8. run an independent final review of each layer against its direct parent;
9. record hashes, evidence, decisions, and known debt in Beads and `IMPROVEMENT_PLAN.md`;
10. obtain explicit maintainer approval before any force-with-lease synchronization;
11. synchronize rewritten branches from 01 through 05 to the personal `origin` fork only;
12. verify remote hashes and return the primary worktree to `05-agent-context`.

Never merge a staging branch directly into a canonical migration branch because that would violate the one-commit-per-layer contract.

### Fork synchronization and upstream PR safety

- `upstream` is fetch-only and its local push URL must remain `DISABLED`.
- Workers never push.
- The orchestrator never uses plain `--force`.
- Every rewritten push uses an observed lease value and `--force-with-lease`.
- A remote hash mismatch stops synchronization immediately.
- No GitHub merge action targets `NationalBankBelgium/stark`.
- No npm/package release or release-version preparation is part of this execution plan.
- Upstream repositories receive changes only through later maintainer-created pull requests.

## Browser Regression Strategy

### Coverage inventory

The initial manifest must account for:

- 44 Showcase-owned concrete routes;
- 4 Stark session routes;
- 36 visible components and pages;
- 10 visible or interactive directives;
- 6 behavior-producing services.

The manifest check must fail when a concrete route or exported visible/interactive surface lacks an owned scenario.

### Baseline and candidate

- Legacy oracle: `https://stark.nbb.be/`
- Candidate: the locally served migrated Showcase
- Legacy screenshots are generated only by the privileged update command, reviewed, and committed.
- Candidate runs compare against the committed legacy goldens.
- Baselines and candidate comparisons must run in the same pinned OS, browser, font, locale, timezone, scale, and headless environment.

### Determinism

- Freeze time and timezone.
- Fix locale and browser language.
- Wait for fonts and stable application state.
- Disable animations, transitions, ripples, and caret rendering during screenshots.
- Seed or intercept volatile application metadata.
- Use deterministic ordering and data.
- Mask only documented volatile or intentionally different regions.
- Treat unexpected console errors and failed network requests as failures.

### Visual assertions

- Component and example clips use zero unexplained pixel difference.
- Full-page screenshots use zero unexplained pixel difference after approved masks.
- Each mask is narrow, named, and justified in the scenario manifest.
- Golden changes require a human-reviewed before/after diff and cannot be auto-approved.

### Interaction assertions

Scenarios cover component-specific state transitions, keyboard behavior, focus restoration, overlays, form validation, routing, RBAC, responsive layout, reduced motion, and high-contrast/forced-color behavior where applicable.

### Accessibility assertions

Use `@axe-core/playwright` to fingerprint automatically detectable WCAG A/AA violations on the legacy state and fail when the candidate adds or worsens a violation. Automated scans supplement rather than replace manual keyboard, focus, accessible-name, role, and announcement checks.

### Browser and viewport matrix

- Every route and surface: Chromium at `1440x900`, `1024x768`, and `390x844`.
- Every interactive surface: Chromium desktop and mobile journeys.
- Critical Material overlays, forms, tables, session, and RBAC journeys: Chromium, Firefox, and WebKit at desktop and mobile sizes.
- Dedicated scenarios: 200% zoom-equivalent layout, reduced motion, and forced colors/high contrast.

### Artifacts

On failure, CI retains:

- actual, expected, and diff screenshots;
- Playwright trace;
- journey video where configured;
- HTML report;
- console and failed-request logs;
- accessibility result fingerprints;
- run metadata.

## Testing Strategy

- Unit behavior remains in Vitest close to its component or application source.
- Browser-visible behavior belongs to the Showcase-owned Playwright suite.
- Manifest tests prove route and surface coverage.
- Static route crawling is not accepted as interaction coverage.
- Visual fixes require a regression scenario that fails against the unfixed candidate.
- Browser-runner infrastructure is validated before broad baseline capture.
- Full visual runs may be sharded in CI, but each shard must publish mergeable artifacts and a complete coverage report.

## Boundaries

### Always

- Read the nearest `AGENTS.md`.
- Work in an isolated worktree.
- Use profile-independent Git Bash and activate fnm from the target repository before every project command.
- Verify the active Node/npm versions and dependency mode before installs, builds, tests, packaging, or lockfile changes.
- Assign each change to the lowest owning migration layer.
- Use separate implementation and review agents.
- Record validation evidence and review disposition in Beads.
- Preserve public APIs and Stark's Material M2 visual intent.
- Keep generated reports and videos out of Git.

### Ask first

- Add or upgrade dependencies.
- Change CI configuration.
- Change the canonical sibling dependency map or package build order.
- Update golden screenshots.
- Approve an intentional visual or behavioral difference.
- Rewrite canonical migration history.
- Force-with-lease push to `origin`.
- Remove dead or obsolete code discovered during a task.

### Never

- Push to `upstream` or any repository under `NationalBankBelgium`.
- Let workers mutate Beads, canonical branches, or another worker's worktree.
- Run project Git, Node, npm, npx, build, test, or packaging commands directly from PowerShell or `cmd.exe`.
- Use ambient Windows Node/npm executables or skip `fnm use` in a target repository.
- Hand-edit manifests to switch dependency modes or commit machine-specific local tarball paths.
- Allow worker agents to mutate Beads or push Git refs.
- Use plain `--force`.
- Merge staging branches into canonical migration branches.
- Edit generated build, coverage, report, or dependency output by hand.
- Accept a visual difference by increasing global screenshot tolerance.
- Update goldens in normal CI.

## Success Criteria

- Beads is initialized, healthy, and integrated with GitHub Copilot CLI.
- All known remaining migration work is represented as dependency-aware beads with owning layers and acceptance criteria.
- Every agent command runs through verified Git Bash/fnm with the target repository's `.nvmrc`.
- Local sibling tarball mode is deterministic and reversible, and canonical mode rejects accidental local references in upstream PR preparation.
- The reviewed WIP stack is synchronized to the personal `origin` fork with verified hashes after explicit approval.
- Every one of the 48 known concrete routes is discovered and covered.
- Every one of the 52 known visible/interactive Stark UI surfaces maps to at least one verified scenario.
- All golden screenshots are captured from the legacy Showcase in the pinned environment and reviewed.
- The migrated candidate has no unexplained screenshot differences.
- The migrated candidate has no unexplained behavioral, keyboard, focus, responsive, RBAC, console, network, or automated accessibility regressions.
- Existing unit, lint, build, package, starter, Showcase, and downstream migration-guide gates pass.
- Every integrated bead has independent review evidence.
- Canonical migration branches retain one commit per layer and correct ancestry.
- Each upgraded fork is ready for a separately reviewed upstream pull request; no package release work is performed.
- No push is made to `upstream` or a `NationalBankBelgium` repository.

## Sources

- Beads installation and Windows support: https://github.com/gastownhall/beads/blob/main/docs/getting-started/installation.md
- Beads Copilot CLI integration: https://github.com/gastownhall/beads/blob/main/docs/integrations/copilot-cli.md
- Playwright visual comparisons: https://playwright.dev/docs/test-snapshots
- Playwright projects: https://playwright.dev/docs/test-projects
- Playwright web server: https://playwright.dev/docs/test-webserver
- Playwright accessibility testing: https://playwright.dev/docs/accessibility-testing

## Open Questions

None. Any newly discovered ambiguity must be recorded as a decision bead before implementation continues.
