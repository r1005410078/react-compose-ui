---
"@compose-ui/stage": patch
---

Keep canvas panning smooth on large scenes. The DOM Scene content is now decoupled from the
viewport so a pan frame only updates the scene root transform instead of rebuilding and diffing
every Entity subtree, and the bootstrap content bounds are computed lazily instead of walking the
whole scene on every render for a result that is discarded once the engine publishes a scroll range.
Measured on a 1500-Entity document: frame interval p50 16.1 ms → 8.3 ms, p95 24 ms → 9.3 ms.
