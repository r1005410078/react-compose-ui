---
"@compose-ui/core": minor
"@compose-ui/component-library": minor
"@compose-ui/editor": minor
"@compose-ui/materials": minor
"@compose-ui/scene-tree": minor
"@compose-ui/stage": minor
---

Make component instance internals editable in the host scene. Scene Tree lazily projects the
resolved inner entity tree, Stage drills down one level per double click, and both stay in sync
through composite `instanceId/innerId` addresses that exist only in the editing representation.

Instance overrides move from a flat `propertyOverrides` map to a partitioned `instanceOverrides`
holding `properties` and `operations`. Structural operations reuse the Variant operation algebra,
so applying them to a parent source needs no lossy conversion. Legacy `propertyOverrides` is read
only through an explicit migration.

**Breaking:** `applyComposeInstancePropertyOverrides` is replaced by `applyComposeInstanceOverrides`,
which consumes both partitions and returns `remainingOverrides`. The instance overrides panel
`onChange` now receives the complete overrides object instead of a property map.
