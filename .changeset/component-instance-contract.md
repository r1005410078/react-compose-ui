---
"@compose-ui/core": minor
"@compose-ui/component-library": minor
"@compose-ui/editor": minor
"@compose-ui/materials": minor
"@compose-ui/stage-engine": minor
---

Simplify the component instance contract now that instance internals are directly editable.

**Breaking:** exposed properties are removed. `ComposeComponentPropertyDefinition` no longer
appears in `ComposeBaseComponentAsset` or `ComposeResolvedComponentSnapshot`, and
`instanceOverrides` keeps only its `operations` partition. Legacy assets and overrides are read
through an explicit migration; property overrides whose field target can no longer be recovered
are dropped rather than kept as operations that would fail the whole instance at resolve time.

**Breaking:** component documents now require a single root of any kind instead of a single
first-class Group. Extracting a single selected node reuses it as the component root, so creating
a component from one container no longer inserts a redundant wrapper layer.

**Breaking:** instance geometry follows the component root. Instances inherit the root's resize
capability and expose its layout, appearance and clip; resize commands are rewritten to target the
root through instance overrides, because the nested runtime only honours sizes stored in the
component document.

Saving a component source now syncs dependent instances automatically. Instances whose overrides
all still apply refresh in place; instances with invalidated overrides keep their previous snapshot
and list the failing operations for explicit confirmation.
