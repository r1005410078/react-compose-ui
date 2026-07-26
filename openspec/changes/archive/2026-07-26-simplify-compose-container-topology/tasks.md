## 1. OpenSpec

- [x] 1.1 Proposal, design, tasks and eight capability deltas pass strict validation
  - Validation: `DO_NOT_TRACK=1 openspec validate simplify-compose-container-topology --strict`
    passed.

## 2. ComposeDocument v3 and transactions

- [x] 2.1 Red/Green: v3 output and arbitrary-root validation; reject v2 and Group
  - Red: `bun run --cwd packages/core test -- document.test.ts` failed because the current validator
    rejects schemaVersion 3 before evaluating arbitrary roots and nested Frames.
  - Red: `bunx vitest run src/document.test.ts` failed because Component `childIds` was silently
    accepted instead of enforcing the leaf-node invariant.
  - Green: `bun run test` in `packages/core` passed 48 tests.
  - Green: `bunx vitest run src/document.test.ts` passed 19 tests after rejecting Component children.
- [x] 2.2 Red/Green: generalized create, move and duplicate plus output.configure
  - Green: `packages/core/src/builtin-commands.test.ts` covers root/nested create, nullable move,
    root duplicate, output committed/noop/rejected and undo.
- [x] 2.3 Red/Green: Frame-backed group/ungroup at Canvas or nested parents
  - Green: core and stage-engine command tests cover transparent Frame creation, Canvas grouping,
    ungroup and world-geometry preservation.
- [x] 2.4 Refactor/Regression: Patch, batch, undo/redo and inverse remain atomic
  - Regression: `bun run test` in `packages/core` passed 48 tests.

## 3. Stage Engine

- [x] 3.1 Red/Green: arbitrary roots, nested rotated Frame matrices and container queries
- [x] 3.2 Red/Green: deepest clipped Frame hit testing and selection-derived insertion
- [x] 3.3 Red/Green: nullable reparent and Frame-only resize semantics
- [x] 3.4 Refactor/Regression: remove activeFrame protocol without gesture regressions
  - Green: `bun run test` in `packages/stage-engine` passed 34 tests, including rotated inverse
    hit testing, clipped ancestors, Canvas drop, shared-Frame keyboard insertion and Frame-only resize.

## 4. React integration and Preview

- [x] 4.1 Red/Green: Stage output board, root components, nested Frame clipping and rotation
  - Green: `bun run test` in `packages/stage` passed 52 tests.
- [x] 4.2 Red/Green: Editor controller, SceneTree and settings without activeFrame state
  - Green: `bun run test` in `packages/editor` passed 61 tests, including root Component reparent
    and atomic canvas/output settings undo.
- [x] 4.3 Red/Green: Frame-only Materials Inspector with clipContent
  - Green: `bun run test` in `packages/materials` passed 11 tests.
- [x] 4.4 Red/Green: document and explicit Frame Preview targets
  - Green: `bun run test` in `packages/preview` passed 10 tests.

## 5. Integration and release

- [x] 5.1 Upgrade app, fixtures, exact i18n, README and project context to v3
- [x] 5.2 Add major changeset and update approved visual goldens
  - Changeset: `.changeset/silent-canvases-frame.md`.
  - Golden coverage: fixed output board, root Component, nested Frame, document Preview and explicit
    Frame Preview were regenerated with `bun run test:e2e:update` and manually inspected.
- [x] 5.3 Run OpenSpec strict, lint, typecheck, test, build, pack dry-run, E2E and diff check
  - `DO_NOT_TRACK=1 openspec validate --all --strict`: 16 passed.
  - `bun run lint`, `bun run typecheck`, `bun run test`, `bun run build` and
    `bun run pack:dry-run`: passed.
  - `bun run test:e2e`: 10 Chromium scenarios passed in normal comparison mode.
  - `git diff --check`: passed.

## 6. Transparent Canvas inspection follow-up

- [x] 6.1 Revise compose-document, stage-engine, stage, editor-workspace-layout and compose-preview
  deltas and pass strict validation
  - Validation: `DO_NOT_TRACK=1 openspec validate simplify-compose-container-topology --strict`
    passed after adding transparent output, output inspection and desktop preset scenarios.
- [x] 6.2 Red/Green: default transparent output and reversible output configuration
  - Red: the exact default-output assertion reported `#f8fafc` instead of `transparent`.
  - Green: core document/command/runtime coverage and the full 48-test core suite pass.
- [x] 6.3 Red/Green: output hit/effect, marquee semantics and pan isolation in stage-engine
  - Red: output click and marquee scenarios had no `output.select` effect.
  - Green: output click clears node selection, output-origin marquee may select nodes, and pan remains
    isolated; all 37 stage-engine tests pass.
- [x] 6.4 Red/Green: selectable non-scaling Stage output boundary and optional Stage callbacks
  - Red: clicking the SVG output boundary neither selected output nor cleared the node selection.
  - Green: the transparent boundary renders a fixed 1px stroke, routes output hits and exposes optional
    controlled inspection callbacks; all 53 Stage tests pass.
- [x] 6.5 Red/Green: Canvas Inspector, common desktop presets, validation and history synchronization
  - Red: selecting output still rendered the empty Inspector and exposed no desktop presets.
  - Green: the native Editor Inspector covers all six presets, custom fields, rejected drafts and
    undo synchronization; all 62 Editor tests pass.
- [x] 6.6 Remove duplicate output fields from grid/snap popover and update exact i18n
  - Output controls now live only in the localized Canvas Inspector; full unit tests and typecheck pass.
- [x] 6.7 Update docs, changeset, E2E and approved transparent Canvas/Preview goldens
  - Root/package documentation and the major changeset describe transparent output inspection and
    desktop presets.
  - Chromium verifies transparent fill, fixed border, output selection, 1920×1080 preset and
    undo/redo; the new Canvas Inspector golden and affected v3 goldens were manually inspected.
- [x] 6.8 Re-run all strict validation and release quality gates
  - `DO_NOT_TRACK=1 openspec validate --all --strict`: 16 passed.
  - `bun run lint`, `bun run typecheck`, `bun run test`, `bun run build` and
    `bun run pack:dry-run`: passed.
  - `bun run test:e2e`: 10 Chromium scenarios passed in normal comparison mode.
  - `git diff --check`: passed.

## 7. Godot-style world-origin decoration follow-up

- [x] 7.1 Revise Stage requirements/design and pass strict validation
  - Clarification supersedes the earlier output-center interpretation; the marker now anchors world
    `(0,0)`.
  - `DO_NOT_TRACK=1 openspec validate simplify-compose-container-topology --strict`: passed.
- [x] 7.2 Red/Green: fixed-size high-contrast world-origin crosshair and axis-colored edges
  - Red: translated/zoomed Stage tests could not find a world-origin marker and still found the
    output-center implementation.
  - Green: the marker follows viewport-transformed `(0,0)`, remains 16px with a 3px halo, and all
    45 Stage component tests plus Stage typecheck pass.
- [x] 7.3 Update Stage documentation and approved goldens
  - README、Stage README 与 changeset 均明确标记世界 `(0,0)`，不再描述输出几何中心。
  - `bun run test:e2e:update`: 10 Chromium scenarios passed；人工检查
    `stage-workspace-canvas-inspector.png`，十字星位于红色 X 轴与绿色 Y 轴交点，输出中心无标记。
- [x] 7.4 Re-run strict validation and release quality gates
  - `DO_NOT_TRACK=1 openspec validate --all --strict`: 16 items passed.
  - `bun run lint`, `bun run typecheck`, `bun run test`, `bun run build` and
    `bun run pack:dry-run`: passed.
  - `bun run test:e2e`: 10 Chromium scenarios passed in normal comparison mode.
  - `git diff --check`: passed.

## 8. Foreground world-origin badge refinement

- [x] 8.1 Clarify continuous axes and foreground paint order, then pass strict validation
  - `DO_NOT_TRACK=1 openspec validate simplify-compose-container-topology --strict`: passed.
- [x] 8.2 Red/Green: replace the embedded axis-colored marker with an outlined cross and red center dot
  - Red: 2 Stage tests failed because the old marker exposed halo and axis-colored arm elements.
  - Green: the axes remain full-length lines, the fixed-size foreground badge is painted afterward,
    and all 54 Stage tests plus Stage typecheck pass.
- [x] 8.3 Update Stage documentation and approved goldens
  - README、Stage README 与 changeset 均说明标记覆盖在连续轴线之上。
  - `bun run test:e2e:update`: 10 Chromium scenarios passed；人工检查
    `stage-workspace-canvas-inspector.png`，白色描边十字和红色中心点呈现为轴线上方的独立前景层。
- [x] 8.4 Re-run strict validation and release quality gates
  - `DO_NOT_TRACK=1 openspec validate --all --strict`: 16 items passed.
  - `bun run lint`, `bun run typecheck`, `bun run test`, `bun run build` and
    `bun run pack:dry-run`: passed.
  - `bun run test:e2e`: 10 Chromium scenarios passed in normal comparison mode.
  - `git diff --check`: passed.

## 9. Exact Godot EditorPosition visual restoration

- [x] 9.1 Record the upstream icon paths and theme colors, then pass strict validation
  - Source: Godot `editor/icons/EditorPosition.svg` and `editor/themes/theme_modern.cpp`.
  - `DO_NOT_TRACK=1 openspec validate simplify-compose-container-topology --strict`: passed.
- [x] 9.2 Red/Green: replace the stroked approximation with the exact 16×16 dual-fill badge
  - Red: 2 Stage tests failed because the marker still had no translated 16×16 path group.
  - Green: both upstream paths and fills are reproduced verbatim, the badge stays fixed-size at the
    viewport-transformed origin, and all 54 Stage tests plus Stage typecheck pass.
- [x] 9.3 Update exact browser assertions and approved goldens
  - Browser assertions pin the two fills, opacity, official axis colors, transform anchor and paint order.
  - `bun run test:e2e:update`: 10 Chromium scenarios passed；人工检查
    `stage-workspace-canvas-inspector.png`，16×16 badge 与连续 Godot 轴色正确叠加。
- [x] 9.4 Re-run strict validation and release quality gates
  - `DO_NOT_TRACK=1 openspec validate --all --strict`: 16 items passed.
  - `bun run lint`, `bun run typecheck`, `bun run test`, `bun run build` and
    `bun run pack:dry-run`: passed.
  - `bun run test:e2e`: 10 Chromium scenarios passed in normal comparison mode.
  - `git diff --check`: passed.
