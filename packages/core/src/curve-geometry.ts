/**
 * 平面曲线的形状运算：圆弧与多段线。
 *
 * @remarks
 * 纯形状函数，不认识任何文档协议——页面画布与 CAD 画布共用同一份。这些运算从 `cad` 包整体
 * 搬来：搬的是一整套闭式解（角度包含判定、点到弧距离、象限紧包围盒、三点定弧、按弦高拍扁），
 * 不是一两个 `if`。
 *
 * **整个模块一起搬而不是按消费者拆**：`flattenComposeArc` 目前只有 CAD 侧的交叉框选与块展开
 * 用得到，但把它单独留在 `cad` 会让弧的数学横跨两个包，而那正是「一半改了另一半没改」的
 * 温床。判据是模块的内聚性，不是逐个函数的消费者计数。
 *
 * @packageDocumentation
 */

/** 二维点；不要求 `JsonObject`，本模块只做算术。 @public */
export interface ComposePlanarPoint {
  readonly x: number
  readonly y: number
}

/** 一条线段。 @public */
export interface ComposeSegmentShape {
  readonly start: ComposePlanarPoint
  readonly end: ComposePlanarPoint
}

/**
 * 一段圆弧。
 *
 * @remarks
 * 整圆是 `sweep` 为 ±360 的弧，不另立类型：命中、捕捉、归一化、平移、渲染与校验因此各只有
 * 一份实现，整圆自然退化成「角度包含判断永远为真」的那一支。
 *
 * @public
 */
export interface ComposeArcShape {
  readonly center: ComposePlanarPoint
  readonly radius: number
  /** 起始角，度；屏幕顺时针为正，与极坐标输入取同一约定。 */
  readonly startAngle: number
  /**
   * 扫掠角，度；正为顺时针，绝对值达到 360 即整圆。
   *
   * @remarks
   * 用带符号的扫掠角而不是终止角：单给终止角分不出 10° 的短弧与 350° 的长弧，而这个歧义只在
   * 特定角度组合下现形。
   */
  readonly sweep: number
}

const TO_RADIANS = Math.PI / 180

/** 把角度归一到 `[0, 360)`。 */
function normalizeDegrees(angle: number) {
  const wrapped = angle % 360
  return wrapped < 0 ? wrapped + 360 : wrapped
}

/** 两点间距离的平方。 @public */
export function composeSquaredDistance(a: ComposePlanarPoint, b: ComposePlanarPoint) {
  const dx = a.x - b.x
  const dy = a.y - b.y
  return dx * dx + dy * dy
}

/**
 * 点到线段的距离。
 *
 * @remarks
 * 零长度线段退化成点：否则除法产生 NaN，而 NaN 的一切比较都为 false——命中会静默失效。
 *
 * @public
 */
export function pointToComposeSegmentDistance(
  segment: ComposeSegmentShape,
  point: ComposePlanarPoint,
): number {
  const { start, end } = segment
  const dx = end.x - start.x
  const dy = end.y - start.y
  const lengthSquared = dx * dx + dy * dy
  const px = point.x - start.x
  const py = point.y - start.y
  if (lengthSquared === 0) return Math.hypot(px, py)
  const t = Math.min(1, Math.max(0, (px * dx + py * dy) / lengthSquared))
  return Math.hypot(px - t * dx, py - t * dy)
}

/** 线段中点。 @public */
export function composeSegmentMidpoint(segment: ComposeSegmentShape): ComposePlanarPoint {
  return {
    x: (segment.start.x + segment.end.x) / 2,
    y: (segment.start.y + segment.end.y) / 2,
  }
}

/** 圆弧上给定角度处的点。 @public */
export function composeArcPointAt(arc: ComposeArcShape, degrees: number): ComposePlanarPoint {
  const radians = degrees * TO_RADIANS
  return {
    x: arc.center.x + arc.radius * Math.cos(radians),
    y: arc.center.y + arc.radius * Math.sin(radians),
  }
}

/** 圆弧的两个端点；整圆时两者重合。 @public */
export function composeArcEndpoints(
  arc: ComposeArcShape,
): readonly [ComposePlanarPoint, ComposePlanarPoint] {
  return [composeArcPointAt(arc, arc.startAngle), composeArcPointAt(arc, arc.startAngle + arc.sweep)]
}

/** 圆弧的中点，即半扫掠处。 @public */
export function composeArcMidpoint(arc: ComposeArcShape): ComposePlanarPoint {
  return composeArcPointAt(arc, arc.startAngle + arc.sweep / 2)
}

/** `|sweep|` 达到整圈。 @public */
export function isComposeFullCircle(arc: ComposeArcShape) {
  return Math.abs(arc.sweep) >= 360
}

/**
 * 某个绝对角度是否落在圆弧的扫掠范围内。
 *
 * @remarks
 * 统一换算成「从起始角出发、沿扫掠方向走过的角量」再与 `|sweep|` 比较，因此正负扫掠共用一条
 * 判断。整圆直接为真——归一化会把 360 变成 0，不先短路就会把整圆判成零长弧。
 *
 * @public
 */
export function composeArcContainsAngle(arc: ComposeArcShape, degrees: number) {
  if (isComposeFullCircle(arc)) return true
  const travelled = arc.sweep >= 0
    ? normalizeDegrees(degrees - arc.startAngle)
    : normalizeDegrees(arc.startAngle - degrees)
  return travelled <= Math.abs(arc.sweep)
}

/**
 * 点到圆弧的距离。
 *
 * @remarks
 * 闭式解，比线段还便宜：目标点相对圆心的方位角落在扫掠内时，距离就是 `|到圆心距离 − 半径|`；
 * 落在扫掠外时，弧上离它最近的点必是某个端点。
 *
 * 点正好在圆心时方位角无定义，此时到弧上任意点的距离都是半径——直接返回半径，避免
 * `atan2(0, 0)` 带来的平台差异。
 *
 * @public
 */
export function pointToComposeArcDistance(
  arc: ComposeArcShape,
  point: ComposePlanarPoint,
): number {
  const dx = point.x - arc.center.x
  const dy = point.y - arc.center.y
  if (dx === 0 && dy === 0) return arc.radius
  const degrees = Math.atan2(dy, dx) / TO_RADIANS
  if (composeArcContainsAngle(arc, degrees)) {
    return Math.abs(Math.hypot(dx, dy) - arc.radius)
  }
  const [start, end] = composeArcEndpoints(arc)
  return Math.sqrt(Math.min(
    composeSquaredDistance(start, point),
    composeSquaredDistance(end, point),
  ))
}

/** 四个轴向方位，用于象限点与紧包围盒。 */
const AXIS_ANGLES = [0, 90, 180, 270] as const

/**
 * 圆弧上落在扫掠范围内的象限点。
 *
 * @remarks
 * 扫掠外的方位不产生候选：那个点不在弧上，捕过去会让光标跳到一段并不存在的几何上。
 *
 * @public
 */
export function composeArcQuadrants(arc: ComposeArcShape): readonly ComposePlanarPoint[] {
  return AXIS_ANGLES.filter((angle) => composeArcContainsAngle(arc, angle))
    .map((angle) => composeArcPointAt(arc, angle))
}

/**
 * 决定圆弧**紧**包围盒的那组点：两个端点加落在扫掠内的象限点。
 *
 * @remarks
 * 只用两个端点算是错的：90° 到 270° 的弧鼓出来的那一侧在端点之外，盒会把弧裁掉一块，
 * 而这只在跨象限的弧上出现。
 *
 * 也不能拿整圆的盒子凑合：一段 90° 的弧，整圆盒是四倍面积。
 *
 * @public
 */
export function composeArcBoundsPoints(arc: ComposeArcShape): readonly ComposePlanarPoint[] {
  return [...composeArcEndpoints(arc), ...composeArcQuadrants(arc)]
}

/**
 * 单段弦与弧之间允许的最大偏差（世界单位）。
 *
 * @remarks
 * 按**弦高误差**而不是固定段数分段：固定段数在大半径上误差发散，而弦高直接就是「最多偏几个
 * 世界单位」，可以拿它跟命中容差比较。
 */
const MAX_SAGITTA = 0.25

/**
 * 把圆弧拍扁成线段。
 *
 * @remarks
 * 只用于交叉框选与非等比缩放的展开。命中、窗口框选与捕捉都有精确解，不走这里——拍扁会让
 * 圆心与象限点消失，而那正是圆弧最有用的两个特征点。
 *
 * 段数由弦高误差 `s = r(1 − cos(θ/2))` 反解，并至少分成两段：一段的整圆会退化成一个点。
 *
 * @public
 */
export function flattenComposeArc(arc: ComposeArcShape): readonly ComposeSegmentShape[] {
  const total = Math.abs(arc.sweep)
  const ratio = Math.max(-1, Math.min(1, 1 - MAX_SAGITTA / arc.radius))
  const stepDegrees = (2 * Math.acos(ratio)) / TO_RADIANS
  const count = Math.max(2, Math.ceil(total / Math.max(stepDegrees, 1e-6)))
  const direction = arc.sweep >= 0 ? 1 : -1
  const segments: ComposeSegmentShape[] = []
  let previous = composeArcPointAt(arc, arc.startAngle)
  for (let i = 1; i <= count; i += 1) {
    const point = composeArcPointAt(arc, arc.startAngle + direction * total * (i / count))
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
 * @public
 */
export function composeArcThroughPoints(
  start: ComposePlanarPoint,
  through: ComposePlanarPoint,
  end: ComposePlanarPoint,
): ComposeArcShape | null {
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

/**
 * 把顶点序列展开成线段序列。
 *
 * @remarks
 * 闭合时**多产出一段**（末点回到首点）。闭合由布尔标志表达而不是把首点再写一遍：重复表示法
 * 里 `[A,B,C,A]` 是闭合三角形还是回到起点的开放折线无法区分，而两者在框选与捕捉上给出不同
 * 的候选——重复的那个顶点会产生两个端点候选。
 *
 * 展开**不丢任何东西**：顶点仍是各段的端点，各段仍有自己的中点，形状逐像素相同。这与「不把
 * 圆弧拍扁」不矛盾——圆弧是曲线，线段集合只能逼近它；多段线本来就是一串线段。
 *
 * @public
 */
export function composePolylineSegments(
  vertices: readonly ComposePlanarPoint[],
  closed: boolean,
): readonly ComposeSegmentShape[] {
  const segments: ComposeSegmentShape[] = []
  for (let i = 0; i + 1 < vertices.length; i += 1) {
    segments.push({ start: vertices[i]!, end: vertices[i + 1]! })
  }
  if (closed && vertices.length > 2) {
    segments.push({ start: vertices[vertices.length - 1]!, end: vertices[0]! })
  }
  return segments
}

/**
 * 顶点序列是否退化：跨度为零，屏幕上什么都没有。
 *
 * @remarks
 * 与半径为零的圆是同一类幽灵——点不中也删不掉。
 *
 * @public
 */
export function isDegenerateComposePolyline(vertices: readonly ComposePlanarPoint[]) {
  if (vertices.length < 2) return true
  const first = vertices[0]!
  return vertices.every(({ x, y }) => x === first.x && y === first.y)
}
