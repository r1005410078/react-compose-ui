import { worldToScreen } from '@compose-ui/stage-engine'
import type { StageOverlayContext } from '../overlay-types'

/**
 * 落点指示层。
 *
 * @remarks
 * `reparent` 高亮目标容器，`reorder` 在插入位画一根落点线。被拖动目标自身的选中框与手柄
 * 呈现不受影响——两者是不同对象，不存在反馈叠加。
 */
export function DropIndicatorLayer({ dropIndicator, viewport }: StageOverlayContext) {
  const dropScreen = dropIndicator?.kind === 'reparent'
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
