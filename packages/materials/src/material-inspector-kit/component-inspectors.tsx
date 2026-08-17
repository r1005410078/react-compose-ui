import { createContext, useContext, useId, useMemo, useState } from 'react'
import * as v from 'valibot'
import {
  BUILTIN_COMMAND_TYPES,
  DEFAULT_COMPOSE_APPEARANCE,
  createDefaultComposeLayoutItem,
  getComposeAppearance,
  adoptComposeCrossAxisSizing,
  getComposeClip,
  getComposeHierarchy,
  getComposeLayout,
  getComposeRenderer,
  getComposeSpatialTransform,
  resolveComposeAppearance,
  resolveComposeOverflow,
  type ComposeAppearance,
  type ComposeAxisSizing,
  type ComposeColor,
  type ComposeEdges,
  type ComposeEntity,
  type ComposeGeometryConstraints,
  type ComposeLayoutItem,
  type ComposePaint,
  type EditorCommand,
  type JsonObject,
  type JsonValue,
} from '@compose-ui/core'
import {
  ComposePropertyPanel,
  type ComposePropertyPanelRenderer,
  type ComposePropertyPanelRendererProps,
} from '@compose-ui/property-panel'
import type { ComponentType } from 'react'
import type { ComposeComponentInspectorProps } from '@compose-ui/component-registry'
import {
  DEFAULT_COMPOSE_CLIP,
  DEFAULT_COMPOSE_GEOMETRY_CONSTRAINTS,
  DEFAULT_COMPOSE_LOCK,
  DEFAULT_COMPOSE_TRANSFORM,
  DEFAULT_COMPOSE_VISIBILITY,
} from '../builtin-component-defaults'
import {
  InspectorEdgesEditor,
  InspectorNumberDraftInput,
} from './edge-editor'
import { isInspectorEdgesValue } from './edge-model'
import { useZh } from './use-zh'
import type { InspectorIdFactory } from './renderer-inspectors'

function command(
  idFactory: InspectorIdFactory,
  entity: ComposeEntity,
  type: string,
  payload: JsonObject,
  label: string,
): EditorCommand {
  return {
    id: idFactory(),
    type,
    payload,
    meta: {
      label,
      source: 'inspector',
      targetIds: [entity.id],
      mergeKey: `inspector:${entity.id}:${type}`,
    },
  }
}

interface BasicGeometryInspectorView {
  readonly computedHeight: number
  readonly computedWidth: number
  readonly fillAllowed: boolean
  readonly hugAllowed: boolean
  readonly zh: boolean
}

const BasicGeometryInspectorContext = createContext<BasicGeometryInspectorView>({
  computedHeight: 0,
  computedWidth: 0,
  fillAllowed: false,
  hugAllowed: false,
  zh: true,
})

interface BasicSizeValue {
  readonly width: ComposeAxisSizing
  readonly height: ComposeAxisSizing
}

interface BasicPositionValue {
  readonly x: number
  readonly y: number
}

interface BasicGeometryValue {
  /** 父级为 Auto Layout 容器时才出现：true 表示子级已脱流为 Absolute。 */
  readonly ignoreLayout?: boolean
  readonly position?: { readonly x: number; readonly y: number }
  readonly alignSelf?: ComposeLayoutItem['alignSelf']
  readonly rotation: number
  readonly size: BasicSizeValue
  readonly margin: ComposeEdges
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isAxisSizing(value: unknown): value is ComposeAxisSizing {
  if (!isRecord(value)) return false
  return (value.mode === 'fixed' || value.mode === 'fill' || value.mode === 'hug')
    && isFiniteNumber(value.value)
    && (value.min === null || isFiniteNumber(value.min))
    && (value.max === null || isFiniteNumber(value.max))
}

function isBasicSizeValue(value: unknown): value is BasicSizeValue {
  return isRecord(value) && isAxisSizing(value.width) && isAxisSizing(value.height)
}

function isBasicPositionValue(value: unknown): value is BasicPositionValue {
  return isRecord(value) && isFiniteNumber(value.x) && isFiniteNumber(value.y)
}

// eslint-disable-next-line react-refresh/only-export-components -- 组件仅注册到当前 Inspector 的实例级 renderer。
function BasicPositionEditor({ commit, readOnly, value }: ComposePropertyPanelRendererProps) {
  const zh = useZh()
  const position = value as unknown as BasicPositionValue
  return (
    <div className="layout-item-inspector__position">
      <InspectorNumberDraftInput
        label={zh ? '位置 X' : 'Position X'}
        prefix="X"
        readOnly={readOnly}
        value={position.x}
        onCommit={(x) => commit({ ...position, x }, 'commit')}
      />
      <InspectorNumberDraftInput
        label={zh ? '位置 Y' : 'Position Y'}
        prefix="Y"
        readOnly={readOnly}
        value={position.y}
        onCommit={(y) => commit({ ...position, y }, 'commit')}
      />
    </div>
  )
}

// eslint-disable-next-line react-refresh/only-export-components -- 仅作为领域 Inspector 内部尺寸编辑器。
function AxisSizingControl({
  axis,
  computed,
  onCommit,
  readOnly,
  sizing,
  suggestions,
  zh,
}: {
  readonly axis: 'width' | 'height'
  readonly computed: number
  readonly onCommit: (sizing: ComposeAxisSizing) => void
  readonly readOnly: boolean
  readonly sizing: ComposeAxisSizing
  readonly suggestions: readonly {
    readonly value: Extract<ComposeAxisSizing['mode'], 'fill' | 'hug'>
    readonly label: 'Fill' | 'Hug'
  }[]
  readonly zh: boolean
}) {
  const computedId = useId()
  const listboxId = useId()
  const external = `${sizing.mode}:${sizing.value}`
  const displayValue = sizing.mode === 'fixed'
    ? String(sizing.value)
    : (sizing.mode === 'fill' ? 'Fill' : 'Hug')
  const [draft, setDraft] = useState({
    external,
    text: displayValue,
    dirty: false,
  })
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const current = draft.external === external
    ? draft
    : { external, text: displayValue, dirty: false }
  const dimensionLabel = axis === 'width'
    ? (zh ? '尺寸宽度' : 'Size width')
    : (zh ? '尺寸高度' : 'Size height')
  const sizingLabel = axis === 'width'
    ? (zh ? '宽度尺寸' : 'Width sizing')
    : (zh ? '高度尺寸' : 'Height sizing')
  const suggestionsLabel = axis === 'width'
    ? (zh ? '宽度尺寸选项' : 'Width sizing options')
    : (zh ? '高度尺寸选项' : 'Height sizing options')
  const reset = () => {
    setDraft({ external, text: displayValue, dirty: false })
    setOpen(false)
    setActiveIndex(-1)
  }
  const commitMode = (suggestion: (typeof suggestions)[number]) => {
    onCommit({ ...sizing, mode: suggestion.value })
    setDraft({ external, text: suggestion.label, dirty: false })
    setOpen(false)
    setActiveIndex(-1)
  }
  const submit = () => {
    if (!current.dirty) {
      setOpen(false)
      setActiveIndex(-1)
      return
    }
    const text = current.text.trim()
    const suggestion = suggestions.find((candidate) => (
      candidate.label.toLowerCase() === text.toLowerCase()
    ))
    if (suggestion) {
      commitMode(suggestion)
      return
    }
    const candidate = Number(text)
    // Core 要求 AxisSizing.value 为有限正数：0 会让命令在校验期被拒，
    // 表现为「输入框显示新值但文档没变」，因此这里按非法输入回滚草稿。
    if (text !== '' && Number.isFinite(candidate) && candidate > 0) {
      onCommit({ ...sizing, mode: 'fixed', value: candidate })
      setDraft({ external, text: String(candidate), dirty: false })
      setOpen(false)
      setActiveIndex(-1)
      return
    }
    reset()
  }
  return (
    <div
      aria-label={sizingLabel}
      className="layout-item-inspector__axis-sizing"
      data-sizing-mode={sizing.mode}
      role="group"
    >
      <span aria-hidden="true">{axis === 'width' ? 'W' : 'H'}</span>
      <input
        aria-activedescendant={open && activeIndex >= 0
          ? `${listboxId}-option-${activeIndex}`
          : undefined}
        aria-autocomplete="list"
        aria-controls={listboxId}
        aria-describedby={computedId}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={dimensionLabel}
        autoComplete="off"
        disabled={readOnly}
        inputMode="text"
        role="combobox"
        spellCheck={false}
        type="text"
        value={current.text}
        onBlur={() => submit()}
        onChange={(event) => {
          setDraft({ external, text: event.target.value, dirty: true })
          setOpen(suggestions.length > 0)
          setActiveIndex(-1)
        }}
        onFocus={(event) => {
          event.currentTarget.select()
          setOpen(suggestions.length > 0)
          setActiveIndex(-1)
        }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            if (suggestions.length === 0) return
            event.preventDefault()
            const direction = event.key === 'ArrowDown' ? 1 : -1
            setOpen(true)
            setActiveIndex((index) => {
              if (index < 0) return direction > 0 ? 0 : suggestions.length - 1
              return (index + direction + suggestions.length) % suggestions.length
            })
          }
          if (event.key === 'Enter') {
            event.preventDefault()
            const suggestion = open && activeIndex >= 0 ? suggestions[activeIndex] : undefined
            if (suggestion) commitMode(suggestion)
            else submit()
          }
          if (event.key === 'Escape') {
            event.preventDefault()
            reset()
          }
        }}
      />
      {open ? (
        <div
          aria-label={suggestionsLabel}
          className="layout-item-inspector__axis-suggestions"
          id={listboxId}
          role="listbox"
        >
          {suggestions.map((suggestion, index) => (
            <button
              aria-selected={suggestion.value === sizing.mode}
              className="layout-item-inspector__axis-suggestion"
              data-active={activeIndex === index ? '' : undefined}
              id={`${listboxId}-option-${index}`}
              key={suggestion.value}
              role="option"
              tabIndex={-1}
              type="button"
              onMouseDown={(event) => {
                event.preventDefault()
                commitMode(suggestion)
              }}
            >
              {suggestion.label}
            </button>
          ))}
        </div>
      ) : null}
      <span className="layout-item-inspector__sr-only" id={computedId}>
        {zh ? '计算尺寸' : 'Computed size'} {Math.round(computed * 100) / 100} px
      </span>
    </div>
  )
}

const ALIGN_SELF_OPTIONS = [
  { value: 'auto', zh: '自动', en: 'Auto' },
  { value: 'flex-start', zh: '起始', en: 'Start' },
  { value: 'center', zh: '居中', en: 'Center' },
  { value: 'flex-end', zh: '末端', en: 'End' },
  { value: 'stretch', zh: '拉伸', en: 'Stretch' },
  { value: 'baseline', zh: '基线', en: 'Baseline' },
] as const

const ALIGN_SELF_VALUES = ALIGN_SELF_OPTIONS.map((option) => option.value) as [
  'auto',
  'flex-start',
  'center',
  'flex-end',
  'stretch',
  'baseline',
]

// eslint-disable-next-line react-refresh/only-export-components -- 组件仅注册到当前 Inspector 的实例级 renderer。
function BasicSizeEditor({ commit, readOnly, value }: ComposePropertyPanelRendererProps) {
  const view = useContext(BasicGeometryInspectorContext)
  const size = value as unknown as BasicSizeValue
  const suggestions = [
    ...(view.fillAllowed
      ? [{ value: 'fill' as const, label: 'Fill' as const }]
      : []),
    ...(view.hugAllowed
      ? [{ value: 'hug' as const, label: 'Hug' as const }]
      : []),
  ]
  return (
    <div className="layout-item-inspector__size">
      <AxisSizingControl
        axis="width"
        computed={view.computedWidth}
        readOnly={readOnly}
        sizing={size.width}
        suggestions={suggestions}
        zh={view.zh}
        onCommit={(width) => commit({ ...size, width }, 'commit')}
      />
      <AxisSizingControl
        axis="height"
        computed={view.computedHeight}
        readOnly={readOnly}
        sizing={size.height}
        suggestions={suggestions}
        zh={view.zh}
        onCommit={(height) => commit({ ...size, height }, 'commit')}
      />
    </div>
  )
}

// eslint-disable-next-line react-refresh/only-export-components -- 组件仅注册到当前 Inspector 的实例级 renderer。
function BasicMarginEditor({ commit, label, readOnly, value }: ComposePropertyPanelRendererProps) {
  const zh = useZh()
  const margin = value as ComposeEdges
  return (
    <InspectorEdgesEditor
      collapseLabel={zh ? '收起并联动外边距' : 'Collapse and link margin edges'}
      expandLabel={zh ? '展开外边距' : 'Expand margin edges'}
      label={label}
      readOnly={readOnly}
      value={margin}
      onCommit={(next) => commit(next, 'commit')}
    />
  )
}

const BASIC_GEOMETRY_RENDERERS: readonly ComposePropertyPanelRenderer[] = [
  {
    id: 'basic-geometry-position',
    component: BasicPositionEditor,
    layout: 'inline',
  },
  {
    id: 'basic-geometry-size',
    component: BasicSizeEditor,
    layout: 'inline',
  },
  {
    id: 'basic-geometry-margin',
    component: BasicMarginEditor,
    layout: 'inline',
  },
]

/** 创建 LayoutItem Component Inspector。 @internal */
export function createLayoutItemInspector(
  idFactory: InspectorIdFactory,
): ComponentType<ComposeComponentInspectorProps> {
  return function LayoutItemInspector({
    document,
    entity,
    dispatch,
    layoutSnapshot,
    readOnly,
    value,
  }) {
    const zh = useZh()
    const item = value as ComposeLayoutItem
    // 找父级需要扫描整张 entities 表；文档不变时结果也不变，因此按文档引用缓存，
    // 避免每次 Inspector 渲染都在大文档上做一次全表扫描。
    const parent = useMemo(() => (document
      ? Object.values(document.entities).find((candidate) =>
          getComposeHierarchy(candidate)?.childIds.includes(entity.id))
      : undefined), [document, entity.id])
    const parentLayout = parent ? getComposeLayout(parent) : undefined
    const fillAllowed = item.positioning === 'flow' && Boolean(parentLayout)
    // 「忽略 Auto Layout」是 Flow↔Absolute 的唯一显式转换入口；拖拽不再隐式脱流。
    const detachAllowed = Boolean(parentLayout)
    const hierarchy = getComposeHierarchy(entity)
    const hugAllowed = hierarchy ? Boolean(getComposeLayout(entity)) : Boolean(getComposeRenderer(entity))
    const box = layoutSnapshot?.boxes[entity.id]
    const transform = getComposeSpatialTransform(entity)
    const schema = useMemo<v.GenericSchema<BasicGeometryValue>>(() => {
      const sizingModes = fillAllowed
        ? (hugAllowed ? ['fixed', 'fill', 'hug'] as const : ['fixed', 'fill'] as const)
        : (hugAllowed ? ['fixed', 'hug'] as const : ['fixed'] as const)
      const sharedFields = {
        rotation: v.pipe(
          v.number(),
          v.finite(zh ? '旋转必须是有限数字' : 'Rotation must be finite'),
          v.title(zh ? '旋转' : 'Rotation'),
          v.metadata({ propertyPanel: { editor: 'angle' } }),
        ),
        size: v.pipe(v.custom<BasicSizeValue>((candidate) => {
          if (!isBasicSizeValue(candidate)) return false
          const allowedModes: readonly ComposeAxisSizing['mode'][] = sizingModes
          return allowedModes.includes(candidate.width.mode)
            && allowedModes.includes(candidate.height.mode)
            && candidate.width.value > 0
            && candidate.height.value > 0
        }), v.title(zh ? '尺寸' : 'Size'), v.metadata({
          propertyPanel: { editor: 'basic-geometry-size' },
        })),
        margin: v.pipe(v.custom<ComposeEdges>(isInspectorEdgesValue),
          v.title(zh ? '外边距' : 'Margin'), v.metadata({
          propertyPanel: { editor: 'basic-geometry-margin' },
        })),
      }
      // 显式标注 ObjectEntries：条件展开会把字段推断成 Schema | undefined，无法进 v.object。
      const detachField: v.ObjectEntries = detachAllowed
        ? {
            ignoreLayout: v.pipe(
              v.boolean(),
              v.title(zh ? '忽略自动布局' : 'Ignore auto layout'),
            ),
          }
        : {}
      if (item.positioning === 'absolute') {
        return v.object({
          ...detachField,
          position: v.pipe(v.custom<BasicPositionValue>(isBasicPositionValue),
            v.title(zh ? '位置' : 'Position'), v.metadata({
            propertyPanel: { editor: 'basic-geometry-position' },
          })),
          ...sharedFields,
        }) as unknown as v.GenericSchema<BasicGeometryValue>
      }
      return v.object({
        ...detachField,
        alignSelf: v.pipe(v.picklist(ALIGN_SELF_VALUES),
          v.title(zh ? '自身对齐' : 'Align self'), v.metadata({
          propertyPanel: {
            optionLabels: Object.fromEntries(ALIGN_SELF_OPTIONS.map((option) => [
              option.value,
              zh ? option.zh : option.en,
            ])),
          },
        })),
        ...sharedFields,
      }) as unknown as v.GenericSchema<BasicGeometryValue>
    }, [detachAllowed, fillAllowed, hugAllowed, item.positioning, zh])
    const placementValue = item.positioning === 'absolute'
      ? { position: { x: item.offset.x, y: item.offset.y } }
      : { alignSelf: item.alignSelf }
    const viewValue: BasicGeometryValue = {
      ...(detachAllowed ? { ignoreLayout: item.positioning === 'absolute' } : {}),
      ...placementValue,
      rotation: transform.rotation,
      size: { width: item.width, height: item.height },
      margin: item.margin,
    }
    /*
     * 重置基线只覆盖有实例无关默认值的字段。位置与尺寸由摆放和内容决定，没有可恢复的
     * 默认值，因此基线直接复用当前值：Property Panel 深度比较后不会给它们生成重置动作，
     * 同时整个 defaultValue 仍能通过本 Inspector 的 schema 校验（校验失败会禁用全部重置）。
     */
    const defaultValue = useMemo<BasicGeometryValue>(() => ({
      // 脱流状态由用户显式决定，没有实例无关默认值，基线复用当前值使其不参与重置。
      ...(detachAllowed ? { ignoreLayout: item.positioning === 'absolute' } : {}),
      ...(item.positioning === 'absolute'
        ? { position: { x: item.offset.x, y: item.offset.y } }
        : { alignSelf: createDefaultComposeLayoutItem().alignSelf }),
      rotation: DEFAULT_COMPOSE_TRANSFORM.rotation,
      size: { width: item.width, height: item.height },
      margin: createDefaultComposeLayoutItem().margin,
    }), [detachAllowed, item.offset.x, item.offset.y, item.positioning, item.width, item.height])
    const updateLayoutItem = (nextItem: ComposeLayoutItem) => dispatch(command(
      idFactory,
      entity,
      BUILTIN_COMMAND_TYPES.updateComponent,
      { entityId: entity.id, key: 'LayoutItem', value: nextItem as unknown as JsonValue },
      zh ? `修改 ${entity.name} 布局项` : `Update ${entity.name} layout item`,
    ))
    return (
      <BasicGeometryInspectorContext.Provider value={{
        computedHeight: box?.height ?? item.height.value,
        computedWidth: box?.width ?? item.width.value,
        fillAllowed,
        hugAllowed,
        zh,
      }}>
        <div className="layout-item-inspector layout-item-inspector--basic">
          <ComposePropertyPanel
            aria-label={zh ? '基础几何属性' : 'Basic geometry properties'}
            defaultValue={defaultValue}
            readOnly={readOnly}
            renderers={BASIC_GEOMETRY_RENDERERS}
            schema={schema}
            value={viewValue}
            onValueChange={(next, change) => {
              const field = change.path[0]
              if (field === 'ignoreLayout' && next.ignoreLayout !== undefined && parentLayout) {
                if (next.ignoreLayout && item.positioning === 'flow') {
                  // 脱流：offset 从求解 box 反算（减去父级 border，视觉位置不变），
                  // fill 轴烘焙为 fixed（求解尺寸）——与 reparent 移出 Flow 的烘焙规则一致。
                  const borderInset = parent ? resolveComposeAppearance(parent).borderWidth : 0
                  const bakeAxis = (
                    sizing: ComposeAxisSizing,
                    solved: number | undefined,
                  ): ComposeAxisSizing => (sizing.mode === 'fill'
                    ? { ...sizing, mode: 'fixed', value: solved ?? sizing.value }
                    : sizing)
                  updateLayoutItem({
                    ...item,
                    positioning: 'absolute',
                    offset: box
                      ? { x: box.x - borderInset, y: box.y - borderInset }
                      : item.offset,
                    width: bakeAxis(item.width, box?.width),
                    height: bakeAxis(item.height, box?.height),
                  })
                }
                else if (!next.ignoreLayout && item.positioning === 'absolute') {
                  // 回流：保持 childIds 位置不变，按进入容器的既有交叉轴采纳规则改写尺寸。
                  updateLayoutItem(adoptComposeCrossAxisSizing(
                    { ...item, positioning: 'flow' },
                    parentLayout,
                  ))
                }
                return
              }
              if (field === 'position' && next.position) {
                updateLayoutItem({
                  ...item,
                  offset: next.position,
                })
                return
              }
              if (field === 'alignSelf' && next.alignSelf) {
                updateLayoutItem({ ...item, alignSelf: next.alignSelf })
                return
              }
              if (field === 'rotation') {
                dispatch(command(
                  idFactory,
                  entity,
                  BUILTIN_COMMAND_TYPES.setTransform,
                  {
                    operation: 'set',
                    updates: [{
                      entityId: entity.id,
                      transform: { ...transform, rotation: next.rotation },
                    }] as unknown as JsonValue,
                  },
                  zh ? `修改 ${entity.name} 变换` : `Update ${entity.name} transform`,
                ))
                return
              }
              if (field === 'size') {
                const width = next.size.width
                const height = next.size.height
                if ((!fillAllowed && (width.mode === 'fill' || height.mode === 'fill'))
                  || (!hugAllowed && (width.mode === 'hug' || height.mode === 'hug'))) return
                updateLayoutItem({ ...item, width, height })
                return
              }
              if (field === 'margin') updateLayoutItem({ ...item, margin: next.margin })
            }}
          />
        </div>
      </BasicGeometryInspectorContext.Provider>
    )
  }
}

/*
 * 以下 Component Inspectors 仍各自拥有一个 Component；复合几何 Inspector 是唯一跨 Component
 * 的例外，因为位置/尺寸来自 LayoutItem，而独立 Angle 属性必须继续写入 Transform。
 */

/** 创建 Visibility Component Inspector。 @internal */
export function createVisibilityInspector(
  idFactory: InspectorIdFactory,
): ComponentType<ComposeComponentInspectorProps> {
  return function VisibilityInspector({ entity, dispatch, readOnly, value }) {
    const zh = useZh()
    const schema = useMemo(() => v.object({
      visible: v.pipe(v.boolean(), v.title(zh ? '可见' : 'Visible')),
    }), [zh])
    return (
      <ComposePropertyPanel
        aria-label={zh ? '状态属性' : 'State properties'}
        defaultValue={DEFAULT_COMPOSE_VISIBILITY}
        readOnly={readOnly}
        schema={schema}
        value={{ visible: value.visible === true }}
        onValueChange={(next) => {
          if (readOnly) return
          dispatch(command(
            idFactory,
            entity,
            BUILTIN_COMMAND_TYPES.setVisibility,
            { entityIds: [entity.id], visible: next.visible },
            next.visible
              ? (zh ? `显示 ${entity.name}` : `Show ${entity.name}`)
              : (zh ? `隐藏 ${entity.name}` : `Hide ${entity.name}`),
          ))
        }}
      />
    )
  }
}

/** 创建 Lock Component Inspector；锁定 Entity 时仍可解除锁定。 @internal */
export function createLockInspector(
  idFactory: InspectorIdFactory,
): ComponentType<ComposeComponentInspectorProps> {
  return function LockInspector({ entity, dispatch, value }) {
    const zh = useZh()
    const schema = useMemo(() => v.object({
      locked: v.pipe(v.boolean(), v.title(zh ? '锁定' : 'Locked')),
    }), [zh])
    return (
      <ComposePropertyPanel
        aria-label={zh ? '锁定属性' : 'Lock properties'}
        defaultValue={DEFAULT_COMPOSE_LOCK}
        schema={schema}
        value={{ locked: value.locked === true }}
        onValueChange={(next) => dispatch(command(
          idFactory,
          entity,
          BUILTIN_COMMAND_TYPES.setLock,
          { entityIds: [entity.id], locked: next.locked },
          next.locked
            ? (zh ? `锁定 ${entity.name}` : `Lock ${entity.name}`)
            : (zh ? `解锁 ${entity.name}` : `Unlock ${entity.name}`),
        ))}
      />
    )
  }
}

/*
 * Appearance Inspector 的 schema 只覆盖五个字段，shadow 由独立入口编辑，因此重置基线显式
 * 取这五个字段，避免把 shadow 带进 defaultValue 影响深度比较。
 */
const APPEARANCE_INSPECTOR_DEFAULT_VALUE = {
  backgroundPaint: DEFAULT_COMPOSE_APPEARANCE.backgroundPaint,
  borderColor: DEFAULT_COMPOSE_APPEARANCE.borderColor,
  borderWidth: DEFAULT_COMPOSE_APPEARANCE.borderWidth,
  borderRadius: DEFAULT_COMPOSE_APPEARANCE.borderRadius,
  opacity: DEFAULT_COMPOSE_APPEARANCE.opacity,
}

/** 创建 Appearance Component Inspector。 @internal */
export function createAppearanceInspector(
  idFactory: InspectorIdFactory,
): ComponentType<ComposeComponentInspectorProps> {
  return function AppearanceInspector({ entity, dispatch, paintEditPort, readOnly }) {
    const zh = useZh()
    const schema = useMemo(() => v.object({
      backgroundPaint: v.pipe(
        v.unknown(),
        v.title(zh ? '背景填充' : 'Background fill'),
        v.metadata({ propertyPanel: { editor: 'paint' } }),
      ),
      borderColor: v.pipe(
        v.string(),
        v.title(zh ? '边框颜色' : 'Border color'),
        v.metadata({ propertyPanel: { editor: 'color' } }),
      ),
      borderWidth: v.pipe(
        v.number(),
        v.minValue(0),
        v.title(zh ? '边框宽度' : 'Border width'),
        v.metadata({ propertyPanel: { editor: 'stroke-width' } }),
      ),
      borderRadius: v.pipe(
        v.number(),
        v.minValue(0),
        v.title(zh ? '圆角' : 'Corner radius'),
        v.metadata({ propertyPanel: { editor: 'corner-radius' } }),
      ),
      opacity: v.pipe(
        v.number(),
        v.minValue(0),
        v.maxValue(1),
        v.title(zh ? '透明度' : 'Opacity'),
        v.metadata({ propertyPanel: { editor: 'opacity' } }),
      ),
    }), [zh])
    const appearance = resolveComposeAppearance(entity)
    return (
      <ComposePropertyPanel
        aria-label={zh ? '外观属性' : 'Appearance properties'}
        defaultValue={APPEARANCE_INSPECTOR_DEFAULT_VALUE}
        readOnly={readOnly}
        colorEditor={{
          onEyedropperFallback: () => paintEditPort?.sample({
            entityId: entity.id,
            field: 'borderColor',
          }),
        }}
        paintEditor={{
          onOpenChange: (open) => {
            if (open) paintEditPort?.open({ entityId: entity.id })
            else paintEditPort?.close()
          },
          onEyedropperFallback: () => paintEditPort?.sample({
            entityId: entity.id,
            field: 'backgroundPaint',
          }),
        }}
        schema={schema}
        value={{
          backgroundPaint: appearance.backgroundPaint,
          borderColor: appearance.borderColor,
          borderWidth: appearance.borderWidth,
          borderRadius: appearance.borderRadius,
          opacity: appearance.opacity,
        }}
        onValueChange={(next) => {
          // shadow 等未进入本 schema 的字段必须原样保留，setAppearance 是整体替换语义。
          const current = getComposeAppearance(entity)
          const appearanceValue: ComposeAppearance = {
            ...current,
            ...next,
            backgroundPaint: next.backgroundPaint as ComposePaint,
            borderColor: next.borderColor as ComposeColor,
          }
          dispatch(command(
            idFactory,
            entity,
            BUILTIN_COMMAND_TYPES.setAppearance,
            { entityId: entity.id, appearance: appearanceValue },
            zh ? `修改 ${entity.name} 外观` : `Update ${entity.name} appearance`,
          ))
        }}
      />
    )
  }
}

const OVERFLOW_VALUES = ['visible', 'clip', 'scroll'] as const

/** 创建 Hierarchy（容器）Component Inspector；同时呈现分轴溢出设置。 @internal */
export function createHierarchyInspector(
  idFactory: InspectorIdFactory,
): ComponentType<ComposeComponentInspectorProps> {
  return function HierarchyInspector({ entity, dispatch, readOnly }) {
    const zh = useZh()
    const hierarchy = getComposeHierarchy(entity)
    const clip = getComposeClip(entity)
    const overflow = resolveComposeOverflow(entity)
    const childCountSchema = useMemo(() => v.object({
      childCount: v.pipe(
        v.number(),
        v.title(zh ? '子项数量' : 'Child count'),
        v.metadata({ propertyPanel: { readOnly: true } }),
      ),
    }), [zh])
    const schema = useMemo(() => v.object({
      childCount: v.pipe(
        v.number(),
        v.title(zh ? '子项数量' : 'Child count'),
        v.metadata({ propertyPanel: { readOnly: true } }),
      ),
      horizontal: v.pipe(
        v.picklist(OVERFLOW_VALUES),
        v.title(zh ? '横向溢出' : 'Horizontal overflow'),
        v.metadata({ propertyPanel: { optionLabels: {
          visible: zh ? '可见' : 'Visible',
          clip: zh ? '裁剪' : 'Clip',
          scroll: zh ? '滚动' : 'Scroll',
        } } }),
      ),
      vertical: v.pipe(
        v.picklist(OVERFLOW_VALUES),
        v.title(zh ? '纵向溢出' : 'Vertical overflow'),
        v.metadata({ propertyPanel: { optionLabels: {
          visible: zh ? '可见' : 'Visible',
          clip: zh ? '裁剪' : 'Clip',
          scroll: zh ? '滚动' : 'Scroll',
        } } }),
      ),
    }), [zh])
    if (!hierarchy) return null
    if (!clip) {
      return (
        <ComposePropertyPanel
          aria-label={zh ? '容器属性' : 'Container properties'}
          readOnly
          schema={childCountSchema}
          value={{ childCount: hierarchy.childIds.length }}
        />
      )
    }
    return (
      <ComposePropertyPanel
        aria-label={zh ? '容器属性' : 'Container properties'}
        // childCount 是只读派生值，没有可恢复的默认值，基线跟随当前值以避免出现禁用的重置动作。
        defaultValue={{
          childCount: hierarchy.childIds.length,
          horizontal: DEFAULT_COMPOSE_CLIP.horizontal,
          vertical: DEFAULT_COMPOSE_CLIP.vertical,
        }}
        readOnly={readOnly}
        schema={schema}
        value={{
          childCount: hierarchy.childIds.length,
          horizontal: overflow.horizontal,
          vertical: overflow.vertical,
        }}
        onValueChange={(next) => {
          if (readOnly) return
          dispatch(command(
            idFactory,
            entity,
            BUILTIN_COMMAND_TYPES.configureClip,
            {
              entityIds: [entity.id],
              horizontal: next.horizontal,
              vertical: next.vertical,
            },
            zh ? `修改 ${entity.name} 溢出` : `Update ${entity.name} overflow`,
          ))
        }}
      />
    )
  }
}

/** 创建 GeometryConstraints Component Inspector。 @internal */
export function createConstraintsInspector(
  idFactory: InspectorIdFactory,
): ComponentType<ComposeComponentInspectorProps> {
  return function ConstraintsInspector({ entity, dispatch, readOnly, value }) {
    const zh = useZh()
    const constraints = value as ComposeGeometryConstraints
    const schema = useMemo(() => v.object({
      movable: v.pipe(v.boolean(), v.title(zh ? '允许移动' : 'Movable')),
      resize: v.pipe(
        v.picklist(['free', 'preserve-aspect', 'horizontal', 'vertical', 'none']),
        v.title(zh ? 'Resize 模式' : 'Resize mode'),
        v.metadata({ propertyPanel: { optionLabels: zh
          ? {
              free: '自由',
              'preserve-aspect': '保持比例',
              horizontal: '仅水平',
              vertical: '仅垂直',
              none: '禁止',
            }
          : {
              free: 'Free',
              'preserve-aspect': 'Preserve aspect',
              horizontal: 'Horizontal only',
              vertical: 'Vertical only',
              none: 'Disabled',
            } } }),
      ),
      rotatable: v.pipe(v.boolean(), v.title(zh ? '允许旋转' : 'Rotatable')),
    }), [zh])
    return (
      <ComposePropertyPanel
        aria-label={zh ? '几何限制属性' : 'Geometry constraints'}
        defaultValue={DEFAULT_COMPOSE_GEOMETRY_CONSTRAINTS}
        readOnly={readOnly}
        schema={schema}
        value={{
          movable: constraints.movable,
          resize: constraints.resize,
          rotatable: constraints.rotatable,
        }}
        onValueChange={(next) => {
          const nextValue: ComposeGeometryConstraints = { ...constraints, ...next }
          dispatch(command(
            idFactory,
            entity,
            BUILTIN_COMMAND_TYPES.updateComponent,
            { entityId: entity.id, key: 'GeometryConstraints', value: nextValue },
            zh ? `修改 ${entity.name} 几何限制` : `Update ${entity.name} constraints`,
          ))
        }}
      />
    )
  }
}
