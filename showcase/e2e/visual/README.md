# Showcase visual runner

The legacy visual oracle is pinned to
`https://stark.nbb.be/showcase/latest/`. Its observed HTML build metadata is
recorded in `support/oracle.ts`; the oracle test fails with the observed
metadata attached when the online deployment changes.

Browser journeys start at the Showcase shell and click visible menu entries.
They must not use a direct deep link because the legacy GitHub Pages host can
return its 404 shell for one.

Normal runs target the migrated candidate and set `updateSnapshots` to `none`:

```text
npm run test:visual:candidate
```

Updating legacy goldens is a reviewed maintenance operation only:

```text
npm run test:visual:legacy:update -- e2e/visual/specs/<scenario>.spec.ts
```

The update wrapper selects the legacy target and supplies the only supported
snapshot-update flag. Candidate runs fail closed if `--update-snapshots` is
provided.
