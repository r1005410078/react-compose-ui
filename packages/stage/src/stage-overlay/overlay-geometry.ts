import type { StagePoint } from '@compose-ui/stage-engine'

/** 端点方块边长（屏幕 px）。 */
export const LINE_ENDPOINT_HANDLE_SIZE = 8
// 可见方块保持轻量，命中区独立放大，避免高分屏上必须像素级对准才能开始端点手势。
export const LINE_ENDPOINT_HIT_RADIUS = 10
/** 四角缩放手柄边长（屏幕 px）；边方向只靠透明 hit，不渲染中点方块。 */
export const CORNER_HANDLE_SIZE = 7

/** 路径顶点菱形的半对角线（屏幕 px）；与时间线关键帧菱形同形呼应。 */
export const PATH_VERTEX_SIZE = 8
export const PATH_TANGENT_HANDLE_RADIUS = 3.5

/** 两点连线的角度（度），用于端点游标与尺寸标注的朝向。 */
export function lineAngle(start: StagePoint, end: StagePoint) {
  return Math.atan2(end.y - start.y, end.x - start.x) * 180 / Math.PI
}

export function lineEndpointCursor(start: StagePoint, end: StagePoint) {
  const angle = ((lineAngle(start, end) % 180) + 180) % 180
  if (angle < 22.5 || angle >= 157.5) return 'ew-resize'
  if (angle < 67.5) return 'nwse-resize'
  if (angle < 112.5) return 'ns-resize'
  return 'nesw-resize'
}

export function lineDimensionLabel(start: StagePoint, end: StagePoint) {
  const length = Math.hypot(end.x - start.x, end.y - start.y)
  const rounded = Math.round(length * 100) / 100
  return `${rounded} × 0`
}

export function lineLabelPosition(start: StagePoint, end: StagePoint) {
  const deltaX = end.x - start.x
  const deltaY = end.y - start.y
  const length = Math.hypot(deltaX, deltaY)
  let normal = length < 1
    ? { x: 0, y: 1 }
    : { x: -deltaY / length, y: deltaX / length }
  if (normal.y < 0) normal = { x: -normal.x, y: -normal.y }
  let angle = lineAngle(start, end)
  if (angle > 90 || angle < -90) angle += 180
  return {
    angle,
    x: (start.x + end.x) / 2 + normal.x * 17,
    y: (start.y + end.y) / 2 + normal.y * 17,
  }
}

export function arrowHeadPath(start: { readonly x: number; readonly y: number }, end: { readonly x: number; readonly y: number }) {
  const deltaX = end.x - start.x
  const deltaY = end.y - start.y
  const length = Math.hypot(deltaX, deltaY)
  if (length < 1) return null
  const directionX = deltaX / length
  const directionY = deltaY / length
  const perpendicularX = -directionY
  const perpendicularY = directionX
  const baseX = end.x - directionX * 10
  const baseY = end.y - directionY * 10
  return `M${end.x} ${end.y}L${baseX + perpendicularX * 5} ${baseY + perpendicularY * 5}L${baseX - perpendicularX * 5} ${baseY - perpendicularY * 5}Z`
}
