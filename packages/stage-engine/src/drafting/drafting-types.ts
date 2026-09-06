import type { ComposeCommandPoint } from '@compose-ui/commands'
import type { ComposeCurve, ComposeRegularPolygonFit } from '@compose-ui/core'

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
  /**
   * 这一次取点被钉死的角度约束；缺席即跟随会话级设置。
   *
   * @remarks
   * 由宿主按**目标 Entity 的性质**给出，引擎不判断：导线只走横平竖直是那条线的规范，而本包
   * 不认识导线。它落进夹点会话的**提示**（`ComposeCommandPrompt.constrain`），与 `WIRE` 从
   * 第二个点起钉死正交走的是同一个字段、同一条解算——画线时钉住的规范在顶点模式里不该
   * 凭空消失。
   */
  readonly constrain?: 'ortho'
  /**
   * 方向与距离的参照点；缺席即 `origin`。
   *
   * @remarks
   * 正交约束、极坐标读数与橡皮筋都从它量起。拖**端点**时它该是相邻的那个顶点而不是端点自己
   * 的原位置：从原位置量，正交只能让端点沿自己出发的方向走，往另一轴一拖那一段就斜了；从
   * 相邻顶点量，那一段始终是横的或竖的——与画线时「相对上一点」逐字相同。
   *
   * `origin` 仍然是被排除出捕捉的那一个点：要挡的是端点出发的地方，与参照无关。
   */
  readonly reference?: ComposeCommandPoint
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
   * 本步产出的曲线是**导线**。
   *
   * @remarks
   * 只是一个标记：引擎不认识端口，也不知道这条线的端点落在谁身上。绑到哪个端口由宿主按
   * **取点时记下的来源**决定——它才是那个知道「这一下点在端口上」的地方。
   */
  readonly wire?: boolean
  /**
   * 本步产出的曲线是一个**矩形**。
   *
   * @remarks
   * 与 `arrow` / `wire` 是同一条边界：引擎不认识 Preset id，只说出意图，挑哪个 Preset 由
   * 持有 Registry 的宿主决定。
   *
   * **按 kind 反推是错的**：`PLINE` 画四个点按 `C` 同样得到闭合四顶点折线，而那时用户要的
   * 确实是折线——它该叫 Curve 而不是 Rectangle。意图必须由命令自己说。
   */
  readonly rectangle?: boolean
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
  readonly polygonTitle: string
  /**
   * `POLYGON` 的第一步提示，默认值印在尖括号里（`输入边数或指定中心点 <6>`）。
   *
   * @remarks
   * 默认值 MUST 出现在提示里：它是「上一次用了几条边就记住几条」这条记忆**能够成立的前提**
   * ——`CIRCLE` 的档位之所以不跨命令记忆，理由是那份状态看不见，而这个数就写在屏幕上。
   *
   * 这一步同时收点：十字光标在图面上，而「点下去什么都不会发生」是屏幕上不该出现的状态。
   */
  readonly specifySides: (sides: number) => string
  /** `POLYGON` 的中心点提示；不复用 `specifyCenter`，那一条写着「圆心」。 */
  readonly specifyPolygonCenter: (sides: number) => string
  readonly specifyInscribedRadius: (sides: number) => string
  readonly specifyCircumscribedRadius: (sides: number) => string
  /** 切成内接的关键字标签。 */
  readonly inscribedKeyword: string
  /** 切成外切的关键字标签。 */
  readonly circumscribedKeyword: string
  /**
   * 内接档在光标旁那枚胶囊里的文案。
   *
   * @remarks
   * 与关键字标签分开：关键字标签进命令行的方括号（「外切(C)」，说的是**切过去**会得到
   * 什么），胶囊说的是**此刻**是哪一档。两处同一个词会让「外切」在屏幕上同时表示当前值与
   * 目标值。它还必须短——胶囊坐在光标旁边，长文案会盖住用户正要落笔的地方。
   */
  readonly inscribedChip: string
  /** 外切档在光标旁那枚胶囊里的文案。 */
  readonly circumscribedChip: string
  /** 加一条边的关键字标签；它同时是 `Alt` + 滚轮的落点。 */
  readonly moreSidesKeyword: string
  /** 减一条边的关键字标签。 */
  readonly fewerSidesKeyword: string
  /** 边数越界或不是整数。范围由调用方传入，避免同一对界限在文案里再写一遍。 */
  readonly invalidSides: (min: number, max: number) => string
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
  /**
   * `POLYGON` 这一次的起始边数；缺省取 `COMPOSE_POLYGON_DEFAULT_SIDES`。
   *
   * @remarks
   * 由宿主持有而不由命令自己记：命令定义只是一份描述，`start` 每次产出独立会话，没有跨会话
   * 存放东西的地方。宿主把它记在**本次编辑会话**里——不写文档、不持久化，因为它是「上次怎么
   * 画的」而不是「画了什么」。
   */
  readonly polygonSides?: number
  /**
   * `POLYGON` 改变边数时回调，宿主据此更新下一次的起始值。
   *
   * @remarks
   * 键入一个数与按 `+` / `-`（滚轮走的也是这条）都会触发；边数没有真的变化时不触发。
   */
  readonly onPolygonSidesChange?: (sides: number) => void
  /**
   * `POLYGON` 这一次的起始档位；缺省取内接。
   *
   * @remarks
   * 与 `polygonSides` 同一条理由跨命令记住：原先写着「只作用于本次会话」，判据是**那份状态
   * 看不见**——用户过两天回来，同一条命令问的问题变了，而屏幕上没有东西解释为什么。档位挪到
   * 第一步、印成光标旁的胶囊之后，那条理由不再成立。
   *
   * 这一版**更需要**它：档位在第一步就定死，选错只能重来，而记住之后重来一次只需按一下
   * `Tab`。
   */
  readonly polygonFit?: ComposeRegularPolygonFit
  /** `POLYGON` 换档时回调，宿主据此更新下一次的起始值。 */
  readonly onPolygonFitChange?: (fit: ComposeRegularPolygonFit) => void
}
