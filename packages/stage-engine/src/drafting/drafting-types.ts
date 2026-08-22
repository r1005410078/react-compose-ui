import type { ComposeCommandPoint } from '@compose-ui/commands'

/** 一段已定下来的线。 @public */
export interface StageDraftingSegment {
  readonly start: ComposeCommandPoint
  readonly end: ComposeCommandPoint
}

/**
 * 绘图命令的效果。
 *
 * @remarks
 * **引擎不创建 Entity 也不铸 ID**，与 `drawing.commit` 是同一条既有规矩：这里只给出世界
 * 坐标，由持有 Registry 的宿主决定用哪个 Preset、落在哪个父级。
 *
 * `preview` 与 `commit` 两个位置共用本类型：前者是还没落进文档、用来画橡皮筋的几何，后者
 * 是本步要创建的几何。
 *
 * @public
 */
export interface StageDraftingEffect {
  /** 本步涉及的线段。 */
  readonly segments: readonly StageDraftingSegment[]
  /**
   * 上一个已确定的点。
   *
   * @remarks
   * 宿主拿它做三件事：橡皮筋起点、正交约束的参照、相对与极坐标的参照。没有它时这三者
   * 都不生效。
   */
  readonly reference?: ComposeCommandPoint
}

/** 绘图命令的已本地化文案。 @public */
export interface StageDraftingMessages {
  readonly specifyFirstPoint: string
  readonly specifyNextPoint: string
  readonly expectedPoint: string
  readonly lineTitle: string
}

/**
 * 启动一条绘图命令时的上下文。
 *
 * @remarks
 * 刻意只有文案：命令会话是纯状态机，落点父级、Preset 与 ID 全部由宿主在消费效果时决定。
 * 让会话认识这些，等于把「引擎不创建 Entity」这条既有边界撕开一个口子。
 *
 * @public
 */
export interface StageDraftingContext {
  readonly messages: StageDraftingMessages
}
