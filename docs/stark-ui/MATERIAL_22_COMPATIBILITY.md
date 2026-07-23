# Angular Material 22 compatibility audit

This inventory records Stark's review of selectors that depend on Angular Material's rendered MDC classes. It complements the public migration guidance in `MIGRATION_GUIDE_STARK_13.md`.

## Policy

New styling should use, in order:

1. Angular Material's documented theming API;
2. a Stark-owned host class, element class, or CSS custom property;
3. a Material/MDC implementation selector only when Material exposes no public styling hook.

An implementation selector in the third category must be scoped under a Stark-owned component, control, or overlay class. It is a tested compatibility bridge, not part of Stark's public styling contract. Re-run this audit whenever Angular Material changes major version. See Angular Material's [theming guide](https://material.angular.dev/guide/theming) and [component-style customization guidance](https://material.angular.dev/guide/customizing-component-styles).

## Library inventory

The following files contain all retained `.mat-mdc-*` or `.mdc-*` selector groups in the published UI package. Each group is scoped to a Stark component/control, or to a Stark class attached to an overlay rendered outside the component tree.

| Area                           | Files                                                                                                                                               | Review result                                                                                                                          |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Published foundations          | `styles/_base.scss`, `_material-fixes.scss`; `styles/components/_button.scss`, `_button-theme.scss`, `_card.scss`, `_card-theme.scss`, `_icon.scss` | Retained as the documented Stark Material skin. Global fixes preserve established layout only where Material exposes no public hook.   |
| Actions and application data   | `modules/action-bar/components/_action-bar.component.scss`, `_action-bar-theme.scss`; `modules/app-data/components/_app-data.component.scss`        | Retained under Stark action/data hooks; size variables are set on Stark-owned buttons.                                                 |
| Application menu               | `modules/app-menu/components/_app-menu.component.scss`, `_app-menu-theme.scss`                                                                      | Retained under `.stark-app-menu`; Material exposes no public hooks for list-item layout descendants.                                   |
| Date inputs                    | `modules/date-picker/components/_date-picker.component.scss`; `modules/date-time-picker/components/date-time-picker.component.scss`                 | Retained under Material's Stark control-type host classes; required for `MatFormFieldControl` sizing.                                  |
| Dialog overlays                | `modules/dialogs/components/_dialogs.component.scss`, `prompt-dialog.component.scss`                                                                | Retained under Stark dialog/prompt hooks; overlay content is outside component encapsulation.                                          |
| Dropdown and language selector | `modules/dropdown/components/_dropdown-theme.scss`; `modules/language-selector/components/_language-selector.component.scss`                        | Retained under `.stark-dropdown-mat-form-field` or the Stark language selector; required for the established M2-compatible appearance. |
| Message pane and minimap       | `modules/message-pane/components/_message-pane.component.scss`, `_message-pane-theme.scss`; `modules/minimap/components/_minimap.component.scss`    | Retained under Stark component/menu classes.                                                                                           |
| Route search                   | `modules/route-search/components/_route-search.component.scss`, `_route-search-theme.scss`                                                          | Retained under `.stark-route-search`; Material exposes no public form-field descendant layout hooks.                                   |
| Session login                  | `modules/session-ui/pages/login/_login-page.component.scss`                                                                                         | Retained under the Stark login form.                                                                                                   |
| Table and multisort            | `modules/table/components/_table.component.scss`, `dialogs/_multisort.component.scss`                                                               | Retained under Stark table/filter/dialog hooks; sticky-cell and form-field internals have no equivalent public style API.              |
| Toast overlay                  | `modules/toast-notification/components/_toast-notification.component.scss`                                                                          | Retained under `.stark-toast-notification-panel`, which Stark supplies through the snack-bar overlay API.                              |

No unscoped implementation selector was found in the starter application.

## Showcase-only inventory

These files exercise or demonstrate Material integration and are not shipped as Stark library styling:

- `app/_app.component.scss` and `_app.component-theme.scss`;
- `app/demo-ui/components/table-with-fixed-actions/table-with-fixed-actions.component.scss` and `table-with-footer/table-with-footer.component.scss`;
- `app/demo-ui/pages/date-time-picker/demo-date-time-picker-page.component.scss`, `dropdown/demo-dropdown-page.component.scss`, `pretty-print/demo-pretty-print-page.component.scss`, and `progress-indicator/demo-progress-indicator-page.component.scss`;
- `app/example-viewer/components/_example-viewer-theme.scss`;
- `app/styleguide/pages/button/styleguide-button-page.component.scss` and `card/styleguide-card-page.component.scss`;
- `app/welcome/pages/reactive-form-errors/reactive-form-errors-page.component.theme.scss`;
- the matching date-time-picker and table example Sass files under `src/assets/examples`.

The showcase GitHub button was changed to use its existing `.github-icon` hook instead of qualifying that hook with `.mat-mdc-icon-button`. The remaining selectors are locally scoped examples or visual-regression fixtures whose Material structure is the behavior being demonstrated.

## Verification

The audit scan is reproducible with:

```bash
rg -n "\\.mat-mdc-|\\.mdc-" packages/stark-ui/src packages/stark-ui/styles showcase/src starter/src --glob "*.scss"
```

The UI package tests, starter production build, showcase production build, and browser smoke checks are the regression gates for the retained compatibility bridges.
