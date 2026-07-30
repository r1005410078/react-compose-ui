import { Popover as PopoverPrimitive } from '@base-ui/react/popover'
import {
  createComposeThemeStyle,
  useComposeI18nContext,
  useComposeThemeContext,
} from '@compose-ui/ui-context'
import {
  useCallback,
  createContext,
  useEffect,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react'
import type {
  Context,
  CSSProperties,
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
  ReactNode,
} from 'react'
import {
  normalizeComposeColor,
  type ComposeColor,
  type ComposeGradientStop,
  type ComposeImageFit,
  type ComposePaintImageAsset,
  type ComposePaint,
} from '@compose-ui/core'
import { cn } from '#lib/utils'
import { ComposeColorPicker } from './compose-color-picker'
import {
  COMPOSE_COMMON_COLORS,
  composeColorWithAlpha,
  parseComposeEditableColor,
} from './color-model'
import {
  gradientAngle,
  gradientGeometryPoint,
  gradientPaintWithAngle,
  insertGradientStop,
  moveGradientStop,
  normalizeGradientAngle,
  removeGradientStop,
  updateGradientGeometry,
  type ComposeGradientPaint,
  type GradientGeometryHandle,
} from './gradient-model'

type GradientKind = Extract<ComposePaint['kind'], 'linear-gradient' | 'radial-gradient' | 'angular-gradient'>
type PaintTab = 'solid' | 'gradient' | 'image'

interface GradientGesture {
  readonly pointerId: number
  readonly source: ComposeGradientPaint
  latest: ComposeGradientPaint
}

const previewX = (value: number) => 4 + value * 92
const previewY = (value: number) => 7 + value * 86
const EMPTY_IMAGE_OPTIONS: readonly ComposePaintImageOption[] = []

const GRADIENT_PRESETS: readonly (Extract<ComposePaint, { readonly kind: 'linear-gradient' }>)[] = [
  { kind: 'linear-gradient', start: { x: 0, y: 0 }, end: { x: 1, y: 1 }, stops: [{ id: 'a', position: 0, color: '#a78bfa' }, { id: 'b', position: 1, color: '#4c1d95' }] },
  { kind: 'linear-gradient', start: { x: 0, y: 1 }, end: { x: 1, y: 0 }, stops: [{ id: 'a', position: 0, color: '#22d3ee' }, { id: 'b', position: 1, color: '#4f46e5' }] },
  { kind: 'linear-gradient', start: { x: 0, y: 0.5 }, end: { x: 1, y: 0.5 }, stops: [{ id: 'a', position: 0, color: '#ec4899' }, { id: 'b', position: 1, color: '#fb923c' }] },
  { kind: 'linear-gradient', start: { x: 0, y: 0 }, end: { x: 1, y: 1 }, stops: [{ id: 'a', position: 0, color: '#312e81' }, { id: 'b', position: 0.55, color: '#ec4899' }, { id: 'c', position: 1, color: '#fbbf24' }] },
  { kind: 'linear-gradient', start: { x: 0, y: 1 }, end: { x: 1, y: 0 }, stops: [{ id: 'a', position: 0, color: '#6ee7b7' }, { id: 'b', position: 1, color: '#0369a1' }] },
  { kind: 'linear-gradient', start: { x: 0, y: 1 }, end: { x: 1, y: 0 }, stops: [{ id: 'a', position: 0, color: '#0f172a' }, { id: 'b', position: 1, color: '#86efac' }] },
]

/** 宿主提供给图片页的可选最近图片。 @public */
export interface ComposePaintImageOption {
  /** 写入 Image Paint 的稳定资源引用。 */
  readonly asset: ComposePaintImageAsset
  /** 可直接显示的缩略图 URL；组件不会把它写入文档。 */
  readonly previewUrl: string
  /** 图片的可访问名称。 */
  readonly label: string
}

/** 图片页与宿主资源系统之间的最小适配端口。 @public */
export interface ComposePaintImageLibrary {
  /** 最近使用的可引用图片。 */
  readonly recent?: readonly ComposePaintImageOption[]
  /** 可在当前 Popover 内分页浏览的完整图片集合。 */
  readonly images?: readonly ComposePaintImageOption[]
  /** 图片集合的异步加载状态；省略时按 ready 处理。 */
  readonly status?: 'idle' | 'loading' | 'ready' | 'error' | 'unsupported'
  /** 由文件输入触发，宿主持久化后返回稳定资源引用及缩略图。 */
  readonly onUpload?: (file: File) => Promise<ComposePaintImageOption | null>
  /** 打开宿主资源选择器后返回稳定资源引用及缩略图。 */
  readonly onBrowse?: () => Promise<ComposePaintImageOption | null>
  /** 重新加载完整图片集合。 */
  readonly onRetry?: () => void
}

type ComposePaintImageLibraryContextGlobal = typeof globalThis & {
  __composeUiPaintImageLibraryContext?: Context<ComposePaintImageLibrary | undefined>
}

const contextGlobal = globalThis as ComposePaintImageLibraryContextGlobal
// Components 源码会被多个第一方库分别打包；Context 对象若随 bundle 复制，Editor Provider
// 与 Property Panel Picker 将无法相互识别。只共享 Context 身份，值仍由各 React 树实例隔离。
const ComposePaintImageLibraryContext = contextGlobal.__composeUiPaintImageLibraryContext
  ?? createContext<ComposePaintImageLibrary | undefined>(undefined)
contextGlobal.__composeUiPaintImageLibraryContext ??= ComposePaintImageLibraryContext

/** 图片 Paint 资源端口的实例级 Provider 属性。 @public */
export interface ComposePaintImageLibraryProviderProps {
  /** 当前编辑器实例使用的图片资源适配端口。 */
  readonly value?: ComposePaintImageLibrary
  /** 可以消费该资源端口的 Picker 子树。 */
  readonly children: ReactNode
}

/**
 * 跨 Inspector 组合层级注入图片 Paint 资源端口。
 *
 * @remarks
 * 仅传递宿主配置，不持有资源、上传状态或文档状态。
 *
 * @public
 */
export function ComposePaintImageLibraryProvider({
  children,
  value,
}: ComposePaintImageLibraryProviderProps) {
  return (
    <ComposePaintImageLibraryContext.Provider value={value}>
      {children}
    </ComposePaintImageLibraryContext.Provider>
  )
}

function messages(locale: string | undefined) {
  const zh = locale !== 'en-US'
  return {
    angular: zh ? '角向' : 'Angular',
    angle: zh ? '角度' : 'Angle',
    deleteStop: zh ? '删除色标' : 'Delete stop',
    dialog: zh ? '背景填充' : 'Background fill',
    close: zh ? '关闭' : 'Close',
    exact: zh ? '精确' : 'Exact',
    linear: zh ? '线性' : 'Linear',
    position: zh ? '色标位置' : 'Stop position',
    radial: zh ? '径向' : 'Radial',
    image: zh ? '图片' : 'Image',
    upload: zh ? '上传图片' : 'Upload image',
    uploading: zh ? '正在上传…' : 'Uploading…',
    uploadUnavailable: zh ? '当前资源不支持上传' : 'Upload is not supported',
    invalidImage: zh ? '请选择一张有效图片' : 'Choose one valid image',
    uploadFailed: zh ? '图片上传失败，请重试' : 'Image upload failed. Try again.',
    browse: zh ? '选择图片' : 'Choose image',
    addImage: zh ? '添加图片' : 'Add image',
    imageLibrary: zh ? '图片资源' : 'Image library',
    imageLoading: zh ? '正在加载图片…' : 'Loading images…',
    imageLoadFailed: zh ? '图片加载失败' : 'Images failed to load',
    imageUnsupported: zh ? '当前资源不支持稳定图片引用' : 'Stable image references are not supported',
    imageEmpty: zh ? '暂无可用图片' : 'No images available',
    retry: zh ? '重试' : 'Retry',
    back: zh ? '返回' : 'Back',
    previousPage: zh ? '上一页' : 'Previous page',
    nextPage: zh ? '下一页' : 'Next page',
    recentImages: zh ? '最近使用' : 'Recent images',
    fit: zh ? '图片设置' : 'Image settings',
    cover: zh ? '填充' : 'Fill',
    contain: zh ? '适应' : 'Fit',
    stretch: zh ? '拉伸' : 'Stretch',
    opacity: zh ? '不透明度' : 'Opacity',
    overlay: zh ? '叠加颜色' : 'Color overlay',
    gradient: zh ? '渐变' : 'Gradient',
    addStop: zh ? '添加色标' : 'Add stop',
    stop: zh ? '色标' : 'Color stop',
    direction: zh ? '方向' : 'Direction',
    directionAngle: zh ? '方向角度' : 'Direction angle',
    centerRadius: zh ? '中心与半径' : 'Center and radii',
    centerX: zh ? '中心 X' : 'Center X',
    centerY: zh ? '中心 Y' : 'Center Y',
    radiusX: zh ? '水平半径' : 'Horizontal radius',
    radiusY: zh ? '垂直半径' : 'Vertical radius',
    startX: zh ? '起点 X' : 'Start X',
    startY: zh ? '起点 Y' : 'Start Y',
    endX: zh ? '终点 X' : 'End X',
    endY: zh ? '终点 Y' : 'End Y',
    linearStart: zh ? '线性起点' : 'Linear start',
    linearEnd: zh ? '线性终点' : 'Linear end',
    radialCenter: zh ? '径向中心' : 'Radial center',
    radialRadiusX: zh ? '径向水平半径' : 'Radial horizontal radius',
    radialRadiusY: zh ? '径向垂直半径' : 'Radial vertical radius',
    angularCenter: zh ? '角向中心' : 'Angular center',
    angularArm: zh ? '角向起始角' : 'Angular start angle',
    presets: zh ? '渐变预设' : 'Gradient presets',
    advanced: zh ? '高级设置' : 'Advanced',
    dropHint: zh ? '拖拽图片到这里，或点击上传' : 'Drop an image here, or click to upload',
    common: zh ? '常用颜色' : 'Common colors',
    solid: zh ? '纯色' : 'Solid',
    track: zh ? '渐变色标轨道' : 'Gradient stop track',
  }
}

function paintStyle(paint: ComposePaint): CSSProperties {
  if (paint.kind === 'solid') return { background: paint.color }
  if (paint.kind === 'image') return { background: paint.overlay?.color ?? 'transparent' }
  const stops = paint.stops.map((stop) => `${stop.color} ${stop.position * 100}%`).join(', ')
  if (paint.kind === 'linear-gradient') {
    const angle = Math.atan2(paint.end.y - paint.start.y, paint.end.x - paint.start.x) * 180 / Math.PI + 90
    return { background: `linear-gradient(${angle}deg, ${stops})` }
  }
  if (paint.kind === 'radial-gradient') return { background: `radial-gradient(ellipse at ${paint.center.x * 100}% ${paint.center.y * 100}%, ${stops})` }
  return { background: `conic-gradient(from ${paint.angle}deg at ${paint.center.x * 100}% ${paint.center.y * 100}%, ${stops})` }
}

function imageOptionKey(option: ComposePaintImageOption) {
  return `${option.asset.providerId}:${option.asset.assetKey}`
}

function mergeImageOptions(
  ...collections: readonly (readonly ComposePaintImageOption[] | undefined)[]
) {
  const seen = new Set<string>()
  return collections.flatMap((collection) => collection ?? []).filter((option) => {
    const key = imageOptionKey(option)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function isImageFile(file: File) {
  return file.type.startsWith('image/')
    || /\.(?:avif|bmp|gif|ico|jpe?g|png|svg|webp)$/i.test(file.name)
}

function defaultGradient(kind: GradientKind, color: ComposeColor): ComposePaint {
  const startColor = color === 'transparent' ? '#8b5cf6' : color
  const stops: readonly ComposeGradientStop[] = [
    { id: 'paint-stop-start', position: 0, color: startColor },
    { id: 'paint-stop-end', position: 1, color: 'transparent' },
  ]
  if (kind === 'linear-gradient') return { kind, start: { x: 0, y: 0.5 }, end: { x: 1, y: 0.5 }, stops }
  if (kind === 'radial-gradient') return { kind, center: { x: 0.5, y: 0.5 }, radiusX: 0.5, radiusY: 0.5, stops }
  return { kind, center: { x: 0.5, y: 0.5 }, angle: 0, stops }
}

function gradientWithKind(kind: GradientKind, stops: readonly ComposeGradientStop[]): ComposePaint {
  if (kind === 'linear-gradient') return { kind, start: { x: 0, y: 0.5 }, end: { x: 1, y: 0.5 }, stops }
  if (kind === 'radial-gradient') return { kind, center: { x: 0.5, y: 0.5 }, radiusX: 0.5, radiusY: 0.5, stops }
  return { kind, center: { x: 0.5, y: 0.5 }, angle: 0, stops }
}

function PaintPopover({ children, label }: { readonly children: ReactNode; readonly label: string }) {
  const theme = useComposeThemeContext()
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Positioner
        align="start"
        className="cu:isolate cu:z-[20000]"
        collisionAvoidance={{ side: 'shift', align: 'shift', fallbackAxisSide: 'none' }}
        collisionPadding={8}
        side="bottom"
        sideOffset={6}
      >
        <PopoverPrimitive.Popup aria-label={label} className={cn('compose-paint-picker__popover cu:w-[min(408px,calc(100vw-24px))] cu:rounded-xl cu:border cu:border-border cu:bg-popover cu:shadow-xl cu:outline-none')} data-compose-theme={theme?.resolvedTheme} data-compose-ui="paint-picker" role="dialog" style={theme ? createComposeThemeStyle(theme.tokens) as CSSProperties : undefined}>
          {children}
        </PopoverPrimitive.Popup>
      </PopoverPrimitive.Positioner>
    </PopoverPrimitive.Portal>
  )
}

/** ComposePaintPicker 的受控属性。 @public */
export interface ComposePaintPickerProps {
  /** 当前结构化背景 Paint。 */
  readonly value: ComposePaint
  /** 每一次有效编辑提交新的结构化 Paint。 */
  readonly onValueChange?: (paint: ComposePaint) => void
  /** 触发器的可访问名称。 */
  readonly label?: string
  /** 禁用交互。 */
  readonly disabled?: boolean
  /** 以不可编辑状态展示。 */
  readonly readOnly?: boolean
  /** 原生吸管不可用时把当前 stop 切到 Stage 图层采样。 */
  readonly onEyedropperFallback?: () => void
  /** Popover 可见性变化；Editor 用它控制画布 Paint edit session。 */
  readonly onOpenChange?: (open: boolean) => void
  /** 图片页的宿主资源适配器；省略时图片页只展示不可用状态。 */
  readonly imageLibrary?: ComposePaintImageLibrary
}

/**
 * 背景填充选择器：选择 Fill 类型、编辑渐变色标，并复用纯色 Picker 的 Alpha/历史/吸管能力。
 *
 * @public
 */
export function ComposePaintPicker({
  disabled = false,
  label,
  onEyedropperFallback,
  onOpenChange,
  onValueChange,
  imageLibrary,
  readOnly = false,
  value,
}: ComposePaintPickerProps) {
  const inheritedImageLibrary = useContext(ComposePaintImageLibraryContext)
  const resolvedImageLibrary = imageLibrary ?? inheritedImageLibrary
  const text = messages(useComposeI18nContext()?.locale)
  const [open, setOpen] = useState(false)
  const tabForPaint = (paint: ComposePaint): PaintTab => paint.kind === 'solid' ? 'solid' : paint.kind === 'image' ? 'image' : 'gradient'
  const [tab, setTab] = useState<PaintTab>(() => tabForPaint(value))
  const [imageView, setImageView] = useState<'main' | 'library'>('main')
  const [imagePage, setImagePage] = useState(0)
  const [imageBusy, setImageBusy] = useState(false)
  const [imageError, setImageError] = useState<string | null>(null)
  const [recentImageSelections, setRecentImageSelections] = useState<
    readonly ComposePaintImageOption[]
  >([])
  const [selectedStopId, setSelectedStopId] = useState<string | null>(
    value.kind === 'solid' || value.kind === 'image' ? null : value.stops[0]?.id ?? null,
  )
  const pickerRef = useRef<HTMLDivElement | null>(null)
  const gradientGestureRef = useRef<GradientGesture | null>(null)
  const [gradientDraft, setGradientDraft] = useState<ComposeGradientPaint | null>(null)
  const locked = disabled || readOnly
  const valueIsGradient = value.kind !== 'solid' && value.kind !== 'image'
  const gradientPaint = gradientDraft ?? (valueIsGradient ? value : null)
  const selectedStop = !gradientPaint
    ? null
    : gradientPaint.stops.find((stop) => stop.id === selectedStopId) ?? gradientPaint.stops[0]!
  const activeColor = value.kind === 'solid'
    ? value.color
    : gradientPaint
      ? selectedStop?.color ?? gradientPaint.stops[0]!.color
      : value.kind === 'image' ? value.overlay?.color ?? '#000000' : '#000000'
  const libraryImages = resolvedImageLibrary?.images ?? EMPTY_IMAGE_OPTIONS
  const recentImages = useMemo(
    () => mergeImageOptions(
      recentImageSelections,
      resolvedImageLibrary?.recent,
      libraryImages,
    ).slice(0, 4),
    [libraryImages, recentImageSelections, resolvedImageLibrary?.recent],
  )
  const allKnownImages = useMemo(
    () => mergeImageOptions(
      recentImageSelections,
      resolvedImageLibrary?.recent,
      libraryImages,
    ),
    [libraryImages, recentImageSelections, resolvedImageLibrary?.recent],
  )
  const imagePageCount = Math.max(1, Math.ceil(libraryImages.length / 8))
  const resolvedImagePage = Math.min(imagePage, imagePageCount - 1)
  const visibleLibraryImages = libraryImages.slice(
    resolvedImagePage * 8,
    resolvedImagePage * 8 + 8,
  )
  const emit = useCallback((paint: ComposePaint) => {
    if (!locked) onValueChange?.(paint)
  }, [locked, onValueChange])
  const cancelGradientGesture = useCallback(() => {
    gradientGestureRef.current = null
    setGradientDraft(null)
  }, [])
  const startGradientGesture = (
    pointerId: number,
    source: ComposeGradientPaint,
    initial: ComposeGradientPaint = source,
  ) => {
    gradientGestureRef.current = { pointerId, source, latest: initial }
    setGradientDraft(initial)
  }
  const previewGradientGesture = (
    pointerId: number,
    update: (source: ComposeGradientPaint) => ComposeGradientPaint,
  ) => {
    const gesture = gradientGestureRef.current
    if (!gesture || gesture.pointerId !== pointerId) return
    const next = update(gesture.source)
    gesture.latest = next
    setGradientDraft(next)
  }
  const commitGradientGesture = (pointerId: number) => {
    const gesture = gradientGestureRef.current
    if (!gesture || gesture.pointerId !== pointerId) return
    gradientGestureRef.current = null
    setGradientDraft(null)
    // 单击只负责选择；只有几何或色标值真正变化时才产生宿主事务。
    if (JSON.stringify(gesture.latest) !== JSON.stringify(gesture.source)) emit(gesture.latest)
  }
  useEffect(() => {
    const gesture = gradientGestureRef.current
    if (gesture && gesture.source !== value) cancelGradientGesture()
  }, [cancelGradientGesture, value])
  useEffect(() => () => {
    gradientGestureRef.current = null
  }, [])
  const selectKind = (kind: ComposePaint['kind']) => {
    cancelGradientGesture()
    setTab(kind === 'solid' ? 'solid' : kind === 'image' ? 'image' : 'gradient')
    if (kind === 'image') return
    if (kind === value.kind) return
    if (kind === 'solid') {
      emit({ kind: 'solid', color: activeColor })
      setSelectedStopId(null)
      return
    }
    const next: ComposePaint = value.kind === 'solid' || value.kind === 'image'
      ? defaultGradient(kind, activeColor)
      : gradientWithKind(kind, value.stops)
    setSelectedStopId(value.kind === 'solid' || value.kind === 'image' ? 'paint-stop-start' : value.stops[0]?.id ?? null)
    emit(next)
  }
  const updateCurrentStop = (color: ComposeColor) => {
    if (value.kind === 'solid') emit({ kind: 'solid', color })
    else if (gradientPaint) {
      emit({
        ...gradientPaint,
        stops: gradientPaint.stops.map((stop) => (
          stop.id === selectedStop?.id ? { ...stop, color } : stop
        )),
      })
    }
  }
  const updateActiveColorText = (input: string) => {
    const normalized = normalizeComposeColor(input)
    if (!normalized) return
    updateCurrentStop(composeColorWithAlpha(normalized, parseComposeEditableColor(activeColor).alpha))
  }
  const updateStopPosition = (id: string, position: number) => {
    if (!gradientPaint) return
    emit(moveGradientStop(gradientPaint, id, position))
  }
  const updateAngle = (angle: number) => {
    if (!gradientPaint || !Number.isFinite(angle)) return
    if (gradientPaint.kind === 'linear-gradient' || gradientPaint.kind === 'angular-gradient') {
      emit(gradientPaintWithAngle(gradientPaint, angle))
    }
  }
  const addStopAt = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (!gradientPaint) return
    const bounds = event.currentTarget.getBoundingClientRect()
    const position = Math.min(1, Math.max(0, (event.clientX - bounds.left) / bounds.width))
    const result = insertGradientStop(gradientPaint, position)
    if (!result) return
    setSelectedStopId(result.stop.id)
    emit(result.paint)
  }
  const addStop = () => {
    if (!gradientPaint) return
    const result = insertGradientStop(gradientPaint)
    if (!result) return
    setSelectedStopId(result.stop.id)
    emit(result.paint)
  }
  const deleteSelectedStop = () => {
    if (!gradientPaint || !selectedStop) return
    const result = removeGradientStop(gradientPaint, selectedStop.id)
    if (!result) return
    setSelectedStopId(result.selectedStopId)
    emit(result.paint)
  }
  const onStopKeyDown = (
    event: ReactKeyboardEvent<HTMLButtonElement>,
    stop: ComposeGradientStop,
  ) => {
    if (!gradientPaint) return
    event.stopPropagation()
    if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault()
      const result = removeGradientStop(gradientPaint, stop.id)
      if (!result) return
      setSelectedStopId(result.selectedStopId)
      emit(result.paint)
      return
    }
    if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault()
      updateStopPosition(stop.id, event.key === 'Home' ? 0 : 1)
      return
    }
    const direction = event.key === 'ArrowRight' || event.key === 'ArrowUp' ? 1
      : event.key === 'ArrowLeft' || event.key === 'ArrowDown' ? -1 : 0
    if (direction === 0) return
    event.preventDefault()
    updateStopPosition(stop.id, stop.position + direction * (event.shiftKey ? 0.1 : 0.01))
  }
  const handleOpenChange = (next: boolean, details: {
    readonly reason: string
    readonly cancel: () => void
  }) => {
    // 渐变控制柄位于 Stage 的 SVG 覆盖层，不属于 Popover Portal。若把画布上的
    // pointer down 当作普通 outside press，Base UI 会在手势起点先关闭面板，随后
    // Editor 清空 Paint session，使 pointerup 没有可提交的预览。Paint 编辑器因此
    // 对 outside press 保持 pinned；Escape 和再次触发器仍是明确、可预期的关闭方式。
    if (!next && (details.reason === 'outside-press' || details.reason === 'focus-out')) {
      details.cancel()
      return
    }
    if (!next) cancelGradientGesture()
    if (next) {
      setTab(tabForPaint(value))
      setImageView('main')
      setImageError(null)
    }
    setOpen(next)
    onOpenChange?.(next)
  }
  const title = label ?? text.dialog
  const mainTabs: readonly [PaintTab, string][] = useMemo(() => [
    ['solid', text.solid],
    ['gradient', text.gradient],
    ['image', text.image],
  ], [text.gradient, text.image, text.solid])
  const gradientTabs: readonly [GradientKind, string][] = useMemo(() => [
    ['linear-gradient', text.linear],
    ['radial-gradient', text.radial],
    ['angular-gradient', text.angular],
  ], [text.angular, text.linear, text.radial])
  const selectMainTab = (nextTab: PaintTab) => {
    cancelGradientGesture()
    setTab(nextTab)
    setImageView('main')
    setImageError(null)
    requestAnimationFrame(() => pickerRef.current?.parentElement?.scrollTo?.({ top: 0 }))
    if (nextTab === 'solid') selectKind('solid')
    if (nextTab === 'gradient') selectKind(valueIsGradient ? value.kind : 'linear-gradient')
  }
  const applyImage = (option: ComposePaintImageOption) => {
    setTab('image')
    setImageView('main')
    setRecentImageSelections((current) => mergeImageOptions([option], current).slice(0, 4))
    emit(value.kind === 'image'
      ? { ...value, asset: option.asset }
      : {
          kind: 'image',
          asset: option.asset,
          fit: 'cover',
          opacity: 1,
          overlay: { color: '#8b5cf6', opacity: 0.4 },
        })
  }
  const updateImage = (update: (paint: Extract<ComposePaint, { readonly kind: 'image' }>) => ComposePaint) => {
    if (value.kind === 'image') emit(update(value))
  }
  const uploadImage = async (files: FileList | readonly File[] | undefined) => {
    if (!files || files.length !== 1) {
      if (files && files.length > 0) setImageError(text.invalidImage)
      return
    }
    const file = files[0]
    if (!file || !isImageFile(file)) {
      setImageError(text.invalidImage)
      return
    }
    if (!resolvedImageLibrary?.onUpload || locked) {
      setImageError(text.uploadUnavailable)
      return
    }
    setImageBusy(true)
    setImageError(null)
    try {
      const option = await resolvedImageLibrary.onUpload(file)
      if (option) applyImage(option)
    }
    catch {
      setImageError(text.uploadFailed)
    }
    finally {
      setImageBusy(false)
    }
  }
  const browseImages = () => {
    setImageError(null)
    if (resolvedImageLibrary?.images !== undefined) {
      setImagePage(0)
      setImageView('library')
      return
    }
    if (resolvedImageLibrary?.onBrowse) {
      void resolvedImageLibrary.onBrowse()
        .then((option) => {
          if (option) applyImage(option)
        })
        .catch(() => setImageError(text.imageLoadFailed))
      return
    }
    setImagePage(0)
    setImageView('library')
  }
  const currentAngle = gradientPaint ? gradientAngle(gradientPaint) : 0
  const currentImage = value.kind === 'image'
    ? allKnownImages.find((option) => option.asset.providerId === value.asset.providerId && option.asset.assetKey === value.asset.assetKey)
    : undefined
  const dialAngleAtPointer = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect()
    return normalizeGradientAngle(Math.atan2(
      event.clientY - (bounds.top + bounds.height / 2),
      event.clientX - (bounds.left + bounds.width / 2),
    ) * 180 / Math.PI)
  }
  const onDialPointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!gradientPaint || gradientPaint.kind === 'radial-gradient') return
    event.preventDefault()
    event.currentTarget.setPointerCapture?.(event.pointerId)
    const initial = gradientPaintWithAngle(gradientPaint, dialAngleAtPointer(event))
    startGradientGesture(event.pointerId, gradientPaint, initial)
  }
  const onDialPointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.buttons === 0) return
    const angle = dialAngleAtPointer(event)
    previewGradientGesture(event.pointerId, (source) => gradientPaintWithAngle(source, angle))
  }
  const onDialPointerUp = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const angle = dialAngleAtPointer(event)
    previewGradientGesture(event.pointerId, (source) => gradientPaintWithAngle(source, angle))
    commitGradientGesture(event.pointerId)
  }
  const onDialKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (!gradientPaint || gradientPaint.kind === 'radial-gradient') return
    let next: number | null = null
    if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = 359
    else if (event.key === 'ArrowRight' || event.key === 'ArrowUp') {
      next = currentAngle + (event.shiftKey ? 15 : 1)
    }
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') {
      next = currentAngle - (event.shiftKey ? 15 : 1)
    }
    if (next === null) return
    event.preventDefault()
    updateAngle(next)
  }
  const previewPointAtPointer = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const bounds = event.currentTarget.parentElement?.getBoundingClientRect()
    if (!bounds || bounds.width === 0 || bounds.height === 0) return null
    return {
      x: Math.min(1, Math.max(0, (((event.clientX - bounds.left) / bounds.width) * 100 - 4) / 92)),
      y: Math.min(1, Math.max(0, (((event.clientY - bounds.top) / bounds.height) * 100 - 7) / 86)),
    }
  }
  const onGeometryPointerDown = (
    event: ReactPointerEvent<HTMLButtonElement>,
    handle: GradientGeometryHandle,
  ) => {
    if (!gradientPaint) return
    const point = previewPointAtPointer(event)
    if (!point) return
    event.preventDefault()
    event.stopPropagation()
    event.currentTarget.setPointerCapture?.(event.pointerId)
    startGradientGesture(
      event.pointerId,
      gradientPaint,
      updateGradientGeometry(gradientPaint, handle, point),
    )
  }
  const onGeometryPointerMove = (
    event: ReactPointerEvent<HTMLButtonElement>,
    handle: GradientGeometryHandle,
  ) => {
    if (event.buttons === 0) return
    const point = previewPointAtPointer(event)
    if (!point) return
    previewGradientGesture(
      event.pointerId,
      (source) => updateGradientGeometry(source, handle, point),
    )
  }
  const onGeometryPointerUp = (
    event: ReactPointerEvent<HTMLButtonElement>,
    handle: GradientGeometryHandle,
  ) => {
    const point = previewPointAtPointer(event)
    if (point) {
      previewGradientGesture(
        event.pointerId,
        (source) => updateGradientGeometry(source, handle, point),
      )
    }
    commitGradientGesture(event.pointerId)
  }
  const onGeometryKeyDown = (
    event: ReactKeyboardEvent<HTMLButtonElement>,
    handle: GradientGeometryHandle,
  ) => {
    if (!gradientPaint) return
    const step = event.shiftKey ? 0.1 : 0.01
    const delta = event.key === 'ArrowRight' ? { x: step, y: 0 }
      : event.key === 'ArrowLeft' ? { x: -step, y: 0 }
        : event.key === 'ArrowDown' ? { x: 0, y: step }
          : event.key === 'ArrowUp' ? { x: 0, y: -step }
            : null
    if (!delta) return
    event.preventDefault()
    const point = gradientGeometryPoint(gradientPaint, handle)
    emit(updateGradientGeometry(gradientPaint, handle, {
      x: point.x + delta.x,
      y: point.y + delta.y,
    }))
  }
  const updateGradientPercent = (
    update: (paint: ComposeGradientPaint, value: number) => ComposeGradientPaint,
    rawValue: string,
  ) => {
    if (!gradientPaint) return
    const numeric = Number(rawValue)
    if (!Number.isFinite(numeric)) return
    emit(update(gradientPaint, Math.min(1, Math.max(0, numeric / 100))))
  }
  const geometryHandles: readonly {
    readonly handle: GradientGeometryHandle
    readonly label: string
    readonly point: { readonly x: number; readonly y: number }
  }[] = !gradientPaint ? [] : gradientPaint.kind === 'linear-gradient'
    ? [
        { handle: 'linear-start', label: text.linearStart, point: gradientPaint.start },
        { handle: 'linear-end', label: text.linearEnd, point: gradientPaint.end },
      ]
    : gradientPaint.kind === 'radial-gradient'
      ? [
          { handle: 'radial-center', label: text.radialCenter, point: gradientPaint.center },
          { handle: 'radial-radius-x', label: text.radialRadiusX, point: gradientGeometryPoint(gradientPaint, 'radial-radius-x') },
          { handle: 'radial-radius-y', label: text.radialRadiusY, point: gradientGeometryPoint(gradientPaint, 'radial-radius-y') },
        ]
      : [
          { handle: 'angular-center', label: text.angularCenter, point: gradientPaint.center },
          { handle: 'angular-arm', label: text.angularArm, point: gradientGeometryPoint(gradientPaint, 'angular-arm') },
        ]
  return (
    <PopoverPrimitive.Root modal={false} open={open} onOpenChange={handleOpenChange}>
      <PopoverPrimitive.Trigger aria-label={title} className="compose-color-picker__trigger compose-paint-picker__trigger" disabled={locked} type="button">
        <span aria-hidden="true" className="compose-color-picker__swatch" style={paintStyle(value)} />
      </PopoverPrimitive.Trigger>
      {!locked ? (
        <PaintPopover label={title}>
          <div className="compose-paint-picker" ref={pickerRef}>
            <div className="compose-paint-picker__topbar">
              <div aria-label={text.dialog} className="compose-paint-picker__types" role="group">
                {mainTabs.map(([kind, name]) => <button aria-pressed={tab === kind} key={kind} type="button" onClick={() => selectMainTab(kind)}>{name}</button>)}
              </div>
              <PopoverPrimitive.Close aria-label={text.close} className="compose-paint-picker__close">×</PopoverPrimitive.Close>
            </div>
            {tab === 'solid' ? <ComposeColorPicker embedded label={text.solid} value={activeColor} onEyedropperFallback={onEyedropperFallback} onValueChange={updateCurrentStop} /> : null}
            {tab === 'gradient' ? <>
              <div aria-label={text.gradient} className="compose-paint-picker__gradient-types" role="group">
                {gradientTabs.map(([kind, name]) => <button aria-pressed={gradientPaint?.kind === kind} key={kind} type="button" onClick={() => selectKind(kind)}>{name}</button>)}
              </div>
              {gradientPaint ? <>
                <div className="compose-paint-picker__gradient-preview" style={paintStyle(gradientPaint)}>
                  <svg aria-hidden="true" preserveAspectRatio="none" viewBox="0 0 100 100">
                    {gradientPaint.kind === 'linear-gradient' ? (
                      <line
                        x1={previewX(gradientPaint.start.x)}
                        x2={previewX(gradientPaint.end.x)}
                        y1={previewY(gradientPaint.start.y)}
                        y2={previewY(gradientPaint.end.y)}
                      />
                    ) : null}
                    {gradientPaint.kind === 'radial-gradient' ? <>
                      <ellipse
                        cx={previewX(gradientPaint.center.x)}
                        cy={previewY(gradientPaint.center.y)}
                        rx={gradientPaint.radiusX * 92}
                        ry={gradientPaint.radiusY * 86}
                      />
                      <line
                        x1={previewX(gradientPaint.center.x)}
                        x2={previewX(gradientPaint.center.x + gradientPaint.radiusX)}
                        y1={previewY(gradientPaint.center.y)}
                        y2={previewY(gradientPaint.center.y)}
                      />
                      <line
                        x1={previewX(gradientPaint.center.x)}
                        x2={previewX(gradientPaint.center.x)}
                        y1={previewY(gradientPaint.center.y)}
                        y2={previewY(gradientPaint.center.y + gradientPaint.radiusY)}
                      />
                    </> : null}
                    {gradientPaint.kind === 'angular-gradient' ? (
                      <line
                        x1={previewX(gradientPaint.center.x)}
                        x2={previewX(geometryHandles[1]!.point.x)}
                        y1={previewY(gradientPaint.center.y)}
                        y2={previewY(geometryHandles[1]!.point.y)}
                      />
                    ) : null}
                  </svg>
                  {geometryHandles.map(({ handle, label: handleLabel, point }) => (
                    <button
                      aria-label={handleLabel}
                      aria-valuemax={100}
                      aria-valuemin={0}
                      aria-valuenow={Math.round(point.x * 100)}
                      aria-valuetext={`${Math.round(point.x * 100)}%, ${Math.round(point.y * 100)}%`}
                      className="compose-paint-picker__geometry-handle"
                      key={handle}
                      role="slider"
                      style={{ left: `${previewX(point.x)}%`, top: `${previewY(point.y)}%` }}
                      type="button"
                      onKeyDown={(event) => onGeometryKeyDown(event, handle)}
                      onLostPointerCapture={cancelGradientGesture}
                      onPointerCancel={cancelGradientGesture}
                      onPointerDown={(event) => onGeometryPointerDown(event, handle)}
                      onPointerMove={(event) => onGeometryPointerMove(event, handle)}
                      onPointerUp={(event) => onGeometryPointerUp(event, handle)}
                    />
                  ))}
                </div>
                <div aria-label={text.track} className="compose-paint-picker__track" role="group" style={paintStyle(gradientPaint)} onDoubleClick={addStopAt}>
                  {gradientPaint.stops.map((stop) => (
                    <button
                      aria-label={`${Math.round(stop.position * 100)}%`}
                      aria-pressed={stop.id === selectedStop?.id}
                      className="compose-paint-picker__stop"
                      data-stop-id={stop.id}
                      key={stop.id}
                      style={{ left: `${stop.position * 100}%`, background: stop.color }}
                      type="button"
                      onClick={() => setSelectedStopId(stop.id)}
                      onKeyDown={(event) => onStopKeyDown(event, stop)}
                      onLostPointerCapture={cancelGradientGesture}
                      onPointerCancel={cancelGradientGesture}
                      onPointerDown={(event) => {
                        event.stopPropagation()
                        setSelectedStopId(stop.id)
                        event.currentTarget.setPointerCapture?.(event.pointerId)
                        startGradientGesture(event.pointerId, gradientPaint)
                      }}
                      onPointerMove={(event) => {
                        if (event.buttons === 0) return
                        const bounds = event.currentTarget.parentElement?.getBoundingClientRect()
                        if (!bounds || bounds.width === 0) return
                        const position = (event.clientX - bounds.left) / bounds.width
                        previewGradientGesture(
                          event.pointerId,
                          (source) => moveGradientStop(source, stop.id, position),
                        )
                      }}
                      onPointerUp={(event) => commitGradientGesture(event.pointerId)}
                    />
                  ))}
                </div>
                <button className="compose-paint-picker__add-stop" disabled={gradientPaint.stops.length >= 8} type="button" onClick={addStop}>＋ {text.addStop}</button>
                <div className="compose-paint-picker__gradient-cards">
                  <section className="compose-paint-picker__card">
                    <strong>{text.stop}</strong>
                    <div className="compose-paint-picker__stop-fields">
                      <input aria-label={text.stop} className="compose-paint-picker__native-color" type="color" value={activeColor === 'transparent' ? '#000000' : activeColor.slice(0, 7)} onChange={(event) => updateActiveColorText(event.target.value)} />
                      <input aria-label="HEX" key={activeColor} defaultValue={activeColor === 'transparent' ? '#000000' : activeColor.slice(0, 7).toUpperCase()} onBlur={(event) => updateActiveColorText(event.target.value)} />
                      <button aria-label={text.deleteStop} disabled={gradientPaint.stops.length <= 2} type="button" onClick={deleteSelectedStop}>⌫</button>
                    </div>
                    <label>{text.opacity}<span><input aria-label={text.opacity} max="100" min="0" type="range" value={Math.round(parseComposeEditableColor(activeColor).alpha * 100)} onChange={(event) => updateCurrentStop(composeColorWithAlpha(activeColor, Number(event.target.value) / 100))} /><output>{Math.round(parseComposeEditableColor(activeColor).alpha * 100)}%</output></span></label>
                  </section>
                  {gradientPaint.kind === 'radial-gradient' ? (
                    <section className="compose-paint-picker__card compose-paint-picker__radial">
                      <strong>{text.centerRadius}</strong>
                      <div className="compose-paint-picker__radial-grid">
                        {([
                          [text.centerX, gradientPaint.center.x, (paint: ComposeGradientPaint, numeric: number) => paint.kind === 'radial-gradient' ? { ...paint, center: { ...paint.center, x: numeric } } : paint],
                          [text.centerY, gradientPaint.center.y, (paint: ComposeGradientPaint, numeric: number) => paint.kind === 'radial-gradient' ? { ...paint, center: { ...paint.center, y: numeric } } : paint],
                          [text.radiusX, gradientPaint.radiusX, (paint: ComposeGradientPaint, numeric: number) => paint.kind === 'radial-gradient' ? { ...paint, radiusX: Math.max(0.01, numeric) } : paint],
                          [text.radiusY, gradientPaint.radiusY, (paint: ComposeGradientPaint, numeric: number) => paint.kind === 'radial-gradient' ? { ...paint, radiusY: Math.max(0.01, numeric) } : paint],
                        ] as const).map(([fieldLabel, fieldValue, update]) => (
                          <label key={fieldLabel}>
                            <span>{fieldLabel}</span>
                            <span><input aria-label={fieldLabel} max="100" min="0" type="number" value={Math.round(fieldValue * 100)} onChange={(event) => updateGradientPercent(update, event.target.value)} /><i>%</i></span>
                          </label>
                        ))}
                      </div>
                    </section>
                  ) : (
                    <section className="compose-paint-picker__card compose-paint-picker__direction">
                      <strong>{text.direction}</strong>
                      <div className="compose-paint-picker__direction-content">
                        <button
                          aria-label={text.directionAngle}
                          aria-valuemax={359}
                          aria-valuemin={0}
                          aria-valuenow={Math.round(currentAngle)}
                          aria-valuetext={`${Math.round(currentAngle)}°`}
                          className="compose-paint-picker__dial"
                          role="slider"
                          style={{ '--compose-paint-angle': `${currentAngle}deg` } as CSSProperties}
                          type="button"
                          onKeyDown={onDialKeyDown}
                          onLostPointerCapture={cancelGradientGesture}
                          onPointerCancel={cancelGradientGesture}
                          onPointerDown={onDialPointerDown}
                          onPointerMove={onDialPointerMove}
                          onPointerUp={onDialPointerUp}
                        ><span /></button>
                        <div><label><input aria-label={text.angle} max="359" min="0" type="number" value={Math.round(currentAngle)} onChange={(event) => updateAngle(Number(event.target.value))} />°</label><div className="compose-paint-picker__direction-grid">{([[45, '↗'], [135, '↖'], [225, '↙'], [315, '↘']] as const).map(([angle, icon]) => <button aria-label={`${angle}°`} aria-pressed={Math.round(currentAngle) === angle} key={angle} type="button" onClick={() => updateAngle(angle)}>{icon}</button>)}</div></div>
                      </div>
                    </section>
                  )}
                </div>
                <section className="compose-paint-picker__presets"><strong>{text.presets}</strong><div>{GRADIENT_PRESETS.map((preset, index) => <button aria-label={`${text.presets} ${index + 1}`} key={index} style={paintStyle(preset)} type="button" onClick={() => { cancelGradientGesture(); setSelectedStopId(preset.stops[0]?.id ?? null); emit(preset) }} />)}</div></section>
              </> : null}
            </> : null}
            {tab === 'image' && imageView === 'main' ? (
              <section aria-label={text.image} className="compose-paint-picker__image">
                <label
                  aria-disabled={!resolvedImageLibrary?.onUpload || locked || imageBusy}
                  className="compose-paint-picker__dropzone"
                  data-disabled={!resolvedImageLibrary?.onUpload || locked || imageBusy || undefined}
                  style={currentImage ? { backgroundImage: `linear-gradient(rgb(20 24 31 / 55%), rgb(20 24 31 / 55%)), url(${currentImage.previewUrl})` } : undefined}
                  onDragOver={(event) => {
                    if (resolvedImageLibrary?.onUpload && !locked) event.preventDefault()
                  }}
                  onDrop={(event) => {
                    event.preventDefault()
                    void uploadImage(event.dataTransfer.files)
                  }}
                >
                  <span aria-hidden="true" className="compose-paint-picker__upload-icon">
                    <svg fill="none" viewBox="0 0 36 30">
                      <rect height="26" rx="6" stroke="currentColor" strokeWidth="2" width="32" x="1" y="1" />
                      <circle cx="10" cy="9" fill="currentColor" r="2" />
                      <path d="m6 22 7-7 5 5 4-4 6 6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                    </svg>
                    <i>↑</i>
                  </span>
                  <strong>{resolvedImageLibrary?.onUpload ? text.dropHint : text.uploadUnavailable}</strong>
                  <span>{imageBusy ? text.uploading : text.upload}</span>
                  <input
                    accept="image/*"
                    aria-label={text.upload}
                    disabled={!resolvedImageLibrary?.onUpload || locked || imageBusy}
                    type="file"
                    onChange={(event) => {
                      void uploadImage(event.currentTarget.files ?? undefined)
                      event.currentTarget.value = ''
                    }}
                  />
                </label>
                {imageError ? <p className="compose-paint-picker__image-message" role="alert">{imageError}</p> : null}
                <div className="compose-paint-picker__image-columns">
                  <section className="compose-paint-picker__card"><strong>{text.recentImages}</strong>
                    <div aria-label={text.recentImages} className="compose-paint-picker__image-recent">
                      {recentImages.map((option) => (
                        <button
                          aria-label={option.label}
                          aria-pressed={value.kind === 'image' && imageOptionKey(option) === `${value.asset.providerId}:${value.asset.assetKey}`}
                          key={imageOptionKey(option)}
                          style={{ backgroundImage: `url(${option.previewUrl})` }}
                          type="button"
                          onClick={() => applyImage(option)}
                        />
                      ))}
                      <button aria-label={text.browse} className="compose-paint-picker__image-add" type="button" onClick={browseImages}>＋<small>{text.addImage}</small></button>
                    </div>
                  </section>
                  <section className="compose-paint-picker__card compose-paint-picker__image-settings"><strong>{text.fit}</strong>
                    <div aria-label={text.fit} className="compose-paint-picker__image-fit" role="group">
                      {([['cover', text.cover], ['contain', text.contain], ['stretch', text.stretch]] as const).map(([fit, name]) => (
                        <button
                          aria-pressed={value.kind === 'image' && value.fit === fit}
                          className="compose-paint-picker__image-fit-option"
                          disabled={value.kind !== 'image'}
                          key={fit}
                          type="button"
                          onClick={() => updateImage((paint) => ({ ...paint, fit: fit as ComposeImageFit }))}
                        >
                          {name}
                        </button>
                      ))}
                    </div>
                    <label className="compose-paint-picker__image-opacity">{text.opacity}<span><input aria-label={text.opacity} disabled={value.kind !== 'image'} max="100" min="0" style={{ '--compose-image-opacity': `${value.kind === 'image' ? Math.round(value.opacity * 100) : 100}%` } as CSSProperties} type="range" value={value.kind === 'image' ? Math.round(value.opacity * 100) : 100} onChange={(event) => updateImage((paint) => ({ ...paint, opacity: Number(event.target.value) / 100 }))} /><output>{value.kind === 'image' ? Math.round(value.opacity * 100) : 100}%</output></span></label>
                    <label className="compose-paint-picker__overlay-toggle"><span>{text.overlay}</span><input aria-label={text.overlay} checked={value.kind === 'image' && value.overlay !== null} disabled={value.kind !== 'image'} type="checkbox" onChange={(event) => updateImage((paint) => ({ ...paint, overlay: event.target.checked ? { color: '#8b5cf6', opacity: 0.4 } : null }))} /></label>
                    {value.kind === 'image' && value.overlay ? <div className="compose-paint-picker__overlay-fields">
                      <label className="compose-paint-picker__overlay-color">
                        <input aria-label={`${text.overlay} ${text.stop}`} type="color" value={value.overlay.color === 'transparent' ? '#000000' : value.overlay.color.slice(0, 7)} onChange={(event) => updateImage((paint) => ({ ...paint, overlay: paint.overlay ? { ...paint.overlay, color: event.target.value as ComposeColor } : null }))} />
                        <span
                          aria-hidden="true"
                          className="compose-paint-picker__overlay-swatch"
                          data-transparent={value.overlay.color === 'transparent' || undefined}
                          style={value.overlay.color === 'transparent' ? undefined : { background: value.overlay.color }}
                        />
                        <span aria-hidden="true" className="compose-paint-picker__overlay-chevron">⌄</span>
                      </label>
                      <input aria-label={`${text.overlay} HEX`} key={value.overlay.color} defaultValue={value.overlay.color.toUpperCase()} type="text" onBlur={(event) => {
                        const color = normalizeComposeColor(event.target.value)
                        if (color) updateImage((paint) => ({ ...paint, overlay: paint.overlay ? { ...paint.overlay, color } : null }))
                      }} />
                      <span aria-hidden="true" className="compose-paint-picker__overlay-alpha" />
                      <label className="compose-paint-picker__overlay-opacity"><input aria-label={`${text.overlay} ${text.opacity}`} max="100" min="0" type="number" value={Math.round(value.overlay.opacity * 100)} onChange={(event) => {
                        const opacity = Math.min(100, Math.max(0, Number(event.target.value)))
                        if (Number.isFinite(opacity)) updateImage((paint) => ({ ...paint, overlay: paint.overlay ? { ...paint.overlay, opacity: opacity / 100 } : null }))
                      }} /><span aria-hidden="true">%</span></label>
                    </div> : null}
                  </section>
                </div>
                <section className="compose-paint-picker__common"><strong>{text.common}</strong><div>{COMPOSE_COMMON_COLORS.map((color) => <button aria-label={color} data-transparent={color === 'transparent' || undefined} key={color} style={color === 'transparent' ? undefined : { background: color }} type="button" onClick={() => updateImage((paint) => ({ ...paint, overlay: color === 'transparent' ? null : { color, opacity: paint.overlay?.opacity ?? 0.4 } }))} />)}</div></section>
              </section>
            ) : null}
            {tab === 'image' && imageView === 'library' ? (
              <section aria-label={text.imageLibrary} className="compose-paint-picker__image-library">
                <header>
                  <button aria-label={text.back} type="button" onClick={() => setImageView('main')}>‹</button>
                  <h2>{text.imageLibrary}</h2>
                  <span>{resolvedImagePage + 1}/{imagePageCount}</span>
                </header>
                {resolvedImageLibrary?.status === 'loading' || resolvedImageLibrary?.status === 'idle'
                  ? <p className="compose-paint-picker__image-state" role="status">{text.imageLoading}</p>
                  : null}
                {resolvedImageLibrary?.status === 'error' ? (
                  <div className="compose-paint-picker__image-state">
                    <p role="alert">{text.imageLoadFailed}</p>
                    <button type="button" onClick={() => resolvedImageLibrary.onRetry?.()}>{text.retry}</button>
                  </div>
                ) : null}
                {resolvedImageLibrary?.status === 'unsupported' || !resolvedImageLibrary ? (
                  <p className="compose-paint-picker__image-state" role="status">{text.imageUnsupported}</p>
                ) : null}
                {(resolvedImageLibrary?.status === undefined || resolvedImageLibrary.status === 'ready') && visibleLibraryImages.length === 0 ? (
                  <p className="compose-paint-picker__image-state" role="status">{text.imageEmpty}</p>
                ) : null}
                {visibleLibraryImages.length > 0 ? (
                  <div aria-label={text.imageLibrary} className="compose-paint-picker__image-grid" role="group">
                    {visibleLibraryImages.map((option) => (
                      <button
                        aria-label={option.label}
                        aria-pressed={value.kind === 'image' && imageOptionKey(option) === `${value.asset.providerId}:${value.asset.assetKey}`}
                        key={imageOptionKey(option)}
                        type="button"
                        onClick={() => applyImage(option)}
                      >
                        <span style={{ backgroundImage: `url(${option.previewUrl})` }} />
                        <small>{option.label}</small>
                      </button>
                    ))}
                  </div>
                ) : null}
                <nav aria-label={text.imageLibrary}>
                  <button aria-label={text.previousPage} disabled={resolvedImagePage === 0} type="button" onClick={() => setImagePage(Math.max(0, resolvedImagePage - 1))}>‹</button>
                  <span>{resolvedImagePage + 1} / {imagePageCount}</span>
                  <button aria-label={text.nextPage} disabled={resolvedImagePage + 1 >= imagePageCount} type="button" onClick={() => setImagePage(Math.min(imagePageCount - 1, resolvedImagePage + 1))}>›</button>
                </nav>
              </section>
            ) : null}
            {tab !== 'image' || imageView === 'main' ? <details className="compose-paint-picker__advanced">
              <summary>{text.advanced}</summary>
              {tab === 'gradient' && gradientPaint && selectedStop ? (
                <div className="compose-paint-picker__advanced-grid">
                  <label><span>{text.position}</span><span><input aria-label={text.position} max="100" min="0" step="0.1" type="number" value={Math.round(selectedStop.position * 1000) / 10} onChange={(event) => updateGradientPercent((paint, position) => moveGradientStop(paint, selectedStop.id, position), event.target.value)} /><i>%</i></span></label>
                  {gradientPaint.kind === 'linear-gradient' ? ([
                    [text.startX, gradientPaint.start.x, (paint: ComposeGradientPaint, numeric: number) => paint.kind === 'linear-gradient' ? { ...paint, start: { ...paint.start, x: numeric } } : paint],
                    [text.startY, gradientPaint.start.y, (paint: ComposeGradientPaint, numeric: number) => paint.kind === 'linear-gradient' ? { ...paint, start: { ...paint.start, y: numeric } } : paint],
                    [text.endX, gradientPaint.end.x, (paint: ComposeGradientPaint, numeric: number) => paint.kind === 'linear-gradient' ? { ...paint, end: { ...paint.end, x: numeric } } : paint],
                    [text.endY, gradientPaint.end.y, (paint: ComposeGradientPaint, numeric: number) => paint.kind === 'linear-gradient' ? { ...paint, end: { ...paint.end, y: numeric } } : paint],
                  ] as const).map(([fieldLabel, fieldValue, update]) => (
                    <label key={fieldLabel}><span>{fieldLabel}</span><span><input aria-label={fieldLabel} max="100" min="0" step="0.1" type="number" value={Math.round(fieldValue * 1000) / 10} onChange={(event) => updateGradientPercent(update, event.target.value)} /><i>%</i></span></label>
                  )) : null}
                  {gradientPaint.kind === 'angular-gradient' ? ([
                    [text.centerX, gradientPaint.center.x, (paint: ComposeGradientPaint, numeric: number) => paint.kind === 'angular-gradient' ? { ...paint, center: { ...paint.center, x: numeric } } : paint],
                    [text.centerY, gradientPaint.center.y, (paint: ComposeGradientPaint, numeric: number) => paint.kind === 'angular-gradient' ? { ...paint, center: { ...paint.center, y: numeric } } : paint],
                  ] as const).map(([fieldLabel, fieldValue, update]) => (
                    <label key={fieldLabel}><span>{fieldLabel}</span><span><input aria-label={fieldLabel} max="100" min="0" step="0.1" type="number" value={Math.round(fieldValue * 1000) / 10} onChange={(event) => updateGradientPercent(update, event.target.value)} /><i>%</i></span></label>
                  )) : null}
                </div>
              ) : null}
            </details> : null}
          </div>
        </PaintPopover>
      ) : null}
    </PopoverPrimitive.Root>
  )
}
