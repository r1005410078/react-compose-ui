---
"@compose-ui/materials": patch
"@compose-ui/stage-engine": patch
---

Clean up the Auto Layout inspector after several rounds of iteration.

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
