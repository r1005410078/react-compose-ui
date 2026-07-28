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

- [ ] 3.1 Run strict OpenSpec validation, affected package tests/typecheck/build and Storybook tests. Strict
  validation, affected-package tests/typecheck/build and Storybook build pass. `storybook:test` remains blocked by
  this sandbox's `listen EPERM ::1` restriction; it needs a browser-capable environment.
- [ ] 3.2 Run repository lint, typecheck, test, build, pack dry-run, E2E and `git diff --check`. Lint, full
  typecheck, build, pack dry-run and `git diff --check` pass. Full test reaches only the same Storybook listener
  restriction; E2E remains pending a browser-capable environment.

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
