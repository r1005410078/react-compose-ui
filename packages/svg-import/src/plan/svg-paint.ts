import type { SvgComputedStyle } from '../parser/svg-style'
import type { SvgNode } from '../parser/svg-parser'
import type { createSvgDiagnosticCollector } from '../parser/svg-diagnostics'

type Diagnostics = ReturnType<typeof createSvgDiagnosticCollector>

/**
 * CSS 具名色。
 *
 * @remarks
 * 这是**数据不是逻辑**，因此包内自带一份而不是引一个库。只收工程图与设计稿里真会出现的那些；
 * 命中不了的具名色当作没写并诊断——猜一个近似色会安静地画在图上，而用户没有办法看出这里本该
 * 是什么颜色。
 */
const NAMED_COLORS: Readonly<Record<string, string>> = Object.freeze({
  black: '#000000', silver: '#c0c0c0', gray: '#808080', grey: '#808080', white: '#ffffff',
  maroon: '#800000', red: '#ff0000', purple: '#800080', fuchsia: '#ff00ff', magenta: '#ff00ff',
  green: '#008000', lime: '#00ff00', olive: '#808000', yellow: '#ffff00', navy: '#000080',
  blue: '#0000ff', teal: '#008080', aqua: '#00ffff', cyan: '#00ffff', orange: '#ffa500',
  pink: '#ffc0cb', brown: '#a52a2a', gold: '#ffd700', beige: '#f5f5dc', ivory: '#fffff0',
  indigo: '#4b0082', violet: '#ee82ee', khaki: '#f0e68c', salmon: '#fa8072', tan: '#d2b48c',
  crimson: '#dc143c', coral: '#ff7f50', darkgray: '#a9a9a9', darkgrey: '#a9a9a9',
  lightgray: '#d3d3d3', lightgrey: '#d3d3d3', dimgray: '#696969', dimgrey: '#696969',
  darkblue: '#00008b', darkgreen: '#006400', darkred: '#8b0000', lightblue: '#add8e6',
  lightgreen: '#90ee90', whitesmoke: '#f5f5f5', transparent: 'transparent',
})

/** 把 0–1 的不透明度写成两位十六进制。 */
function alphaHex(alpha: number) {
  return Math.round(Math.min(1, Math.max(0, alpha)) * 255).toString(16).padStart(2, '0')
}

/**
 * 把一个 CSS 颜色规范成 `#rrggbb` 或 `#rrggbbaa`。
 *
 * @remarks
 * 折进 alpha 而不是另存一个字段：`ComposeColor` 接受八位十六进制，而 `fill-opacity` 与
 * `stroke-opacity` 在文档里没有各自的落点——折进颜色是唯一能保住它们的地方，且渲染与命中
 * （`getComposeCurveFill` 把全透明当作没填充）读的都是同一个值。
 *
 * @returns 解析不出来时返回 `null`——猜一个近似色会安静地画错。
 * @public
 */
export function normalizeSvgColor(value: string | undefined, opacity = 1): string | null {
  if (!value) return null
  const raw = value.trim().toLowerCase()
  if (raw === '' || raw === 'none') return null
  if (raw.startsWith('url(')) return null
  const named = NAMED_COLORS[raw]
  const hex = named ?? parseHex(raw) ?? parseRgb(raw)
  if (!hex) return null
  if (hex === 'transparent') return null
  return opacity >= 1 ? hex : `${hex}${alphaHex(opacity)}`
}

function parseHex(raw: string): string | null {
  if (!raw.startsWith('#')) return null
  const body = raw.slice(1)
  if (/^[0-9a-f]{3}$/.test(body)) {
    return `#${body[0]!}${body[0]!}${body[1]!}${body[1]!}${body[2]!}${body[2]!}`
  }
  if (/^[0-9a-f]{6}$/.test(body) || /^[0-9a-f]{8}$/.test(body)) return `#${body}`
  return null
}

function parseRgb(raw: string): string | null {
  const match = /^rgba?\(([^)]*)\)$/.exec(raw)
  if (!match) return null
  const parts = (match[1] ?? '').split(/[\s,/]+/).filter(Boolean).map((part) => Number.parseFloat(part))
  const [r, g, b] = parts
  if (![r, g, b].every((value) => typeof value === 'number' && Number.isFinite(value))) return null
  const channel = (value: number) => Math.round(Math.min(255, Math.max(0, value))).toString(16).padStart(2, '0')
  const alpha = parts[3]
  const base = `#${channel(r!)}${channel(g!)}${channel(b!)}`
  return typeof alpha === 'number' && Number.isFinite(alpha) && alpha < 1
    ? `${base}${alphaHex(alpha)}`
    : base
}

/**
 * 解析一次填充或描边的取值，渐变在这里降级。
 *
 * @remarks
 * 曲线的填充复用 `Appearance.backgroundPaint`，而它的读取入口 `getComposeCurveFill` v1 只画
 * `solid`——非纯色 Paint 由共享 Paint 层绘制，那一层画的是盒形的矩形，在曲线上只会是一块摆在
 * 形状后面的色块。因此渐变**降级成中位色标**：它比首尾任一个都更接近整体观感。
 *
 * @public
 */
export function resolveSvgPaint(
  value: string | undefined,
  opacity: number,
  gradients: ReadonlyMap<string, SvgNode>,
  diagnostics: Diagnostics,
): string | null {
  const raw = value?.trim()
  if (!raw) return null
  const reference = /^url\(\s*#([^)\s]+)\s*\)$/.exec(raw)
  if (!reference) return normalizeSvgColor(raw, opacity)
  const gradient = gradients.get(reference[1] ?? '')
  if (!gradient) {
    diagnostics.add('svg.unsupported-paint-effect', 'url')
    return null
  }
  diagnostics.add('svg.gradient-flattened', gradient.tag)
  const stops = gradient.children
    .filter((child) => child.tag === 'stop')
    .map((stop) => normalizeSvgColor(
      stop.attributes['stop-color'] ?? readStyleValue(stop.attributes.style, 'stop-color'),
      opacity,
    ))
    .filter((color): color is string => color !== null)
  if (stops.length === 0) return null
  return stops[Math.floor((stops.length - 1) / 2)] ?? null
}

/** `<stop style="stop-color:#f00">`：内联样式里的一条声明。 */
function readStyleValue(style: string | undefined, name: string): string | undefined {
  if (!style) return undefined
  for (const entry of style.split(';')) {
    const colon = entry.indexOf(':')
    if (colon < 0) continue
    if (entry.slice(0, colon).trim().toLowerCase() === name) return entry.slice(colon + 1).trim()
  }
  return undefined
}

/** 求值后的样式里的数值，缺席或不是数时给回退值。 @public */
export function styleNumber(style: SvgComputedStyle, name: string, fallback: number): number {
  const parsed = Number.parseFloat(style[name] ?? '')
  return Number.isFinite(parsed) ? parsed : fallback
}
