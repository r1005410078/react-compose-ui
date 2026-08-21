import { worldToScreen } from '@compose-ui/stage-engine'
import {
  LINE_ENDPOINT_HANDLE_SIZE,
  LINE_ENDPOINT_HIT_RADIUS,
  lineAngle,
  lineDimensionLabel,
  lineEndpointCursor,
  lineLabelPosition,
} from '../overlay-geometry'
import type { StageOverlayContext } from '../overlay-types'

/**
 * 选中边框层。
 *
 * @remarks
 * 三种互斥呈现按优先级降级：两点图形画精确端点与尺寸标注；已下钻的实例内部实体画只读边框；
 * 其余情况画通用矩形。绘制工具激活时一律不画——那时用户看的是笔尖，不是选区。
 */
export function SelectionLayer({
  editableSelection,
  instanceSelectionBounds,
  lineSelection = null,
  screenBounds,
  textEditing,
  tool,
  viewport,
  onInteraction,
}: StageOverlayContext) {
  const lineSelectionActive = Boolean(lineSelection) && !tool.startsWith('draw-')
  const lineStartScreen = lineSelection ? worldToScreen(lineSelection.start, viewport) : null
  const lineEndScreen = lineSelection ? worldToScreen(lineSelection.end, viewport) : null
  const lineSelectionAngle = lineStartScreen && lineEndScreen
    ? lineAngle(lineStartScreen, lineEndScreen)
    : 0
  const lineSelectionCursor = lineStartScreen && lineEndScreen
    ? lineEndpointCursor(lineStartScreen, lineEndScreen)
    : 'default'
  const lineDimension = lineSelection && lineStartScreen && lineEndScreen
    ? lineDimensionLabel(lineSelection.start, lineSelection.end)
    : null
  const lineDimensionWidth = lineDimension ? Math.max(56, lineDimension.length * 7 + 16) : 0
  const lineDimensionPosition = lineStartScreen && lineEndScreen
    ? lineLabelPosition(lineStartScreen, lineEndScreen)
    : null
  const drawingToolActive = tool.startsWith('draw-')
  // 编辑态下手柄一律不显示；这与 TransformConstraints 的抑制叠加，不互相覆盖。
  const resizeVisible = (tool === 'select' || tool === 'scale') && !textEditing
  return (
    <>
      {lineSelectionActive && lineSelection && lineStartScreen && lineEndScreen ? (
        <g className="compose-stage__line-selection" data-testid="stage-line-selection">
          <line
            className="compose-stage__line-selection-axis"
            x1={lineStartScreen.x}
            x2={lineEndScreen.x}
            y1={lineStartScreen.y}
            y2={lineEndScreen.y}
          />
          {resizeVisible && editableSelection ? (
            <>
              <circle
                className="compose-stage__line-selection-hit"
                data-testid="stage-line-selection-start"
                cx={lineStartScreen.x}
                cy={lineStartScreen.y}
                r={LINE_ENDPOINT_HIT_RADIUS}
                style={{ cursor: lineSelectionCursor }}
                onPointerDown={(event) => onInteraction({
                  kind: 'segment-endpoint',
                  entityId: lineSelection.entityId,
                  endpoint: 'start',
                  start: lineSelection.start,
                  end: lineSelection.end,
                }, event)}
              />
              <rect
                className="compose-stage__line-selection-handle"
                data-testid="stage-line-selection-start-handle"
                height={LINE_ENDPOINT_HANDLE_SIZE}
                transform={`rotate(${lineSelectionAngle} ${lineStartScreen.x} ${lineStartScreen.y})`}
                width={LINE_ENDPOINT_HANDLE_SIZE}
                x={lineStartScreen.x - LINE_ENDPOINT_HANDLE_SIZE / 2}
                y={lineStartScreen.y - LINE_ENDPOINT_HANDLE_SIZE / 2}
              />
              <circle
                className="compose-stage__line-selection-hit"
                data-testid="stage-line-selection-end"
                cx={lineEndScreen.x}
                cy={lineEndScreen.y}
                r={LINE_ENDPOINT_HIT_RADIUS}
                style={{ cursor: lineSelectionCursor }}
                onPointerDown={(event) => onInteraction({
                  kind: 'segment-endpoint',
                  entityId: lineSelection.entityId,
                  endpoint: 'end',
                  start: lineSelection.start,
                  end: lineSelection.end,
                }, event)}
              />
              <rect
                className="compose-stage__line-selection-handle"
                data-testid="stage-line-selection-end-handle"
                height={LINE_ENDPOINT_HANDLE_SIZE}
                transform={`rotate(${lineSelectionAngle} ${lineEndScreen.x} ${lineEndScreen.y})`}
                width={LINE_ENDPOINT_HANDLE_SIZE}
                x={lineEndScreen.x - LINE_ENDPOINT_HANDLE_SIZE / 2}
                y={lineEndScreen.y - LINE_ENDPOINT_HANDLE_SIZE / 2}
              />
            </>
          ) : null}
          {lineDimension && lineDimensionPosition ? (
            <g
              className="compose-stage__line-selection-dimensions"
              data-testid="stage-line-selection-dimensions"
              transform={`translate(${lineDimensionPosition.x} ${lineDimensionPosition.y}) rotate(${lineDimensionPosition.angle})`}
            >
              <rect height="22" rx="4" width={lineDimensionWidth} x={-lineDimensionWidth / 2} y="-11" />
              <text dominantBaseline="middle" textAnchor="middle" x="0" y="0">{lineDimension}</text>
            </g>
          ) : null}
        </g>
      ) : instanceSelectionBounds ? (
        <rect
          className="compose-stage__selection compose-stage__selection--instance-inner"
          data-testid="stage-instance-selection-bounds"
          height={instanceSelectionBounds.height}
          width={instanceSelectionBounds.width}
          x={instanceSelectionBounds.x}
          y={instanceSelectionBounds.y}
        />
      ) : screenBounds && !drawingToolActive ? (
        <rect
          className={`compose-stage__selection${textEditing ? ' is-text-editing' : ''}`}
          data-testid={textEditing ? 'stage-text-editing-bounds' : 'stage-selection-bounds'}
          height={screenBounds.height}
          width={screenBounds.width}
          x={screenBounds.x}
          y={screenBounds.y}
        />
      ) : null}
    </>
  )
}
