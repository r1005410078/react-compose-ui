import type { ComposeCommandPoint } from '@compose-ui/commands'
import type { EditorCommand } from '@compose-ui/core'

/** CAD 命令启动时可读的上下文。 @public */
export interface CadCommandContext {
  /** 新图元落在哪个图层。 */
  readonly layerId: string
  /** 生成稳定 Entity 与命令 ID。 */
  readonly idFactory: () => string
  /**
   * 启动当刻的选择集。
   *
   * @remarks
   * 「先选后执行」靠的就是它：编辑类命令在这里拿到非空选择时直接干活，不再提示选择对象。
   */
  readonly selection: readonly string[]
  /** 已本地化的命令提示文案。 */
  readonly messages: CadCommandMessages
}

/** CAD 命令用到的提示文案。 @public */
export interface CadCommandMessages {
  readonly specifyFirstPoint: string
  readonly specifyNextPoint: string
  readonly keywordUndo: string
  readonly keywordFinish: string
  readonly expectedPoint: string
  readonly lineTitle: string
  readonly eraseTitle: string
  readonly selectObjects: string
  readonly expectedSelection: string
}

/**
 * 一次命令执行的产出，预览与提交共用一种形状。
 *
 * @remarks
 * 做成一个各字段可选的结构而不是判别联合，是因为宿主对效果只做三件互相独立的事：画预览、
 * 派发命令、剔除选择集。每条命令给出自己有的那几个字段，宿主读它认识的——加一条新命令不必
 * 让宿主先学会判别它。
 *
 * `command` 是**一个** batch：一次命令产生的多个文档改动属于同一次操作，逐个撤销会让用户按
 * N 次撤销才回到命令之前。
 *
 * @public
 */
export interface CadCommandEffect {
  /** 提交时派发的命令；预览阶段为 `null`。 */
  readonly command: EditorCommand | null
  /** 已确定的线段；绘制类命令进行中即可用于预览。 */
  readonly segments?: readonly {
    readonly start: ComposeCommandPoint
    readonly end: ComposeCommandPoint
  }[]
  /**
   * 后续相对输入的参照点，即最近一个已确定的顶点。
   *
   * @remarks
   * 由会话给出而不是让宿主记住自己送进来的最后一个点：「放弃」会退回上一个顶点，宿主自行
   * 记账会与会话失步，随后的正交与相对坐标全部以错误的点为基准。
   */
  readonly reference?: ComposeCommandPoint
  /**
   * 本次提交删除的 Entity。
   *
   * @remarks
   * 宿主据此把它们从选择集里剔除——留下来会指向不存在的 Entity，随后任何以选择集为输入的
   * 命令都会拿到幽灵目标。
   */
  readonly removed?: readonly string[]
}
