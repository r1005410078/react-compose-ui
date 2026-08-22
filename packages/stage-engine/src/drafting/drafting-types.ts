import type { ComposeCommandPoint } from '@compose-ui/commands'

/** 一段已定下来的线。 @public */
export interface StageDraftingSegment {
  readonly start: ComposeCommandPoint
  readonly end: ComposeCommandPoint
}

/** 一次针对既有 Entity 的平移。 @public */
export interface StageDraftingTranslation {
  readonly entityIds: readonly string[]
  readonly delta: ComposeCommandPoint
}

/**
 * 绘图命令的效果。
 *
 * @remarks
 * 描述的是**本步产出的变更**而不是几何：绘图模式除了画线还要能搬、能复制、能删，而这三者
 * 产出的不是新几何。字段各自可选，一步只填自己产出的那一种。
 *
 * **引擎不创建 Entity 也不铸 ID**，与 `drawing.commit` 是同一条既有规矩：这里只给出世界
 * 坐标与目标标识，由持有 Registry 的宿主决定用哪个 Preset、落在哪个父级、铸什么 ID。
 *
 * `preview` 与 `commit` 两个位置共用本类型：前者是还没落进文档、用来画橡皮筋与轮廓的内容，
 * 后者是本步要提交的变更。
 *
 * @public
 */
export interface StageDraftingEffect {
  /** 本步要创建的线段。 */
  readonly segments?: readonly StageDraftingSegment[]
  /** 本步要平移的既有 Entity。 */
  readonly translate?: StageDraftingTranslation
  /** 本步要复制并平移的既有 Entity。 */
  readonly duplicate?: StageDraftingTranslation
  /** 本步要删除的 Entity。 */
  readonly removed?: readonly string[]
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
  readonly selectObjects: string
  readonly expectedSelection: string
  readonly basePoint: string
  readonly displacementPoint: string
  readonly moveTitle: string
  readonly copyTitle: string
  readonly eraseTitle: string
}

/**
 * 启动一条绘图命令时的上下文。
 *
 * @remarks
 * 只有文案与启动当刻的选择集：命令会话是纯状态机，落点父级、Preset 与 ID 全部由宿主在消费
 * 效果时决定。让会话认识这些，等于把「引擎不创建 Entity」这条既有边界撕开一个口子。
 *
 * `selection` 支持「先选后执行」——命令要么在启动上下文里拿到目标，要么自己提示选择，
 * 两条次序因此共用同一条状态机。
 *
 * @public
 */
export interface StageDraftingContext {
  readonly messages: StageDraftingMessages
  /** 启动当刻的选择集；缺省视为空。 */
  readonly selection?: readonly string[]
}
