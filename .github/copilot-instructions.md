# GitHub Copilot Instructions

Use [../AGENTS.md](../AGENTS.md) as the authoritative repository guidance.

When you work inside a folder that has its own `AGENTS.md`, read that closer file as well because it refines the rules for that part of the monorepo.

This repository uses **Beads (bd)** for issue tracking.

## Core Workflow

- The active orchestrator is the only agent allowed to create, claim, update, or close Beads issues
- Worker agents may use `bd prime`, `bd show`, and other read-only commands when needed
- Workers report discovered work to the orchestrator instead of creating issues
- The orchestrator uses `bd ready --type task --json` to find unblocked executable work and records verification evidence before closing it
- Treat commit, push, and Dolt remote sync as policy-controlled handoff actions
- Do not commit, push, or run Dolt remote sync unless explicitly authorized
- Never push to `upstream` or any repository under `NationalBankBelgium`

## Shell and Dependency Contract

- Run migration repository commands through `C:\LocalData\DEV\Software\Git\usr\bin\bash.exe --noprofile --norc`; do not use PowerShell or `cmd.exe` as the project shell
- In profile-free Git Bash, use `bash scripts/with-project-node.sh -- COMMAND [ARGS...]` for Stark or `bash scripts/with-project-node.sh --repo /c/LocalData/duboiss/wks/NGMigration/<repository> -- COMMAND [ARGS...]` for a sibling fork
- The launcher must verify fnm and the target repository's exact `.nvmrc` Node version before running the command
- Never use ambient Windows `node`, `npm`, or `npx`
- Use generated local tarballs for active sibling development; restore repository-appropriate non-local references only when preparing clean upstream pull requests
- Never hand-edit dependency mode switches or commit machine-specific local package paths

## Context Loading

Run `bd prime` for the full workflow context.
