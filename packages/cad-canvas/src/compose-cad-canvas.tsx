import { useCallback, useMemo, useRef, useState } from 'react'
import {
  CAD_DEFAULT_LAYER_ID,
  createCadLineCommand,
  type CadCommandContext,
  type CadCommandEffect,
  type CadDocument,
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
}: ComposeCadCanvasProps) {
  const i18n = useComposeI18nContext()
  const messages = getCadCanvasMessages(i18n?.locale ?? 'zh-CN')
  const [viewport, setViewport] = useState<CadViewport>(CAD_INITIAL_VIEWPORT)
  const [prompt, setPrompt] = useState<ComposeCommandPrompt | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [preview, setPreview] = useState<readonly CadPreviewSegment[]>([])
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
    setNotice(noticeText)
  }, [])

  const applyStep = useCallback((session: ComposeCommandSession<CadCommandEffect>, input: ComposeCommandInput) => {
    const step = session.advance(input)
    if (step.status === 'prompt') {
      setPrompt(step.prompt)
      setPreview(step.preview?.segments ?? [])
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

  const handlePickPoint = useCallback((point: CadCanvasPoint) => {
    const session = sessionRef.current
    if (!session) return
    applyStep(session, { kind: 'point', point })
  }, [applyStep])

  const handleSubmit = useCallback((text: string) => {
    const session = sessionRef.current
    if (session) {
      // 命令进行中：空行等于确认（Enter），否则按关键字解释。
      applyStep(session, text.trim().length === 0
        ? { kind: 'accept' }
        : { kind: 'keyword', key: text })
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
  }, [activeLayerId, applyStep, idFactory, messages, registry])

  const handleCancel = useCallback(() => {
    const session = sessionRef.current
    if (!session) return
    applyStep(session, { kind: 'cancel' })
  }, [applyStep])

  return (
    <div className="compose-cad-canvas" data-testid="cad-canvas">
      <div className="compose-cad-canvas__viewport">
        <CadSurface
          document={document}
          label={messages.canvasLabel}
          previewSegments={preview}
          viewport={viewport}
          onPickPoint={handlePickPoint}
          onViewportChange={setViewport}
        />
      </div>
      <CadCommandLine
        messages={messages}
        notice={notice}
        prompt={prompt}
        onCancel={handleCancel}
        onSubmit={handleSubmit}
      />
    </div>
  )
}
