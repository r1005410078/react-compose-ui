import { worldToScreen } from '@compose-ui/stage-engine'
import type { StageOverlayContext } from '../overlay-types'

/**
 * 落点指示层。
 *
 * @remarks
 * `reparent` 高亮目标容器，`reorder` 在插入位画一根落点线，`grid-cell` 画松手之后那张卡会
 * 占住的格矩形。被拖动目标自身的选中框与手柄呈现不受影响——两者是不同对象，不存在反馈叠加。
 *
 * 网格影子画的是**求解之后**的位置（重力已经把它拉到该去的行），因为它承诺的正是松手后的
 * 结果；跟手的那张卡由场景渲染按光标覆盖画，两者分工不重叠。
 */
export function DropIndicatorLayer({ dropIndicator, viewport }: StageOverlayContext) {
  const dropScreen = dropIndicator?.kind === 'reparent'
    ? {
        ...worldToScreen(dropIndicator.bounds, viewport),
        width: dropIndicator.bounds.width * viewport.zoom,
        height: dropIndicator.bounds.height * viewport.zoom,
      }
    : null
  const gridCell = dropIndicator?.kind === 'grid-cell'
    ? {
        ...worldToScreen(dropIndicator.bounds, viewport),
        width: dropIndicator.bounds.width * viewport.zoom,
        height: dropIndicator.bounds.height * viewport.zoom,
      }
    : null
  const dropLine = dropIndicator?.kind === 'reorder'
    ? {
        start: worldToScreen(dropIndicator.start, viewport),
        end: worldToScreen(dropIndicator.end, viewport),
      }
    : null
  return (
    <>
      {dropScreen ? (
        <rect
          className="compose-stage__drop-container"
          data-testid="stage-drop-container"
          height={dropScreen.height}
          width={dropScreen.width}
          x={dropScreen.x}
          y={dropScreen.y}
        />
      ) : null}
      {gridCell ? (
        <rect
          className="compose-stage__drop-grid-cell"
          data-testid="stage-drop-grid-cell"
          height={gridCell.height}
          width={gridCell.width}
          x={gridCell.x}
          y={gridCell.y}
        />
      ) : null}
      {dropLine ? (
        <line
          className="compose-stage__drop-line"
          data-testid="stage-drop-line"
          x1={dropLine.start.x}
          x2={dropLine.end.x}
          y1={dropLine.start.y}
          y2={dropLine.end.y}
        />
      ) : null}
    </>
  )
}
