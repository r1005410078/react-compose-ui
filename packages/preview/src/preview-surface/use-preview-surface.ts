import { useRef, useState, useSyncExternalStore } from 'react'
import type { PointerEvent as ReactPointerEvent, RefObject } from 'react'
import {
  COMPOSE_DEFAULT_FRAME_SIZE,
  getComposeAnimations,
  getComposeFrame,
} from '@compose-ui/core'
import type {
  ComposeAnimation,
  ComposeCanvasViewport,
  ComposeDocument,
  ComposeNavigationPort,
  ComposeNavigationSnapshot,
  ComposePageFile,
  ComposeSize,
} from '@compose-ui/core'
import type { ComposePreviewProps } from '../compose-preview'
import { composeFitScale, useComposeHostBoxSize } from '../host-box'
import { advanceComposePreviewPlayhead } from '../playback/playback-model'
import type { ComposePreviewPlayheadState } from '../playback/playback-model'
import { useAnimationFrameLoop } from '../playback/use-animation-frame-loop'
import {
  defaultFitForTargetKind,
  fitPreviewViewport,
  zoomPreviewViewport,
} from '../preview-dialog/screen-size'
import type { ComposePreviewTargetKind } from '../preview-dialog/screen-size'
import { useComposeScreenResize } from '../preview-dialog/use-screen-resize'
import type { ComposeScreenResizeSession } from '../preview-dialog/use-screen-resize'

/** 预览会话的输入；两个形态传的是同一份。 */
export interface ComposePreviewSurfaceOptions extends Pick<ComposePreviewProps,
  | 'assetResolver'
  | 'document'
  | 'layoutRuntime'
  | 'layoutSnapshot'
  | 'page'
  | 'pageLoader'
  | 'registry'
  | 'scriptModuleLoader'
  | 'scriptScope'> {
  /**
   * 会话是否在跑。
   *
   * @remarks
   * 弹框传 `open`，整屏传挂载状态。转为 false 时播放与屏幕尺寸复位，转为 true 时请求一次取景。
   */
  readonly active: boolean
  /** 台面元素的 ref；由调用方持有，Hook 只读它的尺寸。 */
  readonly stageRef: RefObject<HTMLElement | null>
  readonly selectedFrameId?: string | null
  readonly targetKind?: ComposePreviewTargetKind
  readonly navigation?: ComposeNavigationPort
  readonly livePage?: { readonly pageKey: string; readonly page: ComposePageFile }
  /**
   * 默认屏幕与默认取景，两个形态各取一档。
   *
   * @remarks
   * `target` 是模态形态：默认屏幕 = 目标自身尺寸，取景四周留出台面余量。
   * `viewport` 是整屏形态：默认屏幕 = **台面本身**（也就是视口），取景零留白，
   * 因此默认呈现的就是真实像素——那正是整屏存在的全部理由。
   *
   * @defaultValue 'target'
   */
  readonly framing?: ComposePreviewFraming
  /** 从另一个形态交接过来的状态；只作为初值，此后由本会话自己持有。 */
  readonly initial?: ComposePreviewHandoff
}

/** 默认屏幕与默认取景的档位。 @internal */
export type ComposePreviewFraming = 'target' | 'viewport'

/**
 * 两个预览形态之间交接的那三样。
 *
 * @remarks
 * `@compose-ui/preview` **不跨形态记忆它们**：宿主是唯一同时看得见两个形态的人，
 * 让预览自己记需要一个两边都挂着的单例。切换请求把它交出去，宿主原样回传给另一个形态。
 *
 * @public
 */
export interface ComposePreviewHandoff {
  /** 当前目标场景。 */
  readonly frameId?: string
  /** 当前屏幕尺寸；缺省表示用另一个形态自己的默认值。 */
  readonly screenSize?: ComposeSize
  /** 当前播放头（ms）；缺省表示还没有人手动接管过播放。 */
  readonly playheadMs?: number
}

/** 一块可选的预览目标场景。 */
export interface ComposePreviewSceneOption {
  readonly id: string
  /** 取自**当前正在预览的那份文档**，而不是宿主正在编辑的那份。 */
  readonly name: string
}

/** Surface 组件自己消费的那一半；chrome 不读它。 */
export interface ComposePreviewSurfaceContent {
  readonly pageMode: boolean
  readonly navigation: ComposeNavigationPort | undefined
  readonly livePage: ComposePreviewSurfaceOptions['livePage']
  readonly document: ComposeDocument | undefined
  readonly page: ComposePageFile | undefined
  /** 传给下游的目标：页面模式下只传用户的显式选择，见实现注释。 */
  readonly frameId: string | undefined
  readonly animationTimeMs: number | undefined
  readonly onPageChange: (page: ComposePageFile | null, pageKey: string | null) => void
}

/** 一次预览会话的全部状态。 */
export interface ComposePreviewSurfaceValue {
  readonly scenes: readonly ComposePreviewSceneOption[]
  /** 当前解析出的目标场景；chrome 用它画选中项。 */
  readonly frameId: string | undefined
  readonly selectScene: (id: string) => void
  readonly targetKind: ComposePreviewTargetKind
  /** 目标自身的尺寸，事实来源是 `Frame.size`。 */
  readonly targetSize: ComposeSize
  readonly screenSize: ComposeSize
  readonly setScreenSize: (size: ComposeSize) => void
  /** 当前屏幕是不是这一档的默认值（目标自身尺寸 / 实际视口），chrome 据此写读数。 */
  readonly screenIsDefault: boolean
  /** 回到这一档的默认屏幕，并重新取景。 */
  readonly resetScreen: () => void
  readonly framing: ComposePreviewFraming
  /** 交接给另一个形态的那三样。 */
  readonly handoff: () => ComposePreviewHandoff
  readonly fitScale: { readonly x: number, readonly y: number } | null
  readonly resize: {
    readonly session: ComposeScreenResizeSession
    readonly onPointerDown: (event: ReactPointerEvent<HTMLElement>) => void
    readonly onPointerMove: (event: ReactPointerEvent<HTMLElement>) => void
    readonly onPointerUp: (event: ReactPointerEvent<HTMLElement>) => void
  }
  readonly viewport: ComposeCanvasViewport
  readonly zoom: (intent: 'in' | 'out' | 'reset') => void
  /** 把当前这块屏取景到台面里；它是**动作**不是档位。 */
  readonly requestFit: () => void
  readonly animation: ComposeAnimation | undefined
  readonly playing: boolean
  readonly playheadMs: number
  readonly togglePlayback: () => void
  readonly content: ComposePreviewSurfaceContent
}

const INITIAL_VIEWPORT: ComposeCanvasViewport = { zoom: 1, offset: { x: 0, y: 0 } }

/**
 * 一次预览会话：目标解析、屏幕、视图与播放。
 *
 * @remarks
 * 模态与整屏两个形态调用的是**同一个** Hook，因此「两个预览不一样」这类缺陷没有产生的地方。
 * 本 Hook 不渲染任何 chrome，也不认识路由。
 *
 * @internal
 */
export function useComposePreviewSurface({
  active,
  stageRef,
  document: composeDocument,
  livePage,
  navigation,
  page,
  pageLoader,
  selectedFrameId,
  targetKind = 'scene',
  framing = 'target',
  initial,
}: ComposePreviewSurfaceOptions): ComposePreviewSurfaceValue {
  // 预览目标永远是一个场景：null 表示跟随宿主给出的激活场景，用户显式选过之后才固定。
  const [target, setTarget] = useState<string | null>(initial?.frameId ?? null)
  // 页面预览模式下当前页面由 ComposePageHost 加载，会话只是跟着它换场景列表与动画宿主。
  const [hostPage, setHostPage] = useState<{
    readonly pageKey: string | null
    readonly page: ComposePageFile | null
  }>({ pageKey: null, page: null })

  // 页面预览需要两个端口同时在场：只有导航端口而没有加载端口时无法取回任何页面，
  // 此时退回文档预览比渲染一个永远空白的宿主诚实。
  const pageMode = navigation !== undefined && pageLoader !== undefined
  /*
   * 导航快照要**自己订阅**而不是等 `onPageChange` 回灌：后者经过一次 effect 才到达，
   * 而 ComposePageHost 在同一帧就已经渲染新页面了。那一帧里用旧页面的 frameId 当显式目标
   * 传下去，`resolvePreviewFrameId` 对显式目标不回退，于是闪一帧「目标不存在」。
   */
  const navigationSnapshot = useSyncExternalStore(
    navigation?.subscribe ?? noopSubscribe,
    navigation?.getSnapshot ?? emptySnapshot,
  )
  const currentPageKey = pageMode ? navigationSnapshot.currentPageKey : null
  // 跳转后丢弃显式选择：上一页选中的场景 id 在新页面里没有意义。
  const [targetPageKey, setTargetPageKey] = useState<string | null>(currentPageKey)
  if (targetPageKey !== currentPageKey) {
    setTargetPageKey(currentPageKey)
    setTarget(null)
  }

  const activeDocument = pageMode ? hostPage.page?.document : composeDocument
  const activePage = pageMode ? hostPage.page ?? undefined : page
  const activeDefaultFrameId = pageMode ? hostPage.page?.activeFrameId ?? null : selectedFrameId

  // 场景列表就是文档的根 Frame；目标解析顺序：用户显式选择 → 宿主给的激活场景 → 第一个根 Frame。
  const sceneIds = activeDocument
    ? activeDocument.rootIds.filter((id) => getComposeFrame(activeDocument.entities[id]))
    : []
  const resolvedFrameId = (target && sceneIds.includes(target) ? target : null)
    ?? (activeDefaultFrameId && sceneIds.includes(activeDefaultFrameId) ? activeDefaultFrameId : null)
    ?? sceneIds[0]
    ?? undefined

  // 尺寸的唯一事实来源是 Frame.size；目标还没解析出来时用默认画板尺寸占位，
  // 让取景与布局有一个有限的数可用（内容本身由 ComposePreview 自己报错）。
  const targetEntity = resolvedFrameId ? activeDocument?.entities[resolvedFrameId] : undefined
  const targetSize = getComposeFrame(targetEntity)?.size ?? COMPOSE_DEFAULT_FRAME_SIZE

  // 屏幕尺寸：null 表示跟随这一档的默认值，用户改过之后才固定。
  const [screenSize, setScreenSize] = useState<ComposeSize | null>(initial?.screenSize ?? null)
  const stageSize = useComposeHostBoxSize(stageRef, active)
  /*
   * 整屏的默认屏幕是**实际视口**，而且它是一个模式不是一个值——打开时量一次存成固定值的
   * 症状是拖动窗口之后读数还写着旧的数，而屏幕上早就变了。台面还没量出来时退回目标尺寸：
   * 那一帧没有视口可言，而取景本来就要等到量出来才动。
   */
  const defaultScreenSize = framing === 'viewport' && stageSize
    ? { width: stageSize.width, height: stageSize.height }
    : targetSize
  const resolvedScreenSize = screenSize ?? defaultScreenSize
  const fit = defaultFitForTargetKind(targetKind)
  const fitScale = composeFitScale(fit, targetSize, resolvedScreenSize)
  // 整屏台面就是视口，留白等于把 1:1 变成 98%——而「默认就是真像素」正是它存在的理由。
  const fitPadding = framing === 'viewport' ? 0 : undefined
  const [viewport, setViewport] = useState<ComposeCanvasViewport>(INITIAL_VIEWPORT)
  /*
   * 取景重算是一次性动作而不是一个持续生效的模式。它只由四件事触发：会话开始、换目标、
   * 从下拉换一块屏、按「适应窗口」。**拖手柄与输入框都不触发**——拖动期间重新取景会让画板
   * 在屏幕上纹丝不动，拖了等于没有反馈；输入框逐字提交同理。
   */
  const [pendingFit, setPendingFit] = useState(true)
  const requestFit = () => { setPendingFit(true) }

  if (active && pendingFit) {
    const next = fitPreviewViewport(resolvedScreenSize, stageSize, fitPadding)
    if (next) {
      setViewport(next)
      setPendingFit(false)
    }
  }

  // 基础能力阶段与编辑器一致：预览播放第一条动画；多动画选择留给后续提案。
  // 清单归属 Frame：预览播放的是当前目标 Frame 自己的时间线。
  const animation = activeDocument && resolvedFrameId
    ? getComposeAnimations(activeDocument, resolvedFrameId)[0]
    : undefined
  const [playing, setPlaying] = useState(false)
  // 手动会话是否已接管播放头：未接管时 ComposePreview 按脚本绑定驱动（或停在 0 ms），
  // 用户第一次按播放即接管，会话结束时归还。
  const [manualEngaged, setManualEngaged] = useState(initial?.playheadMs !== undefined)
  // 权威播放头放 ref：rAF 回调里直接推进，direction 等 ping-pong 状态不挤进渲染状态；
  // state 只保留渲染需要的 timeMs，每次开始播放时在事件处理器里与 ref 对齐。
  const playhead = useRef<ComposePreviewPlayheadState>({
    timeMs: initial?.playheadMs ?? 0,
    direction: 1,
  })
  const [playheadMs, setPlayheadMs] = useState(initial?.playheadMs ?? 0)

  // 会话结束即复位播放与取景（渲染期 prev-adjust 模式，不在 effect 里 setState；
  // ref 留到下次播放开始时在事件处理器里对齐，渲染期不写 ref）。
  const [wasActive, setWasActive] = useState(active)
  if (wasActive !== active) {
    setWasActive(active)
    if (!active) {
      setPlaying(false)
      setManualEngaged(false)
      setPlayheadMs(0)
      setScreenSize(null)
    }
    else {
      /*
       * 会话开始时套用交接状态。**不能只靠 useState 初值**：弹框常驻挂载（关闭时渲染 null），
       * 初值只在整个宿主生命周期里跑一次，从整屏退回来那一次根本到不了。整屏形态挂载即 active，
       * 走的才是初值那条路——两条都要，各自覆盖一种形态。
       */
      setTarget(initial?.frameId ?? null)
      setScreenSize(initial?.screenSize ?? null)
      setPlayheadMs(initial?.playheadMs ?? 0)
      setManualEngaged(initial?.playheadMs !== undefined)
      setPendingFit(true)
    }
  }

  /*
   * 整屏形态里视口一变就要重新取景。
   *
   * **不分默认档与固定分辨率**：那个形态没有平移也没有缩放控件，取景完全是派生的，
   * 没有「用户自己的取景」可以保护。挑着 1280 × 720 把窗口从 1920 拖到 1280 时，
   * 不重算的话画板还停在 offset 320 上——一半在屏幕外。模态形态相反，那里的取景是用户
   * 用滚轮和适应窗口摆出来的，窗口变化不该动它。
   */
  const stageKey = stageSize ? `${stageSize.width}x${stageSize.height}` : ''
  const [lastStageKey, setLastStageKey] = useState(stageKey)
  if (lastStageKey !== stageKey) {
    setLastStageKey(stageKey)
    if (framing === 'viewport') setPendingFit(true)
  }

  // 换目标即回到该目标自身的尺寸：上一块场景的屏幕尺寸对这一块没有意义。
  const [lastTargetId, setLastTargetId] = useState(resolvedFrameId)
  if (lastTargetId !== resolvedFrameId) {
    setLastTargetId(resolvedFrameId)
    setScreenSize(null)
    setPendingFit(true)
  }

  const resize = useComposeScreenResize({
    screenSize: resolvedScreenSize,
    targetSize,
    zoom: viewport.zoom,
    onChange: setScreenSize,
  })

  // 手动播放循环与 ComposePreview 的脚本驱动共用同一份 rAF 生命周期管理。
  useAnimationFrameLoop(active && playing && animation !== undefined, (delta) => {
    if (!animation) return
    const advanced = advanceComposePreviewPlayhead(
      playhead.current,
      delta,
      animation.durationMs,
      animation.playbackMode,
    )
    playhead.current = advanced.state
    setPlayheadMs(advanced.state.timeMs)
    if (advanced.done) setPlaying(false)
  })

  const togglePlayback = () => {
    if (playing) {
      setPlaying(false)
      return
    }
    // 以渲染状态为准对齐 ref：会话复位后 ref 可能还停在旧时刻。
    // play-once 播完停在末尾：再次播放从头开始。
    const resumeMs = animation && playheadMs < animation.durationMs ? playheadMs : 0
    playhead.current = { timeMs: resumeMs, direction: 1 }
    setPlayheadMs(resumeMs)
    setManualEngaged(true)
    setPlaying(true)
  }

  /*
   * 页面模式下**只传用户的显式选择**，不传派生出来的回退值。
   *
   * 会话手上的 `activeDocument` 经 `onPageChange` 回灌，比 `ComposePageHost` 慢一拍，
   * 因此它派生出来的回退目标属于**上一页**；而显式目标按约定不回退，传下去就是新页面
   * 那一帧的「目标不存在」。不传时 PageHost 自己回退到该页的 `activeFrameId`——那本来
   * 就是这一档该有的答案。显式选择再额外验一次它属于当前这一页：跳转那一帧里它还是旧的。
   */
  const explicitTarget = target && targetPageKey === currentPageKey && sceneIds.includes(target)
    ? target
    : undefined

  return {
    scenes: sceneIds.map((id) => ({
      id,
      name: activeDocument?.entities[id]?.name ?? id,
    })),
    frameId: resolvedFrameId,
    selectScene: setTarget,
    targetKind,
    targetSize,
    screenSize: resolvedScreenSize,
    setScreenSize,
    screenIsDefault: screenSize === null,
    resetScreen: () => {
      setScreenSize(null)
      setPendingFit(true)
    },
    framing,
    handoff: () => ({
      frameId: resolvedFrameId,
      screenSize: resolvedScreenSize,
      ...(manualEngaged ? { playheadMs } : {}),
    }),
    fitScale,
    resize,
    viewport,
    zoom: (intent) => { setViewport((current) => zoomPreviewViewport(current, stageSize, intent)) },
    requestFit,
    animation,
    playing,
    playheadMs,
    togglePlayback,
    content: {
      pageMode,
      navigation,
      livePage,
      document: activeDocument,
      page: activePage,
      frameId: pageMode ? explicitTarget : resolvedFrameId,
      animationTimeMs: manualEngaged ? playheadMs : undefined,
      onPageChange: (nextPage, nextPageKey) => {
        setHostPage({ page: nextPage, pageKey: nextPageKey })
      },
    },
  }
}

/** 没有导航端口时喂给 `useSyncExternalStore` 的空订阅；它永不发布。 */
function noopSubscribe(): () => void {
  return () => undefined
}

/**
 * 没有导航端口时的空快照。
 *
 * @remarks
 * 必须返回**同一个对象**：`useSyncExternalStore` 每次渲染都会比较快照引用，每次新建
 * 会让它判定为「外部状态一直在变」而无限重渲染。
 */
const EMPTY_NAVIGATION_SNAPSHOT: ComposeNavigationSnapshot = Object.freeze({
  current: null,
  currentPageKey: null,
  canGoBack: false,
  issue: null,
})

function emptySnapshot(): ComposeNavigationSnapshot {
  return EMPTY_NAVIGATION_SNAPSHOT
}
