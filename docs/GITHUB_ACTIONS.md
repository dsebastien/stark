# GitHub Actions with Stark

The maintained workflow is `.github/workflows/build.yml`. It validates the repository on Node 22.22.3 and npm 10.9.4, matching the declared minimum engines.

## Required build sequence

The workflow uses `actions/checkout@v4` and `actions/setup-node@v4`, with npm's cache keyed by the tracked lockfiles. It then runs the same maintained commands used locally:

```text
npm run check:packages-dependencies
npm ci
npm run build:trace
npm run lint:packages
npm run test:ci:packages
npm ci --prefix starter
npm ci --prefix showcase
npm run lint:starter
npm run lint:showcase
npm run test:ci:starter
npm run test:ci:showcase
npm run build:starter
npm run build:showcase:ghpages
```

Package and showcase output is transferred between jobs with `actions/upload-artifact@v4` and `actions/download-artifact@v4`. Coverage is submitted with `coverallsapp/github-action@v2`.

## Browser-based E2E jobs

Stark 13 does not ship shared Protractor, Playwright, or BrowserStack workflow steps. A consuming application that needs browser E2E coverage must own its test setup, dependencies, and CI job independently from `@nationalbankbelgium/stark-testing`.

## Updating the workflow

Keep action versions, Node/npm versions, cache lockfiles, and documented commands aligned with the executable workflow. Do not reintroduce retired Karma, Protractor, BrowserStack, or custom-Webpack commands.
