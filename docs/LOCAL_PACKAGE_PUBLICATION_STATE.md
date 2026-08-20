# Local package publication state machine

Status: design proposal for `stark-4sp.9.4.1`. This document must be accepted
before `scripts/build-local-packages.mjs` is implemented or repaired.

## Goals and contract

The local-package producer builds sibling repositories into an immutable,
append-only generation. A successful call returns the exact generation
descriptor that its consumer must use:

```ts
type LocalPackageGeneration = {
  schemaVersion: 2;
  workspace: { realPath: string; volumeId: string; directoryId: string };
  generationId: string;
  generationPath: string; // the `.complete` directory, never a reconstructed path
  treeSha256: string;
  artifacts: Array<{ path: string; sha256: string; sha512: string }>;
  repositories: Array<{
    id: string;
    realPath: string;
    branch: string;
    commit: string;
    trackedStatus: string;
    trackedFilesSha256: string;
  }>;
  warnings: Array<{ phase: string; message: string }>;
};
```

The next consumer (including 9.5) receives this value; it must not infer a
`tmp/local-packages` path or a `current` generation. There is no mutable
`current`, `previous`, `backup`, `rollback`, or `cleanup` directory. Existing
complete generations are immutable history and are not authority for a new
invocation. The returned descriptor is the only authority for that invocation.

The state root is an ignored directory inside the canonical workspace:

```text
<workspace>/tmp/local-package-state/
  locks/active
  locks/candidates/<lock-id>.incomplete
  locks/release-receipts/<lock-id>.complete
  locks/released/<lock-id>.complete
  generations/<generation-id>.incomplete
  generations/<generation-id>.complete
  quarantine/<opaque-id>.<original-state>.<nonce>
```

The producer must create and validate this root before running any sibling
command. A pre-existing state root is not evidence that a generation is safe.

## Declarative operation plan

The public seam accepts one data-only plan derived from
`local-dependency-map.json`:

```text
{ workspaceRoot, stateRoot, repositories: [
    { id, directory, node, packages, commands: [{ phase, cwd, argv }] }
] }
```

Paths and arguments are strings only; there are no callback-valued operations
or test hooks in the plan. The implementation may have private filesystem and
process adapters, but fault tests select a named operation (for example,
`publish.rename` or `repository[router].post-command-snapshot`) through a
declarative fault plan. This keeps recovery behavior testable without making
arbitrary callbacks part of the publication contract.

The candidate descriptor is written before the first producer command. It
contains the canonical workspace identity, generation ID, map digest, ordered
repository plan, expected artifacts, and the initial repository snapshots. The
descriptor and each repository snapshot are written to the staging generation
and are treated as immutable after their atomic write. A recovery process can
therefore distinguish an abandoned candidate from an unknown directory.

## Filesystem invariants

1. The workspace identity is captured once using the canonical real path and
   stable volume/directory identity. Every later operation rechecks both. A
   path that resolves to a different identity fails closed.
2. Every configured path is a relative path below the stated base. Reject
   empty paths, `..` segments, POSIX/Windows/UNC absolute paths, drive roots,
   alternate data streams (`:`), NUL/control characters, trailing dots or
   spaces, and Windows reserved device names (including names with an
   extension). Normalize separators before checking containment.
3. Resolve and `lstat` every existing path component. Reject symlinks,
   junctions, mount/reparse points, and any ancestor whose canonical path is
   outside the expected root. Do not use a recursive delete on an unchecked
   path. Recovery revalidates the source immediately before an atomic rename.
4. Repository directories must be direct canonical children of the workspace.
   Artifact directories and the state root must likewise be canonical,
   non-reparse descendants. A case-folded Windows containment check is
   required in addition to `path.relative`.
5. All tracked entries are enumerated with `git ls-files -z`. Each path is
   validated by the same containment rules, and its type, file identity,
   mode, and SHA-256 content digest are recorded. Reject tracked symlinks,
   reparse points, non-regular files, and duplicate file identities (hard
   links). If the platform cannot provide a reliable identity, fail closed.
6. Every generated artifact is a regular file with a unique identity. The
   complete tree has an exact manifest and tree digest; unexpected files,
   links, hard links, duplicate names, or changed identities invalidate it.
7. A complete generation is never opened for writing. A new run always gets a
   cryptographically random ID and a new `.incomplete` directory. ID/path
   collisions are errors, not overwrite opportunities.

## Lock protocol

The lock is an atomic directory publication, not a PID file. The owner first
creates a uniquely named candidate, writes and closes a complete descriptor,
then renames it to `locks/active`. The rename has an absent destination and
therefore exactly one concurrent candidate can win. The descriptor includes a
random owner nonce, canonical workspace identity, process ID plus process
creation/start token, command line, and the planned child-process/job identity.
The PID is evidence only; it is never sufficient for stale-lock recovery.

Normal release is also two-phase and atomic:

1. Wait for all declared child commands to exit and run the final repository
   invariants.
2. Write a complete release receipt to a unique temporary path and atomically
   rename it to `locks/release-receipts/<lock-id>.complete`.
3. Re-read `locks/active` and require an exact owner descriptor match.
4. Atomically rename `locks/active` to a unique
   `locks/released/<lock-id>.complete` path. Never truncate or recursively
   delete the active lock.

If release fails, the active lock and receipt remain as evidence and the
primary error is returned. A later invocation cannot silently take ownership.
Receipt-before-release makes a crash between the two release operations
recoverable without guessing whether work was complete.

When `locks/active` exists, normal startup reports its descriptor and stops.
It does not delete the lock on an expired timestamp or a dead-looking PID. A
separate operator-only break-glass command must:

- verify the lock's canonical workspace identity and exact lock directory
  identity;
- query the OS process tree using process creation tokens and prove the owner
  and every recorded descendant/job member are quiescent;
- refuse if process enumeration is unavailable, ambiguous, or a PID was
  reused;
- record the process-tree evidence in a new quarantine descriptor; and
- atomically rename the lock to `quarantine/...active-lock...`, never delete
  it in place.

Without all-descendants-quiescent proof, stale-lock recovery is unavailable.

## Generation states and transitions

| State / evidence | Authority | Allowed transition and required proof |
| --- | --- | --- |
| `ABSENT` (no candidate for this ID) | None | Create a fresh random candidate; collision is fatal. |
| `LOCK-CANDIDATE` (`locks/candidates/*.incomplete`) | None | Write/validate descriptor, then atomic rename to `locks/active`; abandoned candidates are quarantined, never reused. |
| `LOCK-ACTIVE` (`locks/active`) | One producer owns the workspace | Reconcile all prior state before any producer command. |
| `RECONCILING` (active lock; scan is in progress) | None | Quarantine abandoned `.incomplete` generations and malformed/invalid `.complete` generations after identity and containment checks. Any failed quarantine aborts before production. |
| `PLANNED` (candidate descriptor in `generations/<id>.incomplete`) | None | Persist plan and initial repository snapshots atomically; only then enter build. |
| `BUILDING` (candidate contents, no completion marker) | None | Run only declared commands. After every command, including a non-zero exit, verify branch, commit, status, tracked path set, identities, and hashes. Any failure goes to quarantine. |
| `VALIDATING` (candidate has all files and a temporary validation record) | None | Validate exact artifact set, provenance, checksums, tree digest, identities, and descriptor. Write the final completion marker only after all checks pass. |
| `PUBLISH-READY` (marker in `.incomplete`) | None | Close files and atomically rename `<id>.incomplete` to `<id>.complete`; do not expose or rename a mutable `current` directory. |
| `PUBLISHED` (`generations/<id>.complete` plus valid marker) | The returned descriptor only | Re-scan by exact path and descriptor/tree identity. Return the descriptor. No writes are permitted below the complete directory. |
| `FAILED-CANDIDATE` (any incomplete or invalid candidate) | None | Atomically quarantine the entire directory to an opaque destination. If this fails, preserve it and fail closed. Never delete failed output in place. |
| `INVALID-COMPLETE` (marker/tree/identity mismatch) | None | Quarantine before any new producer command. A quarantine failure prevents production. |
| `LOCK-RELEASED` (`locks/released/*.complete`) | None | Immutable audit evidence. It is not an output generation and is never used as a lock. |
| `QUARANTINED` (`quarantine/*`) | None | Evidence only. Cleanup requires a separate explicit, containment-checked operator action; the producer never removes it. |

The only publication point is the `.incomplete` to `.complete` directory
rename. A crash before it leaves no authority; a crash after it leaves a
candidate that recovery validates by its marker and digest. A failed new run
cannot damage an older complete generation because no operation targets an
older generation. If recovery sees more than one plausible owner, a duplicate
identity, an incomplete marker, or an unclassifiable path, it preserves all
evidence and fails closed.

## Crash recovery and error composition

Startup order is mandatory:

1. Canonicalize and validate the workspace/state root.
2. Acquire the exclusive lock, or stop with non-owning lock evidence.
3. Reconcile abandoned candidates and validate/quarantine malformed state.
4. Prove the state root has no unresolved producer-owned staging state.
5. Only then execute the first sibling build command.

This cleanup-before-producer ordering is a gate, not best-effort housekeeping.
There is no automatic rollback that removes a failed directory or restores a
mutable backup. Quarantine is the rollback mechanism: the old complete
generation remains untouched and a failed candidate is moved as one directory.

Every failure carries one primary error and an ordered list of secondary
failures, each tagged with its phase and path. The primary error is never
replaced by a cleanup, quarantine, invariant, or lock-release error. In
particular:

- a command failure remains primary; a post-failure tracked-file mutation is a
  secondary invariant failure;
- a quarantine/cleanup failure preserves the candidate as evidence and is
  secondary when another error already exists;
- a pre-production reconciliation failure prevents all producer commands;
- after a valid `.complete` rename, disposable audit cleanup cannot revoke
  authority. It is returned as a warning and persisted in the descriptor; if
  the descriptor or tree proof itself fails, publication fails and the new
  directory is quarantined before release.

The CLI prints the structured error tree and the paths that were preserved.

## Test matrix

The implementation test suite must exercise the public declarative plan and
real child processes for contention. Faults are named plan entries, not
arbitrary callbacks. Each case asserts both filesystem state and the primary /
secondary error report.

| Area | Required cases |
| --- | --- |
| Locking | Two concurrent producers: exactly one atomic publish succeeds; the loser preserves its candidate and reports the active descriptor. Normal release creates a receipt and atomically retires the exact owner. Candidate/active destination collisions fail without overwrite. |
| Stale lock | PID reuse, dead owner with a live descendant, unknown process tree, and unavailable process enumeration all refuse recovery. Explicit break-glass with all descendants quiescent quarantines the lock and preserves evidence. Non-owning lock metadata is never deleted. |
| Plan/recovery | Crash/fault at each candidate creation, descriptor write, command, validation, marker write, and publication rename. Startup quarantines every abandoned staging candidate before producer execution; quarantine failure proves zero producer commands ran. |
| Immutable generations | Previous complete generation remains byte-for-byte unchanged after build failure, validation failure, publication failure, and quarantine failure. A successful run returns one exact new descriptor; the consumer rejects a reconstructed or changed path. No mutable current/backup/rollback path is created. |
| Markers | Missing, duplicate, stale, malformed, or mismatched completion marker; marker digest/tree digest mismatch; valid complete generation survives a later failed run. `.incomplete` is never accepted as authority. |
| Repository invariants | Initially dirty tracked file changed during a successful command; tracked file changed during a non-zero command; branch/HEAD/status/path-set/type/identity/hash mutation; tracked symlink, reparse point, hard link, and duplicate identity. Each failure runs the final snapshot and composes the invariant error with the command error. |
| Source artifacts | Missing, duplicate, stale, unexpected, linked, hard-linked, or wrong-version tarballs. A stale source cleanup fault occurs before producer execution and cannot remove a prior complete generation. |
| Containment | POSIX/Windows/UNC absolute paths, traversal, drive-relative paths, ADS, reserved names, control characters, trailing dot/space, case-folded escapes, symlink/junction/reparse ancestors, workspace alias, and canonical identity changes. Recovery refuses a changed source before rename. |
| Output proof | Missing/extra artifact, corrupt bytes, checksum/provenance mismatch, duplicate artifact identity, incomplete tree, and tree digest change after validation. A post-rename proof failure quarantines the new generation without deleting it. |
| Error handling | Command + invariant failure; command + quarantine failure; publication + quarantine failure; release + cleanup failure; cleanup-only warning after valid publication. Assert primary error identity/message, secondary ordering, preserved paths, and exit behavior. |
| Concurrency/Windows | Real child-process lock contention and retryable rename contention on Windows; persistent contention is bounded. No test relies on sleep, PID alone, or a pre-existing mutable output directory. |

Implementation is ready only when every row is covered and a review confirms
that no filesystem operation can expose an uncommitted candidate or destroy
the last valid evidence.
