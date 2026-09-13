import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent } from 'react'
import {
  COMPOSE_SNAP_RADIUS,
  applyComposeFieldOverride,
  composeCurveSegments,
  composePointToFields,
  formatComposeNumber,
  getComposeCurve,
  isComposeSingleFieldKind,
  projectComposeCurveToBox,
  parseComposeCoordinate,
  resolveComposePoint,
  resolveComposePointDetail,
  type ComposeCurve,
  type ComposeDocument,
  type ComposeInputPoint,
  type ComposeAngleConstraint,
  type ComposeLayoutSnapshot,
  type ComposePointFieldIndex,
  type ComposePointFieldKind,
  type ComposeRegularPolygonFit,
  type ComposeWireBinding,
} from '@compose-ui/core'
import {
  createComposeCommandRegistry,
  runComposeCommandImmediately,
  type ComposeCommandDefinition,
  type ComposeCommandSession,
} from '@compose-ui/commands'
import type { ComposeEntityRegistry } from '@compose-ui/component-registry'
import {
  applyMatrix,
  COMPOSE_POLYGON_DEFAULT_SIDES,
  createStageDraftingCommands,
  createStageGripSession,
  collectStageRevealedPorts,
  findStageFeaturePoint,
  planStageDraftingEdits,
  worldToScreen,
  type StageDraftingContext,
  type StageDraftingEffect,
  type StageDraftingMessages,
  type StageFeaturePoint,
  type StageGripTarget,
  type StagePoint,
  type StageRect,
  type StageSceneIndex,
  type StageViewport,
} from '@compose-ui/stage-engine'
import { isEditableTarget } from '../stage-surface/keyboard'
import { resolveStageDynamicInput, resolveStageDynamicInputPrompt } from './dynamic-input'
import type { ComposeStageDispatch } from '../types'
import {
  anchorKey,
  createStageDraftingCurveCommand,
  wireBindingsFor,
  wireTapsFor,
} from './drafting-entity'
import { planStageHatch, stageHatchPreviewRings } from './hatch-plan'
import { isStageJunctionEntity, isStageWireEntity } from './wire-tap'
import {
  resolveStageHatchRegion,
  resolveStageTrailTargets,
  resolveStageTrimPiece,
  type StageTrimPiece,
  type StageHatchRejection,
  type StageTrimRejection,
} from '@compose-ui/stage-engine'
import {
  COMPOSE_CURVE_PICK_TOLERANCE,
  COMPOSE_DEFAULT_HATCH_COLOR,
  getComposeRenderer,
  isComposeFrameEntity,
} from '@compose-ui/core'
import type { StageWireTapAnchor } from './wire-tap'

/** 绘图模式需要的额外文案。 @internal */
export interface StageDraftingHookMessages extends StageDraftingMessages {
  readonly ready: string
  readonly commandLineLabel: string
  readonly commandPlaceholder: string
  readonly keywordsPrefix: string
  readonly unknownCommand: string
  readonly cancelled: string
  /** 角度约束的三个状态标签；三态都要渲染。 */
  readonly angleOrtho: string
  readonly anglePolar: string
  readonly angleOff: string
  readonly snapOn: string
  readonly snapOff: string
  /** 夹点几何变更的撤销标签。 */
  readonly editGeometry: (name: string) => string
  /** 端口与线段不在同一父级、因此没能绑上时的说明。 */
  readonly wireParentMismatch: string
  /** 一次接线的历史标签；它产出建节点、断线与改绑三条命令。 */
  readonly wireTap: string
  /** 一次镜像的历史标签；整棵子树的几何、翻转与位置共享它，撤销一步全部回来。 */
  readonly mirrorLabel: string
  /** 一次对齐或分布的历史标签。 */
  readonly alignLabel: string
  /** 一次修剪的历史标签。 */
  readonly trimLabel: (name: string) => string
  /** 修剪被拒绝时的说明；六种原因六句，互不相同。 */
  readonly trimRejection: (reason: StageTrimRejection) => string
  /** 给一个已有形状填色的历史标签——这一支改的是它，因此标签要说出是谁。 */
  readonly hatchFillLabel: (name: string) => string
  /** 填充被拒绝时的说明；三种原因三句，互不相同。 */
  readonly hatchRejection: (reason: StageHatchRejection) => string
}

/** {@link useStageDrafting} 的输入。 @internal */
export interface StageDraftingOptions {
  readonly enabled: boolean
  /**
   * 填充色的起始值；缺席取 {@link COMPOSE_DEFAULT_HATCH_COLOR}。
   *
   * @remarks
   * 宿主给了就由宿主持有（工具栏的色板要画出当前色，事实来源只能有一份），不给则 Stage 自己
   * 持有——`stage` 是可独立嵌入的包，不能要求每个宿主都接一个工具栏。与角度约束同一条。
   */
  readonly hatchColor?: string
  /** 命令进行中用 `C` 换了色时回调；宿主据此更新色板。 */
  readonly onHatchColorChange?: (color: string) => void
  readonly document: ComposeDocument
  readonly layoutSnapshot: ComposeLayoutSnapshot
  readonly viewport: StageViewport
  readonly registry: ComposeEntityRegistry
  readonly dispatch: ComposeStageDispatch
  readonly idFactory: () => string
  readonly messages: StageDraftingHookMessages
  /**
   * 宿主注入的命令定义。
   *
   * @remarks
   * 与内建八条合成一份注册表。重名由 `createComposeCommandRegistry` 抛错，本 Hook 不兜底。
   */
  readonly commands?: readonly ComposeCommandDefinition<
    StageDraftingContext,
    StageDraftingEffect
  >[]
  readonly activeFrameId?: string | null
  /** 当前选择集；命令的「先选后执行」与「选择对象」步骤都读它。 */
  readonly selectedIds: readonly string[]
  readonly onSelectedIdsChange: (ids: readonly string[]) => void
  /** 捕捉的屏幕半径（CSS 像素）。 @defaultValue {@link COMPOSE_SNAP_RADIUS} */
  readonly snapRadius?: number
  /**
   * `pick` 的拾取框半边长（CSS 像素）。
   *
   * @remarks
   * 与点选那一档同一个数：`pick` 的命中读的正是这个容差。
   *
   * @defaultValue {@link COMPOSE_CURVE_PICK_TOLERANCE}
   */
  readonly pickRadius?: number
  /**
   * 角度约束；给出即受控，由宿主持有。
   *
   * @remarks
   * 工具栏要画按下态，而事实来源只能有一份——Stage 记一份、工具栏记一份必然漂移。不给时
   * 由 Stage 自己持有（默认极轴）：`stage` 是可独立嵌入的包，不能要求每个宿主都接一个工具栏。
   */
  readonly angleConstraint?: ComposeAngleConstraint
  readonly onAngleConstraintChange?: (next: ComposeAngleConstraint) => void
  /** 极轴的增量角（度）。 @defaultValue 45 */
  readonly polarIncrement?: number
  /**
   * 场景索引；由宿主建一份给命令与几何编辑共用。
   *
   * @remarks
   * 由外面注入而不是本 Hook 自建，只为一件事：几何编辑要把正在编辑的 Entity 从捕捉里排除，
   * 而那个会话又要读本 Hook 的落点解算。两个 Hook 因此不能都自建索引，也不能互为前提。
   */
  readonly index: StageSceneIndex
  /**
   * 不参与特征点捕捉的 Entity。
   *
   * @remarks
   * 几何编辑期间传入正在被编辑的那一个：它自己的端点就在指针底下，不排除的话夹点会被吸回
   * 原处，用户要把指针拖出容差半径才动得了。悬停标记与落点解算读同一份排除表，因此不会
   * 出现「标记在这里、点落在那里」。
   */
  readonly snapExcludedIds?: readonly string[]
  /**
   * 让某个 Entity 进入几何编辑。
   *
   * @remarks
   * `VERTEX` 命令的效果由此落地。它不是文档变更，因此不经 `planStageDraftingEdits`——会话
   * 归 Stage 自己，命令只是它的第二个入口。
   */
  readonly onEnterGeometryEditing?: (entityId: string) => void
  /**
   * 一个 Entity 能不能进入几何编辑；注入给 `VERTEX` 的启动上下文。
   *
   * @remarks
   * 引擎不读文档，判据因此由这里给出。缺席时视为全部可编辑。
   */
  readonly isGeometryEditable?: (entityId: string) => boolean
}


/**
 * 极轴的默认增量角。
 *
 * @remarks
 * 这是对 AutoCAD 默认值（90°）的**有意偏离**，理由是前提不同：AutoCAD 的极轴默认是关的，
 * 我们默认是开的。默认开着时增量角要覆盖用户真会画的方向，而 90° 漏掉的正是接线图上那条
 * 斜引线；45° 只多四条射线，容差是几个屏幕像素，误吸的代价很小。
 */
const DEFAULT_POLAR_INCREMENT = 45

/** 稳定引用的空排除表：每帧新建数组会让捕捉的记忆化整片失效。 */
const EMPTY_EXCLUSIONS: readonly string[] = []

/**
 * 裸数字：直接距离输入与「正在键入时预览跟着走」共用同一条判据。
 *
 * @remarks
 * 两处各写一份的症状是「预览跟着变了、回车却按坐标解析」——同一段文本在两条路径上被读成
 * 两种东西，而屏幕上没有任何线索。
 */
/**
 * 修饰键滚轮走一格所需的量，按 `deltaMode` 分档。
 *
 * @remarks
 * 取的是**一次鼠标滚轮刻度**——那正是手感上的「一格」。浏览器把它报成两种量纲：像素模式下
 * 一刻度是 100～120 像素（Chrome / Safari），行模式下是 3 行（Firefox）。
 *
 * 这是本仓库少有的魔法阈值，而它躲不掉：wheel 事件本身没有「一格」的语义，而触控板的一次
 * 两指滑动会发出几十个小 delta——一个事件一格会让边数从 6 冲到 60。取一次刻度的量至少让它
 * 有来源，也让触控板的一次滑动给出几格而不是几十格。
 */
const WHEEL_NOTCH: Readonly<Record<number, number>> = { 0: 100, 1: 3, 2: 1 }

const BARE_NUMBER = /^-?\d+(\.\d+)?$/

/**
 * 绘图模式的命令会话。
 *
 * @remarks
 * 会话状态住在 Stage 而不是宿主：提示文本、橡皮筋预览与捕捉标记是同一份状态的三种呈现，
 * 交给宿主渲染意味着要把这三样逐帧回传，凭空造出一个跨包协议。
 *
 * 指针取点与键入坐标**走同一条点输入管线**：两条路径分叉的症状是「键盘画的和鼠标画的落点
 * 不一样」，而用户无法判断哪一个才是对的。
 *
 * @internal
 */
/**
 * 一条曲线的顶点数；弧与 `path` 没有这个数。
 *
 * @remarks
 * 只服务「Entity 还在、但被改小了」那一档的判定，因此拿不出确切顶点数时返回 `undefined`
 * 而不是 0——0 会让任何一次文档变化都被读成「它被撤销了一整条」。
 */
function composeCurveVertexCount(curve: ComposeCurve): number | undefined {
  if (curve.kind === 'line') return 2
  if (curve.kind === 'polyline') return curve.vertices.length
  return undefined
}

export function useStageDrafting(options: StageDraftingOptions) {
  const {
    enabled,
    document,
    layoutSnapshot,
    viewport,
    registry,
    dispatch,
    idFactory,
    messages,
    commands: hostCommands,
    activeFrameId,
    selectedIds,
    onSelectedIdsChange,
    snapRadius = COMPOSE_SNAP_RADIUS,
    pickRadius = COMPOSE_CURVE_PICK_TOLERANCE,
    angleConstraint: controlledAngle,
    onAngleConstraintChange,
    polarIncrement = DEFAULT_POLAR_INCREMENT,
    snapExcludedIds,
    index,
    onEnterGeometryEditing,
    isGeometryEditable,
    hatchColor,
  } = options

  const sessionRef = useRef<ComposeCommandSession<StageDraftingEffect> | null>(null)
  /** 本次命令里落在端口上的取点；键是解算后的世界坐标。 */
  const portAnchors = useRef(new Map<string, ComposeWireBinding>())
  /*
   * 落在**另一条导线**上的那些取点。与端口锚点分成两张表：端口那一头已经是可绑的目标，
   * 线身这一头还要先把节点建出来。一次取点只可能落进其中一张——捕捉给出的候选只有一个。
   */
  const wireAnchors = useRef(new Map<string, StageWireTapAnchor>())
  /** 上一条成功启动的命令 id；空闲时的空确认按它重启。取消过的命令仍算数。 */
  const lastCommandRef = useRef<string | null>(null)
  const [prompt, setPromptState] = useState<ComposeCommandSession<StageDraftingEffect>['prompt']>(null)
  /**
   * 会话推进过的次数。
   *
   * @remarks
   * 预览几何是「会话内部状态 + 光标落点」的函数，而会话住在 ref 里、它的内部状态在
   * `advance` 里就地变化——React 看不见那次变化，因此需要一个显式的代次来触发重算。
   *
   * 它**不是**可派生状态的重复：`prompt` 今天恰好每步都换一个新对象，但那是各条命令各自的
   * 实现细节，依赖它等于把一条跨包的隐含约定当接口用。
   */
  const [sessionRevision, setSessionRevision] = useState(0)
  /** 所有改会话状态的地方都走这里，代次因此不可能与会话漂移。 */
  const setPrompt = useCallback((next: ComposeCommandSession<StageDraftingEffect>['prompt']) => {
    setPromptState(next)
    setSessionRevision((revision) => revision + 1)
  }, [])
  const [notice, setNotice] = useState<string | null>(null)
  const [reference, setReference] = useState<ComposeInputPoint | null>(null)
  const [preview, setPreview] = useState<StageDraftingEffect | null>(null)
  /** 一笔 `pick` 拖动中的轨迹，世界坐标；不在拖动时为 `null`。由取点插件逐帧回传。 */
  const [pickTrail, setPickTrail] = useState<readonly StagePoint[] | null>(null)
  /**
   * 上一次填充没能闭合时那些自由端的位置，世界坐标。
   *
   * @remarks
   * 它**不跟着光标走**：记号回答的是「这张图上哪里少了一段」，而用户读到它之后要把光标挪开去
   * 找那条缝。下一次落点时整份换掉，退出命令时清空。
   */
  const [hatchGaps, setHatchGaps] = useState<readonly StagePoint[]>([])
  /**
   * 这一次的填充色。
   *
   * @remarks
   * 记在**本次编辑会话**里，不写文档、不写偏好——与 `POLYGON` 的边数同一条判据：合法性不在方
   * 不方便，在**值有没有被印出来**，而桶身就印着它。两条入口：工具栏的色板与命令进行中的 `C`。
   *
   * 它是**真的 React 状态而不是 ref**：桶身徽标与悬停预览都在渲染期读它，而 ref 在渲染期读
   * 不到更新。这与「悬停态是纯 CSS、不为一个视觉反馈引入每帧要写的状态」不冲突——那条拦的是
   * 每帧 `pointermove` 都要写的东西，而颜色每填几次才动一次。
   *
   * **可选受控**：宿主给了就由宿主持有（工具栏的色板要画出当前色，事实来源只能有一份），
   * 不给则 Stage 自己持有，与角度约束同一条。
   */
  const [ownHatchColor, setOwnHatchColor] = useState(COMPOSE_DEFAULT_HATCH_COLOR)
  const activeHatchColor = hatchColor ?? ownHatchColor
  const [pointer, setPointerPoint] = useState<StagePoint | null>(null)
  // 指针类型只服务触摸豁免：触摸屏上没有光标，十字光标对它毫无意义，而这个判断只有事件
  // 本身知道。
  const [pointerType, setPointerType] = useState('mouse')
  const setPointer = useCallback((point: StagePoint | null, type = 'mouse') => {
    setPointerPoint(point)
    setPointerType(type)
  }, [])
  /**
   * 角度约束；宿主给了 `angleConstraint` 就以宿主那份为准。
   *
   * @remarks
   * **默认极轴**：它只在光标靠近某条射线时才吸，因此不挡任何画法，可以默认开着；而只有默认
   * 开着，最常用的那个约束才真的被用上。正交不能默认开——它无条件投影，一开就画不了斜线。
   */
  const [uncontrolledAngle, setUncontrolledAngle] = useState<ComposeAngleConstraint>('polar')
  const angleConstraint = controlledAngle ?? uncontrolledAngle
  const setAngleConstraint = useCallback((next: ComposeAngleConstraint) => {
    setUncontrolledAngle(next)
    onAngleConstraintChange?.(next)
  }, [onAngleConstraintChange])
  /** 按下已经生效的那一个即关闭——三态互斥，两个键是同一个单选组的两个成员。 */
  const toggleAngleConstraint = useCallback((mode: 'ortho' | 'polar') => {
    setAngleConstraint(angleConstraint === mode ? 'off' : mode)
  }, [angleConstraint, setAngleConstraint])
  const [snapEnabled, setSnapEnabled] = useState(true)
  /**
   * 正在被夹点会话作用的那个夹点；没有会话时为 `null`。
   *
   * @remarks
   * 拖动与点亮共用它，因此「拾取框画不画」「哪个夹点是热的」「排除哪个点」三处读的是同一份
   * 事实。分成「正在拖的」与「已点亮的」两份状态时，三处必然有一处漏掉其中一种情形。
   */
  const [gripTarget, setGripTarget] = useState<StageGripTarget | null>(null)
  /**
   * 正在跑的那条命令的 id；没有命令在跑时为 `null`。
   *
   * @remarks
   * 宿主的工具栏按下态读它。**事实来源必须在这里**：命令会被 `Escape`、被并发文档变化、
   * 被另一条命令取代而结束，工具栏自己记的那一份只会停在过去。
   *
   * 夹点会话不算：它由手势启动而不由词启动，没有名字可报。
   */
  const [activeCommandId, setActiveCommandId] = useState<string | null>(null)
  /**
   * 动态输入：活动字段、两个字段的锁定值、命令行里正在键入的那段文本。
   *
   * @remarks
   * 缓冲**不在这里**——它住在命令行组件里，这里只是它上报过来的一份镜像，用来渲染进活动
   * 字段的框。命令行仍是唯一的输入端：把框做成真的 `<input>` 会撞上「启动之后焦点交给命令行」
   * 那条既有约定，而且命令由工具栏按钮启动时指针位置还未知，那一刻根本没有框可以聚焦。
   *
   * 三者都描述**当前这一步**，因此取到一个点就要清空——`resetFields` 是唯一的清空入口。
   */
  const [activeField, setActiveField] = useState<ComposePointFieldIndex>(0)
  /**
   * 两个字段的锁定值。
   *
   * @remarks
   * **至多有一个非空**，且它永远是「此刻不在编辑的那一个」——由 `advanceField` 的写法
   * 构造上保证（见那里）。两个都锁死时落点已经完全确定，光标再也带不动任何东西。
   */
  const [lockedFields, setLockedFields] = useState<
    readonly [number | null, number | null]
  >([null, null])
  const [fieldText, setFieldText] = useState('')
  /**
   * 解算之后落点的镜像。
   *
   * @remarks
   * `submit` 与 `advanceField` 定义在 `resolvedPointer` 之前（它依赖它们经手的解算），因此
   * 靠一个 ref 打断这个方向。读的仍是同一份值——两处各算一遍会让键入的落点与屏幕上的差一帧。
   */
  const livePointRef = useRef<ComposeInputPoint | null>(null)
  /**
   * 本次会话**自己建出来**的 Entity id，按落地顺序。
   *
   * @remarks
   * 参考点跟着文档走靠它：栈顶那个不在文档里了，会话就该回退一个点。判据是「我建的那个还在
   * 不在」而不是「用户按了哪个键」——拦 `Control+Z` 只覆盖那一个键，而删除、外部同步、别的
   * 命令都能让同一件事发生；这也让 Stage 不必复制编辑器的撤销键位。
   *
   * 会话结束时清空：它描述的是**这一次会话**建了什么。
   *
   * `seen` 是必需的：派发之后新 Entity 要过一趟 React 才到得了 `document`，而在那之前它
   * **也不在文档里**。少了这一位，「还没到」与「被删了」分不开——症状是画第二段时第一段被
   * 自己撤掉，只剩一条线。因此只有**曾经见过**的 id 消失才算删除。
   *
   * `vertices` 记的是**上一次写进去的顶点数**，只有把几何扩在同一个 Entity 上的会话（导线）
   * 才有值。同一条规则要覆盖「Entity 还在、但被改小了」这一档：撤销撤掉的是最后那一次几何
   * 写入，Entity 并没有消失。只判存在的症状是——撤销一下、再点一下，那个拐点又回来了。
   */
  const createdIdsRef = useRef<{
    readonly id: string
    seen: boolean
    vertices?: number
  }[]>([])
  /**
   * 当前正在跑的那条命令的定义；没有会话时为 `null`。
   *
   * @remarks
   * 只为读它的 `repeat` 而留：提交之后要不要接着画是**这条命令自己的性质**，而 `applyStep`
   * 手上只有一个 step。退化会话（`prompt` 为 null、当场提交）**不写这个 ref**，否则它那一步
   * 会被上一条命令的 `repeat` 接管，重开成一个永不停止的循环。
   */
  const activeDefinitionRef = useRef<
    ComposeCommandDefinition<StageDraftingContext, StageDraftingEffect> | null
  >(null)
  /**
   * 当前这一条取过点没有。
   *
   * @remarks
   * 会重开的命令 `Escape` 分两级，判据就是这一份事实：取过点则放弃这一条、命令留着；一个点
   * 都没取才退出。与几何编辑里「先熄灭热夹点、再退出会话」同构。
   */
  const pickedRef = useRef(false)

  /**
   * `POLYGON` 上一次用过的边数。
   *
   * @remarks
   * 会话级，不写文档也不持久化——它是「上次怎么画的」而不是「画了什么」。记忆之所以可以存在，
   * 是因为默认值印在提示的尖括号里：`CIRCLE` 的档位不跨命令记忆，理由正是那份状态看不见。
   */
  const polygonSidesRef = useRef(COMPOSE_POLYGON_DEFAULT_SIDES)
  /**
   * `POLYGON` 上一次用的档位。
   *
   * @remarks
   * 与边数同一条理由跨命令记住：「不跨命令记忆」的判据是**那份状态看不见**，而档位挪到第一步、
   * 印成光标旁的胶囊之后，那条理由不再成立。这一版更需要它——档位在第一步就定死，选错只能
   * 重来，而记住之后重来一次只需按一下 `Tab`。会话级，不写文档、不持久化。
   */
  const polygonFitRef = useRef<ComposeRegularPolygonFit>('inscribed')

  /** 修饰键滚轮的累加余量；方向反转与新会话都清零。 */
  const wheelRemainderRef = useRef(0)

  /**
   * 这一条会话到目前为止碰过端口没有。
   *
   * @remarks
   * **碰过就是导线**，此后的落点钉死正交。`WIRE` 合并进 `LINE` 之后没有第二种线可分，
   * 「这是不是一条导线」只能从取点来源读出来——而那正是绑定的判据（吸附到端口本身就是显式
   * 意图），两者因此读同一份事实，不可能给出「绑上了但走斜线」这种自相矛盾的结果。
   *
   * 导线**只走横平竖直**：斜着走的导线在一次接线图上不是「用户的选择」，是一张画错的图。
   * 而没碰过端口的普通线一个字节都不变——它照旧跟着会话级的角度约束走。
   *
   * 是**状态**而不是 ref：落点解算在渲染期被读到（预览、十字线、捕捉标记都要它），而渲染期
   * 读 ref 读到的是上一帧的值。这不违反「不为反馈引入每帧都要写的状态」——它只在取点真的
   * 碰到端口时写一次，而不是每次 `pointermove`。
   */
  const [wiring, setWiring] = useState(false)
  /**
   * 回指 `launch`。
   *
   * @remarks
   * `applyStep` 定义在 `launch` 之前（`launch` 要用它跑退化会话的那一步），而重开要从
   * `applyStep` 回到 `launch`——直接引用会成环。`applyStep` 只从事件处理里跑，那时挂载副作用
   * 早已完成，因此这个 ref 一定已经填好。
   */
  const launchRef = useRef<
    ((definition: ComposeCommandDefinition<StageDraftingContext, StageDraftingEffect>) => void)
    | null
  >(null)
  const resetFields = useCallback(() => {
    setActiveField(0)
    setLockedFields([null, null])
    setFieldText('')
  }, [])

  const builtInCommands = useMemo(() => createStageDraftingCommands(messages), [messages])
  // 页面网格两轴独立，且开关是 `snapEnabled` 而不是「网格是否可见」——看得见与吸不吸是两件事。
  const gridSettings = useMemo(() => ({
    enabled: document.canvas.grid.snapEnabled,
    stepX: document.canvas.grid.stepX,
    stepY: document.canvas.grid.stepY,
  }), [document.canvas.grid])

  const snapshot = {
    builtInCommands,
    hostCommands,
    messages,
    onEnterGeometryEditing,
    isGeometryEditable,
    document,
    layoutSnapshot,
    index,
    registry,
    dispatch,
    idFactory,
    activeFrameId,
    selectedIds,
    onSelectedIdsChange,
    hatchColor: activeHatchColor,
    onHatchColorChange: options.onHatchColorChange,
  }
  const latest = useRef(snapshot)
  useLayoutEffect(() => {
    latest.current = snapshot
  })

  /**
   * 把一条 `entity.create` 命令建出来的 id 记进栈；`meta.targetIds` 就是它。
   *
   * @param vertices - 这一次写进去的顶点数；把几何扩在同一个 Entity 上的会话靠它判断
   * 「Entity 还在、但被改小了」。
   */
  const recordCreated = useCallback((
    command: { readonly meta?: { readonly targetIds?: readonly string[] } },
    vertices?: number,
  ) => {
    const id = command.meta?.targetIds?.[0]
    if (id) {
      createdIdsRef.current.push({ id, seen: false, ...(vertices === undefined ? {} : { vertices }) })
    }
  }, [])

  /**
   * 落地一步效果。
   *
   * @returns 需要显示的说明；没有就是 null。
   *
   * @remarks
   * 说明**由返回值交出去**而不是在这里 `setNotice`：`LINE` 逐段落地，它的提交发生在
   * `prompt` 这一档里，而那一档紧接着就会把命令行清成下一句提示——在这里写等于同一拍被抹掉。
   */
  const commit = useCallback((effect: StageDraftingEffect | undefined): string | null => {
    if (!effect) return null
    let notice: string | null = null
    const current = latest.current

    /*
     * 撤掉上一段：出栈之后当成一次普通删除派发——`removed` 那条路已经在 `ERASE` 上跑着，
     * 另开一条只会让「删一个 Entity」有两份实现。
     *
     * **不是一次文档撤销**：Stage 没有撤销端口，而为这一个关键字引入一条不划算。代价是历史
     * 里留下「新建 + 删除」两条而不是零条。
     */
    const undone = effect.undoLastCreated ? createdIdsRef.current.pop()?.id : undefined

    for (const curve of effect.curves ?? []) {
      /*
       * 替换本次会话上一个建出来的那一个：导线每取一个点就落地，而产出仍然是**一个** Entity。
       * 栈里没有可替换的对象时（它已经被外部撤销掉了）`replace` 落空，下面那一支退回新建并
       * 把新的记进栈——会话因此自己愈合，而不是从此每一步都写不进去。
       */
      const replaced = effect.replaceLastCreated
        ? createdIdsRef.current[createdIdsRef.current.length - 1]
        : undefined
      const created = createStageDraftingCurveCommand({
        document: current.document,
        layoutSnapshot: current.layoutSnapshot,
        index: current.index,
        registry: current.registry,
        idFactory: current.idFactory,
        activeFrameId: current.activeFrameId,
      }, curve, {
        // 所有直线都按取点时记下的来源绑定，不再看命令是哪一条：「吸附到端口」本身就是显式
        // 意图（用户把光标挪进容差、看着捕捉标记亮起、然后落笔），再要求他先选对一条命令
        // 是让同一个意图说两遍。两端都没碰过端口时 `wireBindingsFor` 给出空对象，落地时
        // 因此不写 `Wire`，也不走导线 Preset——没碰过端口的普通线一个字节都不变。
        wire: wireBindingsFor(portAnchors.current, curve),
        /*
         * 落在线身上的那些端：宿主在同一个事务里建节点、断线并绑上去。
         *
         * **这一条还没画完时整个跳过**：中途路过另一条导线不是接线意图，先建节点、把对方
         * 劈成两段，下一下又走开，留下的是一个谁也没接的孤儿节点，而对方的线已经被切开了。
         * 端口绑定不受这一条约束——它每一步按当前几何重算，是自我纠正的。
         */
        ...(effect.pending
          ? {}
          : (() => {
              const taps = wireTapsFor(wireAnchors.current, curve)
              return taps ? { taps, tapLabel: current.messages.wireTap } : {}
            })()),
        ...(effect.wire ? { wiring: true } : {}),
        ...(effect.arrow ? { arrow: true } : {}),
        ...(effect.rectangle ? { rectangle: true } : {}),
        ...(replaced ? { replace: replaced.id } : {}),
      })
      if (!created) continue
      const vertices = composeCurveVertexCount(curve)
      // 换掉栈顶那一项而不是就地改它：`createdIdsRef` 是 Hook 的参数，编译器不允许在
      // 回调里改它指到的对象；整份换新是 ref 写入，语义完全相同。
      if (created.mergedInto) {
        /*
         * 这一条被并进了一条既有导线：本次画的那个 Entity 已经不在文档里了。会话记的那一项
         * 必须换成合并之后那一条——不换的话「参考点跟着文档走」会把它读成一次删除，把会话
         * 往回退一个点，而用户明明刚落下了一个点。
         */
        const merged = { id: created.mergedInto, seen: false, vertices: created.mergedVertices }
        createdIdsRef.current = replaced
          ? createdIdsRef.current.map((entry) => (entry === replaced ? merged : entry))
          : [...createdIdsRef.current, merged]
      } else if (replaced) {
        createdIdsRef.current = createdIdsRef.current.map((entry) => (
          entry === replaced ? { ...entry, vertices } : entry
        ))
      } else recordCreated(created.command, vertices)
      current.dispatch(created.command)
      // 跨父级的绑定被丢掉了就必须说出来：静默丢弃与「绑上了」在屏幕上无法区分。
      if (created.droppedWireEnds.length > 0) notice = current.messages.wireParentMismatch
    }

    /*
     * 填充：解算在引擎、规划在这里——新建那一支要一个 `hatch` Preset 与一个新的 Entity id，
     * 而引擎不建 Entity、不认识 Preset id。两支（改一个已有形状 / 新建一块）都在这里分流，
     * 免得同一件事跨两个包。
     */
    if (effect.hatch) {
      const plan = planStageHatch(
        {
          document: current.document,
          layoutSnapshot: current.layoutSnapshot,
          index: current.index,
          registry: current.registry,
          idFactory: current.idFactory,
          activeFrameId: current.activeFrameId,
        },
        effect.hatch.point,
        {
          color: current.hatchColor,
          isJunction: isStageJunctionEntity,
          fillLabel: current.messages.hatchFillLabel,
          rejection: current.messages.hatchRejection,
        },
      )
      // 断口记号常驻到下一次落点为止：它是一处缺陷，而用户此刻要拿着它去图上找那条缝。
      setHatchGaps(plan.gaps)
      plan.commands.forEach((command) => {
        if (plan.branch === 'create') recordCreated(command)
        current.dispatch(command)
      })
      if (plan.notice) notice = plan.notice
    }

    // 平移、复制、删除与夹点几何只认识文档，因此由引擎规划成命令；宿主只负责派发。
    for (const command of planStageDraftingEdits({
      document: current.document,
      layoutSnapshot: current.layoutSnapshot,
      index: current.index,
      effect: undone ? { ...effect, removed: [...(effect.removed ?? []), undone] } : effect,
      idFactory: current.idFactory,
      // 引擎不认识 Preset id，节点的身份由这条谓词注入：`ERASE` 删掉一条支路之后，
      // 支路不足的节点在同一个事务里一起收掉。
      isJunction: isStageJunctionEntity,
      // 修剪据此继承绑定：引擎不认识导线。
      isWire: isStageWireEntity,
      trimLabel: current.messages.trimLabel,
      // 绑定来自**取点时记下的来源**，与新建导线读的是同一张表。
      ...(effect.curveGrip
        ? (() => {
            const port = portAnchors.current.get(anchorKey(effect.curveGrip.point))
            return port ? { wireBinding: port } : {}
          })()
        : {}),
      curveLabel: current.messages.editGeometry,
      mirrorLabel: current.messages.mirrorLabel,
      alignLabel: current.messages.alignLabel,
    })) {
      current.dispatch(command)
    }

    // 进入几何编辑不是文档变更：会话归 Stage 自己，命令只是它的第二个入口。
    if (effect.enterGeometryEditing) {
      latest.current.onEnterGeometryEditing?.(effect.enterGeometryEditing)
    }

    // 已删标识留在选择集里会指向不存在的 Entity，随后任何以选择集为输入的命令都会拿到
    // 幽灵目标。AutoCAD 里 ERASE 之后选择集也是空的。
    if (effect.removed && effect.removed.length > 0) current.onSelectedIdsChange([])
    return notice
  }, [recordCreated])

  const endSession = useCallback((message: string | null) => {
    sessionRef.current = null
    activeDefinitionRef.current = null
    pickedRef.current = false
    setWiring(false)
    setActiveCommandId(null)
    portAnchors.current.clear()
    wireAnchors.current.clear()
    createdIdsRef.current = []
    wheelRemainderRef.current = 0
    setPrompt(null)
    setReference(null)
    setPreview(null)
    setGripTarget(null)
    setNotice(message)
  }, [setPrompt])

  const applyStep = useCallback((step: ReturnType<ComposeCommandSession<StageDraftingEffect>['advance']>) => {
    if (step.status === 'prompt') {
      // 提交交出来的说明压过「清空」：这一档本来就要把命令行换成下一句提示，而落地时发生的
      // 事（例如跨父级没能绑上）此刻还没被任何人看见。
      const notice = commit(step.commit)
      setPrompt(step.prompt)
      setReference(step.preview?.reference ?? step.commit?.reference ?? null)
      setPreview(step.preview ?? null)
      setNotice(notice)
      return
    }
    /*
     * 重开一条**全新**会话：不继承上一条的任何点——继承终点会让两点命令退化成链，而那是
     * `LINE` 的语义。`activeCommandId` 一动不动（`launch` 用同一个 id 再 set 一次，React 对
     * 相同值不重渲染），因此工具栏的按下态在整个连画过程里不会抖。
     */
    const repeat = () => {
      const definition = activeDefinitionRef.current
      if (definition?.repeat !== true || !launchRef.current) return false
      launchRef.current(definition)
      return true
    }
    if (step.status === 'commit') {
      const notice = commit(step.effect)
      /*
       * 重开会把命令行清成第一步的提示，因此说明要**在重开之后**再写：落地时发生的事
       * （例如跨父级没能绑上）此刻还没被任何人看见，被下一条的提示盖掉就等于没说。
       */
      if (repeat()) {
        if (notice !== null) setNotice(notice)
        return
      }
      endSession(notice)
      return
    }
    if (step.status === 'cancelled') {
      /*
       * 放弃这一条时先落地它交出来的效果：导线从第二个点起就在文档里了，只清掉会话会在图上
       * 留下半条线。**必须排在重开之前**——重开会把「我建了哪些」那份记录清掉，此后没有人
       * 知道该删谁。
       */
      const notice = commit(step.effect)
      // 两级 Escape：这一条取过点就只放弃这一条，命令留着回到第一步；没取过点才退出。
      if (pickedRef.current && repeat()) {
        if (notice !== null) setNotice(notice)
        return
      }
      endSession(notice ?? messages.cancelled)
      return
    }
    // rejected **不结束会话**：点错、打错在这类工具里是常态，结束命令会让用户从头再来。
    setNotice(step.message)
  }, [commit, endSession, messages.cancelled, setPrompt])

  /**
   * 把一个点喂进当前会话。
   *
   * @remarks
   * **「这一条取过点没有」记在这里**：会重开的命令 `Escape` 分两级，判据就是这一份事实，而
   * 点有指针与键入两个来源——各记一次必然漏掉其中一条，而漏掉的那条的症状是「用键盘打了第一
   * 个点之后按 Esc 整条命令没了」。
   */
  /**
   * 用一个点推进会话；这一步有待提交的键入值时**先把它交出去**。
   *
   * @remarks
   * `cursorInput` 那一档的缓冲是**这一步的待定值**，而不是一句还没敲完的命令。不先交出去的
   * 症状是：光标旁那个框写着 `4`，点下中心之后落地的却是六边形——屏幕上写着一件事、做的是
   * 另一件事，而用户没有任何办法看出来。
   *
   * 这与取点步早就成立的那条是同一句话：那里键入的值折进落点里（`applyComposeFieldOverride`
   * 与「正在键入时预览跟着键入的值走」），缓冲从来不会被静默丢掉。此前只有 `Enter` 会把它
   * 交出去，因此那一档是这条规则唯一的漏网。
   *
   * 交出去被拒绝时 MUST 停手：值非法，此刻落一个点等于拿一个用户没打算要的默认值成图，
   * 而拒绝的说明还会被下一步的提示顶掉。
   */
  const advanceWithPoint = useCallback((
    session: ComposeCommandSession<StageDraftingEffect>,
    point: ComposeInputPoint,
  ) => {
    pickedRef.current = true
    const pending = session.prompt?.cursorInput ? fieldText.trim() : ''
    if (pending.length > 0) {
      setFieldText('')
      applyStep(session.advance({ kind: 'text', text: pending }))
      // 交出去之后会话可能被拒绝、结束或换了一条；只有它还活着且推进了才继续落点。
      if (sessionRef.current !== session || session.prompt?.cursorInput) return
    }
    applyStep(session.advance({ kind: 'point', point }))
  }, [applyStep, fieldText])

  /**
   * 特征点捕捉的世界容差。
   *
   * @remarks
   * 基数是 `snapRadius` 屏幕像素除以缩放。**开着网格吸附时再加上网格自己的够及范围**
   * （半条对角步长）：网格已经在把落点搬走，最远就是这么远，因此把对象捕捉的靶区扩大同样
   * 的量，不会引入任何用户尚未接受的位移。
   *
   * 这条**不是**在改优先级——`resolveComposePoint` 本来就是捕捉命中即短路、根本不过网格。
   * 它解决的是另一件事：够不着的时候网格接管，把点拽到格点上，看起来就像网格把捕捉挤掉了。
   * 网格越粗、它的拽动越violent，靶区也就跟着越大，这个联动正是想要的。
   *
   * 关掉网格吸附时退回基数，一个像素都不多给。
   */
  const featureTolerance = useMemo(() => {
    const base = snapRadius / viewport.zoom
    if (!gridSettings.enabled) return base
    return base + Math.hypot(gridSettings.stepX, gridSettings.stepY) / 2
  }, [gridSettings, snapRadius, viewport.zoom])

  /**
   * 不参与捕捉的**单个世界点**：被会话作用的那个夹点的**原**位置。
   *
   * @remarks
   * 它就在指针底下（拖动时）或就在用户刚按过的地方（点亮时），不排除的话落点会被吸回原处。
   * 排除**只到这一个点**——做成整个 Entity 会把同对象的其他顶点与各段中点一起收走，而
   * 「把这个角对到那个角上」正是最常做的事。
   *
   * 事实来源是 `gripTarget.origin`，也就是**文档**里那个顶点的位置：要挡的是它出发的地方，
   * 不是它此刻跟着指针到的地方。
   */
  const snapExcludedPoint = gripTarget?.origin ?? null

  /** 光标附近的捕捉命中；同时用于渲染标记与求解落点，两者因此不可能分叉。 */
  const excluded = snapExcludedIds ?? EMPTY_EXCLUSIONS
  const snap: StageFeaturePoint | null = useMemo(() => {
    if (!enabled || !snapEnabled || !pointer) return null
    return findStageFeaturePoint(
      document, index, pointer, featureTolerance, excluded, snapExcludedPoint,
      isStageWireEntity,
    )
  }, [document, enabled, excluded, featureTolerance, index, pointer, snapEnabled, snapExcludedPoint])

  /** 这一步的数值参数化；命令没声明就不显示数值，也没有锁定可言。 */
  const fieldKind: ComposePointFieldKind | null = prompt?.fields ?? null
  /** 正在取点且这一步有字段：动态输入画不画读它。 */
  const awaitingPointForFields = prompt?.accepts.includes('point') === true && fieldKind !== null
  /**
   * 这一步要在光标旁印什么；缺席即不印。
   *
   * @remarks
   * 判据由**提示自己声明**而不由宿主从 `accepts` 反推：反推过一版（「接受文本、既不取点也不
   * 选对象」），它在第一步同时收点之后就不成立了。而反推还有一处天生的盲区——只有命令知道
   * 那个框里该印什么值，宿主手上只有一句提示文案。
   */
  const cursorInput = prompt?.cursorInput ?? null
  /**
   * `Tab` 在这一步有事可做。
   *
   * @remarks
   * 两支互斥，**由构造保证**：有两个数值字段的步没有档位（那一档 `Tab` 归锁定），有档位的步
   * 没有第二个数值字段。写成互斥的两支而不是一个优先级，是因为「同时成立时听谁的」在屏幕上
   * 没有可解释的答案。
   */
  const takesTab = (awaitingPointForFields
    && fieldKind !== null
    && !isComposeSingleFieldKind(fieldKind))
    || cursorInput?.toggle != null

  /**
   * 把已锁定的字段覆盖回落点。
   *
   * @remarks
   * 锁定的字段不再跟光标：指针可以走到锁定值之外，几何停在锁定处。这正是「宽已经定了、
   * 高还在跟鼠标」在屏幕上唯一说得清楚的画法。
   */
  const applyFieldLocks = useCallback((point: ComposeInputPoint): ComposeInputPoint => {
    if (!fieldKind) return point
    let next = point
    const origin = reference ?? undefined
    for (const index of [0, 1] as const) {
      const locked = lockedFields[index]
      if (locked !== null) next = applyComposeFieldOverride(fieldKind, next, origin, index, locked)
    }
    return next
  }, [fieldKind, lockedFields, reference])

  /**
   * 解算一次落点，并带上它的来源。
   *
   * @remarks
   * 来源只有落在端口上时才有值。导线的绑定读它，因此「拖到端口上就绑、拖到别处就解绑」与
   * 落点解算读的是同一次捕捉，不可能分叉。
   */
  const resolvePointerHit = useCallback((world: StagePoint): {
    readonly point: ComposeInputPoint
    readonly port?: ComposeWireBinding
    /** 落在另一条导线上的那次取点；接线时先建节点再绑它。 */
    readonly tap?: StageWireTapAnchor
    /** 角度约束命中的那条射线；追踪射线画不画读它，不另判一次。 */
    readonly ray: number | null
  } => {
    const hit = snapEnabled
      ? findStageFeaturePoint(
          document, index, world, featureTolerance, excluded, snapExcludedPoint,
          isStageWireEntity,
        )
      : null
    const resolved = resolveComposePointDetail(world, 'pointer', {
      ...(hit ? { snapped: hit.point } : {}),
      ...(reference ? { reference } : {}),
      /*
       * 导线只走横平竖直，会话级的三态设置管不到——那是**规范**而不是偏好。两个来源，任一
       * 成立即钉死正交：`WIRE` 的提示自己声明（用户是在接线），或者这条线碰过端口（它事实上
       * 就是导线，哪怕走的是 `LINE`）。
       *
       * 钉死的只是这一档，因此管线次序原样成立（键入 > 捕捉 > 网格 > 角度约束）：捕捉命中
       * 仍然短路（最后一段够得着端口，不会被正交挡在门外），键入的坐标仍然不被改写。
       */
      angle: prompt?.constrain ?? (wiring ? 'ortho' : angleConstraint),
      polar: { increment: polarIncrement, tolerance: snapRadius / viewport.zoom },
      grid: gridSettings,
    })
    /*
     * 锁定在解算**之后**生效。锁定的值是用户键入的，因此与「键入的坐标不被任何吸附改写」
     * 同源；反过来（先覆盖再吸附）会让网格把刚锁死的 300 挪成 296。
     */
    const point = applyFieldLocks(resolved.point)
    if (hit?.mode === 'port' && hit.portId) {
      return { point, ray: resolved.ray, port: { entityId: hit.entityId, portId: hit.portId } }
    }
    /*
     * 落在另一条导线上：`endpoint`、`midpoint` 与 `nearest` 三种模式一视同仁——它们都是导线
     * 上的点。只认 `nearest` 的症状是「瞄准一段线的正中间反而接不上」（中点优先级更高），
     * 而那在屏幕上与接上了逐像素相同。
     *
     * 落点被字段锁定挪走时**不接**：锁定的值是用户键入的，此刻这一点已经不在那条线上了，
     * 而「键入的坐标永远不接」是同一条规则的另一半。
     */
    const onWire = hit
      && (hit.mode === 'endpoint' || hit.mode === 'midpoint' || hit.mode === 'nearest')
      && point.x === hit.point.x
      && point.y === hit.point.y
      && isStageWireEntity(document.entities[hit.entityId])
    return onWire && hit
      ? { point, ray: resolved.ray, tap: { entityId: hit.entityId, point: hit.point } }
      : { point, ray: resolved.ray }
  }, [
    angleConstraint, applyFieldLocks, document, excluded, featureTolerance, gridSettings, index,
    polarIncrement, prompt?.constrain, reference, snapEnabled, snapExcludedPoint, snapRadius,
    viewport.zoom, wiring,
  ])

  const resolvePointerPoint = useCallback(
    (world: StagePoint): ComposeInputPoint => resolvePointerHit(world).point,
    [resolvePointerHit],
  )

  const handlePoint = useCallback((world: StagePoint) => {
    const session = sessionRef.current
    if (!session) return
    // 按这次按下自己的坐标重算捕捉，不沿用上一帧 hover 的结果：pointerdown 可能赶在 React
    // 为上一次 pointermove 重渲染之前到达，落点会被吸回用户已经离开的特征点上。
    const { point, port, tap } = resolvePointerHit(world)
    // 锁定与活动字段描述的是**这一步**；点落下之后它们说的是一件已经过去的事。
    resetFields()
    // 导线的绑定来自**取点时记下的来源**，不是事后按坐标反查已有端口：反查会让一条恰好路过
    // 端口的普通线莫名其妙地绑上，而那个绑定在屏幕上完全不可见。键入的坐标因此永远不绑——
    // 它没有来源可言。
    if (port) {
      portAnchors.current.set(anchorKey(point), port)
      setWiring(true)
    } else if (tap) {
      // 接到另一条导线上的线**事实上**就是导线：它跟着走导线 Preset，也跟着钉死正交。
      wireAnchors.current.set(anchorKey(point), tap)
      setWiring(true)
    }
    advanceWithPoint(session, point)
  }, [advanceWithPoint, resetFields, resolvePointerHit])

  /**
   * 启动一条已经解析好、且此刻可用的命令。
   *
   * @remarks
   * 按名启动与**提交后重开**共用它：重开只是「再跑一次同一个定义」，另写一份会让两条路径在
   * 该清哪些状态上漂移。
   *
   * `setActiveCommandId` 在重开时被喂进**同一个值**，React 对相同状态不重渲染，因此工具栏的
   * 按下态在整个连画过程里一次都不会闪成未按下。
   */
  const launch = useCallback((
    definition: ComposeCommandDefinition<StageDraftingContext, StageDraftingEffect>,
  ) => {
    const context: StageDraftingContext = {
      messages,
      // 先选后执行：命令要么在启动上下文里拿到目标，要么自己提示选择。
      selection: latest.current.selectedIds,
      ...(latest.current.isGeometryEditable
        ? { isGeometryEditable: latest.current.isGeometryEditable }
        : {}),
      polygonSides: polygonSidesRef.current,
      onPolygonSidesChange: (sides) => { polygonSidesRef.current = sides },
      polygonFit: polygonFitRef.current,
      onPolygonFitChange: (fit) => { polygonFitRef.current = fit },
      hatchColor: latest.current.hatchColor,
      onHatchColorChange: (color) => {
        setOwnHatchColor(color)
        latest.current.onHatchColorChange?.(color)
      },
    }
    setGripTarget(null)
    setReference(null)
    setPreview(null)
    setNotice(null)
    setHatchGaps([])
    // 全新会话：端口来源与「我建了哪些」都只描述**这一条**，重开时必须一起清掉。
    portAnchors.current.clear()
    wireAnchors.current.clear()
    createdIdsRef.current = []
    wheelRemainderRef.current = 0
    pickedRef.current = false
    setWiring(false)
    /*
     * **先清掉再跑**：退化会话（`prompt` 为 null）当场提交，那一步会走进 `applyStep` 的
     * commit 分支——此刻 ref 里若还留着上一条命令的定义，它的 `repeat` 就会把这一步接管，
     * 重开成一个永不停止的循环。
     */
    activeDefinitionRef.current = null
    // 「`prompt` 为 null 就立即 accept」只有一处实现（`runComposeCommandImmediately`）：先选好
    // 对象再敲 `E↵` 对象当场就删，走的正是这一支，宿主一次性动作走的也是它。
    const outcome = runComposeCommandImmediately(definition, context)
    lastCommandRef.current = definition.id
    if (outcome.status === 'ran') {
      applyStep(outcome.step)
      return
    }
    sessionRef.current = outcome.session
    activeDefinitionRef.current = definition
    setActiveCommandId(definition.id)
    setPrompt(outcome.session.prompt)
  }, [applyStep, messages, setPrompt])

  useEffect(() => { launchRef.current = launch }, [launch])

  /**
   * 按名称启动一条命令。
   *
   * @remarks
   * 内建绘图命令与宿主注入的动作走的是同一条路径：解析、查可用性、启动。两者分头处理会让
   * 同一条命令在「敲名字」与「点面板」之间给出不同结果。
   */
  const start = useCallback((name: string) => {
    /*
     * 注册表在**提交那一刻**才建，不随 props 每次变化重建。
     *
     * 宿主注入的定义每次都是新数组——它们携带的可用性必须跟着选择集与文档走，因此不可能
     * 引用稳定。把注册表挂在 `useMemo` 上会让这条身份变化一路传染到 `submit`、`handleKeyDown`
     * 与整个会话对象，而 Stage 的每一帧都要重挂这些回调。解析只在用户按下 Enter 时发生，
     * 每次现建一张表的代价（几十个键）远小于让它污染渲染路径。
     *
     * 内建在前、宿主在后只是一个可读的次序：重名两边都不赢，注册表直接抛错。
     */
    const current = latest.current
    const definition = createComposeCommandRegistry([
      ...current.builtInCommands,
      ...(current.hostCommands ?? []),
    ]).resolve(name)
    if (!definition) {
      setNotice(messages.unknownCommand)
      return
    }
    /*
     * 命令行的三种拒绝必须互相可分：词不在词汇表里、词在词汇表里但此刻不可用、会话进行中的
     * 非法输入。少了中间这种，敲 `GROUP` 而没选够对象会**什么都不发生**，而这在屏幕上与敲
     * 错字无法区分。内建八条恒可用，因此这一档是宿主动作进来之后才有的。
     */
    if (definition.disabledReason !== undefined && definition.disabledReason.length > 0) {
      setNotice(definition.disabledReason)
      return
    }
    launch(definition)
  }, [launch, messages])


  /**
   * 由手势启动一条夹点取点会话。
   *
   * @remarks
   * 与按名启动并列的第二个入口：本会话由手势启动而不由词启动，因此没有名字，也不进
   * 「重复上一条命令」的序列——那条记的是命令名，而这里没有名可记。
   *
   * `reference` 取目标自带的参照，缺席即夹点的**原**位置：橡皮筋、相对坐标与角度约束都从它
   * 量起。导线的端点把参照放在相邻顶点上，正交因此保住那一段横平竖直——与画线时相对上一点
   * 是同一件事；被排除出捕捉的仍是 `origin`，那是端点出发的地方。
   */
  const startGripSession = useCallback((target: StageGripTarget) => {
    // 文案从 ref 读：宿主每帧新建的 messages 若进依赖数组，会让 `applyStep` 每帧换身份，
    // 而「把选择集喂给会话」那条 effect 依赖它——effect 每帧重跑又每帧 setState，就是死循环。
    const session = createStageGripSession(latest.current.messages, target)
    sessionRef.current = session
    portAnchors.current.clear()
    wireAnchors.current.clear()
    setGripTarget(target)
    setPrompt(session.prompt)
    setReference(target.reference ?? target.origin)
    setPreview(null)
    setNotice(null)
  }, [setPrompt])

  /**
   * 参考点跟着文档走。
   *
   * @remarks
   * 本次会话建出来的最后一个 Entity 不在文档里了（外部撤销、别人删掉它、任何路径），会话就
   * 回退一个点。不这么做的症状是：`LINE` 画 a→b→c 之后按 `Control+Z`，b-c 那一段消失了而
   * 橡皮筋仍从 c 出发，下一个点会从一个**已经不存在的地方**连出去。
   *
   * **丢弃这一步的效果**：文档已经先动了，`undoLastCreated` 描述的是同一件已经发生的事，
   * 再执行一次会把它下面那一段也删掉。栈在这里自己出，因此两条路径看到的栈始终一致。
   *
   * 会话不认这个关键字（两点命令、`PLINE`、夹点会话都不认）时 `rejected`，什么也不会发生——
   * 而它们本来也不会往栈里放东西。
   *
   * **同一条规则要覆盖「Entity 还在、但被改小了」**：导线把几何扩在同一个 Entity 上，撤销
   * 撤掉的是最后那一次几何写入，它并没有消失。因此顶点数比记下的少时按差值回退同样多个点；
   * 只判存在的症状是「撤销一下、再点一下，那个拐点又回来了」。
   */
  useLayoutEffect(() => {
    const session = sessionRef.current
    const created = createdIdsRef.current
    const last = created[created.length - 1]
    if (!session || last === undefined) return
    /** 回退一个点，并把这一步的效果丢掉——文档已经先动了。 */
    const stepBack = () => {
      const step = session.advance({ kind: 'keyword', key: 'U' })
      if (step.status !== 'prompt') return false
      setPrompt(step.prompt)
      setReference(step.preview?.reference ?? null)
      setPreview(step.preview ?? null)
      return true
    }
    const entity = document.entities[last.id]
    if (entity) {
      last.seen = true
      const curve = getComposeCurve(entity)
      const current = curve ? composeCurveVertexCount(curve) : undefined
      if (last.vertices === undefined || current === undefined || current >= last.vertices) return
      const missing = last.vertices - current
      last.vertices = current
      for (let index = 0; index < missing; index += 1) {
        if (!stepBack()) return
      }
      return
    }
    // 还没见过：它只是没走完那趟 React，不是被删了。
    if (!last.seen) return
    created.pop()
    stepBack()
  }, [document, setPrompt])

  /** 清掉命令行上残留的说明。进入几何编辑时调用：用户此刻站在一个会取点的状态里。 */
  const clearNotice = useCallback(() => { setNotice(null) }, [])
  /**
   * 说出一句拒绝。
   *
   * @remarks
   * 顶点增删由**手势与键盘**触发而不是由一条命令推进，因此它到不了 `rejected` 那一支；
   * 而「敲了没反应」与敲错在屏幕上无法区分这条对它一样成立，落地的地方也该是同一处——
   * 命令行那一行，用户此刻正在看的就是它。
   */
  const notify = useCallback((message: string) => { setNotice(message) }, [])

  const submit = useCallback((text: string) => {
    const trimmed = text.trim()
    const session = sessionRef.current

    if (!session) {
      /*
       * 空闲时的空确认重复**上一条命令**，而不是上一行文本。两者不是同一个序列：文本行里
       * 混着坐标与关键字，而它们不是命令名——共用一个序列会让空确认把上一次键入的坐标拿去
       * 当命令解析。召回文本行是命令行组件自己的事（上下方向键）。
       */
      if (trimmed.length === 0) {
        if (lastCommandRef.current !== null) start(lastCommandRef.current)
        return
      }
      start(trimmed)
      return
    }

    if (trimmed.length === 0) {
      applyStep(session.advance({ kind: 'accept' }))
      return
    }

    /*
     * 这一步接受文本：坐标写法在这里没有意义，一律原样交给会话。
     *
     * `'text'` 在协议里一直定义着却从来没有生产者——既有命令要么取点、要么选对象、要么打
     * 关键字。少了这条路由，`POLYGON` 的第一步收到的 `6` 会因为解析不成坐标、这一步又没有
     * `fields` 而掉进最后那条兜底，变成一个**关键字**；而命令行会把关键字渲染成可点的选项，
     * 关键字是一份枚举，边数不是。
     *
     * **判据只看接不接受文本，不再要求「且不接受点」**：第一步同时收点（点一下即取用默认
     * 边数并把那一下当作中心），而键盘与指针是两条不同的通道。它们在这里不会撞车——这一步
     * 还没有参考点，直接距离输入无从谈起，因此裸数字只可能是那个数。
     *
     * 宿主不解析也不校验这段文本：范围与整数是命令自己的规则，放在这里等于让同一条规则有
     * 两处来源。
     */
    if (session.prompt?.accepts.includes('text') === true) {
      /*
       * **关键字压过自由文本**，且这条判断只存在于接受文本的步上。
       *
       * 别处的次序（坐标 → 裸数字 → 关键字兜底）已经把关键字解析对了，而这一支会把**所有**
       * 文本原样吞掉，兜底因此永远够不着——症状是在第一步敲 `C` 换档，得到的是「边数必须是
       * 3 到 1024 之间的整数」。关键字是一份**闭合枚举**，落在里面的输入不可能同时是那个
       * 自由字段的值。
       */
      const keyword = session.prompt.keywords?.find(
        ({ key }) => key.toUpperCase() === trimmed.toUpperCase(),
      )
      applyStep(keyword
        ? session.advance({ kind: 'keyword', key: keyword.key })
        : session.advance({ kind: 'text', text: trimmed }))
      return
    }

    const parsed = parseComposeCoordinate(trimmed, reference ?? undefined)
    if (parsed.ok) {
      // 键入的坐标是精确值，不再经过捕捉、正交与网格。**完整写法优先于裸数字**：
      // `100,50` 是一个点，不是活动字段的值。
      resetFields()
      const point = resolveComposePoint(parsed.point, 'typed', { grid: gridSettings })
      advanceWithPoint(session, point)
      return
    }
    /*
     * 裸数字 = **当前活动字段**的值，另一个字段取它此刻的值。这就是直接距离输入：方向由
     * 鼠标定好，只打一个长度。
     *
     * 它不做进 `parseComposeCoordinate`：裸数字缺的是方向，而方向是活动字段之外那一个分量
     * 此刻的值——那是呈现层的状态，不该进 `core` 的语法层。
     */
    const typed = Number(trimmed)
    const livePoint = livePointRef.current
    if (fieldKind && livePoint && Number.isFinite(typed) && BARE_NUMBER.test(trimmed)) {
      const point = applyComposeFieldOverride(
        fieldKind, livePoint, reference ?? undefined, activeField, typed,
      )
      resetFields()
      advanceWithPoint(session, point)
      return
    }
    if (parsed.reason === 'missing-reference') {
      setNotice(messages.expectedPoint)
      return
    }
    applyStep(session.advance({ kind: 'keyword', key: trimmed }))
  }, [
    activeField, advanceWithPoint, applyStep, fieldKind, gridSettings, messages, reference,
    resetFields, start,
  ])

  /**
   * `Tab`：锁定**离开**的那个字段，同时解开**进入**的那个。
   *
   * @remarks
   * 缓冲非空时锁定键入的值，为空时锁定它此刻的值——AutoCAD 的行为。这让「拖个大概的宽度 →
   * `Tab` → 打一个精确的高度」变成两步。
   *
   * **进入即解锁**是这条的另一半，缺了它 `Tab` 按两下就把两个字段全锁上了：两个都锁死时
   * 落点已经完全确定，光标再也带不动任何东西，而屏幕上没有任何东西在说这件事。因此锁定
   * 的数量**由构造保证至多一个**——锁的永远是「此刻不在编辑的那一个」，而不是一份可以攒
   * 起来的状态。
   */
  const advanceField = useCallback((text: string) => {
    /*
     * 有档位的那一步 `Tab` 换档，走的就是命令行里那个关键字——键位与敲字是**同一件事的两个
     * 入口**，不是两条实现。它排在字段轮转之前：那一步没有第二个数值字段，轮转无处可去。
     */
    const toggle = sessionRef.current?.prompt?.cursorInput?.toggle
    if (toggle) {
      const session = sessionRef.current
      if (session) applyStep(session.advance({ kind: 'keyword', key: toggle.keyword }))
      return
    }
    const livePoint = livePointRef.current
    if (!fieldKind || !livePoint) return
    const trimmed = text.trim()
    const typed = Number(trimmed)
    const live = composePointToFields(fieldKind, livePoint, reference ?? undefined)
    const value = trimmed.length > 0 && Number.isFinite(typed)
      ? typed
      : (activeField === 0 ? live.first : live.second)
    setLockedFields(activeField === 0 ? [value, null] : [null, value])
    setActiveField(activeField === 0 ? 1 : 0)
    setFieldText('')
  }, [activeField, applyStep, fieldKind, reference])

  /**
   * 以「没有更多输入了」推进当前会话。
   *
   * @remarks
   * 与命令行里的空 Enter、图面上的 `Enter` 键是**同一步**：右键只是它的第三个来源。
   */
  const acceptCommand = useCallback(() => {
    const session = sessionRef.current
    if (!session) return
    applyStep(session.advance({ kind: 'accept' }))
  }, [applyStep])

  /**
   * 修饰键滚轮：把它转成命令的 `+` / `-` 关键字。
   *
   * @remarks
   * **裸滚轮不被命令占用**：它是画布平移，`Ctrl`/`Cmd` + 滚轮是缩放，两者在命令进行中一律
   * 照常工作。这与「取点接管排在画布平移之下」是同一条判断——命令进行中仍要能平移与缩放画布，
   * 去看远处那个点。因此这条能力挂在 `Alt` 上；`Shift` 不行，浏览器已经把它映射成横向 delta，
   * 而横向 delta 就是横向平移。
   *
   * 走**关键字**而不是第五种输入：增减不该推进状态机，那正是 `preview` 被做成查询而不是输入
   * 的理由。关键字本来就是「改变后续流程但不取点」的那一档，因此键盘与滚轮走同一条路。
   *
   * @returns 本次滚轮是否已被消费；为真时调用方不再平移或缩放。
   */
  const handleWheel = useCallback((event: WheelEvent) => {
    const session = sessionRef.current
    if (!session || !event.altKey) return false
    // 这一步没有列出增减关键字就不拦截：`Alt` + 滚轮此时与从前一样是平移。
    const takesSides = session.prompt?.keywords?.some(
      ({ key }) => key === '+' || key === '-',
    ) === true
    if (!takesSides) return false

    const notch = WHEEL_NOTCH[event.deltaMode] ?? WHEEL_NOTCH[0]!
    // 方向反转时清零：不清的话反向滚动要先抵消掉上一次的余量才有反应。
    if (Math.sign(event.deltaY) !== Math.sign(wheelRemainderRef.current)) {
      wheelRemainderRef.current = 0
    }
    wheelRemainderRef.current += event.deltaY
    while (Math.abs(wheelRemainderRef.current) >= notch) {
      const direction = Math.sign(wheelRemainderRef.current)
      wheelRemainderRef.current -= direction * notch
      // 向前滚（`deltaY` 为负）是加：与「向上滚 = 往多」的通行方向感一致。
      applyStep(session.advance({ kind: 'keyword', key: direction < 0 ? '+' : '-' }))
      // 判据只看提示列没列出这两个关键字，而宿主注入的命令可以在它们上面提交。会话一旦结束
      // 就停手：一次滚动的余量不该继续喂给一条已经死掉的会话。
      if (sessionRef.current !== session) break
    }
    return true
  }, [applyStep])

  const cancel = useCallback(() => {
    const session = sessionRef.current
    if (!session) {
      // 没有命令在跑时 Esc 清空选择集，与 AutoCAD 一致。累加语义下点空白不会清空
      // （那是一次没框住东西的框选），Esc 因此是**唯一**的清空入口。
      setNotice(null)
      latest.current.onSelectedIdsChange([])
      return
    }
    applyStep(session.advance({ kind: 'cancel' }))
  }, [applyStep])

  /**
   * 绘图模式的键盘入口。
   *
   * @remarks
   * `Enter` 与 `Esc` 必须在**图面上**也生效：取完点之后焦点在 Stage 根节点上，只把这两个键
   * 挂在命令行输入框上等于要求用户先点回输入框才能结束命令，而他的手正在画布上。AutoCAD
   * 里这两个键在任何位置都结束命令。
   *
   * 可编辑目标要放过：命令行输入框自己已经处理了 `Enter`/`Esc` 且不阻止冒泡，在根上再消费
   * 一次会让一次按键推进两步。`F8`/`F3` 排在这条守卫之前——正交与捕捉在键入坐标的过程中
   * 同样要能切。
   *
   * 两个键都只在**确实有事可做**时接管，否则交还既有键位级联：`Enter` 在从未启动过命令时
   * 无所作为，`Esc` 没有会话且选择集为空时同理，而设计模式的 `Esc` 还要负责中止进行中的
   * 指针手势。
   */
  const handleKeyDown = useCallback((event: ReactKeyboardEvent<Element>) => {
    if (!enabled) return false
    // 两个键是同一个单选组的两个成员：按下已经生效的那一个即关闭角度约束。
    if (event.key === 'F8') {
      event.preventDefault()
      toggleAngleConstraint('ortho')
      return true
    }
    if (event.key === 'F10') {
      event.preventDefault()
      toggleAngleConstraint('polar')
      return true
    }
    if (event.key === 'F3') {
      event.preventDefault()
      setSnapEnabled((value) => !value)
      return true
    }
    if (isEditableTarget(event.target)) return false
    if (event.key === 'Enter') {
      /*
       * 空闲时的 `Enter` 也重复上一条命令，与命令行的空确认走**同一条路径**（`submit('')`）。
       *
       * 画完一条命令的最后一个点时焦点在**图面**上——那一下点击就发生在那里。只在命令行里
       * 生效的话，这条能力在手所在的位置够不着，而用户看不出为什么同一个键在两处行为不同。
       *
       * 从未启动过命令时 MUST NOT 接管：那时它没有事可做，吃掉事件只会让 `Enter` 变成一个
       * 黑洞，挡住既有键位级联。
       */
      if (!sessionRef.current && lastCommandRef.current === null) return false
      event.preventDefault()
      submit('')
      return true
    }
    if (event.key === 'Escape') {
      /*
       * 只有命令在跑时才吃 Esc。
       *
       * 曾经它在没有命令时也吃——那是累加选择语义的配套（点空白不清空，Esc 是唯一的清空
       * 入口）。语义统一成替换之后点空白就清空了，这条不再是唯一入口；而绘图能力恒开
       * 之后，继续吃 Esc 会**抢在文字编辑的退出分支之前**，用户在画布上改完字按 Esc
       * 会变成清空选择集而不是提交。
       */
      if (!sessionRef.current) return false
      event.preventDefault()
      cancel()
      return true
    }
    return false
  }, [cancel, enabled, submit, toggleAngleConstraint])

  // 选择集归宿主：命令等着选对象时，把**当前完整选择集**喂进去，并在它变化时重新喂。
  // 让命令会话自己拦截点选等于同一次点击有两个消费者，而用户无法预期哪一个赢。
  useEffect(() => {
    const session = sessionRef.current
    if (!enabled || !session) return
    if (session.prompt?.accepts.includes('selection') !== true) return
    applyStep(session.advance({ kind: 'selection', ids: selectedIds }))
  }, [applyStep, enabled, selectedIds])

  /**
   * 被作用对象的轮廓预览。
   *
   * @remarks
   * 完整幽灵渲染需要把绘图会话的位移接进仲裁器的 `previewTransforms` 通道，而绘图会话
   * 不在仲裁器里——它是 Stage 自己的状态。轮廓是刻意的近似。
   */
  const outlines = useMemo<readonly StageRect[]>(() => {
    if (!enabled || !preview) return []
    const targets = preview.translate?.entityIds ?? preview.duplicate?.entityIds ?? preview.removed
    if (!targets || targets.length === 0) return []
    const base = preview.reference
    const resolved = base && pointer ? resolvePointerPoint(pointer) : null
    const delta = base && resolved
      ? { x: resolved.x - base.x, y: resolved.y - base.y }
      : { x: 0, y: 0 }
    return targets
      .map((id) => index.getWorldBounds(id))
      .filter((rect): rect is StageRect => rect !== null)
      .map((rect) => ({ ...rect, x: rect.x + delta.x, y: rect.y + delta.y }))
  }, [enabled, index, pointer, preview, resolvePointerPoint])

  /**
   * 解算后的世界落点。
   *
   * @remarks
   * 十字线、橡皮筋终点、坐标读数、捕捉标记与几何编辑点亮期的预览读的**都是它**。各算一遍的
   * 症状是「十字线停在一处、点却落在另一处」，而这只在开着吸附时才现形。
   */
  const resolvedHit = useMemo(() => {
    if (!enabled || !pointer) return null
    return resolvePointerHit(pointer)
  }, [enabled, pointer, resolvePointerHit])
  const resolvedPointer = resolvedHit?.point ?? null
  useLayoutEffect(() => { livePointRef.current = resolvedPointer })

  /**
   * 候选落点：解算落点之上再叠一次「正在键入的那个值」。
   *
   * @remarks
   * 预览查询、十字光标、橡皮筋终点与标注几何全部读它——它们读同一个落点是既有约束，本条
   * 只是给那个落点多了一个来源。用户打了 `120` 却要按下回车才知道结果，而那时命令已经结束，
   * 错了只能撤销重来。
   *
   * 覆盖复用锁定用的那一个操作：锁定是「打完并按了 `Tab`」，这里是「正在打」，同一件事的
   * 两个时机。另写一份的症状是两条路径对同一个输入给出不同落点。
   *
   * 键入覆盖的永远是**活动**字段，锁定的永远是**非活动**字段（由 `advanceField` 的写法构造
   * 保证），因此两者不可能作用在同一个字段上，也就不需要定序。
   *
   * 缓冲解析不出一个数字时（空、`@100,` 这类半个坐标、关键字）退回跟着光标。猜一个会让图形
   * 在打字过程中乱跳，停在上一次能解析的值则会让删掉数字之后几何卡住不动。
   */
  const candidatePoint = useMemo(() => {
    if (!fieldKind || !resolvedPointer || !BARE_NUMBER.test(fieldText.trim())) return resolvedPointer
    return applyComposeFieldOverride(
      fieldKind, resolvedPointer, reference ?? undefined, activeField, Number(fieldText.trim()),
    )
  }, [activeField, fieldKind, fieldText, reference, resolvedPointer])
  /** 正在键入把落点带离了光标：连线与捕捉标记两处读同一份事实。 */
  const typedAway = candidatePoint !== resolvedPointer

  /**
   * 追踪射线：角度约束命中的那条，且落点确实还在它上面。
   *
   * @remarks
   * 命中由管线上报（`resolvedHit.ray`），这里只再验一件事——**锁定与键入覆盖排在约束之后**，
   * 它们能把点带离射线（锁死角度、或打一个坐标）。那时这条线就不再描述落点是怎么来的，画出来
   * 是在骗人。验证读的是最终候选落点，因此「画了射线但点没落在上面」不可能发生。
   */
  const trackingRay = useMemo(() => {
    const ray = resolvedHit?.ray ?? null
    if (ray === null || !reference || !candidatePoint) return null
    const dx = candidatePoint.x - reference.x
    const dy = candidatePoint.y - reference.y
    if (dx === 0 && dy === 0) return null
    const degrees = (Math.atan2(-dy, dx) * 180) / Math.PI
    // 归一化到 (-180, 180] 再比：0 与 360 是同一条射线。
    const delta = Math.abs(((degrees - ray + 540) % 360) - 180)
    return delta < 0.01 ? { origin: reference, degrees: ray } : null
  }, [candidatePoint, reference, resolvedHit])

  /**
   * 待定几何的世界折线；命令给不出预览时为 `null`。
   *
   * @remarks
   * 形状只有命令自己知道——两个对角点怎么变四个顶点、圆心加半径点怎么变整圆——因此这里只负责
   * 问一句并把结果拍成折线，不参与任何形状推导。
   *
   * 算在 `useLayoutEffect` 里而不是渲染期：`preview` 虽然是纯查询，但它读的是住在 ref 里的
   * 会话内部状态，而渲染期读 ref 会在并发渲染下读到撕裂的值。用 layout effect 是因为它在
   * 绘制**之前**跑完——放进普通 `useEffect` 会让预览比十字线慢一帧，而两者钉在同一个落点上
   * 正是这条链要保证的事。
   *
   * 只画第一条曲线：现有命令一步至多产出一条，多条时后面那些没有呈现语义可言。
   */
  const [previewOutline, setPreviewOutline] = useState<readonly StagePoint[] | null>(null)
  useLayoutEffect(() => {
    const session = sessionRef.current
    const effect = enabled && session?.preview && candidatePoint
      ? session.preview(candidatePoint)
      : null
    const segments = effect?.curves?.[0] ? composeCurveSegments(effect.curves[0]!) : []
    setPreviewOutline(
      segments.length === 0
        ? null
        : [segments[0]!.start, ...segments.map(({ end }) => end)],
    )
  }, [candidatePoint, enabled, sessionRevision])

  const rubberBand = useMemo(() => {
    // 预览几何在场时不画橡皮筋：两者回答同一个问题，叠在一起就是同一条线画两遍。
    if (previewOutline || !reference || !candidatePoint) return null
    return { start: reference, end: candidatePoint }
  }, [candidatePoint, previewOutline, reference])

  /**
   * 光标旁的动态输入。
   *
   * @remarks
   * 数值取**解算之后**的落点——与橡皮筋终点、十字光标、捕捉标记同一个值。读裸指针的话，
   * 开着栅格吸附时框里的数字会与线的终点对不上。
   *
   * 活动字段正在被键入时，框里显示的是那段文本而不是读数：用户打了什么就该看见什么。
   */
  // 十字线画在捕捉/正交求解**之后**的落点上：让它跟着裸光标走，用户会看见十字线与最终
  // 落点差着几个像素，而那正是他要对齐的地方。
  const pointerScreen = useMemo(
    () => (candidatePoint ? worldToScreen(candidatePoint, viewport) : null),
    [candidatePoint, viewport],
  )

  const dynamicInput = useMemo(() => {
    /*
     * 这一步只等一个数（`POLYGON` 的边数）：`fields` 说的是「这一步的**点**怎么参数化」，
     * 而这一步没有点，因此走不了下面那条路，但它同样需要被看见——命令行在图面底部，用户的
     * 眼睛此刻在光标上，「敲一个数」这句话说在他没有在看的地方等于没说。
     *
     * 只渲染不接输入：输入端仍然只有命令行一个。正在键入时印缓冲，否则印提示本身
     * （它里面就带着当前值，例如「输入边数 <6>」）。
     */
    if (enabled && cursorInput && pointerScreen) {
      // 没有键入过就印默认值，且淡下去：「这个数是我给的」与「这个数是默认的」必须一眼可分。
      const typing = fieldText.length > 0
      return resolveStageDynamicInputPrompt(
        pointerScreen,
        {
          text: typing ? fieldText : cursorInput.value,
          state: typing ? 'active' : 'ghost',
        },
        cursorInput.toggle?.value ?? null,
      )
    }

    if (!enabled || !awaitingPointForFields || !fieldKind || !candidatePoint) return null
    const values = composePointToFields(fieldKind, candidatePoint, reference ?? undefined)
    const raw = [values.first, values.second] as const
    // 角度带上单位：它是这两个字段里唯一一个不是长度的量。正在键入时不带——用户打了什么就
    // 该看见什么，凭空多一个字符会让他以为自己按到了别的键。
    const unit = fieldKind === 'polar' && '\u00B0'
    const field = (index: ComposePointFieldIndex) => {
      const locked = lockedFields[index]
      const typing = locked === null && index === activeField && fieldText.length > 0
      const state = locked !== null
        ? 'locked' as const
        : (index === activeField ? 'active' as const : 'idle' as const)
      if (typing) return { text: fieldText, state }
      const value = locked ?? raw[index]
      const suffix = unit && index === 1 ? unit : ''
      return { text: `${formatComposeNumber(value)}${suffix}`, state }
    }
    return resolveStageDynamicInput({
      kind: fieldKind,
      origin: reference ? worldToScreen(reference, viewport) : null,
      point: worldToScreen(candidatePoint, viewport),
      first: field(0),
      second: field(1),
      // 键入把落点带离光标时才有连线可画；两者重合时传 `null`，几何层因此不需要判断这件事。
      cursor: typedAway && resolvedPointer ? worldToScreen(resolvedPointer, viewport) : null,
      measured: prompt?.measured === true,
    })
  }, [
    activeField, awaitingPointForFields, candidatePoint, cursorInput, enabled, fieldKind,
    fieldText, lockedFields, pointerScreen, prompt?.measured, reference, resolvedPointer,
    typedAway, viewport,
  ])


  // 命令正在请求一个点：捕捉标记与十字线形态都读它，两处不得各判一次。
  const awaitingPoint = enabled && prompt?.accepts.includes('point') === true
  const awaitingPick = enabled && prompt?.accepts.includes('pick') === true

  /**
   * 拾取框底下的曲线 Entity；与点选同一个容差。
   *
   * @remarks
   * 取最上层命中的那一个（与点选一致），而不是另找最近的：两条判定给出两个答案时用户读不出
   * 为什么点选选中的和修剪剪掉的不是同一条。落在场景本体上不算——那是空白。
   */
  const pickTargetAt = useCallback((world: StagePoint): string | null => {
    const id = index.entityAtPoint(world, pickRadius / viewport.zoom)
    const entity = id ? document.entities[id] : undefined
    return entity && !isComposeFrameEntity(entity) ? id : null
  }, [document, index, pickRadius, viewport.zoom])

  /** 一截的呈现：世界折线、剪口与它自己的描边色，幽灵按这个颜色改成点画。 */
  const trimOverlayPiece = useCallback((piece: StageTrimPiece) => {
    const entity = document.entities[piece.entityId]
    const props = entity ? getComposeRenderer(entity)?.props as { stroke?: unknown } | undefined : undefined
    return {
      outline: piece.outline,
      cuts: piece.cuts,
      stroke: typeof props?.stroke === 'string' ? props.stroke : null,
    }
  }, [document])

  /**
   * 这一次 `pick` 是在剪还是在填。
   *
   * @remarks
   * 读**提示自己声明的徽标**而不是当前命令 id：宿主不认识任何一条命令的内部，这与「徽标由提示
   * 声明而不由宿主按命令 id 反推」是同一条边界的同一次应用——光标画什么、图面上预览什么，是
   * 同一幅画的两半，读同一份事实。
   */
  const cutting = awaitingPick && prompt?.badge === 'scissors'
  const hatching = awaitingPick && prompt?.badge === 'bucket'

  /**
   * 悬停预览：光标底下那一截，与落地读**同一份**解算。
   *
   * @remarks
   * 纯函数只读索引与文档，不读会话的 ref，因此可以在渲染期算；拖动中改画轨迹碰到的那些。
   */
  const trim = useMemo(() => {
    if (!cutting) return null
    if (pickTrail) {
      const seen = new Set<string>()
      const pieces = resolveStageTrailTargets(index, pickTrail, { isJunction: isStageJunctionEntity })
        .map((target) => resolveStageTrimPiece(index, target.id, target.point, { isJunction: isStageJunctionEntity }))
        .filter((resolution): resolution is Extract<typeof resolution, { status: 'ok' }> => resolution.status === 'ok')
        .map(({ piece }) => piece)
        .filter((piece) => {
          const key = `${piece.entityId}:${piece.from}:${piece.to}`
          if (seen.has(key)) return false
          seen.add(key)
          return true
        })
      return { pieces: pieces.map(trimOverlayPiece), trail: pickTrail }
    }
    if (!pointer) return null
    const id = pickTargetAt(pointer)
    if (!id) return { pieces: [], trail: null }
    const resolution = resolveStageTrimPiece(index, id, pointer, { isJunction: isStageJunctionEntity })
    return { pieces: resolution.status === 'ok' ? [trimOverlayPiece(resolution.piece)] : [], trail: null }
  }, [cutting, index, pickTargetAt, pickTrail, pointer, trimOverlayPiece])

  /**
   * 悬停预览：光标底下那块面，与落地读**同一份**解算。
   *
   * @remarks
   * 不共用同一份解算的话，「看见的那块面」与「填上的那块面」不是同一块——这与修剪那条约束
   * 逐字相同。
   *
   * 环按 `evenodd` 填，因此岛在预览里就是洞，与落地之后 `isPointInsideComposeCurve` 读出的
   * 是同一个答案：**看得见的洞与点不中的洞是同一个洞**这句话从预览这一刻就成立。
   *
   * 提示分两支而不是一句：改一个已有形状与新建一块是两件事，用户必须在松手**之前**知道会
   * 发生哪一件。
   */
  const hatch = useMemo(() => {
    if (!hatching || !pointer) return null
    const resolution = resolveStageHatchRegion(index, pointer, { isJunction: isStageJunctionEntity })
    if (resolution.status === 'rejected') return null
    return {
      rings: stageHatchPreviewRings(resolution.curve),
      color: activeHatchColor,
      target: resolution.status === 'fill' ? resolution.entityId : null,
    }
  }, [activeHatchColor, hatching, index, pointer])

  /**
   * 一次 `pick`：点一下是按下点底下那一截，拖一笔是轨迹碰到的每一截。
   *
   * @remarks
   * 点一下落在拒绝档上要**说出来**——「点了没反应」与点错在屏幕上无法区分；拖一笔里被拒绝的
   * 那些静默略过，用户没有逐条瞄准它们。落在空白处什么都不做。
   *
   * **填充那一档不找 target**：它的落点在**空处**，围出这块面的是谁由规划那一步解算，而
   * 光标底下有没有一条线与这一下的含义无关。这正是 `pick` 把落点提到顶层的理由。
   */
  const handlePick = useCallback((point: StagePoint, trail: readonly StagePoint[] | null) => {
    const session = sessionRef.current
    if (!session || session.prompt?.accepts.includes('pick') !== true) return
    const current = latest.current
    if (session.prompt.badge === 'bucket') {
      applyStep(session.advance({ kind: 'pick', point, targets: [] }))
      return
    }
    const junctionOptions = { isJunction: isStageJunctionEntity }
    if (trail) {
      const targets = resolveStageTrailTargets(current.index, trail, junctionOptions)
        .filter((target) => resolveStageTrimPiece(current.index, target.id, target.point, junctionOptions).status === 'ok')
      if (targets.length === 0) return
      applyStep(session.advance({ kind: 'pick', point, targets }))
      return
    }
    const id = pickTargetAt(point)
    if (!id) return
    const resolution = resolveStageTrimPiece(current.index, id, point, junctionOptions)
    if (resolution.status === 'rejected') {
      setNotice(current.messages.trimRejection(resolution.reason))
      return
    }
    applyStep(session.advance({ kind: 'pick', point, targets: [{ id, point }] }))
  }, [applyStep, pickTargetAt])

  /**
   * 光标够及范围内那个符号的**全部**端口。
   *
   * @remarks
   * 与捕捉标记回答两个不同的问题——标记说「落点吸上了什么」（一个点），这里说「这个符号上有
   * 哪些接线点」（一个符号的全部）。只显现最近的那一个时，用户读到的是「这里只有一个端子」，
   * 而接线图上端子密集，旁边那两个就此不可见。
   *
   * **只在取点期间求**：常驻会让一张接线图上多出几十个与几何无关的点，而此刻用户还没有在找
   * 接线点。容差与捕捉共用同一个数——「多近算靠近」在这个产品里只该有一个。
   */
  const revealedPorts = useMemo(() => {
    if (!awaitingPoint || !pointer) return null
    return collectStageRevealedPorts(document, index, pointer, featureTolerance)
  }, [awaitingPoint, document, featureTolerance, index, pointer])

  /**
   * 落笔会接上的那条导线的**整条**几何，世界坐标；不会接线时为 `null`。
   *
   * @remarks
   * 高亮整条而不只画那一个点：用户此刻要回答的是「我会接到哪条线上」，而密集图上两条平行导线
   * 只隔几个像素，只画一个点说不清它长在谁身上。
   *
   * 读的是**同一次捕捉**（`snap`），因此高亮的一定就是落笔真会接上的那条——各判一次的症状是
   * 「亮的是这条、接上的是那条」。
   */
  const revealedWire = useMemo<readonly StagePoint[] | null>(() => {
    if (!awaitingPoint || !snap) return null
    if (snap.mode !== 'endpoint' && snap.mode !== 'midpoint' && snap.mode !== 'nearest') return null
    const entity = document.entities[snap.entityId]
    const geometry = entity ? getComposeCurve(entity) : undefined
    const box = index.layoutSnapshot.boxes[snap.entityId]
    const matrix = index.getWorldMatrix(snap.entityId)
    if (!entity || !isStageWireEntity(entity) || !geometry || !box || !matrix) return null
    const segments = composeCurveSegments(projectComposeCurveToBox(geometry, box))
    if (segments.length === 0) return null
    // 相邻段共用端点，因此收成一条折线：各段起点 + 最后一段终点。
    return [
      ...segments.map((segment) => applyMatrix(matrix, segment.start)),
      applyMatrix(matrix, segments[segments.length - 1]!.end),
    ]
  }, [awaitingPoint, document, index, snap])

  return {
    index,
    // 几何编辑的夹点拖动读同一个解算：两份实现的分叉症状是「画线时吸端点、拖顶点时不吸」，
    // 而用户无法判断哪个才是对的。它同时带回落点的来源，导线的改接线因此与落点同源。
    resolvePoint: resolvePointerHit,
    pointerScreen,
    outlines,
    selectionCount: enabled && prompt?.accepts.includes('selection') === true
      ? selectedIds.length
      : null,
    awaitingPoint,
    /**
     * 这一步只等一个数：既不取点也不选对象。
     *
     * @remarks
     * 宿主拿它做一件事——**跟踪指针**，好把那个框画在光标旁。它不画十字光标：十字线的含义是
     * 「这里可以落一个点」，而这一步点下去什么都不会发生。
     */
    cursorInput: enabled ? cursorInput : null,
    awaitingSelection: enabled && prompt?.accepts.includes('selection') === true,
    /** 这一步等一个落在对象上的点：拾取框加徽标，不画十字线，不改选择集。 */
    awaitingPick,
    /** 提示声明的光标徽标；由提示自己声明而不由宿主按命令 id 反推。 */
    badge: enabled ? prompt?.badge ?? null : null,
    /** 修剪的悬停预览与拖动轨迹；不在等 `pick` 时为 `null`。 */
    trim,
    /** 填充的悬停预览；不在等填充落点时为 `null`。 */
    hatch,
    /** 上一次填充没能闭合时那些自由端的位置，世界坐标；没有就是空。 */
    hatchGaps: enabled ? hatchGaps : [],
    /** 这一次的填充色；不在等填充落点时为 `null`，桶身徽标印它。 */
    hatchColor: hatching ? activeHatchColor : null,
    pickTrail,
    setPickTrail,
    handlePick,
    pointerType,
    prompt: enabled ? prompt : null,
    notice: enabled ? notice : null,
    angleConstraint,
    setAngleConstraint,
    trackingRay,
    snapEnabled,
    /**
     * 捕捉标记读的候选。
     *
     * @remarks
     * **只在正在取点时给出**：命令等待取点，或几何编辑里有夹点被作用着（拖动或点亮）。
     * 几何编辑的空闲档没有落点可言——命令行提示就是「命令：」——而标记回答的正是「落点吸上了
     * 什么」，在别的对象的端点上亮起它会让用户以为那些对象也能改形状。AutoCAD 的对象捕捉标记
     * 同样只在命令正在请求一个点时出现。
     *
     * 判据读的是 `gripTarget` 这**同一份事实**，拾取框画不画读的也是它：两处各判一次必然
     * 漂移，而漂移的症状是「框收起来了、标记还亮着」。
     */
    /*
     * 正在键入把落点带离了特征点时收起标记：它回答的是「落点吸上了什么」，而此刻落点由
     * 键入的值决定，捕捉没有参与。
     */
    snap: enabled && !typedAway && (awaitingPoint || gripTarget !== null) ? snap : null,
    /** 落笔会接上的那条导线；与捕捉标记读同一次捕捉。 */
    revealedWire: enabled && !typedAway ? revealedWire : null,
    /** 取点期间显现的端口，世界坐标；不在取点时为空。 */
    revealedPorts: revealedPorts?.points ?? null,
    previewOutline,
    rubberBand,
    dynamicInput,
    /**
     * `Tab` 接管与文本回传只在这一档挂上去。
     *
     * @remarks
     * `Tab` 是键盘用户的焦点导航键，无条件劫持会把人困在命令行里；接管与否因此按「命令正在
     * 取点且这一步声明了**两个**字段」判断，与动态输入画几个框读同一份事实。
     *
     * 单字段（半径 / 直径）不接管：没有第二个字段可去。因此那一档也没有锁定——锁定是 `Tab`
     * 的产物，硬造出来的话移动鼠标不会改变任何东西，而屏幕上不该出现一个鼠标动了也没反应
     * 的状态。
     */
    advanceField: enabled && takesTab ? advanceField : null,
    setFieldText,
    // 拖动与点亮共用同一份事实：拾取框画不画、哪个夹点是热的、排除哪个点都读它。
    gripTarget,
    resolvedPointer,
    activeCommandId: enabled ? activeCommandId : null,
    /**
     * 命令行补全读的词汇表：内建与宿主注入的合成**同一份**，与提交时解析的是同一批定义。
     *
     * @remarks
     * 每次渲染现拼而不记忆化，理由与注册表在提交那一刻才建相同：宿主注入的定义携带跟着
     * 选择集走的可用性，引用不可能稳定，记忆化在这里挡不住任何东西。列表只在用户打字时
     * 才渲染，拼一次的代价是几十个引用的展开。
     */
    commandDescriptors: enabled ? [...builtInCommands, ...(hostCommands ?? [])] : null,
    acceptCommand,
    cancel,
    /** 修饰键滚轮的拦截谓词；交给画布滚轮 Hook 的 `interceptWheel`。 */
    handleWheel,
    clearNotice,
    setNotice: notify,
    handleKeyDown,
    handlePoint,
    setPointer,
    start,
    startGripSession,
    submit,
  }
}
