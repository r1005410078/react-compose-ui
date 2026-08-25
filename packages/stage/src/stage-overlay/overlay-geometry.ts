import type { StagePoint } from '@compose-ui/stage-engine'

/** 端点方块边长（屏幕 px）。 */
export const LINE_ENDPOINT_HANDLE_SIZE = 8
// 可见方块保持轻量，命中区独立放大，避免高分屏上必须像素级对准才能开始端点手势。
//
// 8 而不是更大：它同时是顶点模式那个拾取框的来源（见下），而框画得太大就不再像 AutoCAD 的
// 靶区、反倒像一个色块。16px 直径的抓取圈对 8px 的夹点仍然宽裕。
export const LINE_ENDPOINT_HIT_RADIUS = 8

/**
 * 几何编辑会话里拾取框的半边长（屏幕 px）。
 *
 * @remarks
 * 顶点模式是 Stage 里唯一一处存在**统一命中容差**的地方——可抓目标只有夹点，而每个夹点的
 * 命中区都是 {@link LINE_ENDPOINT_HIT_RADIUS}。因此这里的框可以真的表达「压住了就抓得到」，
 * 而不像命令那一档只是靶区示意。
 *
 * 取命中圆的**内切**正方形而不是外接：外接的四个角伸到 `r√2`，用户在角上按下去会落空，
 * 而那正是他最相信框的时候。宁可少说不可多说。
 *
 * 定义**紧挨着**它派生的那个常量：两处分开写死会让下一个改命中半径的人漏掉框。
 */
export const GRIP_PICK_RADIUS = LINE_ENDPOINT_HIT_RADIUS / Math.SQRT2
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
