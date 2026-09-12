/**
 * 平面曲线的形状运算：圆弧、三次贝塞尔与多段线。
 *
 * @remarks
 * 纯形状函数，不认识任何文档协议，因此住在 `core`。这里是一整套闭式解（角度包含判定、
 * 点到弧距离、象限紧包围盒、三点定弧、按弦高拍扁），不是一两个 `if`。
 *
 * **整个模块放在一起而不是按消费者拆**：把其中几个函数挪到用得最多的那个包，会让弧的数学
 * 横跨两个包，而那正是「一半改了另一半没改」的温床。判据是模块的内聚性，不是逐个函数的
 * 消费者计数。
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
 * 一个轴对齐矩形。
 *
 * @remarks
 * 与 `StageRect` 同形，但本模块不依赖任何上层包：判定只做算术，坐标空间由调用方保证一致。
 * @public
 */
export interface ComposeRectShape {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
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

/**
 * 线段上离给定点最近的那个点。
 *
 * @remarks
 * 与 {@link pointToComposeSegmentDistance} 是同一段投影，因此**必须**放在一起改：一个回答
 * 「多远」、另一个回答「哪一点」，两处各写一遍投影钳制的话，捕捉标记会画在离命中判定
 * 几个像素之外的地方。

 * 参数 `t` 钳制在 `[0, 1]`：投影落在线段之外时结果是最近的那个端点，而不是延长线上的点——
 * 接线要落在**画出来的那条线**上。
 *
 * @public
 */
export function closestPointOnComposeSegment(
  segment: ComposeSegmentShape,
  point: ComposePlanarPoint,
): ComposePlanarPoint {
  const { start, end } = segment
  const dx = end.x - start.x
  const dy = end.y - start.y
  const lengthSquared = dx * dx + dy * dy
  // 零长度线段退化成它自己那个点：除法会给出 NaN，而 NaN 的一切比较都为 false，
  // 症状是捕捉在某些退化几何上静默失效。
  if (lengthSquared === 0) return { x: start.x, y: start.y }
  const t = Math.min(1, Math.max(0, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared))
  return { x: start.x + t * dx, y: start.y + t * dy }
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
 * 单段弦与曲线之间允许的最大偏差（世界单位）。
 *
 * @remarks
 * 按**弦高误差**而不是固定段数分段：固定段数在大半径上误差发散，而弦高直接就是「最多偏几个
 * 世界单位」，可以拿它跟命中容差比较。
 *
 * 圆弧与三次贝塞尔共用同一个容差——两者拍平之后进的是同一批下游（命中、框选、内部判定），
 * 各取一个值会让同一个容差在同一张图上有两个含义。
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
 * 一段三次贝塞尔。
 *
 * @remarks
 * 只有三次一种：二次贝塞尔与直线段都能**精确**升阶成三次，因此多留一种段类型只会让归一化、
 * 平移、距离、包围盒、渲染与校验六条路径各多一支逐字相同的实现。这与「整圆是扫掠 ±360 的
 * 弧」「矩形是四顶点的闭合多段线」是同一条判断。
 *
 * @public
 */
export interface ComposeCubicShape {
  readonly start: ComposePlanarPoint
  readonly c1: ComposePlanarPoint
  readonly c2: ComposePlanarPoint
  readonly end: ComposePlanarPoint
}

/** 三次贝塞尔在参数 `t` 处的点。 @public */
export function composeCubicPointAt(cubic: ComposeCubicShape, t: number): ComposePlanarPoint {
  const u = 1 - t
  const a = u * u * u
  const b = 3 * u * u * t
  const c = 3 * u * t * t
  const d = t * t * t
  return {
    x: a * cubic.start.x + b * cubic.c1.x + c * cubic.c2.x + d * cubic.end.x,
    y: a * cubic.start.y + b * cubic.c1.y + c * cubic.c2.y + d * cubic.end.y,
  }
}

/**
 * 一个轴上导数为零的参数值，只取落在 `(0, 1)` 开区间内的。
 *
 * @remarks
 * `B'(t) = 3[a t² + b t + c]`，因此极值就是这条一元二次的根。端点不必解——它们本来就在候选
 * 集合里，而 `t` 恰好取到 0 或 1 时求根会因浮点误差反复横跳。
 *
 * 二次项退化（四个控制点在该轴上共线分布）时降成一次方程；两者都退化时这一轴是常量，没有
 * 极值。漏掉这一支的症状是 `a` 极小时根被算成一个巨大的数，包围盒随之炸开。
 */
function cubicAxisExtrema(p0: number, p1: number, p2: number, p3: number): readonly number[] {
  const a = -p0 + 3 * p1 - 3 * p2 + p3
  const b = 2 * (p0 - 2 * p1 + p2)
  const c = p1 - p0
  const inRange = (t: number) => (Number.isFinite(t) && t > 0 && t < 1 ? [t] : [])
  if (a === 0) return b === 0 ? [] : inRange(-c / b)
  const discriminant = b * b - 4 * a * c
  if (discriminant < 0) return []
  const root = Math.sqrt(discriminant)
  return [...inRange((-b + root) / (2 * a)), ...inRange((-b - root) / (2 * a))]
}

/**
 * 决定三次贝塞尔**紧**包围盒的那组点：两个端点加两轴上导数为零处的极值点。
 *
 * @remarks
 * **不能拿控制点凸包凑合**：凸包是紧包围盒的超集，在 S 形段上肉眼可见地大一圈，盒会宣称
 * 对象并不占据的面积。这与「弧的紧包围盒必须把落在扫掠内的象限点算进去」是同一条规则的
 * 另一个实例，症状也一样——只在特定形状上出现，很容易被当成渲染问题。
 *
 * @public
 */
export function composeCubicBoundsPoints(
  cubic: ComposeCubicShape,
): readonly ComposePlanarPoint[] {
  const ts = [
    ...cubicAxisExtrema(cubic.start.x, cubic.c1.x, cubic.c2.x, cubic.end.x),
    ...cubicAxisExtrema(cubic.start.y, cubic.c1.y, cubic.c2.y, cubic.end.y),
  ]
  return [cubic.start, cubic.end, ...ts.map((t) => composeCubicPointAt(cubic, t))]
}

/**
 * 在参数 `t` 处把一段三次贝塞尔分成两段（de Casteljau）。
 *
 * @remarks
 * 两段拼起来与原段**逐像素相同**，这正是拍平可以放心递归下去的前提，也是「在曲线段上插一个
 * 顶点，形状逐像素不变」这条要求唯一的做法——插点是为了之后能改它，当场把曲线改成另一个
 * 样子会让用户以为自己弄坏了什么。
 *
 * `t` **不钳制**：调用方要么给 `0.5`（拍平），要么给 {@link nearestComposeCubicT} 的返回值，
 * 两者都已在 `[0, 1]` 内。钳制会把「算错了 t」这个编程错误变成一个静默产出退化段的结果。
 *
 * @public
 */
export function splitComposeCubic(cubic: ComposeCubicShape, t: number): readonly [ComposeCubicShape, ComposeCubicShape] {
  const lerp = (a: ComposePlanarPoint, b: ComposePlanarPoint): ComposePlanarPoint => ({
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
  })
  const ab = lerp(cubic.start, cubic.c1)
  const bc = lerp(cubic.c1, cubic.c2)
  const cd = lerp(cubic.c2, cubic.end)
  const abbc = lerp(ab, bc)
  const bccd = lerp(bc, cd)
  const mid = lerp(abbc, bccd)
  return [
    { start: cubic.start, c1: ab, c2: abbc, end: mid },
    { start: mid, c1: bccd, c2: cd, end: cubic.end },
  ]
}

/**
 * 递归拍平的深度上限。
 *
 * @remarks
 * 病态输入（控制点相距极远、或含近似无穷的坐标）下弦高判据可能一直不满足，而 2^12 段已经
 * 远超任何屏幕能分辨的精度。它是安全阀，正常几何在四五层内就收敛。
 */
const MAX_CUBIC_FLATTEN_DEPTH = 12

/**
 * 把三次贝塞尔拍扁成线段。
 *
 * @remarks
 * 按**弦高误差**递归细分，与圆弧拍平取同一个容差：控制点到弦的距离都落在容差内时，这一段
 * 与它的弦在屏幕上分不出来。固定段数是错的——同一个段数在一段 5px 的曲线上是浪费，在一段
 * 跨屏的曲线上是可见的折线。
 *
 * 命中、框选与内部判定都走这里。贝塞尔的最近点没有闭式解（要解五次方程），因此这条近似不是
 * 偷懒而是唯一可行的做法；容差与命中容差同一个量级，误差不以任何方式呈现给用户。
 *
 * @public
 */
export function flattenComposeCubic(cubic: ComposeCubicShape): readonly ComposeSegmentShape[] {
  return flattenCubicWithParams(cubic).map(({ segment }) => segment)
}

/** 拍平产出的一条弦，连同它在原段上占的参数区间。 */
interface ParameterizedChord {
  readonly segment: ComposeSegmentShape
  readonly t0: number
  readonly t1: number
}

/**
 * 拍平并记下每条弦占的参数区间。
 *
 * @remarks
 * 与 {@link flattenComposeCubic} **共用同一条细分规则**而不是各拍各的：最近点与距离必须落在
 * 同一条折线上，否则「点在这条曲线上」与「它落在参数 t 处」会给出互相矛盾的答案，而这种
 * 偏差只在细分边界附近出现、极难复现。
 *
 * 参数区间靠**下标推算**而不是在递归里传：每次对半分，因此第 k 层的第 i 条弦占
 * `[i / 2^k, (i + 1) / 2^k]`——但深度并不齐平（弯的那一半分得更深），所以这里在递归里直接
 * 带着区间走。
 */
function flattenCubicWithParams(cubic: ComposeCubicShape): readonly ParameterizedChord[] {
  const chords: ParameterizedChord[] = []
  const walk = (current: ComposeCubicShape, depth: number, t0: number, t1: number) => {
    const chord = { start: current.start, end: current.end }
    const deviation = Math.max(
      pointToComposeSegmentDistance(chord, current.c1),
      pointToComposeSegmentDistance(chord, current.c2),
    )
    if (depth >= MAX_CUBIC_FLATTEN_DEPTH || !(deviation > MAX_SAGITTA)) {
      chords.push({ segment: chord, t0, t1 })
      return
    }
    const [left, right] = splitComposeCubic(current, 0.5)
    const mid = (t0 + t1) / 2
    walk(left, depth + 1, t0, mid)
    walk(right, depth + 1, mid, t1)
  }
  walk(cubic, 0, 0, 1)
  return chords
}

/**
 * 点到三次贝塞尔最近处的参数 `t`。
 *
 * @remarks
 * 「在这条曲线段上插一个顶点」需要的正是这个数：拿它去 {@link splitComposeCubic} 分割，两段
 * 拼起来与原段逐像素相同。
 *
 * 与 {@link pointToComposeCubicDistance} 同一条拍平，因此「多近算在这条线上」与「它落在哪儿」
 * 读出的是同一份事实。贝塞尔的最近点没有闭式解（要解五次方程），近似不可避免；落在最近那条
 * 弦上之后再按弦上的比例插值，误差是一条弦的尺度，而弦本身已经细到与它在屏幕上分不出来。
 *
 * 退化段（起终点重合且控制点也压在上面）里每条弦长度都是 0，此时返回区间起点——那一段在屏幕
 * 上是一个点，任何 `t` 给出的位置都相同。
 *
 * @public
 */
export function nearestComposeCubicT(
  cubic: ComposeCubicShape,
  point: ComposePlanarPoint,
): number {
  let best = 0
  let bestDistance = Number.POSITIVE_INFINITY
  for (const { segment, t0, t1 } of flattenCubicWithParams(cubic)) {
    const distance = pointToComposeSegmentDistance(segment, point)
    if (distance >= bestDistance) continue
    bestDistance = distance
    best = t0 + (t1 - t0) * segmentParameterAt(segment, point)
  }
  return best
}

/** 落点在一条线段上的归一化投影参数，钳到 `[0, 1]`。 */
function segmentParameterAt(segment: ComposeSegmentShape, point: ComposePlanarPoint): number {
  const dx = segment.end.x - segment.start.x
  const dy = segment.end.y - segment.start.y
  const lengthSquared = dx * dx + dy * dy
  if (lengthSquared === 0) return 0
  const raw = ((point.x - segment.start.x) * dx + (point.y - segment.start.y) * dy) / lengthSquared
  return Math.min(1, Math.max(0, raw))
}

/**
 * 点到三次贝塞尔的距离。
 *
 * @remarks
 * 经 {@link flattenComposeCubic} 近似。见那里关于「没有闭式解」的说明。
 *
 * @public
 */
export function pointToComposeCubicDistance(
  cubic: ComposeCubicShape,
  point: ComposePlanarPoint,
): number {
  return flattenComposeCubic(cubic).reduce(
    (nearest, segment) => Math.min(nearest, pointToComposeSegmentDistance(segment, point)),
    Number.POSITIVE_INFINITY,
  )
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
 * 线段与轴对齐矩形是否相交（含线段完全落在矩形内）。
 *
 * @remarks
 * 框选按几何而不是按包围盒判定时用它：一条对角线的外接矩形里绝大部分是空的，一个从不碰线身
 * 的框不该选中它。
 *
 * 用 Liang-Barsky 参数化裁剪而不是「逐条边做线段相交」：后者要单独处理线段完全落在框内
 * （不与任何一条边相交）与共线两种情形，而参数化把三者收进同一段循环。
 *
 * 退化线段（起止点重合）自然退化成「点是否落在矩形内」——四个 `p` 全为零，判定只剩 `q`
 * 的符号。这一支不是巧合，是这个算法的既有性质，因此不需要在外面另加分支。
 *
 * 两个入参 MUST 处在同一坐标空间；本模块只做算术，不认识任何变换。
 *
 * @public
 */
export function composeSegmentIntersectsRect(
  segment: ComposeSegmentShape,
  rect: ComposeRectShape,
): boolean {
  const dx = segment.end.x - segment.start.x
  const dy = segment.end.y - segment.start.y
  const directions = [-dx, dx, -dy, dy]
  const distances = [
    segment.start.x - rect.x,
    rect.x + rect.width - segment.start.x,
    segment.start.y - rect.y,
    rect.y + rect.height - segment.start.y,
  ]
  let enter = 0
  let exit = 1
  for (let axis = 0; axis < 4; axis += 1) {
    const direction = directions[axis]!
    const distance = distances[axis]!
    if (direction === 0) {
      // 与该边平行：落在外侧就永远进不来，落在内侧则这一维不约束参数区间。
      if (distance < 0) return false
      continue
    }
    const ratio = distance / direction
    if (direction < 0) {
      if (ratio > exit) return false
      if (ratio > enter) enter = ratio
    } else {
      if (ratio < enter) return false
      if (ratio < exit) exit = ratio
    }
  }
  return true
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

/**
 * 圆角多段线的一段轮廓。
 *
 * @remarks
 * 有序的**一列**片段（直段与角弧交替）是圆角几何的唯一表示：命中、框选、内部判定与渲染
 * 全都读它。各自按 `cornerRadius` 再算一遍的话，下一个改圆角数学的人只会改到其中一处，
 * 而漏掉的那处的症状是「看得见的形状与点得中的形状不是同一个」。
 *
 * @public
 */
export type ComposeOutlinePiece =
  | { readonly kind: 'segment'; readonly segment: ComposeSegmentShape }
  | { readonly kind: 'arc'; readonly arc: ComposeArcShape }

/** 一个角上求解出来的圆角。 @public */
export interface ComposePolylineCornerRounding {
  /** 被圆掉的那个顶点的下标。 */
  readonly index: number
  /** 角弧本身。 */
  readonly arc: ComposeArcShape
  /** 前一条边上的切点。 */
  readonly from: ComposePlanarPoint
  /** 后一条边上的切点。 */
  readonly to: ComposePlanarPoint
}

/**
 * 一个角的局部标架：圆角的求解与反解都从它出发。
 *
 * @remarks
 * 与 {@link ComposePolylineCornerRounding} 分开是因为**半径为 0 时也要有它**——手柄在尖角
 * 状态下同样要画出来、同样要能被拖，而那时根本没有弧。
 *
 * @public
 */
export interface ComposePolylineCornerFrame {
  /** 顶点下标。 */
  readonly index: number
  /** 角顶点。 */
  readonly vertex: ComposePlanarPoint
  /** 角平分线的单位向量，指向形状内部；圆心与手柄都落在它上面。 */
  readonly bisector: ComposePlanarPoint
  /**
   * 半角的正弦。
   *
   * @remarks
   * 圆心离顶点 `r / halfSine`，因此**反解**（拖动手柄求半径）就是把落点到顶点的位移投影到
   * 角平分线上再乘它。直角下它是 `√2/2`，圆心因此落在沿两条边各进 `r` 的那个点上。
   */
  readonly halfSine: number
  /** 这个角画得出来的最大半径：相邻两段各让出自己长度的一半。 */
  readonly maxRadius: number
  /** 指向前一个顶点的单位向量；前一条边上的切点落在它上面。 */
  readonly toPrevious: ComposePlanarPoint
  /** 指向后一个顶点的单位向量；后一条边上的切点落在它上面。 */
  readonly toNext: ComposePlanarPoint
  /** 半角的正切；切点离顶点 `r / halfTangent`。 */
  readonly halfTangent: number
}

/** 角平分线方向上小于这个值就当成共线：叉积已经归一化，因此这是一个角度量。 */
const MIN_CORNER_SINE = 1e-6

/** 归一化到单位长度；零向量返回 null。 */
function unit(from: ComposePlanarPoint, to: ComposePlanarPoint) {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const length = Math.hypot(dx, dy)
  return length === 0 ? null : { x: dx / length, y: dy / length, length }
}

/**
 * 逐角求出局部标架。
 *
 * @remarks
 * 开放折线的**首尾顶点没有标架**：它们只有一条相邻边，没有角可言。共线与折回两种退化同样
 * 没有——前者的圆心在无穷远，后者根本没有角。
 *
 * @public
 */
export function composePolylineCornerFrames(
  vertices: readonly ComposePlanarPoint[],
  closed: boolean,
): readonly ComposePolylineCornerFrame[] {
  const count = vertices.length
  if (count < 3) return []
  const frames: ComposePolylineCornerFrame[] = []
  for (let index = 0; index < count; index += 1) {
    if (!closed && (index === 0 || index === count - 1)) continue
    const corner = vertices[index]!
    const toPrevious = unit(corner, vertices[(index - 1 + count) % count]!)
    const toNext = unit(corner, vertices[(index + 1) % count]!)
    if (!toPrevious || !toNext) continue

    const cross = toPrevious.x * toNext.y - toPrevious.y * toNext.x
    const dot = toPrevious.x * toNext.x + toPrevious.y * toNext.y
    const half = Math.atan2(Math.abs(cross), dot) / 2
    const halfSine = Math.sin(half)
    if (!(halfSine > MIN_CORNER_SINE) || !(Math.abs(cross) > MIN_CORNER_SINE)) continue

    const bisector = unit(
      { x: 0, y: 0 },
      { x: toPrevious.x + toNext.x, y: toPrevious.y + toNext.y },
    )
    if (!bisector) continue
    const halfTangent = Math.tan(half)
    frames.push({
      index,
      vertex: corner,
      bisector: { x: bisector.x, y: bisector.y },
      halfSine,
      // 切线长按相邻两段各自长度的一半钳制，同一条边上的两个角因此永远不会互相吃掉那一段。
      maxRadius: (Math.min(toPrevious.length, toNext.length) / 2) * halfTangent,
      toPrevious: { x: toPrevious.x, y: toPrevious.y },
      toNext: { x: toNext.x, y: toNext.y },
      halfTangent,
    })
  }
  return frames
}

/** 一个角此刻画得出来的半径：作者的意图按当前几何钳一次。 @public */
export function clampComposeCornerRadius(
  frame: ComposePolylineCornerFrame,
  radius: number,
): number {
  return Math.max(0, Math.min(radius, frame.maxRadius))
}

/** 一个角的圆心：圆角手柄就画在这里。 @public */
export function composeCornerArcCenter(
  frame: ComposePolylineCornerFrame,
  radius: number,
): ComposePlanarPoint {
  const distance = clampComposeCornerRadius(frame, radius) / frame.halfSine
  return {
    x: frame.vertex.x + frame.bisector.x * distance,
    y: frame.vertex.y + frame.bisector.y * distance,
  }
}

/**
 * 反解：一个落点落在这个角上意味着多大的半径。
 *
 * @remarks
 * 把落点到顶点的位移投影到角平分线上再乘半角正弦。**投影而不是取距离**：手柄沿角平分线
 * 进出，离开那条线的那一半位移不携带半径信息，用距离会让手往旁边一偏半径就往上跳。
 *
 * @public
 */
export function composeCornerRadiusAt(
  frame: ComposePolylineCornerFrame,
  point: ComposePlanarPoint,
): number {
  const along = (point.x - frame.vertex.x) * frame.bisector.x
    + (point.y - frame.vertex.y) * frame.bisector.y
  return clampComposeCornerRadius(frame, Math.max(0, along) * frame.halfSine)
}

/**
 * 按标架求这个角的圆角。
 *
 * @remarks
 * 圆心落在角平分线上、离顶点 `r / sin(θ/2)`，两个切点各自离顶点 `r / tan(θ/2)`——这是内切圆
 * 的标准解。角弧恒不超过 180°，因此取两个方向里短的那一条就是对的。
 */
function roundCorner(
  frame: ComposePolylineCornerFrame,
  radius: number,
): ComposePolylineCornerRounding | null {
  const effective = clampComposeCornerRadius(frame, radius)
  if (!(effective > 0)) return null
  const center = composeCornerArcCenter(frame, effective)
  const tangent = effective / frame.halfTangent
  const from = {
    x: frame.vertex.x + frame.toPrevious.x * tangent,
    y: frame.vertex.y + frame.toPrevious.y * tangent,
  }
  const to = {
    x: frame.vertex.x + frame.toNext.x * tangent,
    y: frame.vertex.y + frame.toNext.y * tangent,
  }
  const startAngle = Math.atan2(from.y - center.y, from.x - center.x) / TO_RADIANS
  const endAngle = Math.atan2(to.y - center.y, to.x - center.x) / TO_RADIANS
  let sweep = normalizeDegrees(endAngle - startAngle)
  if (sweep > 180) sweep -= 360
  return { index: frame.index, arc: { center, radius: effective, startAngle, sweep }, from, to }
}

/**
 * 逐角求解一条多段线的圆角。
 *
 * @remarks
 * 哪些顶点算角由 {@link composePolylineCornerFrames} 说了算——闭合折线每个顶点都是角，收尾
 * 那一段与其余的段没有任何区别。
 *
 * @public
 */
export function composePolylineCornerRoundings(
  vertices: readonly ComposePlanarPoint[],
  closed: boolean,
  radius: number,
): readonly ComposePolylineCornerRounding[] {
  if (!(radius > 0)) return []
  return composePolylineCornerFrames(vertices, closed)
    .flatMap((frame) => {
      const rounding = roundCorner(frame, radius)
      return rounding ? [rounding] : []
    })
}

/**
 * 一条多段线的有序轮廓：缩短的直段与角弧交替。
 *
 * @remarks
 * 没有圆角时退化成 {@link composePolylineSegments} 的逐段包装，因此调用方不需要为「有没有
 * 圆角」分两条路。半径吃掉整条边时那一段长度为零，此处**丢弃**它：零长度直段对命中没有
 * 贡献，画进 `<path>` 里也只是一条多余的 `L`。
 *
 * @public
 */
export function composeRoundedPolylineOutline(
  vertices: readonly ComposePlanarPoint[],
  closed: boolean,
  radius = 0,
): readonly ComposeOutlinePiece[] {
  const roundings = composePolylineCornerRoundings(vertices, closed, radius)
  const byIndex = new Map(roundings.map((rounding) => [rounding.index, rounding]))
  const count = vertices.length
  const edges: (readonly [number, number])[] = []
  for (let i = 0; i + 1 < count; i += 1) edges.push([i, i + 1])
  if (closed && count > 2) edges.push([count - 1, 0])

  const pieces: ComposeOutlinePiece[] = []
  edges.forEach(([from, to]) => {
    const start = byIndex.get(from)?.to ?? vertices[from]!
    const end = byIndex.get(to)?.from ?? vertices[to]!
    if (start.x !== end.x || start.y !== end.y) {
      pieces.push({ kind: 'segment', segment: { start, end } })
    }
    const rounding = byIndex.get(to)
    if (rounding) pieces.push({ kind: 'arc', arc: rounding.arc })
  })
  // 闭合折线的第一个顶点是最后一条边的终点，它的角弧已经在上面那轮里加进去了；开放折线的
  // 首顶点不圆。因此这里不需要补任何东西。
  return pieces
}

/** 把一列轮廓片段拍成线段：角弧走 {@link flattenComposeArc}。 @public */
export function flattenComposeOutline(
  pieces: readonly ComposeOutlinePiece[],
): readonly ComposeSegmentShape[] {
  return pieces.flatMap((piece) => (
    piece.kind === 'segment' ? [piece.segment] : flattenComposeArc(piece.arc)
  ))
}

/**
 * 正多边形以哪个圆为准。
 *
 * @remarks
 * `inscribed` 是**全部顶点**落在圆上，`circumscribed` 是**各边中点**落在圆上——AutoCAD
 * `POLYGON` 的两个选项，取的也是它那两个词。
 *
 * @public
 */
export type ComposeRegularPolygonFit = 'inscribed' | 'circumscribed'

/**
 * 由中心与一个落点求正多边形的顶点。
 *
 * @remarks
 * 落点同时给出**大小与相位**两样：内接时它就是其中一个顶点，外切时它是某条边的中点。这正是
 * AutoCAD 拾取半径时多边形会跟着光标转的原因，而它对键盘也成立——键入的裸数字只替换半径这一个
 * 字段，角度分量原样保留，因此相位不丢。
 *
 * 外切的外接圆半径按半角放大：落点到中心的距离是内切圆半径（边心距），而 `r = R·cos(π/n)`。
 *
 * **角度的正负约定在这里不可观测**：本模块沿用 {@link composeArcPointAt} 的裸角
 * （`atan2(dy, dx)`，Y 轴向下因此角度递增是屏幕顺时针），而点输入那一侧的 `angleDegrees`
 * 取 `atan2(−dy, dx)`。两者算出来的**顶点集合逐点相同**：内接的首顶点无论如何都落在落点上，
 * 而外切差的那 `±180/n` 因为 `−180/n ≡ 180/n − 360/n`、顶点又按 `360/n` 整周排布而抵消。
 *
 * 绕向取屏幕顺时针，与 `RECTANGLE` 产出的四顶点一致。它不影响任何下游——填充按 nonzero、
 * 归一化只做平移——因此这里选的是「与既有那条一致」，不是「正确」。
 *
 * 边数的产品上界（AutoCAD 的 1024）**不在这里**：那是命令自己的规则，两处各判一次迟早漂移。
 * 本函数只挡数学上无解的输入。
 *
 * @param center - 多边形中心。
 * @param through - 落点：内接时是一个顶点，外切时是一条边的中点。
 * @param sides - 边数；必须是不小于 3 的整数。
 * @param fit - 以内接圆还是外切圆为准。
 * @returns 顶点序列（屏幕顺时针）；落点与中心重合或边数无效时返回 `null`。
 * @public
 */
export function composeRegularPolygonVertices(
  center: ComposePlanarPoint,
  through: ComposePlanarPoint,
  sides: number,
  fit: ComposeRegularPolygonFit,
): readonly ComposePlanarPoint[] | null {
  if (!Number.isInteger(sides) || sides < 3) return null
  const dx = through.x - center.x
  const dy = through.y - center.y
  const distance = Math.hypot(dx, dy)
  // 半径为零画不出东西，与整圆的退化判定同一条。
  if (!(distance > 0) || !Number.isFinite(distance)) return null

  const step = 360 / sides
  const radius = fit === 'inscribed' ? distance : distance / Math.cos(Math.PI / sides)
  // 外切的落点在两个顶点正中间，因此首顶点从它转过半步。
  const first = Math.atan2(dy, dx) / TO_RADIANS + (fit === 'inscribed' ? 0 : step / 2)

  const vertices: ComposePlanarPoint[] = []
  for (let index = 0; index < sides; index += 1) {
    const radians = (first + index * step) * TO_RADIANS
    vertices.push({
      x: center.x + radius * Math.cos(radians),
      y: center.y + radius * Math.sin(radians),
    })
  }
  return vertices
}
