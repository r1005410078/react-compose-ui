import { CORNER_HANDLE_SIZE } from '../overlay-geometry'
import type { StageOverlayContext } from '../overlay-types'
import type { ResizeHandle } from '@compose-ui/stage-engine'

/**
 * 缩放手柄层：四角可见方块 + 四边透明命中区。
 *
 * @remarks
 * 编辑态与 Paint 编辑态下一律不显示——前者的拖拽语义是选择文本，后者的手柄归 Paint 层。
 */
export function ResizeHandlesLayer({ editableSelection, handlePoints, paintHandles, resizeHandles, screenBounds, textEditing, tool, visibleResizeHandles, lineSelection = null, onInteraction }: StageOverlayContext) {
  const lineSelectionActive = Boolean(lineSelection) && !tool.startsWith('draw-')

  const resizeVisible = (tool === 'select' || tool === 'scale') && !textEditing
  // 边缘命中区两端各让出 8px 是为了不压住角手柄，但让位不能把命中区挤没：单行文字这种
  // 只有十几像素高的选区，固定让 16px 后 E/W 命中区高度会算成 0，边根本抓不住。按可用
  // 长度收缩让位，至少保留 8px 可抓长度。
  const edgeInset = (length: number) => Math.max(0, Math.min(8, (length - 8) / 2))
  const insetX = screenBounds ? edgeInset(screenBounds.width) : 0
  const insetY = screenBounds ? edgeInset(screenBounds.height) : 0
  const edgeHitRegions = screenBounds && resizeVisible && !lineSelectionActive ? [
    { handle: 'n' as const, x: screenBounds.x + insetX, y: screenBounds.y - 4, width: Math.max(0, screenBounds.width - insetX * 2), height: 8 },
    { handle: 's' as const, x: screenBounds.x + insetX, y: screenBounds.y + screenBounds.height - 4, width: Math.max(0, screenBounds.width - insetX * 2), height: 8 },
    { handle: 'w' as const, x: screenBounds.x - 4, y: screenBounds.y + insetY, width: 8, height: Math.max(0, screenBounds.height - insetY * 2) },
    { handle: 'e' as const, x: screenBounds.x + screenBounds.width - 4, y: screenBounds.y + insetY, width: 8, height: Math.max(0, screenBounds.height - insetY * 2) },
  ].filter(({ handle }) => resizeHandles.includes(handle)) : []
  return (
    <>
      {editableSelection && handlePoints && paintHandles.length === 0 && !lineSelectionActive ? (
        <>
          {resizeVisible ? edgeHitRegions.map(({ handle, ...rect }) => (
            <rect
              {...rect}
              className={`compose-stage__resize-hit compose-stage__resize-hit--${handle}`}
              data-testid={`stage-resize-edge-${handle}`}
              key={`edge:${handle}`}
              onPointerDown={(event) => onInteraction({ kind: 'resize', handle }, event)}
            />
          )) : null}
          {resizeVisible ? (Object.entries(handlePoints) as [ResizeHandle, readonly [number, number]][])
            .filter(([handle]) => visibleResizeHandles.includes(handle))
            .map(([handle, [x, y]]) => (
              <rect
                className={`compose-stage__handle compose-stage__handle--${handle}`}
                data-testid={`stage-resize-${handle}`}
                height={CORNER_HANDLE_SIZE}
                key={handle}
                width={CORNER_HANDLE_SIZE}
                x={x - CORNER_HANDLE_SIZE / 2}
                y={y - CORNER_HANDLE_SIZE / 2}
                onPointerDown={(event) => onInteraction(
                  { kind: 'resize', handle },
                  event,
                )}
              />
            )) : null}
        </>
      ) : null}
    </>
  )
}
