# @compose-ui/stage-engine

## 1.0.0

### Major Changes

- 2f17288: Upgrade ComposeDocument to v3 with an implicit Canvas root, arbitrary root Components,
  nested rotatable Frames with selective clipping, fixed document output settings, and
  document or Frame Preview targets.

  Remove the Group node kind, `frame.create`, `activeFrameId`, and the Preview `frameId`
  prop. Group and ungroup user actions now create or dissolve transparent Frame containers,
  while Frame resize changes only the Frame boundary. The default output is transparent with
  a selectable Stage border; Editor exposes a dedicated Canvas Inspector with common desktop
  size presets, custom output fields, and reversible history integration. Output edges use one
  theme-aware neutral color (or the editor accent while selected), keeping the Godot X/Y axis colors
  semantically distinct, with an exact 16×16 dual-fill `EditorPosition` badge marking world `(0,0)`
  over the continuous axes. Low-zoom grids now retain every configured line
  down to 2 CSS pixels, then coalesce only to power-of-two subsets without changing snap geometry.

### Minor Changes

- 749deb2: Add stable asset references and resolvers, Image/SVG materials, and atomic Asset Browser to Stage drag-and-drop.
- 3f2fbf9: Extract Stage coordinates, scene indexing, snapping, gestures, external Palette drag, and spatial command planning into the new headless `@compose-ui/stage-engine` package.

  Replace `StageDragController` and `dragController` with the shared `StageInteractionController` API, and remove geometry and command re-exports from `@compose-ui/stage`.

- 53d166b: 升级为严格 ComposeDocument v6，以 Yoga LayoutSnapshot 统一驱动 Stage 与 Preview，并提供显式
  v5→v6 迁移器、LayoutItem/GeometryConstraints、Flex Auto Layout 和嵌套页面布局运行时。
- f0b8c05: Add Fill sizing and Figma-style Auto Layout editing semantics: Flow move and nudge bake to
  Absolute, Fill resize converts the changed axis to Fixed, Scene Tree reparenting owns Flow order,
  and Group/Ungroup expose a shared disabled reason for Flow targets.

### Patch Changes

- efd212d: Clean up the Auto Layout inspector after several rounds of iteration.

  Fixes a silent failure in the size fields: they accepted `0`, but core requires a finite positive
  `AxisSizing.value`, so the command was rejected during validation while the input kept showing the
  rejected value. `0` is now treated as invalid input and the draft rolls back, matching how blank and
  non-numeric input already behave.

  Refactors without behaviour change: the 845-line Auto Layout inspector is split into focused modules
  (options table, field editors, renderer registry, action menu, preview, factories) and no longer
  needs any `eslint-disable`; the Flex option table is pinned to the core types with `satisfies` so a
  wrong enum value fails to compile, and the "click the selected option again to reset" targets are
  derived from `createDefaultComposeFlexLayout()` instead of a second hand-written copy of the
  defaults; the layout action menu now implements the full WAI-ARIA menu keyboard pattern
  (arrow/Home/End with wrap-around, Escape returning focus to the trigger); the shared `useZh` helper
  is deduplicated; the layout-item inspector memoises its parent lookup instead of scanning every
  entity on each render.

  Removes dead code: the unreferenced `composeTransformUpdate` helper in stage-engine, an unnecessary
  `export` on an internal asset helper, and three CSS selector branches that could never match.

- Updated dependencies [749deb2]
- Updated dependencies [3f2fbf9]
- Updated dependencies [8349817]
- Updated dependencies [749deb2]
- Updated dependencies [53d166b]
- Updated dependencies [7769c06]
- Updated dependencies [d922b24]
- Updated dependencies [57a82d6]
- Updated dependencies [2f17288]
- Updated dependencies [6a3b60a]
- Updated dependencies [f0b8c05]
- Updated dependencies [6fe5cd6]
- Updated dependencies [dc66e03]
  - @compose-ui/core@1.0.0
