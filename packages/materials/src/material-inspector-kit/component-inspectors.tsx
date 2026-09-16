import { createContext, useContext, useId, useMemo, useState } from 'react'
import * as v from 'valibot'
import {
  type ComposeGridItem,
  composeGridColumnWidth,
  solveComposeGrid,
  isComposeGridLayout,
  getComposeGridItem,
  BUILTIN_COMMAND_TYPES,
  DEFAULT_COMPOSE_APPEARANCE,
  createDefaultComposeLayoutItem,
  getComposeAppearance,
  getComposeHierarchy,
  getComposeLayout,
  getComposeLayoutItem,
  getComposeRenderer,
  getComposeSpatialTransform,
  getComposeTransform,
  getComposeTransformPivot,
  formatComposeNumber,
  roundComposeGeometry,
  resolveComposeAppearance,
  resolveComposeGeometryConstraints,
  resolveComposeOverflow,
  type ComposeAppearance,
  type ComposeAxisSizing,
  type ComposeColor,
  type ComposeCurve,
  type ComposeEdges,
  type ComposeEntity,
  type ComposeGeometryConstraints,
  type ComposeLayoutItem,
  type ComposePosition,
  type ComposePaint,
  type EditorCommand,
  type JsonObject,
  type JsonValue,
  createComposeBatchCommand,
  isComposeFrameEntity,
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
  /**
   * 尺寸为什么只读；可编辑时为 `null`。
   *
   * @remarks
   * 格中子级的盒**就是**格矩形，三种尺寸模式一个都用不上。仍然渲染而不是隐藏——
   * 「它现在到底多少像素」是个正当问题，只是答案不由这里给出。
   *
   * 记的是**原因**而不是一个布尔：两种只读对代码是同一句话（都不让改），对用户不是——
   * 「去改网格尺寸」与「这个物料就是不能调尺寸」一个有下一步、一个没有，而一个按不动
   * 又不说为什么的输入框，用户只会当成坏了。
   */
  readonly sizeReadOnlyReason: 'grid' | 'material' | null
  readonly zh: boolean
}

const BasicGeometryInspectorContext = createContext<BasicGeometryInspectorView>({
  computedHeight: 0,
  computedWidth: 0,
  fillAllowed: false,
  hugAllowed: false,
  sizeReadOnlyReason: null,
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
  /** 父级为 Auto Layout 或网格容器时才出现：true 表示子级已脱离父级排布。 */
  readonly ignoreLayout?: boolean
  readonly position?: { readonly x: number; readonly y: number }
  /** 父级为网格容器时才出现：格坐标（列、行）。 */
  readonly gridCell?: { readonly x: number; readonly y: number }
  /** 父级为网格容器时才出现：格跨度（宽、高），单位是格。 */
  readonly gridSpan?: { readonly x: number; readonly y: number }
  readonly alignSelf?: ComposeLayoutItem['alignSelf']
  readonly rotation: number
  readonly pivot: PivotAnchor
  readonly size: BasicSizeValue
  readonly margin: ComposeEdges
}

/**
 * 旋转基点的九个锚点。
 *
 * @remarks
 * 曲线几何归一化后紧包围盒左上角恒为盒原点，因此一条线的端点必定落在盒的角或边中点上——
 * 刀闸的铰点正是端点。九个锚点覆盖真实用法，且不需要在 property-panel 里新写一个 editor。
 *
 * 文档字段仍是自由二维点：**UI 的取值约束不上升为协议的约束**，将来补自定义数值输入或
 * 画布手柄都不动协议。
 */
const PIVOT_ANCHORS = {
  'top-left': { x: 0, y: 0 },
  'top-center': { x: 0.5, y: 0 },
  'top-right': { x: 1, y: 0 },
  'middle-left': { x: 0, y: 0.5 },
  center: { x: 0.5, y: 0.5 },
  'middle-right': { x: 1, y: 0.5 },
  'bottom-left': { x: 0, y: 1 },
  'bottom-center': { x: 0.5, y: 1 },
  'bottom-right': { x: 1, y: 1 },
} as const satisfies Record<string, ComposePosition>

type PivotAnchor = keyof typeof PIVOT_ANCHORS

const PIVOT_ANCHOR_VALUES = Object.keys(PIVOT_ANCHORS) as [PivotAnchor, ...PivotAnchor[]]

/**
 * 把基点映射回九个锚点之一。
 *
 * @remarks
 * 落在九点之外（将来的自定义输入或画布手柄写出的值）时回退显示为最近的锚点是错的——那会让
 * 面板显示一个用户没设过的值。这里回退到 `center` 之外的做法是：只在精确相等时命中，
 * 否则返回 null，由调用方决定怎么显示。
 */
function pivotAnchorOf(pivot: ComposePosition): PivotAnchor | null {
  for (const [name, candidate] of Object.entries(PIVOT_ANCHORS) as [PivotAnchor, ComposePosition][]) {
    if (candidate.x === pivot.x && candidate.y === pivot.y) return name
  }
  return null
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
  // Fixed 轴显示数值时走统一的几何精度；Fill/Hug 显示模式名，不受精度影响。
  const displayValue = sizing.mode === 'fixed'
    ? formatComposeNumber(sizing.value)
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
  const locked = readOnly || view.sizeReadOnlyReason !== null
  const suggestions = [
    ...(view.fillAllowed
      ? [{ value: 'fill' as const, label: 'Fill' as const }]
      : []),
    ...(view.hugAllowed
      ? [{ value: 'hug' as const, label: 'Hug' as const }]
      : []),
  ]
  /*
   * 只读的理由写在两个框下面。**只在这里写一次而不是每个轴写一遍**——两个轴的理由恒相同，
   * 写两遍会让用户去找它们有什么不同；而放在框外面才既是可见文本、又能被读屏顺着读到
   * （框已经 `disabled`，聚焦不到它，挂 `aria-describedby` 到框上等于没写）。
   *
   * **只有网格那一档写**：`resize: 'none'` 在同一个面板里已经有一处可见的说明（几何约束
   * 分组的「Resize 模式：禁止」），再写一句是把同一件事说两遍；而网格那一档在面板上
   * 一个字都没有，还恰恰是唯一有下一步可做的——去改「网格尺寸」。
   */
  const note = view.sizeReadOnlyReason === 'grid'
    ? (view.zh ? '尺寸由网格决定，改下面的「网格尺寸」' : 'Size comes from the grid — use “Grid size” below')
    : null
  return (
    <>
      <div className="layout-item-inspector__size">
        <AxisSizingControl
          axis="width"
          computed={view.computedWidth}
          readOnly={locked}
          sizing={size.width}
          suggestions={suggestions}
          zh={view.zh}
          onCommit={(width) => commit({ ...size, width }, 'commit')}
        />
        <AxisSizingControl
          axis="height"
          computed={view.computedHeight}
          readOnly={locked}
          sizing={size.height}
          suggestions={suggestions}
          zh={view.zh}
          onCommit={(height) => commit({ ...size, height }, 'commit')}
        />
      </div>
      {note === null ? null : (
        <p className="layout-item-inspector__size-note">{note}</p>
      )}
    </>
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


/**
 * 格坐标与格跨度的一对 editor。
 *
 * @remarks
 * **不复用位置 editor**：跨度不是位置。复用会让两个含义不同的字段拿到同一个可访问名
 * （屏幕阅读器上都念「位置 X」），而这正是这块面板反复在躲的那一类缺陷——两样东西长得一样
 * 而按下去做的事不同。前缀也各自跟着领域走：坐标是列 / 行，跨度是宽 / 高。
 *
 * 两者只接受整数：格是离散的，`2.5 列`在求解里会被立刻取整，留一个能打出来却不生效的值比
 * 不让打更糟。
 */
// eslint-disable-next-line react-refresh/only-export-components -- 组件仅注册到当前 Inspector 的实例级 renderer。
function GridPairEditor({
  commit,
  label,
  prefixes,
  readOnly,
  minimum,
  value,
}: Pick<ComposePropertyPanelRendererProps, 'commit' | 'label' | 'readOnly' | 'value'> & {
  readonly prefixes: readonly [string, string]
  readonly minimum: number
}) {
  const pair = value as unknown as BasicPositionValue
  const round = (next: number) => Math.max(minimum, Math.round(next))
  return (
    <div className="layout-item-inspector__position">
      <InspectorNumberDraftInput
        label={`${label} ${prefixes[0]}`}
        prefix={prefixes[0]}
        readOnly={readOnly}
        value={pair.x}
        onCommit={(x) => commit({ ...pair, x: round(x) }, 'commit')}
      />
      <InspectorNumberDraftInput
        label={`${label} ${prefixes[1]}`}
        prefix={prefixes[1]}
        readOnly={readOnly}
        value={pair.y}
        onCommit={(y) => commit({ ...pair, y: round(y) }, 'commit')}
      />
    </div>
  )
}

// eslint-disable-next-line react-refresh/only-export-components -- 组件仅注册到当前 Inspector 的实例级 renderer。
function BasicGridCellEditor(props: ComposePropertyPanelRendererProps) {
  const zh = useZh()
  return <GridPairEditor {...props} minimum={0} prefixes={zh ? ['列', '行'] : ['Col', 'Row']} />
}

// eslint-disable-next-line react-refresh/only-export-components -- 组件仅注册到当前 Inspector 的实例级 renderer。
function BasicGridSpanEditor(props: ComposePropertyPanelRendererProps) {
  const zh = useZh()
  return <GridPairEditor {...props} minimum={1} prefixes={zh ? ['宽', '高'] : ['W', 'H']} />
}

const BASIC_GEOMETRY_RENDERERS: readonly ComposePropertyPanelRenderer[] = [
  {
    id: 'basic-geometry-grid-cell',
    component: BasicGridCellEditor,
    layout: 'inline',
  },
  {
    id: 'basic-geometry-grid-span',
    component: BasicGridSpanEditor,
    layout: 'inline',
  },
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
    /*
     * 格中子级是几何分组的**第三档**：`positioning` 开关的 absolute / flow 两支之外，
     * 父级是网格容器时首个字段换成格坐标与格跨度。
     *
     * 判据是「父级是网格 **且**自己有 GridItem」——切换布局类型的中间态里两者可能不同步，
     * 而此时按 flow 呈现是安全的降级：读到的仍是真实的求解结果。
     */
    const gridItem = isComposeGridLayout(parentLayout) ? getComposeGridItem(entity) : undefined
    const isGridChild = gridItem !== undefined
    const fillAllowed = !isGridChild && item.positioning === 'flow' && Boolean(parentLayout)
    // 「忽略 Auto Layout」是 Flow↔Absolute 的唯一显式转换入口；拖拽不再隐式脱流。
    const detachAllowed = Boolean(parentLayout)
    const hierarchy = getComposeHierarchy(entity)
    // Frame（场景）的尺寸由 Frame.size 唯一决定，文档校验直接拒绝 Hug；启用 Auto Layout 的
    // Frame 会让下面这个判断误判为 true，因此必须显式排除，避免暴露一个提交必然被拒的选项。
    const isFrame = isComposeFrameEntity(entity)
    const hugAllowed = isFrame
      ? false
      : hierarchy ? Boolean(getComposeLayout(entity)) : Boolean(getComposeRenderer(entity))
    const box = layoutSnapshot?.boxes[entity.id]
    const transform = getComposeSpatialTransform(entity)
    /*
     * `GeometryConstraints` 此前只有命令层在读。只加那一层的拒绝会造出一个比原来更差的
     * 状态——输入框接受了、图上没变，而面板没有任何东西说明为什么；这与「敲了没反应与敲错
     * 在屏幕上无法区分」是同一条判断。只读因此走与锁定**同一条** `readOnly` 通道，不为
     * 约束另造一套呈现：两者对用户是同一句话。
     *
     * 这条对**任何**声明了约束的 Entity 成立，不是接线点的特例。
     */
    const constraints = resolveComposeGeometryConstraints(entity)
    const sizeLocked = constraints.resize === 'none'
    const schema = useMemo<v.GenericSchema<BasicGeometryValue>>(() => {
      const sizingModes = fillAllowed
        ? (hugAllowed ? ['fixed', 'fill', 'hug'] as const : ['fixed', 'fill'] as const)
        : (hugAllowed ? ['fixed', 'hug'] as const : ['fixed'] as const)
      const sharedFields = {
        rotation: v.pipe(
          v.number(),
          v.finite(zh ? '旋转必须是有限数字' : 'Rotation must be finite'),
          v.title(zh ? '旋转' : 'Rotation'),
          v.metadata({ propertyPanel: {
            editor: 'angle',
            ...(constraints.rotatable ? {} : { readOnly: true }),
          } }),
        ),
        pivot: v.pipe(
          v.picklist(PIVOT_ANCHOR_VALUES),
          v.title(zh ? '旋转基点' : 'Rotation pivot'),
          v.description(zh
            ? '旋转绕这个点进行。刀闸这类绕铰点摆动的对象把它设到铰点所在的那一端。'
            : 'Rotation happens around this point. Set it to the hinge for objects that swing.'),
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
              // 文案跟着父级的布局类型走：一个说 Auto Layout 的开关出现在网格容器的子级上，
              // 用户会以为自己看错了面板。
              v.title(isComposeGridLayout(parentLayout)
                ? (zh ? '忽略网格' : 'Ignore grid')
                : (zh ? '忽略自动布局' : 'Ignore auto layout')),
            ),
          }
        : {}
      if (isGridChild) {
        /*
         * 网格档：格坐标顶掉位置与自身对齐；**外边距隐藏**——间距归容器（项间距那一格），
         * 每张卡再各带一份会让「两张卡之间到底多远」有两个来源。尺寸留着但只读。
         */
        const withoutMargin: v.ObjectEntries = {
          rotation: sharedFields.rotation,
          pivot: sharedFields.pivot,
          size: sharedFields.size,
        }
        return v.object({
          ...detachField,
          gridCell: v.pipe(
            v.custom<BasicPositionValue>(isBasicPositionValue),
            v.title(zh ? '网格位置' : 'Grid position'),
            v.metadata({ propertyPanel: { editor: 'basic-geometry-grid-cell' } }),
          ),
          gridSpan: v.pipe(
            v.custom<BasicPositionValue>(isBasicPositionValue),
            v.title(zh ? '网格尺寸' : 'Grid size'),
            v.metadata({ propertyPanel: { editor: 'basic-geometry-grid-span' } }),
          ),
          ...withoutMargin,
        }) as unknown as v.GenericSchema<BasicGeometryValue>
      }
      if (item.positioning === 'absolute') {
        return v.object({
          ...detachField,
          position: v.pipe(v.custom<BasicPositionValue>(isBasicPositionValue),
            v.title(zh ? '位置' : 'Position'), v.metadata({
            propertyPanel: {
              editor: 'basic-geometry-position',
              ...(constraints.movable ? {} : { readOnly: true }),
            },
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
    }, [
      constraints.movable,
      constraints.rotatable,
      detachAllowed,
      fillAllowed,
      hugAllowed,
      isGridChild,
      item.positioning,
      parentLayout,
      zh,
    ])
    const placementValue = gridItem
      ? {
          gridCell: { x: gridItem.x, y: gridItem.y },
          gridSpan: { x: gridItem.w, y: gridItem.h },
        }
      : item.positioning === 'absolute'
        ? { position: { x: item.offset.x, y: item.offset.y } }
        : { alignSelf: item.alignSelf }
    const viewValue: BasicGeometryValue = {
      ...(detachAllowed ? { ignoreLayout: item.positioning === 'absolute' } : {}),
      ...placementValue,
      rotation: transform.rotation,
      // 落在九点之外的基点（将来的自定义输入写出的值）显示为中心：面板此刻表达不了它，
      // 而九选一里没有「其它」这一档。
      pivot: pivotAnchorOf(getComposeTransformPivot(entity)) ?? 'center',
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
      ...(gridItem
        ? {
            gridCell: { x: gridItem.x, y: gridItem.y },
            gridSpan: { x: gridItem.w, y: gridItem.h },
          }
        : item.positioning === 'absolute'
          ? { position: { x: item.offset.x, y: item.offset.y } }
          : { alignSelf: createDefaultComposeLayoutItem().alignSelf }),
      rotation: DEFAULT_COMPOSE_TRANSFORM.rotation,
      pivot: 'center',
      size: { width: item.width, height: item.height },
      margin: createDefaultComposeLayoutItem().margin,
    }), [detachAllowed, gridItem, item.offset.x, item.offset.y, item.positioning, item.width, item.height])
    /**
     * 回流进网格时的起点格坐标。
     *
     * @remarks
     * 按当前视觉盒就近取格；落格产生的碰撞由下一次求解统一解开。取不到布局结果时退到
     * 原点——那也是一个合法起点，求解会把它推到第一块空位上。
     */
    const gridPlacementForReflow = (): ComposeGridItem => {
      const layout = parent ? getComposeLayout(parent) : undefined
      const parentBox = parent ? layoutSnapshot?.boxes[parent.id] : undefined
      if (!isComposeGridLayout(layout) || !box || !parentBox) return { x: 0, y: 0, w: 4, h: 2 }
      const border = resolveComposeAppearance(parent!).borderWidth
      const metrics = {
        columns: layout.columns,
        rowHeight: layout.rowHeight,
        rowGap: layout.rowGap,
        columnGap: layout.columnGap,
        contentWidth: Math.max(
          0,
          parentBox.width - border * 2 - layout.padding.left - layout.padding.right,
        ),
      }
      const columnStep = composeGridColumnWidth(metrics) + layout.columnGap
      const rowStep = layout.rowHeight + layout.rowGap
      const originX = border + layout.padding.left
      const originY = border + layout.padding.top
      const w = columnStep > 0
        ? Math.min(layout.columns, Math.max(1, Math.round((box.width + layout.columnGap) / columnStep)))
        : 1
      const h = rowStep > 0 ? Math.max(1, Math.round((box.height + layout.rowGap) / rowStep)) : 1
      return {
        x: columnStep > 0
          ? Math.min(Math.max(0, Math.floor((box.x - originX) / columnStep)), Math.max(0, layout.columns - w))
          : 0,
        y: rowStep > 0 ? Math.max(0, Math.floor((box.y - originY) / rowStep)) : 0,
        w,
        h,
      }
    }
    const updateLayoutItem = (nextItem: ComposeLayoutItem, gridPlacement?: ComposeGridItem) => {
      const layoutItemCommand = command(
        idFactory,
        entity,
        BUILTIN_COMMAND_TYPES.updateComponent,
        { entityId: entity.id, key: 'LayoutItem', value: nextItem as unknown as JsonValue },
        zh ? `修改 ${entity.name} 布局项` : `Update ${entity.name} layout item`,
      )
      const sizeChanged = nextItem.width.value !== item.width.value
        || nextItem.height.value !== item.height.value
      // Frame 的尺寸事实来源是 Frame.size，布局求解会用它覆盖 LayoutItem 的推导结果。
      // 因此尺寸变化必须一并写 Frame.size，否则文档变了而画面不动。两条命令合成一次事务：
      // 用户只做了一个动作，撤销就该一步回到位。
      // 回流进网格：LayoutItem 与 GridItem 必须写在同一条事务里，否则中间会出现一个
      // 「已经是 Flow 却没有格坐标」的可观察状态，而撤销也变两步。
      if (gridPlacement) {
        return dispatch(createComposeBatchCommand({
          id: idFactory(),
          commands: [
            layoutItemCommand,
            {
              id: idFactory(),
              type: getComposeGridItem(entity)
                ? BUILTIN_COMMAND_TYPES.updateComponent
                : BUILTIN_COMMAND_TYPES.addComponent,
              payload: {
                entityId: entity.id,
                key: 'GridItem',
                value: gridPlacement as unknown as JsonValue,
              },
            },
          ],
          meta: {
            label: zh ? `把 ${entity.name} 放回网格` : `Return ${entity.name} to grid`,
            source: 'inspector',
            targetIds: [entity.id],
          },
        }))
      }
      if (!isFrame || !sizeChanged) return dispatch(layoutItemCommand)
      return dispatch(createComposeBatchCommand({
        id: idFactory(),
        commands: [
          command(
            idFactory,
            entity,
            BUILTIN_COMMAND_TYPES.setFrameSize,
            {
              entityId: entity.id,
              size: { width: nextItem.width.value, height: nextItem.height.value },
            },
            zh ? `修改 ${entity.name} 尺寸` : `Resize ${entity.name}`,
          ),
          layoutItemCommand,
        ],
        meta: {
          label: zh ? `修改 ${entity.name} 尺寸` : `Resize ${entity.name}`,
          source: 'inspector',
          targetIds: [entity.id],
        },
      }))
    }
    return (
      <BasicGeometryInspectorContext.Provider value={{
        computedHeight: box?.height ?? item.height.value,
        computedWidth: box?.width ?? item.width.value,
        fillAllowed,
        // 格中子级的盒就是格矩形；`resize: 'none'` 则是尺寸根本不是作者写下的量。
        // 网格排在前面：两者同时成立时「去改网格尺寸」才是用户接下来做得到的那一步。
        sizeReadOnlyReason: isGridChild ? 'grid' : sizeLocked ? 'material' : null,
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
                  // 回流：保持 childIds 位置不变。网格父级按当前视觉位置就近落格——落格由
                  // 下一次求解统一解开碰撞，这里只给出一个起点。
                  if (isComposeGridLayout(parentLayout)) {
                    updateLayoutItem({ ...item, positioning: 'flow' }, gridPlacementForReflow())
                  }
                  else {
                    updateLayoutItem({ ...item, positioning: 'flow' })
                  }
                }
                return
              }
              if ((field === 'gridCell' || field === 'gridSpan') && gridItem && parent) {
                /*
                 * 键入的格坐标走**与画布拖动同一个求解器**：画布与面板是同一份事实的两个
                 * 入口，各解一次会让「面板里输 0,2」与「拖到 0,2」得到不同的结果。
                 * 推挤出来的兄弟与目标写在同一条 batch 里，撤销一步全部回去。
                 */
                const layout = getComposeLayout(parent)
                if (!isComposeGridLayout(layout) || !document) return
                const cell = field === 'gridCell' ? next.gridCell : undefined
                const span = field === 'gridSpan' ? next.gridSpan : undefined
                const desired = {
                  id: entity.id,
                  x: Math.max(0, Math.round(cell?.x ?? gridItem.x)),
                  y: Math.max(0, Math.round(cell?.y ?? gridItem.y)),
                  w: Math.max(1, Math.round(span?.x ?? gridItem.w)),
                  h: Math.max(1, Math.round(span?.y ?? gridItem.h)),
                }
                const siblings = (getComposeHierarchy(parent)?.childIds ?? [])
                  .flatMap((childId) => {
                    if (childId === entity.id) return []
                    const sibling = getComposeGridItem(document.entities[childId])
                    return sibling
                      ? [{ id: childId, x: sibling.x, y: sibling.y, w: sibling.w, h: sibling.h }]
                      : []
                  })
                const solved = solveComposeGrid([...siblings, desired], {
                  columns: layout.columns,
                  float: layout.float,
                  anchorId: entity.id,
                })
                const batchId = idFactory()
                const writes = solved.flatMap((solvedCell) => {
                  const before = getComposeGridItem(document.entities[solvedCell.id])
                  if (before && before.x === solvedCell.x && before.y === solvedCell.y
                    && before.w === solvedCell.w && before.h === solvedCell.h) return []
                  return [{
                    id: `${batchId}:${solvedCell.id}:grid-item`,
                    type: BUILTIN_COMMAND_TYPES.updateComponent,
                    payload: {
                      entityId: solvedCell.id,
                      key: 'GridItem',
                      value: {
                        ...(before ?? {}),
                        x: solvedCell.x,
                        y: solvedCell.y,
                        w: solvedCell.w,
                        h: solvedCell.h,
                      },
                    },
                  }]
                })
                if (writes.length === 0) return
                dispatch(createComposeBatchCommand({
                  id: batchId,
                  commands: writes,
                  meta: {
                    label: zh ? `调整 ${entity.name} 的网格位置` : `Move ${entity.name} in grid`,
                    source: 'inspector',
                    targetIds: solved.map((solvedCell) => solvedCell.id),
                  },
                }))
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
              if (field === 'pivot') {
                // 基点是 Transform 上的普通字段，用通用的 Component 更新命令写。
                // `entity.transform.set` 的载荷是 position/size/rotation 的合成值，
                // 本来就没有基点的位置，硬塞会让一个纯几何命令开始携带非几何字段。
                dispatch(command(
                  idFactory,
                  entity,
                  BUILTIN_COMMAND_TYPES.updateComponent,
                  {
                    entityId: entity.id,
                    key: 'Transform',
                    value: {
                      ...getComposeTransform(entity),
                      pivot: PIVOT_ANCHORS[next.pivot],
                    } as unknown as JsonValue,
                  },
                  zh ? `修改 ${entity.name} 旋转基点` : `Update ${entity.name} rotation pivot`,
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

/**
 * 创建 Curve Component Inspector。
 *
 * @remarks
 * 面板里的端点是 **parent 局部坐标**——用户读到的是「这条线画在场景的哪里」，而文档里存的
 * 是盒局部坐标。两者相差一个 `LayoutItem.offset`，换算只在这里做一次：写回派发
 * `entity.curve.set`，由那条漏斗负责重新归一化盒与几何。
 *
 * @internal
 */
export function createCurveInspector(
  idFactory: InspectorIdFactory,
): ComponentType<ComposeComponentInspectorProps> {
  return function CurveInspector({ entity, dispatch, readOnly, value }) {
    const zh = useZh()
    const curve = value as unknown as ComposeCurve
    const kind = curve.kind
    const schema = useMemo(() => {
      const point = (title: string) => v.pipe(
        v.object({ x: v.number(), y: v.number() }),
        v.title(title),
        v.metadata({ propertyPanel: { editor: 'vector2' } }),
      )
      if (kind === 'line') {
        return v.object({
          start: point(zh ? '起点' : 'Start'),
          end: point(zh ? '终点' : 'End'),
        })
      }
      // `path` 不呈现几何字段，因此这里也没有 schema 可给。它仍然要在这一支产出一个合法的
      // schema：早退发生在 Hook 之后，Hook 本身不能有条件地不跑。
      if (kind === 'path') return v.object({})
      if (kind === 'arc') {
        return v.object({
          center: point(zh ? '圆心' : 'Center'),
          radius: v.pipe(
            v.number(),
            v.minValue(0.01, zh ? '半径必须为正' : 'Radius must be positive'),
            v.title(zh ? '半径' : 'Radius'),
          ),
          startAngle: v.pipe(
            v.number(),
            v.title(zh ? '起始角' : 'Start angle'),
            v.metadata({ propertyPanel: { editor: 'angle' } }),
          ),
          // 扫掠角刻意用普通数字而不是 angle editor：angle 会把值归一到一圈之内，
          // 而 ±360 正是整圆的表达方式，归一化会把整圆变成零长弧。
          sweep: v.pipe(
            v.number(),
            v.title(zh ? '扫掠角' : 'Sweep'),
            v.description(zh
              ? '正为顺时针；绝对值 360 表示整圆。'
              : 'Positive is clockwise; an absolute value of 360 is a full circle.'),
          ),
        })
      }
      return v.object({
        vertices: v.pipe(
          v.array(point(zh ? '顶点' : 'Vertex')),
          v.title(zh ? '顶点' : 'Vertices'),
        ),
        closed: v.pipe(v.boolean(), v.title(zh ? '闭合' : 'Closed')),
        // 面板上 0 就是「没有圆角」，写回时那个字段被删掉——协议里缺席与 0 是同一件事。
        cornerRadius: v.pipe(
          v.number(),
          v.minValue(0, zh ? '圆角不能为负' : 'Corner radius cannot be negative'),
          v.title(zh ? '圆角' : 'Corner radius'),
          v.description(zh
            ? '四个角联动；每个角实际画多大按相邻边长钳制，不改这个值。'
            : 'Shared by every corner; each is clamped to its adjacent edges without changing this value.'),
        ),
      })
    }, [kind, zh])

    /*
     * `path` 不呈现逐控制点的几何字段：一条导入来的路径有几十个控制点，逐点列出的面板既读
     * 不懂也点不动，而它的几何编辑入口在画布上（顶点方块与控制手柄）。描边、填充与变换由各自
     * 的 Component Inspector 呈现，不受这一条影响。
     */
    if (curve.kind === 'path') return null

    const offset = getComposeLayoutItem(entity)?.offset ?? { x: 0, y: 0 }
    const toParent = (point: { readonly x: number; readonly y: number }) => ({
      x: roundComposeGeometry(point.x + offset.x),
      y: roundComposeGeometry(point.y + offset.y),
    })
    const viewValue = curve.kind === 'line'
      ? { start: toParent(curve.start), end: toParent(curve.end) }
      : curve.kind === 'arc'
        ? {
            center: toParent(curve.center),
            radius: curve.radius,
            startAngle: curve.startAngle,
            sweep: curve.sweep,
          }
        : {
            vertices: curve.vertices.map(toParent),
            closed: curve.closed,
            cornerRadius: curve.cornerRadius ?? 0,
          }

    return (
      <ComposePropertyPanel
        aria-label={zh ? '曲线属性' : 'Curve properties'}
        readOnly={readOnly}
        schema={schema as v.GenericSchema<Record<string, unknown>>}
        value={viewValue}
        onValueChange={(next) => {
          if (readOnly) return
          const merged: Record<string, unknown> = { ...curve, ...next }
          // 缺席与 0 是同一件事：留两种表示会让「有没有圆角」在两处读出不同答案，而校验
          // 只接受在场时是正数的那一种。
          if (!(typeof merged.cornerRadius === 'number' && merged.cornerRadius > 0)) {
            delete merged.cornerRadius
          }
          dispatch(command(
            idFactory,
            entity,
            BUILTIN_COMMAND_TYPES.setCurve,
            { entityId: entity.id, curve: merged as unknown as JsonValue },
            zh ? `编辑 ${entity.name} 的几何` : `Edit ${entity.name} geometry`,
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
    // 缺席的 Clip 按「不裁剪」解析：场景（`createComposeFrameEntity`）与 v6 迁移出来的
    // 容器都没有这个 Component，而「所有带 Hierarchy 的物料都能配溢出」是本 Inspector 的
    // 契约——按 Component 在不在来分支会让这些容器少掉两行属性，且画布上没有别的入口。
    // 写入由 `entity.clip.configure` 补齐 Component，因此这里不需要先添加能力。
    const overflow = resolveComposeOverflow(entity)
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
