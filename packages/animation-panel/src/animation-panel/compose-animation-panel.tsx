import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import type {
  CSSProperties,
  Dispatch,
  KeyboardEvent,
  MouseEvent as ReactMouseEvent,
  PointerEvent,
  RefObject,
  SetStateAction,
} from 'react'
import {
  createComposeThemeStyle,
  useComposeI18nContext,
  useComposeThemeContext,
} from '@compose-ui/ui-context'
import { useAnimationPanelSession } from './animation-panel-context'
import {
  clampComposeAnimationPixelsPerMs,
  getComposeAnimationClips,
  panComposeAnimationTimeline,
  zoomComposeAnimationTimelineAt,
} from './animation-panel-model'
import { AnimationPanelProvider } from './animation-panel-provider'
import { ComposeButton, ComposeColorPicker, useComposeContextMenu } from '@compose-ui/components'
import { CommittedInput } from './committed-input'
import { ComposeEasingCurveEditor } from '../easing-editor'
import { TimelineActionsMenu } from './timeline-actions-menu'
import type { TimelineMenuTarget } from './timeline-actions-menu'
import {
  ChevronIcon,
  CurveIcon,
  DiamondIcon,
  EyeIcon,
  LockIcon,
  LoopIcon,
  ObjectMarkIcon,
  PauseIcon,
  PingPongIcon,
  PlayIcon,
  PlayOnceIcon,
  SoloIcon,
} from './animation-icons'
import type {
  ComposeAnimationInspectorProps,
  ComposeAnimationInterpolation,
  ComposeAnimationKeyframeValue,
  ComposeAnimationPlaybackMode,
  ComposeAnimationPanelProviderProps,
  ComposeAnimationPropertyTrack,
  ComposeAnimationTimelineProps,
} from './types'

const messages = {
  'zh-CN': {
    timeline: '动画编辑器',
    emptyTimeline: '当前没有动画数据',
    inspector: '关键帧属性',
    play: '播放动画',
    pause: '暂停动画',
    addKeyframe: '添加关键帧',
    playbackMode: '播放模式',
    playOnce: '播放一次',
    loop: '循环',
    pingPong: '往返',
    animationClip: (label: string, startMs: number, endMs: number) => `动画片段 ${label}：${startMs} ms 至 ${endMs} ms`,
    clipMove: '使用左右方向键移动动画片段，每次 10 毫秒',
    clipStart: (label: string) => `调整动画片段 ${label} 的起始时间`,
    clipEnd: (label: string) => `调整动画片段 ${label} 的结束时间`,
    currentTime: '当前时间',
    duration: '尾帧时长',
    trackList: '动画轨道',
    toolbar: '时间线操作栏',
    trackToggle: (name: string) => `展开或收起 ${name} 轨道`,
    selectTrack: (name: string) => `选择对象轨道 ${name}`,
    selectProperty: (name: string) => `选择属性轨道 ${name}`,
    selectPropertyLane: (name: string) => `选择 ${name} 关键帧轨道`,
    lockTrack: (name: string) => `锁定 ${name}`,
    soloTrack: (name: string) => `单独显示 ${name}`,
    hideTrack: (name: string) => `隐藏 ${name}`,
    noTracks: '还没有轨道，选中组件打下第一个关键帧',
    menuRemoveTrack: '删除轨道',
    menuRemoveTrackGroup: '删除该对象的全部动画',
    menuAddKeyframeAtPlayhead: '在播放头处打点',
    menuAddKeyframeAtPointer: '在光标所在时间打点',
    menuRemoveKeyframe: '删除本帧',
    menuPreviousKeyframe: '跳到上一个关键帧',
    menuNextKeyframe: '跳到下一个关键帧',
    propertyKeyframe: (name: string) => `${name} 关键帧标记`,
    propertyField: '属性',
    interpolationRange: '曲线区间',
    keyframe: (timeMs: number, label: string) => `关键帧 ${timeMs} ms：${label}`,
    interpolationSegment: (startMs: number, endMs: number, label: string) => `编辑 ${startMs} ms 至 ${endMs} ms 的${label}动画曲线`,
    keyframeMove: '使用左右方向键每次移动 10 毫秒，也可以水平拖动',
    keyframeHeading: '关键帧',
    noSelection: '未选中关键帧',
    time: '时间',
    value: '值',
    lastKeyframeNote: '末帧的出向段没有下一帧，暂不参与求值',
    duplicateTime: '该属性轨道已存在同一时间的关键帧',
  },
  'en-US': {
    timeline: 'Animation editor',
    emptyTimeline: 'No animation data yet',
    inspector: 'Keyframe properties',
    play: 'Play animation',
    pause: 'Pause animation',
    addKeyframe: 'Add keyframe',
    playbackMode: 'Playback mode',
    playOnce: 'Play once',
    loop: 'Loop',
    pingPong: 'PingPong',
    animationClip: (label: string, startMs: number, endMs: number) => `Animation clip ${label}: ${startMs} ms to ${endMs} ms`,
    clipMove: 'Use the left and right arrow keys to move the animation clip by 10 milliseconds',
    clipStart: (label: string) => `Adjust the start time of animation clip ${label}`,
    clipEnd: (label: string) => `Adjust the end time of animation clip ${label}`,
    currentTime: 'Current time',
    duration: 'End frame duration',
    trackList: 'Animation tracks',
    toolbar: 'Timeline toolbar',
    trackToggle: (name: string) => `Expand or collapse ${name} track`,
    selectTrack: (name: string) => `Select object track ${name}`,
    selectProperty: (name: string) => `Select property track ${name}`,
    selectPropertyLane: (name: string) => `Select ${name} keyframe lane`,
    lockTrack: (name: string) => `Lock ${name}`,
    soloTrack: (name: string) => `Solo ${name}`,
    hideTrack: (name: string) => `Hide ${name}`,
    noTracks: 'No tracks yet — select an element and set its first keyframe',
    menuRemoveTrack: 'Delete track',
    menuRemoveTrackGroup: 'Delete all animation on this object',
    menuAddKeyframeAtPlayhead: 'Add keyframe at playhead',
    menuAddKeyframeAtPointer: 'Add keyframe at pointer time',
    menuRemoveKeyframe: 'Delete this keyframe',
    menuPreviousKeyframe: 'Go to previous keyframe',
    menuNextKeyframe: 'Go to next keyframe',
    propertyKeyframe: (name: string) => `${name} keyframe marker`,
    propertyField: 'Property',
    interpolationRange: 'Curve range',
    keyframe: (timeMs: number, label: string) => `Keyframe ${timeMs} ms: ${label}`,
    interpolationSegment: (startMs: number, endMs: number, label: string) => `Edit ${label} animation curve from ${startMs} ms to ${endMs} ms`,
    keyframeMove: 'Use the left and right arrow keys to move by 10 milliseconds, or drag horizontally',
    keyframeHeading: 'Keyframe',
    noSelection: 'No keyframe selected',
    time: 'Time',
    value: 'Value',
    lastKeyframeNote: 'The last keyframe has no following keyframe, so its outgoing segment is not sampled',
    duplicateTime: 'A keyframe already exists at this time on the property track',
  },
} as const

type Locale = keyof typeof messages

/**
 * 左侧列表主名称：优先 groupLabel（Rive 式 Position / Rotation）。
 *
 * @remarks
 * 名称一律来自会话数据。包内不再按 ID 匹配任何内置文案——那种映射会在宿主标识与演示数据
 * 撞车时把用户自己的名称悄悄替换掉。
 */
function propertyListLabel(property: ComposeAnimationPropertyTrack) {
  return property.groupLabel ?? property.label
}

/** 把任意关键帧值格式化为左栏展示文本。 */
function formatKeyframeValue(value: ComposeAnimationKeyframeValue): string {
  if (typeof value === 'string') return value
  if (typeof value === 'number') return String(Math.round(value * 100) / 100)
  return `${Math.round(value.x * 10) / 10}, ${Math.round(value.y * 10) / 10}`
}

/** 右侧展示值：显式 displayValue，否则取播放头附近关键帧 value。 */
function propertyReadoutValue(property: ComposeAnimationPropertyTrack, currentTimeMs: number) {
  if (property.displayValue) return property.displayValue
  if (property.keyframes.length === 0) return '—'
  const sorted = [...property.keyframes].sort((left, right) => left.timeMs - right.timeMs)
  let nearest = sorted[0]!
  for (const frame of sorted) {
    if (frame.timeMs <= currentTimeMs) nearest = frame
    else break
  }
  return formatKeyframeValue(nearest.value)
}

function timelineRatio(timeMs: number, durationMs: number) {
  return durationMs <= 0 ? 0 : Math.min(1, Math.max(0, timeMs / durationMs))
}

// 左右 gutter：刻度与片段不贴边；标尺底边用 CSS 铺满不断线。
// 时间轴可视宽度 = 板面滚动容器宽度 − 左轨列宽 − 两侧 gutter。
const SCALE_GUTTER_PX = 10
const SCALE_HORIZONTAL_MARGIN_PX = SCALE_GUTTER_PX * 2
/** 左轨标签列宽，与样式 `--ap-tracks-width` 一致；属性行与关键帧轨同行对齐。 */
const TRACKS_COLUMN_WIDTH_PX = 280
// 主刻度步长的候选值，1-2-5 十进制级数（时间轴的通用惯例），供按可读间距反推步长时查表。
const TIME_MARKER_STEPS_MS = [10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10_000, 20_000, 50_000, 100_000]
const PLAYBACK_MODES = ['play-once', 'loop', 'ping-pong'] as const
// 相邻主刻度标签之间至少需要的像素间距，避免数字重叠。
const MIN_MARKER_SPACING_PX = 56

function createTimeMarkers(durationMs: number, pixelsPerMs: number) {
  const safeDurationMs = Math.max(0, Math.round(Number.isFinite(durationMs) ? durationMs : 0))
  // 缩放级别已知时，按当前像素密度反推需要多粗的步长才能保持标签可读间距——放大后
  // 同样的间距能塞进更细的时间步长，标尺因此自然变密。挂载瞬间/未测出可视宽度时
  // （pixelsPerMs <= 0）退回旧启发式：把总时长切成约 8 段。
  const minStepMs = pixelsPerMs > 0 ? MIN_MARKER_SPACING_PX / pixelsPerMs : safeDurationMs / 8
  const stepMs = TIME_MARKER_STEPS_MS.find((step) => step >= minStepMs)
    ?? TIME_MARKER_STEPS_MS[TIME_MARKER_STEPS_MS.length - 1]!
  const markers: number[] = []
  for (let timeMs = 0; timeMs < safeDurationMs; timeMs += stepMs) markers.push(timeMs)
  if (markers[markers.length - 1] !== safeDurationMs) markers.push(safeDurationMs)
  return { markers, stepMs }
}

function playbackModeLabel(mode: ComposeAnimationPlaybackMode, locale: Locale) {
  const t = messages[locale]
  if (mode === 'loop') return t.loop
  if (mode === 'ping-pong') return t.pingPong
  return t.playOnce
}

/**
 * 为分置的时间线和属性面板提供同一动画会话。
 *
 * @remarks
 * Provider 不读取或修改 ComposeDocument；默认演示数据和所有交互均属于当前 React 会话。
 * @public
 */
export function ComposeAnimationPanelProvider(props: ComposeAnimationPanelProviderProps) {
  return <AnimationPanelProvider {...props} />
}

/** 渲染可置于编辑器底部的时间线。 @public */
export function ComposeAnimationTimeline({
  className,
  empty,
  emptyState,
  style,
  ...htmlProps
}: ComposeAnimationTimelineProps) {
  const i18n = useComposeI18nContext()
  const theme = useComposeThemeContext()
  const {
    value,
    notice,
    addKeyframe,
    addKeyframeAtTime,
    moveKeyframe,
    removeKeyframe,
    removeTrack,
    removeTrackGroup,
    seekAdjacentKeyframe,
    selectClip,
    selectKeyframe,
    selectProperty,
    selectTrack,
    selectInterpolationSegment,
    setCurrentTime,
    setDuration,
    setPlaybackMode,
    setPlaying,
    toggleTrack,
    updateClipRange,
  } = useAnimationPanelSession()
  const actionsMenu = useComposeContextMenu<TimelineMenuTarget>()
  /**
   * 在行的命中按钮上用键盘打开更多操作菜单。
   *
   * 不能指望浏览器把 Shift+F10 翻译成 `contextmenu`：实测 Chromium 只对独立的
   * ContextMenu 键这么做，而 Mac 键盘上根本没有那个键。行上又没有任何可见的菜单入口，
   * 不自己接管这两个键，macOS 用户就完全没有键盘路径。
   * 锚点按按钮矩形算：键盘触发的事件没有有意义的 clientX/clientY。
   */
  const openRowMenuWithKeyboard = (
    event: KeyboardEvent<HTMLButtonElement>,
    target: TimelineMenuTarget,
  ) => {
    if (event.key !== 'ContextMenu' && !(event.key === 'F10' && event.shiftKey)) return
    event.preventDefault()
    const rect = event.currentTarget.getBoundingClientRect()
    actionsMenu.openAt(
      { clientX: rect.left + 16, clientY: rect.bottom, currentTarget: event.currentTarget },
      target,
    )
  }
  const locale = i18n?.locale ?? 'zh-CN'
  const t = messages[locale]
  const classNames = ['compose-animation-panel', 'compose-animation-timeline', className]
    .filter(Boolean)
    .join(' ')
  const currentRatio = timelineRatio(value.currentTimeMs, value.model.durationMs)
  const boardScrollRef = useRef<HTMLDivElement>(null)
  const scaleScrollRef = useRef<HTMLDivElement>(null)
  const scaleRef = useRef<HTMLDivElement>(null)
  const rulerScrollRef = useRef<HTMLDivElement>(null)
  // 缩放会改变 `.scale` 的行内宽度，必须等这次渲染真正提交到 DOM 后再写 scrollLeft，
  // 否则浏览器会按旧宽度把请求的滚动位置钳掉。
  const pendingScrollLeftRef = useRef<number | null>(null)
  // 原生 wheel 监听用 ref 读最新缩放状态，避免 effect 反复解绑
  const zoomSessionRef = useRef({
    durationMs: 0,
    effectiveContainerWidthPx: 0,
    effectivePixelsPerMs: 0,
  })
  const [containerWidthPx, setContainerWidthPx] = useState(0)
  // null 表示用户还没有主动缩放过：此时按可视宽度铺满显示，和缩放能力上线前的行为完全一致。
  const [pixelsPerMs, setPixelsPerMs] = useState<number | null>(null)
  // 记录"上一次钳制时用的可视宽度/时长"，用来判断本次渲染是否需要重新钳制（回弹）。
  const [clampedForWidthPx, setClampedForWidthPx] = useState(0)
  const [clampedForDurationMs, setClampedForDurationMs] = useState(value.model.durationMs)
  // 左轨 Rive 式操作：仅会话 UI，不写入动画模型
  const [lockedTrackIds, setLockedTrackIds] = useState<ReadonlySet<string>>(() => new Set())
  const [soloTrackIds, setSoloTrackIds] = useState<ReadonlySet<string>>(() => new Set())
  const [hiddenTrackIds, setHiddenTrackIds] = useState<ReadonlySet<string>>(() => new Set())
  // 头部标尺行现在挂在 board-scroll 外面，不再随它一起被纵向滚动条挤窄；
  // 需要用这个量单独把 board-scroll 出现纵向滚动条时让出的宽度补回 ruler-viewport，
  // 否则标尺刻度会比下方轨道内容宽出一条滚动条的宽度，缩放/平移久了刻度就跟片段错位。
  const [scrollbarGutterPx, setScrollbarGutterPx] = useState(0)
  const effectiveContainerWidthPx = Math.max(0, containerWidthPx - SCALE_HORIZONTAL_MARGIN_PX)

  const toggleTrackFlag = (
    trackId: string,
    setFlags: Dispatch<SetStateAction<ReadonlySet<string>>>,
  ) => {
    setFlags((current) => {
      const next = new Set(current)
      if (next.has(trackId)) next.delete(trackId)
      else next.add(trackId)
      return next
    })
  }

  // 容器宽度或时长变化后，把已经设置过的缩放级别重新钳制（回弹），而不是重置成铺满宽度；
  // 还没缩放过（pixelsPerMs 为 null）时不需要处理，下面的 effectivePixelsPerMs 会自动跟着派生。
  // 用渲染期条件性 setState 而不是 effect：本仓库的 react-hooks/set-state-in-effect 规则把
  // effect 里的 setState 判定为 error，这是 React 官方文档给出的等价替代写法。
  if (
    pixelsPerMs !== null
    && effectiveContainerWidthPx > 0
    && (clampedForWidthPx !== effectiveContainerWidthPx || clampedForDurationMs !== value.model.durationMs)
  ) {
    const clamped = clampComposeAnimationPixelsPerMs(pixelsPerMs, effectiveContainerWidthPx, value.model.durationMs)
    setClampedForWidthPx(effectiveContainerWidthPx)
    setClampedForDurationMs(value.model.durationMs)
    if (clamped !== pixelsPerMs) setPixelsPerMs(clamped)
  }

  const effectivePixelsPerMs = pixelsPerMs ?? (
    effectiveContainerWidthPx > 0 && value.model.durationMs > 0
      ? effectiveContainerWidthPx / value.model.durationMs
      : 0
  )
  const scaleWidthPx = Math.max(0, value.model.durationMs * effectivePixelsPerMs)
  const { markers: timeMarkers, stepMs: timeMarkerStepMs } = createTimeMarkers(value.model.durationMs, effectivePixelsPerMs)

  // wheel 监听器是原生事件、只在挂载时订阅一次，靠这个 ref 在每次渲染后同步最新值，
  // 避免闭包捕获到缩放/平移时的旧 durationMs、宽度或像素比例。
  useEffect(() => {
    zoomSessionRef.current = {
      durationMs: value.model.durationMs,
      effectiveContainerWidthPx,
      effectivePixelsPerMs,
    }
  })

  // 空会话分支不渲染时间轴：从空态切到首条轨道时两个测量 effect 必须重挂，
  // 否则挂载时 ref 为 null、观察器永远没附着，标尺宽度停在 0。
  // 受控 `empty` 优先：宿主把空态定义为会话之外的事实（例如页面没有绑定动画）时，
  // 零轨道会话也要显示正常时间线。
  const timelineEmpty = empty ?? value.model.tracks.length === 0

  useEffect(() => {
    const element = scaleScrollRef.current
    if (!element) return
    // 右列时间轴容器宽度（不含左轨）；缩放钳制与铺满宽度都基于此。
    // 用 getBoundingClientRect：jsdom 下 clientWidth 常为 0，测试通过 stub rect 注入宽度。
    const measure = () => setContainerWidthPx(element.getBoundingClientRect().width)
    measure()
    // jsdom 等无布局环境没有 ResizeObserver：退化为只测一次挂载时的宽度，
    // 和 packages/stage 里 compose-stage.tsx 对 surfaceRef 的处理方式一致。
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [timelineEmpty])

  useLayoutEffect(() => {
    if (pendingScrollLeftRef.current === null) return
    if (scaleScrollRef.current) scaleScrollRef.current.scrollLeft = pendingScrollLeftRef.current
    if (rulerScrollRef.current) rulerScrollRef.current.scrollLeft = pendingScrollLeftRef.current
    pendingScrollLeftRef.current = null
  }, [scaleWidthPx])

  // 纵向滚动条时有时无（内容够高才出现）会让 board-scroll 的可用宽度跟着变，
  // 但标尺头部行不在 board-scroll 里面、感受不到这个收窄——用实际测得的宽度差
  // （offsetWidth - clientWidth）动态补一条 padding，让标尺和下方轨道内容宽度始终一致。
  useEffect(() => {
    const board = boardScrollRef.current
    if (!board) return
    const measure = () => setScrollbarGutterPx(board.offsetWidth - board.clientWidth)
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(board)
    return () => observer.disconnect()
  }, [timelineEmpty])

  /*
   * 标尺头部行已经搬到 board-scroll 外面（见下方 JSX 的 header-row），不再需要
   * position:sticky 或每帧 transform 去抵消纵向滚动——它本来就不在滚动区域里，
   * 纵向滚动条再怎么滚也不会带着它一起动，这是先前 transform 方案会有肉眼可见
   * 抖动（JS scroll 回调总是比原生滚动的合成线程晚一帧）的根本解法。
   * 唯一还要处理的是横向：标尺必须跟 .scale-scroll 的横向滚动位置保持一致。
   * 缩放钳制（上面的 useLayoutEffect）和滚轮平移（下面 wheel 里）已经在各自
   * 落笔的同一刻同步写了 rulerScrollRef，这里的 scroll 监听只兜底用户直接拖拽
   * .scale-scroll 原生横向滚动条这一条路径。
   */
  useEffect(() => {
    const scaleScroll = scaleScrollRef.current
    const rulerScroll = rulerScrollRef.current
    if (!scaleScroll || !rulerScroll) return
    const onScroll = () => {
      rulerScroll.scrollLeft = scaleScroll.scrollLeft
    }
    scaleScroll.addEventListener('scroll', onScroll, { passive: true })
    return () => scaleScroll.removeEventListener('scroll', onScroll)
  }, [])

  const applyZoom = (clientX: number, factor: number) => {
    const scrollElement = scaleScrollRef.current
    const scaleBounds = scaleRef.current?.getBoundingClientRect()
    const scrollBounds = scrollElement?.getBoundingClientRect()
    const session = zoomSessionRef.current
    if (!scrollElement || !scaleBounds || !scrollBounds || session.effectivePixelsPerMs <= 0) return
    const anchorTimeMs = Math.min(
      session.durationMs,
      Math.max(0, (clientX - scaleBounds.left) / session.effectivePixelsPerMs),
    )
    const anchorOffsetPx = clientX - scrollBounds.left
    const result = zoomComposeAnimationTimelineAt(
      session.effectivePixelsPerMs,
      factor,
      anchorTimeMs,
      anchorOffsetPx,
      session.effectiveContainerWidthPx,
      session.durationMs,
    )
    pendingScrollLeftRef.current = result.scrollLeft
    setPixelsPerMs(result.pixelsPerMs)
  }

  /*
   * 必须用非 passive 的原生 wheel：
   * - React onWheel 在多数环境下是 passive，preventDefault 无效
   * - Ctrl/Cmd+滚轮（触控板捏合）若不拦截，会带动 board-scroll 纵向滚动，与缩放冲突
   */
  useEffect(() => {
    const board = boardScrollRef.current
    const scaleScroll = scaleScrollRef.current
    if (!board || !scaleScroll) return

    const onWheel = (event: globalThis.WheelEvent) => {
      const overScale = scaleScroll.contains(event.target as Node)
      if (event.ctrlKey || event.metaKey) {
        // 拦截浏览器缩放与纵向滚动；在时间轴上再做时间缩放
        event.preventDefault()
        event.stopPropagation()
        if (!overScale) return
        applyZoom(event.clientX, Math.exp(-event.deltaY * 0.002))
        return
      }
      if (!overScale) return
      // 时间轴横向平移：触控板横向，或 Shift+纵向滚轮
      const horizontal = event.shiftKey || Math.abs(event.deltaX) > Math.abs(event.deltaY)
      if (!horizontal) return
      event.preventDefault()
      event.stopPropagation()
      const session = zoomSessionRef.current
      scaleScroll.scrollLeft = panComposeAnimationTimeline(
        scaleScroll.scrollLeft,
        event.deltaX !== 0 ? event.deltaX : event.deltaY,
        session.effectiveContainerWidthPx,
        session.durationMs,
        session.effectivePixelsPerMs,
      )
      // 同一刻同步写标尺的横向滚动位置：不等 scroll 事件回调，平移时刻度和下方
      // 片段/关键帧的横坐标才不会有哪怕一帧的滞后。
      if (rulerScrollRef.current) rulerScrollRef.current.scrollLeft = scaleScroll.scrollLeft
    }

    // capture 阶段先于默认滚动，才能拦住 board-scroll 的纵向滚动
    board.addEventListener('wheel', onWheel, { passive: false, capture: true })
    return () => board.removeEventListener('wheel', onWheel, { capture: true })
  }, [])
  const handlePlayheadKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowLeft') {
      event.preventDefault()
      setCurrentTime(value.currentTimeMs - 10)
    }
    else if (event.key === 'ArrowRight') {
      event.preventDefault()
      setCurrentTime(value.currentTimeMs + 10)
    }
    else if (event.key === 'Home') {
      event.preventDefault()
      setCurrentTime(0)
    }
    else if (event.key === 'End') {
      event.preventDefault()
      setCurrentTime(value.model.durationMs)
    }
  }

  // 空会话只渲染宿主引导（或中性提示），不渲染播放控件、标尺或占位轨道——
  // 那些交互对着不存在的数据只能产生困惑。
  if (timelineEmpty) {
    return (
      <section
        {...htmlProps}
        aria-label={htmlProps['aria-label'] ?? t.timeline}
        className={classNames}
        data-compose-theme={theme?.resolvedTheme}
        data-compose-ui="animation-timeline"
        lang={locale}
        role={htmlProps.role ?? 'region'}
        style={{ ...(theme ? createComposeThemeStyle(theme.tokens) : {}), ...style } as CSSProperties}
      >
        <div className="compose-animation-timeline__empty">
          {emptyState ?? <p>{t.emptyTimeline}</p>}
        </div>
      </section>
    )
  }

  return (
    <section
      {...htmlProps}
      aria-label={htmlProps['aria-label'] ?? t.timeline}
      className={classNames}
      data-compose-theme={theme?.resolvedTheme}
      data-compose-ui="animation-timeline"
      lang={locale}
      role={htmlProps.role ?? 'region'}
      style={{
        ...(theme ? createComposeThemeStyle(theme.tokens) : {}),
        ...style,
        // 与左轨列宽常量同步，供样式使用
        ['--ap-tracks-width' as string]: `${TRACKS_COLUMN_WIDTH_PX}px`,
      } as CSSProperties}
    >
      {/*
        头部行独立于纵向滚动区域之外：左工具栏 + 右标尺都不随 board-scroll 滚动，
        不需要 position:sticky 或每帧 JS 校正位置，天然没有任何抖动。
        右侧标尺横向仍需跟 .scale-scroll 同步，见上面的 ref 同步 effect。
      */}
      <div className="compose-animation-timeline__header-row">
        {/* 工具栏只在左轨角格：播放 / 关键帧 / 当前时间·时长 / 播放模式图标。
            缩放走 Ctrl/Cmd+滚轮；自动记录不在工具栏暴露。
            group 只表达"一组相关控件"；数字输入无法做 toolbar 方向键漫游。 */}
        <div
          aria-label={t.toolbar}
          className="compose-animation-timeline__tracks-header"
          data-timeline-header="true"
          role="group"
        >
          <ComposeButton
              aria-label={value.isPlaying ? t.pause : t.play}
              className="compose-animation-timeline__icon-button"
              size="icon-xs"
              variant="ghost"
              onClick={() => setPlaying(!value.isPlaying)}
            >
              {value.isPlaying ? <PauseIcon /> : <PlayIcon />}
            </ComposeButton>
            <ComposeButton
              aria-label={t.addKeyframe}
              className="compose-animation-timeline__icon-button"
              size="icon-xs"
              variant="ghost"
              onClick={addKeyframe}
            ><DiamondIcon /></ComposeButton>
            <div className="compose-animation-timeline__time-fields">
              {/* 隐式 role 是 status：播放时每帧都会变化，必须显式关掉播报，否则读屏会被刷屏。 */}
              <output aria-label={t.currentTime} aria-live="off" className="compose-animation-timeline__time-readout">
                {value.currentTimeMs}
              </output>
              <label className="compose-animation-timeline__duration-control">
                <CommittedInput
                  aria-label={t.duration}
                  inputMode="numeric"
                  key={value.model.durationMs}
                  min={10}
                  step={10}
                  type="number"
                  value={String(value.model.durationMs)}
                  onCommit={(draft) => {
                    const durationMs = Number.parseInt(draft, 10)
                    if (!Number.isFinite(durationMs)) return false
                    setDuration(durationMs)
                    return true
                  }}
                />
              </label>
              <small className="compose-animation-timeline__time-unit">ms</small>
            </div>
            <div
              aria-label={t.playbackMode}
              className="compose-animation-timeline__playback-modes"
              role="radiogroup"
            >
              {PLAYBACK_MODES.map((mode) => {
                const selected = value.playbackMode === mode
                const label = playbackModeLabel(mode, locale)
                return (
                  <ComposeButton
                    aria-checked={selected}
                    aria-label={label}
                    className="compose-animation-timeline__icon-button compose-animation-timeline__playback-mode-button"
                    data-selected={selected || undefined}
                    key={mode}
                    role="radio"
                    size="icon-xs"
                    variant="ghost"
                    onClick={() => setPlaybackMode(mode)}
                  >
                    {mode === 'play-once' ? <PlayOnceIcon /> : null}
                    {mode === 'loop' ? <LoopIcon /> : null}
                    {mode === 'ping-pong' ? <PingPongIcon /> : null}
                  </ComposeButton>
                )
              })}
            </div>
        </div>
        <div className="compose-animation-timeline__ruler-viewport" ref={rulerScrollRef} style={{ paddingRight: scrollbarGutterPx } as CSSProperties}>
          <div
            className="compose-animation-timeline__ruler"
            style={{
              '--animation-playhead': `${currentRatio * 100}%`,
              '--ruler-minor-step': `${timelineRatio(timeMarkerStepMs / 5, value.model.durationMs) * 100}%`,
              width: `${scaleWidthPx}px`,
            } as CSSProperties}
          >
            {/* 刻度纯装饰：可读的当前时间由下面的 seek input 承担，这里整体 aria-hidden，
                但不能挂在 .ruler 本身——input 和播放头也在它底下，会被一起吞掉。 */}
            {timeMarkers.map((marker) => (
              <span aria-hidden="true" key={marker} style={{ left: `${timelineRatio(marker, value.model.durationMs) * 100}%` }}>
                <b>{marker}</b><i />
              </span>
            ))}
            <input
              aria-label={t.currentTime}
              className="compose-animation-timeline__playhead-input compose-animation-timeline__playhead-input--ruler"
              max={value.model.durationMs}
              min={0}
              // 拖动播放头吸附到标尺次刻度（主刻度步长的 1/5，与 --ruler-minor-step、
              // getTimeAtClientX 同源），而不是固定 10ms——原生 range input 的 step 只影响
              // 拖拽/点击跳转，键盘方向键已经在 handlePlayheadKeyDown 里 preventDefault
              // 接管，不受这里影响。
              step={timeMarkerStepMs > 0 ? timeMarkerStepMs / 5 : 10}
              type="range"
              value={value.currentTimeMs}
              onChange={(event) => setCurrentTime(Number(event.target.value))}
              onKeyDown={handlePlayheadKeyDown}
            />
            <div aria-hidden="true" className="compose-animation-timeline__playhead"><span /><i /></div>
          </div>
        </div>
      </div>
      {/* 外层纵向滚动：左标签列与右关键帧列同高同行，共用一个纵向滚动条 */}
      <div className="compose-animation-timeline__board-scroll" ref={boardScrollRef}>
      <div className="compose-animation-timeline__content">
        <div className="compose-animation-timeline__tracks">
          <div aria-label={t.trackList} className="compose-animation-timeline__track-list" role="list">
          {/* 只有宿主用受控 empty=false 压住空态时才可能出现零轨道的正常时间线。 */}
          {value.model.tracks.length === 0 && (
            <p className="compose-animation-timeline__no-tracks">{t.noTracks}</p>
          )}
          {value.model.tracks.map((track) => {
            const trackLabel = track.label
            const trackSelected = value.selectedTrackId === track.id
            const propertyInTrackSelected = track.properties.some((property) => property.id === value.selectedPropertyId)
            // 选中物体 / 其片段 / 其任一属性时，整组（含属性）共用浅底
            const groupActive = trackSelected || propertyInTrackSelected
            const locked = lockedTrackIds.has(track.id)
            const solo = soloTrackIds.has(track.id)
            const hidden = hiddenTrackIds.has(track.id)
            return (
              <div
                className="compose-animation-timeline__track-group"
                data-group-active={groupActive || undefined}
                key={track.id}
                role="listitem"
              >
                <div
                  className="compose-animation-timeline__track-row"
                  data-hidden={hidden || undefined}
                  data-locked={locked || undefined}
                  data-menu-open={
                    actionsMenu.open && actionsMenu.payload?.kind === 'track'
                    && actionsMenu.payload.trackId === track.id ? 'true' : undefined
                  }
                  data-object-row={track.id}
                  data-selected={trackSelected || undefined}
                  data-solo={solo || undefined}
                  onContextMenu={(event) => {
                    actionsMenu.openAt(event, {
                      kind: 'track',
                      trackId: track.id,
                      label: trackLabel,
                    })
                  }}
                >
                  <button
                    aria-current={trackSelected || undefined}
                    aria-label={t.selectTrack(trackLabel)}
                    className="compose-animation-timeline__row-hit"
                    data-object-row={track.id}
                    type="button"
                    onClick={() => selectTrack(track.id)}
                    onKeyDown={(event) => {
                      openRowMenuWithKeyboard(event, {
                        kind: 'track',
                        trackId: track.id,
                        label: trackLabel,
                      })
                    }}
                  />
                  <span aria-hidden="true" className="compose-animation-timeline__object-mark">
                    <ObjectMarkIcon />
                  </span>
                  <button
                    aria-expanded={track.expanded}
                    aria-label={t.trackToggle(trackLabel)}
                    className="compose-animation-timeline__track-toggle"
                    type="button"
                    onClick={() => toggleTrack(track.id)}
                  ><ChevronIcon /></button>
                  <span className="compose-animation-timeline__track-label">{trackLabel}</span>
                  <div className="compose-animation-timeline__track-actions">
                    <ComposeButton
                      aria-label={t.lockTrack(trackLabel)}
                      aria-pressed={locked}
                      className="compose-animation-timeline__track-action"
                      size="icon-xs"
                      variant="ghost"
                      onClick={(event) => {
                        event.stopPropagation()
                        toggleTrackFlag(track.id, setLockedTrackIds)
                      }}
                    ><LockIcon /></ComposeButton>
                    <ComposeButton
                      aria-label={t.soloTrack(trackLabel)}
                      aria-pressed={solo}
                      className="compose-animation-timeline__track-action"
                      size="icon-xs"
                      variant="ghost"
                      onClick={(event) => {
                        event.stopPropagation()
                        toggleTrackFlag(track.id, setSoloTrackIds)
                      }}
                    ><SoloIcon /></ComposeButton>
                    <ComposeButton
                      aria-label={t.hideTrack(trackLabel)}
                      aria-pressed={hidden}
                      className="compose-animation-timeline__track-action"
                      size="icon-xs"
                      variant="ghost"
                      onClick={(event) => {
                        event.stopPropagation()
                        toggleTrackFlag(track.id, setHiddenTrackIds)
                      }}
                    ><EyeIcon /></ComposeButton>
                  </div>
                </div>
                {track.expanded ? track.properties.map((property, propertyIndex) => {
                  const propertyLabel = property.label
                  const listLabel = propertyListLabel(property)
                  const propertySelected = value.selectedPropertyId === property.id
                  const readout = propertyReadoutValue(property, value.currentTimeMs)
                  const isLast = propertyIndex === track.properties.length - 1
                  const isColorValue = property.valueKind === 'color'
                  return (
                    <div
                      className="compose-animation-timeline__property-row"
                      data-selected={propertySelected || undefined}
                      data-tree={isLast ? 'last' : 'branch'}
                      key={property.id}
                      onContextMenu={(event) => {
                        actionsMenu.openAt(event, {
                          kind: 'property',
                          propertyId: property.id,
                          label: propertyLabel,
                        })
                      }}
                    >
                      <button
                        aria-current={propertySelected || undefined}
                        aria-label={t.selectProperty(propertyLabel)}
                        className="compose-animation-timeline__row-hit"
                        data-property-row={property.id}
                        type="button"
                        onClick={() => selectProperty(property.id)}
                        onKeyDown={(event) => {
                          openRowMenuWithKeyboard(event, {
                            kind: 'property',
                            propertyId: property.id,
                            label: propertyLabel,
                          })
                        }}
                      />
                      <span aria-hidden="true" className="compose-animation-timeline__property-tree" />
                      <span className="compose-animation-timeline__property-label">{listLabel}</span>
                      <span className="compose-animation-timeline__property-meta">
                        {property.channel
                          ? <em className="compose-animation-timeline__property-channel">{property.channel}</em>
                          : null}
                        {isColorValue
                          ? (
                              <i
                                aria-hidden="true"
                                className="compose-animation-timeline__property-swatch"
                                style={{ background: readout }}
                              />
                            )
                          : null}
                        <strong className="compose-animation-timeline__property-value">{readout}</strong>
                        <span
                          aria-hidden="true"
                          className="compose-animation-timeline__property-keyframe-mark"
                          title={t.propertyKeyframe(propertyLabel)}
                        ><DiamondIcon /></span>
                      </span>
                    </div>
                  )
                }) : null}
              </div>
            )
          })}
          </div>
        </div>
        <TimelineScale
          currentRatio={currentRatio}
          onKeyframeContextMenu={(event, context) => {
            actionsMenu.openAt(event, { kind: 'keyframe', ...context })
          }}
          onLaneContextMenu={(event, context) => {
            actionsMenu.openAt(event, { kind: 'lane', ...context })
          }}
          onSelectClip={selectClip}
          onSelectProperty={selectProperty}
          value={value}
          onUpdateClipRange={updateClipRange}
          onMoveKeyframe={moveKeyframe}
          onSelectKeyframe={selectKeyframe}
          onSelectInterpolationSegment={selectInterpolationSegment}
          scaleRef={scaleRef}
          scaleScrollRef={scaleScrollRef}
          scaleWidthPx={scaleWidthPx}
          markerStepMs={timeMarkerStepMs}
        />
      </div>
      </div>
      {/* 常驻挂载：live region 必须先于内容变化就存在于 DOM 中，AT 才能可靠捕获后续的文本变化。
          必须是 section 的最后一个子节点、.board-scroll 的兄弟节点，而不是 .tracks 的子节点：
          插入带默认 margin 的块级元素会把左列与右侧时间线刻度永久错位。
          视觉样式通过 --active 修饰类切换，避免无冲突时出现空提示框。 */}
      <p
        aria-live="polite"
        className={['compose-animation-timeline__notice', notice ? 'compose-animation-timeline__notice--active' : '']
          .filter(Boolean)
          .join(' ')}
        role="status"
      >
        {notice ? t.duplicateTime : ''}
      </p>
      {/* 单实例：右键与各行的"更多操作"按钮都通过控制器打开它，因此同一行两条入口必然同条目。 */}
      <TimelineActionsMenu
        messages={{
          addKeyframeAtPlayhead: t.menuAddKeyframeAtPlayhead,
          addKeyframeAtPointer: t.menuAddKeyframeAtPointer,
          nextKeyframe: t.menuNextKeyframe,
          previousKeyframe: t.menuPreviousKeyframe,
          removeKeyframe: t.menuRemoveKeyframe,
          removeTrack: t.menuRemoveTrack,
          removeTrackGroup: t.menuRemoveTrackGroup,
        }}
        rootProps={actionsMenu.rootProps}
        target={actionsMenu.payload}
        onAddKeyframeAtPlayhead={(propertyId) => {
          addKeyframeAtTime(propertyId, value.currentTimeMs)
        }}
        onAddKeyframeAtTime={addKeyframeAtTime}
        onRemoveKeyframe={removeKeyframe}
        onRemoveTrack={removeTrack}
        onRemoveTrackGroup={removeTrackGroup}
        onSeekAdjacentKeyframe={seekAdjacentKeyframe}
      />
    </section>
  )
}

function TimelineScale({
  currentRatio,
  markerStepMs,
  onKeyframeContextMenu,
  onLaneContextMenu,
  onMoveKeyframe,
  onSelectClip,
  onSelectProperty,
  onSelectKeyframe,
  onSelectInterpolationSegment,
  onUpdateClipRange,
  scaleRef,
  scaleScrollRef,
  scaleWidthPx,
  value,
}: {
  readonly currentRatio: number
  readonly markerStepMs: number
  /** 单个关键帧上的右键；宿主据此打开依赖该帧的菜单。 */
  readonly onKeyframeContextMenu: (
    event: ReactMouseEvent,
    context: { readonly propertyId: string, readonly keyframeId: string, readonly label: string },
  ) => void
  /** 车道空白处的右键；`timeMs` 是光标横坐标换算出的时间。 */
  readonly onLaneContextMenu: (
    event: ReactMouseEvent,
    context: { readonly propertyId: string, readonly label: string, readonly timeMs: number },
  ) => void
  readonly onMoveKeyframe: (keyframeId: string, timeMs: number) => void
  readonly onSelectClip: (clipId: string) => void
  readonly onSelectProperty: (propertyId: string) => void
  readonly onSelectKeyframe: (keyframeId: string) => void
  readonly onSelectInterpolationSegment: (endKeyframeId: string) => void
  readonly onUpdateClipRange: (clipId: string, startTimeMs: number, endTimeMs: number) => void
  readonly scaleRef: RefObject<HTMLDivElement | null>
  readonly scaleScrollRef: RefObject<HTMLDivElement | null>
  readonly scaleWidthPx: number
  readonly value: ReturnType<typeof useAnimationPanelSession>['value']
}) {
  const i18n = useComposeI18nContext()
  const locale = i18n?.locale ?? 'zh-CN'
  const t = messages[locale]
  const keyframeMoveHelpId = useId()
  const clipMoveHelpId = useId()
  const [dragging, setDragging] = useState<{ readonly keyframeId: string; readonly pointerId: number } | null>(null)
  const [clipDragging, setClipDragging] = useState<{
    readonly clipId: string
    readonly endTimeMs: number
    readonly kind: 'move' | 'start' | 'end'
    readonly pointerId: number
    readonly pointerTimeMs: number
    readonly startTimeMs: number
  } | null>(null)
  // 拖拽吸附到标尺次刻度（主刻度步长的 1/5，与 --ruler-minor-step 同源），
  // 而不是固定 10ms：缩放级别变化时次刻度间距跟着变，吸附粒度也要跟着变，
  // 否则缩小后每次拖拽跳过好几格次刻度、放大后又比次刻度更粗，手感和视觉网格对不上。
  const getTimeAtClientX = (clientX: number) => {
    const bounds = scaleRef.current?.getBoundingClientRect()
    if (!bounds || bounds.width <= 0) return value.currentTimeMs
    const rawTime = timelineRatio(clientX - bounds.left, bounds.width) * value.model.durationMs
    const snapStepMs = markerStepMs > 0 ? markerStepMs / 5 : 10
    return Math.min(
      value.model.durationMs,
      Math.max(0, Math.round(rawTime / snapStepMs) * snapStepMs),
    )
  }
  const handleKeyframePointerDown = (
    event: PointerEvent<HTMLButtonElement>,
    keyframeId: string,
  ) => {
    if (event.button !== 0) return
    event.preventDefault()
    const element = event.currentTarget
    element.focus()
    if ('setPointerCapture' in element) element.setPointerCapture(event.pointerId)
    onSelectKeyframe(keyframeId)
    setDragging({ keyframeId, pointerId: event.pointerId })
  }
  const handleKeyframePointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    if (!dragging || dragging.pointerId !== event.pointerId) return
    event.preventDefault()
    onMoveKeyframe(dragging.keyframeId, getTimeAtClientX(event.clientX))
  }
  const endKeyframeDrag = (event: PointerEvent<HTMLButtonElement>) => {
    if (!dragging || dragging.pointerId !== event.pointerId) return
    if ('releasePointerCapture' in event.currentTarget) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    setDragging(null)
  }
  const beginClipDrag = (
    event: PointerEvent<HTMLButtonElement>,
    clip: { readonly id: string; readonly startTimeMs: number; readonly endTimeMs: number },
    kind: 'move' | 'start' | 'end',
  ) => {
    if (event.button !== 0) return
    event.preventDefault()
    event.currentTarget.focus()
    if ('setPointerCapture' in event.currentTarget) event.currentTarget.setPointerCapture(event.pointerId)
    onSelectClip(clip.id)
    setClipDragging({
      clipId: clip.id,
      endTimeMs: clip.endTimeMs,
      kind,
      pointerId: event.pointerId,
      pointerTimeMs: getTimeAtClientX(event.clientX),
      startTimeMs: clip.startTimeMs,
    })
  }
  const moveClip = (event: PointerEvent<HTMLButtonElement>) => {
    if (!clipDragging || clipDragging.pointerId !== event.pointerId) return
    event.preventDefault()
    const pointerTimeMs = getTimeAtClientX(event.clientX)
    if (clipDragging.kind === 'move') {
      const durationMs = clipDragging.endTimeMs - clipDragging.startTimeMs
      const startTimeMs = Math.min(
        value.model.durationMs - durationMs,
        Math.max(0, clipDragging.startTimeMs + pointerTimeMs - clipDragging.pointerTimeMs),
      )
      onUpdateClipRange(clipDragging.clipId, startTimeMs, startTimeMs + durationMs)
      return
    }
    if (clipDragging.kind === 'start') {
      onUpdateClipRange(
        clipDragging.clipId,
        Math.min(clipDragging.endTimeMs - 10, Math.max(0, pointerTimeMs)),
        clipDragging.endTimeMs,
      )
      return
    }
    onUpdateClipRange(
      clipDragging.clipId,
      clipDragging.startTimeMs,
      Math.max(clipDragging.startTimeMs + 10, pointerTimeMs),
    )
  }
  const endClipDrag = (event: PointerEvent<HTMLButtonElement>) => {
    if (!clipDragging || clipDragging.pointerId !== event.pointerId) return
    if ('releasePointerCapture' in event.currentTarget) event.currentTarget.releasePointerCapture(event.pointerId)
    setClipDragging(null)
  }
  const adjustClipWithKeyboard = (
    event: KeyboardEvent<HTMLButtonElement>,
    clip: { readonly id: string; readonly startTimeMs: number; readonly endTimeMs: number },
    kind: 'move' | 'start' | 'end',
  ) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
    event.preventDefault()
    const deltaMs = event.key === 'ArrowLeft' ? -10 : 10
    onSelectClip(clip.id)
    if (kind === 'move') {
      const durationMs = clip.endTimeMs - clip.startTimeMs
      const startTimeMs = Math.min(
        value.model.durationMs - durationMs,
        Math.max(0, clip.startTimeMs + deltaMs),
      )
      onUpdateClipRange(clip.id, startTimeMs, startTimeMs + durationMs)
      return
    }
    if (kind === 'start') {
      onUpdateClipRange(clip.id, clip.startTimeMs + deltaMs, clip.endTimeMs)
      return
    }
    onUpdateClipRange(clip.id, clip.startTimeMs, clip.endTimeMs + deltaMs)
  }
  const clips = getComposeAnimationClips(value.model)
  return (
    <div className="compose-animation-timeline__scale-scroll" ref={scaleScrollRef}>
      <div
        className="compose-animation-timeline__scale"
        ref={scaleRef}
        style={{ '--animation-playhead': `${currentRatio * 100}%`, width: `${scaleWidthPx}px` } as CSSProperties}
      >
        {value.model.tracks.map((track) => {
          // 片段按轨道 label / id 前缀归属；无匹配时该物体行不画片段条
          const trackClips = clips.filter((clip) => (
            clip.trackId === track.id
          ))
          const propertyInTrackSelected = track.properties.some((property) => property.id === value.selectedPropertyId)
          const groupActive = value.selectedTrackId === track.id || propertyInTrackSelected
          return (
            <div
              className="compose-animation-timeline__track-lanes"
              data-group-active={groupActive || undefined}
              key={track.id}
            >
              {/* 动画片段：实心圆角色块 + 常驻竖线 trim 手柄；组选中底由 track-lanes 负责 */}
              {trackClips.map((clip) => {
                const label = clip.label
                const startRatio = timelineRatio(clip.startTimeMs, value.model.durationMs)
                const endRatio = timelineRatio(clip.endTimeMs, value.model.durationMs)
                const selected = value.selectedClipId === clip.id
                const draggingClip = clipDragging?.clipId === clip.id
                const clipLeft = `${startRatio * 100}%`
                const clipWidth = `${Math.max(0, endRatio - startRatio) * 100}%`
                return (
                  <div
                    className="compose-animation-timeline__clip"
                    data-dragging={draggingClip || undefined}
                    data-selected={selected || undefined}
                    key={clip.id}
                    style={{ left: clipLeft, width: clipWidth }}
                  >
                    <button
                      aria-current={selected || undefined}
                      aria-describedby={clipMoveHelpId}
                      aria-label={t.animationClip(label, clip.startTimeMs, clip.endTimeMs)}
                      className="compose-animation-timeline__clip-body"
                      data-dragging={draggingClip || undefined}
                      type="button"
                      onClick={() => onSelectClip(clip.id)}
                      onKeyDown={(event) => adjustClipWithKeyboard(event, clip, 'move')}
                      onPointerCancel={endClipDrag}
                      onPointerDown={(event) => beginClipDrag(event, clip, 'move')}
                      onPointerMove={moveClip}
                      onPointerUp={endClipDrag}
                    />
                    <button
                      aria-label={t.clipStart(label)}
                      className="compose-animation-timeline__clip-handle compose-animation-timeline__clip-handle--start"
                      data-selected={selected || undefined}
                      type="button"
                      onKeyDown={(event) => adjustClipWithKeyboard(event, clip, 'start')}
                      onPointerCancel={endClipDrag}
                      onPointerDown={(event) => beginClipDrag(event, clip, 'start')}
                      onPointerMove={moveClip}
                      onPointerUp={endClipDrag}
                    />
                    <button
                      aria-label={t.clipEnd(label)}
                      className="compose-animation-timeline__clip-handle compose-animation-timeline__clip-handle--end"
                      data-selected={selected || undefined}
                      type="button"
                      onKeyDown={(event) => adjustClipWithKeyboard(event, clip, 'end')}
                      onPointerCancel={endClipDrag}
                      onPointerDown={(event) => beginClipDrag(event, clip, 'end')}
                      onPointerMove={moveClip}
                      onPointerUp={endClipDrag}
                    />
                  </div>
                )
              })}
              <div
                className="compose-animation-timeline__clip-row"
                data-object-lane={track.id}
                data-selected={value.selectedTrackId === track.id || undefined}
              />
              {track.expanded ? track.properties.map((property) => {
                const keyframes = [...property.keyframes].sort((left, right) => left.timeMs - right.timeMs)
                const label = property.label
                const propertySelected = value.selectedPropertyId === property.id
                return (
                  <div
                    className="compose-animation-timeline__property-lane"
                    data-property-lane={property.id}
                    data-selected={propertySelected || undefined}
                    key={property.id}
                    onContextMenu={(event) => {
                      onLaneContextMenu(event, {
                        propertyId: property.id,
                        label,
                        timeMs: getTimeAtClientX(event.clientX),
                      })
                    }}
                  >
                    <button
                      aria-current={propertySelected || undefined}
                      aria-label={t.selectPropertyLane(label)}
                      className="compose-animation-timeline__lane-hit"
                      data-property-lane-hit={property.id}
                      type="button"
                      onClick={() => onSelectProperty(property.id)}
                    />
                    {keyframes.slice(1).map((keyframe, keyframeIndex) => {
                      const startKeyframe = keyframes[keyframeIndex]!
                      // 插值挂出向段：控制这一段的是起点关键帧，选中态与点击都跟着它走。
                      const segmentCurrent = value.selectedKeyframeId === startKeyframe.id
                      const startRatio = timelineRatio(startKeyframe.timeMs, value.model.durationMs)
                      const endRatio = timelineRatio(keyframe.timeMs, value.model.durationMs)
                      return (
                        <button
                          aria-current={segmentCurrent || undefined}
                          aria-label={t.interpolationSegment(startKeyframe.timeMs, keyframe.timeMs, label)}
                          className="compose-animation-timeline__interpolation-segment"
                          data-interpolation={startKeyframe.interpolation.kind}
                          key={`${keyframe.id}-segment`}
                          style={{ left: `${startRatio * 100}%`, width: `${(endRatio - startRatio) * 100}%` }}
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation()
                            onSelectInterpolationSegment(startKeyframe.id)
                          }}
                        ><CurveIcon /></button>
                      )
                    })}
                    {keyframes.map((keyframe) => {
                      const selected = value.selectedKeyframeId === keyframe.id
                      return (
                        <button
                          aria-current={selected || undefined}
                          aria-label={t.keyframe(keyframe.timeMs, label)}
                          aria-describedby={keyframeMoveHelpId}
                          className="compose-animation-timeline__keyframe"
                          data-dragging={dragging?.keyframeId === keyframe.id || undefined}
                          key={keyframe.id}
                          style={{ left: `${timelineRatio(keyframe.timeMs, value.model.durationMs) * 100}%` }}
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation()
                            onSelectKeyframe(keyframe.id)
                          }}
                          onKeyDown={(event) => {
                            if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
                            event.preventDefault()
                            onSelectKeyframe(keyframe.id)
                            onMoveKeyframe(keyframe.id, keyframe.timeMs + (event.key === 'ArrowLeft' ? -10 : 10))
                          }}
                          onPointerCancel={endKeyframeDrag}
                          onContextMenu={(event) => {
                            // 停止冒泡：否则车道会把它当成空白右键，给出"在光标时间打点"。
                            event.stopPropagation()
                            onKeyframeContextMenu(event, {
                              propertyId: property.id,
                              keyframeId: keyframe.id,
                              label,
                            })
                          }}
                          onPointerDown={(event) => handleKeyframePointerDown(event, keyframe.id)}
                          onPointerMove={handleKeyframePointerMove}
                          onPointerUp={endKeyframeDrag}
                        ><DiamondIcon /></button>
                      )
                    })}
                  </div>
                )
              }) : null}
            </div>
          )
        })}
        <span className="compose-animation-panel__sr-only" id={keyframeMoveHelpId}>{t.keyframeMove}</span>
        <span className="compose-animation-panel__sr-only" id={clipMoveHelpId}>{t.clipMove}</span>
        {/* 擦洗输入与倒三角只在头部标尺行渲染一份；这里只保留竖线穿过各轨道，与标尺行的
            playhead 共用同一个 --animation-playhead 百分比，两段视觉上仍是同一条线。 */}
        <div aria-hidden="true" className="compose-animation-timeline__playhead" data-scope="lanes"><span /><i /></div>
      </div>
    </div>
  )
}

/** 渲染可置于编辑器右侧的关键帧属性面板。 @public */
export function ComposeAnimationInspector({
  className,
  style,
  ...htmlProps
}: ComposeAnimationInspectorProps) {
  const i18n = useComposeI18nContext()
  const theme = useComposeThemeContext()
  const { notice, selectedKeyframe, updateSelectedKeyframe, value } = useAnimationPanelSession()
  const locale = i18n?.locale ?? 'zh-CN'
  const t = messages[locale]
  const rootClassName = ['compose-animation-panel', 'compose-animation-inspector', className]
    .filter(Boolean)
    .join(' ')
  const keyframes = value.model.tracks.flatMap((track) => track.properties.flatMap((property) => property.keyframes))
  const selectedIndex = keyframes.findIndex(({ id }) => id === selectedKeyframe?.keyframe.id)
  const selectedProperty = selectedKeyframe?.property
  const selectedTrack = selectedKeyframe?.track
  const propertyLabel = selectedProperty
    ? selectedProperty.label
    : ''
  const trackLabel = selectedTrack
    ? selectedTrack.label
    : ''
  const keyframeValue = selectedKeyframe?.keyframe.value
  const valueKind = selectedProperty?.valueKind ?? 'number'
  const interpolation: ComposeAnimationInterpolation
    = selectedKeyframe?.keyframe.interpolation ?? { kind: 'linear' }
  // 插值挂出向段：区间是「本帧 → 下一帧」，末帧没有下一帧因此没有区间。
  const nextKeyframe = selectedKeyframe
    ? selectedKeyframe.property.keyframes[selectedKeyframe.location.keyframeIndex + 1]
    : undefined
  const interpolationRange = nextKeyframe && selectedKeyframe
    ? `${selectedKeyframe.keyframe.timeMs} ms → ${nextKeyframe.timeMs} ms`
    : ''
  const isLastKeyframe = selectedKeyframe !== undefined && nextKeyframe === undefined
  const noticeId = useId()

  return (
    <aside
      {...htmlProps}
      aria-label={htmlProps['aria-label'] ?? t.inspector}
      className={rootClassName}
      data-compose-theme={theme?.resolvedTheme}
      data-compose-ui="animation-inspector"
      lang={locale}
      role={htmlProps.role ?? 'complementary'}
      style={{ ...(theme ? createComposeThemeStyle(theme.tokens) : {}), ...style } as CSSProperties}
    >
      <header className="compose-animation-inspector__header">
        <h2>{t.keyframeHeading}</h2>
        <div>
          <strong>{selectedKeyframe ? `${trackLabel} / ${propertyLabel}` : t.noSelection}</strong>
          <span>{selectedIndex >= 0 ? selectedIndex + 1 : '—'} / {keyframes.length}</span>
        </div>
      </header>
      <div className="compose-animation-inspector__fields">
        <label>
          <span>{t.time}</span>
          <span className="compose-animation-inspector__unit-field">
            <CommittedInput
              aria-describedby={notice ? noticeId : undefined}
              aria-label={t.time}
              inputMode="numeric"
              key={`${selectedKeyframe?.keyframe.id ?? 'none'}-${selectedKeyframe?.keyframe.timeMs ?? 0}`}
              readOnly={!selectedKeyframe}
              value={selectedKeyframe ? String(selectedKeyframe.keyframe.timeMs) : ''}
              onCommit={(draft) => {
                const timeMs = Number.parseInt(draft, 10)
                if (!Number.isFinite(timeMs)) return false
                return updateSelectedKeyframe({ timeMs })
              }}
            />
            <small>ms</small>
          </span>
        </label>
        <label><span>{t.propertyField}</span><input aria-label={t.propertyField} readOnly value={propertyLabel} /></label>
        {interpolationRange ? <label><span>{t.interpolationRange}</span><input aria-label={t.interpolationRange} readOnly value={interpolationRange} /></label> : null}
        {valueKind === 'color' ? (
          <div className="compose-animation-inspector__color-field" role="group">
            <span>{t.value}</span>
            <ComposeColorPicker
              key={selectedKeyframe?.keyframe.id ?? 'none'}
              label={t.value}
              readOnly={!selectedKeyframe}
              value={typeof keyframeValue === 'string' ? keyframeValue : '#000000'}
              onValueChange={(next) => {
                updateSelectedKeyframe({ value: next })
              }}
            />
          </div>
        ) : null}
        {valueKind === 'number' ? (
          <label>
            <span>{t.value}</span>
            <CommittedInput
              aria-label={t.value}
              inputMode="decimal"
              key={`${selectedKeyframe?.keyframe.id ?? 'none'}-${String(keyframeValue)}`}
              readOnly={!selectedKeyframe}
              value={typeof keyframeValue === 'number' ? String(keyframeValue) : ''}
              onCommit={(draft) => {
                const next = Number.parseFloat(draft)
                if (!Number.isFinite(next)) return false
                return updateSelectedKeyframe({ value: next })
              }}
            />
          </label>
        ) : null}
        {valueKind === 'vector2' ? (
          <label>
            <span>{t.value}</span>
            <span className="compose-animation-inspector__vector-field">
              {(['x', 'y'] as const).map((axis) => {
                const vector = typeof keyframeValue === 'object' && keyframeValue !== null
                  ? keyframeValue
                  : null
                return (
                  <CommittedInput
                    aria-label={`${t.value} ${axis.toUpperCase()}`}
                    inputMode="decimal"
                    key={`${selectedKeyframe?.keyframe.id ?? 'none'}-${axis}-${vector ? vector[axis] : ''}`}
                    readOnly={!selectedKeyframe || !vector}
                    value={vector ? String(vector[axis]) : ''}
                    onCommit={(draft) => {
                      const next = Number.parseFloat(draft)
                      if (!Number.isFinite(next) || !vector) return false
                      return updateSelectedKeyframe({ value: { ...vector, [axis]: next } })
                    }}
                  />
                )
              })}
            </span>
          </label>
        ) : null}
      </div>
      <div className="compose-animation-inspector__easing-editor">
        <ComposeEasingCurveEditor
          key={selectedKeyframe?.keyframe.id ?? 'none'}
          note={isLastKeyframe ? t.lastKeyframeNote : undefined}
          readOnly={!selectedKeyframe}
          value={interpolation}
          onChange={(next) => {
            updateSelectedKeyframe({ interpolation: next })
          }}
        />
      </div>
      {/* 播报由时间线的 live region 负责：两个组件同时挂载时重复播报比没有播报更糟。
          这里只做常驻可见说明，并通过 aria-describedby 挂到时间字段上。 */}
      {notice ? <p className="compose-animation-inspector__notice" id={noticeId}>{t.duplicateTime}</p> : null}
    </aside>
  )
}
