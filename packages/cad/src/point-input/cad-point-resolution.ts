import type { CadInputPoint } from './cad-coordinate'

/** 网格吸附设置。 @public */
export interface CadGridSettings {
  readonly enabled: boolean
  /** 世界单位的步长；非正值视为关闭。 */
  readonly step: number
}

/** 求解一个点时可用的上下文。 @public */
export interface CadPointContext {
  /**
   * 上一个已确定的点。
   *
   * @remarks
   * 正交、相对坐标与极坐标都以它为参照；命令的第一步没有它，这三者随之不生效。
   */
  readonly reference?: CadInputPoint
  /** 正交模式是否开启。 */
  readonly ortho: boolean
  readonly grid: CadGridSettings
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
export type CadPointSource = 'pointer' | 'typed'

function applyOrtho(point: CadInputPoint, reference: CadInputPoint | undefined): CadInputPoint {
  if (!reference) return point
  const dx = point.x - reference.x
  const dy = point.y - reference.y
  // 取位移绝对值较大的轴；相等时保留水平，与 AutoCAD 一致。
  return Math.abs(dx) >= Math.abs(dy)
    ? { x: point.x, y: reference.y }
    : { x: reference.x, y: point.y }
}

function applyGrid(point: CadInputPoint, grid: CadGridSettings): CadInputPoint {
  if (!grid.enabled || !(grid.step > 0)) return point
  return {
    x: Math.round(point.x / grid.step) * grid.step,
    y: Math.round(point.y / grid.step) * grid.step,
  }
}

/**
 * 求解用户指定的一个点。
 *
 * @remarks
 * 这是一条**有序管线**，当前两级是正交与网格。对象捕捉将来作为**最高优先级的一级**插在它们
 * 之前——捕捉到端点之后不应再被网格挪走。管线形式让新增一级不必改动任何调用方。
 *
 * @param point - 原始点：指针取点时是世界坐标，键入坐标时是解析结果。
 * @param source - 点的来源；`typed` 跳过全部吸附。
 * @param context - 上一个点与各项设置。
 * @public
 */
export function resolveCadPoint(
  point: CadInputPoint,
  source: CadPointSource,
  context: CadPointContext,
): CadInputPoint {
  if (source === 'typed') return point
  return applyGrid(context.ortho ? applyOrtho(point, context.reference) : point, context.grid)
}
