import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent } from 'react'
import {
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
  findStageFeaturePoint,
  planStageDraftingEdits,
  worldToScreen,
  type StageDraftingContext,
  type StageDraftingEffect,
  type StageDraftingMessages,
  type StageFeaturePoint,
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
}

const DEFAULT_SNAP_RADIUS = 12

/** 稳定引用的空排除表：每帧新建数组会让捕捉的记忆化整片失效。 */
const EMPTY_EXCLUSIONS: readonly string[] = []

/**
 * 绘图模式的命令会话。
 *
 * @remarks
 * 会话状态住在 Stage 而不是宿主：提示文本、橡皮筋预览与捕捉标记是同一份状态的三种呈现，
 * 交给宿主渲染意味着要把这三样逐帧回传，凭空造出一个跨包协议。`ComposeCadCanvas` 已经是
 * 这个形状。
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
  } = options

  const sessionRef = useRef<ComposeCommandSession<StageDraftingEffect> | null>(null)
  /** 本次命令里落在端口上的取点；键是解算后的世界坐标。 */
  const portAnchors = useRef(new Map<string, ComposeWireBinding>())
  /** 上一条成功启动的命令 id；空闲时的空确认按它重启。取消过的命令仍算数。 */
  const lastCommandRef = useRef<string | null>(null)
  const [prompt, setPrompt] = useState<ComposeCommandSession<StageDraftingEffect>['prompt']>(null)
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

  const commit = useCallback((effect: StageDraftingEffect | undefined) => {
    if (!effect) return
    const current = latest.current

    for (const curve of effect.curves ?? []) {
      const command = createStageDraftingCurveCommand({
        document: current.document,
        layoutSnapshot: current.layoutSnapshot,
        index: current.index,
        registry: current.registry,
        idFactory: current.idFactory,
        activeFrameId: current.activeFrameId,
      }, curve, effect.wire ? wireBindingsFor(portAnchors.current, curve) : undefined)
      if (command) current.dispatch(command)
    }

    // 平移、复制与删除只认识文档，因此由引擎规划成命令；宿主只负责派发。
    for (const command of planStageDraftingEdits({
      document: current.document,
      layoutSnapshot: current.layoutSnapshot,
      index: current.index,
      effect,
      idFactory: current.idFactory,
    })) {
      current.dispatch(command)
    }

    // 已删标识留在选择集里会指向不存在的 Entity，随后任何以选择集为输入的命令都会拿到
    // 幽灵目标。AutoCAD 里 ERASE 之后选择集也是空的。
    if (effect.removed && effect.removed.length > 0) current.onSelectedIdsChange([])
  }, [])

  const endSession = useCallback((message: string | null) => {
    sessionRef.current = null
    portAnchors.current.clear()
    setPrompt(null)
    setReference(null)
    setPreview(null)
    setNotice(message)
  }, [])

  const applyStep = useCallback((step: ReturnType<ComposeCommandSession<StageDraftingEffect>['advance']>) => {
    if (step.status === 'prompt') {
      commit(step.commit)
      setPrompt(step.prompt)
      setReference(step.preview?.reference ?? step.commit?.reference ?? null)
      setPreview(step.preview ?? null)
      setNotice(null)
      return
    }
    if (step.status === 'commit') {
      commit(step.effect)
      endSession(null)
      return
    }
    if (step.status === 'cancelled') {
      endSession(messages.cancelled)
      return
    }
    // rejected **不结束会话**：点错、打错在这类工具里是常态，结束命令会让用户从头再来。
    setNotice(step.message)
  }, [commit, endSession, messages.cancelled])

  /** 光标附近的捕捉命中；同时用于渲染标记与求解落点，两者因此不可能分叉。 */
  const excluded = snapExcludedIds ?? EMPTY_EXCLUSIONS
  const snap: StageFeaturePoint | null = useMemo(() => {
    if (!enabled || !snapEnabled || !pointer) return null
    return findStageFeaturePoint(document, index, pointer, snapRadius / viewport.zoom, excluded)
  }, [document, enabled, excluded, index, pointer, snapEnabled, snapRadius, viewport.zoom])

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
      ? findStageFeaturePoint(document, index, world, snapRadius / viewport.zoom, excluded)
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
  }, [document, excluded, gridSettings, index, ortho, reference, snapEnabled, snapRadius, viewport.zoom])

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
    }
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
    setPrompt(outcome.session.prompt)
  }, [applyStep, messages])

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

  const rubberBand = useMemo(() => {
    if (!enabled || !reference || !pointer) return null
    return { start: reference, end: resolvePointerPoint(pointer) }
  }, [enabled, pointer, reference, resolvePointerPoint])

  // 十字线画在捕捉/正交求解**之后**的落点上：让它跟着裸光标走，用户会看见十字线与最终
  // 落点差着几个像素，而那正是他要对齐的地方。
  const pointerScreen = useMemo(() => {
    if (!enabled || !pointer) return null
    return worldToScreen(resolvePointerPoint(pointer), viewport)
  }, [enabled, pointer, resolvePointerPoint, viewport])

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
    awaitingPoint: enabled && prompt?.accepts.includes('point') === true,
    awaitingSelection: enabled && prompt?.accepts.includes('selection') === true,
    pointerType,
    prompt: enabled ? prompt : null,
    notice: enabled ? notice : null,
    ortho,
    snapEnabled,
    snap: enabled ? snap : null,
    rubberBand,
    cancel,
    handleKeyDown,
    handlePoint,
    setPointer,
    submit,
  }
}
