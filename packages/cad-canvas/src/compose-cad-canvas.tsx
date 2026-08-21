import { useCallback, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent } from 'react'
import {
  CAD_DEFAULT_LAYER_ID,
  createCadLineCommand,
  findCadSnap,
  parseCadCoordinate,
  resolveCadPoint,
  type CadCommandContext,
  type CadCommandEffect,
  type CadDocument,
  type CadInputPoint,
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
import { CadSurface, type CadPreviewSegment } from './canvas-surface'
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
}

function defaultIdFactory() {
  if (typeof globalThis.crypto?.randomUUID === 'function') return globalThis.crypto.randomUUID()
  return `cad-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

/**
 * AutoCAD 风格的 CAD 编辑画布。
 *
 * @remarks
 * **命令由键盘启动**：键入 `L↵` 开始画线，随后画布上的点击成为命令的一步输入。本组件不理解
 * 任何命令有几步——状态机住在 `@compose-ui/cad`，协议住在 `@compose-ui/commands`，这里只做
 * 三件事：把输入归一化、渲染提示与预览、在命令提交时派发事务。
 *
 * 没有活动命令时点击图面**不做任何事**。CAD 的点击语义由当前命令决定，空闲时的点选（选择集）
 * 是后续能力。
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
  // 后续相对输入的参照点由会话给出：「放弃」会退回上一个顶点，宿主自行记账会与会话失步。
  const [reference, setReference] = useState<CadInputPoint | undefined>(undefined)
  // 活动会话不进 state：它是可变对象，进 state 既不会触发正确的重渲染，也会让「同一次命令」
  // 在严格模式的双调用下变成两个。
  const sessionRef = useRef<ComposeCommandSession<CadCommandEffect> | null>(null)

  const registry = useMemo(
    () => createComposeCommandRegistry<CadCommandContext, CadCommandEffect>([
      createCadLineCommand(messages),
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
    if (step.status === 'commit' && step.effect.command) onDispatch(step.effect.command)
    endSession(step.status === 'cancelled' ? messages.cancelled : null)
  }, [endSession, messages.cancelled, onDispatch])

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

  const handlePickPoint = useCallback((point: CadCanvasPoint) => {
    const session = sessionRef.current
    if (!session) return
    applyStep(session, { kind: 'point', point: resolveCadPoint(point, 'pointer', pointContext) })
  }, [applyStep, pointContext])

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
    const started = command.start({ layerId: activeLayerId, idFactory, messages })
    sessionRef.current = started
    setPrompt(started.prompt)
    setPreview([])
    setNotice(null)
  }, [activeLayerId, applyStep, idFactory, messages, pointContext, prompt, reference, registry])

  const handleCancel = useCallback(() => {
    const session = sessionRef.current
    if (!session) return
    applyStep(session, { kind: 'cancel' })
  }, [applyStep])

  /**
   * F8 切换正交、F7 切换网格、F3 切换对象捕捉。
   *
   * @remarks
   * 挂在容器上而不是画布上：焦点通常在命令行输入框里，挂在画布上按键根本收不到。这两个键在
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
          label={messages.canvasLabel}
          previewSegments={preview}
          snap={snap}
          viewport={viewport}
          onHoverPoint={setHover}
          onPickPoint={handlePickPoint}
          onViewportChange={setViewport}
        />
      </div>
      <CadCommandLine
        messages={messages}
        notice={notice}
        ortho={ortho}
        prompt={prompt}
        snap={snapEnabled}
        onCancel={handleCancel}
        onSubmit={handleSubmit}
      />
    </div>
  )
}
