import {
  createDefaultComposeFlexLayout,
  type ComposeFlexLayout,
} from '@compose-ui/core'

/** Flex 枚举编辑器 ID。 @internal */
export type FlexOptionEditorId =
  | 'flex-direction'
  | 'flex-wrap'
  | 'align-content'
  | 'justify-content'
  | 'align-items'

export type FlexFieldEditorId = FlexOptionEditorId | 'gap' | 'padding'

/** 每个枚举编辑器对应的 Layout 字段值域；把选项表钉死在 Core 的类型上。 */
interface FlexOptionValues {
  'flex-direction': ComposeFlexLayout['flexDirection']
  'flex-wrap': ComposeFlexLayout['flexWrap']
  'align-content': ComposeFlexLayout['alignContent']
  'justify-content': ComposeFlexLayout['justifyContent']
  'align-items': ComposeFlexLayout['alignItems']
}

type FlexOptionTable = {
  readonly [K in FlexOptionEditorId]: readonly {
    readonly value: FlexOptionValues[K]
    readonly zh: string
    readonly en: string
  }[]
}

// `satisfies` 而不是类型标注：既让写错的枚举值编译失败，又保留字面量类型供 picklist 推导。
export const FLEX_OPTIONS = {
  'flex-direction': [
    { value: 'row', zh: '横向', en: 'Row' },
    { value: 'column', zh: '纵向', en: 'Column' },
    { value: 'row-reverse', zh: '反向横向', en: 'Row reverse' },
    { value: 'column-reverse', zh: '反向纵向', en: 'Column reverse' },
  ],
  'flex-wrap': [
    { value: 'nowrap', zh: '不换行', en: 'No wrap' },
    { value: 'wrap', zh: '换行', en: 'Wrap' },
    { value: 'wrap-reverse', zh: '反向换行', en: 'Wrap reverse' },
  ],
  'align-content': [
    { value: 'flex-start', zh: '起始', en: 'Start' },
    { value: 'center', zh: '居中', en: 'Center' },
    { value: 'flex-end', zh: '末端', en: 'End' },
    { value: 'space-between', zh: '两端', en: 'Space between' },
    { value: 'space-around', zh: '环绕', en: 'Space around' },
    { value: 'stretch', zh: '拉伸', en: 'Stretch' },
  ],
  'justify-content': [
    { value: 'flex-start', zh: '起始', en: 'Start' },
    { value: 'center', zh: '居中', en: 'Center' },
    { value: 'flex-end', zh: '末端', en: 'End' },
    { value: 'space-between', zh: '两端', en: 'Space between' },
    { value: 'space-around', zh: '环绕', en: 'Space around' },
    { value: 'space-evenly', zh: '均匀', en: 'Space evenly' },
  ],
  'align-items': [
    { value: 'flex-start', zh: '起始', en: 'Start' },
    { value: 'center', zh: '居中', en: 'Center' },
    { value: 'flex-end', zh: '末端', en: 'End' },
    { value: 'stretch', zh: '拉伸', en: 'Stretch' },
    { value: 'baseline', zh: '基线', en: 'Baseline' },
  ],
} as const satisfies FlexOptionTable

/** picklist 需要非空元组；值域直接来自选项表，避免第三份枚举清单。 */
export function flexOptionValues<K extends FlexOptionEditorId>(
  id: K,
): [FlexOptionValues[K], ...FlexOptionValues[K][]] {
  return FLEX_OPTIONS[id].map((option) => option.value) as [
    FlexOptionValues[K],
    ...FlexOptionValues[K][],
  ]
}

// 「再点一次已选项恢复默认」的目标值必须与 Core 的默认 Layout 一致，因此从工厂派生而不是重写一遍。
const FLEX_DEFAULT_LAYOUT = createDefaultComposeFlexLayout()

export const FLEX_INITIAL_VALUES = {
  'flex-direction': FLEX_DEFAULT_LAYOUT.flexDirection,
  'flex-wrap': FLEX_DEFAULT_LAYOUT.flexWrap,
  'align-content': FLEX_DEFAULT_LAYOUT.alignContent,
  'justify-content': FLEX_DEFAULT_LAYOUT.justifyContent,
  'align-items': FLEX_DEFAULT_LAYOUT.alignItems,
} satisfies { readonly [K in FlexOptionEditorId]: FlexOptionValues[K] }

export const FLEX_CSS_NAMES: Readonly<Record<FlexFieldEditorId, string>> = {
  'flex-direction': 'flex-direction',
  'flex-wrap': 'flex-wrap',
  'align-content': 'align-content',
  'justify-content': 'justify-content',
  'align-items': 'align-items',
  gap: 'gap',
  padding: 'padding',
}

export function isFlexFieldEditorId(value: unknown): value is FlexFieldEditorId {
  return typeof value === 'string' && value in FLEX_CSS_NAMES
}

export function isFlexOptionEditorId(value: unknown): value is FlexOptionEditorId {
  return typeof value === 'string' && value in FLEX_OPTIONS
}

export function sameLayout(left: ComposeFlexLayout, right: ComposeFlexLayout): boolean {
  return left.type === right.type
    && left.flexDirection === right.flexDirection
    && left.flexWrap === right.flexWrap
    && left.alignContent === right.alignContent
    && left.justifyContent === right.justifyContent
    && left.alignItems === right.alignItems
    && left.rowGap === right.rowGap
    && left.columnGap === right.columnGap
    && left.padding.top === right.padding.top
    && left.padding.right === right.padding.right
    && left.padding.bottom === right.padding.bottom
    && left.padding.left === right.padding.left
}
