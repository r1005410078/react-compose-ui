import type { JsonObject } from './document-types'

/** 可持久化的纯色。`transparent` 等同于完全透明黑色。 @public */
export type ComposeColor = 'transparent' | `#${string}`

/** Entity 未旋转局部边界中的归一化坐标。 @public */
export interface ComposePaintPoint extends JsonObject {
  readonly x: number
  readonly y: number
}

/** 渐变轨道上的一个稳定色标。 @public */
export interface ComposeGradientStop extends JsonObject {
  readonly id: string
  readonly position: number
  readonly color: ComposeColor
}

/** 可序列化的实体背景填充。 @public */
export type ComposePaint =
  | ComposeSolidPaint
  | ComposeLinearGradientPaint
  | ComposeRadialGradientPaint
  | ComposeAngularGradientPaint
  | ComposeImagePaint

/** 单色填充。 @public */
export interface ComposeSolidPaint extends JsonObject {
  readonly kind: 'solid'
  readonly color: ComposeColor
}

/** 以局部归一化端点定义的线性渐变。 @public */
export interface ComposeLinearGradientPaint extends JsonObject {
  readonly kind: 'linear-gradient'
  readonly start: ComposePaintPoint
  readonly end: ComposePaintPoint
  readonly stops: readonly ComposeGradientStop[]
}

/** 以局部归一化中心和椭圆半径定义的径向渐变。 @public */
export interface ComposeRadialGradientPaint extends JsonObject {
  readonly kind: 'radial-gradient'
  readonly center: ComposePaintPoint
  readonly radiusX: number
  readonly radiusY: number
  readonly stops: readonly ComposeGradientStop[]
}

/** 以局部归一化中心和角度定义的角向渐变。 @public */
export interface ComposeAngularGradientPaint extends JsonObject {
  readonly kind: 'angular-gradient'
  readonly center: ComposePaintPoint
  readonly angle: number
  readonly stops: readonly ComposeGradientStop[]
}

/** 图片 Paint 写入文档时使用的稳定资源引用。 @public */
export interface ComposePaintImageAsset extends JsonObject {
  readonly providerId: string
  readonly assetKey: string
  readonly scope: 'persistent' | 'session'
}

/** 图片背景的显示模式。 @public */
export type ComposeImageFit = 'cover' | 'contain' | 'stretch'

/** 图片上的可选纯色叠加层。 @public */
export interface ComposeImagePaintOverlay extends JsonObject {
  readonly color: ComposeColor
  readonly opacity: number
}

/** 通过稳定资源引用渲染的图片填充。 @public */
export interface ComposeImagePaint extends JsonObject {
  readonly kind: 'image'
  readonly asset: ComposePaintImageAsset
  readonly fit: ComposeImageFit
  readonly opacity: number
  readonly overlay: ComposeImagePaintOverlay | null
}

/** 所有 Entity 缺失 Appearance 或 backgroundPaint 时的稳定解析值。 @public */
export const DEFAULT_COMPOSE_BACKGROUND_PAINT: ComposeSolidPaint = {
  kind: 'solid',
  color: 'transparent',
}

/** 供渲染适配器安全消费的纯数据 Paint 描述。 @public */
export type ComposePaintRenderDescriptor =
  | { readonly kind: 'solid'; readonly color: ComposeColor }
  | {
      readonly kind: 'linear-gradient'
      readonly start: ComposePaintPoint
      readonly end: ComposePaintPoint
      readonly stops: readonly ComposeGradientStop[]
    }
  | {
      readonly kind: 'radial-gradient'
      readonly center: ComposePaintPoint
      readonly radiusX: number
      readonly radiusY: number
      readonly stops: readonly ComposeGradientStop[]
    }
  | {
      readonly kind: 'angular-gradient'
      readonly center: ComposePaintPoint
      readonly angle: number
      readonly stops: readonly ComposeGradientStop[]
    }
  | {
      readonly kind: 'image'
      readonly asset: ComposePaintImageAsset
      readonly fit: ComposeImageFit
      readonly opacity: number
      readonly overlay: ComposeImagePaintOverlay | null
    }

type Rgba = {
  readonly red: number
  readonly green: number
  readonly blue: number
  readonly alpha: number
}

type UnknownRecord = Record<string, unknown>

function isRecord(value: unknown): value is UnknownRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function finite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function clamp(value: number, minimum = 0, maximum = 1): number {
  return Math.min(maximum, Math.max(minimum, value))
}

function normalizeAngle(angle: number): number {
  const normalized = angle % 360
  return normalized < 0 ? normalized + 360 : normalized
}

function expandHex(value: string): string | null {
  const compact = /^#([\da-f]{3,4})$/i.exec(value)
  if (compact) return compact[1].split('').map((channel) => channel.repeat(2)).join('').toLowerCase()
  const full = /^#([\da-f]{6}|[\da-f]{8})$/i.exec(value)
  return full ? full[1].toLowerCase() : null
}

function rgbaFromColor(color: ComposeColor): Rgba {
  if (color === 'transparent') return { red: 0, green: 0, blue: 0, alpha: 0 }
  const hex = expandHex(color)
  // `ComposeColor` 只能由本模块的校验与构造函数产生；这里仍保留保护分支以便宿主输入不会崩溃。
  if (!hex) return { red: 0, green: 0, blue: 0, alpha: 0 }
  return {
    red: Number.parseInt(hex.slice(0, 2), 16),
    green: Number.parseInt(hex.slice(2, 4), 16),
    blue: Number.parseInt(hex.slice(4, 6), 16),
    alpha: hex.length === 8 ? Number.parseInt(hex.slice(6, 8), 16) / 255 : 1,
  }
}

function colorFromRgba({ red, green, blue, alpha }: Rgba): ComposeColor {
  const channel = (value: number) => Math.round(clamp(value / 255) * 255)
    .toString(16)
    .padStart(2, '0')
  const normalizedAlpha = clamp(alpha)
  if (normalizedAlpha === 0) return 'transparent'
  const rgb = `#${channel(red)}${channel(green)}${channel(blue)}` as ComposeColor
  return normalizedAlpha === 1
    ? rgb
    : `${rgb}${Math.round(normalizedAlpha * 255).toString(16).padStart(2, '0')}` as ComposeColor
}

function sameKeys(value: UnknownRecord, keys: readonly string[]): boolean {
  const actual = Object.keys(value)
  return actual.length === keys.length && actual.every((key) => keys.includes(key))
}

function isCanonicalPoint(value: unknown): value is ComposePaintPoint {
  return isRecord(value)
    && sameKeys(value, ['x', 'y'])
    && finite(value.x)
    && finite(value.y)
}

function isCanonicalStops(value: unknown): value is readonly ComposeGradientStop[] {
  if (!Array.isArray(value) || value.length < 2 || value.length > 8) return false
  const ids = new Set<string>()
  return value.every((stop) => {
    if (!isRecord(stop) || !sameKeys(stop, ['id', 'position', 'color'])) return false
    if (typeof stop.id !== 'string' || stop.id.trim().length === 0 || ids.has(stop.id)) return false
    ids.add(stop.id)
    return finite(stop.position)
      && stop.position >= 0
      && stop.position <= 1
      && isComposeColor(stop.color)
  })
}

function normalizePoint(value: unknown): ComposePaintPoint | null {
  if (!isRecord(value) || !finite(value.x) || !finite(value.y)) return null
  return { x: value.x, y: value.y }
}

function normalizeStops(value: unknown): readonly ComposeGradientStop[] | null {
  if (!Array.isArray(value) || value.length < 2 || value.length > 8) return null
  const ids = new Set<string>()
  const stops: ComposeGradientStop[] = []
  for (const candidate of value) {
    if (!isRecord(candidate) || typeof candidate.id !== 'string' || candidate.id.trim().length === 0) {
      return null
    }
    if (ids.has(candidate.id) || !finite(candidate.position) || candidate.position < 0 || candidate.position > 1) {
      return null
    }
    const color = normalizeComposeColor(candidate.color)
    if (!color) return null
    ids.add(candidate.id)
    stops.push({ id: candidate.id, position: candidate.position, color })
  }
  // 保持文档序列化稳定且给渲染端单调色标；同位置时以 ID 作为确定性次序。
  return stops.sort((left, right) => left.position - right.position || left.id.localeCompare(right.id))
}

function normalizeImageAsset(value: unknown): ComposePaintImageAsset | null {
  if (!isRecord(value)
    || !sameKeys(value, ['providerId', 'assetKey', 'scope'])
    || typeof value.providerId !== 'string' || value.providerId.trim().length === 0
    || typeof value.assetKey !== 'string' || value.assetKey.trim().length === 0
    || (value.scope !== 'persistent' && value.scope !== 'session')) return null
  return { providerId: value.providerId, assetKey: value.assetKey, scope: value.scope }
}

function normalizeImageOverlay(value: unknown): ComposeImagePaintOverlay | null | undefined {
  if (value === null) return null
  if (!isRecord(value) || !sameKeys(value, ['color', 'opacity'])) return undefined
  const color = normalizeComposeColor(value.color)
  if (!color || !finite(value.opacity) || value.opacity < 0 || value.opacity > 1) return undefined
  return { color, opacity: value.opacity }
}

/** 将支持的 CSS HEX/transparent 输入规范化为文档颜色。 @public */
export function normalizeComposeColor(value: unknown): ComposeColor | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (trimmed === 'transparent') return 'transparent'
  const hex = expandHex(trimmed)
  if (!hex) return null
  const alpha = hex.length === 8 ? Number.parseInt(hex.slice(6, 8), 16) : 255
  if (alpha === 0) return 'transparent'
  return `#${hex}`
}

/** 判断值是否已经是可持久化的规范颜色。 @public */
export function isComposeColor(value: unknown): value is ComposeColor {
  return typeof value === 'string'
    && normalizeComposeColor(value) === value
}

/** 规范化未知输入为可持久化 Paint；非法输入返回 null。 @public */
export function normalizeComposePaint(value: unknown): ComposePaint | null {
  if (!isRecord(value) || typeof value.kind !== 'string') return null
  if (value.kind === 'solid') {
    const color = normalizeComposeColor(value.color)
    return color ? { kind: 'solid', color } : null
  }
  if (value.kind === 'image') {
    const asset = normalizeImageAsset(value.asset)
    const overlay = normalizeImageOverlay(value.overlay)
    if (!asset || overlay === undefined || !finite(value.opacity) || value.opacity < 0 || value.opacity > 1
      || (value.fit !== 'cover' && value.fit !== 'contain' && value.fit !== 'stretch')) return null
    return { kind: 'image', asset, fit: value.fit, opacity: value.opacity, overlay }
  }
  const stops = normalizeStops(value.stops)
  if (!stops) return null
  if (value.kind === 'linear-gradient') {
    const start = normalizePoint(value.start)
    const end = normalizePoint(value.end)
    if (!start || !end || (start.x === end.x && start.y === end.y)) return null
    return { kind: 'linear-gradient', start, end, stops }
  }
  if (value.kind === 'radial-gradient') {
    const center = normalizePoint(value.center)
    if (!center || !finite(value.radiusX) || !finite(value.radiusY) || value.radiusX <= 0 || value.radiusY <= 0) {
      return null
    }
    return { kind: 'radial-gradient', center, radiusX: value.radiusX, radiusY: value.radiusY, stops }
  }
  if (value.kind === 'angular-gradient') {
    const center = normalizePoint(value.center)
    if (!center || !finite(value.angle)) return null
    return { kind: 'angular-gradient', center, angle: normalizeAngle(value.angle), stops }
  }
  return null
}

/** 判断值是否完全满足 v5 持久化 Paint 不变量。 @public */
export function isValidComposePaint(value: unknown): value is ComposePaint {
  if (!isRecord(value) || typeof value.kind !== 'string') return false
  if (value.kind === 'solid') {
    return sameKeys(value, ['kind', 'color']) && isComposeColor(value.color)
  }
  if (value.kind === 'image') {
    return sameKeys(value, ['kind', 'asset', 'fit', 'opacity', 'overlay'])
      && normalizeImageAsset(value.asset) !== null
      && (value.fit === 'cover' || value.fit === 'contain' || value.fit === 'stretch')
      && finite(value.opacity) && value.opacity >= 0 && value.opacity <= 1
      && normalizeImageOverlay(value.overlay) !== undefined
  }
  if (value.kind === 'linear-gradient') {
    return sameKeys(value, ['kind', 'start', 'end', 'stops'])
      && isCanonicalPoint(value.start)
      && isCanonicalPoint(value.end)
      && !(value.start.x === value.end.x && value.start.y === value.end.y)
      && isCanonicalStops(value.stops)
  }
  if (value.kind === 'radial-gradient') {
    return sameKeys(value, ['kind', 'center', 'radiusX', 'radiusY', 'stops'])
      && isCanonicalPoint(value.center)
      && finite(value.radiusX)
      && value.radiusX > 0
      && finite(value.radiusY)
      && value.radiusY > 0
      && isCanonicalStops(value.stops)
  }
  return value.kind === 'angular-gradient'
    && sameKeys(value, ['kind', 'center', 'angle', 'stops'])
    && isCanonicalPoint(value.center)
    && finite(value.angle)
    && value.angle >= 0
    && value.angle < 360
    && isCanonicalStops(value.stops)
}

/** 返回渲染层可直接消费、不会携带 UI 状态的 Paint 描述。 @public */
export function describeComposePaint(paint: ComposePaint): ComposePaintRenderDescriptor {
  return paint.kind === 'solid'
    ? { kind: 'solid', color: paint.color }
    : paint.kind === 'image'
      ? { kind: 'image', asset: paint.asset, fit: paint.fit, opacity: paint.opacity, overlay: paint.overlay }
    : paint.kind === 'linear-gradient'
      ? { kind: paint.kind, start: paint.start, end: paint.end, stops: paint.stops }
      : paint.kind === 'radial-gradient'
        ? {
            kind: paint.kind,
            center: paint.center,
            radiusX: paint.radiusX,
            radiusY: paint.radiusY,
            stops: paint.stops,
          }
        : { kind: paint.kind, center: paint.center, angle: paint.angle, stops: paint.stops }
}

function interpolateStops(stops: readonly ComposeGradientStop[], position: number): ComposeColor {
  const sorted = [...stops].sort((left, right) => left.position - right.position || left.id.localeCompare(right.id))
  if (position <= sorted[0]!.position) return sorted[0]!.color
  const last = sorted[sorted.length - 1]!
  if (position >= last.position) return last.color
  const rightIndex = sorted.findIndex((stop) => stop.position >= position)
  const right = sorted[rightIndex]!
  const left = sorted[rightIndex - 1]!
  const range = right.position - left.position
  const progress = range === 0 ? 1 : (position - left.position) / range
  const from = rgbaFromColor(left.color)
  const to = rgbaFromColor(right.color)
  return colorFromRgba({
    red: from.red + (to.red - from.red) * progress,
    green: from.green + (to.green - from.green) * progress,
    blue: from.blue + (to.blue - from.blue) * progress,
    alpha: from.alpha + (to.alpha - from.alpha) * progress,
  })
}

/** 在实体未旋转的归一化局部坐标中解析 Paint 的最终颜色。 @public */
export function evaluateComposePaintAtLocalPoint(
  paint: ComposePaint,
  point: ComposePaintPoint,
): ComposeColor {
  if (paint.kind === 'solid') return paint.color
  // 图片像素必须由异步 Resolver 取得；纯函数采样只给渐变色标提供确定性回退。
  if (paint.kind === 'image') return paint.overlay?.color ?? 'transparent'
  const position = paint.kind === 'linear-gradient' ? (() => {
    const x = paint.end.x - paint.start.x
    const y = paint.end.y - paint.start.y
    const distance = x * x + y * y
    return distance === 0 ? 0 : ((point.x - paint.start.x) * x + (point.y - paint.start.y) * y) / distance
  })() : paint.kind === 'radial-gradient' ? (() => {
    const x = (point.x - paint.center.x) / paint.radiusX
    const y = (point.y - paint.center.y) / paint.radiusY
    return Math.sqrt(x * x + y * y)
  })() : (() => {
    const angle = Math.atan2(point.y - paint.center.y, point.x - paint.center.x) * 180 / Math.PI
    return normalizeAngle(angle - paint.angle) / 360
  })()
  return interpolateStops(paint.stops, clamp(position))
}
