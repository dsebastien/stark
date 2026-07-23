# Prettier

Stark uses [Prettier](https://prettier.io/) for source and documentation formatting.

Run the repository formatter from the root:

```shell
npm run prettier-check
```

The root, starter, and showcase configurations extend the shared configuration published by `@nationalbankbelgium/stark-build`. `.prettierignore` lists generated and third-party files that must not be formatted.

ESLint owns TypeScript and Angular correctness rules; Stylelint owns stylesheet correctness rules. Their configurations avoid formatting rules that conflict with Prettier. `npm run lint` runs the maintained lint gates, while `npm run stylelint-check` checks the Stylelint/Prettier configuration boundary.

Husky and lint-staged format supported changed files before a commit. Run the root formatter explicitly when changing shared configuration or when validating the complete tree.
