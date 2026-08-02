import { createContext, useContext, useId, useMemo, useState } from 'react'
import * as v from 'valibot'
import {
  BUILTIN_COMMAND_TYPES,
  getComposeAppearance,
  getComposeClip,
  getComposeHierarchy,
  getComposeLayout,
  getComposeRenderer,
  getComposeSpatialTransform,
  resolveComposeAppearance,
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
import { ComposeAnglePicker } from '@compose-ui/components'
import {
  ComposePropertyPanel,
  type ComposePropertyPanelRenderer,
  type ComposePropertyPanelRendererProps,
} from '@compose-ui/property-panel'
import { useComposeI18nContext } from '@compose-ui/ui-context'
import type { ComponentType } from 'react'
import type { ComposeComponentInspectorProps } from '@compose-ui/component-registry'
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

function useZh(): boolean {
  return (useComposeI18nContext()?.locale ?? 'zh-CN') === 'zh-CN'
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

interface BasicTransformValue {
  readonly positioning: ComposeLayoutItem['positioning']
  readonly x: number
  readonly y: number
  readonly rotation: number
  readonly alignSelf: ComposeLayoutItem['alignSelf']
}

interface BasicSizeValue {
  readonly width: ComposeAxisSizing
  readonly height: ComposeAxisSizing
}

interface NumberDraftInputProps {
  readonly label: string
  readonly prefix?: string
  readonly min?: number
  readonly readOnly: boolean
  readonly value: number
  readonly onCommit: (value: number) => void
}

// eslint-disable-next-line react-refresh/only-export-components -- 仅作为领域 Inspector 内部数值编辑器。
function NumberDraftInput({
  label,
  min,
  onCommit,
  prefix,
  readOnly,
  value,
}: NumberDraftInputProps) {
  const [draft, setDraft] = useState({ external: value, text: String(value), dirty: false })
  const current = Object.is(draft.external, value)
    ? draft
    : { external: value, text: String(value), dirty: false }
  const reset = () => setDraft({ external: value, text: String(value), dirty: false })
  const submit = () => {
    if (!current.dirty || current.text.trim() === '') return
    const candidate = Number(current.text)
    if (!Number.isFinite(candidate) || (min !== undefined && candidate < min)) return
    onCommit(candidate)
    setDraft({ external: value, text: String(candidate), dirty: false })
  }
  return (
    <label className="layout-item-inspector__number">
      {prefix ? <span aria-hidden="true">{prefix}</span> : null}
      <input
        aria-label={label}
        disabled={readOnly}
        min={min}
        step="any"
        type="number"
        value={current.text}
        onBlur={submit}
        onChange={(event) => setDraft({ external: value, text: event.target.value, dirty: true })}
        onKeyDown={(event) => {
          if (event.key === 'Enter') submit()
          if (event.key === 'Escape') {
            event.preventDefault()
            reset()
          }
        }}
      />
    </label>
  )
}

// eslint-disable-next-line react-refresh/only-export-components -- 组件仅注册到当前 Inspector 的实例级 renderer。
function BasicTransformEditor({ commit, readOnly, value }: ComposePropertyPanelRendererProps) {
  const zh = useZh()
  const transform = value as unknown as BasicTransformValue
  return (
    <div className="layout-item-inspector__transform">
      {transform.positioning === 'absolute' ? (
        <div className="layout-item-inspector__position">
          <NumberDraftInput
            label={zh ? '位置 X' : 'Position X'}
            prefix="X"
            readOnly={readOnly}
            value={transform.x}
            onCommit={(x) => commit({ ...transform, x }, 'commit')}
          />
          <NumberDraftInput
            label={zh ? '位置 Y' : 'Position Y'}
            prefix="Y"
            readOnly={readOnly}
            value={transform.y}
            onCommit={(y) => commit({ ...transform, y }, 'commit')}
          />
        </div>
      ) : (
        <select
          aria-label={zh ? '自身对齐' : 'Align self'}
          disabled={readOnly}
          value={transform.alignSelf}
          onChange={(event) => commit({ ...transform, alignSelf: event.target.value }, 'commit')}
        >
          {ALIGN_SELF_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>{zh ? option.zh : option.en}</option>
          ))}
        </select>
      )}
      <ComposeAnglePicker
        label={zh ? '旋转' : 'Rotation'}
        readOnly={readOnly}
        value={transform.rotation}
        onValueCommit={(rotation) => commit({ ...transform, rotation }, 'commit')}
      />
    </div>
  )
}

// eslint-disable-next-line react-refresh/only-export-components -- 仅作为领域 Inspector 内部尺寸编辑器。
function AxisSizingControl({
  axis,
  computed,
  modes,
  onCommit,
  readOnly,
  sizing,
  zh,
}: {
  readonly axis: 'width' | 'height'
  readonly computed: number
  readonly modes: readonly { readonly value: ComposeAxisSizing['mode']; readonly label: string }[]
  readonly onCommit: (sizing: ComposeAxisSizing) => void
  readonly readOnly: boolean
  readonly sizing: ComposeAxisSizing
  readonly zh: boolean
}) {
  const computedId = useId()
  const external = `${sizing.mode}:${sizing.value}`
  const modeLabel = modes.find((mode) => mode.value === sizing.mode)?.label ?? sizing.mode
  const [draft, setDraft] = useState({
    external,
    text: sizing.mode === 'fixed' ? String(sizing.value) : modeLabel,
    dirty: false,
  })
  const current = draft.external === external
    ? draft
    : { external, text: sizing.mode === 'fixed' ? String(sizing.value) : modeLabel, dirty: false }
  const dimensionLabel = axis === 'width'
    ? (zh ? '尺寸宽度' : 'Size width')
    : (zh ? '尺寸高度' : 'Size height')
  const submit = () => {
    if (!current.dirty || current.text.trim() === '') return
    const candidate = Number(current.text)
    if (!Number.isFinite(candidate) || candidate < 0) return
    onCommit({ ...sizing, mode: 'fixed', value: candidate })
    setDraft({ external, text: String(candidate), dirty: false })
  }
  return (
    <div className="layout-item-inspector__axis-sizing">
      <span aria-hidden="true">{axis === 'width' ? 'W' : 'H'}</span>
      <input
        aria-describedby={computedId}
        aria-label={dimensionLabel}
        disabled={readOnly}
        inputMode="decimal"
        type="text"
        value={current.text}
        onBlur={submit}
        onChange={(event) => setDraft({ external, text: event.target.value, dirty: true })}
        onFocus={(event) => event.currentTarget.select()}
        onKeyDown={(event) => {
          if (event.key === 'Enter') submit()
          if (event.key === 'Escape') {
            event.preventDefault()
            setDraft({
              external,
              text: sizing.mode === 'fixed' ? String(sizing.value) : modeLabel,
              dirty: false,
            })
          }
        }}
      />
      <select
        aria-label={axis === 'width'
          ? (zh ? '宽度模式' : 'Width mode')
          : (zh ? '高度模式' : 'Height mode')}
        disabled={readOnly}
        value={sizing.mode}
        onChange={(event) => {
          const mode = event.target.value as ComposeAxisSizing['mode']
          onCommit({ ...sizing, mode, value: mode === 'fixed' ? computed : sizing.value })
        }}
      >
        {modes.map((mode) => <option key={mode.value} value={mode.value}>{mode.label}</option>)}
      </select>
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

// eslint-disable-next-line react-refresh/only-export-components -- 组件仅注册到当前 Inspector 的实例级 renderer。
function BasicSizeEditor({ commit, readOnly, value }: ComposePropertyPanelRendererProps) {
  const view = useContext(BasicGeometryInspectorContext)
  const size = value as unknown as BasicSizeValue
  const modes = [
    { value: 'fixed' as const, label: view.zh ? '固定' : 'Fixed' },
    ...(view.fillAllowed
      ? [{ value: 'fill' as const, label: view.zh ? '填充' : 'Fill' }]
      : []),
    ...(view.hugAllowed
      ? [{ value: 'hug' as const, label: view.zh ? '适应' : 'Hug' }]
      : []),
  ]
  return (
    <div className="layout-item-inspector__size">
      <AxisSizingControl
        axis="width"
        computed={view.computedWidth}
        modes={modes}
        readOnly={readOnly}
        sizing={size.width}
        zh={view.zh}
        onCommit={(width) => commit({ ...size, width }, 'commit')}
      />
      <AxisSizingControl
        axis="height"
        computed={view.computedHeight}
        modes={modes}
        readOnly={readOnly}
        sizing={size.height}
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
  const linked = margin.top === margin.right
    && margin.top === margin.bottom
    && margin.top === margin.left
  const [expanded, setExpanded] = useState(!linked)
  const showEdges = expanded || !linked
  if (!showEdges) {
    return (
      <div className="layout-item-inspector__edges layout-item-inspector__edges--linked">
        <NumberDraftInput
          label={label}
          readOnly={readOnly}
          value={margin.top}
          onCommit={(candidate) => commit({
            top: candidate,
            right: candidate,
            bottom: candidate,
            left: candidate,
          }, 'commit')}
        />
        <button
          aria-label={zh ? '展开外边距' : 'Expand margin edges'}
          disabled={readOnly}
          type="button"
          onClick={() => setExpanded(true)}
        >
          ⛶
        </button>
      </div>
    )
  }
  return (
    <div className="layout-item-inspector__edges layout-item-inspector__edges--expanded">
      {(['top', 'right', 'bottom', 'left'] as const).map((edge) => (
        <NumberDraftInput
          key={edge}
          label={`${label} ${edge}`}
          prefix={({ top: 'T', right: 'R', bottom: 'B', left: 'L' })[edge]}
          readOnly={readOnly}
          value={margin[edge]}
          onCommit={(candidate) => commit({ ...margin, [edge]: candidate }, 'commit')}
        />
      ))}
      <button
        aria-label={zh ? '收起并联动外边距' : 'Collapse and link margin edges'}
        disabled={readOnly}
        type="button"
        onClick={() => {
          commit({ top: margin.top, right: margin.top, bottom: margin.top, left: margin.top })
          setExpanded(false)
        }}
      >
        ↔
      </button>
    </div>
  )
}

const BASIC_GEOMETRY_RENDERERS: readonly ComposePropertyPanelRenderer[] = [
  {
    id: 'basic-geometry-transform',
    component: BasicTransformEditor,
    layout: 'full-width',
  },
  {
    id: 'basic-geometry-size',
    component: BasicSizeEditor,
    layout: 'full-width',
  },
  {
    id: 'basic-geometry-margin',
    component: BasicMarginEditor,
    layout: 'full-width',
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
    const parent = document && Object.values(document.entities).find((candidate) =>
      getComposeHierarchy(candidate)?.childIds.includes(entity.id))
    const fillAllowed = item.positioning === 'flow' && Boolean(parent && getComposeLayout(parent))
    const hierarchy = getComposeHierarchy(entity)
    const hugAllowed = hierarchy ? Boolean(getComposeLayout(entity)) : Boolean(getComposeRenderer(entity))
    const box = layoutSnapshot?.boxes[entity.id]
    const transform = getComposeSpatialTransform(entity)
    const schema = useMemo(() => {
      const sizingModes = fillAllowed
        ? (hugAllowed ? ['fixed', 'fill', 'hug'] as const : ['fixed', 'fill'] as const)
        : (hugAllowed ? ['fixed', 'hug'] as const : ['fixed'] as const)
      return v.object({
        transform: v.pipe(v.object({
          positioning: v.picklist(['flow', 'absolute']),
          x: v.number(),
          y: v.number(),
          rotation: v.number(),
          alignSelf: v.picklist(['auto', 'flex-start', 'center', 'flex-end', 'stretch', 'baseline']),
        }), v.title(zh ? '变换' : 'Transform'), v.metadata({
          propertyPanel: { editor: 'basic-geometry-transform' },
        })),
        size: v.pipe(v.object({
          width: v.object({
            mode: v.picklist(sizingModes),
            value: v.pipe(v.number(), v.minValue(0)),
            min: v.nullable(v.number()),
            max: v.nullable(v.number()),
          }),
          height: v.object({
            mode: v.picklist(sizingModes),
            value: v.pipe(v.number(), v.minValue(0)),
            min: v.nullable(v.number()),
            max: v.nullable(v.number()),
          }),
        }), v.title(zh ? '尺寸' : 'Size'), v.metadata({
          propertyPanel: { editor: 'basic-geometry-size' },
        })),
        margin: v.pipe(v.object({
          top: v.number(),
          right: v.number(),
          bottom: v.number(),
          left: v.number(),
        }), v.title(zh ? '外边距' : 'Margin'), v.metadata({
          propertyPanel: { editor: 'basic-geometry-margin' },
        })),
      })
    }, [fillAllowed, hugAllowed, zh])
    const viewValue = {
      transform: {
        positioning: item.positioning,
        x: item.offset.x,
        y: item.offset.y,
        rotation: transform.rotation,
        alignSelf: item.alignSelf,
      },
      size: { width: item.width, height: item.height },
      margin: item.margin,
    }
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
            readOnly={readOnly}
            renderers={BASIC_GEOMETRY_RENDERERS}
            schema={schema}
            value={viewValue}
            onValueChange={(next, change) => {
              const field = change.path[0]
              if (field === 'transform') {
                if (next.transform.rotation !== transform.rotation) {
                  dispatch(command(
                    idFactory,
                    entity,
                    BUILTIN_COMMAND_TYPES.setTransform,
                    {
                      operation: 'set',
                      updates: [{
                        entityId: entity.id,
                        transform: { ...transform, rotation: next.transform.rotation },
                      }] as unknown as JsonValue,
                    },
                    zh ? `修改 ${entity.name} 变换` : `Update ${entity.name} transform`,
                  ))
                  return
                }
                updateLayoutItem({
                  ...item,
                  offset: { x: next.transform.x, y: next.transform.y },
                  alignSelf: next.transform.alignSelf,
                })
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
 * 的例外，因为位置/尺寸来自 LayoutItem，而旋转必须继续写入 Transform。
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

/** 创建 Hierarchy（容器）Component Inspector；同时呈现 Clip 开关。 @internal */
export function createHierarchyInspector(
  idFactory: InspectorIdFactory,
): ComponentType<ComposeComponentInspectorProps> {
  return function HierarchyInspector({ entity, dispatch, readOnly }) {
    const zh = useZh()
    const hierarchy = getComposeHierarchy(entity)
    const clip = getComposeClip(entity)
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
      clip: v.pipe(v.boolean(), v.title(zh ? '裁剪内容' : 'Clip content')),
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
        readOnly={readOnly}
        schema={schema}
        value={{
          childCount: hierarchy.childIds.length,
          clip: clip.enabled,
        }}
        onValueChange={(next) => {
          if (readOnly) return
          dispatch(command(
            idFactory,
            entity,
            BUILTIN_COMMAND_TYPES.setClip,
            { entityIds: [entity.id], enabled: next.clip },
            zh ? `修改 ${entity.name} 裁剪` : `Update ${entity.name} clipping`,
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
