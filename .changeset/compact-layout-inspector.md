---
"@compose-ui/component-registry": minor
"@compose-ui/components": minor
"@compose-ui/property-panel": minor
"@compose-ui/materials": minor
"@compose-ui/editor": patch
---

Make Auto Layout opt-in for free containers, add generic missing-component Inspector actions,
support atomic layout enable/remove commands, and replace the layout controls with compact
conditional sizing, unified gap, and an editable box-model preview. Merge Transform and LayoutItem
into a compact basic geometry Inspector, aggregate embedded search visibility, and add a reusable
angle input with a normalized dial and shortcut values. Expose position/alignment, rotation, and
size as distinct property types, and expose each axis as one editable combobox: numeric values imply
Fixed while focus reveals English Fill/Hug suggestions that can also be typed directly.
Move padding into a separate edge editor shared with margin, present it with the same vertical
label/CSS/editor structure as other Auto Layout fields, preserve the compact three-row Flex grid,
and reduce the read-only preview to three nodes with explicit main/cross-axis guidance.
Add a compact expandable empty-layout guide, let a repeated non-default Flex choice restore its
explicit CSS initial-equivalent value, and flatten the preview nodes with lower visual contrast.
