import { useCallback, useEffect, useLayoutEffect, useRef } from 'react'
import type { PointerEvent as ReactPointerEvent, RefObject } from 'react'
import type {
  StageInteractionController,
  StageInteractionHit,
  StagePoint,
} from '@compose-ui/stage-engine'
import {
  frozenSurfaceRect,
  modifiers,
  pressedButtons,
  screenPointFromRect,
  type FrozenSurfaceRect,
  type StageModifiers,
} from './stage-pointer-geometry'

/**
 * 双击判定窗口与容差。
 *
 * @remarks
 * Pointer Events 规范规定 `pointerdown` 的 `detail` 恒为 0，拿不到浏览器的连击计数，
 * 只能自己归一化。500ms / 5px 取各平台双击判定的常见值。
 */
const DOUBLE_CLICK_INTERVAL_MS = 500
const DOUBLE_CLICK_SLOP_PX = 5

/** 每帧最多向内核推进一次移动；同帧内的多次 pointermove 合并成最后一个采样。 */
type PointerSessionStatus = 'active' | 'finishing' | 'ended'

/** 一次进行中的指针会话；surface 矩形在按下当刻冻结。 */
export interface ActivePointerSession {
  readonly pointerId: number
  readonly generation: number
  readonly surfaceRect: FrozenSurfaceRect
  lastPoint: StagePoint
  lastModifiers: StageModifiers
  buttons: number
  status: PointerSessionStatus
  captureOwned: boolean
}

interface PendingPointerSample {
  readonly pointerId: number
  readonly generation: number
  readonly point: StagePoint
  readonly modifiers: StageModifiers
}


/** 指针会话能力的依赖清单。 */
export interface StagePointerSessionParams {
  readonly controller: StageInteractionController
  /** Stage 根元素；Pointer capture 挂在它身上。 */
  readonly rootRef: RefObject<HTMLDivElement | null>
  /** Scene surface；按下当刻在它上面冻结矩形，之后整个手势都用这一份。 */
  readonly surfaceRef: RefObject<HTMLDivElement | null>
  /**
   * 会话因失去 Pointer capture 而被迫取消时的额外清理。
   *
   * @remarks
   * 宿主用它结束临时平移——这件事不属于指针会话，但必须与取消发生在同一次处理里。
   */
  readonly onCaptureLostAbort?: () => void
}

/** 指针会话能力的出口。 */
export interface StagePointerSession {
  /** 归一化一次 pointerdown 并交给内核；连击计数在这里推进。 */
  readonly beginInteraction: (hit: StageInteractionHit, event: ReactPointerEvent<Element>) => void
  /**
   * 读取本次 pointerdown 的连击计数而不推进状态。
   *
   * @remarks
   * 真正的计数推进仍由 `beginInteraction` 负责；这里只做前瞻判断，两者读的是同一份 ref，
   * 因此结果一致。若在这里推进，`beginInteraction` 会再算一次导致计数翻倍。
   */
  readonly peekClickCount: (event: ReactPointerEvent<HTMLDivElement>) => number
  /** 开启一次会话：接管 Pointer capture 并安装 window 路由。 */
  readonly capturePointer: (root: HTMLDivElement, pointerId: number) => void
  /** 结束会话并归还 capture；内核请求释放时调用。 */
  readonly releasePointer: (pointerId: number) => void
  /** 中止进行中的手势；没有会话时直接通知内核。 */
  readonly cancelGesture: () => void
  /** 挂在 Stage 根元素上的 `onLostPointerCapture`。 */
  readonly handleLostPointerCapture: (event: ReactPointerEvent<HTMLDivElement>) => void
}

/**
 * 「一次指针交互的完整生命周期」这条能力。
 *
 * @remarks
 * 会话用 **generation** 而不是身份来判等：同一个 `pointerId` 可以先后属于两次会话，迟到的
 * rAF 回调、window 事件与 capture 丢失通知都可能跨越边界抵达。每处判定都比 generation，
 * 因此过期消息一律被丢弃而不是误伤新会话。
 *
 * 路由装在 **window 的 capture 阶段**：宿主在自己的根节点上 `stopPropagation` 时，React 树
 * 内的监听会漏掉手势的最终点，而漏掉 pointerup 意味着手势永远结束不了。
 *
 * 回调全部保持引用稳定——它们进宿主的效果处理表与 JSX，随渲染变化重建会打断进行中的手势。
 */
export function useStagePointerSession(
  params: StagePointerSessionParams,
): StagePointerSession {
  const { controller, rootRef, surfaceRef } = params
  const latestRef = useRef(params)
  useLayoutEffect(() => {
    latestRef.current = params
  })

  const activePointerSessionRef = useRef<ActivePointerSession | null>(null)
  const pointerGenerationRef = useRef(0)
  const pendingPointerStartRef = useRef<{
    readonly pointerId: number
    readonly buttons: number
    readonly surfaceRect: FrozenSurfaceRect
    readonly point: StagePoint
    readonly modifiers: StageModifiers
  } | null>(null)
  const pendingRef = useRef<PendingPointerSample | null>(null)
  const frameRequestRef = useRef<number | null>(null)
  const pointerRouteCleanupRef = useRef<(() => void) | null>(null)
  const lastPointerDownRef = useRef<{
    readonly time: number
    readonly x: number
    readonly y: number
    readonly count: number
  } | null>(null)
  const expectedLostCaptureRef = useRef(new Map<number, number[]>())

  const clearPending = useCallback((generation?: number) => {
    if (
      generation === undefined
      || pendingRef.current?.generation === generation
    ) {
      pendingRef.current = null
      if (frameRequestRef.current !== null) {
        cancelAnimationFrame(frameRequestRef.current)
        frameRequestRef.current = null
      }
    }
  }, [])

  const stopPointerRoute = useCallback(() => {
    pointerRouteCleanupRef.current?.()
    pointerRouteCleanupRef.current = null
  }, [])

  const endPointerSession = useCallback((session: ActivePointerSession) => {
    if (activePointerSessionRef.current?.generation !== session.generation) return
    session.status = 'ended'
    clearPending(session.generation)
    stopPointerRoute()
    activePointerSessionRef.current = null
  }, [clearPending, stopPointerRoute])

  const releasePointer = useCallback((pointerId: number) => {
    const session = activePointerSessionRef.current
    if (!session || session.pointerId !== pointerId) return
    session.status = 'ended'
    clearPending(session.generation)
    stopPointerRoute()

    const root = rootRef.current
    const shouldRelease = session.captureOwned
    session.captureOwned = false
    if (shouldRelease) {
      const expected = expectedLostCaptureRef.current.get(pointerId) ?? []
      expected.push(session.generation)
      expectedLostCaptureRef.current.set(pointerId, expected)
    }
    try {
      if (shouldRelease && typeof root?.releasePointerCapture === 'function') {
        root.releasePointerCapture(pointerId)
      }
    }
    catch {
      // pointerup/pointercancel 可能已让浏览器隐式释放 capture。
    }
    if (activePointerSessionRef.current?.generation === session.generation) {
      activePointerSessionRef.current = null
    }
  }, [clearPending, rootRef, stopPointerRoute])

  const sendPointerMove = useCallback((sample: PendingPointerSample) => {
    const session = activePointerSessionRef.current
    if (
      !session
      || session.status !== 'active'
      || session.pointerId !== sample.pointerId
      || session.generation !== sample.generation
    ) return
    controller.send({
      type: 'pointer.move',
      pointerId: sample.pointerId,
      point: sample.point,
      modifiers: sample.modifiers,
    })
  }, [controller])

  const scheduleUpdate = useCallback((
    session: ActivePointerSession,
    event: Pick<PointerEvent, 'clientX' | 'clientY' | 'shiftKey' | 'altKey' | 'ctrlKey' | 'metaKey'>,
  ) => {
    const sample: PendingPointerSample = {
      pointerId: session.pointerId,
      generation: session.generation,
      point: screenPointFromRect(event, session.surfaceRect),
      modifiers: modifiers(event),
    }
    session.lastPoint = sample.point
    session.lastModifiers = sample.modifiers
    pendingRef.current = sample
    if (frameRequestRef.current !== null) return
    const generation = session.generation
    let ranSynchronously = false
    const request = requestAnimationFrame(() => {
      ranSynchronously = true
      frameRequestRef.current = null
      const pending = pendingRef.current
      if (!pending || pending.generation !== generation) return
      pendingRef.current = null
      sendPointerMove(pending)
    })
    frameRequestRef.current = ranSynchronously ? null : request
  }, [sendPointerMove])

  const refreshDrawingModifier = useCallback((
    session: ActivePointerSession,
    event: KeyboardEvent,
  ) => {
    if (
      event.key !== 'Shift'
      || session.status !== 'active'
      || controller.getSnapshot().phase !== 'draw'
    ) return
    const sample: PendingPointerSample = {
      pointerId: session.pointerId,
      generation: session.generation,
      point: session.lastPoint,
      modifiers: {
        shift: event.type === 'keydown',
        alt: event.altKey,
        command: event.ctrlKey || event.metaKey,
      },
    }
    // 如果当前帧已有 pointermove，必须同步替换其中的修饰键，避免 rAF 将旧状态写回。
    if (pendingRef.current?.generation === session.generation) pendingRef.current = sample
    session.lastModifiers = sample.modifiers
    controller.send({
      type: 'pointer.move',
      pointerId: sample.pointerId,
      point: sample.point,
      modifiers: sample.modifiers,
    })
  }, [controller])

  const finishPointerSession = useCallback((
    session: ActivePointerSession,
    event: Pick<PointerEvent, 'clientX' | 'clientY' | 'shiftKey' | 'altKey' | 'ctrlKey' | 'metaKey'>,
  ) => {
    if (
      activePointerSessionRef.current?.generation !== session.generation
      || session.status !== 'active'
    ) return
    session.status = 'finishing'
    session.buttons = 0
    clearPending(session.generation)
    // 某些浏览器会在 PointerEvent 的 pointerup 上遗漏已按住的修饰键；手势期间的
    // window keydown/keyup 是可靠来源。keyup 已发生时 lastModifiers 会即时恢复为 false。
    const releaseModifiers = modifiers(event)
    controller.send({
      type: 'pointer.up',
      pointerId: session.pointerId,
      point: screenPointFromRect(event, session.surfaceRect),
      modifiers: {
        ...releaseModifiers,
        shift: releaseModifiers.shift || session.lastModifiers.shift,
      },
    })
    if (activePointerSessionRef.current?.generation === session.generation) {
      endPointerSession(session)
    }
  }, [clearPending, controller, endPointerSession])

  const cancelPointerSession = useCallback((
    session: ActivePointerSession,
    captureAlreadyLost = false,
  ) => {
    if (
      activePointerSessionRef.current?.generation !== session.generation
      || session.status === 'ended'
    ) return
    session.status = 'ended'
    if (captureAlreadyLost) session.captureOwned = false
    clearPending(session.generation)
    controller.send({ type: 'pointer.cancel', pointerId: session.pointerId })
    if (activePointerSessionRef.current?.generation === session.generation) {
      endPointerSession(session)
    }
  }, [clearPending, controller, endPointerSession])

  const installPointerRoute = useCallback((session: ActivePointerSession) => {
    stopPointerRoute()
    const currentSession = (event: PointerEvent) => {
      const current = activePointerSessionRef.current
      return current?.generation === session.generation
        && current.pointerId === event.pointerId
        ? current
        : null
    }
    const handleMove = (event: PointerEvent) => {
      const current = currentSession(event)
      if (!current || current.status !== 'active') return
      current.buttons = event.buttons
      if (event.buttons === 0) {
        finishPointerSession(current, event)
        return
      }
      scheduleUpdate(current, event)
    }
    const handleUp = (event: PointerEvent) => {
      const current = currentSession(event)
      if (current) finishPointerSession(current, event)
    }
    const handleCancel = (event: PointerEvent) => {
      const current = currentSession(event)
      if (current) cancelPointerSession(current, true)
    }
    const handleModifierChange = (event: KeyboardEvent) => {
      const current = activePointerSessionRef.current
      if (current?.generation === session.generation) refreshDrawingModifier(current, event)
    }
    // capture phase 先于 React 根节点回调，避免宿主 stopPropagation 使内部路由漏掉最终点。
    window.addEventListener('pointermove', handleMove, true)
    window.addEventListener('pointerup', handleUp, true)
    window.addEventListener('pointercancel', handleCancel, true)
    window.addEventListener('keydown', handleModifierChange, true)
    window.addEventListener('keyup', handleModifierChange, true)
    pointerRouteCleanupRef.current = () => {
      window.removeEventListener('pointermove', handleMove, true)
      window.removeEventListener('pointerup', handleUp, true)
      window.removeEventListener('pointercancel', handleCancel, true)
      window.removeEventListener('keydown', handleModifierChange, true)
      window.removeEventListener('keyup', handleModifierChange, true)
    }
  }, [
    cancelPointerSession,
    finishPointerSession,
    refreshDrawingModifier,
    scheduleUpdate,
    stopPointerRoute,
  ])

  const capturePointer = useCallback((root: HTMLDivElement, pointerId: number) => {
    const start = pendingPointerStartRef.current
    const surface = surfaceRef.current
    if (!surface) return
    const session: ActivePointerSession = {
      pointerId,
      generation: ++pointerGenerationRef.current,
      buttons: start?.pointerId === pointerId ? start.buttons : 1,
      lastPoint: start?.pointerId === pointerId ? start.point : { x: 0, y: 0 },
      lastModifiers: start?.pointerId === pointerId
        ? start.modifiers
        : { shift: false, alt: false, command: false },
      status: 'active',
      surfaceRect: start?.pointerId === pointerId
        ? start.surfaceRect
        : frozenSurfaceRect(surface),
      captureOwned: false,
    }
    activePointerSessionRef.current = session
    installPointerRoute(session)
    try {
      if (typeof root.setPointerCapture === 'function') {
        root.setPointerCapture(pointerId)
        session.captureOwned = true
      }
    }
    catch {
      // capture 是传输优化；失败后 window 路由仍拥有完整手势生命周期。
    }
  }, [installPointerRoute, surfaceRef])

  useEffect(() => () => {
    const session = activePointerSessionRef.current
    if (session) {
      session.captureOwned = false
      endPointerSession(session)
    }
    else {
      clearPending()
      stopPointerRoute()
    }
  }, [clearPending, controller, endPointerSession, stopPointerRoute])

  const cancelGesture = () => {
    const session = activePointerSessionRef.current
    if (session) cancelPointerSession(session)
    else controller.send({ type: 'pointer.cancel' })
  }

  const beginInteraction = (
    hit: StageInteractionHit,
    event: ReactPointerEvent<Element>,
  ) => {
    const surface = surfaceRef.current
    if (!surface || activePointerSessionRef.current) return
    const surfaceRect = frozenSurfaceRect(surface)
    const start = {
      pointerId: event.pointerId,
      buttons: pressedButtons(event.button, event.buttons),
      surfaceRect,
      point: screenPointFromRect(event, surfaceRect),
      modifiers: modifiers(event),
    }
    pendingPointerStartRef.current = start
    // 归一化连击计数：`event.detail` 在 pointerdown 上恒为 0，测试用例可显式给出。
    const now = event.timeStamp || Date.now()
    const previous = lastPointerDownRef.current
    const clickCount = event.detail > 0
      ? event.detail
      : previous
        && now - previous.time <= DOUBLE_CLICK_INTERVAL_MS
        && Math.abs(event.clientX - previous.x) <= DOUBLE_CLICK_SLOP_PX
        && Math.abs(event.clientY - previous.y) <= DOUBLE_CLICK_SLOP_PX
        ? previous.count + 1
        : 1
    lastPointerDownRef.current = {
      time: now,
      x: event.clientX,
      y: event.clientY,
      count: clickCount,
    }
    try {
      controller.send({
        type: 'pointer.down',
        pointerId: event.pointerId,
        button: event.button,
        point: start.point,
        hit,
        modifiers: start.modifiers,
        clickCount,
      })
    }
    finally {
      if (pendingPointerStartRef.current === start) {
        pendingPointerStartRef.current = null
      }
    }
  }

  const peekClickCount = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.detail > 0) return event.detail
    const previous = lastPointerDownRef.current
    const now = event.timeStamp || Date.now()
    return previous
      && now - previous.time <= DOUBLE_CLICK_INTERVAL_MS
      && Math.abs(event.clientX - previous.x) <= DOUBLE_CLICK_SLOP_PX
      && Math.abs(event.clientY - previous.y) <= DOUBLE_CLICK_SLOP_PX
      ? previous.count + 1
      : 1
  }


  /**
   * Pointer capture 丢失。
   *
   * @remarks
   * 主动 `releasePointer` 也会触发一次 lostpointercapture，必须与「浏览器单方面收走
   * capture」区分开——前者已登记在 `expectedLostCaptureRef` 的队列里，直接消费掉即可。
   * 队列按 generation 排队而不是布尔标记：连续两次会话可能各留下一次待消费的通知。
   *
   * 区分之后还剩两种情况：按键已松开就当作正常结束（浏览器隐式释放），仍按着就只能取消——
   * 没有 capture 意味着后续移动收不到了，让手势继续跟随只会得到一个停在半途的结果。
   */
  const handleLostPointerCapture = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return
    const session = activePointerSessionRef.current
    const expected = expectedLostCaptureRef.current.get(event.pointerId)
    const expectedGeneration = expected?.[0]
    if (
      event.buttons === 0
      && expectedGeneration !== undefined
      && (
        !session
        || session.status !== 'active'
        || expectedGeneration < session.generation
      )
    ) {
      expected!.shift()
      if (expected!.length === 0) {
        expectedLostCaptureRef.current.delete(event.pointerId)
      }
      return
    }
    if (
      !session
      || session.pointerId !== event.pointerId
      || session.status !== 'active'
    ) return
    if (event.buttons === 0) {
      session.captureOwned = false
      finishPointerSession(session, event.nativeEvent)
      return
    }
    latestRef.current.onCaptureLostAbort?.()
    cancelPointerSession(session, true)
  }

  return {
    beginInteraction,
    peekClickCount,
    capturePointer,
    releasePointer,
    cancelGesture,
    handleLostPointerCapture,
  }
}
