import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type {
  ComponentType,
  CSSProperties,
  KeyboardEvent,
  ReactNode,
} from 'react'
import * as v from 'valibot'
import {
  BUILTIN_COMMAND_TYPES,
  createDefaultComposeFlexLayout,
  type ComposeEdges,
  type ComposeEntity,
  type ComposeFlexLayout,
  type EditorCommand,
} from '@compose-ui/core'
import type {
  ComposeComponentInspectorProps,
  ComposeMissingComponentInspectorProps,
} from '@compose-ui/component-registry'
import {
  ComposePropertyPanel,
  type ComposePropertyPanelRenderer,
  type ComposePropertyPanelRendererProps,
} from '@compose-ui/property-panel'
import { useComposeI18nContext } from '@compose-ui/ui-context'
import { InspectorEdgesEditor } from '../material-inspector-kit/edge-editor'
import { isInspectorEdgesValue } from '../material-inspector-kit/edge-model'
import type { InspectorIdFactory } from '../material-inspector-kit/renderer-inspectors'
import { FlexLayoutIcon } from './icons'
import {
  planEnableComposeAutoLayout,
  planRemoveComposeAutoLayout,
} from './layout-mode-commands'

type FlexOptionEditorId =
  | 'flex-direction'
  | 'flex-wrap'
  | 'align-content'
  | 'justify-content'
  | 'align-items'

type FlexFieldEditorId = FlexOptionEditorId | 'gap' | 'padding'

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
}

const FLEX_CSS_NAMES: Readonly<Record<FlexFieldEditorId, string>> = {
  'flex-direction': 'flex-direction',
  'flex-wrap': 'flex-wrap',
  'align-content': 'align-content',
  'justify-content': 'justify-content',
  'align-items': 'align-items',
  gap: 'gap',
  padding: 'padding',
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
    && left.rowGap === right.rowGap
    && left.columnGap === right.columnGap
    && left.padding.top === right.padding.top
    && left.padding.right === right.padding.right
    && left.padding.bottom === right.padding.bottom
    && left.padding.left === right.padding.left
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
      <span>
        {label}
        {metadata.editor === 'align-content' ? (
          <small title="仅在换行产生多行时生效">ⓘ</small>
        ) : null}
      </span>
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
          onClick={() => commit(option.value)}
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
  const zh = useZh()
  const gap = value as { readonly rowGap: number; readonly columnGap: number }
  const signature = `${gap.rowGap}:${gap.columnGap}`
  const equal = gap.rowGap === gap.columnGap
  const [state, setState] = useState({ source: signature, split: !equal })
  const current = state.source === signature ? state : { source: signature, split: !equal }
  const update = (axis: 'rowGap' | 'columnGap', raw: string) => {
    const candidate = Number(raw)
    if (!Number.isFinite(candidate) || candidate < 0) return
    commit({ ...gap, [axis]: candidate }, 'input')
  }

  return (
    <div
      className="flex-layout-inspector__gap"
      data-flex-layout-field="gap"
    >
      {current.split ? (
        <div className="flex-layout-inspector__gap-axes">
          <input
            aria-label={zh ? '行间距' : 'Row gap'}
            disabled={readOnly}
            min="0"
            step="any"
            type="number"
            value={gap.rowGap}
            onChange={(event) => update('rowGap', event.target.value)}
          />
          <input
            aria-label={zh ? '列间距' : 'Column gap'}
            disabled={readOnly}
            min="0"
            step="any"
            type="number"
            value={gap.columnGap}
            onChange={(event) => update('columnGap', event.target.value)}
          />
        </div>
      ) : (
        <input
          aria-label={label}
          disabled={readOnly}
          min="0"
          step="any"
          type="number"
          value={gap.rowGap}
          onChange={(event) => {
            const candidate = Number(event.target.value)
            if (!Number.isFinite(candidate) || candidate < 0) return
            commit({ rowGap: candidate, columnGap: candidate }, 'input')
          }}
        />
      )}
      <button
        aria-label={current.split
          ? (zh ? '重新联动项间距' : 'Relink item gap')
          : (zh ? '拆分项间距' : 'Split item gap')}
        disabled={readOnly}
        type="button"
        onClick={() => {
          if (current.split) {
            commit({ rowGap: gap.rowGap, columnGap: gap.rowGap })
            setState({ source: `${gap.rowGap}:${gap.rowGap}`, split: false })
          }
          else {
            setState({ source: signature, split: true })
          }
        }}
      >
        ↕
      </button>
    </div>
  )
}

// eslint-disable-next-line react-refresh/only-export-components -- 组件仅注册到当前 Inspector 的实例级 renderer，不作为模块 API 导出。
function FlexPaddingEditor({
  commit,
  label,
  readOnly,
  value,
}: ComposePropertyPanelRendererProps) {
  const zh = useZh()
  return (
    <div data-flex-layout-field="padding">
      <InspectorEdgesEditor
        collapseLabel={zh ? '收起并联动内边距' : 'Collapse and link padding edges'}
        expandLabel={zh ? '展开内边距' : 'Expand padding'}
        label={label}
        min={0}
        readOnly={readOnly}
        value={value as ComposeEdges}
        onCommit={(next) => commit(next, 'commit')}
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
    layout: 'full-width' as const,
  },
  {
    id: 'padding',
    component: FlexPaddingEditor,
    labelComponent: FlexFieldLabel,
    layout: 'inline' as const,
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

interface LayoutActionMenuItem {
  readonly content: ReactNode
  readonly disabled?: boolean
  readonly label: string
  readonly onSelect: () => void
  readonly title?: string
}

// eslint-disable-next-line react-refresh/only-export-components -- 菜单只服务于当前 Inspector 的两种标题栏入口。
function LayoutActionMenu({
  disabled = false,
  items,
  menuLabel,
  trigger,
  triggerLabel,
}: {
  readonly disabled?: boolean
  readonly items: readonly LayoutActionMenuItem[]
  readonly menuLabel: string
  readonly trigger: ReactNode
  readonly triggerLabel: string
}) {
  const [open, setOpen] = useState(false)
  const firstItem = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (open) firstItem.current?.focus()
  }, [open])
  return (
    <div
      className="flex-layout-inspector__menu"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false)
      }}
      onKeyDown={(event) => {
        if (event.key !== 'Escape') return
        event.preventDefault()
        setOpen(false)
      }}
    >
      <button
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={triggerLabel}
        disabled={disabled}
        type="button"
        onClick={() => setOpen((current) => !current)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown') {
            event.preventDefault()
            setOpen(true)
          }
        }}
      >
        {trigger}
      </button>
      {open ? (
        <div aria-label={menuLabel} className="flex-layout-inspector__menu-popup" role="menu">
          {items.map((item, index) => (
            <button
              aria-label={item.label}
              disabled={item.disabled}
              key={item.label}
              ref={index === 0 ? firstItem : undefined}
              role="menuitem"
              title={item.title}
              type="button"
              onClick={() => {
                item.onSelect()
                setOpen(false)
              }}
            >
              {item.content}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}

/** 创建缺失 Layout 时的显式添加入口。 @internal */
export function createLayoutMissingInspectorActions(
  idFactory: InspectorIdFactory,
): ComponentType<ComposeMissingComponentInspectorProps> {
  return function LayoutMissingInspectorActions({ document, entity, dispatch, readOnly }) {
    const zh = useZh()
    return (
      <LayoutActionMenu
        disabled={readOnly || !document}
        items={[{
          label: 'Auto Layout display: flex',
          content: (
            <>
              <span>Auto Layout</span>
              <code>display: flex</code>
            </>
          ),
          onSelect: () => {
            if (!document) return
            const plan = planEnableComposeAutoLayout(document, entity.id, idFactory)
            if (plan.ok) dispatch(plan.command)
          },
        }]}
        menuLabel={zh ? '布局类型' : 'Layout type'}
        trigger="+"
        triggerLabel={zh ? '添加布局' : 'Add layout'}
      />
    )
  }
}

/** 创建 Layout Inspector 分组标题栏状态与整体重置操作。 @internal */
export function createLayoutInspectorHeaderActions(
  idFactory: InspectorIdFactory,
): ComponentType<ComposeComponentInspectorProps> {
  return function LayoutInspectorHeaderActions({
    document,
    entity,
    dispatch,
    layoutSnapshot,
    readOnly,
    value,
  }) {
    const zh = useZh()
    const layout = value as ComposeFlexLayout
    const defaults = createDefaultComposeFlexLayout()
    const disabled = readOnly || sameLayout(layout, defaults)
    return (
      <div className="flex-layout-inspector__header-actions">
        <span className="flex-layout-inspector__status">Auto Layout</span>
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
        <LayoutActionMenu
          items={[{
            label: zh ? '移除自动布局' : 'Remove auto layout',
            content: zh ? '移除自动布局' : 'Remove auto layout',
            disabled: readOnly || !document || !layoutSnapshot,
            title: !layoutSnapshot
              ? (zh ? '布局结果尚未就绪' : 'Layout result is not ready')
              : undefined,
            onSelect: () => {
              if (!document) return
              const plan = planRemoveComposeAutoLayout(
                document,
                entity.id,
                layoutSnapshot,
                idFactory,
              )
              if (plan.ok) dispatch(plan.command)
            },
          }]}
          menuLabel={zh ? '自动布局操作' : 'Auto layout actions'}
          trigger="⋯"
          triggerLabel={zh ? '更多布局操作' : 'More layout actions'}
        />
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
  const previewStyle: CSSProperties = {
    alignContent: layout.alignContent,
    alignItems: layout.alignItems,
    display: 'flex',
    flexDirection: layout.flexDirection,
    flexWrap: layout.flexWrap,
    rowGap: `${layout.rowGap}px`,
    columnGap: `${layout.columnGap}px`,
    padding: `${layout.padding.top}px ${layout.padding.right}px `
      + `${layout.padding.bottom}px ${layout.padding.left}px`,
    justifyContent: layout.justifyContent,
  }
  const gapStatus = layout.rowGap === layout.columnGap
    ? String(layout.rowGap)
    : `${layout.rowGap}/${layout.columnGap}`
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
          <code>
            {layout.flexDirection} · {layout.flexWrap} · gap {gapStatus}
          </code>
        </header>
        <div
          aria-hidden="true"
          className="flex-layout-inspector__preview-surface"
          data-wrap-preview={layout.flexWrap !== 'nowrap'}
          style={previewStyle}
        >
          {[1, 2, 3, 4, 5].map((index) => (
            <span data-flex-preview-node="" key={index}>{index}</span>
          ))}
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
        v.object({
          rowGap: v.pipe(v.number(), v.minValue(0)),
          columnGap: v.pipe(v.number(), v.minValue(0)),
        }),
        v.title(zh ? '项间距' : 'Item gap'),
        v.metadata({ propertyPanel: { editor: 'gap' } }),
      ),
      alignContent: v.pipe(
        v.picklist([
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
        v.picklist(['flex-start', 'center', 'flex-end', 'stretch', 'baseline']),
        v.title(zh ? '交叉轴' : 'Cross axis'),
        v.metadata({ propertyPanel: { editor: 'align-items' } }),
      ),
      padding: v.pipe(
        v.custom<ComposeEdges>((candidate) => isInspectorEdgesValue(candidate)
          && candidate.top >= 0
          && candidate.right >= 0
          && candidate.bottom >= 0
          && candidate.left >= 0),
        v.title(zh ? '内边距' : 'Padding'),
        v.metadata({ propertyPanel: { editor: 'padding' } }),
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
            value={{
              flexDirection: layout.flexDirection,
              flexWrap: layout.flexWrap,
              gap: { rowGap: layout.rowGap, columnGap: layout.columnGap },
              alignContent: layout.alignContent,
              justifyContent: layout.justifyContent,
              alignItems: layout.alignItems,
              padding: layout.padding,
            }}
            onValueChange={(next) => {
              if (readOnly) return
              dispatch(createLayoutCommand(
                idFactory,
                entity,
                {
                  type: 'flex',
                  flexDirection: next.flexDirection,
                  flexWrap: next.flexWrap,
                  rowGap: next.gap.rowGap,
                  columnGap: next.gap.columnGap,
                  padding: next.padding,
                  alignContent: next.alignContent,
                  justifyContent: next.justifyContent,
                  alignItems: next.alignItems,
                },
                zh,
              ))
            }}
          />
        </FlexDirectionIconContext.Provider>
        <FlexLayoutPreview
          layout={layout}
          zh={zh}
        />
      </div>
    )
  }
}
