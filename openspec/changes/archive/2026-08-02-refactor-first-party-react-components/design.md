## Context

React UI packages currently expose a mixture of unprefixed and `Compose*` names, preserve several legacy
facades, and keep many feature implementations at `src/` root. This change is intentionally major and does
not retain aliases. Existing visual output, ARIA meaning and stable `data-testid` values remain contracts.

## Goals / Non-goals

- Goals: compose-prefixed API, feature-local implementation/tests/stories/styles, Storybook browser+a11y
  coverage, machine-checked architecture boundaries, preserved visual behaviour.
- Non-goals: ComposeDocument/schema changes, new state library, Canvas/WebGL renderer, automatic codemod,
  or preserving private DOM/class-name contracts.

## Decisions

- Public React package APIs use `Compose*`; hooks use `useCompose*`; factories use `createCompose*`; exported
  constants use `COMPOSE_*` or `DEFAULT_COMPOSE_*`.
- The root package entry is the only public JS API and `./styles.css` is the only public CSS API. Feature
  barrels are internal package boundaries, not package export-map subpaths.
- `ComposeEditor` replaces flat panel props and `children` with `slots`, `sceneTree`, `history`, and `assets`
  configuration. A supplied slot wins over the corresponding default panel.
- `ComposePreview` requires `document` and `registry`; it has no legacy children mode. Locale flows only through
  ui-context. Asset protocol types are only exported by `@compose-ui/assets`.
- Storybook is a private `apps/storybook` Vite workspace. It runs stories through Storybook's Vitest addon in
  Playwright Chromium and treats Axe failures as errors.

## Risks / Mitigations

- Large rename surface → update example, package README files and type fixtures in the same change; do not
  publish a facade.
- Directory-only moves can hide regressions → move tests with features before each API rename and preserve
  existing integration screenshot assertions.
- Browser-only controls (Dockview, Monaco, pointer capture) → retain their Playwright flows and use deterministic
  Storybook fixtures rather than real providers.

## Migration

Consumers migrate imports to the new compose-prefixed names, import asset protocol from `@compose-ui/assets`,
wrap UI in ComposeUIProvider, replace Editor's flat props with `slots`/configuration, and pass document+registry
to ComposePreview. A root migration guide provides before/after examples; no compatibility runtime is shipped.
