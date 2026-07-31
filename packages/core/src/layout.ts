import type {
  ComposeAlignContent,
  ComposeAlignItems,
  ComposeFlexDirection,
  ComposeFlexLayout,
  ComposeFlexWrap,
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
  'normal',
  'flex-start',
  'center',
  'flex-end',
  'space-between',
  'space-around',
  'stretch',
])

const JUSTIFY_CONTENT_VALUES = new Set<ComposeJustifyContent>([
  'normal',
  'flex-start',
  'center',
  'flex-end',
  'space-between',
  'space-around',
  'space-evenly',
])

const ALIGN_ITEMS_VALUES = new Set<ComposeAlignItems>([
  'normal',
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
  'gap',
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
  if (
    typeof value.gap !== 'number'
    || !Number.isFinite(value.gap)
    || value.gap < 0
  ) {
    issues.push({ path: ['gap'], message: 'gap 必须是有限非负数' })
  }
  return issues
}

/** 创建独立的 Flex Layout 默认值。 @public */
export function createDefaultComposeFlexLayout(): ComposeFlexLayout {
  return {
    type: 'flex',
    flexDirection: 'row',
    flexWrap: 'nowrap',
    alignContent: 'normal',
    justifyContent: 'normal',
    alignItems: 'normal',
    gap: 0,
  }
}

/** 判断未知输入是否为完整、严格的 Compose Layout。 @public */
export function isValidComposeLayout(value: unknown): value is ComposeLayout {
  return collectComposeLayoutValidationIssues(value).length === 0
}
