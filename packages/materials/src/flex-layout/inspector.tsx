import { createContext, useContext, useMemo, useRef, useState } from 'react'
import type {
  ComponentType,
  CSSProperties,
  KeyboardEvent,
} from 'react'
import * as v from 'valibot'
import {
  BUILTIN_COMMAND_TYPES,
  createDefaultComposeFlexLayout,
  type ComposeEntity,
  type ComposeFlexLayout,
  type EditorCommand,
} from '@compose-ui/core'
import type { ComposeComponentInspectorProps } from '@compose-ui/component-registry'
import {
  ComposePropertyPanel,
  type ComposePropertyPanelRenderer,
  type ComposePropertyPanelRendererProps,
} from '@compose-ui/property-panel'
import { useComposeI18nContext } from '@compose-ui/ui-context'
import type { InspectorIdFactory } from '../material-inspector-kit/renderer-inspectors'
import { FlexLayoutIcon } from './icons'

type FlexOptionEditorId =
  | 'flex-direction'
  | 'flex-wrap'
  | 'align-content'
  | 'justify-content'
  | 'align-items'

type FlexFieldEditorId = FlexOptionEditorId | 'gap'

const FlexDirectionIconContext = createContext<ComposeFlexLayout['flexDirection']>('row')

interface FlexOption {
  readonly value: string
  readonly zh: string
  readonly en: string
}

const FLEX_OPTIONS: Readonly<Record<FlexOptionEditorId, readonly FlexOption[]>> = {
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
    { value: 'center', zh: '居中', en: 'Center' },
    { value: 'flex-start', zh: '起始', en: 'Start' },
    { value: 'flex-end', zh: '末端', en: 'End' },
    { value: 'space-around', zh: '环绕', en: 'Space around' },
    { value: 'space-between', zh: '两端', en: 'Space between' },
    { value: 'stretch', zh: '拉伸', en: 'Stretch' },
  ],
  'justify-content': [
    { value: 'center', zh: '居中', en: 'Center' },
    { value: 'flex-start', zh: '起始', en: 'Start' },
    { value: 'flex-end', zh: '末端', en: 'End' },
    { value: 'space-between', zh: '两端', en: 'Space between' },
    { value: 'space-around', zh: '环绕', en: 'Space around' },
    { value: 'space-evenly', zh: '均匀', en: 'Space evenly' },
  ],
  'align-items': [
    { value: 'center', zh: '居中', en: 'Center' },
    { value: 'flex-start', zh: '起始', en: 'Start' },
    { value: 'flex-end', zh: '末端', en: 'End' },
    { value: 'stretch', zh: '拉伸', en: 'Stretch' },
    { value: 'baseline', zh: '基线', en: 'Baseline' },
  ],
}

const FLEX_CSS_NAMES: Readonly<Record<FlexFieldEditorId, string>> = {
  'flex-direction': 'flex-direction',
  'flex-wrap': 'flex-wrap',
  'align-content': 'align-content',
  'justify-content': 'justify-content',
  'align-items': 'align-items',
  gap: 'gap',
}

function useZh(): boolean {
  return (useComposeI18nContext()?.locale ?? 'zh-CN') === 'zh-CN'
}

function isFlexFieldEditorId(value: unknown): value is FlexFieldEditorId {
  return typeof value === 'string' && value in FLEX_CSS_NAMES
}

function isFlexOptionEditorId(value: unknown): value is FlexOptionEditorId {
  return typeof value === 'string' && value in FLEX_OPTIONS
}

function sameLayout(left: ComposeFlexLayout, right: ComposeFlexLayout): boolean {
  return left.type === right.type
    && left.flexDirection === right.flexDirection
    && left.flexWrap === right.flexWrap
    && left.alignContent === right.alignContent
    && left.justifyContent === right.justifyContent
    && left.alignItems === right.alignItems
    && left.gap === right.gap
}

function createLayoutCommand(
  idFactory: InspectorIdFactory,
  entity: ComposeEntity,
  value: ComposeFlexLayout,
  zh: boolean,
  reset = false,
): EditorCommand {
  return {
    id: idFactory(),
    type: BUILTIN_COMMAND_TYPES.updateComponent,
    payload: {
      entityId: entity.id,
      key: 'Layout',
      value,
    },
    meta: {
      label: zh
        ? `${reset ? '重置' : '修改'} ${entity.name} 布局`
        : `${reset ? 'Reset' : 'Update'} ${entity.name} layout`,
      source: 'inspector',
      targetIds: [entity.id],
      mergeKey: `inspector:${entity.id}:${BUILTIN_COMMAND_TYPES.updateComponent}`,
    },
  }
}

// eslint-disable-next-line react-refresh/only-export-components -- 组件仅注册到当前 Inspector 的实例级 renderer，不作为模块 API 导出。
function FlexFieldLabel({
  label,
  metadata,
}: ComposePropertyPanelRendererProps) {
  if (!isFlexFieldEditorId(metadata.editor)) return label
  return (
    <span className="flex-layout-inspector__field-label">
      <span>{label}</span>
      <code>{FLEX_CSS_NAMES[metadata.editor]}</code>
    </span>
  )
}

// eslint-disable-next-line react-refresh/only-export-components -- 组件仅注册到当前 Inspector 的实例级 renderer，不作为模块 API 导出。
function FlexOptionEditor({
  commit,
  label,
  metadata,
  readOnly,
  value,
}: ComposePropertyPanelRendererProps) {
  const zh = useZh()
  const flexDirection = useContext(FlexDirectionIconContext)
  const editor = metadata.editor
  const buttons = useRef<(HTMLButtonElement | null)[]>([])
  if (!isFlexOptionEditorId(editor)) return null
  const options = FLEX_OPTIONS[editor]
  const selectedIndex = options.findIndex((option) => option.value === value)
  const canClear = editor === 'align-content'
    || editor === 'justify-content'
    || editor === 'align-items'
  const move = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let nextIndex: number | undefined
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      nextIndex = (index + 1) % options.length
    }
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      nextIndex = (index - 1 + options.length) % options.length
    }
    else if (event.key === 'Home') {
      nextIndex = 0
    }
    else if (event.key === 'End') {
      nextIndex = options.length - 1
    }
    if (nextIndex === undefined) return
    event.preventDefault()
    buttons.current[nextIndex]?.focus()
    commit(options[nextIndex]!.value)
  }
  return (
    <div
      aria-label={label}
      className="flex-layout-inspector__options"
      data-flex-layout-field={editor}
      data-option-count={options.length}
      role="radiogroup"
    >
      {options.map((option, index) => (
        <button
          aria-checked={option.value === value}
          aria-label={zh ? option.zh : option.en}
          className="flex-layout-inspector__option"
          disabled={readOnly}
          key={option.value}
          ref={(node) => {
            buttons.current[index] = node
          }}
          role="radio"
          tabIndex={(selectedIndex < 0 ? index === 0 : selectedIndex === index) ? 0 : -1}
          title={zh ? option.zh : option.en}
          type="button"
          onClick={() => commit(
            canClear && option.value === value ? 'normal' : option.value,
          )}
          onKeyDown={(event) => move(event, index)}
        >
          <FlexLayoutIcon
            editor={editor}
            flexDirection={flexDirection}
            value={option.value}
          />
        </button>
      ))}
    </div>
  )
}

// eslint-disable-next-line react-refresh/only-export-components -- 组件仅注册到当前 Inspector 的实例级 renderer，不作为模块 API 导出。
function FlexGapEditor({
  commit,
  label,
  readOnly,
  value,
}: ComposePropertyPanelRendererProps) {
  const numericValue = typeof value === 'number' ? value : 0
  const [state, setState] = useState({
    source: numericValue,
    draft: String(numericValue),
    invalid: false,
  })
  // 外部受控值优先于旧草稿；无需 Effect 回写即可在同一次 render 中同步展示。
  const current = state.source === numericValue
    ? state
    : { source: numericValue, draft: String(numericValue), invalid: false }

  const submit = () => {
    const candidate = Number(current.draft)
    if (current.draft.trim() === '' || !Number.isFinite(candidate) || candidate < 0) {
      setState({ ...current, invalid: true })
      return
    }
    const accepted = commit(candidate, 'input')
    setState({
      // 先以已提交值作为受控基线。上层确认 candidate 后，本地状态才能在后续整体重置时
      // 识别新的外部值；否则 source 仍停留在提交前数值，会把旧 draft 错当成当前值。
      source: accepted ? candidate : numericValue,
      draft: accepted ? String(candidate) : current.draft,
      invalid: !accepted,
    })
  }

  return (
    <div
      className="flex-layout-inspector__gap"
      data-flex-layout-field="gap"
    >
      <input
        aria-invalid={current.invalid || undefined}
        aria-label={label}
        disabled={readOnly}
        inputMode="decimal"
        min="0"
        step="any"
        type="number"
        value={current.draft}
        onBlur={submit}
        onChange={(event) => {
          setState({
            source: numericValue,
            draft: event.target.value,
            invalid: false,
          })
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault()
            event.currentTarget.blur()
          }
          else if (event.key === 'Escape') {
            setState({
              source: numericValue,
              draft: String(numericValue),
              invalid: false,
            })
            event.currentTarget.blur()
          }
        }}
      />
    </div>
  )
}

const FLEX_RENDERERS: readonly ComposePropertyPanelRenderer[] = [
  ...([
    'flex-direction',
    'flex-wrap',
    'align-content',
    'justify-content',
    'align-items',
  ] as const).map((id) => ({
    id,
    component: FlexOptionEditor,
    labelComponent: FlexFieldLabel,
    layout: 'full-width' as const,
  })),
  {
    id: 'gap',
    component: FlexGapEditor,
    labelComponent: FlexFieldLabel,
    layout: 'full-width',
  },
]

// eslint-disable-next-line react-refresh/only-export-components -- 图标只供当前 Inspector 标题栏使用。
function ResetLayoutIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20">
      <path d="M4.5 7.2A6 6 0 1 1 4.2 13" />
      <path d="M4.5 3.8v3.8h3.8" />
    </svg>
  )
}

/** 创建 Layout Inspector 分组标题栏状态与整体重置操作。 @internal */
export function createLayoutInspectorHeaderActions(
  idFactory: InspectorIdFactory,
): ComponentType<ComposeComponentInspectorProps> {
  return function LayoutInspectorHeaderActions({ entity, dispatch, readOnly, value }) {
    const zh = useZh()
    const layout = value as ComposeFlexLayout
    const defaults = createDefaultComposeFlexLayout()
    const disabled = readOnly || sameLayout(layout, defaults)
    return (
      <div className="flex-layout-inspector__header-actions">
        <code>display: flex</code>
        <button
          aria-label={zh ? '重置布局' : 'Reset layout'}
          disabled={disabled}
          title={zh ? '重置布局' : 'Reset layout'}
          type="button"
          onClick={() => {
            if (disabled) return
            dispatch(createLayoutCommand(idFactory, entity, defaults, zh, true))
          }}
        >
          <ResetLayoutIcon />
        </button>
      </div>
    )
  }
}

// eslint-disable-next-line react-refresh/only-export-components -- 预览只由 Inspector factory 返回的组件使用，不作为模块 API 导出。
function FlexLayoutPreview({
  layout,
  zh,
}: {
  readonly layout: ComposeFlexLayout
  readonly zh: boolean
}) {
  const vertical = layout.flexDirection.startsWith('column')
  const mainReverse = layout.flexDirection.endsWith('reverse')
  const crossReverse = layout.flexWrap === 'wrap-reverse'
  const previewStyle: CSSProperties = {
    alignContent: layout.alignContent,
    alignItems: layout.alignItems,
    display: 'flex',
    flexDirection: layout.flexDirection,
    flexWrap: layout.flexWrap,
    gap: `${layout.gap}px`,
    justifyContent: layout.justifyContent,
  }
  return (
    <section className="flex-layout-inspector__preview-block">
      <h3>{zh ? '实时预览' : 'Live preview'}</h3>
      <div
        className="flex-layout-inspector__preview"
        data-align-items={layout.alignItems}
        data-flex-direction={layout.flexDirection}
        data-testid="flex-layout-preview"
      >
        <header>
          <span>{zh ? 'Flex 容器' : 'Flex container'}</span>
          <code>{layout.flexDirection} · {layout.flexWrap} · gap {layout.gap}</code>
        </header>
        <div className="flex-layout-inspector__preview-canvas">
          <div
            aria-hidden="true"
            className="flex-layout-inspector__preview-surface"
            style={previewStyle}
          >
            {[1, 2, 3].map((index) => (
              <span data-flex-preview-node="" key={index}>{index}</span>
            ))}
          </div>
          <div
            aria-hidden="true"
            className={[
              'flex-layout-inspector__axis',
              vertical
                ? 'flex-layout-inspector__axis--vertical'
                : 'flex-layout-inspector__axis--horizontal',
              mainReverse ? 'flex-layout-inspector__axis--reverse' : '',
            ].filter(Boolean).join(' ')}
          >
            <span>{zh ? '主轴' : 'Main axis'}</span>
          </div>
          <div
            aria-hidden="true"
            className={[
              'flex-layout-inspector__axis',
              vertical
                ? 'flex-layout-inspector__axis--horizontal'
                : 'flex-layout-inspector__axis--vertical',
              crossReverse ? 'flex-layout-inspector__axis--reverse' : '',
            ].filter(Boolean).join(' ')}
          >
            <span>{zh ? '交叉轴' : 'Cross axis'}</span>
          </div>
        </div>
      </div>
    </section>
  )
}

/** 创建 Layout Component 的设计稿三列 Flex Inspector。 @internal */
export function createLayoutInspector(
  idFactory: InspectorIdFactory,
): ComponentType<ComposeComponentInspectorProps> {
  return function LayoutInspector({ entity, dispatch, readOnly, value }) {
    const zh = useZh()
    const layout = value as ComposeFlexLayout
    const schema = useMemo(() => v.object({
      flexDirection: v.pipe(
        v.picklist(['row', 'row-reverse', 'column', 'column-reverse']),
        v.title(zh ? '方向' : 'Direction'),
        v.metadata({ propertyPanel: { editor: 'flex-direction' } }),
      ),
      flexWrap: v.pipe(
        v.picklist(['nowrap', 'wrap', 'wrap-reverse']),
        v.title(zh ? '换行' : 'Wrap'),
        v.metadata({ propertyPanel: { editor: 'flex-wrap' } }),
      ),
      gap: v.pipe(
        v.number(),
        v.minValue(0),
        v.title(zh ? '间距' : 'Gap'),
        v.metadata({ propertyPanel: { editor: 'gap' } }),
      ),
      alignContent: v.pipe(
        v.picklist([
          'normal',
          'flex-start',
          'center',
          'flex-end',
          'space-between',
          'space-around',
          'stretch',
        ]),
        v.title(zh ? '多行' : 'Content'),
        v.metadata({ propertyPanel: { editor: 'align-content' } }),
      ),
      justifyContent: v.pipe(
        v.picklist([
          'normal',
          'flex-start',
          'center',
          'flex-end',
          'space-between',
          'space-around',
          'space-evenly',
        ]),
        v.title(zh ? '主轴' : 'Main axis'),
        v.metadata({ propertyPanel: { editor: 'justify-content' } }),
      ),
      alignItems: v.pipe(
        v.picklist(['normal', 'flex-start', 'center', 'flex-end', 'stretch', 'baseline']),
        v.title(zh ? '交叉轴' : 'Cross axis'),
        v.metadata({ propertyPanel: { editor: 'align-items' } }),
      ),
    }), [zh])
    return (
      <div
        aria-label={zh ? '布局属性' : 'Layout properties'}
        className="flex-layout-inspector"
        role="group"
      >
        <FlexDirectionIconContext.Provider value={layout.flexDirection}>
          <ComposePropertyPanel
            readOnly={readOnly}
            renderers={FLEX_RENDERERS}
            schema={schema}
            value={layout}
            onValueChange={(next) => {
              if (readOnly) return
              dispatch(createLayoutCommand(
                idFactory,
                entity,
                { type: 'flex', ...next },
                zh,
              ))
            }}
          />
        </FlexDirectionIconContext.Provider>
        <FlexLayoutPreview layout={layout} zh={zh} />
      </div>
    )
  }
}
