import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent } from 'react'
import {
  parseComposeCoordinate,
  resolveComposePoint,
  type ComposeDocument,
  type ComposeInputPoint,
  type ComposeLayoutSnapshot,
} from '@compose-ui/core'
import {
  createComposeCommandRegistry,
  type ComposeCommandSession,
} from '@compose-ui/commands'
import type { ComposeEntityRegistry } from '@compose-ui/component-registry'
import {
  createStageDraftingCommands,
  createStageSceneIndex,
  findStageFeaturePoint,
  worldToScreen,
  type StageDraftingContext,
  type StageDraftingEffect,
  type StageDraftingMessages,
  type StageFeaturePoint,
  type StagePoint,
  type StageViewport,
} from '@compose-ui/stage-engine'
import type { ComposeStageDispatch } from '../types'
import { createStageDraftingCurveCommand } from './drafting-entity'

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
  readonly activeFrameId?: string | null
  /** 捕捉的屏幕半径（CSS 像素）。 @defaultValue 12 */
  readonly snapRadius?: number
}

const DEFAULT_SNAP_RADIUS = 12

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
    activeFrameId,
    snapRadius = DEFAULT_SNAP_RADIUS,
  } = options

  const sessionRef = useRef<ComposeCommandSession<StageDraftingEffect> | null>(null)
  const [prompt, setPrompt] = useState<ComposeCommandSession<StageDraftingEffect>['prompt']>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [reference, setReference] = useState<ComposeInputPoint | null>(null)
  const [pointer, setPointer] = useState<StagePoint | null>(null)
  const [ortho, setOrtho] = useState(false)
  const [snapEnabled, setSnapEnabled] = useState(true)

  const commands = useMemo(() => createStageDraftingCommands(messages), [messages])
  const registryOfCommands = useMemo(() => createComposeCommandRegistry(commands), [commands])
  const index = useMemo(
    () => createStageSceneIndex(document, layoutSnapshot),
    [document, layoutSnapshot],
  )
  // 页面网格两轴独立，且开关是 `snapEnabled` 而不是「网格是否可见」——看得见与吸不吸是两件事。
  const gridSettings = useMemo(() => ({
    enabled: document.canvas.grid.snapEnabled,
    stepX: document.canvas.grid.stepX,
    stepY: document.canvas.grid.stepY,
  }), [document.canvas.grid])

  const snapshot = { document, layoutSnapshot, index, registry, dispatch, idFactory, activeFrameId }
  const latest = useRef(snapshot)
  useLayoutEffect(() => {
    latest.current = snapshot
  })

  const commit = useCallback((effect: StageDraftingEffect | undefined) => {
    if (!effect || effect.segments.length === 0) return
    const current = latest.current
    for (const segment of effect.segments) {
      const command = createStageDraftingCurveCommand({
        document: current.document,
        layoutSnapshot: current.layoutSnapshot,
        index: current.index,
        registry: current.registry,
        idFactory: current.idFactory,
        activeFrameId: current.activeFrameId,
      }, segment)
      if (command) current.dispatch(command)
    }
  }, [])

  const endSession = useCallback((message: string | null) => {
    sessionRef.current = null
    setPrompt(null)
    setReference(null)
    setNotice(message)
  }, [])

  const applyStep = useCallback((step: ReturnType<ComposeCommandSession<StageDraftingEffect>['advance']>) => {
    if (step.status === 'prompt') {
      commit(step.commit)
      setPrompt(step.prompt)
      setReference(step.preview?.reference ?? step.commit?.reference ?? null)
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
  const snap: StageFeaturePoint | null = useMemo(() => {
    if (!enabled || !snapEnabled || !pointer) return null
    return findStageFeaturePoint(document, index, pointer, snapRadius / viewport.zoom)
  }, [document, enabled, index, pointer, snapEnabled, snapRadius, viewport.zoom])

  const resolvePointerPoint = useCallback((world: StagePoint): ComposeInputPoint => {
    const hit = snapEnabled
      ? findStageFeaturePoint(document, index, world, snapRadius / viewport.zoom)
      : null
    return resolveComposePoint(world, 'pointer', {
      ...(hit ? { snapped: hit.point } : {}),
      ...(reference ? { reference } : {}),
      ortho,
      grid: gridSettings,
    })
  }, [document, gridSettings, index, ortho, reference, snapEnabled, snapRadius, viewport.zoom])

  const handlePoint = useCallback((world: StagePoint) => {
    const session = sessionRef.current
    if (!session) return
    // 按这次按下自己的坐标重算捕捉，不沿用上一帧 hover 的结果：pointerdown 可能赶在 React
    // 为上一次 pointermove 重渲染之前到达，落点会被吸回用户已经离开的特征点上。
    applyStep(session.advance({ kind: 'point', point: resolvePointerPoint(world) }))
  }, [applyStep, resolvePointerPoint])

  const submit = useCallback((text: string) => {
    const trimmed = text.trim()
    const session = sessionRef.current

    if (!session) {
      if (trimmed.length === 0) return
      const definition = registryOfCommands.resolve(trimmed)
      if (!definition) {
        setNotice(messages.unknownCommand)
        return
      }
      const context: StageDraftingContext = { messages }
      const next = definition.start(context)
      sessionRef.current = next
      setPrompt(next.prompt)
      setReference(null)
      setNotice(null)
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
  }, [applyStep, gridSettings, messages, ortho, reference, registryOfCommands])

  const cancel = useCallback(() => {
    const session = sessionRef.current
    if (!session) {
      setNotice(null)
      return
    }
    applyStep(session.advance({ kind: 'cancel' }))
  }, [applyStep])

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
    return false
  }, [enabled])

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
    pointerScreen,
    awaitingPoint: enabled && prompt?.accepts.includes('point') === true,
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
