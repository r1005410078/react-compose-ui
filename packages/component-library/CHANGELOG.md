# @compose-ui/component-library

## 0.2.0

### Minor Changes

- f0ba0a5: Simplify the component instance contract now that instance internals are directly editable.

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

- 8e8afbb: Make component instance internals editable in the host scene. Scene Tree lazily projects the
  resolved inner entity tree, Stage drills down one level per double click, and both stay in sync
  through composite `instanceId/innerId` addresses that exist only in the editing representation.

  Instance overrides move from a flat `propertyOverrides` map to a partitioned `instanceOverrides`
  holding `properties` and `operations`. Structural operations reuse the Variant operation algebra,
  so applying them to a parent source needs no lossy conversion. Legacy `propertyOverrides` is read
  only through an explicit migration.

  **Breaking:** `applyComposeInstancePropertyOverrides` is replaced by `applyComposeInstanceOverrides`,
  which consumes both partitions and returns `remainingOverrides`. The instance overrides panel
  `onChange` now receives the complete overrides object instead of a property map.

- bc2e0a4: Add first-class Group entities, Provider-backed Component Asset v1 resources, linked component
  instances, Unity-style variants, independent component workspaces, explicit Apply/Revert/update
  flows, and Scene Tree to Asset Browser component creation.

### Patch Changes

- Updated dependencies [749deb2]
- Updated dependencies [5fd9605]
- Updated dependencies [6a3b60a]
- Updated dependencies [a40bc1f]
- Updated dependencies [f0ba0a5]
- Updated dependencies [3f2fbf9]
- Updated dependencies [8349817]
- Updated dependencies [749deb2]
- Updated dependencies [8e8afbb]
- Updated dependencies [53d166b]
- Updated dependencies [bc2e0a4]
- Updated dependencies [7769c06]
- Updated dependencies [43d5e62]
- Updated dependencies [d922b24]
- Updated dependencies [57a82d6]
- Updated dependencies [814cec7]
- Updated dependencies [2f17288]
- Updated dependencies [6a3b60a]
- Updated dependencies [f0b8c05]
- Updated dependencies [6fe5cd6]
- Updated dependencies [dc66e03]
  - @compose-ui/assets@0.2.0
  - @compose-ui/component-registry@1.0.0
  - @compose-ui/core@1.0.0
  - @compose-ui/ui-context@1.0.0
  - @compose-ui/components@1.0.0
