import { useEffect, useId, useRef, useState, useSyncExternalStore } from 'react'
import type { CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import {
  COMPOSE_DEFAULT_FRAME_SIZE,
  getComposeAnimations,
  getComposeFrame,
} from '@compose-ui/core'
import type {
  ComposeCanvasViewport,
  ComposeNavigationPort,
  ComposeNavigationSnapshot,
  ComposePageFile,
  ComposeSize,
} from '@compose-ui/core'
import { ComposePreview } from '../compose-preview'
import { ComposePageHost } from '../page-host'
import type { ComposePreviewProps } from '../compose-preview'
import { composeFitScale, useComposeHostBoxSize } from '../host-box'
import { advanceComposePreviewPlayhead } from '../playback/playback-model'
import type { ComposePreviewPlayheadState } from '../playback/playback-model'
import { useAnimationFrameLoop } from '../playback/use-animation-frame-loop'
import {
  buildScreenSizeOptions,
  defaultFitForTargetKind,
  fitPreviewViewport,
  formatScreenMapping,
  screenSizeValue,
  swapScreenSize,
  zoomPreviewViewport,
} from './screen-size'
import type { ComposePreviewTargetKind } from './screen-size'
import { useComposeScreenResize } from './use-screen-resize'
import './styles.css'

/** ComposePreviewDialog 的可本地化文案。 @public */
export interface ComposePreviewDialogMessages {
  /** 对话框标题。 */
  readonly title: string
  /** 场景选择器的无障碍名称。 */
  readonly target: string
  /** 屏幕尺寸选择器的无障碍名称。 */
  readonly screenSize: string
  /** 屏幕尺寸下拉中「预览目标自身尺寸」那一组的标题（场景目标）。 */
  readonly targetSizeGroupScene: string
  /** 屏幕尺寸下拉中「预览目标自身尺寸」那一组的标题（组件目标）。 */
  readonly targetSizeGroupComponent: string
  /** 屏幕尺寸下拉中常见屏幕那一组的标题（场景目标）。 */
  readonly commonScreensGroupScene: string
  /** 屏幕尺寸下拉中常见屏幕那一组的标题（组件目标）。 */
  readonly commonScreensGroupComponent: string
  /** 尺寸不匹配任何常见分辨率时，替代通名印在选项里的词。 */
  readonly customSizeName: string
  /** 屏幕宽度输入框的无障碍名称。 */
  readonly screenWidth: string
  /** 屏幕高度输入框的无障碍名称。 */
  readonly screenHeight: string
  /** 横竖互换的无障碍名称。 */
  readonly swapOrientation: string
  /** 拖动改屏幕尺寸的手柄的无障碍名称。 */
  readonly resizeScreen: string
  /** 放大的无障碍名称。 */
  readonly zoomIn: string
  /** 缩小的无障碍名称。 */
  readonly zoomOut: string
  /** 「适应窗口」动作的无障碍名称。 */
  readonly fitToWindow: string
  /** 当前视图缩放读数的无障碍名称。 */
  readonly zoomLevel: string
  /** 尺寸胶囊的无障碍名称。 */
  readonly screenMapping: string
  /** 进入全屏的无障碍名称。 */
  readonly enterFullscreen: string
  /** 退出全屏的无障碍名称。 */
  readonly exitFullscreen: string
  /** 关闭操作的无障碍名称。 */
  readonly close: string
  /** 键盘关闭提示；渲染成关闭按钮的 tooltip，不再单占一行页脚。 */
  readonly closeHint: string
  /** 开始播放动画的无障碍名称；文档无动画时不出现播放控件。 */
  readonly play: string
  /** 暂停动画播放的无障碍名称。 */
  readonly pause: string
}

const DEFAULT_MESSAGES: ComposePreviewDialogMessages = {
  title: 'Preview',
  target: 'Preview scene',
  screenSize: 'Screen size',
  targetSizeGroupScene: 'Scene size',
  targetSizeGroupComponent: 'Component size',
  commonScreensGroupScene: 'Common screens',
  commonScreensGroupComponent: 'Place it on a screen this big',
  customSizeName: 'Custom',
  screenWidth: 'Screen width',
  screenHeight: 'Screen height',
  swapOrientation: 'Swap orientation',
  resizeScreen: 'Drag to resize the screen',
  zoomIn: 'Zoom in',
  zoomOut: 'Zoom out',
  fitToWindow: 'Fit to window',
  zoomLevel: 'Zoom level',
  screenMapping: 'Screen and target size',
  enterFullscreen: 'Enter fullscreen preview',
  exitFullscreen: 'Exit fullscreen preview',
  close: 'Close preview',
  closeHint: 'Press Esc to close preview',
  play: 'Play animation',
  pause: 'Pause animation',
}

/** ComposePreviewDialog 属性。 @public */
export interface ComposePreviewDialogProps extends Pick<ComposePreviewProps,
  | 'assetResolver'
  | 'document'
  | 'layoutRuntime'
  | 'layoutSnapshot'
  | 'page'
  | 'pageLoader'
  | 'registry'
  | 'scriptModuleLoader'
  | 'scriptScope'> {
  /** 是否显示对话框；状态完全由宿主控制。 */
  readonly open: boolean
  /** 用户请求打开或关闭对话框时调用。 */
  readonly onOpenChange: (open: boolean) => void
  /**
   * 可选的 Frame ID；提供后允许从默认 Frame 切换到该 Frame 的预览。
   *
   * @remarks
   * 通常是当前选区所属的画板。Preview 只有一种目标——一个 Frame，因此这里也只接受 Frame。
   */
  readonly selectedFrameId?: string | null
  /**
   * 预览目标的种类。
   *
   * @remarks
   * 决定屏幕尺寸下拉的分组文案、是否提供横竖互换，以及**默认的 `fit`**：场景是那块屏的
   * 全部内容（`contain`），组件只是屏上的一个零件（`none`）。
   *
   * MUST NOT 从文档反推——一份不带导航端口的页面文档与一份组件文档在结构上完全一样。
   *
   * @defaultValue 'scene'
   */
  readonly targetKind?: ComposePreviewTargetKind
  /**
   * 宿主导航端口。
   *
   * @remarks
   * 提供后对话框切换为**页面预览**：内容由 `ComposePageHost` 承载，`Interaction` 的跳转
   * 在对话框内真实生效，场景选择器只列出当前页面的根 Frame。缺省时对话框保持文档预览。
   *
   * 页面模式一旦成立就会**完全取代**传入的 `document`，因此宿主 MUST 只在画布上正在编辑
   * 的就是那一页时提供它；否则打开组件再预览会呈现上一个页面。
   */
  readonly navigation?: ComposeNavigationPort
  /**
   * 正在编辑的那一页及其 live 文档；页面预览据此显示尚未保存的改动。
   *
   * @remarks
   * 省略时页面预览只呈现 Provider 里已保存的内容。与 {@link ComposePreviewDialogProps.navigation}
   * 同一条契约：只在画布上正在编辑的就是那一页时提供。
   */
  readonly livePage?: { readonly pageKey: string; readonly page: ComposePageFile }
  /** 覆盖由标题派生的 Dialog 无障碍名称。 */
  readonly dialogLabel?: string
  /** 覆盖默认英文文案的本地化内容。 */
  readonly messages?: Partial<ComposePreviewDialogMessages>
}

function CloseIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="m6 6 12 12M18 6 6 18" />
    </svg>
  )
}

function FullscreenIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M8 4H4v4M16 4h4v4M20 16v4h-4M4 16v4h4" />
    </svg>
  )
}

function FitIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M9 4H4v5M15 4h5v5M20 15v5h-5M4 15v5h5" />
    </svg>
  )
}

function SwapIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M4 8h13l-3-3M20 16H7l3 3" />
    </svg>
  )
}

function PlayIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M8 5.5v13l11-6.5-11-6.5Z" />
    </svg>
  )
}

function PauseIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M8 5.5v13M16 5.5v13" />
    </svg>
  )
}

const INITIAL_PLAYHEAD: ComposePreviewPlayheadState = { timeMs: 0, direction: 1 }
const INITIAL_VIEWPORT: ComposeCanvasViewport = { zoom: 1, offset: { x: 0, y: 0 } }

/**
 * 在模态画板中输出完整文档或指定 Container 的只读预览。
 *
 * @remarks
 * Dialog 的可见性由 `open` 与 `onOpenChange` 控制。**屏幕尺寸**（被预览的那块屏有多大）与
 * **视图缩放**（它在对话框里画多大）是两份互不影响的会话状态，都不会改变传入的
 * ComposeDocument。
 *
 * @public
 */
export function ComposePreviewDialog({
  assetResolver,
  navigation,
  livePage,
  selectedFrameId,
  targetKind = 'scene',
  dialogLabel,
  document: composeDocument,
  page,
  layoutRuntime,
  layoutSnapshot,
  messages: messageOverrides,
  onOpenChange,
  open,
  pageLoader,
  registry,
  scriptModuleLoader,
  scriptScope,
}: ComposePreviewDialogProps) {
  const messages = { ...DEFAULT_MESSAGES, ...messageOverrides }
  const titleId = useId()
  const shell = useRef<HTMLDivElement>(null)
  const closeButton = useRef<HTMLButtonElement>(null)
  const focusBeforeOpen = useRef<HTMLElement | null>(null)
  // 预览目标永远是一个场景：null 表示跟随宿主给出的激活场景，用户显式选过之后才固定。
  const [target, setTarget] = useState<string | null>(null)
  const [fullscreen, setFullscreen] = useState(false)
  // 页面预览模式下当前页面由 ComposePageHost 加载，对话框只是跟着它换场景列表与动画宿主。
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

  // 屏幕尺寸：null 表示跟随目标自身尺寸，用户改过之后才固定。
  const [screenSize, setScreenSize] = useState<ComposeSize | null>(null)
  const resolvedScreenSize = screenSize ?? targetSize
  const fit = defaultFitForTargetKind(targetKind)
  const fitScale = composeFitScale(fit, targetSize, resolvedScreenSize)

  const stageRef = useRef<HTMLDivElement>(null)
  const stageSize = useComposeHostBoxSize(stageRef, open)
  const [viewport, setViewport] = useState<ComposeCanvasViewport>(INITIAL_VIEWPORT)
  /*
   * 取景重算是一次性动作而不是一个持续生效的模式。它只由四件事触发：打开对话框、换目标、
   * 从下拉换一块屏、按「适应窗口」。**拖手柄与输入框都不触发**——拖动期间重新取景会让画板
   * 在屏幕上纹丝不动，拖了等于没有反馈；输入框逐字提交同理。
   */
  const [pendingFit, setPendingFit] = useState(true)
  const requestFit = () => { setPendingFit(true) }

  if (open && pendingFit) {
    const next = fitPreviewViewport(resolvedScreenSize, stageSize)
    if (next) {
      setViewport(next)
      setPendingFit(false)
    }
  }

  // 基础能力阶段与编辑器一致：预览播放第一条动画；多动画选择留给后续提案。
  // 清单归属 Frame：预览播放的是当前目标 Frame 自己的时间线。
  const animationHostFrameId = resolvedFrameId
  const animation = activeDocument && animationHostFrameId
    ? getComposeAnimations(activeDocument, animationHostFrameId)[0]
    : undefined
  const [playing, setPlaying] = useState(false)
  // 手动会话是否已接管播放头：未接管时 ComposePreview 按脚本绑定驱动（或停在 0 ms），
  // 用户第一次按播放即接管，关闭对话框归还。
  const [manualEngaged, setManualEngaged] = useState(false)
  // 权威播放头放 ref：rAF 回调里直接推进，direction 等 ping-pong 状态不挤进渲染状态；
  // state 只保留渲染需要的 timeMs，每次开始播放时在事件处理器里与 ref 对齐。
  const playhead = useRef(INITIAL_PLAYHEAD)
  const [playheadMs, setPlayheadMs] = useState(0)

  // 关闭对话框即复位播放与取景会话（渲染期 prev-adjust 模式，不在 effect 里 setState；
  // ref 留到下次播放开始时在事件处理器里对齐，渲染期不写 ref）。
  const [wasOpen, setWasOpen] = useState(open)
  if (wasOpen !== open) {
    setWasOpen(open)
    if (!open) {
      setPlaying(false)
      setManualEngaged(false)
      setPlayheadMs(0)
      setScreenSize(null)
    }
    else setPendingFit(true)
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
  useAnimationFrameLoop(open && playing && animation !== undefined, (delta) => {
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

  useEffect(() => {
    if (open) {
      focusBeforeOpen.current = document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null
      closeButton.current?.focus()
      return
    }
    focusBeforeOpen.current?.focus()
    focusBeforeOpen.current = null
  }, [open])

  useEffect(() => {
    const handleFullscreenChange = () => {
      setFullscreen(document.fullscreenElement === shell.current)
    }
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [])

  useEffect(() => {
    if (!open) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onOpenChange(false)
        return
      }
      // Ctrl/Cmd + 0：回到 100%，与画布同一个键位。
      if (event.key === '0' && (event.ctrlKey || event.metaKey)) {
        event.preventDefault()
        setViewport((current) => zoomPreviewViewport(current, stageSize, 'reset'))
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
    // 台面尺寸进依赖：`Ctrl+0` 绕台面中心缩放，尺寸变了就要重新挂一次，代价只是一次
    // window 监听器的换绑。
  }, [onOpenChange, open, stageSize])

  if (!open || typeof window === 'undefined') return null

  /*
   * 页面模式下**只传用户的显式选择**，不传派生出来的回退值。
   *
   * 对话框手上的 `activeDocument` 经 `onPageChange` 回灌，比 `ComposePageHost` 慢一拍，
   * 因此它派生出来的回退目标属于**上一页**；而显式目标按约定不回退，传下去就是新页面
   * 那一帧的「目标不存在」。不传时 PageHost 自己回退到该页的 `activeFrameId`——那本来
   * 就是这一档该有的答案。显式选择再额外验一次它属于当前这一页：跳转那一帧里它还是旧的。
   */
  const explicitTarget = target && targetPageKey === currentPageKey && sceneIds.includes(target)
    ? target
    : undefined
  const previewFrameId = pageMode ? explicitTarget : resolvedFrameId
  const screenOptions = buildScreenSizeOptions(targetSize, messages.customSizeName)
  const currentScreenValue = screenSizeValue(resolvedScreenSize)
  const knownScreenValues = new Set([
    screenOptions.target.value,
    ...screenOptions.presets.map((option) => option.value),
  ])

  const toggleFullscreen = () => {
    const element = shell.current
    if (!element) return
    if (document.fullscreenElement === element) {
      void document.exitFullscreen()
      return
    }
    void element.requestFullscreen().catch(() => undefined)
  }
  const togglePlayback = () => {
    if (playing) {
      setPlaying(false)
      return
    }
    // 以渲染状态为准对齐 ref：关闭复位后 ref 可能还停在旧时刻。
    // play-once 播完停在末尾：再次播放从头开始。
    const resumeMs = animation && playheadMs < animation.durationMs ? playheadMs : 0
    playhead.current = { timeMs: resumeMs, direction: 1 }
    setPlayheadMs(resumeMs)
    setManualEngaged(true)
    setPlaying(true)
  }
  const commitScreenAxis = (axis: 'width' | 'height', raw: string) => {
    const value = Number.parseFloat(raw)
    if (!Number.isFinite(value) || value <= 0) return
    setScreenSize({ ...resolvedScreenSize, [axis]: Math.round(value) })
  }

  return createPortal(
    <div
      className="compose-preview-dialog__backdrop"
      data-compose-ui="preview-dialog-backdrop"
      data-testid="compose-preview-dialog-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onOpenChange(false)
      }}
    >
      <div
        {...(dialogLabel ? { 'aria-label': dialogLabel } : { 'aria-labelledby': titleId })}
        aria-modal="true"
        className="compose-preview-dialog"
        data-compose-ui="preview-dialog"
        ref={shell}
        role="dialog"
      >
        <header className="compose-preview-dialog__header">
          {/*
            * 场景名就是这个弹框的标题，因此标题文案退成对话框的可访问名称而不占一行。
            * 它仍然要渲染出来：`aria-labelledby` 指向的元素必须真的在文档里。
            */}
          <div className="compose-preview-dialog__target">
            <span className="compose-preview-dialog__sr-only" id={titleId}>{messages.title}</span>
            <label>
              <span className="compose-preview-dialog__sr-only">{messages.target}</span>
              <select
                data-testid="compose-preview-dialog-scene"
                value={resolvedFrameId ?? ''}
                onChange={(event) => setTarget(event.target.value)}
              >
                {sceneIds.map((id) => (
                  <option key={id} value={id}>
                    {activeDocument?.entities[id]?.name ?? id}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="compose-preview-dialog__tools">
            <label>
              <span className="compose-preview-dialog__sr-only">{messages.screenSize}</span>
              <select
                data-testid="compose-preview-dialog-screen-size"
                value={knownScreenValues.has(currentScreenValue) ? currentScreenValue : ''}
                onChange={(event) => {
                  const option = event.target.value === screenOptions.target.value
                    ? screenOptions.target
                    : screenOptions.presets.find((item) => item.value === event.target.value)
                  if (!option) return
                  setScreenSize(option.size)
                  requestFit()
                }}
              >
                {/* 当前尺寸是手输或拖出来的自定义值时，下拉需要一个能落脚的空值项，
                    否则受控 select 会退回第一项，读起来像用户换了一块屏。 */}
                {knownScreenValues.has(currentScreenValue) ? null : (
                  <option value="">
                    {`${resolvedScreenSize.width} × ${resolvedScreenSize.height} · ${messages.customSizeName}`}
                  </option>
                )}
                <optgroup
                  label={targetKind === 'component'
                    ? messages.targetSizeGroupComponent
                    : messages.targetSizeGroupScene}
                >
                  <option value={screenOptions.target.value}>{screenOptions.target.label}</option>
                </optgroup>
                <optgroup
                  label={targetKind === 'component'
                    ? messages.commonScreensGroupComponent
                    : messages.commonScreensGroupScene}
                >
                  {screenOptions.presets.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </optgroup>
              </select>
            </label>
            <div className="compose-preview-dialog__size-fields">
              <input
                aria-label={messages.screenWidth}
                data-testid="compose-preview-dialog-screen-width"
                min={1}
                step={1}
                type="number"
                value={resolvedScreenSize.width}
                onChange={(event) => commitScreenAxis('width', event.target.value)}
              />
              <span aria-hidden="true">×</span>
              <input
                aria-label={messages.screenHeight}
                data-testid="compose-preview-dialog-screen-height"
                min={1}
                step={1}
                type="number"
                value={resolvedScreenSize.height}
                onChange={(event) => commitScreenAxis('height', event.target.value)}
              />
            </div>
            {/* 横竖互换对组件不出现：88 × 132 换成 132 × 88 不是任何人会提的请求。 */}
            {targetKind === 'scene' ? (
              <button
                aria-label={messages.swapOrientation}
                className="compose-preview-dialog__swap"
                data-testid="compose-preview-dialog-swap"
                type="button"
                onClick={() => {
                  setScreenSize(swapScreenSize(resolvedScreenSize))
                  requestFit()
                }}
              >
                <SwapIcon />
              </button>
            ) : null}
            {/* 三组：改这块屏 · 看这块屏 · 离开。 */}
            <span aria-hidden="true" className="compose-preview-dialog__rule" />
            {animation ? (
              <button
                aria-label={playing ? messages.pause : messages.play}
                aria-pressed={playing}
                type="button"
                onClick={togglePlayback}
              >
                {playing ? <PauseIcon /> : <PlayIcon />}
              </button>
            ) : null}
            <button
              aria-label={fullscreen ? messages.exitFullscreen : messages.enterFullscreen}
              type="button"
              onClick={toggleFullscreen}
            >
              <FullscreenIcon />
            </button>
            <span aria-hidden="true" className="compose-preview-dialog__rule" />
            <button
              aria-label={messages.close}
              ref={closeButton}
              title={messages.closeHint}
              type="button"
              onClick={() => onOpenChange(false)}
            >
              <CloseIcon />
            </button>
          </div>
        </header>
        <div className="compose-preview-dialog__stage" ref={stageRef}>
          <div
            className="compose-preview-dialog__artboard"
            data-testid="compose-preview-dialog-artboard"
            style={{
              left: viewport.offset.x,
              top: viewport.offset.y,
              width: resolvedScreenSize.width * viewport.zoom,
              height: resolvedScreenSize.height * viewport.zoom,
            }}
          >
            <div
              className="compose-preview-dialog__screen"
              style={{
                width: resolvedScreenSize.width,
                height: resolvedScreenSize.height,
                transform: `scale(${viewport.zoom})`,
              } as CSSProperties}
            >
              {pageMode && navigation && pageLoader
                ? (
                    <ComposePageHost
                      animationTimeMs={manualEngaged ? playheadMs : undefined}
                      assetResolver={assetResolver}
                      fit={fit}
                      frameId={previewFrameId}
                      layoutRuntime={animation ? undefined : layoutRuntime}
                      layoutSnapshot={animation ? undefined : layoutSnapshot}
                      navigation={navigation}
                      onPageChange={(nextPage, nextPageKey) => {
                        setHostPage({ page: nextPage, pageKey: nextPageKey })
                      }}
                      livePage={livePage}
                      pageLoader={pageLoader}
                      registry={registry}
                      scriptModuleLoader={scriptModuleLoader}
                    />
                  )
                : (
                    <ComposePreview
                      animationTimeMs={manualEngaged ? playheadMs : undefined}
                      assetResolver={assetResolver}
                      document={activeDocument}
                      fit={fit}
                      page={activePage}
                      layoutRuntime={animation ? undefined : layoutRuntime}
                      layoutSnapshot={animation ? undefined : layoutSnapshot}
                      pageLoader={pageLoader}
                      registry={registry}
                      scriptModuleLoader={scriptModuleLoader}
                      scriptScope={scriptScope}
                      frameId={previewFrameId}
                    />
                  )}
            </div>
            <button
              aria-label={messages.resizeScreen}
              className="compose-preview-dialog__resize"
              data-snapped={resize.session.snapped ? 'true' : undefined}
              data-testid="compose-preview-dialog-resize-handle"
              type="button"
              onPointerDown={resize.onPointerDown}
              onPointerMove={resize.onPointerMove}
              onPointerUp={resize.onPointerUp}
            />
            <span
              aria-label={messages.screenMapping}
              className="compose-preview-dialog__size-pill"
              data-snapped={resize.session.snapped ? 'true' : undefined}
              data-testid="compose-preview-dialog-size-pill"
            >
              {formatScreenMapping(resolvedScreenSize, targetSize, fitScale?.x ?? 1)}
              {resize.session.snapped?.preset?.name
                ? <b>{resize.session.snapped.preset.name}</b>
                : null}
            </span>
          </div>
          <div className="compose-preview-dialog__zoom">
            <button
              aria-label={messages.zoomOut}
              data-testid="compose-preview-dialog-zoom-out"
              type="button"
              onClick={() => setViewport((current) => zoomPreviewViewport(current, stageSize, 'out'))}
            >
              −
            </button>
            <output
              aria-label={messages.zoomLevel}
              data-testid="compose-preview-dialog-zoom"
            >
              {`${Math.round(viewport.zoom * 100)}%`}
            </output>
            <button
              aria-label={messages.zoomIn}
              data-testid="compose-preview-dialog-zoom-in"
              type="button"
              onClick={() => setViewport((current) => zoomPreviewViewport(current, stageSize, 'in'))}
            >
              +
            </button>
            <button
              aria-label={messages.fitToWindow}
              data-testid="compose-preview-dialog-fit"
              type="button"
              onClick={requestFit}
            >
              <FitIcon />
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
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
