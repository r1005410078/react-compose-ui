// 这些尺寸共同定义虚拟化行、三段命中区和横向层级量化；修改时必须同步模型测试和黄金文件。
export const ROW_HEIGHT = 24
export const DROP_EDGE_SIZE = 4
export const INDENT_SIZE = 16
export const INDENT_BASE = 8
export const DRAG_THRESHOLD = 5
export const AUTO_SCROLL_EDGE = 32
export const AUTO_SCROLL_STEP = 8

export type DropPlacement = 'before' | 'inside' | 'after'

export interface DropGeometry {
  hoveredIndex: number
  placement: DropPlacement
  boundaryIndex: number
  requestedDepth: number
  relativeY: number
}

/** 使用欧氏距离判断指针是否已越过拖拽启动阈值。 */
export function crossedDragThreshold(
  startX: number,
  startY: number,
  clientX: number,
  clientY: number,
): boolean {
  return Math.hypot(clientX - startX, clientY - startY) >= DRAG_THRESHOLD
}

/** 把视口 Pointer 坐标换算为虚拟列表内容中的行、命中区和目标层级。 */
export function resolveDropGeometry(input: {
  clientX: number
  clientY: number
  rectTop: number
  rectHeight: number
  scrollTop: number
  rowDepths: readonly number[]
  startX: number
  startDepth: number
}): DropGeometry | null {
  if (input.rowDepths.length === 0) return null
  const contentY = Math.max(0, input.clientY - input.rectTop + input.scrollTop)
  const hoveredIndex = Math.max(
    0,
    Math.min(input.rowDepths.length - 1, Math.floor(contentY / ROW_HEIGHT)),
  )
  const rowOffset = contentY - hoveredIndex * ROW_HEIGHT
  const placement = rowOffset < DROP_EDGE_SIZE
    ? 'before'
    : rowOffset >= ROW_HEIGHT - DROP_EDGE_SIZE
      ? 'after'
      : 'inside'
  return {
    hoveredIndex,
    placement,
    boundaryIndex: placement === 'after' ? hoveredIndex + 1 : hoveredIndex,
    requestedDepth: placement === 'before'
      ? (input.rowDepths[hoveredIndex] ?? 1)
      : Math.max(
          1,
          input.startDepth + Math.trunc((input.clientX - input.startX) / INDENT_SIZE),
        ),
    relativeY: input.clientY - input.rectTop,
  }
}

/** 根据指针与滚动视口边缘的距离计算单帧纵向滚动速度。 */
export function resolveAutoScrollVelocity(
  relativeY: number,
  rectHeight: number,
  scrollTop: number,
  maxScrollTop: number,
): number {
  if (relativeY < AUTO_SCROLL_EDGE && scrollTop > 0) return -AUTO_SCROLL_STEP
  if (relativeY > rectHeight - AUTO_SCROLL_EDGE && scrollTop < maxScrollTop) {
    return AUTO_SCROLL_STEP
  }
  return 0
}

/** 将已知尺寸的 Portal 元素限制在视口 8px 安全边距内。 */
export function clampPortalPosition(
  x: number,
  y: number,
  width: number,
  height: number,
  viewportWidth: number,
  viewportHeight: number,
): { left: number; top: number } {
  const padding = 8
  const maxLeft = Math.max(padding, viewportWidth - width - padding)
  const maxTop = Math.max(padding, viewportHeight - height - padding)
  return {
    left: Math.max(padding, Math.min(x, maxLeft)),
    top: Math.max(padding, Math.min(y, maxTop)),
  }
}

/** 保持既有拖拽预览偏移和保守宽度估算，避免预览越出视口。 */
export function clampDragPreviewPosition(
  x: number,
  y: number,
  multiple: boolean,
  viewportWidth: number,
  viewportHeight: number,
) {
  return {
    left: Math.max(8, Math.min(x + 12, viewportWidth - (multiple ? 44 : 220))),
    top: Math.max(8, Math.min(y + 12, viewportHeight - 48)),
  }
}
