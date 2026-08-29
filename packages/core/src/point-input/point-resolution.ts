import type { ComposeInputPoint } from './coordinate'

/**
 * 网格吸附设置。
 *
 * @remarks
 * 两轴各有步长：页面画布的网格本来就允许 X 与 Y 不同，写成单一步长会在两者不等时把一个轴
 * 吸到错误的位置。等步的网格把两个字段填同一个值即可。
 *
 * @public
 */
export interface ComposeGridSettings {
  readonly enabled: boolean
  /** X 轴世界单位步长；非正值视为该轴关闭。 */
  readonly stepX: number
  /** Y 轴世界单位步长；非正值视为该轴关闭。 */
  readonly stepY: number
}

/**
 * 角度约束的三态。
 *
 * @remarks
 * 三者**互斥**：它们回答的是同一个问题——这一步的方向怎么被约束。做成两个独立布尔会造出一个
 * 「都开」的第四态，而那一态没有正确答案。AutoCAD 同样互斥。
 *
 * **正交与极轴的差别只有一处：正交无条件投影，极轴只在容差内投影。** 这一处差别决定了各自的
 * 默认值——正交默认必须关（否则画不了斜线），极轴默认可以开（它不挡任何画法）。
 *
 * @public
 */
export type ComposeAngleConstraint = 'off' | 'ortho' | 'polar'

/**
 * 极轴追踪的设置。
 *
 * @remarks
 * `increment` 是**增量角**：射线成族生成（0、增量、2×增量…）。AutoCAD 另有一张「附加角」表
 * ——填 `37` 只追踪 37° 这一个方向，不给 74°、也不给对面的 217°。**一族与一条**的区别真实
 * 且有用，但眼下没有消费者，因此本类型只有增量角。
 *
 * `tolerance` 是**落点到射线的距离**（世界单位，由宿主按缩放从屏幕像素换算），不是角度差：
 * 角度容差在远处会失控——离参考点 500 单位时 ±3° 就是 ±26 单位的捕捉带，用户想画 87° 会被
 * 拽到 90°。距离容差恒定，远处反而更精确，而近处所有射线本来就几乎重合。
 *
 * @public
 */
export interface ComposePolarSettings {
  /** 增量角，度；非正值视为关闭追踪。 */
  readonly increment: number
  /** 命中容差，世界单位。 */
  readonly tolerance: number
}

/** 求解一个点时可用的上下文。 @public */
export interface ComposePointContext {
  /**
   * 对象捕捉命中的特征点。
   *
   * @remarks
   * 管线中**优先级最高**：命中时结果就是它，不再经过正交与网格——捕捉到端点之后再被网格挪走，
   * 等于捕捉没发生。由宿主求解后传入而不是在这里查文档：宿主本来就要拿它渲染捕捉标记，
   * 让本函数保持无依赖的纯计算。
   */
  readonly snapped?: ComposeInputPoint
  /**
   * 上一个已确定的点。
   *
   * @remarks
   * 正交、相对坐标与极坐标都以它为参照；命令的第一步没有它，这三者随之不生效。
   */
  readonly reference?: ComposeInputPoint
  /**
   * 角度约束；缺省视为关闭。
   *
   * @remarks
   * 没有 `reference` 时不生效——没有上一个点就没有方向可言，每条命令的第一步都是这种情形。
   */
  readonly angle?: ComposeAngleConstraint
  /** 极轴设置；`angle` 不是 `polar` 时忽略。 */
  readonly polar?: ComposePolarSettings
  readonly grid: ComposeGridSettings
}

/**
 * 一次角度约束的结果。
 *
 * @remarks
 * 带上**命中了哪条射线**：呈现层据此画追踪射线，两处读同一份答案。各判一次的症状是「画了
 * 射线但点没落在上面」。
 *
 * @public
 */
export interface ComposeAngleConstraintResult {
  readonly point: ComposeInputPoint
  /**
   * 命中射线的角度（度，逆时针为正）；没有命中时为 `null`。
   *
   * @remarks
   * 正交命中时也有值（0 或 90 的倍数）——它无条件投影，因此只要有参考点就总是命中。
   */
  readonly ray: number | null
}

/**
 * 点的来源。
 *
 * @remarks
 * 来源决定后续各级是否生效：**键入的坐标是精确值，不再被任何吸附改写**。用户打了 `100,50`
 * 却落在 `96,48`，是这类工具里最难排查的一种缺陷——它看起来像浮点误差，实际是流程错误。
 *
 * @public
 */
export type ComposePointSource = 'pointer' | 'typed'

const RADIANS_PER_DEGREE = Math.PI / 180

/**
 * 正交：把点无条件钳到相对参考点的水平或竖直方向。
 *
 * @remarks
 * **无条件**是它与极轴唯一的实质差别，也是它默认必须关掉的原因——一开就画不了斜线。
 *
 * 取位移绝对值较大的轴；相等时保留水平，与 AutoCAD 一致。射线角度按屏幕 Y 轴向下的约定，
 * 向上是 +90。
 */
function applyOrtho(
  point: ComposeInputPoint,
  reference: ComposeInputPoint,
): ComposeAngleConstraintResult {
  const dx = point.x - reference.x
  const dy = point.y - reference.y
  if (Math.abs(dx) >= Math.abs(dy)) {
    return { point: { x: point.x, y: reference.y }, ray: dx < 0 ? 180 : 0 }
  }
  return { point: { x: reference.x, y: point.y }, ray: dy > 0 ? -90 : 90 }
}

function snapAxis(value: number, step: number) {
  return step > 0 ? Math.round(value / step) * step : value
}

function applyGrid(point: ComposeInputPoint, grid: ComposeGridSettings): ComposeInputPoint {
  if (!grid.enabled) return point
  return { x: snapAxis(point.x, grid.stepX), y: snapAxis(point.y, grid.stepY) }
}

/** 把点投影到从 `reference` 出发、角度为 `degrees` 的那条射线上。 */
function projectOntoRay(
  point: ComposeInputPoint,
  reference: ComposeInputPoint,
  degrees: number,
): ComposeInputPoint {
  const radians = degrees * RADIANS_PER_DEGREE
  // 屏幕 Y 轴向下，因此方向向量的 y 取负——与 `距离<角度` 的坐标写法同一套约定。
  const ux = Math.cos(radians)
  const uy = -Math.sin(radians)
  const t = (point.x - reference.x) * ux + (point.y - reference.y) * uy
  return { x: reference.x + t * ux, y: reference.y + t * uy }
}

/**
 * 极轴：按增量角求最近的那条射线，只有落点到它的距离在容差内才投影。
 *
 * @remarks
 * 射线是**双向**的：0° 与 180° 是同一条直线的两半，而增量角整除 360，因此按增量取整就已经
 * 把两个方向都覆盖了——不需要再对反向单独判一次。
 */
function applyPolar(
  point: ComposeInputPoint,
  reference: ComposeInputPoint,
  polar: ComposePolarSettings,
): ComposeAngleConstraintResult {
  const dx = point.x - reference.x
  const dy = point.y - reference.y
  if (polar.increment <= 0 || (dx === 0 && dy === 0)) return { point, ray: null }
  const degrees = Math.atan2(-dy, dx) / RADIANS_PER_DEGREE
  const ray = Math.round(degrees / polar.increment) * polar.increment
  const projected = projectOntoRay(point, reference, ray)
  const distance = Math.hypot(point.x - projected.x, point.y - projected.y)
  // 够不着就完全自由——这正是极轴敢默认开着、而正交不敢的那一处差别。
  if (distance > polar.tolerance) return { point, ray: null }
  return { point: projected, ray }
}

/**
 * 求解角度约束这一级。
 *
 * @remarks
 * 单独导出是因为呈现层要拿到 `ray` 去画追踪射线，而 {@link resolveComposePoint} 只返回点。
 * 两者 MUST 读同一份实现，各算一遍的症状是「画了射线但点没落在上面」。
 *
 * @public
 */
export function applyComposeAngleConstraint(
  point: ComposeInputPoint,
  context: ComposePointContext,
): ComposeAngleConstraintResult {
  const { angle, reference } = context
  // 没有上一个点就没有方向可言；每条命令的第一步都是这种情形。
  if (!reference || !angle || angle === 'off') return { point, ray: null }
  if (angle === 'ortho') return applyOrtho(point, reference)
  return context.polar ? applyPolar(point, reference, context.polar) : { point, ray: null }
}

/**
 * 求解用户指定的一个点。
 *
 * @remarks
 * 这是一条**有序管线**：对象捕捉 > 网格 > 角度约束，另有「键入的坐标跳过全部吸附」这条
 * 总闸。新增一级只需在这里插一句并给上下文加一个字段，调用方不必改动——捕捉正是这样加进来的。
 *
 * **角度约束是最后一步。** 理由与「捕捉命中即短路」逐字相同：网格把刚约束到 45° 上的点挪走，
 * 等于约束没发生。沿射线的位置因此是网格点在射线上的**投影**——斜射线上不落在格点上，这是
 * 对的，那个方向上本来就没有格点，而长度有动态输入可以精确给出。
 *
 * 这个次序同时修掉正交的一处静默缺陷：先正交后网格时，已经钉在 `reference.y` 上的那个分量
 * 会被再取整一次，参考点不在格点上时点就被挪离了正交线。
 *
 * 指针取点与键入坐标共用本实现：两份实现的分叉症状是「键盘画的和鼠标画的落点不一样」，
 * 而用户无法判断哪一个才是对的。
 *
 * @param point - 原始点：指针取点时是世界坐标，键入坐标时是解析结果。
 * @param source - 点的来源；`typed` 跳过全部吸附。
 * @param context - 上一个点与各项设置。
 * @public
 */
export function resolveComposePoint(
  point: ComposeInputPoint,
  source: ComposePointSource,
  context: ComposePointContext,
): ComposeInputPoint {
  return resolveComposePointDetail(point, source, context).point
}

/**
 * 求解一个点，并带上角度约束命中的那条射线。
 *
 * @remarks
 * 与 {@link resolveComposePoint} 是**同一份实现**的两种形状：后者只是丢掉 `ray`。呈现层要画
 * 追踪射线，因此需要这一份；两处各算一遍的症状是「画了射线但点没落在上面」。
 *
 * 键入的坐标与对象捕捉短路整条管线，因此那两种情形下 `ray` 恒为 `null`——它们不是角度约束
 * 产出的。
 *
 * @public
 */
export function resolveComposePointDetail(
  point: ComposeInputPoint,
  source: ComposePointSource,
  context: ComposePointContext,
): ComposeAngleConstraintResult {
  if (source === 'typed') return { point, ray: null }
  if (context.snapped) return { point: context.snapped, ray: null }
  return applyComposeAngleConstraint(applyGrid(point, context.grid), context)
}
