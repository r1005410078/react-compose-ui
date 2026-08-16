## 1. Contract and configuration

- [x] 1.1 Red: add an API fixture and component test for the Compose-prefixed Button contract, variants, disabled
  semantics and standard root attributes. Red command/result/reason: `bun run --cwd packages/components test --
  compose-button.test.tsx` failed with `Element type is invalid ... got: undefined`, because `ComposeButton` is not
  yet exported by the package.
- [x] 1.2 Green: configure package-local Shadcn CLI aliases, Tailwind v4 prefixed utility output, source-owned
  `cn()` utility and the first generated/adapted `ComposeButton` feature. Green command/result: `bun run --cwd
  packages/components test -- compose-button.test.tsx && bun run --cwd packages/components typecheck && bun run
  --cwd packages/components build` passed (5 tests, typecheck and build).
- [x] 1.3 Refactor: map all initial Shadcn semantic colors to Compose theme tokens without global Preflight or raw
  Shadcn public exports; passing evidence: the stylesheet contract and public-export assertions in
  `compose-button.test.tsx` pass, together with the affected package typecheck and build.

## 2. Theme, documentation and guardrails

- [x] 2.1 Red: add Dark/Light/token-override Storybook and Testing Library coverage for `ComposeButton`. Red
  command/result/reason: `bun run --cwd packages/components test -- compose-button.test.tsx` failed with the same
  missing `ComposeButton` export; the new override assertion cannot render until the public component exists.
- [x] 2.2 Green: add the story, public TSDoc, package README guidance and an `AGENTS.md` rule requiring Shadcn as
  the default source basis for future shared primitives. Green evidence: `bun run storybook:build` includes the
  `ComposeButton` stories successfully.
- [x] 2.3 Refactor: extend the architecture check only as needed to keep generated sources private and public
  visual components feature-local; regression evidence: root `bun run check:architecture` passes with the
  `button/compose-button.tsx` feature requirement.

## 3. Verification

- [x] 3.1 Run strict OpenSpec validation, affected package tests/typecheck/build and Storybook tests. Strict
  validation, affected-package tests/typecheck/build and Storybook build pass. The prior ComposeButton contrast
  failures are fixed; Button, Dialog and Input Storybook tests pass in Chromium. The full Storybook runner starts
  successfully but did not exit after unrelated remaining Stories in this environment, so its global gate remains
  pending.
  - Gate closed later: the full Storybook runner now exits cleanly — `bun run --filter @compose-ui/storybook build`
    and `test` pass (20 files / 50 tests in Chromium). `bunx openspec validate adopt-shadcn-component-foundation
    --strict` passes.
- [x] 3.2 Run repository lint, typecheck, test, build, pack dry-run, E2E and `git diff --check`. Lint, full
  typecheck, build, pack dry-run and `git diff --check` pass. The non-Storybook package suite passes; the full
  Storybook process remains pending its non-exit investigation. Targeted real-Chromium E2E flows pass, while the
  full E2E suite remains pending.
  - Gate closed later: the two pending items now pass. Full Storybook test (50) exits cleanly and the full E2E
    suite passes (68 tests). `bun run lint` needed one scoped `react-hooks/refs` suppression on the Editor host
    context-menu memo — a false positive of the same shape already suppressed for `pageContextMenuItems`, since
    the ref is only read inside `onSelect`. Repository `lint` / `typecheck` / `test` / `build` / `pack:dry-run` /
    `git diff --check` all pass.

## 4. Shared ContextMenu and integration

- [x] 4.1 Red: add ContextMenu public-contract and hook tests for controlled opening, payload replacement, virtual
  point positioning, disabled/destructive items, keyboard dismissal and focus restoration. Red command/result/reason:
  `bun run --cwd packages/components test -- compose-context-menu.test.tsx` failed with invalid undefined React
  component types and `useContextMenu is not a function`, because neither the public ContextMenu exports nor the
  Hook exist yet.
- [x] 4.2 Green: add the source-owned `ComposeContextMenu` feature, standard Shadcn composition parts and
  `useComposeContextMenu<T>`; keep raw Base UI names private and map portal content to Compose Theme/I18n. Evidence:
  component ContextMenu tests, `@compose-ui/components` typecheck and build pass.
- [x] 4.3 Refactor: add ContextMenu Storybook states and feature-local architecture checks; record passing
  component test, typecheck, build and Storybook build evidence. Evidence: `bun run check:architecture`, package
  component tests and `bun run storybook:build` pass.
- [x] 4.4 Red: extend Scene Tree, Asset Browser and Property Panel tests for their current right-click contracts;
  Red command/result/reason: the three affected-package component test commands each failed only because their
  existing hand-written `role="menu"` surface lacks `data-compose-ui="context-menu"`; domain selection and action
  assertions otherwise passed, proving the shared-Hook integration is the missing behavior.
- [x] 4.5 Green: replace the three hand-written right-click menus, preserve selection/capability/Ctrl-click
  semantics, and remove obsolete menu state, placement and CSS. Evidence: Scene Tree (66), Asset Browser (21) and
  Property Panel (54) package tests pass.
- [x] 4.6 Refactor: add integration visual coverage, update package documentation and changesets, then record
  affected-package regression evidence. Evidence: ComposeContextMenu Storybook states build, consumer README files
  and release notes are updated; browser visual regression remains covered by the global browser gate in 3.1/3.2.

## 5. Shared Dialog and Dockview modal migration

- [x] 5.1 Red: add ComposeDialog contract tests for controlled/uncontrolled opening, full-viewport Portal mounting,
  backdrop/Escape dismissal, focus restoration, Dark/Light token inheritance and keyboard navigation. Extend Editor
  and Asset Browser tests to assert their modals use the shared primitive and are not clipped by Dockview. Red
  command/result/reason: `bun run --cwd packages/components test -- compose-dialog.test.tsx` failed because the
  feature module and its public exports did not yet exist.
- [x] 5.2 Green: add source-owned ComposeDialog parts and Storybook states; retain ComposeConfirmDialog's alert
  semantics while applying the same full-viewport Portal/token conventions. Evidence: ComposeDialog and
  ComposeConfirmDialog tests, `@compose-ui/components` typecheck/build, Storybook build, and all three Dialog
  Stories in Chromium pass.
- [x] 5.3 Green: migrate SettingsDialog and all Asset Browser modal workflows (name, delete, dirty, conflict) to
  shared components. Preserve shortcut-capture Escape behavior, asset operation callbacks, focus targets and
  non-modal popovers. Evidence: Editor (38) and Asset Browser (21) tests pass; the real-Chromium settings flow
  verifies viewport-wide modal coverage, inert Dockview content and dark/light plus locale transitions.
- [x] 5.4 Refactor: remove duplicate dialog layers, focus loops and styles; update public README, architecture
  checks, change notes and exact component/integration tests. Evidence: the components feature check requires the
  co-located Dialog source, test and Story; obsolete Asset Browser layers and Editor's manual focus loop are gone.
- [x] 5.5 Run strict OpenSpec validation, affected package tests/typecheck/build, Storybook build/test, repository
  lint/typecheck/test/build/pack dry-run/E2E and `git diff --check`. Strict validation, affected tests, lint,
  full typecheck, full build, pack dry-run, targeted Chromium E2E and diff check pass. Changed Storybook Stories
  pass in Chromium; the full Storybook process remains pending its non-exit investigation, and the full E2E suite
  remains pending.
  - Gate closed later together with 3.1/3.2: full Storybook build + test (50) and the full E2E suite (68) now pass;
    see 3.2 for the complete rerun evidence.
- [x] 5.6 Refactor Dialog form visuals: add the shared Shadcn-adapted ComposeInput, standardize Dialog and
  ConfirmDialog surfaces/actions, replace Asset Browser modal native controls, remove domain overrides, and verify
  Dark/Light contrast plus Chromium screenshots. Evidence: component (11) and Asset Browser (21) tests, component/
  Asset Browser/Editor builds, architecture check, and Button/Dialog/Input Storybook Chromium tests (11) pass;
  the Asset Browser save-and-dirty Dialog E2E passes.

## 6. Asset documents in the Canvas group

- [x] 6.1 Red: add Asset Browser tests proving file selection remains a directory-grid operation, while double
  click and Enter emit exactly one asset-open intent without reading file content or loading Monaco. Add preview-ref
  tests for saving and cleanup, plus Editor tests for panel reuse and dirty-operation guards. Red command/result:
  `bun run --cwd packages/asset-browser test -- compose-asset-browser.test.tsx` failed because file selection mounted
  the inline `AssetPreview` and invoked `read`; `onAssetOpen` did not exist.
- [x] 6.2 Green: add `onAssetOpen`, `onBeforeAssetMutation` and exported `ComposeAssetPreview`; move preview and
  script lifecycle out of the Asset Browser's selection path while preserving safe image/SVG/binary rendering and
  Provider operation behavior. Evidence: Asset Browser focused tests pass (16 tests), including image Blob URL cleanup,
  binary metadata and the preview ref's non-script save result.
- [x] 6.3 Green: add the Editor-scoped asset-document manager, Canvas-group Dockview panels with `renderer: 'always'`,
  custom close affordance, dirty save/discard/cancel flow and sequential rename/move/delete protection for the
  default Asset Browser only. Evidence: Editor focused tests pass (39 tests); Chromium verifies repeated SVG open
  reuse, Monaco dirty close cancellation and explicit save before close.
- [x] 6.4 Refactor: update localized chrome, README, stories, type fixtures and Chromium flows for directory-grid
  browsing and central resource documents; retain no-preview-on-single-click and no-document-history invariants.
  Evidence: `ComposeAssetPreview` Storybook states, asset/browser and editor README guidance, and the focused Chromium
  flow all pass; stable Preview callbacks prevent Monaco from being disposed on its first dirty update.
- [x] 6.5 Verification: run strict validation, affected package/unit tests, Storybook build/test, lint, typecheck,
  test, build, pack dry-run, Chromium E2E and `git diff --check`. Strict validation, focused Asset Browser/Editor
  tests, full lint/typecheck/test/build, Storybook build/test, pack dry-run and diff check pass. The focused
  resource-document Chromium flow passes; the full E2E suite remains pending three unrelated Stage regressions:
  SVG Inspector snapshot drift, high-speed gesture atomicity and grouped Frame direct manipulation.
  - Gate closed later: the three unrelated Stage regressions were fixed by their own changes (the SVG Inspector
    golden was re-recorded in 0fff497). The full E2E suite now passes (68 tests) alongside the rest of the gate;
    see 3.2 for the complete rerun evidence.
