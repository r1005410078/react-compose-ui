import { createContext, useContext, useMemo, useRef, useState } from 'react'
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
  type ComposeTransform,
  type EditorCommand,
  type JsonObject,
  type JsonValue,
} from '@compose-ui/core'
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

interface LayoutItemInspectorView {
  readonly computedHeight: number
  readonly computedWidth: number
  readonly fillAllowed: boolean
  readonly hugAllowed: boolean
  readonly zh: boolean
}

const LayoutItemInspectorContext = createContext<LayoutItemInspectorView>({
  computedHeight: 0,
  computedWidth: 0,
  fillAllowed: false,
  hugAllowed: false,
  zh: true,
})

const LAYOUT_ITEM_CSS_NAMES: Readonly<Record<string, string>> = {
  'layout-item-position': 'position',
  'layout-item-offset': 'inset',
  'layout-item-width': 'width',
  'layout-item-height': 'height',
  'layout-item-margin': 'margin',
  'layout-item-align-self': 'align-self',
}

// eslint-disable-next-line react-refresh/only-export-components -- 组件仅注册到当前 Inspector 的实例级 renderer。
function LayoutItemFieldLabel({ label, metadata }: ComposePropertyPanelRendererProps) {
  const cssName = typeof metadata.editor === 'string'
    ? LAYOUT_ITEM_CSS_NAMES[metadata.editor]
    : undefined
  return (
    <span className="layout-item-inspector__field-label">
      <span>{label}</span>
      {cssName ? <code>{cssName}</code> : null}
    </span>
  )
}

// eslint-disable-next-line react-refresh/only-export-components -- 组件仅注册到当前 Inspector 的实例级 renderer。
function LayoutPositionEditor({ commit, label, readOnly, value }: ComposePropertyPanelRendererProps) {
  const zh = useZh()
  const buttons = useRef<(HTMLButtonElement | null)[]>([])
  const options = [
    { value: 'flow', label: 'Flow' },
    { value: 'absolute', label: 'Absolute' },
  ] as const
  const selectedIndex = options.findIndex((option) => option.value === value)
  return (
    <div aria-label={label} className="layout-item-inspector__segments" role="radiogroup">
      {options.map((option, index) => (
        <button
          aria-checked={option.value === value}
          aria-label={option.label}
          disabled={readOnly}
          key={option.value}
          ref={(node) => {
            buttons.current[index] = node
          }}
          role="radio"
          tabIndex={selectedIndex === index ? 0 : -1}
          type="button"
          onClick={() => commit(option.value)}
          onKeyDown={(event) => {
            const step = event.key === 'ArrowRight' || event.key === 'ArrowDown'
              ? 1
              : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 0
            if (!step) return
            event.preventDefault()
            const next = (index + step + options.length) % options.length
            buttons.current[next]?.focus()
            commit(options[next]!.value)
          }}
        >
          {option.label === 'Flow' ? 'Flow' : (zh ? '绝对' : 'Absolute')}
        </button>
      ))}
    </div>
  )
}

// eslint-disable-next-line react-refresh/only-export-components -- 组件仅注册到当前 Inspector 的实例级 renderer。
function LayoutAxisSizingEditor({
  commit,
  label,
  metadata,
  readOnly,
  value,
}: ComposePropertyPanelRendererProps) {
  const view = useContext(LayoutItemInspectorContext)
  const sizing = value as ComposeAxisSizing
  const width = metadata.editor === 'layout-item-width'
  const computed = width ? view.computedWidth : view.computedHeight
  const modes = [
    { value: 'fixed', label: view.zh ? '固定' : 'Fixed' },
    ...(view.fillAllowed ? [{ value: 'fill', label: view.zh ? '填充' : 'Fill' }] : []),
    ...(view.hugAllowed ? [{ value: 'hug', label: view.zh ? '适应' : 'Hug' }] : []),
  ]
  return (
    <div className="layout-item-inspector__axis-sizing">
      <div aria-label={`${label}${view.zh ? '模式' : ' mode'}`} role="radiogroup">
        {modes.map((mode) => (
          <button
            aria-checked={sizing.mode === mode.value}
            aria-label={mode.label}
            disabled={readOnly}
            key={mode.value}
            role="radio"
            type="button"
            onClick={() => commit({ ...sizing, mode: mode.value })}
          >
            {mode.label}
          </button>
        ))}
      </div>
      <input
        aria-label={sizing.mode === 'fixed'
          ? label
          : `${view.zh ? '计算' : 'Computed '}${label}`}
        disabled={readOnly && sizing.mode === 'fixed'}
        min="0"
        readOnly={sizing.mode !== 'fixed'}
        step="any"
        type="number"
        value={sizing.mode === 'fixed' ? sizing.value : computed}
        onChange={(event) => {
          if (sizing.mode !== 'fixed') return
          const candidate = Number(event.target.value)
          if (Number.isFinite(candidate) && candidate >= 0) {
            commit({ ...sizing, value: candidate }, 'input')
          }
        }}
      />
    </div>
  )
}

// eslint-disable-next-line react-refresh/only-export-components -- 组件仅注册到当前 Inspector 的实例级 renderer。
function LayoutMarginEditor({ commit, label, readOnly, value }: ComposePropertyPanelRendererProps) {
  const zh = useZh()
  const margin = value as ComposeEdges
  const linked = margin.top === margin.right
    && margin.top === margin.bottom
    && margin.top === margin.left
  const [expanded, setExpanded] = useState(!linked)
  const showEdges = expanded || !linked
  const update = (edge: keyof ComposeEdges, raw: string) => {
    const candidate = Number(raw)
    if (Number.isFinite(candidate)) commit({ ...margin, [edge]: candidate }, 'input')
  }
  if (!showEdges) {
    return (
      <div className="layout-item-inspector__edges layout-item-inspector__edges--linked">
        <input
          aria-label={label}
          disabled={readOnly}
          step="any"
          type="number"
          value={margin.top}
          onChange={(event) => {
            const candidate = Number(event.target.value)
            if (!Number.isFinite(candidate)) return
            commit({ top: candidate, right: candidate, bottom: candidate, left: candidate }, 'input')
          }}
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
        <label key={edge}>
          <span>{({ top: 'T', right: 'R', bottom: 'B', left: 'L' })[edge]}</span>
          <input
            aria-label={`${label} ${edge}`}
            disabled={readOnly}
            step="any"
            type="number"
            value={margin[edge]}
            onChange={(event) => update(edge, event.target.value)}
          />
        </label>
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

const LAYOUT_ITEM_RENDERERS: readonly ComposePropertyPanelRenderer[] = [
  {
    id: 'layout-item-position',
    component: LayoutPositionEditor,
    labelComponent: LayoutItemFieldLabel,
  },
  ...(['layout-item-width', 'layout-item-height'] as const).map((id) => ({
    id,
    component: LayoutAxisSizingEditor,
    labelComponent: LayoutItemFieldLabel,
    layout: 'full-width' as const,
  })),
  {
    id: 'layout-item-margin',
    component: LayoutMarginEditor,
    labelComponent: LayoutItemFieldLabel,
    layout: 'full-width',
  },
]

/** 创建 Transform Component Inspector。 @internal */
export function createTransformInspector(
  idFactory: InspectorIdFactory,
): ComponentType<ComposeComponentInspectorProps> {
  return function TransformInspector({ entity, dispatch, readOnly, value }) {
    const zh = useZh()
    const schema = useMemo(() => v.object({
      rotation: v.pipe(
        v.number(),
        v.title(zh ? '旋转' : 'Rotation'),
        v.metadata({ propertyPanel: { editor: 'angle' } }),
      ),
    }), [zh])
    return (
      <ComposePropertyPanel
        aria-label={zh ? '变换属性' : 'Transform properties'}
        readOnly={readOnly}
        schema={schema}
        value={value as ComposeTransform}
        onValueChange={(next) => {
          const current = getComposeSpatialTransform(entity)
          dispatch(command(
            idFactory,
            entity,
            BUILTIN_COMMAND_TYPES.setTransform,
            {
              operation: 'set',
              updates: [{
                entityId: entity.id,
                transform: { ...current, rotation: next.rotation },
              }] as unknown as JsonValue,
            },
            zh ? `修改 ${entity.name} 变换` : `Update ${entity.name} transform`,
          ))
        }}
      />
    )
  }
}

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
    const schema = useMemo(() => {
      const sizingModes = fillAllowed
        ? (hugAllowed ? ['fixed', 'fill', 'hug'] as const : ['fixed', 'fill'] as const)
        : (hugAllowed ? ['fixed', 'hug'] as const : ['fixed'] as const)
      return v.object({
      positioning: v.pipe(
        v.picklist(['flow', 'absolute']),
        v.title(zh ? '定位' : 'Positioning'),
        v.metadata({ propertyPanel: { editor: 'layout-item-position' } }),
      ),
      offset: v.pipe(
        v.object({ x: v.number(), y: v.number() }),
        v.title(zh ? '偏移' : 'Offset'),
        v.metadata({ propertyPanel: {
          editor: 'vector2',
          hidden: item.positioning !== 'absolute',
        } }),
      ),
      width: v.pipe(
        v.object({
          mode: v.picklist(sizingModes),
          value: v.pipe(v.number(), v.minValue(0)),
          min: v.nullable(v.number()),
          max: v.nullable(v.number()),
        }),
        v.title(zh ? '宽度' : 'Width'),
        v.metadata({ propertyPanel: { editor: 'layout-item-width' } }),
      ),
      height: v.pipe(
        v.object({
          mode: v.picklist(sizingModes),
          value: v.pipe(v.number(), v.minValue(0)),
          min: v.nullable(v.number()),
          max: v.nullable(v.number()),
        }),
        v.title(zh ? '高度' : 'Height'),
        v.metadata({ propertyPanel: { editor: 'layout-item-height' } }),
      ),
      margin: v.pipe(
        v.object({
          top: v.number(),
          right: v.number(),
          bottom: v.number(),
          left: v.number(),
        }),
        v.title(zh ? '外边距' : 'Margin'),
        v.metadata({ propertyPanel: { editor: 'layout-item-margin' } }),
      ),
      alignSelf: v.pipe(
        v.picklist(['auto', 'flex-start', 'center', 'flex-end', 'stretch', 'baseline']),
        v.title(zh ? '自身对齐' : 'Align self'),
        v.metadata({ propertyPanel: { hidden: item.positioning !== 'flow' } }),
      ),
      })
    }, [fillAllowed, hugAllowed, item.positioning, zh])
    return (
      <LayoutItemInspectorContext.Provider value={{
        computedHeight: box?.height ?? item.height.value,
        computedWidth: box?.width ?? item.width.value,
        fillAllowed,
        hugAllowed,
        zh,
      }}>
        <ComposePropertyPanel
          aria-label={zh ? '布局项属性' : 'Layout item properties'}
          className="layout-item-inspector"
          readOnly={readOnly}
          renderers={LAYOUT_ITEM_RENDERERS}
          schema={schema}
          value={item}
          onValueChange={(next) => {
          if (next.positioning === 'flow' && (!parent || !getComposeLayout(parent))) return
          if (!hugAllowed && (next.width.mode === 'hug' || next.height.mode === 'hug')) return
          const bakedBox = item.positioning === 'flow' && next.positioning === 'absolute'
            ? layoutSnapshot?.boxes[entity.id]
            : undefined
          const parentBorder = parent ? resolveComposeAppearance(parent).borderWidth : 0
          const widthMode = next.positioning === 'absolute' && next.width.mode === 'fill'
            ? 'fixed'
            : next.width.mode
          const heightMode = next.positioning === 'absolute' && next.height.mode === 'fill'
            ? 'fixed'
            : next.height.mode
          dispatch(command(
            idFactory,
            entity,
            BUILTIN_COMMAND_TYPES.updateComponent,
            {
              entityId: entity.id,
              key: 'LayoutItem',
              value: {
                ...item,
                positioning: next.positioning,
                offset: bakedBox
                  ? { x: bakedBox.x - parentBorder, y: bakedBox.y - parentBorder }
                  : next.offset,
                width: {
                  ...next.width,
                  mode: widthMode,
                  value: bakedBox && item.width.mode === 'fill'
                    ? bakedBox.width
                    : next.width.value,
                },
                height: {
                  ...next.height,
                  mode: heightMode,
                  value: bakedBox && item.height.mode === 'fill'
                    ? bakedBox.height
                    : next.height.value,
                },
                margin: next.margin,
                alignSelf: next.alignSelf,
              },
            },
            zh ? `修改 ${entity.name} 布局项` : `Update ${entity.name} layout item`,
          ))
          }}
        />
      </LayoutItemInspectorContext.Provider>
    )
  }
}

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
