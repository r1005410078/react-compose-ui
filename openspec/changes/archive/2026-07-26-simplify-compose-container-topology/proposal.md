# Change: Simplify Compose container topology

## Why

ComposeDocument v2 forces every root to be a Frame and forbids nested Frames, while Group is a second
container kind with different resize and clipping rules. This couples document topology, grouping and
preview output, forces unnecessary wrappers, and prevents ordinary components from living directly on
the infinite canvas.

## What Changes

- **BREAKING** upgrade the only supported document schema to v3 and reject v2 without migration.
- Replace Frame/Group with one nestable, rotatable Frame kind and allow Frame or Component roots under an
  implicit Canvas.
- Add document output settings and reversible output configuration.
- Generalize create, move, duplicate, group, ungroup and reparent commands for root and nested nodes.
- Remove active Frame session state and derive insertion/fit targets from selection and spatial hits.
- Let Preview render either the document output or an explicit root/nested Frame.
- Make the implicit Canvas output transparent by default, selectable for inspection, and configurable
  through an output Inspector with common desktop-size presets.
- Give the output board orientation-aware X/Y edges and mark world `(0,0)` with a Godot-style
  foreground crosshair badge without changing its hit target or document data.
- Update Stage, Editor, Materials, examples, fixtures, docs and release metadata for the breaking API.

## Impact

- Affected specs: compose-document, command-transaction, stage-engine, stage,
  editor-workspace-layout, compose-preview, basic-materials, editor-preferences
- Affected packages: core, stage-engine, stage, editor, preview, materials and the integration app
