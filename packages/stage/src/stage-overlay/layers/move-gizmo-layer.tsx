import type { StageOverlayContext } from '../overlay-types'

/** Godot 风格的 move 工具轴向手柄：原点十字 + X/Y 两根带箭头的轴。 */
export function MoveGizmoLayer({ editableSelection, screenBounds, textEditing, tool, onInteraction }: StageOverlayContext) {  return (
    <>
      {editableSelection && screenBounds && tool === 'move' && !textEditing ? (
        <g
          className="compose-stage__move-gizmo"
          data-testid="stage-move-gizmo"
          transform={`translate(${screenBounds.x} ${screenBounds.y})`}
        >
          <path className="compose-stage__move-gizmo-origin" d="M-4 0h8M0-4v8" />
          <path
            className="compose-stage__move-gizmo-axis compose-stage__move-gizmo-axis--x"
            d="M4 0H68m0 0-9-6m9 6-9 6"
            data-testid="stage-move-axis-x"
            onPointerDown={(event) => onInteraction({ kind: 'move-axis', axis: 'x' }, event)}
          />
          <path
            className="compose-stage__move-gizmo-axis compose-stage__move-gizmo-axis--y"
            d="M0 4v64m0 0-6-9m6 9 6-9"
            data-testid="stage-move-axis-y"
            onPointerDown={(event) => onInteraction({ kind: 'move-axis', axis: 'y' }, event)}
          />
        </g>
      ) : null}
    </>
  )
}
