---
"@compose-ui/core": major
"@compose-ui/editor": major
"@compose-ui/preview": major
"@compose-ui/stage": major
"@compose-ui/stage-engine": major
"@compose-ui/materials": major
---

Upgrade ComposeDocument to v3 with an implicit Canvas root, arbitrary root Components,
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
