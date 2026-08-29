import type { ComposeCommandPoint } from '@compose-ui/commands'
import type { ComposeCurve } from '@compose-ui/core'
import type { StageRect } from '../geometry'

/**
 * 一次夹点取点。
 *
 * @remarks
 * `origin` 是夹点在**文档**里的位置，不是拖动预览里的位置：它同时是橡皮筋的起点与被排除
 * 出特征点捕捉的那一个点，而要挡的是「它出发的地方」。
 *
 * @public
 */
export interface StageGripTarget {
  readonly entityId: string
  readonly gripId: string
  readonly origin: ComposeCommandPoint
}

/**
 * 一次夹点几何变更。
 *
 * @remarks
 * 只带落点而不带算好的几何：把落点应用到夹点上要读盒与世界矩阵，那是规划那一步的事。
 * 拖动、点亮后取点与点亮后键入坐标三条路径因此汇到同一处求解。
 *
 * @public
 */
export interface StageDraftingGripEdit extends StageGripTarget {
  /** 已经过点输入管线解算的落点，世界坐标。 */
  readonly point: ComposeCommandPoint
}

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
  /**
   * 本步要创建的曲线，**世界坐标**。
   *
   * @remarks
   * 直线、弧与多段线共用这一个字段而不是各开一个：宿主对它们做的事完全一样——换算到父级
   * 局部坐标、归一化、创建 Entity。分成三个字段会让那段代码复制三遍。
   */
  readonly curves?: readonly ComposeCurve[]
  /**
   * 本步要创建的**盒**，世界坐标。
   *
   * @remarks
   * 与 `curves` 是两种意图而不是两种表示：折线表达「一段几何」，盒表达「一块有背景、边框与
   * 圆角的面积」。`RECTANGLE` 走这一条——画一个矩形外框，下一步九成是给它填色、调圆角、往里
   * 塞东西，而这些 `Curve` 全都做不到。
   *
   * **按 kind 反推是错的**：`PLINE` 画四个点按 `C` 同样得到闭合四顶点折线，而那时用户要的
   * 确实是折线。意图必须由命令显式说出。
   *
   * 引擎不认识 Preset id，只说出「这一步产出一个这么大的盒」，挑哪个物料由持有 Registry 的
   * 宿主决定——与 `wire` / `arrow` 是同一条边界。
   */
  readonly boxes?: readonly StageRect[]
  /**
   * 本步产出的曲线是**导线**。
   *
   * @remarks
   * 只是一个标记：引擎不认识端口，也不知道这条线的端点落在谁身上。绑到哪个端口由宿主按
   * **取点时记下的来源**决定——它才是那个知道「这一下点在端口上」的地方。
   */
  readonly wire?: boolean
  /**
   * 本步产出的曲线带**终点箭头**。
   *
   * @remarks
   * 与 `wire` 同形的标记：引擎不认识 Renderer props，也不认识 Preset id，只说出「这是一支
   * 箭头」，由持有 Registry 的宿主挑那个带 `markerEnd` 的 Preset。
   */
  readonly arrow?: boolean
  /** 本步要平移的既有 Entity。 */
  readonly translate?: StageDraftingTranslation
  /** 本步要复制并平移的既有 Entity。 */
  readonly duplicate?: StageDraftingTranslation
  /** 本步要删除的 Entity。 */
  readonly removed?: readonly string[]
  /**
   * 删掉本次会话**上一个建出来**的 Entity。
   *
   * @remarks
   * 引擎不认识 Entity id——它建不了也记不住。这个标记只说「把我上一段撤掉」，是哪一个由记着
   * 那份栈的宿主决定，与 `wire` / `arrow` 是同一条边界。
   */
  readonly undoLastCreated?: boolean
  /** 本步要把某个夹点挪到某个落点。 */
  readonly curveGrip?: StageDraftingGripEdit
  /**
   * 本步要让某个 Entity 进入几何编辑。
   *
   * @remarks
   * 它不是文档变更，因此不经规划：宿主直接把它转成进入会话。放进同一个效果类型里是因为
   * 「一条命令做完之后发生了什么」只该有一个出口——另开一条通道会让宿主对同一个 step
   * 消费两次。
   */
  readonly enterGeometryEditing?: string
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
  /** 产出新几何的那几条命令的分组名。 */
  readonly drawCategory: string
  /** 作用在既有对象上的那几条命令的分组名。 */
  readonly editCategory: string
  readonly specifyFirstPoint: string
  /**
   * 连续取点命令的「下一点」提示。
   *
   * @remarks
   * 只有 `LINE` 与 `PLINE` 用它，因此它 MUST 说明回车结束——AutoCAD 的提示不写这一句是因为
   * 它的用户知道，而命令行是本产品这条能力唯一的说明书。取够点自己就提交的命令不得共用它，
   * 那会让提示说一件在那里做不到的事。
   */
  readonly specifyNextPoint: string
  /** 三点弧的第三点；它是弧的端点，不是「下一点」。 */
  readonly specifyEndPoint: string
  readonly expectedPoint: string
  readonly lineTitle: string
  readonly wireTitle: string
  readonly arrowTitle: string
  readonly arcTitle: string
  readonly circleTitle: string
  readonly rectangleTitle: string
  readonly polylineTitle: string
  readonly specifyThroughPoint: string
  readonly specifyCenter: string
  readonly specifyRadius: string
  /** `CIRCLE` 打了 `D` 之后的提示。 */
  readonly specifyDiameter: string
  /** 切成直径的关键字标签。 */
  readonly diameterKeyword: string
  /** 切回半径的关键字标签。 */
  readonly radiusKeyword: string
  readonly specifyCorner: string
  readonly specifyOppositeCorner: string
  readonly closeKeyword: string
  readonly undoKeyword: string
  readonly collinearArc: string
  readonly degenerateShape: string
  readonly selectObjects: string
  readonly expectedSelection: string
  readonly basePoint: string
  readonly displacementPoint: string
  readonly moveTitle: string
  readonly copyTitle: string
  readonly eraseTitle: string
  readonly vertexTitle: string
  readonly specifyNewLocation: string
  readonly expectedSingleObject: string
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
  /**
   * 一个 Entity 能不能进入几何编辑。
   *
   * @remarks
   * 由宿主注入而不是引擎自己判断：判据要读文档（有没有 `Curve`、锁没锁），而本包的命令层
   * 不认识文档。缺席时视为全部可编辑。
   */
  readonly isGeometryEditable?: (entityId: string) => boolean
}
