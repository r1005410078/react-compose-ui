import type { CadInputPoint } from '../point-input'
import { squaredDistance, type CadBounds, type CadSegment } from './cad-segment-geometry'

/**
 * 世界坐标下的一段圆弧。
 *
 * @remarks
 * 整圆是 `sweep` 为 ±360 的弧，不另立类型：命中、框选、捕捉、平移与渲染因此各只有一份实现，
 * 整圆自然退化成「角度判断永远为真」的那一支。
 *
 * @internal
 */
export interface CadArcShape {
  readonly center: CadInputPoint
  readonly radius: number
  /** 起始角，度；屏幕顺时针为正，与块插入旋转、极坐标输入取同一约定。 */
  readonly startAngle: number
  /**
   * 扫掠角，度；正为顺时针。
   *
   * @remarks
   * 用带符号的扫掠角而不是终止角：单给终止角分不出 10° 的短弧与 350° 的长弧，而这个歧义只在
   * 特定角度组合下现形。
   */
  readonly sweep: number
}

const TO_RADIANS = Math.PI / 180

/** 把角度归一到 [0, 360)。 */
function normalizeDegrees(angle: number) {
  const wrapped = angle % 360
  return wrapped < 0 ? wrapped + 360 : wrapped
}

/** 圆弧上给定角度处的点。 @internal */
export function arcPointAt(arc: CadArcShape, degrees: number): CadInputPoint {
  const radians = degrees * TO_RADIANS
  return {
    x: arc.center.x + arc.radius * Math.cos(radians),
    y: arc.center.y + arc.radius * Math.sin(radians),
  }
}

/** 圆弧的两个端点；整圆时两者重合。 @internal */
export function arcEndpoints(arc: CadArcShape): readonly [CadInputPoint, CadInputPoint] {
  return [arcPointAt(arc, arc.startAngle), arcPointAt(arc, arc.startAngle + arc.sweep)]
}

/** 圆弧的中点，即半扫掠处。 @internal */
export function arcMidpoint(arc: CadArcShape): CadInputPoint {
  return arcPointAt(arc, arc.startAngle + arc.sweep / 2)
}

/** `|sweep|` 达到整圈。 @internal */
export function isFullCircle(arc: CadArcShape) {
  return Math.abs(arc.sweep) >= 360
}

/**
 * 某个绝对角度是否落在圆弧的扫掠范围内。
 *
 * @remarks
 * 统一换算成「从起始角出发、沿扫掠方向走过的角量」再与 `|sweep|` 比较，因此正负扫掠共用一条
 * 判断。整圆直接为真——归一化会把 360 变成 0，不先短路就会把整圆判成零长弧。
 *
 * @internal
 */
export function arcContainsAngle(arc: CadArcShape, degrees: number) {
  if (isFullCircle(arc)) return true
  const travelled = arc.sweep >= 0
    ? normalizeDegrees(degrees - arc.startAngle)
    : normalizeDegrees(arc.startAngle - degrees)
  return travelled <= Math.abs(arc.sweep)
}

/**
 * 点到圆弧的距离平方。
 *
 * @remarks
 * 闭式解，比线段还便宜：目标点相对圆心的方位角落在扫掠内时，距离就是 `|到圆心距离 − 半径|`；
 * 落在扫掠外时，弧上离它最近的点必是某个端点。
 *
 * 点正好在圆心时方位角无定义，此时到弧上任意点的距离都是半径——直接返回半径的平方，避免
 * `atan2(0, 0)` 带来的平台差异。
 *
 * @internal
 */
export function pointToArcDistanceSquared(arc: CadArcShape, point: CadInputPoint) {
  const dx = point.x - arc.center.x
  const dy = point.y - arc.center.y
  if (dx === 0 && dy === 0) return arc.radius * arc.radius
  const degrees = Math.atan2(dy, dx) / TO_RADIANS
  if (arcContainsAngle(arc, degrees)) {
    const radial = Math.hypot(dx, dy) - arc.radius
    return radial * radial
  }
  const [start, end] = arcEndpoints(arc)
  return Math.min(squaredDistance(start, point), squaredDistance(end, point))
}

/** 四个轴向方位，用于象限点与紧包围盒。 @internal */
const AXIS_ANGLES = [0, 90, 180, 270] as const

/**
 * 圆弧上落在扫掠范围内的象限点。
 *
 * @remarks
 * 扫掠外的方位不产生候选：那个点不在弧上，捕过去会让光标跳到一段并不存在的几何上。
 *
 * @internal
 */
export function arcQuadrants(arc: CadArcShape): readonly CadInputPoint[] {
  return AXIS_ANGLES.filter((angle) => arcContainsAngle(arc, angle))
    .map((angle) => arcPointAt(arc, angle))
}

/**
 * 圆弧的**紧**包围盒。
 *
 * @remarks
 * 不能拿整圆的盒子凑合：一段 90° 的弧，整圆盒是四倍面积，窗口框选会把明明框住了的弧判成没
 * 框住。紧盒由两个端点起算，再把落在扫掠内的轴向极值并进来。
 *
 * @internal
 */
export function arcBounds(arc: CadArcShape): CadBounds {
  const points = [...arcEndpoints(arc), ...arcQuadrants(arc)]
  let minX = Number.POSITIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY
  for (const { x, y } of points) {
    minX = Math.min(minX, x)
    minY = Math.min(minY, y)
    maxX = Math.max(maxX, x)
    maxY = Math.max(maxY, y)
  }
  return { minX, minY, maxX, maxY }
}

/**
 * 单段弦与弧之间允许的最大偏差（世界单位）。
 *
 * @remarks
 * 按**弦高误差**而不是固定段数分段：固定段数在大半径上误差发散，而弦高直接就是「最多偏几个
 * 世界单位」，可以拿它跟命中容差比较。0.25 远小于任何实际命中容差。
 */
const MAX_SAGITTA = 0.25

/**
 * 把圆弧拍扁成线段。
 *
 * @remarks
 * 只用于交叉框选与非等比缩放的块展开。命中、窗口框选与捕捉都有精确解，不走这里——拍扁会让
 * 圆心与象限点消失，而那正是圆弧最有用的两个特征点。
 *
 * 段数由弦高误差 `s = r(1 − cos(θ/2))` 反解，并至少分成两段：一段的整圆会退化成一个点。
 *
 * @internal
 */
export function flattenCadArc(arc: CadArcShape): readonly CadSegment[] {
  const total = Math.abs(arc.sweep)
  const ratio = Math.max(-1, Math.min(1, 1 - MAX_SAGITTA / arc.radius))
  const stepDegrees = (2 * Math.acos(ratio)) / TO_RADIANS
  const count = Math.max(2, Math.ceil(total / Math.max(stepDegrees, 1e-6)))
  const direction = arc.sweep >= 0 ? 1 : -1
  const segments: CadSegment[] = []
  let previous = arcPointAt(arc, arc.startAngle)
  for (let i = 1; i <= count; i += 1) {
    const point = arcPointAt(arc, arc.startAngle + direction * total * (i / count))
    segments.push({ start: previous, end: point })
    previous = point
  }
  return segments
}

/**
 * 过三点的圆弧。
 *
 * @remarks
 * 两条中垂线求交得外接圆心。**三点共线时无解**（外接圆退化成直线），返回 `null`——沿一条既有
 * 直线连点三下在实际操作里很常见，必须是可预期的拒绝而不是产出一个半径巨大的假弧。
 *
 * 扫掠方向由中间那点落在起点→终点的哪一侧决定：写反的症状是弧永远往同一侧鼓，而用户会以为
 * 是自己点错了。
 *
 * @internal
 */
export function arcThroughPoints(
  start: CadInputPoint,
  through: CadInputPoint,
  end: CadInputPoint,
): CadArcShape | null {
  const ax = start.x
  const ay = start.y
  const bx = through.x
  const by = through.y
  const cx = end.x
  const cy = end.y
  const d = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by))
  if (d === 0 || !Number.isFinite(d)) return null

  const aSq = ax * ax + ay * ay
  const bSq = bx * bx + by * by
  const cSq = cx * cx + cy * cy
  const center = {
    x: (aSq * (by - cy) + bSq * (cy - ay) + cSq * (ay - by)) / d,
    y: (aSq * (cx - bx) + bSq * (ax - cx) + cSq * (bx - ax)) / d,
  }
  const radius = Math.hypot(ax - center.x, ay - center.y)
  if (!(radius > 0) || !Number.isFinite(radius)) return null

  const startAngle = Math.atan2(ay - center.y, ax - center.x) / TO_RADIANS
  const endAngle = Math.atan2(cy - center.y, cx - center.x) / TO_RADIANS
  const clockwise = normalizeDegrees(endAngle - startAngle)
  // 顺时针走一遍，看中间那点是否在途中；不在就说明弧朝另一侧鼓。
  const throughTravel = normalizeDegrees(
    Math.atan2(by - center.y, bx - center.x) / TO_RADIANS - startAngle,
  )
  const sweep = throughTravel <= clockwise ? clockwise : clockwise - 360
  return { center, radius, startAngle, sweep }
}
