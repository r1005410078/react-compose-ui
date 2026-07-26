## Context

The current root-only Frame is simultaneously a topology root, clipping container and Preview target.
Group is a second container kind which can rotate and scale descendants. The Stage engine already models
root parents as `null` and composes nested matrices, so the restriction is primarily enforced by schema,
commands and React integration rather than by the geometry model.

## Goals / Non-Goals

- Goals: use an implicit Canvas root, unify containers as Frame, preserve deterministic Preview output,
  and keep all structural changes atomic and reversible.
- Goals: allow root components, nested rotated Frames, optional clipping and selection-derived insertion.
- Non-goals: add Page nodes, migrate v2 documents, add auto layout/content sizing, or change the DOM/SVG
  rendering backend.

## Decisions

- ComposeDocument v3 contains `output`, `canvas`, arbitrary `rootIds` and normalized Frame/Component nodes.
  The implicit Canvas is not a node and `parentId: null` always refers to it.
- Frame has required `clipContent`; Palette Frames default to true while grouping creates a transparent
  Frame with clipping disabled.
- Frame resize changes only its own bounds. Frame move/rotation affects descendants through normal parent
  transforms; no resize path recursively scales Frame descendants.
- Document output is fixed at world origin with configurable width, height and background. Its default
  background is transparent; Stage exposes the output rectangle as an inspection target with a
  non-scaling border, while document Preview clips to the configured output.
- Stage renders both horizontal output edges with the X-axis color and both vertical edges with the
  Y-axis color; at the fixed origin the top/left edges coincide with their corresponding world axes.
  The X/Y axes remain single continuous SVG lines. A fixed-screen-size foreground badge painted after
  those axes marks world `(0,0)` by reproducing Godot's 16×16 `EditorPosition.svg`: the outer silhouette
  is white at `0.706` opacity and the inner position path is `#ff5f5f`. The underlying axes and
  orientation-aware output edges use Godot's editor theme colors—X `(0.96, 0.20, 0.32, 0.75)` and Y
  `(0.53, 0.84, 0.01, 0.75)`—instead of approximate palette colors. The badge visually covers the
  continuous lines beneath instead of cutting a halo gap into them. These are SVG editing decorations,
  not Preview content or document state.
- Output inspection is session state distinct from node selection. It never creates a sentinel node ID or
  enters document history; only Inspector edits dispatch reversible `output.configure` transactions.
- The Editor-owned Canvas Inspector edits output width, height and background and offers deterministic
  desktop presets. Grid, snap and guide settings remain in the toolbar popover to keep publishing
  properties separate from editing aids.
- Preview defaults to document mode when document and registry are present, and accepts an explicit
  `{ kind: 'frame', frameId }` target for local output.
- Pointer insertion uses the visually topmost deepest eligible Frame. Keyboard insertion uses a selected
  Frame or a common nearest Frame ancestor, otherwise Canvas.
- `node.group` and `node.ungroup` remain action names, but create/remove Frame nodes. `frame.create`,
  ComposeGroupNode, activeFrameId and the Preview frameId prop are removed immediately.

## Risks / Trade-offs

- v2 documents become unreadable: all repository fixtures and examples move at once, with clear validator
  errors and a major release.
- A styled Frame can be ungrouped and lose its own appearance: the action is explicit and undo restores the
  full node and subtree placement.
- Rotated nested hit testing cannot use axis-aligned bounds: stage-engine tests local points through inverse
  world matrices and respects clipping ancestors and paint order.
- The transparent selectable output boundary changes Stage visuals: update only the approved
  deterministic golden states.

## Migration Plan

1. Establish v3 types, validation, defaults and commands in core.
2. Generalize stage-engine indexing, structural planners and external insertion.
3. Adapt Stage, Editor, Materials and Preview and remove obsolete public APIs.
4. Upgrade fixtures, examples, docs and changesets, then pass all quality gates.
