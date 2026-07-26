## 1. OpenSpec and guardrails

- [x] 1.1 Add public API and component-documentation scenarios; strict validate the change.
- [x] 1.2 Add architecture checker and make it part of lint without changing valid headless packages.
- [x] 1.3 Add vNext migration guide, package README updates and major changeset.

## 2. Public contracts and component structure

- [x] 2.1 Red → Green: rename foundation APIs (ui-context, components, registry) and move each visual feature.
- [x] 2.2 Red → Green: rename/move domain widgets (history, operation log, command panel, property panel,
  scene tree, asset browser, stage and materials) while preserving visual and accessibility behaviour.
- [x] 2.3 Red → Green: replace Editor/Preview legacy contracts and update the example integration.

## 3. Storybook

- [x] 3.1 Add the private Vite Storybook workspace, global providers/styles and deterministic fixtures.
- [x] 3.2 Add colocated stories and browser/a11y tests for every public visual component.

## 4. Verification

- [x] 4.1 Run API type fixtures, package unit/component tests and Storybook browser tests.
- [x] 4.2 Run lint, typecheck, build, pack dry-run, E2E, strict OpenSpec validation and diff check.
