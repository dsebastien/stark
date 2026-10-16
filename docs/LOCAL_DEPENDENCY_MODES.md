# Local dependency modes

The workspace has two explicit, reversible dependency modes. Run both commands
from the canonical `stark-dsebastien` checkout through its verified Node
launcher:

```bash
bash scripts/with-project-node.sh -- npm run deps:local
bash scripts/with-project-node.sh -- npm run deps:canonical
```

`deps:local` first runs the immutable local-package builder. It accepts only
the returned, validated `.complete` generation and rewrites every consumer to
a relative `file:` reference below that generation's `artifacts/` directory.
It never points consumers at a sibling repository's mutable `dist/` directory.
The command then regenerates each affected `package-lock.json` with that
repository's runtime through `scripts/with-project-node.sh` and verifies the
resolved tarball version and integrity against the generation proof.

`deps:canonical` restores the exact manifest and lock bytes captured before
the local switch. It still runs every affected lockfile regeneration and
accepts the result only if the bytes remain identical. The canonical values
are recorded as `canonicalReference` entries in
`scripts/local-dependency-map.json`; they are the reviewed references already
tracked on the migration branches.

Both commands are idempotent. A repeated command verifies the current
manifest/lock state without rebuilding or rewriting it. A mixed mode, a
changed generation, an integrity mismatch, or an edit made after switching to
local mode fails closed.

Each command acquires the workspace-wide dependency-mode operation lock before
it recovers a journal, detects the current mode, or invokes the package builder.
The complete switch runs in one verified child-process boundary. Lock ownership
includes process start identity and recorded descendants; stale recovery fails
closed unless it can prove that the owner and every child are quiescent. The
internal worker also verifies that it is the live descendant recorded by the
active lock before it can mutate. The wrapper persists and flushes its running
identity first, so an interrupted operation remains recoverable after every
recorded process is proven quiescent. Invoking the worker entry point directly
cannot bypass this check.

Worker output is inherited rather than buffered. The small structured result is
published as a validated atomic file inside the active lock and retained with
the released-lock evidence; verbose builds therefore cannot exhaust a stdout
capture buffer.

## Transaction state

Before changing a tracked file, the tool writes a recovery journal under the
ignored workspace path `tmp/local-dependency-mode/`. Any ordinary command
failure restores every affected manifest, lockfile, and prior mode-state byte
for byte. A later invocation also recovers a journal left by an interrupted
process before inspecting the requested mode.

Journal and mode-state records have an exact schema and must name the complete,
duplicate-free managed-file set. Their canonical base64 and SHA-256 evidence is
validated before recovery. Every managed path is then revalidated immediately
before replacement: symbolic links, junctions/reparse points, hardlinks, and
duplicate filesystem identities are rejected.

The journal backup is the single authoritative canonical snapshot. The tool
revalidates that exact snapshot and the persisted journal immediately before
the first manifest or lockfile mutation.

Do not edit the journal or the local-mode snapshot by hand. If the tool reports
that a file changed after local mode was enabled, preserve that edit, restore
or commit it deliberately, and rerun the appropriate mode command.

## Map fields

Each consumer entry has two distinct references:

- `reference` locates the producer's build output and is used only to validate
  the build graph;
- `canonicalReference` records the exact reviewed value restored by
  `deps:canonical`.

Local consumer references are derived solely from the validated immutable
generation and are never stored in the tracked map.
