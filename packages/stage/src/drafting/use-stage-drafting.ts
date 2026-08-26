import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent } from 'react'
import {
  composeCurveSegments,
  parseComposeCoordinate,
  resolveComposePoint,
  type ComposeDocument,
  type ComposeInputPoint,
  type ComposeLayoutSnapshot,
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
  createStageDraftingCommands,
  createStageGripSession,
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
import type { ComposeStageDispatch } from '../types'
import { anchorKey, createStageDraftingCurveCommand, wireBindingsFor } from './drafting-entity'

/** 绘图模式需要的额外文案。 @internal */
export interface StageDraftingHookMessages extends StageDraftingMessages {
  readonly ready: string
  readonly commandLineLabel: string
  readonly commandPlaceholder: string
  readonly keywordsPrefix: string
  readonly unknownCommand: string
  readonly cancelled: string
  readonly orthoOn: string
  readonly orthoOff: string
  readonly snapOn: string
  readonly snapOff: string
  /** 夹点几何变更的撤销标签。 */
  readonly editGeometry: (name: string) => string
  /** 端口与线段不在同一父级、因此没能绑上时的说明。 */
  readonly wireParentMismatch: string
}

/** {@link useStageDrafting} 的输入。 @internal */
export interface StageDraftingOptions {
  readonly enabled: boolean
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
  /** 捕捉的屏幕半径（CSS 像素）。 @defaultValue 12 */
  readonly snapRadius?: number
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

const DEFAULT_SNAP_RADIUS = 12

/** 稳定引用的空排除表：每帧新建数组会让捕捉的记忆化整片失效。 */
const EMPTY_EXCLUSIONS: readonly string[] = []

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
    snapRadius = DEFAULT_SNAP_RADIUS,
    snapExcludedIds,
    index,
    onEnterGeometryEditing,
    isGeometryEditable,
  } = options

  const sessionRef = useRef<ComposeCommandSession<StageDraftingEffect> | null>(null)
  /** 本次命令里落在端口上的取点；键是解算后的世界坐标。 */
  const portAnchors = useRef(new Map<string, ComposeWireBinding>())
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
  const [pointer, setPointerPoint] = useState<StagePoint | null>(null)
  // 指针类型只服务触摸豁免：触摸屏上没有光标，十字光标对它毫无意义，而这个判断只有事件
  // 本身知道。
  const [pointerType, setPointerType] = useState('mouse')
  const setPointer = useCallback((point: StagePoint | null, type = 'mouse') => {
    setPointerPoint(point)
    setPointerType(type)
  }, [])
  const [ortho, setOrtho] = useState(false)
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
  }
  const latest = useRef(snapshot)
  useLayoutEffect(() => {
    latest.current = snapshot
  })

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

    for (const curve of effect.curves ?? []) {
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
        // 因此不写 `Wire`——没碰过端口的普通线一个字节都不变。
        wire: wireBindingsFor(portAnchors.current, curve),
        ...(effect.arrow ? { arrow: true } : {}),
      })
      if (!created) continue
      current.dispatch(created.command)
      // 跨父级的绑定被丢掉了就必须说出来：静默丢弃与「绑上了」在屏幕上无法区分。
      if (created.droppedWireEnds.length > 0) notice = current.messages.wireParentMismatch
    }

    // 平移、复制、删除与夹点几何只认识文档，因此由引擎规划成命令；宿主只负责派发。
    for (const command of planStageDraftingEdits({
      document: current.document,
      layoutSnapshot: current.layoutSnapshot,
      index: current.index,
      effect,
      idFactory: current.idFactory,
      // 绑定来自**取点时记下的来源**，与新建导线读的是同一张表。
      ...(effect.curveGrip
        ? (() => {
            const port = portAnchors.current.get(anchorKey(effect.curveGrip.point))
            return port ? { wireBinding: port } : {}
          })()
        : {}),
      curveLabel: current.messages.editGeometry,
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
  }, [])

  const endSession = useCallback((message: string | null) => {
    sessionRef.current = null
    setActiveCommandId(null)
    portAnchors.current.clear()
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
    if (step.status === 'commit') {
      endSession(commit(step.effect))
      return
    }
    if (step.status === 'cancelled') {
      endSession(messages.cancelled)
      return
    }
    // rejected **不结束会话**：点错、打错在这类工具里是常态，结束命令会让用户从头再来。
    setNotice(step.message)
  }, [commit, endSession, messages.cancelled, setPrompt])

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
    )
  }, [document, enabled, excluded, featureTolerance, index, pointer, snapEnabled, snapExcludedPoint])

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
  } => {
    const hit = snapEnabled
      ? findStageFeaturePoint(document, index, world, featureTolerance, excluded, snapExcludedPoint)
      : null
    const point = resolveComposePoint(world, 'pointer', {
      ...(hit ? { snapped: hit.point } : {}),
      ...(reference ? { reference } : {}),
      ortho,
      grid: gridSettings,
    })
    return hit?.mode === 'port' && hit.portId
      ? { point, port: { entityId: hit.entityId, portId: hit.portId } }
      : { point }
  }, [
    document, excluded, featureTolerance, gridSettings, index, ortho, reference,
    snapEnabled, snapExcludedPoint,
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
    const { point, port } = resolvePointerHit(world)
    // 导线的绑定来自**取点时记下的来源**，不是事后按坐标反查已有端口：反查会让一条恰好路过
    // 端口的普通线莫名其妙地绑上，而那个绑定在屏幕上完全不可见。键入的坐标因此永远不绑——
    // 它没有来源可言。
    if (port) portAnchors.current.set(anchorKey(point), port)
    applyStep(session.advance({ kind: 'point', point }))
  }, [applyStep, resolvePointerHit])

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
    const context: StageDraftingContext = {
      messages,
      // 先选后执行：命令要么在启动上下文里拿到目标，要么自己提示选择。
      selection: latest.current.selectedIds,
      ...(latest.current.isGeometryEditable
        ? { isGeometryEditable: latest.current.isGeometryEditable }
        : {}),
    }
    setGripTarget(null)
    setReference(null)
    setPreview(null)
    setNotice(null)
    // 「`prompt` 为 null 就立即 accept」只有一处实现（`runComposeCommandImmediately`）：先选好
    // 对象再敲 `E↵` 对象当场就删，走的正是这一支，宿主一次性动作走的也是它。
    const outcome = runComposeCommandImmediately(definition, context)
    lastCommandRef.current = definition.id
    if (outcome.status === 'ran') {
      applyStep(outcome.step)
      return
    }
    sessionRef.current = outcome.session
    setActiveCommandId(definition.id)
    setPrompt(outcome.session.prompt)
  }, [applyStep, messages, setPrompt])

  /**
   * 由手势启动一条夹点取点会话。
   *
   * @remarks
   * 与按名启动并列的第二个入口：本会话由手势启动而不由词启动，因此没有名字，也不进
   * 「重复上一条命令」的序列——那条记的是命令名，而这里没有名可记。
   *
   * `reference` 设成夹点的**原**位置，橡皮筋与相对坐标的参照因此白拿。
   */
  const startGripSession = useCallback((target: StageGripTarget) => {
    // 文案从 ref 读：宿主每帧新建的 messages 若进依赖数组，会让 `applyStep` 每帧换身份，
    // 而「把选择集喂给会话」那条 effect 依赖它——effect 每帧重跑又每帧 setState，就是死循环。
    const session = createStageGripSession(latest.current.messages, target)
    sessionRef.current = session
    portAnchors.current.clear()
    setGripTarget(target)
    setPrompt(session.prompt)
    setReference(target.origin)
    setPreview(null)
    setNotice(null)
  }, [setPrompt])

  /** 清掉命令行上残留的说明。进入几何编辑时调用：用户此刻站在一个会取点的状态里。 */
  const clearNotice = useCallback(() => { setNotice(null) }, [])

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

    const parsed = parseComposeCoordinate(trimmed, reference ?? undefined)
    if (parsed.ok) {
      // 键入的坐标是精确值，不再经过捕捉、正交与网格。
      const point = resolveComposePoint(parsed.point, 'typed', { ortho, grid: gridSettings })
      applyStep(session.advance({ kind: 'point', point }))
      return
    }
    if (parsed.reason === 'missing-reference') {
      setNotice(messages.expectedPoint)
      return
    }
    applyStep(session.advance({ kind: 'keyword', key: trimmed }))
  }, [applyStep, gridSettings, messages, ortho, reference, start])

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
   * 两个键都只在**确实有事可做**时接管，否则交还既有键位级联：`Enter` 没有会话时无所作为，
   * `Esc` 没有会话且选择集为空时同理，而设计模式的 `Esc` 还要负责中止进行中的指针手势。
   */
  const handleKeyDown = useCallback((event: ReactKeyboardEvent<Element>) => {
    if (!enabled) return false
    if (event.key === 'F8') {
      event.preventDefault()
      setOrtho((value) => !value)
      return true
    }
    if (event.key === 'F3') {
      event.preventDefault()
      setSnapEnabled((value) => !value)
      return true
    }
    if (isEditableTarget(event.target)) return false
    if (event.key === 'Enter') {
      if (!sessionRef.current) return false
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
  }, [cancel, enabled, submit])

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
  const resolvedPointer = useMemo(() => {
    if (!enabled || !pointer) return null
    return resolvePointerPoint(pointer)
  }, [enabled, pointer, resolvePointerPoint])

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
    const curve = enabled && session?.preview && resolvedPointer
      ? session.preview(resolvedPointer)?.curves?.[0]
      : undefined
    const segments = curve ? composeCurveSegments(curve) : []
    setPreviewOutline(
      segments.length === 0
        ? null
        : [segments[0]!.start, ...segments.map(({ end }) => end)],
    )
  }, [enabled, resolvedPointer, sessionRevision])

  const rubberBand = useMemo(() => {
    // 预览几何在场时不画橡皮筋：两者回答同一个问题，叠在一起就是同一条线画两遍。
    if (previewOutline || !reference || !resolvedPointer) return null
    return { start: reference, end: resolvedPointer }
  }, [previewOutline, reference, resolvedPointer])

  // 十字线画在捕捉/正交求解**之后**的落点上：让它跟着裸光标走，用户会看见十字线与最终
  // 落点差着几个像素，而那正是他要对齐的地方。
  const pointerScreen = useMemo(
    () => (resolvedPointer ? worldToScreen(resolvedPointer, viewport) : null),
    [resolvedPointer, viewport],
  )

  // 命令正在请求一个点：捕捉标记与十字线形态都读它，两处不得各判一次。
  const awaitingPoint = enabled && prompt?.accepts.includes('point') === true

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
    awaitingSelection: enabled && prompt?.accepts.includes('selection') === true,
    pointerType,
    prompt: enabled ? prompt : null,
    notice: enabled ? notice : null,
    ortho,
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
    snap: enabled && (awaitingPoint || gripTarget !== null) ? snap : null,
    previewOutline,
    rubberBand,
    // 拖动与点亮共用同一份事实：拾取框画不画、哪个夹点是热的、排除哪个点都读它。
    gripTarget,
    resolvedPointer,
    activeCommandId: enabled ? activeCommandId : null,
    acceptCommand,
    cancel,
    clearNotice,
    handleKeyDown,
    handlePoint,
    setPointer,
    start,
    startGripSession,
    submit,
  }
}
