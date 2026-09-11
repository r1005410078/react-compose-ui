import { useEffect, useRef, useState } from 'react'
import type { ComposeNavigationPort, ComposePageFile } from '@compose-ui/core'
import type { ComposePreviewProps } from '../compose-preview'
import { ComposePreviewSurface, useComposePreviewSurface } from '../preview-surface'
import type { ComposePreviewHandoff } from '../preview-surface'
import {
  buildScreenSizeOptions,
  screenSizeValue,
  swapScreenSize,
} from '../preview-dialog/screen-size'
import type { ComposePreviewTargetKind } from '../preview-dialog/screen-size'
import './styles.css'

/** ComposePreviewPage 的可本地化文案。 @public */
export interface ComposePreviewPageMessages {
  /** 整个区域的可访问名称。 */
  readonly label: string
  /** 退出整屏、回到编辑器的无障碍名称。 */
  readonly exit: string
  /** 控制条本身的可访问名称。 */
  readonly toolbar: string
  /** 场景选择器的无障碍名称。 */
  readonly target: string
  /** 屏幕尺寸选择器的无障碍名称。 */
  readonly screenSize: string
  /** 默认那一档屏幕的名字：浏览器视口本身。 */
  readonly actualScreen: string
  /** 常见屏幕那一组的标题。 */
  readonly commonScreensGroup: string
  /** 尺寸不匹配任何常见分辨率时替代通名的词。 */
  readonly customSizeName: string
  /** 横竖互换的无障碍名称。 */
  readonly swapOrientation: string
  /** 进入浏览器全屏的无障碍名称。 */
  readonly enterFullscreen: string
  /** 退出浏览器全屏的无障碍名称。 */
  readonly exitFullscreen: string
  /** 屏幕读数的无障碍名称。 */
  readonly screenMapping: string
}

const DEFAULT_MESSAGES: ComposePreviewPageMessages = {
  label: 'Fullscreen preview',
  exit: 'Back to editor',
  toolbar: 'Preview controls',
  target: 'Preview scene',
  screenSize: 'Screen size',
  actualScreen: 'Actual screen',
  commonScreensGroup: 'Common screens',
  customSizeName: 'Custom',
  swapOrientation: 'Swap orientation',
  enterFullscreen: 'Enter fullscreen',
  exitFullscreen: 'Exit fullscreen',
  screenMapping: 'Current screen',
}

/** ComposePreviewPage 属性。 @public */
export interface ComposePreviewPageProps extends Pick<ComposePreviewProps,
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
   * 用户请求离开整屏形态。
   *
   * @remarks
   * 路由归宿主：本组件只渲染，不认识 URL，也不卸载任何东西。退出有两条路径——控制条上的
   * 退出动作与 `Escape`；零 chrome 意味着没有可见出口，出口因此必须不止一条。
   */
  readonly onRequestExit: () => void
  /** 从模态形态交接过来的场景、屏幕尺寸与播放头。 */
  readonly initialState?: ComposePreviewHandoff
  readonly selectedFrameId?: string | null
  readonly targetKind?: ComposePreviewTargetKind
  /** 宿主导航端口；提供后 `Interaction` 的跳转在整屏里真实生效。 */
  readonly navigation?: ComposeNavigationPort
  /** 正在编辑的那一页及其 live 文档，使整屏形态同样含未保存的改动。 */
  readonly livePage?: { readonly pageKey: string; readonly page: ComposePageFile }
  /** 覆盖默认英文文案的本地化内容。 */
  readonly messages?: Partial<ComposePreviewPageMessages>
}

/** 控制条静息多久之后隐去。 */
const REST_HIDE_MS = 2000

function ExitIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M15 5 8 12l7 7" />
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

function FullscreenIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M8 4H4v4M16 4h4v4M20 16v4h-4M4 16v4h4" />
    </svg>
  )
}

/**
 * 整屏预览：交付形态。
 *
 * @remarks
 * 它回答的是「交付出去之后，它长什么样」，因此默认屏幕是**实际视口**、视图 1:1——默认呈现
 * 的就是真实像素。静息态一个控件都不画，这是它存在的全部理由。
 *
 * 它 MUST 与编辑器处在同一个浏览上下文：既有规则要求页面预览包含尚未保存的改动，而新标签页
 * 读不到宿主手上的 live 文档。宿主负责路由，本组件不卸载任何东西。
 *
 * 内容由与 `ComposePreviewDialog` **同一层实现**产出，因此两个形态不会画出不同的东西。
 *
 * @public
 */
export function ComposePreviewPage({
  assetResolver,
  document: composeDocument,
  initialState,
  layoutRuntime,
  layoutSnapshot,
  livePage,
  messages: messageOverrides,
  navigation,
  onRequestExit,
  page,
  pageLoader,
  registry,
  scriptModuleLoader,
  scriptScope,
  selectedFrameId,
  targetKind = 'scene',
}: ComposePreviewPageProps) {
  const messages = { ...DEFAULT_MESSAGES, ...messageOverrides }
  const stageRef = useRef<HTMLDivElement>(null)
  const shell = useRef<HTMLDivElement>(null)
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [barVisible, setBarVisible] = useState(true)
  const [fullscreen, setFullscreen] = useState(false)

  const surface = useComposePreviewSurface({
    active: true,
    assetResolver,
    document: composeDocument,
    framing: 'viewport',
    initial: initialState,
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
  })

  /*
   * 静息即隐去，但**键盘焦点在控制条内时恒可见**：键盘用户不会移动指针，只按指针显隐会让
   * 控制条对他永远不存在。计时器只在事件处理器里起停，渲染期不碰它。
   */
  const [focusInBar, setFocusInBar] = useState(false)
  const restartHideTimer = () => {
    if (hideTimer.current !== null) clearTimeout(hideTimer.current)
    hideTimer.current = setTimeout(() => { setBarVisible(false) }, REST_HIDE_MS)
  }
  const revealBar = () => {
    setBarVisible(true)
    restartHideTimer()
  }

  /*
   * 进来时先亮一下再隐去，而不是一上来就是零 chrome：零 chrome 意味着没有可见出口，
   * 用户需要先看见出口在哪儿。此后它才由指针唤出。
   */
  useEffect(() => {
    restartHideTimer()
    return () => {
      if (hideTimer.current !== null) clearTimeout(hideTimer.current)
    }
    // 只在挂载时起一次：`restartHideTimer` 每次渲染都是新函数，进依赖会让计时器一直被重置。
  }, [])

  useEffect(() => {
    const handleFullscreenChange = () => {
      setFullscreen(document.fullscreenElement === shell.current)
    }
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      onRequestExit()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onRequestExit])

  const screenOptions = buildScreenSizeOptions(surface.targetSize, messages.customSizeName)
  const currentScreenValue = surface.screenIsDefault ? '' : screenSizeValue(surface.screenSize)
  const knownScreenValues = new Set(screenOptions.presets.map((option) => option.value))

  const toggleFullscreen = () => {
    const element = shell.current
    if (!element) return
    if (document.fullscreenElement === element) {
      void document.exitFullscreen()
      return
    }
    void element.requestFullscreen().catch(() => undefined)
  }

  return (
    <div
      aria-label={messages.label}
      className="compose-preview-page"
      data-compose-ui="preview-page"
      data-testid="compose-preview-page"
      ref={shell}
      role="region"
      onPointerMove={revealBar}
    >
      <div className="compose-preview-surface__stage" ref={stageRef}>
        <ComposePreviewSurface
          artboardTestId="compose-preview-page-artboard"
          assetResolver={assetResolver}
          layoutRuntime={layoutRuntime}
          layoutSnapshot={layoutSnapshot}
          pageLoader={pageLoader}
          registry={registry}
          scriptModuleLoader={scriptModuleLoader}
          scriptScope={scriptScope}
          value={surface}
          artboardOverlay={(
            <span
              aria-label={messages.screenMapping}
              className="compose-preview-page__size-pill"
              data-testid="compose-preview-page-size-pill"
              data-visible={barVisible ? 'true' : undefined}
            >
              {`${surface.screenSize.width} × ${surface.screenSize.height}`}
              {surface.screenIsDefault ? ` · ${messages.actualScreen}` : ''}
              {' · 1:1'}
            </span>
          )}
        />
      </div>
      <div
        aria-label={messages.toolbar}
        className="compose-preview-page__bar"
        data-testid="compose-preview-page-bar"
        data-visible={barVisible || focusInBar ? 'true' : undefined}
        role="toolbar"
        onFocus={() => {
          setFocusInBar(true)
          setBarVisible(true)
          if (hideTimer.current !== null) clearTimeout(hideTimer.current)
        }}
        onBlur={(event) => {
          if (event.currentTarget.contains(event.relatedTarget as Node | null)) return
          setFocusInBar(false)
          restartHideTimer()
        }}
      >
        {/* 零 chrome 意味着没有出口，所以控制条呼出时第一个位置留给返回。 */}
        <button
          className="compose-preview-page__exit"
          data-testid="compose-preview-page-exit"
          type="button"
          onClick={onRequestExit}
        >
          <ExitIcon />
          {messages.exit}
        </button>
        <span aria-hidden="true" className="compose-preview-page__rule" />
        <label>
          <span className="compose-preview-page__sr-only">{messages.target}</span>
          <select
            data-testid="compose-preview-page-scene"
            value={surface.frameId ?? ''}
            onChange={(event) => surface.selectScene(event.target.value)}
          >
            {surface.scenes.map((scene) => (
              <option key={scene.id} value={scene.id}>{scene.name}</option>
            ))}
          </select>
        </label>
        <span aria-hidden="true" className="compose-preview-page__rule" />
        <label>
          <span className="compose-preview-page__sr-only">{messages.screenSize}</span>
          <select
            data-testid="compose-preview-page-screen-size"
            value={knownScreenValues.has(currentScreenValue) ? currentScreenValue : ''}
            onChange={(event) => {
              const option = screenOptions.presets.find((item) => item.value === event.target.value)
              // 空值项就是「实际屏幕」那一档：回到默认，屏幕重新跟着视口走。
              if (!option) {
                surface.resetScreen()
                return
              }
              surface.setScreenSize(option.size)
              surface.requestFit()
            }}
          >
            <option value="">
              {surface.screenIsDefault
                ? `${surface.screenSize.width} × ${surface.screenSize.height} · ${messages.actualScreen}`
                : messages.actualScreen}
            </option>
            <optgroup label={messages.commonScreensGroup}>
              {screenOptions.presets.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </optgroup>
          </select>
        </label>
        {targetKind === 'scene' ? (
          <button
            aria-label={messages.swapOrientation}
            data-testid="compose-preview-page-swap"
            type="button"
            onClick={() => {
              surface.setScreenSize(swapScreenSize(surface.screenSize))
              surface.requestFit()
            }}
          >
            <SwapIcon />
          </button>
        ) : null}
        <button
          aria-label={fullscreen ? messages.exitFullscreen : messages.enterFullscreen}
          data-testid="compose-preview-page-fullscreen"
          type="button"
          onClick={toggleFullscreen}
        >
          <FullscreenIcon />
        </button>
      </div>
    </div>
  )
}
