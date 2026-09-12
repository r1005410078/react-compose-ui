/**
 * `GridItem` Component 的类型、校验与读取。
 *
 * @remarks
 * 格坐标住在子级身上而不是容器身上：容器只知道「这块板子几列、一行多高」，「谁在哪一格」
 * 是子级自己的事。这让新增、删除、reparent 一个子级都只写它自己那一份数据，与
 * `Hierarchy.childIds` 决定 Flow 顺序是同一条形状。
 * @packageDocumentation
 */

import {
  COMPOSE_BUILTIN_COMPONENT_KEYS,
  type ComposeEntity,
  type ComposeGridItem,
} from './document-types'

/** GridItem 候选值的字段级问题。 @internal */
export interface ComposeGridItemValidationIssue {
  readonly path: readonly string[]
  readonly message: string
}

const GRID_ITEM_FIELDS = ['x', 'y', 'w', 'h', 'minW', 'minH'] as const

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function nonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0
}

function positiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0
}

/**
 * 收集 GridItem 候选值的字段级问题。
 *
 * @internal
 */
export function collectComposeGridItemValidationIssues(
  value: unknown,
): readonly ComposeGridItemValidationIssue[] {
  if (!isRecord(value)) return [{ path: [], message: 'GridItem 必须是对象' }]
  const issues: ComposeGridItemValidationIssue[] = []
  const allowed = new Set<string>(GRID_ITEM_FIELDS)
  Object.keys(value).forEach((key) => {
    if (!allowed.has(key)) issues.push({ path: [key], message: `未知字段 ${key}` })
  })
  for (const key of ['x', 'y'] as const) {
    if (!nonNegativeInteger(value[key])) {
      issues.push({ path: [key], message: `${key} 必须是不为负的整数` })
    }
  }
  for (const key of ['w', 'h'] as const) {
    if (!positiveInteger(value[key])) {
      issues.push({ path: [key], message: `${key} 必须是不小于 1 的整数` })
    }
  }
  // 最小跨度可缺席；给了就必须是能被满足的值——`minW` 大于 `w` 表达不出任何意图，
  // 而缩放会立刻把它钳回来，留着只会让面板上的两个数互相矛盾。
  for (const [key, span] of [['minW', 'w'], ['minH', 'h']] as const) {
    const candidate = value[key]
    if (candidate === undefined) continue
    if (!positiveInteger(candidate)) {
      issues.push({ path: [key], message: `${key} 必须是不小于 1 的整数` })
    }
    else if (positiveInteger(value[span]) && candidate > (value[span] as number)) {
      issues.push({ path: [key], message: `${key} 不得大于 ${span}` })
    }
  }
  return issues
}

/** 判断未知输入是否为完整、严格的 GridItem。 @public */
export function isValidComposeGridItem(value: unknown): value is ComposeGridItem {
  return collectComposeGridItemValidationIssues(value).length === 0
}

/**
 * 读取 Entity 上可选的 GridItem。
 *
 * @remarks
 * 求解、命中、Inspector 与手势规划都经这里读，不各自去摸 `components`——多一处直读就多一处
 * 会漏掉「缺席即不在格中」的地方。
 *
 * @returns 没有 `GridItem` 时是 `undefined`。
 * @public
 */
export function getComposeGridItem(
  entity: ComposeEntity | undefined,
): ComposeGridItem | undefined {
  return entity?.components[
    COMPOSE_BUILTIN_COMPONENT_KEYS.gridItem
  ] as ComposeGridItem | undefined
}

/**
 * 创建独立的 GridItem。
 *
 * @remarks
 * 默认 4 × 2 格：仪表盘上最常见的一档卡片（12 列里三张一行）。
 *
 * @public
 */
export function createComposeGridItem(
  x: number,
  y: number,
  w = 4,
  h = 2,
): ComposeGridItem {
  return { x, y, w, h }
}
