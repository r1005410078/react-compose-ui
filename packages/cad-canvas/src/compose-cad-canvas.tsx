import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent } from 'react'
import {
  CAD_DEFAULT_LAYER_ID,
  createCadEraseCommand,
  createCadInteractionPlugins,
  createCadLineCommand,
  createCadPluginRegistry,
  createCadSceneIndex,
  createCadSessionArbiter,
  findCadSnap,
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
  type CadSnapCandidate,
} from '@compose-ui/cad'
import {
  createComposeCommandRegistry,
  type ComposeCommandInput,
  type ComposeCommandPrompt,
  type ComposeCommandSession,
} from '@compose-ui/commands'
import type { EditorCommand } from '@compose-ui/core'
import { useComposeI18nContext } from '@compose-ui/ui-context'
import { getCadCanvasMessages } from './cad-canvas-i18n'
import { CadCommandLine } from './command-line'
import { CadSurface, type CadPreviewSegment, type CadSurfacePointerEvent } from './canvas-surface'
import { CAD_INITIAL_VIEWPORT, type CadCanvasPoint, type CadViewport } from './viewport'

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
  /** 点选命中的屏幕容差（CSS 像素）。 @defaultValue 5 */
  readonly pickRadius?: number
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
  pickRadius = 5,
}: ComposeCadCanvasProps) {
  const i18n = useComposeI18nContext()
  const messages = getCadCanvasMessages(i18n?.locale ?? 'zh-CN')
  const [viewport, setViewport] = useState<CadViewport>(CAD_INITIAL_VIEWPORT)
  const [prompt, setPrompt] = useState<ComposeCommandPrompt | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [preview, setPreview] = useState<readonly CadPreviewSegment[]>([])
  const [ortho, setOrtho] = useState(false)
  const [gridEnabled, setGridEnabled] = useState(true)
  const [snapEnabled, setSnapEnabled] = useState(true)
  const [hover, setHover] = useState<CadCanvasPoint | null>(null)
  const [interaction, setInteraction] = useState<CadInteractionSnapshot>(EMPTY_INTERACTION)
  // 后续相对输入的参照点由会话给出：「放弃」会退回上一个顶点，宿主自行记账会与会话失步。
  const [reference, setReference] = useState<CadInputPoint | undefined>(undefined)
  // 活动会话不进 state：它是可变对象，进 state 既不会触发正确的重渲染，也会让「同一次命令」
  // 在严格模式的双调用下变成两个。
  const sessionRef = useRef<ComposeCommandSession<CadCommandEffect> | null>(null)

  const registry = useMemo(
    () => createComposeCommandRegistry<CadCommandContext, CadCommandEffect>([
      createCadLineCommand(messages),
      createCadEraseCommand(messages),
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

  /**
   * 当前捕捉命中的特征点。
   *
   * @remarks
   * 只在命令**正等待取点**时求解：空闲时算捕捉既没有消费者，又会在每次指针移动上做无谓的
   * 几何计算。捕捉半径按屏幕像素给出，除以缩放换成世界单位——视图缩小时同样的屏幕半径必须
   * 覆盖更大的世界范围，否则放远了就再也捕不到。
   */
  const snap = useMemo<CadSnapCandidate | null>(() => {
    if (!snapEnabled || !hover || !prompt?.accepts.includes('point')) return null
    return findCadSnap(document, hover, snapRadius / viewport.zoom)
  }, [document, hover, prompt, snapEnabled, snapRadius, viewport.zoom])

  const pointContext = useMemo(() => ({
    snapped: snap?.point,
    reference,
    ortho,
    grid: { enabled: gridEnabled, step: gridStep },
  }), [gridEnabled, gridStep, ortho, reference, snap])

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
          applyStep(session, { kind: 'point', point: resolveCadPoint(parsed.point, 'typed', pointContext) })
          return
        }
        if (parsed.reason === 'missing-reference') {
          setNotice(messages.needsReference)
          return
        }
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
      messages,
    }))
  }, [
    activeLayerId, applyStep, idFactory, interaction.selection, messages, pointContext,
    prompt, reference, registry, startSession,
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
        applyStep(session, { kind: 'point', point: resolveCadPoint(effect.point, 'pointer', pointContext) })
        continue
      }
      applyStep(session, { kind: 'selection', ids: effect.ids })
    }
  }, [applyStep, pointContext])

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
    const result = arbiterRef.current.begin(
      { type: 'pointer.down', ...event },
      pluginContext(),
    )
    // `consumed` 也算被接管：它表示这次按下已被处理掉，图面不该再走中键平移兜底。但只有
    // `claimed` 才真正开了会话，需要捕获指针。
    return result === 'claimed'
  }, [pluginContext])

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
      <div className="compose-cad-canvas__viewport">
        <CadSurface
          document={document}
          gridStep={gridEnabled ? gridStep : null}
          interaction={interaction}
          label={messages.canvasLabel}
          previewSegments={preview}
          snap={snap}
          viewport={viewport}
          onHoverPoint={setHover}
          onPointerAbort={handlePointerAbort}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onViewportChange={setViewport}
        />
      </div>
      <CadCommandLine
        messages={messages}
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
