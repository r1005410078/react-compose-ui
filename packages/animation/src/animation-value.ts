import { type ComposePosition, type JsonValue, normalizeComposeColor } from '@compose-ui/core'
import type { ComposeAnimationValueKind } from './animation-types'

/** `vector2` 轨道的关键帧值。 @public */
export type ComposeAnimationVector2 = ComposePosition

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

/**
 * 判断关键帧值的形状是否与轨道声明的 `valueKind` 一致。
 *
 * @remarks
 * `vector2` 要求恰好只有 `x` 与 `y` 两个有限数字字段。多余字段会在采样时被静默丢弃，
 * 所以在校验期就拒绝，避免文档里躺着永远读不出来的数据。
 *
 * `color` 要求值已经是 core 的规范形态（`normalizeComposeColor` 的不动点）。接受简写或
 * 大小写变体会让同一个颜色在文档里出现多种写法，关键帧比较与 diff 都会失真。
 *
 * @public
 */
export function isComposeAnimationValue(
  value: unknown,
  kind: ComposeAnimationValueKind,
): value is JsonValue {
  if (kind === 'number') return isFiniteNumber(value)
  if (kind === 'color') {
    return typeof value === 'string' && normalizeComposeColor(value) === value
  }
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false
  const record = value as Record<string, unknown>
  return Object.keys(record).length === 2 && isFiniteNumber(record.x) && isFiniteNumber(record.y)
}

interface Rgba {
  readonly r: number
  readonly g: number
  readonly b: number
  readonly a: number
}

/**
 * 把规范化文档颜色解析为 0~255 的 RGBA 分量。
 *
 * @remarks
 * `transparent` 没有自己的色相，返回 `null` 表示"完全透明但色相未定"，由
 * {@link mixComposeColor} 决定从对侧端点借色。
 */
function parseColor(color: string): Rgba | null {
  if (!color.startsWith('#')) return null
  const hex = color.slice(1)
  if (hex.length !== 6 && hex.length !== 8) return null
  const channels = [
    Number.parseInt(hex.slice(0, 2), 16),
    Number.parseInt(hex.slice(2, 4), 16),
    Number.parseInt(hex.slice(4, 6), 16),
    hex.length === 8 ? Number.parseInt(hex.slice(6, 8), 16) : 255,
  ]
  if (channels.some((channel) => Number.isNaN(channel))) return null
  return { r: channels[0]!, g: channels[1]!, b: channels[2]!, a: channels[3]! }
}

function toHexChannel(value: number) {
  return Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, '0')
}

/**
 * 在两个文档颜色之间按比例混合。
 *
 * @remarks
 * 在 sRGB 分量上线性混合（含 alpha）。这会让高饱和色的过渡略微发灰，基础能力接受该偏差；
 * 将来换成 OKLab 时这里是唯一改动点。
 *
 * 任一端是 `transparent` 时从对侧借用 RGB 只改 alpha，否则红色淡出会先变黑再消失。
 *
 * @param ratio - `0` 返回 `from`，`1` 返回 `to`。
 * @public
 */
export function mixComposeColor(from: string, to: string, ratio: number): string {
  const left = parseColor(from)
  const right = parseColor(to)
  if (!left && !right) return 'transparent'
  const leftRgba = left ?? { ...(right as Rgba), a: 0 }
  const rightRgba = right ?? { ...(left as Rgba), a: 0 }
  const lerp = (a: number, b: number) => a + (b - a) * ratio
  const alpha = toHexChannel(lerp(leftRgba.a, rightRgba.a))
  const rgb = `#${toHexChannel(lerp(leftRgba.r, rightRgba.r))}`
    + `${toHexChannel(lerp(leftRgba.g, rightRgba.g))}`
    + `${toHexChannel(lerp(leftRgba.b, rightRgba.b))}`
  // `normalizeComposeColor` 原样保留 alpha 段，不会把 `ff` 折掉，所以不透明时这里自己省略，
  // 免得文档里同一个颜色出现 6 位与 8 位两种写法。它只负责把 alpha 为 0 折叠成 `transparent`。
  return normalizeComposeColor(alpha === 'ff' ? rgb : `${rgb}${alpha}`) ?? 'transparent'
}

/**
 * 在两个同类型关键帧值之间按比例插值。
 *
 * @param ratio - `0` 返回 `from`，`1` 返回 `to`；不做钳制，调用方负责传入 `[0, 1]`。
 * @public
 */
export function mixComposeAnimationValue(
  kind: ComposeAnimationValueKind,
  from: JsonValue,
  to: JsonValue,
  ratio: number,
): JsonValue {
  if (kind === 'number') {
    const left = from as number
    return left + ((to as number) - left) * ratio
  }
  if (kind === 'color') return mixComposeColor(from as string, to as string, ratio)
  const left = from as ComposeAnimationVector2
  const right = to as ComposeAnimationVector2
  return {
    x: left.x + (right.x - left.x) * ratio,
    y: left.y + (right.y - left.y) * ratio,
  }
}
