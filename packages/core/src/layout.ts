import type {
  ComposeAlignContent,
  ComposeAlignItems,
  ComposeFlexDirection,
  ComposeFlexLayout,
  ComposeFlexWrap,
  ComposeEdges,
  ComposeAxisSizing,
  ComposeLayoutItem,
  ComposeJustifyContent,
  ComposeLayout,
} from './document-types'

const FLEX_DIRECTIONS = new Set<ComposeFlexDirection>([
  'row',
  'row-reverse',
  'column',
  'column-reverse',
])

const FLEX_WRAPS = new Set<ComposeFlexWrap>([
  'nowrap',
  'wrap',
  'wrap-reverse',
])

const ALIGN_CONTENT_VALUES = new Set<ComposeAlignContent>([
  'flex-start',
  'center',
  'flex-end',
  'space-between',
  'space-around',
  'stretch',
])

const JUSTIFY_CONTENT_VALUES = new Set<ComposeJustifyContent>([
  'flex-start',
  'center',
  'flex-end',
  'space-between',
  'space-around',
  'space-evenly',
])

const ALIGN_ITEMS_VALUES = new Set<ComposeAlignItems>([
  'flex-start',
  'center',
  'flex-end',
  'stretch',
  'baseline',
])

const FLEX_LAYOUT_FIELDS = [
  'type',
  'flexDirection',
  'flexWrap',
  'alignContent',
  'justifyContent',
  'alignItems',
  'padding',
  'rowGap',
  'columnGap',
] as const

type LayoutRecord = Record<string, unknown>

/** Core 文档校验器使用的可定位 Layout 问题。 @internal */
export interface ComposeLayoutValidationIssue {
  readonly path: readonly string[]
  readonly message: string
}

function isRecord(value: unknown): value is LayoutRecord {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function finiteNonNegative(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
}

function finitePositive(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
}

function collectEdgesIssues(
  value: unknown,
  path: readonly string[],
  issues: ComposeLayoutValidationIssue[],
) {
  if (!isRecord(value)) {
    issues.push({ path, message: '边距必须是对象' })
    return
  }
  const fields = ['top', 'right', 'bottom', 'left'] as const
  Object.keys(value).forEach((key) => {
    if (!fields.includes(key as typeof fields[number])) {
      issues.push({ path: [...path, key], message: `未知字段 ${key}` })
    }
  })
  fields.forEach((key) => {
    if (!finiteNonNegative(value[key])) {
      issues.push({ path: [...path, key], message: `${key} 必须是有限非负数` })
    }
  })
}

/**
 * 收集 Layout 候选值的字段级问题。
 *
 * @internal
 */
export function collectComposeLayoutValidationIssues(
  value: unknown,
): readonly ComposeLayoutValidationIssue[] {
  if (!isRecord(value)) {
    return [{ path: [], message: 'Layout 必须是对象' }]
  }

  const issues: ComposeLayoutValidationIssue[] = []
  const knownFields = new Set<string>(FLEX_LAYOUT_FIELDS)
  Object.keys(value).forEach((key) => {
    if (!knownFields.has(key)) {
      issues.push({ path: [key], message: `未知字段 ${key}` })
    }
  })

  if (value.type !== 'flex') {
    issues.push({ path: ['type'], message: 'type 必须是 flex' })
  }
  if (!FLEX_DIRECTIONS.has(value.flexDirection as ComposeFlexDirection)) {
    issues.push({ path: ['flexDirection'], message: 'flexDirection 无效' })
  }
  if (!FLEX_WRAPS.has(value.flexWrap as ComposeFlexWrap)) {
    issues.push({ path: ['flexWrap'], message: 'flexWrap 无效' })
  }
  if (!ALIGN_CONTENT_VALUES.has(value.alignContent as ComposeAlignContent)) {
    issues.push({ path: ['alignContent'], message: 'alignContent 无效' })
  }
  if (!JUSTIFY_CONTENT_VALUES.has(value.justifyContent as ComposeJustifyContent)) {
    issues.push({ path: ['justifyContent'], message: 'justifyContent 无效' })
  }
  if (!ALIGN_ITEMS_VALUES.has(value.alignItems as ComposeAlignItems)) {
    issues.push({ path: ['alignItems'], message: 'alignItems 无效' })
  }
  collectEdgesIssues(value.padding, ['padding'], issues)
  for (const key of ['rowGap', 'columnGap'] as const) {
    if (!finiteNonNegative(value[key])) {
      issues.push({ path: [key], message: `${key} 必须是有限非负数` })
    }
  }
  return issues
}

/** 创建独立的 Flex Layout 默认值。 @public */
export function createDefaultComposeFlexLayout(): ComposeFlexLayout {
  return {
    type: 'flex',
    flexDirection: 'row',
    flexWrap: 'nowrap',
    alignContent: 'stretch',
    justifyContent: 'flex-start',
    alignItems: 'stretch',
    padding: createComposeEdges(),
    rowGap: 0,
    columnGap: 0,
  }
}

/** 判断未知输入是否为完整、严格的 Compose Layout。 @public */
export function isValidComposeLayout(value: unknown): value is ComposeLayout {
  return collectComposeLayoutValidationIssues(value).length === 0
}

/** 创建四边相同但引用独立的边值。 @public */
export function createComposeEdges(value = 0): ComposeEdges {
  return { top: value, right: value, bottom: value, left: value }
}

/** 创建 Fixed 单轴尺寸意图。 @public */
export function createFixedComposeAxisSizing(value: number): ComposeAxisSizing {
  return { mode: 'fixed', value, min: 1, max: null }
}

/** 创建独立的 Absolute Fixed LayoutItem。 @public */
export function createDefaultComposeLayoutItem(
  width = 100,
  height = 100,
  offset = { x: 0, y: 0 },
): ComposeLayoutItem {
  return {
    positioning: 'absolute',
    offset: { x: offset.x, y: offset.y },
    width: createFixedComposeAxisSizing(width),
    height: createFixedComposeAxisSizing(height),
    margin: createComposeEdges(),
    alignSelf: 'auto',
  }
}

/** Core 文档校验器使用的可定位 LayoutItem 问题。 @internal */
export function collectComposeLayoutItemValidationIssues(
  value: unknown,
): readonly ComposeLayoutValidationIssue[] {
  if (!isRecord(value)) return [{ path: [], message: 'LayoutItem 必须是对象' }]
  const issues: ComposeLayoutValidationIssue[] = []
  const fields = new Set(['positioning', 'offset', 'width', 'height', 'margin', 'alignSelf'])
  Object.keys(value).forEach((key) => {
    if (!fields.has(key)) issues.push({ path: [key], message: `未知字段 ${key}` })
  })
  if (value.positioning !== 'absolute' && value.positioning !== 'flow') {
    issues.push({ path: ['positioning'], message: 'positioning 必须是 flow 或 absolute' })
  }
  if (!isRecord(value.offset)) {
    issues.push({ path: ['offset'], message: 'offset 必须是对象' })
  }
  else {
    for (const key of ['x', 'y'] as const) {
      if (typeof value.offset[key] !== 'number' || !Number.isFinite(value.offset[key])) {
        issues.push({ path: ['offset', key], message: `${key} 必须是有限数` })
      }
    }
  }
  for (const axis of ['width', 'height'] as const) {
    const sizing = value[axis]
    if (!isRecord(sizing)) {
      issues.push({ path: [axis], message: `${axis} 必须是对象` })
      continue
    }
    const sizingFields = new Set(['mode', 'value', 'min', 'max'])
    Object.keys(sizing).forEach((key) => {
      if (!sizingFields.has(key)) issues.push({ path: [axis, key], message: `未知字段 ${key}` })
    })
    if (!new Set(['fixed', 'fill', 'hug']).has(String(sizing.mode))) {
      issues.push({ path: [axis, 'mode'], message: 'mode 必须是 fixed、fill 或 hug' })
    }
    if (!finitePositive(sizing.value)) {
      issues.push({ path: [axis, 'value'], message: 'value 必须是有限正数' })
    }
    if (sizing.min !== null && !finiteNonNegative(sizing.min)) {
      issues.push({ path: [axis, 'min'], message: 'min 必须是有限非负数或 null' })
    }
    if (sizing.max !== null && !finitePositive(sizing.max)) {
      issues.push({ path: [axis, 'max'], message: 'max 必须是有限正数或 null' })
    }
    if (
      typeof sizing.min === 'number'
      && typeof sizing.max === 'number'
      && sizing.max < sizing.min
    ) issues.push({ path: [axis, 'max'], message: 'max 不得小于 min' })
  }
  collectEdgesIssues(value.margin, ['margin'], issues)
  const alignSelfValues = new Set(['auto', 'flex-start', 'center', 'flex-end', 'stretch', 'baseline'])
  if (!alignSelfValues.has(String(value.alignSelf))) {
    issues.push({ path: ['alignSelf'], message: 'alignSelf 无效' })
  }
  return issues
}

/** 判断未知输入是否为严格 LayoutItem。 @public */
export function isValidComposeLayoutItem(value: unknown): value is ComposeLayoutItem {
  return collectComposeLayoutItemValidationIssues(value).length === 0
}
