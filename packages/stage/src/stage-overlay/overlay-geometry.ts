import { COMPOSE_CURVE_PICK_TOLERANCE } from '@compose-ui/core'
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

/**
 * 边缘缩放命中带的厚度（屏幕 px）。
 *
 * @remarks
 * 命中带整条落在包围盒**外侧**，而且要再让开一个 {@link COMPOSE_CURVE_PICK_TOLERANCE}：
 * 边线本身连同它的拾取容差都归**移动**。理由在空心图形上才显出来——矩形的描边是它在画布上
 * 唯一可拖的那几个像素（盒里绝大部分是空的，空心图形不以包围盒拦截指针），命中带若压在边线
 * 上，选中之后同一个位置的含义就从「移动」变成了「缩放」，于是一个被选中的空心矩形在画布上
 * 根本拖不动。
 *
 * 只挪到「紧贴边线的外侧」不够：SVG 矩形的命中区**含它自己的边界**，而用户瞄的正是那条线，
 * 于是落在边线上的那一下仍然被缩放接走。让开的量取描边自己的拾取容差，因为那正是「多近算在
 * 这条线上」的事实来源。填充对象让出去的只是边线附近这几个像素，它们的内部本来就可拖。
 */
export const EDGE_HIT_THICKNESS = 8

/**
 * 边缘缩放命中带与包围盒之间让开的距离（屏幕 px）。
 *
 * @remarks
 * 就是描边的拾取容差：命中带从「不再算在这条线上」的地方开始，两个数写成一个，下一个改容差
 * 的人不会漏掉这条带。
 */
export const EDGE_HIT_OFFSET = COMPOSE_CURVE_PICK_TOLERANCE

/**
 * 路径顶点标记的边长（屏幕 px）。
 *
 * @remarks
 * 运动路径上它是菱形的半对角线——与时间线关键帧菱形同形呼应，因为那里的顶点**就是**关键帧。
 * 曲线的几何夹点是方块（AutoCAD 的形状），共用同一个尺寸，因此两种路径的手柄一样好抓。
 */
export const PATH_VERTEX_SIZE = 8

/**
 * 段中点条形的长宽（屏幕 px）。
 *
 * @remarks
 * 沿段方向摆，长宽比是它与方块唯一的视觉区别——两个夹点长得一样而按下去做的事不同，是最难
 * 自己发现的一类缺陷。短边比方块窄，因此它不会在密集折线上糊成一片。
 */
export const PATH_SEGMENT_LENGTH = 11
export const PATH_SEGMENT_THICKNESS = 4
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
