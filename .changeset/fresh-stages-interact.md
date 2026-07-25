---
"@compose-ui/core": major
"@compose-ui/editor": major
"@compose-ui/preview": major
"@compose-ui/stage": major
"@compose-ui/stage-engine": minor
---

Extract Stage coordinates, scene indexing, snapping, gestures, external Palette drag, and spatial command planning into the new headless `@compose-ui/stage-engine` package.

Replace `StageDragController` and `dragController` with the shared `StageInteractionController` API, and remove geometry and command re-exports from `@compose-ui/stage`.
