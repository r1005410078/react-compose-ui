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
  /** 正交模式是否开启。 */
  readonly ortho: boolean
  readonly grid: ComposeGridSettings
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

function applyOrtho(
  point: ComposeInputPoint,
  reference: ComposeInputPoint | undefined,
): ComposeInputPoint {
  if (!reference) return point
  const dx = point.x - reference.x
  const dy = point.y - reference.y
  // 取位移绝对值较大的轴；相等时保留水平，与 AutoCAD 一致。
  return Math.abs(dx) >= Math.abs(dy)
    ? { x: point.x, y: reference.y }
    : { x: reference.x, y: point.y }
}

function snapAxis(value: number, step: number) {
  return step > 0 ? Math.round(value / step) * step : value
}

function applyGrid(point: ComposeInputPoint, grid: ComposeGridSettings): ComposeInputPoint {
  if (!grid.enabled) return point
  return { x: snapAxis(point.x, grid.stepX), y: snapAxis(point.y, grid.stepY) }
}

/**
 * 求解用户指定的一个点。
 *
 * @remarks
 * 这是一条**有序管线**：对象捕捉 > 正交 > 网格，另有「键入的坐标跳过全部吸附」这条总闸。
 * 新增一级只需在这里插一句并给上下文加一个字段，调用方不必改动——捕捉正是这样加进来的。
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
  if (source === 'typed') return point
  if (context.snapped) return context.snapped
  return applyGrid(context.ortho ? applyOrtho(point, context.reference) : point, context.grid)
}
