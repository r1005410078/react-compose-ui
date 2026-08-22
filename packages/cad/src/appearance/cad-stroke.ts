import { getCadPlacement, getCadStroke, type CadDocument, type CadStroke } from '../document'
import type { ComposeEntity } from '@compose-ui/core'

/**
 * 九个标准色名，与 DXF 的 ACI 前九色对应。
 *
 * @remarks
 * 不接受任意 CSS 颜色名：那张表有一百多个条目，而 `cad` 是无 DOM 包，没有浏览器帮忙解析，
 * 自带一张表只是为了让 `rebeccapurple` 能用。十六进制已经覆盖全部需求。
 *
 * @public
 */
export const CAD_COLOR_NAMES: Readonly<Record<string, string>> = {
  red: '#ff0000',
  yellow: '#ffff00',
  green: '#00ff00',
  cyan: '#00ffff',
  blue: '#0000ff',
  magenta: '#ff00ff',
  white: '#d8e2f1',
  gray: '#808080',
  lightgray: '#c0c0c0',
}

/** 没有覆盖时的线宽（屏幕像素）。 @public */
export const CAD_DEFAULT_STROKE_WIDTH = 1

/**
 * 一个图元最终的描边。
 *
 * @remarks
 * **两种单位**：`width` 是屏幕像素、不随缩放变化（AutoCAD 的 lineweight，回答「这根线画多
 * 粗」）；`dashPattern` 是世界单位、随缩放变化（AutoCAD 的 linetype，回答「虚线段有多长」）。
 * 渲染时前者原样给 `stroke-width`，后者必须乘 `zoom`。
 *
 * @public
 */
export interface CadResolvedStroke {
  readonly color: string
  /** 屏幕像素。 */
  readonly width: number
  /** 世界单位；空数组表示实线。 */
  readonly dashPattern: readonly number[]
}

/**
 * 解析一个图元最终的描边。
 *
 * @remarks
 * **唯一的读取入口**：渲染只消费解析结果，不再各自去拼图层色。逐项回退——只覆盖了颜色的图元
 * 线宽仍然跟随默认值，因此「把一根线改成红色」不会顺带把线宽钉死。
 *
 * 不含 `CadStroke` 的图元，结果与引入本能力之前逐字相同。
 *
 * @param document - 当前文档；解析要读图层颜色。
 * @param entity - 目标图元。
 * @public
 */
export function resolveCadStroke(
  document: CadDocument,
  entity: ComposeEntity | undefined,
): CadResolvedStroke {
  const layerId = entity ? getCadPlacement(entity)?.layerId : undefined
  const layer = document.layers.find(({ id }) => id === layerId)
  const stroke: CadStroke | undefined = entity ? getCadStroke(entity) : undefined
  return {
    color: stroke?.color ?? layer?.color ?? CAD_COLOR_NAMES.white!,
    width: stroke?.width ?? CAD_DEFAULT_STROKE_WIDTH,
    dashPattern: stroke?.dashPattern ?? [],
  }
}

/** 一次外观修改；`null` 表示**清除**该项，缺席表示不动它。 @public */
export interface CadStrokePatch {
  readonly color?: string | null
  readonly width?: number | null
  readonly dashPattern?: readonly number[] | null
}

/**
 * 把一次修改应用到既有覆盖上。
 *
 * @remarks
 * 清除表现为**删掉那个键**而不是写哨兵值：JSON 里没有 `undefined`，写 `color: null` 会让
 * 「显式设成无色」与「跟随图层」变成两个都要处理的状态。
 *
 * @returns 新的 Component；三项全空时为 `null`，调用方应当删掉整个 Component——否则文档会
 * 攒下一堆空壳。
 * @public
 */
export function applyCadStrokePatch(
  current: CadStroke | undefined,
  patch: CadStrokePatch,
): CadStroke | null {
  const next: Record<string, unknown> = { ...current }
  for (const key of ['color', 'width', 'dashPattern'] as const) {
    if (!(key in patch)) continue
    const value = patch[key]
    if (value === null) delete next[key]
    else next[key] = value
  }
  return Object.keys(next).length === 0 ? null : (next as CadStroke)
}

/**
 * 解析颜色输入：十六进制、九个色名，或 `BYLAYER`。
 *
 * @returns 颜色值；`null` 表示清除覆盖；`undefined` 表示这不是一个合法值。
 * @public
 */
export function parseCadColor(input: string): string | null | undefined {
  const text = input.trim()
  if (text.length === 0) return undefined
  if (text.toUpperCase() === 'BYLAYER') return null
  if (/^#[0-9a-f]{6}$/i.test(text)) return text.toLowerCase()
  return CAD_COLOR_NAMES[text.toLowerCase()]
}

/**
 * 解析线宽输入：正数或 `BYLAYER`。
 *
 * @returns 线宽；`null` 表示清除；`undefined` 表示非法。
 * @public
 */
export function parseCadStrokeWidth(input: string): number | null | undefined {
  const text = input.trim()
  if (text.toUpperCase() === 'BYLAYER') return null
  const parsed = Number(text)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined
}

/**
 * 解析线型输入：逗号分隔的正数、`CONTINUOUS` 或 `BYLAYER`。
 *
 * @remarks
 * `CONTINUOUS` 与 `BYLAYER` 在这里都是清除——「实线」在 AutoCAD 里是一个具名线型，而在本仓的
 * 模型里它就是「没有虚线」。
 *
 * @returns 虚线段；`null` 表示清除；`undefined` 表示非法。
 * @public
 */
export function parseCadDashPattern(input: string): readonly number[] | null | undefined {
  const text = input.trim().toUpperCase()
  if (text === 'BYLAYER' || text === 'CONTINUOUS') return null
  const parts = input.split(',').map((part) => Number(part.trim()))
  if (parts.length === 0 || parts.some((value) => !Number.isFinite(value) || value <= 0)) {
    return undefined
  }
  return parts
}
