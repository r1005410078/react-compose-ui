import { CORNER_HANDLE_SIZE, EDGE_HIT_OFFSET, EDGE_HIT_THICKNESS } from '../overlay-geometry'
import type { StageOverlayContext } from '../overlay-types'
import type { ResizeHandle } from '@compose-ui/stage-engine'

/**
 * 缩放手柄层：四角可见方块 + 四边透明命中区。
 *
 * @remarks
 * 编辑态与 Paint 编辑态下一律不显示——前者的拖拽语义是选择文本，后者的手柄归 Paint 层。
 * 几何编辑态同理：角手柄与角顶点几乎压在同一个像素上，两个含义叠在一起谁也点不准。
 *
 * **选区画的是几何轮廓时同样不显示**：手柄是盒的一部分，没有盒的手柄会浮在一圈看不见的角上。
 * 曲线的整体缩放因此让给**变换指示器**——它打开时盒与手柄都回来，能力没有消失，只是从
 * 「随时都在」变成「打开指示器」。判据没变：盒不是曲线的轮廓，但用户明确在做盒操作时，盒
 * 就是他正在操作的那个东西。
 *
 * 原先承担这件事的是 `scale` 工具，它已经并进指示器——一个只为「让手柄显出来」而存在的模式，
 * 与「打开一层 chrome」是同一件事的两种说法，而模式那种说法会让画布上每一次拖动的含义都变。
 */
export function ResizeHandlesLayer({ editableSelection, geometryEditing, gizmo, handlePoints, hollowSelection, paintHandles, resizeHandles, screenBounds, selectionOutline, textEditing, tool, visibleResizeHandles, onInteraction }: StageOverlayContext) {
  const resizeVisible = tool === 'select'
    && !textEditing
    && !geometryEditing
    // 指示器打开时曲线也拿回盒与手柄：`scale` 工具原本就是干这个的，它已并入指示器。
    && (!selectionOutline || Boolean(gizmo))
  // 边缘命中区两端各让出 8px 是为了不压住角手柄，但让位不能把命中区挤没：单行文字这种
  // 只有十几像素高的选区，固定让 16px 后 E/W 命中区高度会算成 0，边根本抓不住。按可用
  // 长度收缩让位，至少保留 8px 可抓长度。
  const edgeInset = (length: number) => Math.max(0, Math.min(8, (length - 8) / 2))
  const insetX = screenBounds ? edgeInset(screenBounds.width) : 0
  const insetY = screenBounds ? edgeInset(screenBounds.height) : 0
  // 命中带离边线多远：空心选区整条让到盒外并再让开一个拾取容差（见 EDGE_HIT_THICKNESS），
  // 其余仍旧骑在边线上。让位不能对所有选区一律执行——它吃掉的是盒**外**那一圈，而场景标题
  // 标签就坐在顶边外侧。
  const edgeGap = hollowSelection ? EDGE_HIT_OFFSET : -EDGE_HIT_THICKNESS / 2
  const edgeHitRegions = screenBounds && resizeVisible ? [
    { handle: 'n' as const, x: screenBounds.x + insetX, y: screenBounds.y - edgeGap - EDGE_HIT_THICKNESS, width: Math.max(0, screenBounds.width - insetX * 2), height: EDGE_HIT_THICKNESS },
    { handle: 's' as const, x: screenBounds.x + insetX, y: screenBounds.y + screenBounds.height + edgeGap, width: Math.max(0, screenBounds.width - insetX * 2), height: EDGE_HIT_THICKNESS },
    { handle: 'w' as const, x: screenBounds.x - edgeGap - EDGE_HIT_THICKNESS, y: screenBounds.y + insetY, width: EDGE_HIT_THICKNESS, height: Math.max(0, screenBounds.height - insetY * 2) },
    { handle: 'e' as const, x: screenBounds.x + screenBounds.width + edgeGap, y: screenBounds.y + insetY, width: EDGE_HIT_THICKNESS, height: Math.max(0, screenBounds.height - insetY * 2) },
  ].filter(({ handle }) => resizeHandles.includes(handle)) : []
  return (
    <>
      {editableSelection && handlePoints && paintHandles.length === 0 ? (
        <>
          {resizeVisible ? edgeHitRegions.map(({ handle, ...rect }) => (
            <rect
              {...rect}
              className={`compose-stage__resize-hit compose-stage__resize-hit--${handle}`}
              data-stage-selection-chrome=""
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
                data-stage-selection-chrome=""
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
