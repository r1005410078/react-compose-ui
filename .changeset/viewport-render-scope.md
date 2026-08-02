---
"@compose-ui/editor": minor
---

Keep the editor chrome out of the pan path. The Stage viewport is now a subscribable session state
source instead of controller render state, so a pan frame only wakes the canvas and the toolbar
rather than re-rendering the scene tree, Inspector and command panel. Adds
`useComposeStageViewport(controller)` for hosts that render their own `ComposeStage` or show a zoom
readout.

Behaviour change: `controller.viewport` and `stageProps.viewport` still read the current snapshot,
but components that only read them no longer re-render automatically when the viewport changes.
Subscribe with `useComposeStageViewport` if you need to follow it. `setViewport` is unchanged and
still accepts both a value and an updater.

Measured on a 1500-Entity document with the full editor mounted: frame interval p50 16.1 ms →
8.3 ms, p95 24.3 ms → 10.2 ms, frames over 20 ms 8–26 → 0.
