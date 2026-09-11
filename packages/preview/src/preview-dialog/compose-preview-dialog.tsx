import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { ComposeNavigationPort, ComposePageFile } from '@compose-ui/core'
import type { ComposePreviewProps } from '../compose-preview'
import { ComposePreviewSurface, useComposePreviewSurface } from '../preview-surface'
import {
  buildScreenSizeOptions,
  formatScreenMapping,
  screenSizeValue,
  swapScreenSize,
} from './screen-size'
import type { ComposePreviewTargetKind } from './screen-size'
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
/**
 * 在模态画板中输出完整文档或指定 Container 的只读预览。
 *
 * @remarks
 * Dialog 的可见性由 `open` 与 `onOpenChange` 控制。会话本身（目标、屏幕、视图、播放）住在
 * `useComposePreviewSurface`，与整屏形态**共用同一份实现**；本组件只提供模态 chrome。
 * **屏幕尺寸**（被预览的那块屏有多大）与**视图缩放**（它在对话框里画多大）是两份互不影响
 * 的状态，都不会改变传入的 ComposeDocument。
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
  const stageRef = useRef<HTMLDivElement>(null)
  const [fullscreen, setFullscreen] = useState(false)

  const surface = useComposePreviewSurface({
    active: open,
    assetResolver,
    document: composeDocument,
    layoutRuntime,
    layoutSnapshot,
    livePage,
    navigation,
    page,
    pageLoader,
    registry,
    scriptModuleLoader,
    scriptScope,
    selectedFrameId,
    stageRef,
    targetKind,
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

  const zoom = surface.zoom
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
        zoom('reset')
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onOpenChange, open, zoom])

  if (!open || typeof window === 'undefined') return null

  const screenOptions = buildScreenSizeOptions(surface.targetSize, messages.customSizeName)
  const currentScreenValue = screenSizeValue(surface.screenSize)
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
  const commitScreenAxis = (axis: 'width' | 'height', raw: string) => {
    const value = Number.parseFloat(raw)
    if (!Number.isFinite(value) || value <= 0) return
    surface.setScreenSize({ ...surface.screenSize, [axis]: Math.round(value) })
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
                value={surface.frameId ?? ''}
                onChange={(event) => surface.selectScene(event.target.value)}
              >
                {surface.scenes.map((scene) => (
                  <option key={scene.id} value={scene.id}>{scene.name}</option>
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
                  surface.setScreenSize(option.size)
                  surface.requestFit()
                }}
              >
                {/* 当前尺寸是手输或拖出来的自定义值时，下拉需要一个能落脚的空值项，
                    否则受控 select 会退回第一项，读起来像用户换了一块屏。 */}
                {knownScreenValues.has(currentScreenValue) ? null : (
                  <option value="">
                    {`${surface.screenSize.width} × ${surface.screenSize.height} · ${messages.customSizeName}`}
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
                value={surface.screenSize.width}
                onChange={(event) => commitScreenAxis('width', event.target.value)}
              />
              <span aria-hidden="true">×</span>
              <input
                aria-label={messages.screenHeight}
                data-testid="compose-preview-dialog-screen-height"
                min={1}
                step={1}
                type="number"
                value={surface.screenSize.height}
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
                  surface.setScreenSize(swapScreenSize(surface.screenSize))
                  surface.requestFit()
                }}
              >
                <SwapIcon />
              </button>
            ) : null}
            {/* 三组：改这块屏 · 看这块屏 · 离开。 */}
            <span aria-hidden="true" className="compose-preview-dialog__rule" />
            {surface.animation ? (
              <button
                aria-label={surface.playing ? messages.pause : messages.play}
                aria-pressed={surface.playing}
                type="button"
                onClick={surface.togglePlayback}
              >
                {surface.playing ? <PauseIcon /> : <PlayIcon />}
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
        <div className="compose-preview-surface__stage" ref={stageRef}>
          <ComposePreviewSurface
            artboardTestId="compose-preview-dialog-artboard"
            assetResolver={assetResolver}
            layoutRuntime={layoutRuntime}
            layoutSnapshot={layoutSnapshot}
            pageLoader={pageLoader}
            registry={registry}
            scriptModuleLoader={scriptModuleLoader}
            scriptScope={scriptScope}
            value={surface}
            artboardOverlay={(
              <>
                <button
                  aria-label={messages.resizeScreen}
                  className="compose-preview-dialog__resize"
                  data-snapped={surface.resize.session.snapped ? 'true' : undefined}
                  data-testid="compose-preview-dialog-resize-handle"
                  type="button"
                  onPointerDown={surface.resize.onPointerDown}
                  onPointerMove={surface.resize.onPointerMove}
                  onPointerUp={surface.resize.onPointerUp}
                />
                <span
                  aria-label={messages.screenMapping}
                  className="compose-preview-dialog__size-pill"
                  data-snapped={surface.resize.session.snapped ? 'true' : undefined}
                  data-testid="compose-preview-dialog-size-pill"
                >
                  {formatScreenMapping(surface.screenSize, surface.targetSize, surface.fitScale?.x ?? 1)}
                  {surface.resize.session.snapped?.preset?.name
                    ? <b>{surface.resize.session.snapped.preset.name}</b>
                    : null}
                </span>
              </>
            )}
          />
          <div className="compose-preview-dialog__zoom">
            <button
              aria-label={messages.zoomOut}
              data-testid="compose-preview-dialog-zoom-out"
              type="button"
              onClick={() => surface.zoom('out')}
            >
              −
            </button>
            <output
              aria-label={messages.zoomLevel}
              data-testid="compose-preview-dialog-zoom"
            >
              {`${Math.round(surface.viewport.zoom * 100)}%`}
            </output>
            <button
              aria-label={messages.zoomIn}
              data-testid="compose-preview-dialog-zoom-in"
              type="button"
              onClick={() => surface.zoom('in')}
            >
              +
            </button>
            <button
              aria-label={messages.fitToWindow}
              data-testid="compose-preview-dialog-fit"
              type="button"
              onClick={surface.requestFit}
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
