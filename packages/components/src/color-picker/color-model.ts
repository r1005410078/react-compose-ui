import {
  normalizeComposeColor,
  type ComposeColor,
} from '@compose-ui/core'

/** Color/paint 控件内部共享的 HSV 表达。 @internal */
export interface ComposeHsvColor {
  readonly hue: number
  readonly saturation: number
  readonly value: number
}

/** 供可视控件消费的解析颜色。 @internal */
export interface ComposeEditableColor {
  readonly color: ComposeColor
  readonly hsv: ComposeHsvColor
  readonly alpha: number
}

const FALLBACK_COLOR = '#000000'

/** 当前组件支持的固定常用色。 @public */
export const COMPOSE_COMMON_COLORS: readonly ComposeColor[] = [
  '#000000', '#ffffff', '#ef4444', '#f97316', '#eab308', '#22c55e',
  '#06b6d4', '#3b82f6', '#6366f1', '#a855f7', '#ec4899', 'transparent',
]

export function clampComposeColor(value: number, minimum = 0, maximum = 100): number {
  return Math.min(maximum, Math.max(minimum, value))
}

function expandedHex(value: string): string | null {
  const compact = /^#([\da-f]{3,4})$/i.exec(value.trim())
  if (compact) return compact[1].split('').map((channel) => channel.repeat(2)).join('').toLowerCase()
  const full = /^#([\da-f]{6}|[\da-f]{8})$/i.exec(value.trim())
  return full ? full[1].toLowerCase() : null
}

/** @internal */
export function composeHexToHsv(hex: string): ComposeHsvColor {
  const red = Number.parseInt(hex.slice(1, 3), 16) / 255
  const green = Number.parseInt(hex.slice(3, 5), 16) / 255
  const blue = Number.parseInt(hex.slice(5, 7), 16) / 255
  const maximum = Math.max(red, green, blue)
  const minimum = Math.min(red, green, blue)
  const difference = maximum - minimum
  let hue = 0
  if (difference !== 0) {
    if (maximum === red) hue = 60 * (((green - blue) / difference) % 6)
    else if (maximum === green) hue = 60 * ((blue - red) / difference + 2)
    else hue = 60 * ((red - green) / difference + 4)
  }
  return {
    hue: Math.round((hue + 360) % 360),
    saturation: maximum === 0 ? 0 : Math.round((difference / maximum) * 100),
    value: Math.round(maximum * 100),
  }
}

/** @internal */
export function composeHsvToHex({ hue, saturation, value }: ComposeHsvColor): string {
  const normalizedHue = ((hue % 360) + 360) % 360
  const chroma = (value / 100) * (saturation / 100)
  const secondary = chroma * (1 - Math.abs((normalizedHue / 60) % 2 - 1))
  const match = value / 100 - chroma
  const [red, green, blue] = normalizedHue < 60
    ? [chroma, secondary, 0]
    : normalizedHue < 120
      ? [secondary, chroma, 0]
      : normalizedHue < 180
        ? [0, chroma, secondary]
        : normalizedHue < 240
          ? [0, secondary, chroma]
          : normalizedHue < 300
            ? [secondary, 0, chroma]
            : [chroma, 0, secondary]
  const channel = (color: number) => Math.round((color + match) * 255).toString(16).padStart(2, '0')
  return `#${channel(red)}${channel(green)}${channel(blue)}`
}

/** 把允许的输入转成可编辑状态；旧 CSS 输入仅用于安全的 UI 回退。 @internal */
export function parseComposeEditableColor(value: string): ComposeEditableColor {
  const raw = value.trim().toLowerCase()
  const hex = expandedHex(raw)
  const normalized = normalizeComposeColor(value)
  const base = normalized === 'transparent'
    ? (hex ? `#${hex.slice(0, 6)}` : FALLBACK_COLOR)
    : normalized ?? FALLBACK_COLOR
  const alpha = hex?.length === 8
    ? Number.parseInt(hex.slice(6, 8), 16) / 255
    : normalized === 'transparent' ? 0 : 1
  return {
    color: normalized ?? FALLBACK_COLOR,
    hsv: composeHexToHsv(base),
    alpha,
  }
}

/** 从 HSV 与 Alpha 构造规范 ComposeColor。 @internal */
export function composeColorFromHsv(hsv: ComposeHsvColor, alpha: number): ComposeColor {
  const hex = composeHsvToHex(hsv)
  const channel = Math.round(clampComposeColor(alpha * 100) / 100 * 255)
    .toString(16)
    .padStart(2, '0')
  return normalizeComposeColor(
    channel === '00' ? 'transparent' : channel === 'ff' ? hex : `${hex}${channel}`,
  ) ?? FALLBACK_COLOR
}

/** 在不重新量化 RGB 通道的前提下替换透明度。 @internal */
export function composeColorWithAlpha(color: ComposeColor, alpha: number): ComposeColor {
  const normalized = normalizeComposeColor(color)
  const hex = normalized && normalized !== 'transparent' ? expandedHex(normalized) : '000000'
  const base = hex ? `#${hex.slice(0, 6)}` : FALLBACK_COLOR
  const channel = Math.round(clampComposeColor(alpha * 100) / 100 * 255)
    .toString(16)
    .padStart(2, '0')
  return normalizeComposeColor(
    channel === '00' ? 'transparent' : channel === 'ff' ? base : `${base}${channel}`,
  ) ?? FALLBACK_COLOR
}
