import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent } from 'react'
import {
  CAD_DEFAULT_LAYER_ID,
  createCadBlockCommand,
  createCadEraseCommand,
  createCadInsertCommand,
  createCadInteractionPlugins,
  createCadLineCommand,
  createCadPluginRegistry,
  createCadSceneIndex,
  createCadSessionArbiter,
  collectCadVisibleSegments,
  findCadHit,
  parseCadCoordinate,
  pruneCadSelection,
  resolveCadPoint,
  type CadCommandContext,
  type CadCommandEffect,
  type CadDocument,
  type CadInputPoint,
  type CadInteractionContext,
  type CadInteractionEffect,
  type CadInteractionSnapshot,
  type CadPluginContext,
} from '@compose-ui/cad'
import {
  createComposeCommandRegistry,
  type ComposeCommandInput,
  type ComposeCommandPrompt,
  type ComposeCommandSession,
} from '@compose-ui/commands'
import { createRulerTicks, formatComposeNumber, type EditorCommand } from '@compose-ui/core'
import { useComposeI18nContext } from '@compose-ui/ui-context'
import { getCadCanvasMessages } from './cad-canvas-i18n'
import { CadCommandLine } from './command-line'
import {
  ComposeCanvasRulers,
  useCanvasSurfaceSize,
  type ComposeCanvasRulersHandle,
} from '@compose-ui/canvas-kit'
import { CAD_GRID } from './grid'
import { useCadIndicatedPoint } from './indicated-point'
import {
  CadSurface,
  type CadCrosshair,
  type CadPreviewSegment,
  type CadSurfacePointerEvent,
} from './canvas-surface'
import { CAD_INITIAL_VIEWPORT, type CadViewport } from './viewport'

/**
 * 受控 CAD 编辑画布的属性。
 *
 * @public
 */
export interface ComposeCadCanvasProps {
  /** 当前文档；由宿主的事务运行时提供。 */
  readonly document: CadDocument
  /** 派发一条文档命令；返回是否被接受。 */
  readonly onDispatch: (command: EditorCommand) => void
  /** 生成稳定 ID；宿主可注入确定性实现以便测试。 */
  readonly idFactory?: () => string
  /** 新图元落在哪个图层。 @defaultValue 默认图层 `0` */
  readonly activeLayerId?: string
  /** 网格步长（世界单位）。 @defaultValue 10 */
  readonly gridStep?: number
  /** 对象捕捉的屏幕半径（CSS 像素）。 @defaultValue 12 */
  readonly snapRadius?: number
  /**
   * 点选命中的屏幕容差（CSS 像素）。
   *
   * @remarks
   * 只作用于点选；框选走几何包含，不受它影响。线宽只有 1px，容差太小时用户会反复点空——
   * 悬停高亮让容差变得可见，但触控板的落点精度本就到不了几个像素。
   *
   * @defaultValue 8
   */
  readonly pickRadius?: number
  /**
   * 十字线单侧长度占视口较短边的百分比。
   *
   * @remarks
   * 语义与 AutoCAD 的 `CURSORSIZE` 一致（1–100），按图面较短边取百分比。
   *
   * 默认 15 而不是 AutoCAD 的 5：5% 是在整块显示器上取的，图面只是编辑器里的一块面板，同样的
   * 百分比会小到看不出是十字线。也不取 100——贯穿全视口的十字线在这个尺寸的面板里会盖住整幅
   * 图，反而干扰读图。需要全屏十字线（很多 AutoCAD 老手的习惯）时由宿主传 100。
   *
   * @defaultValue 15
   */
  readonly crosshairSize?: number
  /**
   * 是否绘制十字光标并隐藏系统光标。
   *
   * @remarks
   * 隐藏系统光标会一并丢掉操作系统的光标辅助设置（放大光标、高对比光标），而这一需求无法被
   * 探测——没有对应的媒体查询。因此必须留一个出口。
   *
   * @defaultValue true
   */
  readonly showCrosshair?: boolean
  /**
   * 是否显示上边与左侧标尺。
   *
   * @remarks
   * AutoCAD 没有标尺——无限图纸上钉在视口边缘的标尺不如坐标读数加网格有用。这里默认开启是
   * 一处有意偏离：本产品的用户是从页面编辑器过来的实施工程师而不是 AutoCAD 老手，两块画布
   * 行为一致的价值更高。
   *
   * @defaultValue true
   */
  readonly showRulers?: boolean
}

function defaultIdFactory() {
  if (typeof globalThis.crypto?.randomUUID === 'function') return globalThis.crypto.randomUUID()
  return `cad-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

const EMPTY_INTERACTION: CadInteractionSnapshot = { selection: [], marquee: null }

/**
 * AutoCAD 风格的 CAD 编辑画布。
 *
 * @remarks
 * **命令由键盘启动**：键入 `L↵` 开始画线，随后画布上的点击成为命令的一步输入。本组件不理解
 * 任何命令有几步——状态机住在 `@compose-ui/cad`，协议住在 `@compose-ui/commands`。
 *
 * **同一次左键按下有三种互斥含义**：交给活动命令当一个点、点中图元、在空白处拉框。谁赢由
 * `@compose-ui/interaction-kernel` 的仲裁器按声明的优先级决定，本组件只负责归一化输入、执行
 * 插件发出的效果、渲染提示与预览。
 *
 * @public
 */
export function ComposeCadCanvas({
  document,
  onDispatch,
  idFactory = defaultIdFactory,
  activeLayerId = CAD_DEFAULT_LAYER_ID,
  gridStep = 10,
  snapRadius = 12,
  pickRadius = 8,
  crosshairSize = 15,
  showCrosshair = true,
  showRulers = true,
}: ComposeCadCanvasProps) {
  const i18n = useComposeI18nContext()
  const messages = getCadCanvasMessages(i18n?.locale ?? 'zh-CN')
  const [viewport, setViewport] = useState<CadViewport>(CAD_INITIAL_VIEWPORT)
  const surfaceRef = useRef<HTMLDivElement | null>(null)
  const rulersRef = useRef<ComposeCanvasRulersHandle>(null)
  const { size: surfaceSize } = useCanvasSurfaceSize(surfaceRef)
  const [prompt, setPrompt] = useState<ComposeCommandPrompt | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [preview, setPreview] = useState<readonly CadPreviewSegment[]>([])
  const [ortho, setOrtho] = useState(false)
  const [gridEnabled, setGridEnabled] = useState(true)
  const [snapEnabled, setSnapEnabled] = useState(true)
  const [interaction, setInteraction] = useState<CadInteractionSnapshot>(EMPTY_INTERACTION)
  // 后续相对输入的参照点由会话给出：「放弃」会退回上一个顶点，宿主自行记账会与会话失步。
  const [reference, setReference] = useState<CadInputPoint | undefined>(undefined)
  // 活动会话不进 state：它是可变对象，进 state 既不会触发正确的重渲染，也会让「同一次命令」
  // 在严格模式的双调用下变成两个。
  const sessionRef = useRef<ComposeCommandSession<CadCommandEffect> | null>(null)

  /**
   * 命令行输入框是**常驻的键盘落点**。
   *
   * @remarks
   * AutoCAD 里光标从不需要挪回命令行：点完图面直接敲 `F↵` 就结束，键入的坐标也直接进命令行。
   * 而 SVG 图面不可聚焦，一次点击会把焦点甩到 `body`——此后关键字与坐标全部落空，用户看到的
   * 是「点了两下然后回车没反应」。因此挂载时聚焦一次，每次在图面上按下再收回来。
   */
  const commandInputRef = useRef<HTMLInputElement | null>(null)
  const focusCommandLine = useCallback(() => {
    // preventScroll：图面通常比可视区大，聚焦引发的滚动会把画布挪走。
    commandInputRef.current?.focus({ preventScroll: true })
  }, [])
  useEffect(focusCommandLine, [focusCommandLine])

  const registry = useMemo(
    () => createComposeCommandRegistry<CadCommandContext, CadCommandEffect>([
      createCadLineCommand(messages),
      createCadEraseCommand(messages),
      createCadBlockCommand(messages),
      createCadInsertCommand(messages),
    ]),
    [messages],
  )

  const endSession = useCallback((noticeText: string | null) => {
    sessionRef.current = null
    setPrompt(null)
    setPreview([])
    setReference(undefined)
    setNotice(noticeText)
  }, [])

  const applyStep = useCallback((session: ComposeCommandSession<CadCommandEffect>, input: ComposeCommandInput) => {
    const step = session.advance(input)
    if (step.status === 'prompt') {
      setPrompt(step.prompt)
      setPreview(step.preview?.segments ?? [])
      setReference(step.preview?.reference)
      setNotice(null)
      return
    }
    if (step.status === 'rejected') {
      // 拒绝不结束会话：提示原样保留，只把原因显示出来。
      setNotice(step.message)
      return
    }
    if (step.status === 'commit') {
      if (step.effect.command) onDispatch(step.effect.command)
      // 被删掉的 id 留在选择集里会指向不存在的 Entity，随后任何以选择集为输入的命令都会拿到
      // 幽灵目标。
      const removed = step.effect.removed
      if (removed && removed.length > 0) {
        const gone = new Set(removed)
        setInteraction((current) => ({
          ...current,
          selection: pruneCadSelection(current.selection, (id) => !gone.has(id)),
        }))
      }
    }
    endSession(step.status === 'cancelled' ? messages.cancelled : null)
  }, [endSession, messages.cancelled, onDispatch])

  /**
   * 启动一条命令，并在它「没有要等的输入」时立刻推进。
   *
   * @remarks
   * `prompt` 为 `null` 表示命令从启动上下文里已经拿全了所需信息——先选好对象再敲 `E↵`，对象
   * 当场就删。没有这一档的话，宿主只能靠认识命令 id 来特判。
   */
  const startSession = useCallback((session: ComposeCommandSession<CadCommandEffect>) => {
    sessionRef.current = session
    setPreview([])
    setNotice(null)
    if (session.prompt === null) {
      applyStep(session, { kind: 'accept' })
      return
    }
    setPrompt(session.prompt)
  }, [applyStep])

  const pointContext = useMemo(() => ({
    reference,
    ortho,
    grid: { enabled: gridEnabled, step: gridStep },
  }), [gridEnabled, gridStep, ortho, reference])

  // 指示点是十字光标、橡皮筋终点、坐标读数与捕捉标记的唯一来源；它不属于任何手势会话。
  const { indicated, setPointerScreen } = useCadIndicatedPoint({
    document, viewport, prompt, pointContext, snapEnabled, snapRadius,
  })
  const snap = indicated?.snap ?? null

  const pointerPoint = indicated?.world ?? null
  /**
   * 提交一个点时用的完整求解上下文。
   *
   * @remarks
   * 必须带上当前捕捉点：`pointContext` 只含参照点、正交与网格，少了 `snapped` 会让按下不再
   * 吸到特征点上——而橡皮筋和十字线仍然吸着，用户看到的是「明明吸住了，落点却偏了」。
   */
  const resolutionContext = useMemo(
    () => ({ ...pointContext, snapped: snap?.point }),
    [pointContext, snap],
  )

  /**
   * 跟随指针的橡皮筋。
   *
   * @remarks
   * 不进命令状态机：让会话认识指针位置意味着每次移动都要 `advance` 一次，撤销、取消与「放弃
   * 上一个顶点」的边界全都要重新定义。两个端点宿主本来就有——参照点来自会话给的
   * `preview.reference`，落点来自上面的 `pointerPoint`。
   */
  /**
   * 十字光标的形态。
   *
   * @remarks
   * 三种形态与 AutoCAD 一致，判据是**当前等待的输入类型**——`accepts` 本来就在协议里，不需要
   * 引入任何新状态。既不取点也不选对象的步骤（例如 INSERT 等块名）不画：那一步键盘才是输入
   * 设备。
   *
   * 触摸指针不画也不隐藏系统光标——触摸屏上根本没有光标可言。
   */
  const crosshair = useMemo<CadCrosshair | null>(() => {
    if (!showCrosshair || !indicated || indicated.pointerType === 'touch') return null
    const lines = prompt === null || prompt.accepts.includes('point')
    const box = prompt === null || prompt.accepts.includes('selection')
    if (!lines && !box) return null
    return { screen: indicated.screen, lines, box, boxRadius: pickRadius, size: crosshairSize }
  }, [crosshairSize, indicated, pickRadius, prompt, showCrosshair])

  const rulerTicks = useMemo(() => {
    const shared = { step: CAD_GRID.step, offset: 0, primaryLineEvery: CAD_GRID.primaryLineEvery }
    return {
      horizontal: createRulerTicks({
        ...shared, viewportOffset: viewport.offset.x, zoom: viewport.zoom, length: surfaceSize.width,
      }),
      vertical: createRulerTicks({
        ...shared, viewportOffset: viewport.offset.y, zoom: viewport.zoom, length: surfaceSize.height,
      }),
    }
  }, [surfaceSize.height, surfaceSize.width, viewport])

  /** 选择集的世界包围盒；标尺据此画出区间条与尺寸。 */
  const selectionBounds = useMemo(() => {
    const selected = new Set(interaction.selection)
    if (selected.size === 0) return null
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    for (const { ownerId, segment } of collectCadVisibleSegments(document)) {
      if (!selected.has(ownerId)) continue
      minX = Math.min(minX, segment.start.x, segment.end.x)
      minY = Math.min(minY, segment.start.y, segment.end.y)
      maxX = Math.max(maxX, segment.start.x, segment.end.x)
      maxY = Math.max(maxY, segment.start.y, segment.end.y)
    }
    if (!Number.isFinite(minX)) return null
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
  }, [document, interaction.selection])

  // 标尺游标走命令式接口：指针移动是高频事件，每次移动重渲染整条标尺不划算。
  useEffect(() => {
    rulersRef.current?.setCursor(indicated ? indicated.screen : null)
  }, [indicated])

  const previewSegments = useMemo<readonly CadPreviewSegment[]>(() => {
    if (!reference || !pointerPoint || !prompt?.accepts.includes('point')) return preview
    return [...preview, { start: reference, end: pointerPoint, pending: true }]
  }, [pointerPoint, preview, prompt, reference])

  /**
   * 指针**会选中**的图元。
   *
   * @remarks
   * 判据是「这一下按下会不会产生选择」而不是「离得近不近」：命令正在吃点时按下是给命令的一个
   * 点，此时高亮会撒谎。容差与选择插件同源，两处分叉就会出现「亮着却点不中」。
   */
  const hovered = useMemo(() => {
    if (!indicated || prompt?.accepts.includes('point')) return null
    return findCadHit(document, indicated.raw, pickRadius / viewport.zoom)
  }, [document, indicated, pickRadius, prompt, viewport.zoom])

  const handleSubmit = useCallback((text: string) => {
    const session = sessionRef.current
    if (session) {
      if (text.trim().length === 0) {
        applyStep(session, { kind: 'accept' })
        return
      }
      // 键入的文本**先当坐标解析**，失败才按关键字处理——坐标写法住在宿主，命令状态机不认识
      // `@10,20` 这类语法。只有本步接受点时才尝试，否则 `100,50` 会在只收关键字的步骤上
      // 被误解成一个点。
      if (prompt?.accepts.includes('point')) {
        const parsed = parseCadCoordinate(text, reference)
        if (parsed.ok) {
          // 键入的坐标是精确值，不再经过正交与网格。
          applyStep(session, { kind: 'point', point: resolveCadPoint(parsed.point, 'typed', resolutionContext) })
          return
        }
        if (parsed.reason === 'missing-reference') {
          setNotice(messages.needsReference)
          return
        }
      }
      // 自由文本（块名）排在坐标之后、关键字之前：块名是任意输入，关键字是命令列出的有限
      // 集合，两者靠本步的 accepts 区分而不是靠猜内容。
      if (prompt?.accepts.includes('text')) {
        applyStep(session, { kind: 'text', text })
        return
      }
      applyStep(session, { kind: 'keyword', key: text })
      return
    }
    if (text.trim().length === 0) return
    const command = registry.resolve(text)
    if (!command) {
      setNotice(`${messages.unknownCommand}: ${text.trim()}`)
      return
    }
    startSession(command.start({
      layerId: activeLayerId,
      idFactory,
      selection: interaction.selection,
      // 块列表现取：刚建的块要能立刻插入，缓存一份会让 BLOCK 之后的第一次 INSERT 找不到它。
      blocks: Object.values(document.blocks).map(({ id, name }) => ({ id, name })),
      messages,
    }))
  }, [
    activeLayerId, applyStep, document.blocks, idFactory, interaction.selection, messages,
    prompt, reference, registry, resolutionContext, startSession,
  ])

  /**
   * Escape 的两级语义。
   *
   * @remarks
   * 有活动命令时取消命令——AutoCAD 的 Esc 是**中止整条命令**而不是退一步，退一步由命令自己
   * 的「放弃」关键字表达。没有活动命令时清空选择集。
   */
  const handleCancel = useCallback(() => {
    const session = sessionRef.current
    if (session) {
      applyStep(session, { kind: 'cancel' })
      return
    }
    setInteraction((current) => (
      current.selection.length === 0 && current.marquee === null
        ? current
        : EMPTY_INTERACTION
    ))
    setNotice(messages.selectionCleared)
  }, [applyStep, messages.selectionCleared])

  // ---- 交互仲裁 ----

  const arbiterRef = useRef(
    createCadSessionArbiter(createCadPluginRegistry(createCadInteractionPlugins())),
  )
  // 插件上下文每次事件现拼：它必须与事件同一求解周期，缓存下来会让插件读到上一帧的文档。
  // 值从 ref 读而不是进依赖数组：指针处理器要保持引用稳定，否则图面上的监听每帧换身份。
  const latest = useRef({ document, prompt, interaction, pickRadius, zoom: viewport.zoom })
  useLayoutEffect(() => {
    latest.current = { document, prompt, interaction, pickRadius, zoom: viewport.zoom }
  })

  const runEffects = useCallback((effects: readonly CadInteractionEffect[]) => {
    for (const effect of effects) {
      // 指针捕获由图面自己按「按下是否被接管」处理，这里不重复执行。
      if (effect.kind === 'pointer.capture' || effect.kind === 'pointer.release') continue
      const session = sessionRef.current
      if (!session) continue
      if (effect.kind === 'command.point') {
        applyStep(session, { kind: 'point', point: resolveCadPoint(effect.point, 'pointer', resolutionContext) })
        continue
      }
      applyStep(session, { kind: 'selection', ids: effect.ids })
    }
  }, [applyStep, resolutionContext])

  const pluginContext = useCallback((): CadPluginContext => {
    const snapshot = latest.current
    const context: CadInteractionContext = {
      document: snapshot.document,
      prompt: snapshot.prompt,
      selection: snapshot.interaction.selection,
      // 容差按屏幕像素给出、除以缩放换成世界单位：命中本质是屏幕概念，与捕捉半径同理。
      hitTolerance: snapshot.pickRadius / snapshot.zoom,
    }
    return {
      context,
      index: createCadSceneIndex(snapshot.document, context),
      get snapshot() {
        return latest.current.interaction
      },
      apply: runEffects,
      publish: setInteraction,
      idleSnapshot: () => ({ selection: latest.current.interaction.selection, marquee: null }),
    }
  }, [runEffects])

  const handlePointerDown = useCallback((event: CadSurfacePointerEvent) => {
    focusCommandLine()
    const result = arbiterRef.current.begin(
      { type: 'pointer.down', ...event },
      pluginContext(),
    )
    // `consumed` 也算被接管：它表示这次按下已被处理掉，图面不该再走中键平移兜底。但只有
    // `claimed` 才真正开了会话，需要捕获指针。
    return result === 'claimed'
  }, [focusCommandLine, pluginContext])

  const handlePointerMove = useCallback((event: CadSurfacePointerEvent) => {
    arbiterRef.current.update({ type: 'pointer.move', ...event }, pluginContext())
  }, [pluginContext])

  const handlePointerUp = useCallback((event: CadSurfacePointerEvent) => {
    arbiterRef.current.commit({ type: 'pointer.up', ...event }, pluginContext())
  }, [pluginContext])

  const handlePointerAbort = useCallback((pointerId: number) => {
    arbiterRef.current.cancel(pluginContext(), pointerId)
  }, [pluginContext])

  /**
   * F8 切换正交、F7 切换网格、F3 切换对象捕捉，Escape 走两级取消。
   *
   * @remarks
   * 挂在容器上而不是画布上：焦点通常在命令行输入框里，挂在画布上按键根本收不到。这几个键在
   * 输入框中不产生字符，因此拦截它们不会吞掉用户正在打的内容。
   */
  const handleKeyDown = useCallback((event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'F8') {
      event.preventDefault()
      setOrtho((current) => !current)
      return
    }
    if (event.key === 'F7') {
      event.preventDefault()
      setGridEnabled((current) => !current)
      return
    }
    if (event.key === 'F3') {
      event.preventDefault()
      setSnapEnabled((current) => !current)
    }
  }, [])

  return (
    <div className="compose-cad-canvas" data-testid="cad-canvas" onKeyDown={handleKeyDown}>
      <div
        className="compose-cad-canvas__viewport"
        data-crosshair={crosshair ? '' : undefined}
        data-rulers={showRulers ? '' : undefined}
        ref={surfaceRef}
      >
        {showRulers ? (
          <ComposeCanvasRulers
            bounds={selectionBounds}
            horizontalTicks={rulerTicks.horizontal}
            ref={rulersRef}
            labels={{
              origin: messages.rulerOrigin,
              horizontal: messages.horizontalRuler,
              vertical: messages.verticalRuler,
            }}
            screenBounds={selectionBounds ? {
              x: selectionBounds.x * viewport.zoom + viewport.offset.x,
              y: selectionBounds.y * viewport.zoom + viewport.offset.y,
              width: selectionBounds.width * viewport.zoom,
              height: selectionBounds.height * viewport.zoom,
            } : null}
            testIdPrefix="cad-ruler"
            themeKey={i18n?.locale}
            verticalTicks={rulerTicks.vertical}
            // 标尺上的拖拽在页面画布里用来拉辅助线；CAD 还没有辅助线，因此这里不接管。
            onCornerPointerDown={() => {}}
            onHorizontalPointerDown={() => {}}
            onVerticalPointerDown={() => {}}
          />
        ) : null}
        <CadSurface
          document={document}
          crosshair={crosshair}
          gridStep={gridEnabled ? gridStep : null}
          hovered={hovered}
          interaction={interaction}
          label={messages.canvasLabel}
          previewSegments={previewSegments}
          snap={snap}
          viewport={viewport}
          onHoverPoint={setPointerScreen}
          onPointerAbort={handlePointerAbort}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onViewportChange={setViewport}
        />
      </div>
      <CadCommandLine
        inputRef={commandInputRef}
        messages={messages}
        pointer={pointerPoint
          ? `${formatComposeNumber(pointerPoint.x)}, ${formatComposeNumber(pointerPoint.y)}`
          : null}
        notice={notice}
        ortho={ortho}
        prompt={prompt}
        selectionCount={interaction.selection.length}
        snap={snapEnabled}
        onCancel={handleCancel}
        onSubmit={handleSubmit}
      />
    </div>
  )
}
