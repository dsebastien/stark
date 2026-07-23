Files that belong to the consuming application rather than this package:

- `config/index-head-config.js`
- `src/index.html`
- `src/stark-app-config.json`
- `src/stark-app-metadata.json`

Generated output that should stay ignored:

- `.stark/generated/index.html`

The Angular 22 path is now based on the native Angular builder plus `config/index-html.generator.js`.
Do not reintroduce the removed custom-webpack or `indexTransform` flow here.
